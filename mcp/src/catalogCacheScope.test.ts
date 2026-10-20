import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  _resetCatalogCacheScopeProvider,
  apiOriginOf,
  buildCatalogCacheScope,
  setCatalogCacheScopeProvider,
} from "./catalogCacheScope.js";
import {
  _clearCatalogCache,
  getCatalogSnapshot,
  getPreviewSnapshot,
  recordCatalogSnapshot,
  recordPreviewSnapshot,
} from "./catalogCache.js";

const base = {
  profile: "default",
  networkId: "stellar:testnet",
  contractId: "CAAA",
  apiUrl: "https://api.example.com/v1",
};

beforeEach(() => {
  _clearCatalogCache();
  _resetCatalogCacheScopeProvider();
});
afterEach(() => {
  _resetCatalogCacheScopeProvider();
});

describe("buildCatalogCacheScope (#85)", () => {
  it("is deterministic and keys on origin only", () => {
    expect(buildCatalogCacheScope(base)).toBe(
      buildCatalogCacheScope({ ...base, apiUrl: "https://api.example.com/other?x=1" }),
    );
    expect(apiOriginOf("https://api.example.com/v1")).toBe("https://api.example.com");
  });

  it("differs when profile, network, contract or origin differ", () => {
    const k = buildCatalogCacheScope(base);
    expect(buildCatalogCacheScope({ ...base, profile: "other" })).not.toBe(k);
    expect(buildCatalogCacheScope({ ...base, networkId: "stellar:pubnet" })).not.toBe(k);
    expect(buildCatalogCacheScope({ ...base, contractId: "CBBB" })).not.toBe(k);
    expect(buildCatalogCacheScope({ ...base, apiUrl: "https://api.other.com" })).not.toBe(k);
  });
});

describe("scoped catalog snapshots (#85)", () => {
  it("does not reuse a page across profiles with identical resource ids", () => {
    let scope = buildCatalogCacheScope(base);
    setCatalogCacheScopeProvider(() => scope);

    recordCatalogSnapshot([{ id: "r1", title: "testnet copy" }]);
    recordPreviewSnapshot("r1", { title: "testnet copy" });

    scope = buildCatalogCacheScope({ ...base, networkId: "stellar:pubnet", profile: "main" });
    expect(getCatalogSnapshot()).toBeNull();
    expect(getPreviewSnapshot("r1")).toBeNull();

    recordCatalogSnapshot([{ id: "r1", title: "mainnet copy" }]);
    expect(getCatalogSnapshot()!.resources).toEqual([{ id: "r1", title: "mainnet copy" }]);

    // Switching back still sees only the original context's data.
    scope = buildCatalogCacheScope(base);
    expect(getCatalogSnapshot()!.resources).toEqual([{ id: "r1", title: "testnet copy" }]);
    expect(getPreviewSnapshot("r1")!.meta).toEqual({ title: "testnet copy" });
  });
});
