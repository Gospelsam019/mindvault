import { describe, it, expect } from "vitest";
import {
  compareCatalogs,
  compareCatalogsTool,
  normalizeCatalogEntry,
  resolveCompareSide,
  type CompareFetch,
  type CompareSide,
} from "./catalogCompare.js";

const side = (network: string): CompareSide => ({
  network,
  x402Network: `stellar:${network}`,
  apiUrl: "https://api.example",
  registryContractId: null,
  count: 0,
});

describe("normalizeCatalogEntry", () => {
  it("drops entries without an id", () => {
    expect(normalizeCatalogEntry({ title: "x" })).toBeNull();
  });

  it("normalizes price, whitespace and tag order", () => {
    const a = normalizeCatalogEntry({ id: "r1", price: "1.5", description: " a   b ", tags: ["B", "a", "a"] });
    const b = normalizeCatalogEntry({ id: "r1", price: "1.50", description: "a b", tags: ["a", "b"] });
    expect(a).toEqual(b);
  });
});

describe("compareCatalogs", () => {
  it("reports one-sided, differing and identical resources", () => {
    const left = {
      side: side("testnet"),
      resources: [
        { id: "a", title: "A", price: "1.00" },
        { id: "b", title: "B", price: "2.00" },
        { id: "only-left", title: "L", price: "1" },
      ],
    };
    const right = {
      side: side("mainnet"),
      resources: [
        { id: "a", title: "A", price: "1.0" },
        { id: "b", title: "B changed", price: "2.00" },
        { id: "only-right", title: "R", price: "1" },
      ],
    };
    const res = compareCatalogs(left, right);
    expect(res.identicalCount).toBe(1);
    expect(res.onlyInLeft).toEqual(["only-left"]);
    expect(res.onlyInRight).toEqual(["only-right"]);
    expect(res.differing).toEqual([
      { id: "b", fields: { title: { left: "B", right: "B changed" } } },
    ]);
    expect(res.left.network).toBe("testnet");
    expect(res.right.network).toBe("mainnet");
  });
});

describe("resolveCompareSide", () => {
  it("keeps contract overrides on the active network only", () => {
    const env = { STELLAR_NETWORK: "testnet", VAULT_REGISTRY_CONTRACT_ID: "CTESTOVERRIDE" };
    expect(resolveCompareSide("testnet", env).registryContractId).toBe("CTESTOVERRIDE");
    const other = resolveCompareSide("mainnet", env);
    expect(other.registryContractId).not.toBe("CTESTOVERRIDE");
    expect(other.network).toBe("mainnet");
  });
});

describe("compareCatalogsTool", () => {
  const env = { STELLAR_NETWORK: "testnet" } as NodeJS.ProcessEnv;

  it("requires two different explicit profiles", async () => {
    const fetchJson: CompareFetch = async () => ({ ok: true, status: 200, data: [] });
    await expect(compareCatalogsTool({ left: "testnet" }, fetchJson, env)).rejects.toThrow(/right/);
    await expect(
      compareCatalogsTool({ left: "testnet", right: "testnet" }, fetchJson, env),
    ).rejects.toThrow(/different/);
    await expect(
      compareCatalogsTool({ left: "testnet", right: "staging" }, fetchJson, env),
    ).rejects.toThrow(/right/);
  });

  it("only issues GET reads and labels both networks", async () => {
    const urls: string[] = [];
    const fetchJson: CompareFetch = async (url) => {
      urls.push(url);
      return { ok: true, status: 200, data: [{ id: "a", title: "A", price: "1" }] };
    };
    const out = await compareCatalogsTool({ left: "testnet", right: "mainnet", limit: 5 }, fetchJson, env);
    expect(urls).toHaveLength(2);
    expect(urls.every((u) => u.includes("/resources?limit=5"))).toBe(true);
    expect(typeof out).toBe("object");
    if (typeof out !== "string") {
      expect(out.text).toContain("testnet");
      expect(out.text).toContain("mainnet");
      expect(out.structured).toMatchObject({ identicalCount: 1, onlyInLeft: [], onlyInRight: [] });
    }
  });

  it("surfaces an unreachable catalog with the network named", async () => {
    const fetchJson: CompareFetch = async () => ({ ok: false, status: 503, data: null });
    await expect(
      compareCatalogsTool({ left: "testnet", right: "mainnet" }, fetchJson, env),
    ).rejects.toThrow(/503/);
  });
});
