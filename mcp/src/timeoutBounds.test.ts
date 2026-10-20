import { describe, expect, it } from "vitest";

import { DEFAULT_TIMEOUTS } from "./httpTimeout.js";
import {
  DEFAULT_TRANSPORT_DEADLINE_MS,
  TRANSPORT_DEADLINE_ENV_VAR,
  TimeoutBoundsError,
  assertTimeoutsWithinDeadline,
  findTimeoutBoundsProblems,
  resolveTransportDeadline,
} from "./timeoutBounds.js";

describe("resolveTransportDeadline", () => {
  it("defaults when unset or blank", () => {
    expect(resolveTransportDeadline({})).toBe(DEFAULT_TRANSPORT_DEADLINE_MS);
    expect(resolveTransportDeadline({ [TRANSPORT_DEADLINE_ENV_VAR]: "  " })).toBe(
      DEFAULT_TRANSPORT_DEADLINE_MS,
    );
  });

  it("reads a valid value and floors it", () => {
    expect(resolveTransportDeadline({ [TRANSPORT_DEADLINE_ENV_VAR]: "60000.9" })).toBe(60000);
  });

  it("throws on a malformed or negative value", () => {
    expect(() => resolveTransportDeadline({ [TRANSPORT_DEADLINE_ENV_VAR]: "soon" })).toThrow(
      TimeoutBoundsError,
    );
    expect(() => resolveTransportDeadline({ [TRANSPORT_DEADLINE_ENV_VAR]: "-1" })).toThrow(
      /non-negative/,
    );
  });
});

describe("findTimeoutBoundsProblems", () => {
  it("accepts defaults and in-range overrides", () => {
    expect(
      findTimeoutBoundsProblems(DEFAULT_TIMEOUTS, { mindvault_publish: 120_000 }, 300_000),
    ).toEqual([]);
  });

  it("flags an override above the deadline", () => {
    const problems = findTimeoutBoundsProblems(
      DEFAULT_TIMEOUTS,
      { mindvault_publish: 90_000 },
      60_000,
    );
    expect(problems).toEqual(["mindvault_publish=90000ms exceeds the 60000ms deadline"]);
  });

  it("flags a disabled (0) override", () => {
    const problems = findTimeoutBoundsProblems(DEFAULT_TIMEOUTS, { mindvault_browse: 0 }, 60_000);
    expect(problems[0]).toMatch(/mindvault_browse has no deadline/);
  });

  it("flags a service budget above the deadline but allows a disabled one", () => {
    const budgets = { ...DEFAULT_TIMEOUTS, payment: 0, soroban: 90_000 };
    expect(findTimeoutBoundsProblems(budgets, {}, 60_000)).toEqual([
      "soroban budget 90000ms exceeds the 60000ms deadline",
    ]);
  });

  it("skips the check when the deadline is 0", () => {
    expect(findTimeoutBoundsProblems(DEFAULT_TIMEOUTS, { mindvault_publish: 9e9 }, 0)).toEqual([]);
  });
});

describe("assertTimeoutsWithinDeadline", () => {
  it("throws a clear message listing every offender", () => {
    expect(() =>
      assertTimeoutsWithinDeadline(
        DEFAULT_TIMEOUTS,
        { mindvault_publish: 90_000, mindvault_buy: 70_000 },
        60_000,
      ),
    ).toThrow(/mindvault_buy=70000ms.*mindvault_publish=90000ms.*MINDVAULT_TRANSPORT_DEADLINE_MS/);
  });

  it("does not throw for a valid configuration", () => {
    expect(() =>
      assertTimeoutsWithinDeadline(DEFAULT_TIMEOUTS, { mindvault_publish: 50_000 }, 60_000),
    ).not.toThrow();
  });
});
