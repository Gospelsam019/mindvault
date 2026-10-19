/**
 * Resumable catalog cursors for mindvault_browse (#78, #79).
 *
 * A cursor is an opaque base64url token that resumes a browse at the offset
 * where the previous page ended. It is bound to the filter set that produced it
 * and to the network it was issued on (#79), expires after a short window, and is
 * validated strictly: anything malformed, mismatched, or stale is rejected with
 * a recoverable message telling the agent to restart without a cursor.
 */

import { createHash } from "crypto";
import {
  CATALOG_DEFAULT_LIMIT,
  CATALOG_MAX_LIMIT,
  type CatalogFilters,
} from "./catalogFilters.js";
import type { ToolOutcome } from "./toolResult.js";

/** Cursors older than this are stale: the catalog may have shifted under them. */
export const CATALOG_CURSOR_TTL_MS = 15 * 60 * 1000;

/** Hard cap on the token length accepted from a client. */
export const CATALOG_CURSOR_MAX_LENGTH = 512;

export const CATALOG_CURSOR_INPUT_PROPERTY = {
  type: "string",
  maxLength: CATALOG_CURSOR_MAX_LENGTH,
  description:
    "Opaque cursor returned as nextCursor by a previous mindvault_browse page. Resumes at the next page without re-fetching earlier ones. Must be sent with the same filters; a mismatched or expired cursor is rejected, so restart without a cursor. Do not combine with offset.",
} as const;

interface CatalogCursorPayload {
  v: 1;
  /** Offset of the first resource on the next page. */
  off: number;
  /** Page size the cursor was issued for. */
  lim: number;
  /** Fingerprint of the filter set (excluding paging). */
  fp: string;
  /** Network the page was read from (e.g. stellar:testnet), so profiles never mix. */
  net: string;
  /** Issue time, epoch milliseconds. */
  iat: number;
}

export type CatalogCursorDecode =
  | { ok: true; offset: number; limit: number }
  | { ok: false; error: string };

const RESTART_HINT = "Restart the listing by calling mindvault_browse again without a cursor.";

/** Stable fingerprint of the filters that shape a result set (paging excluded). */
export function catalogFilterFingerprint(filters: CatalogFilters): string {
  const canonical = JSON.stringify([
    filters.query ?? null,
    filters.minPrice ?? null,
    filters.maxPrice ?? null,
    filters.verificationStatus ?? null,
    filters.resourceType ?? null,
    filters.owner ?? null,
    filters.sort ?? null,
    filters.tags ? [...filters.tags].sort() : null,
    filters.listed ?? null,
  ]);
  return createHash("sha256").update(canonical).digest("hex").slice(0, 16);
}

export function encodeCatalogCursor(
  filters: CatalogFilters,
  offset: number,
  limit: number,
  network: string,
  nowMs: number = Date.now(),
): string {
  const payload: CatalogCursorPayload = {
    v: 1,
    off: offset,
    lim: limit,
    fp: catalogFilterFingerprint(filters),
    net: network,
    iat: nowMs,
  };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function fail(reason: string): CatalogCursorDecode {
  return { ok: false, error: `Invalid cursor: ${reason} ${RESTART_HINT}` };
}

export function decodeCatalogCursor(
  cursor: string,
  filters: CatalogFilters,
  network: string,
  nowMs: number = Date.now(),
): CatalogCursorDecode {
  if (cursor.length === 0 || cursor.length > CATALOG_CURSOR_MAX_LENGTH) {
    return fail("the token has an unsupported length.");
  }
  if (!/^[A-Za-z0-9_-]+$/.test(cursor)) return fail("the token is not well formed.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
  } catch {
    return fail("the token is not well formed.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return fail("the token is not well formed.");
  }
  const p = parsed as Record<string, unknown>;
  if (
    p.v !== 1 ||
    typeof p.off !== "number" ||
    !Number.isInteger(p.off) ||
    p.off < 0 ||
    typeof p.lim !== "number" ||
    !Number.isInteger(p.lim) ||
    p.lim < 1 ||
    p.lim > CATALOG_MAX_LIMIT ||
    typeof p.fp !== "string" ||
    typeof p.net !== "string" ||
    typeof p.iat !== "number" ||
    !Number.isFinite(p.iat)
  ) {
    return fail("the token is not well formed.");
  }
  if (nowMs - p.iat > CATALOG_CURSOR_TTL_MS || p.iat - nowMs > CATALOG_CURSOR_TTL_MS) {
    return fail("the cursor has expired and the catalog may have changed.");
  }
  if (p.net !== network) {
    return fail(`the cursor was issued on ${p.net}, but the active network is ${network}.`);
  }
  if (p.fp !== catalogFilterFingerprint(filters)) {
    return fail("the filters differ from the ones this cursor was issued for.");
  }
  return { ok: true, offset: p.off, limit: p.lim };
}

export type CatalogCursorApplied =
  | { ok: true; filters: CatalogFilters }
  | { ok: false; error: string };

/**
 * Resolve `filters.cursor` into a concrete offset/limit. Without a cursor the
 * filters pass through untouched, so existing offset/limit callers are unaffected.
 */
export function applyCatalogCursor(
  filters: CatalogFilters,
  network: string,
  nowMs: number = Date.now(),
): CatalogCursorApplied {
  if (!filters.cursor) return { ok: true, filters };
  if (filters.offset !== undefined) {
    return {
      ok: false,
      error: "Invalid arguments: pass either cursor or offset, not both.",
    };
  }
  const decoded = decodeCatalogCursor(filters.cursor, filters, network, nowMs);
  if (!decoded.ok) return decoded;
  const resolved: CatalogFilters = {
    ...filters,
    offset: decoded.offset,
    limit: filters.limit ?? decoded.limit,
  };
  delete resolved.cursor;
  return { ok: true, filters: resolved };
}

/**
 * Cursor for the page after this one, or null when the page came back short
 * (the end of the catalog).
 */
export function nextCatalogCursor(
  filters: CatalogFilters,
  fetched: number,
  network: string,
  nowMs: number = Date.now(),
): string | null {
  const limit = filters.limit ?? CATALOG_DEFAULT_LIMIT;
  if (fetched <= 0 || fetched < limit) return null;
  return encodeCatalogCursor(filters, (filters.offset ?? 0) + fetched, limit, network, nowMs);
}

/** Append the next cursor to a browse outcome (text line + structured field). */
export function attachNextCatalogCursor(outcome: ToolOutcome, cursor: string | null): ToolOutcome {
  if (!cursor) return outcome;
  const line = `Next page: call mindvault_browse with cursor "${cursor}" and the same filters.`;
  if (typeof outcome === "string") return `${outcome}\n\n${line}`;
  return {
    text: `${outcome.text}\n\n${line}`,
    structured: { ...(outcome.structured ?? {}), nextCursor: cursor },
  };
}
