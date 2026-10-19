/**
 * Per-call cache bypass for catalog and metadata reads (#83).
 *
 * The offline snapshot cache only answers when the live catalog could not. A
 * caller that needs a fresh read passes `bypassCache: true`: the call must be
 * served by the live API, a failed live read surfaces as an error instead of a
 * snapshot, and the result reports `cache: bypassed`.
 *
 * The bypass is scoped to the single call. It never edits the shared cache
 * policy (TTL / max age), and the live read still goes through `jsonFetch`, so
 * timeouts, retries and rate limiting apply unchanged. A successful bypassed
 * read refreshes the snapshot like any other live read.
 *
 * `MINDVAULT_CATALOG_CACHE_BYPASS=1` sets the default for calls that do not
 * pass the argument; an explicit `bypassCache` always wins.
 */

export const CATALOG_CACHE_BYPASS_ENV = "MINDVAULT_CATALOG_CACHE_BYPASS";

/** Status line appended to a result that was read live with the cache bypassed. */
export const CACHE_BYPASS_NOTICE = "cache: bypassed (fresh read from the live API)";

/** JSON Schema property advertised on browse, search and preview. */
export const bypassCacheInputProperty = {
  bypassCache: {
    type: "boolean",
    description:
      "Set true to force a fresh read from the live API for this call only. A failed live read returns an error instead of an offline snapshot. Defaults to false (or MINDVAULT_CATALOG_CACHE_BYPASS).",
    examples: [true, false],
  },
} as const;

function parseFlag(value: unknown): boolean | "invalid" {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (v === "true" || v === "1") return true;
    if (v === "false" || v === "0") return false;
  }
  return "invalid";
}

/**
 * Resolve whether this call bypasses the cache.
 * @throws Error when an explicit `bypassCache` argument is not a boolean.
 */
export function resolveCacheBypass(
  args: unknown,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const raw = args && typeof args === "object" ? (args as Record<string, unknown>) : {};
  const explicit = raw.bypassCache;
  if (explicit !== undefined && explicit !== null && explicit !== "") {
    const parsed = parseFlag(explicit);
    if (parsed === "invalid") {
      throw new Error("Invalid bypassCache: must be a boolean (true/false).");
    }
    return parsed;
  }
  const fromEnv = env[CATALOG_CACHE_BYPASS_ENV];
  if (fromEnv === undefined || fromEnv.trim() === "") return false;
  const parsedEnv = parseFlag(fromEnv);
  return parsedEnv === "invalid" ? false : parsedEnv;
}

/** Combine an existing notice with the bypass status line. */
export function withBypassNotice(notice: string | null, bypassed: boolean): string | null {
  if (!bypassed) return notice;
  return notice ? `${notice}\n${CACHE_BYPASS_NOTICE}` : CACHE_BYPASS_NOTICE;
}
