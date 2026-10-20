# Purchase status lookup

`mindvault_buy` accepts an optional `idempotencyKey` (letters, digits, `.`, `-`,
`_`, `:`; up to 128 characters). When it is set, the attempt is recorded in
`purchase-attempts.json` next to the purchase receipts file, scoped to the active
wallet profile.

If the tool response is lost, call `mindvault_purchase_status` with the same key:

| State | Meaning |
| --- | --- |
| `unknown` | No attempt with this key exists for the active profile. Nothing was paid under it. |
| `pending` | The buy started and no outcome was recorded (still in flight, or interrupted by a timeout). Check `mindvault_purchase_history` before paying again. |
| `settled` | The payment succeeded. `txHash` and `receiptRef` are returned. |
| `failed` | The attempt ended without a payment. |

The lookup is read-only. A key recorded under another profile reads as `unknown`,
so no other buyer's records are revealed. A key that already `settled` is not
paid a second time: `mindvault_buy` returns the recorded result instead.

Tests: `mcp/src/purchaseStatusLookup.test.ts`.
