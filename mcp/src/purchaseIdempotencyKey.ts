/**
 * Stable purchase idempotency keys — issue #73.
 *
 * A purchase retried after a transport reconnect must carry the same
 * Idempotency-Key as the original attempt, otherwise a lost response turns a
 * retry into a second payment. The key is therefore derived, not generated: it
 * is a pure function of the purchase intent (network, payer, resource), so any
 * process, session or reconnect that repeats the same intent computes the same
 * key without needing shared state.
 *
 * An explicit caller-supplied key always wins.
 */

import { createHash } from "node:crypto";

const EXPLICIT_KEY_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

export interface PurchaseIntent {
  network: string;
  /** Payer public key (the wallet that signs the payment). */
  payer: string;
  resourceId: string;
}

/** Derive the deterministic key for a purchase intent. */
export function derivePurchaseIdempotencyKey(intent: PurchaseIntent): string {
  const digest = createHash("sha256")
    .update(["mindvault-buy", intent.network, intent.payer, intent.resourceId].join("\n"), "utf8")
    .digest("hex")
    .slice(0, 32);
  return `buy-${digest}`;
}

/**
 * Resolve the key to send: a well-formed explicit key wins, otherwise the
 * derived key. A malformed explicit key is rejected rather than silently
 * replaced, because replacing it would break the caller's own retry lookup.
 */
export function resolvePurchaseIdempotencyKey(
  intent: PurchaseIntent,
  explicit?: string | null,
): string {
  if (explicit === undefined || explicit === null || explicit === "") {
    return derivePurchaseIdempotencyKey(intent);
  }
  if (!EXPLICIT_KEY_PATTERN.test(explicit)) {
    throw new Error(
      "idempotencyKey must be 1-128 characters of letters, digits, '.', '_', ':' or '-'.",
    );
  }
  return explicit;
}
