import { describe, it, expect } from "vitest";
import { normalizeSearchTerm } from "./catalogSearchTerm.js";
import { applyClientCatalogFilters } from "./catalogFilters.js";

const COMPOSED = "café";
const DECOMPOSED = "café";

const fixtures = [
  { id: "1", title: `${COMPOSED} guide`, description: "coffee" },
  { id: "2", title: `Intro to ${DECOMPOSED}`, description: "decomposed form" },
  { id: "3", title: "STELLAR  Tutorial", description: "nbsp and double space" },
  { id: "4", title: "Unrelated", description: "nothing" },
];

describe("normalizeSearchTerm (#82)", () => {
  it("makes composed and decomposed forms equal", () => {
    expect(normalizeSearchTerm(COMPOSED)).toBe(normalizeSearchTerm(DECOMPOSED));
  });

  it("case-folds and collapses whitespace", () => {
    expect(normalizeSearchTerm("  Stellar  \t Tutorial ")).toBe("stellar tutorial");
  });
});

describe("applyClientCatalogFilters unicode parity (#82)", () => {
  const ids = (query: string): string[] =>
    applyClientCatalogFilters(fixtures, { query }).map((r) => r.id);

  it("returns the same resources for composed and decomposed queries", () => {
    expect(ids(COMPOSED)).toEqual(["1", "2"]);
    expect(ids(DECOMPOSED)).toEqual(["1", "2"]);
  });

  it("matches across case and whitespace differences", () => {
    expect(ids("stellar tutorial")).toEqual(["3"]);
    expect(ids("STELLAR   TUTORIAL")).toEqual(["3"]);
  });
});
