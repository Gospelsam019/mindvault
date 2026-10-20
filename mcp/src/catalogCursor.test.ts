import { describe, it, expect } from "vitest";
import {
  CATALOG_CURSOR_MAX_LENGTH,
  CATALOG_CURSOR_TTL_MS,
  applyCatalogCursor,
  attachNextCatalogCursor,
  decodeCatalogCursor,
  encodeCatalogCursor,
  nextCatalogCursor,
} from "./catalogCursor.js";

const NOW = 1_700_000_000_000;
const TESTNET = "stellar:testnet";
const MAINNET = "stellar:pubnet";

describe("catalog cursors", () => {
  it("round-trips offset and limit for the same filters", () => {
    const filters = { query: "stellar", limit: 10 };
    const cursor = encodeCatalogCursor(filters, 10, 10, TESTNET, NOW);
    expect(decodeCatalogCursor(cursor, filters, TESTNET, NOW + 1000)).toEqual({
      ok: true,
      offset: 10,
      limit: 10,
    });
  });

  it("rejects a cursor used with different filters", () => {
    const cursor = encodeCatalogCursor({ query: "stellar" }, 20, 20, TESTNET, NOW);
    const res = decodeCatalogCursor(cursor, { query: "other" }, TESTNET, NOW);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("without a cursor");
  });

  it("ignores paging fields and tag order when binding filters", () => {
    const cursor = encodeCatalogCursor({ tags: ["a", "b"], limit: 5 }, 5, 5, TESTNET, NOW);
    expect(decodeCatalogCursor(cursor, { tags: ["b", "a"], limit: 50, offset: 3 }, TESTNET, NOW).ok).toBe(
      true,
    );
  });

  it("rejects a cursor replayed on another network (#79)", () => {
    const filters = { query: "stellar" };
    const cursor = encodeCatalogCursor(filters, 20, 20, TESTNET, NOW);
    const res = decodeCatalogCursor(cursor, filters, MAINNET, NOW);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toContain(TESTNET);
      expect(res.error).toContain(MAINNET);
      expect(res.error).toContain("without a cursor");
    }
    expect(applyCatalogCursor({ ...filters, cursor }, MAINNET, NOW).ok).toBe(false);
  });

  it("rejects a cursor without a network binding", () => {
    const legacy = Buffer.from(
      JSON.stringify({ v: 1, off: 0, lim: 5, fp: "x", iat: NOW }),
    ).toString("base64url");
    expect(decodeCatalogCursor(legacy, {}, TESTNET, NOW).ok).toBe(false);
  });

  it("rejects stale cursors", () => {
    const cursor = encodeCatalogCursor({}, 20, 20, TESTNET, NOW);
    const res = decodeCatalogCursor(cursor, {}, TESTNET, NOW + CATALOG_CURSOR_TTL_MS + 1);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("expired");
  });

  it("rejects malformed, oversized, and tampered tokens", () => {
    expect(decodeCatalogCursor("!!!", {}, TESTNET, NOW).ok).toBe(false);
    expect(decodeCatalogCursor("a".repeat(CATALOG_CURSOR_MAX_LENGTH + 1), {}, TESTNET, NOW).ok).toBe(false);
    const notJson = Buffer.from("nope").toString("base64url");
    expect(decodeCatalogCursor(notJson, {}, TESTNET, NOW).ok).toBe(false);
    const badLimit = Buffer.from(
      JSON.stringify({ v: 1, off: 0, lim: 5000, fp: "x", net: TESTNET, iat: NOW }),
    ).toString("base64url");
    expect(decodeCatalogCursor(badLimit, {}, TESTNET, NOW).ok).toBe(false);
    const negative = Buffer.from(
      JSON.stringify({ v: 1, off: -1, lim: 5, fp: "x", net: TESTNET, iat: NOW }),
    ).toString("base64url");
    expect(decodeCatalogCursor(negative, {}, TESTNET, NOW).ok).toBe(false);
  });

  it("applyCatalogCursor passes filters through when no cursor is given", () => {
    const filters = { query: "x", offset: 4 };
    expect(applyCatalogCursor(filters, TESTNET, NOW)).toEqual({ ok: true, filters });
  });

  it("applyCatalogCursor resolves offset and limit and drops the cursor", () => {
    const base = { query: "x" };
    const cursor = encodeCatalogCursor(base, 40, 20, TESTNET, NOW);
    const res = applyCatalogCursor({ ...base, cursor }, TESTNET, NOW);
    expect(res).toEqual({ ok: true, filters: { query: "x", offset: 40, limit: 20 } });
  });

  it("applyCatalogCursor refuses cursor plus offset", () => {
    const cursor = encodeCatalogCursor({}, 20, 20, TESTNET, NOW);
    expect(applyCatalogCursor({ cursor, offset: 1 }, TESTNET, NOW).ok).toBe(false);
  });

  it("emits a next cursor only for full pages", () => {
    expect(nextCatalogCursor({ limit: 5 }, 4, TESTNET, NOW)).toBeNull();
    expect(nextCatalogCursor({ limit: 5 }, 0, TESTNET, NOW)).toBeNull();
    const next = nextCatalogCursor({ limit: 5, offset: 10 }, 5, TESTNET, NOW);
    expect(next).not.toBeNull();
    expect(decodeCatalogCursor(next!, { limit: 5 }, TESTNET, NOW)).toEqual({
      ok: true,
      offset: 15,
      limit: 5,
    });
  });

  it("attaches the cursor to structured output", () => {
    const out = attachNextCatalogCursor({ text: "page", structured: { items: [] } }, "abc");
    expect(out).toMatchObject({ structured: { items: [], nextCursor: "abc" } });
    expect(attachNextCatalogCursor("page", null)).toBe("page");
  });
});
