/**
 * Stable purchase idempotency keys (#73).
 *
 * Simulates a disconnect after settlement: the retry recomputes the key from
 * the same intent in a "new session" and must get the same key, so the server
 * resolves it to the original receipt instead of charging again.
 */
import { describe, it, expect } from "vitest";

import {
  derivePurchaseIdempotencyKey,
  resolvePurchaseIdempotencyKey,
  type PurchaseIntent,
} from "./purchaseIdempotencyKey.js";

const intent: PurchaseIntent = {
  network: "stellar:testnet",
  payer: "GPAYER",
  resourceId: "res-1",
};

describe("derivePurchaseIdempotencyKey", () => {
  it("is identical across retries and reconnects for the same intent", () => {
    const first = derivePurchaseIdempotencyKey(intent);
    const afterReconnect = derivePurchaseIdempotencyKey({ ...intent });
    expect(afterReconnect).toBe(first);
    expect(first).toMatch(/^buy-[0-9a-f]{32}$/);
  });

  it("differs when resource, payer or network differ", () => {
    const base = derivePurchaseIdempotencyKey(intent);
    expect(derivePurchaseIdempotencyKey({ ...intent, resourceId: "res-2" })).not.toBe(base);
    expect(derivePurchaseIdempotencyKey({ ...intent, payer: "GOTHER" })).not.toBe(base);
    expect(derivePurchaseIdempotencyKey({ ...intent, network: "stellar:pubnet" })).not.toBe(base);
  });
});

describe("resolvePurchaseIdempotencyKey", () => {
  it("prefers an explicit key", () => {
    expect(resolvePurchaseIdempotencyKey(intent, "my-key.1")).toBe("my-key.1");
  });

  it("falls back to the derived key when none is given", () => {
    const derived = derivePurchaseIdempotencyKey(intent);
    expect(resolvePurchaseIdempotencyKey(intent)).toBe(derived);
    expect(resolvePurchaseIdempotencyKey(intent, "")).toBe(derived);
  });

  it("rejects malformed explicit keys", () => {
    expect(() => resolvePurchaseIdempotencyKey(intent, "bad key!")).toThrow(/idempotencyKey/);
  });
});
