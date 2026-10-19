import { describe, expect, it } from "vitest";

import {
  SUPPORT_BUNDLE_MAX_ENTRIES,
  SUPPORT_BUNDLE_SCHEMA,
  buildSupportBundle,
  normalizeSupportBundleOptions,
  type SupportBundleInput,
} from "./supportBundle.js";

const INCIDENT = "mv-lx3k9a2-4f7q";
const OTHER = "mv-lx3k9a2-0000";
const SECRET = "S" + "A".repeat(55);

function input(entries: Array<Record<string, unknown>>): SupportBundleInput {
  return {
    config: {
      stellarNetwork: "testnet",
      x402Network: "stellar:testnet",
      baseUrl: "https://api.example.com",
      registryContractId: "CAAA",
    },
    profile: { name: "default", hasWallet: true, publicKey: "GPUBLIC", network: "testnet" },
    metrics: {
      enabled: true,
      since: null,
      toolDurationBudgetMs: null,
      totals: { calls: 3, errors: 1, budgetExceeded: 0 },
      payments: { attempts: 0, failures: 0 },
      tools: {
        mindvault_buy: { calls: 2, errors: 1, totalDurationMs: 10, maxDurationMs: 6, budgetExceeded: 0 },
        mindvault_browse: { calls: 1, errors: 0, totalDurationMs: 2, maxDurationMs: 2, budgetExceeded: 0 },
      },
    },
    auditLog: { enabled: true, filePath: null, exists: true, requested: 5000, entries },
  };
}

describe("normalizeSupportBundleOptions (#84)", () => {
  it("requires a well-formed incident id", () => {
    expect(() => normalizeSupportBundleOptions({})).toThrow(/incidentId/);
    expect(() => normalizeSupportBundleOptions({ incidentId: "all" })).toThrow(/incidentId/);
    expect(normalizeSupportBundleOptions({ incidentId: INCIDENT }).incidentId).toBe(INCIDENT);
  });

  it("bounds maxEntries", () => {
    expect(normalizeSupportBundleOptions({ incidentId: INCIDENT, maxEntries: 9999 }).maxEntries).toBe(
      SUPPORT_BUNDLE_MAX_ENTRIES,
    );
    expect(normalizeSupportBundleOptions({ incidentId: INCIDENT }).maxEntries).toBe(100);
  });
});

describe("buildSupportBundle (#84)", () => {
  const entries = [
    { correlationId: OTHER, toolName: "mindvault_browse", status: "success" },
    { correlationId: INCIDENT, toolName: "mindvault_buy", status: "start" },
    { correlationId: INCIDENT, toolName: "mindvault_buy", status: "error", message: `bad ${SECRET}` },
  ];

  it("includes only the incident's entries and the metrics of tools they name", () => {
    const b = buildSupportBundle(input(entries), { incidentId: INCIDENT, maxEntries: 100 });
    expect(b.schema).toBe(SUPPORT_BUNDLE_SCHEMA);
    expect(b.found).toBe(true);
    expect(b.trace.entries).toHaveLength(2);
    expect(b.trace.tools).toEqual(["mindvault_buy"]);
    expect(Object.keys(b.metrics.tools)).toEqual(["mindvault_buy"]);
  });

  it("redacts secret keys", () => {
    const b = buildSupportBundle(input(entries), { incidentId: INCIDENT, maxEntries: 100 });
    expect(JSON.stringify(b)).not.toContain(SECRET);
  });

  it("is bounded and reports truncation", () => {
    const b = buildSupportBundle(input(entries), { incidentId: INCIDENT, maxEntries: 1 });
    expect(b.trace.entries).toHaveLength(1);
    expect(b.trace.matched).toBe(2);
    expect(b.trace.truncated).toBe(true);
  });

  it("is deterministic", () => {
    const opts = { incidentId: INCIDENT, maxEntries: 100 };
    expect(JSON.stringify(buildSupportBundle(input(entries), opts))).toBe(
      JSON.stringify(buildSupportBundle(input(entries), opts)),
    );
  });

  it("reports found=false for an unknown incident", () => {
    const b = buildSupportBundle(input(entries), { incidentId: "mv-zzzz-0001", maxEntries: 10 });
    expect(b.found).toBe(false);
    expect(b.trace.entries).toEqual([]);
  });
});
