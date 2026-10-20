# Ambiguous publish outcomes

`mindvault_publish` and `mindvault_register_onchain` are never retried
automatically. A timeout or lost connection on their POST requests can happen
after the server has already committed, and a replay would publish or register
twice.

When such a call fails with a timeout or network error the tool returns a
stable JSON result instead of an error:

| Call | Result |
| --- | --- |
| Create resource (publish) | `outcome: "uncertain"` with a `next` hint to search for the title before publishing again. |
| On-chain registration | The resource is read back. `outcome` is `registered` (completed), `not_registered` (safe to call again), or `uncertain` (check `mindvault_tx_status` first). |

The registration status lookup is read-only and never re-submits the
transaction. Tests: `mcp/src/publishRetryPolicy.test.ts`.
