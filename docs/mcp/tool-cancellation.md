# Tool cancellation

When an MCP client cancels a request (`notifications/cancelled`), the server
stops these long-running, side-effect-free tools promptly:

- `mindvault_publish_status` (verification polling with `wait: true`)
- `mindvault_tx_status`
- `mindvault_export_receipts`

On cancellation the poll timer is cleared, the in-flight HTTP request is aborted,
and the client receives a stable result:

```json
{ "status": "canceled", "tool": "mindvault_publish_status", "message": "..." }
```

returned with `isError: true`. Nothing is written on the way out, so no state is
corrupted.

Tools that pay or write state (`mindvault_buy`, `mindvault_publish`,
`mindvault_register_onchain`, `mindvault_publish_batch`, ...) are intentionally
not cancellable: abandoning one mid-flight would leave the outcome unknown.
Resolve an interrupted purchase with `mindvault_purchase_status` instead (see
[purchase-status-lookup.md](purchase-status-lookup.md)).

Implementation: `mcp/src/toolCancellation.ts`; tests in
`mcp/src/toolCancellation.test.ts`.
