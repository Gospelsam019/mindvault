/**
 * Read-only catalog comparison across two network profiles (#80).
 *
 * Both profiles are named explicitly by the caller. Each side's API URL and
 * registry contract id are resolved from the same configuration rules the
 * server uses at startup, and each catalog is read with a plain GET: nothing
 * is written and no wallet or credential is involved.
 */

import { buildConfig } from "./config.js";
import type { ToolOutcome } from "./toolResult.js";

export const COMPARE_NETWORKS = ["testnet", "mainnet"] as const;
export type CompareNetwork = (typeof COMPARE_NETWORKS)[number];

export const COMPARE_DEFAULT_LIMIT = 100;
export const COMPARE_MAX_LIMIT = 100;

/** Fields compared for resources present on both sides. */
export const COMPARED_FIELDS = [
  "title",
  "description",
  "price",
  "resourceType",
  "verificationStatus",
  "tags",
] as const;
export type ComparedField = (typeof COMPARED_FIELDS)[number];

export interface CompareSide {
  network: string;
  x402Network: string;
  apiUrl: string;
  registryContractId: string | null;
  count: number;
}

export interface NormalizedEntry {
  id: string;
  title: string;
  description: string;
  price: string;
  resourceType: string;
  verificationStatus: string;
  tags: string[];
}

export interface CatalogComparison {
  left: CompareSide;
  right: CompareSide;
  onlyInLeft: string[];
  onlyInRight: string[];
  differing: { id: string; fields: Record<string, { left: unknown; right: unknown }> }[];
  identicalCount: number;
  truncated: boolean;
  summary: string;
}

/** Minimal GET client: matches the shape of the server's `jsonFetch`. */
export type CompareFetch = (url: string) => Promise<{ ok: boolean; status: number; data: any }>;

const COMPARE_SIDE_SCHEMA = {
  type: "object",
  properties: {
    network: { type: "string" },
    x402Network: { type: "string" },
    apiUrl: { type: "string" },
    registryContractId: { type: ["string", "null"] },
    count: { type: "integer" },
  },
  required: ["network", "x402Network", "apiUrl", "registryContractId", "count"],
} as const;

export const COMPARE_CATALOGS_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    left: COMPARE_SIDE_SCHEMA,
    right: COMPARE_SIDE_SCHEMA,
    onlyInLeft: { type: "array", items: { type: "string" } },
    onlyInRight: { type: "array", items: { type: "string" } },
    differing: {
      type: "array",
      items: {
        type: "object",
        properties: { id: { type: "string" }, fields: { type: "object" } },
        required: ["id", "fields"],
      },
    },
    identicalCount: { type: "integer" },
    truncated: { type: "boolean" },
    summary: { type: "string" },
  },
  required: [
    "left",
    "right",
    "onlyInLeft",
    "onlyInRight",
    "differing",
    "identicalCount",
    "truncated",
    "summary",
  ],
} as const;

/** Canonical form so cosmetic differences (padding, case, tag order) do not count. */
export function normalizeCatalogEntry(raw: any): NormalizedEntry | null {
  const id = typeof raw?.id === "string" ? raw.id.trim() : "";
  if (!id) return null;
  const priceNumber = Number(raw?.price);
  const tags: string[] = Array.isArray(raw?.tags)
    ? raw.tags
        .filter((t: unknown): t is string => typeof t === "string")
        .map((t: string) => t.trim().toLowerCase())
        .filter(Boolean)
    : [];
  return {
    id,
    title: String(raw?.title ?? "").trim(),
    description: String(raw?.description ?? "")
      .replace(/\s+/g, " ")
      .trim(),
    price: Number.isFinite(priceNumber) ? priceNumber.toFixed(7) : String(raw?.price ?? ""),
    resourceType: String(raw?.resourceType ?? ""),
    verificationStatus: String(raw?.verificationStatus ?? ""),
    tags: [...new Set(tags)].sort(),
  };
}

function indexEntries(resources: unknown[]): Map<string, NormalizedEntry> {
  const out = new Map<string, NormalizedEntry>();
  for (const r of resources) {
    const entry = normalizeCatalogEntry(r);
    if (entry && !out.has(entry.id)) out.set(entry.id, entry);
  }
  return out;
}

/** Pure comparison of two already-fetched catalogs. */
export function compareCatalogs(
  left: { side: CompareSide; resources: unknown[] },
  right: { side: CompareSide; resources: unknown[] },
  truncated = false,
): CatalogComparison {
  const a = indexEntries(left.resources);
  const b = indexEntries(right.resources);

  const onlyInLeft = [...a.keys()].filter((id) => !b.has(id)).sort();
  const onlyInRight = [...b.keys()].filter((id) => !a.has(id)).sort();
  const differing: CatalogComparison["differing"] = [];
  let identicalCount = 0;

  for (const id of [...a.keys()].filter((k) => b.has(k)).sort()) {
    const l = a.get(id)!;
    const r = b.get(id)!;
    const fields: Record<string, { left: unknown; right: unknown }> = {};
    for (const field of COMPARED_FIELDS) {
      if (JSON.stringify(l[field]) !== JSON.stringify(r[field])) {
        fields[field] = { left: l[field], right: r[field] };
      }
    }
    if (Object.keys(fields).length === 0) identicalCount++;
    else differing.push({ id, fields });
  }

  const summary =
    `${left.side.network} (${a.size}) vs ${right.side.network} (${b.size}): ` +
    `${identicalCount} identical, ${differing.length} differing, ` +
    `${onlyInLeft.length} only on ${left.side.network}, ${onlyInRight.length} only on ${right.side.network}.`;

  return {
    left: { ...left.side, count: a.size },
    right: { ...right.side, count: b.size },
    onlyInLeft,
    onlyInRight,
    differing,
    identicalCount,
    truncated,
    summary,
  };
}

/** Resolve one side's endpoints without letting the active network's overrides leak across. */
export function resolveCompareSide(
  network: CompareNetwork,
  env: NodeJS.ProcessEnv,
): Omit<CompareSide, "count"> {
  const active = buildConfig(env).stellarNetwork;
  const scoped: NodeJS.ProcessEnv = { ...env, STELLAR_NETWORK: network };
  if (active !== network) {
    // Network-specific overrides belong to the active network only.
    delete scoped.NETWORK;
    delete scoped.VAULT_REGISTRY_CONTRACT_ID;
    delete scoped.HORIZON_URL;
    delete scoped.SOROBAN_RPC_URL;
  }
  const cfg = buildConfig(scoped);
  return {
    network: cfg.stellarNetwork,
    x402Network: cfg.x402Network,
    apiUrl: cfg.baseUrl,
    registryContractId: cfg.registryContractId || null,
  };
}

function networkArg(args: Record<string, unknown>, key: "left" | "right"): CompareNetwork {
  const value = args[key];
  if ((COMPARE_NETWORKS as readonly unknown[]).includes(value)) return value as CompareNetwork;
  throw new Error(`${key} is required and must be one of: ${COMPARE_NETWORKS.join(", ")}.`);
}

async function readCatalog(
  side: Omit<CompareSide, "count">,
  limit: number,
  fetchJson: CompareFetch,
): Promise<unknown[]> {
  const res = await fetchJson(`${side.apiUrl}/resources?limit=${limit}`);
  if (!res.ok) {
    throw new Error(
      `Could not read the ${side.network} catalog from ${side.apiUrl} (HTTP ${res.status}).`,
    );
  }
  return Array.isArray(res.data) ? res.data : [];
}

/** Tool entry point: explicit profiles in, read-only comparison out. */
export async function compareCatalogsTool(
  args: Record<string, unknown>,
  fetchJson: CompareFetch,
  env: NodeJS.ProcessEnv = process.env,
): Promise<ToolOutcome> {
  const leftNet = networkArg(args, "left");
  const rightNet = networkArg(args, "right");
  if (leftNet === rightNet) {
    throw new Error("left and right must name two different profiles (testnet and mainnet).");
  }
  const rawLimit = args.limit;
  const limit =
    typeof rawLimit === "number" && Number.isInteger(rawLimit) && rawLimit >= 1
      ? Math.min(rawLimit, COMPARE_MAX_LIMIT)
      : COMPARE_DEFAULT_LIMIT;

  const leftSide = resolveCompareSide(leftNet, env);
  const rightSide = resolveCompareSide(rightNet, env);
  const [leftResources, rightResources] = await Promise.all([
    readCatalog(leftSide, limit, fetchJson),
    readCatalog(rightSide, limit, fetchJson),
  ]);

  const result = compareCatalogs(
    { side: { ...leftSide, count: 0 }, resources: leftResources },
    { side: { ...rightSide, count: 0 }, resources: rightResources },
    leftResources.length >= limit || rightResources.length >= limit,
  );
  const note = result.truncated
    ? `\nResults were capped at ${limit} per profile; resources beyond that were not compared.`
    : "";
  const text = [
    result.summary,
    `${result.left.network}: ${result.left.apiUrl}, contract ${result.left.registryContractId ?? "not configured"}`,
    `${result.right.network}: ${result.right.apiUrl}, contract ${result.right.registryContractId ?? "not configured"}`,
    "",
    JSON.stringify(result, null, 2),
  ].join("\n");
  return { text: text + note, structured: result as unknown as Record<string, unknown> };
}
