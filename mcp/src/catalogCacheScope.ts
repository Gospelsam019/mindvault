/**
 * Cache isolation scope for catalog snapshots (#85).
 *
 * A snapshot is only valid for the exact context it was read in: the wallet
 * profile, the network id, the registry contract id, and the API origin.
 * Switching any of them (for example `mindvault_switch_network_profile`) must
 * never serve a page cached under another context, even when resource ids
 * collide. The scope string is the cache key for that context.
 */

export interface CatalogCacheScopeInput {
  profile: string;
  networkId: string;
  contractId: string;
  /** API base URL; only its origin is significant. */
  apiUrl: string;
}

/** Origin of a URL, or the trimmed input when it does not parse. */
export function apiOriginOf(apiUrl: string): string {
  try {
    return new URL(apiUrl).origin;
  } catch {
    return apiUrl.trim().toLowerCase();
  }
}

/** Deterministic scope key for a context. */
export function buildCatalogCacheScope(input: CatalogCacheScopeInput): string {
  return JSON.stringify([
    input.profile,
    input.networkId,
    input.contractId,
    apiOriginOf(input.apiUrl),
  ]);
}

let scopeProvider: () => string = () => "";

/** Register how the current scope is computed. Called once at server startup. */
export function setCatalogCacheScopeProvider(provider: () => string): void {
  scopeProvider = provider;
}

/** The scope that applies to a cache read or write right now. */
export function currentCatalogCacheScope(): string {
  return scopeProvider();
}

/** Test-only: restore the default (single, unscoped) provider. */
export function _resetCatalogCacheScopeProvider(): void {
  scopeProvider = () => "";
}
