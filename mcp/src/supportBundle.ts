/**
 * Incident-scoped, redacted support bundle (#84).
 *
 * `mindvault_debug_bundle` describes the whole server. When support is asked
 * about one failure, that is too much: it carries unrelated activity and more
 * configuration than the incident needs. `mindvault_support_bundle` instead
 * exports only what is tied to a single incident, identified by the
 * correlation ID the failing tool call reported (`mv-<time>-<random>`).
 *
 * Properties, by construction:
 *   - Explicit scope: an incident ID is required and must be a well-formed
 *     correlation ID. There is no "everything" mode.
 *   - Bounded: at most `SUPPORT_BUNDLE_MAX_ENTRIES` audit entries, drawn from
 *     the bounded tail window the audit reader already caps.
 *   - Redacted: audit lines are redacted when read; the final document is
 *     swept for Stellar secret keys and passed through the shared redactor.
 *     Wallet secrets and API keys are never read; only the active profile's
 *     name and public address are reported, never other profiles.
 *   - Deterministic: no clock or random input. The same inputs always give the
 *     same document, with entries in log order.
 */

import { collectAuditTail, type AuditLogTail } from "./debugBundle.js";
import { buildConfig } from "./config.js";
import { isCorrelationId } from "./correlation.js";
import { redactObject, redactSecrets } from "./redaction.js";
import type { MetricsSnapshot, ToolMetric } from "./metrics.js";
import { activeProfileName, metrics, profiles } from "./runtime.js";

export const SUPPORT_BUNDLE_SCHEMA = "mindvault.support-bundle/v1";
export const SUPPORT_BUNDLE_DEFAULT_ENTRIES = 100;
export const SUPPORT_BUNDLE_MAX_ENTRIES = 200;

/** Audit lines scanned from the end of the log when looking for the incident. */
export const SUPPORT_BUNDLE_SCAN_LINES = 5000;

const STELLAR_SECRET_KEY = /S[A-Z2-7]{55}/g;

export interface SupportBundleOptions {
  incidentId: string;
  maxEntries: number;
}

export interface SupportBundleInput {
  config: {
    stellarNetwork: string;
    x402Network: string;
    baseUrl: string;
    registryContractId: string;
  };
  profile: {
    name: string;
    hasWallet: boolean;
    publicKey: string | null;
    network: string | null;
  };
  metrics: MetricsSnapshot;
  auditLog: AuditLogTail;
}

export interface SupportBundle {
  schema: typeof SUPPORT_BUNDLE_SCHEMA;
  incidentId: string;
  found: boolean;
  config: SupportBundleInput["config"];
  profile: SupportBundleInput["profile"];
  trace: {
    auditLogEnabled: boolean;
    scanned: number;
    matched: number;
    truncated: boolean;
    /** Tools named by the incident's entries, sorted. */
    tools: string[];
    entries: Array<Record<string, unknown>>;
  };
  metrics: { enabled: boolean; tools: Record<string, ToolMetric> };
  included: string[];
}

/** What the bundle contains, listed in the bundle itself for the reader. */
export const SUPPORT_BUNDLE_INCLUDED_FIELDS: readonly string[] = [
  "config.stellarNetwork, x402Network, baseUrl, registryContractId",
  "profile.name, hasWallet, publicKey, network (active profile only)",
  "trace.entries: audit-log entries whose correlationId equals the incident ID",
  "metrics.tools: counters for the tools named by those entries",
];

/** Validate and bound the tool arguments. */
export function normalizeSupportBundleOptions(args?: Record<string, unknown>): SupportBundleOptions {
  const incidentId = args?.incidentId;
  if (typeof incidentId !== "string" || !isCorrelationId(incidentId.trim())) {
    throw new Error(
      "incidentId is required and must be a correlation ID such as 'mv-lx3k9a2-4f7q' (from a failed tool call).",
    );
  }
  const raw = args?.maxEntries;
  const maxEntries =
    typeof raw === "number" && Number.isInteger(raw)
      ? Math.max(1, Math.min(SUPPORT_BUNDLE_MAX_ENTRIES, raw))
      : SUPPORT_BUNDLE_DEFAULT_ENTRIES;
  return { incidentId: incidentId.trim(), maxEntries };
}

/** Pure builder: filters, bounds and redacts. Deterministic for a fixed input. */
export function buildSupportBundle(
  input: SupportBundleInput,
  options: SupportBundleOptions,
): SupportBundle {
  const matching = input.auditLog.entries.filter((e) => e.correlationId === options.incidentId);
  const entries = matching.slice(-options.maxEntries);
  const tools = [
    ...new Set(
      entries
        .map((e) => e.toolName)
        .filter((name): name is string => typeof name === "string" && name.length > 0),
    ),
  ].sort();

  const toolMetrics: Record<string, ToolMetric> = {};
  for (const name of tools) {
    const metric = input.metrics.tools[name];
    if (metric) toolMetrics[name] = { ...metric };
  }

  const bundle: SupportBundle = {
    schema: SUPPORT_BUNDLE_SCHEMA,
    incidentId: options.incidentId,
    found: matching.length > 0,
    config: { ...input.config },
    profile: { ...input.profile },
    trace: {
      auditLogEnabled: input.auditLog.enabled,
      scanned: input.auditLog.entries.length,
      matched: matching.length,
      truncated: matching.length > entries.length,
      tools,
      entries,
    },
    metrics: { enabled: input.metrics.enabled, tools: toolMetrics },
    included: [...SUPPORT_BUNDLE_INCLUDED_FIELDS],
  };

  return JSON.parse(
    redactSecrets(
      JSON.stringify(redactObject(bundle)).replace(STELLAR_SECRET_KEY, "S***REDACTED***"),
    ),
  );
}

/** Tool entrypoint: gather inputs from the running server and return JSON. */
export function supportBundleTool(args?: Record<string, unknown>): string {
  const options = normalizeSupportBundleOptions(args);
  const env = process.env;
  const config = buildConfig(env);
  const profile = profiles[activeProfileName];
  const bundle = buildSupportBundle(
    {
      config: {
        stellarNetwork: config.stellarNetwork,
        x402Network: config.x402Network,
        baseUrl: config.baseUrl,
        registryContractId: config.registryContractId,
      },
      profile: {
        name: activeProfileName,
        hasWallet: !!profile?.wallet,
        publicKey: profile?.wallet ? profile.wallet.publicKey : null,
        network: profile?.network ?? null,
      },
      metrics: metrics.snapshot(),
      auditLog: collectAuditTail(env, SUPPORT_BUNDLE_SCAN_LINES),
    },
    options,
  );
  return JSON.stringify(bundle, null, 2);
}
