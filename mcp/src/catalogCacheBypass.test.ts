import { describe, it, expect, beforeEach } from "vitest";
import {
  CACHE_BYPASS_NOTICE,
  CATALOG_CACHE_BYPASS_ENV,
  resolveCacheBypass,
  withBypassNotice,
} from "./catalogCacheBypass.js";
import {
  _clearCatalogCache,
  getCatalogCacheConfig,
  recordCatalogSnapshot,
  getCatalogSnapshot,
} from "./catalogCache.js";

beforeEach(() => {
  _clearCatalogCache();
});

describe("resolveCacheBypass (#83)", () => {
  it("defaults to false", () => {
    expect(resolveCacheBypass({}, {})).toBe(false);
    expect(resolveCacheBypass(undefined, {})).toBe(false);
  });

  it("accepts booleans and unambiguous strings", () => {
    expect(resolveCacheBypass({ bypassCache: true }, {})).toBe(true);
    expect(resolveCacheBypass({ bypassCache: "true" }, {})).toBe(true);
    expect(resolveCacheBypass({ bypassCache: "0" }, {})).toBe(false);
  });

  it("rejects non-boolean values", () => {
    expect(() => resolveCacheBypass({ bypassCache: "maybe" }, {})).toThrow(/bypassCache/);
  });

  it("uses the env default, and an explicit argument wins", () => {
    const env = { [CATALOG_CACHE_BYPASS_ENV]: "1" } as NodeJS.ProcessEnv;
    expect(resolveCacheBypass({}, env)).toBe(true);
    expect(resolveCacheBypass({ bypassCache: false }, env)).toBe(false);
  });

  it("ignores a malformed env value", () => {
    const env = { [CATALOG_CACHE_BYPASS_ENV]: "sometimes" } as NodeJS.ProcessEnv;
    expect(resolveCacheBypass({}, env)).toBe(false);
  });

  it("does not mutate shared cache policy or snapshots", () => {
    recordCatalogSnapshot([{ id: "a" }]);
    const before = getCatalogCacheConfig();
    resolveCacheBypass({ bypassCache: true }, {});
    expect(getCatalogCacheConfig()).toEqual(before);
    expect(getCatalogSnapshot()?.resources).toEqual([{ id: "a" }]);
  });
});

describe("withBypassNotice (#83)", () => {
  it("leaves the notice alone when not bypassed", () => {
    expect(withBypassNotice("note", false)).toBe("note");
    expect(withBypassNotice(null, false)).toBeNull();
  });

  it("reports the bypass status, appending to an existing notice", () => {
    expect(withBypassNotice(null, true)).toBe(CACHE_BYPASS_NOTICE);
    expect(withBypassNotice("note", true)).toBe(`note\n${CACHE_BYPASS_NOTICE}`);
  });
});
