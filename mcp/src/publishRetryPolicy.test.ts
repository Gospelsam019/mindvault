import { describe, expect, it, vi } from "vitest";

import { mcpError } from "./errorMapping.js";
import {
  NON_IDEMPOTENT_TOOLS,
  isAmbiguousOutcome,
  resolveRegistrationOutcome,
  uncertainPublishOutcome,
} from "./publishRetryPolicy.js";

describe("isAmbiguousOutcome", () => {
  it("treats timeouts and network losses as ambiguous", () => {
    const timeout = Object.assign(new Error("Request timed out after 15000ms"), {
      name: "TimeoutError",
    });
    expect(isAmbiguousOutcome(timeout)).toBe(true);
    expect(isAmbiguousOutcome(new Error("fetch failed"))).toBe(true);
    expect(
      isAmbiguousOutcome(
        mcpError({
          source: "api",
          category: "timeout",
          detail: "x",
          summary: "x",
          action: "x",
        } as never),
      ),
    ).toBe(true);
  });

  it("does not treat validation or caller aborts as ambiguous", () => {
    expect(isAmbiguousOutcome(new Error("title is required"))).toBe(false);
    expect(isAmbiguousOutcome(Object.assign(new Error("aborted"), { name: "AbortError" }))).toBe(
      false,
    );
  });

  it("lists the publish and registration tools as non-idempotent", () => {
    expect(NON_IDEMPOTENT_TOOLS.has("mindvault_publish")).toBe(true);
    expect(NON_IDEMPOTENT_TOOLS.has("mindvault_register_onchain")).toBe(true);
    expect(NON_IDEMPOTENT_TOOLS.has("mindvault_browse")).toBe(false);
  });
});

describe("uncertainPublishOutcome", () => {
  it("reports an uncertain result and tells the agent to check first", () => {
    const out = JSON.parse(uncertainPublishOutcome("My doc", "https://example.com/a"));
    expect(out.outcome).toBe("uncertain");
    expect(out.next).toContain("My doc");
  });
});

describe("resolveRegistrationOutcome", () => {
  it("reports completion without re-submitting", async () => {
    const lookup = vi.fn().mockResolvedValue({
      ok: true,
      data: { onchainStatus: "registered", onchainTxHash: "abc" },
    });
    const out = JSON.parse(await resolveRegistrationOutcome("r1", lookup));
    expect(out.outcome).toBe("registered");
    expect(out.txHash).toBe("abc");
    expect(lookup).toHaveBeenCalledTimes(1);
    expect(lookup).toHaveBeenCalledWith("r1");
  });

  it("is uncertain when the lookup fails", async () => {
    const out = JSON.parse(
      await resolveRegistrationOutcome("r1", () => Promise.reject(new Error("down"))),
    );
    expect(out.outcome).toBe("uncertain");
    expect(out.message).toContain("NOT retried");
  });

  it("is uncertain when a pending transaction hash exists", async () => {
    const out = JSON.parse(
      await resolveRegistrationOutcome("r1", async () => ({
        ok: true,
        data: { onchainStatus: "pending", onchainTxHash: "h1" },
      })),
    );
    expect(out.outcome).toBe("uncertain");
    expect(out.next).toContain("mindvault_tx_status");
  });

  it("says retry is safe only when nothing was registered", async () => {
    const out = JSON.parse(
      await resolveRegistrationOutcome("r1", async () => ({
        ok: true,
        data: { onchainStatus: "none" },
      })),
    );
    expect(out.outcome).toBe("not_registered");
  });
});
