# MCP catalog cursors

`mindvault_browse` returns a `nextCursor` (structured output and a trailing
text line) when a page comes back full. Pass it back as `cursor`, with the same
filters, to resume at the next page without re-fetching earlier ones.

- Cursors are opaque; do not parse or construct them.
- A cursor is bound to the filter set that produced it (query, price range,
  verification status, resource type, owner, sort, tags, listed). Page size and
  offset are not part of the binding. A cursor used with different filters is
  rejected.
- Cursors expire after 15 minutes. An expired, malformed, or oversized cursor
  returns a recoverable error: call `mindvault_browse` again without a cursor.
- `cursor` and `offset` are mutually exclusive. Page size stays capped at 100.
- Callers that only use `limit` and `offset` are unaffected.

## Network binding

A cursor also records the network it was issued on (for example
`stellar:testnet`). After `mindvault_switch_network_profile` or a profile change
that moves to another network, an older cursor is rejected with a message naming
both networks, so a page can never mix results from two networks or resume at an
offset that belongs to a different catalog. Restart without a cursor to browse
the new network from the first page.
