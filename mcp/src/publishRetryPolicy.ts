/**
 * Ambiguous-outcome handling for non-idempotent publish calls — issue #75.
 *
 * A POST that creates a resource or submits an on-chain registration can time
 * out after the server has already committed. Replaying it would publish or
 * register twice, so these calls are never retried automatically. Instead an
 * ambiguous failure (timeout / network loss) is resolved by a status lookup, or
 * reported as an explicit "uncertain" result that tells the agent what to check
 * before trying again.
 */

import { mappedErrorOf } from "./errorMapping.js";
import { isRetryableError } from "./retry.js";

/** Tools whose underlying calls must never be replayed automatically. */
export const NON_IDEMPOTENT_TOOLS: ReadonlySet<string> = new Set([
  "mindvault_publish",
  "mindvault_register_onchain",
  "mindvault_buy",
  "mindvault_buy_lease",
]);

/** True when a failure leaves it unknown whether the server committed. */
export function isAmbiguousOutcome(error: unknown): boolean {
  const category = mappedErrorOf(error)?.category;
  if (category === "timeout" || category === "network") return true;
  return isRetryableError(error);
}

/** Explicit uncertain result for a publish whose response was lost. */
export function uncertainPublishOutcome(title: string, externalUrl: string): string {
  return JSON.stringify(
    {
      outcome: "uncertain",
      operation: "publish",
      message:
        "The publish request timed out or the connection dropped before a response arrived. " +
        "The resource may already exist, so it was NOT retried automatically.",
      next:
        `Check mindvault_search or mindvault_browse for "${title}" (${externalUrl}) ` +
        "before publishing again to avoid a duplicate listing.",
    },
    null,
    2,
  );
}

export interface ResourceLookup {
  ok: boolean;
  data?: unknown;
}

const REGISTERED = /^(registered|confirmed|success|onchain)/i;
const NOT_REGISTERED = /^(none|unregistered|not_registered|failed)$/i;

/**
 * Resolve an on-chain registration whose response was lost by reading the
 * resource back. Never re-submits the registration.
 */
export async function resolveRegistrationOutcome(
  resourceId: string,
  fetchResource: (id: string) => Promise<ResourceLookup>,
): Promise<string> {
  let record: Record<string, unknown> | undefined;
  try {
    const res = await fetchResource(resourceId);
    if (res.ok && res.data && typeof res.data === "object") {
      record = res.data as Record<string, unknown>;
    }
  } catch {
    record = undefined;
  }

  const status = typeof record?.onchainStatus === "string" ? record.onchainStatus : null;
  const txHash = typeof record?.onchainTxHash === "string" ? record.onchainTxHash : null;

  if (status && REGISTERED.test(status)) {
    return JSON.stringify(
      {
        outcome: "registered",
        message: "The response was lost, but the lookup shows the registration completed.",
        after: { id: resourceId, onchainStatus: status, txHash },
        txHash,
      },
      null,
      2,
    );
  }

  const safeToRetry = !txHash && (status === null ? false : NOT_REGISTERED.test(status));
  return JSON.stringify(
    {
      outcome: safeToRetry ? "not_registered" : "uncertain",
      message: safeToRetry
        ? "The registration request was lost and the lookup shows nothing was registered."
        : "The registration request timed out and its outcome could not be confirmed. It was NOT retried automatically.",
      after: { id: resourceId, onchainStatus: status, txHash },
      next: safeToRetry
        ? "It is safe to call mindvault_register_onchain again."
        : txHash
          ? `Check transaction ${txHash} with mindvault_tx_status before registering again.`
          : "Re-check the resource with mindvault_preview before calling mindvault_register_onchain again.",
    },
    null,
    2,
  );
}
