# Catalog cache bypass

`mindvault_browse`, `mindvault_search` and `mindvault_preview` accept an optional
`bypassCache` boolean. When true:

- the call is served by the live API only; if the live read fails the error is
  returned instead of an offline snapshot;
- the result reports `cache: bypassed (fresh read from the live API)` (in the
  `notice` of browse/search, and as `cache: "bypassed"` for preview);
- the call still goes through the normal HTTP client, so timeouts, retries and
  rate limits apply;
- the shared cache policy (`MINDVAULT_CATALOG_CACHE_TTL_MS`,
  `MINDVAULT_CATALOG_CACHE_MAX_AGE_MS`) is not changed, and a successful read
  refreshes the snapshot as usual.

`MINDVAULT_CATALOG_CACHE_BYPASS=1` sets the default for calls that omit the
argument; an explicit `bypassCache` always wins. A malformed value is ignored.
