# Catalog cache isolation

Offline catalog and preview snapshots are keyed by a scope built from the active
wallet profile, the network id, the registry contract id and the API origin
(`mcp/src/catalogCacheScope.ts`). A snapshot recorded under one scope is never
served under another, so switching profiles or networks (for example with
`mindvault_switch_network_profile`) cannot surface stale pages, even when
resource ids collide. Returning to a previous scope sees that scope's snapshot
again, subject to the usual TTL / max-age limits.
