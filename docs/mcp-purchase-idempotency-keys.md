# Purchase idempotency keys

`mindvault_buy` sends an `Idempotency-Key` header with the payment request. The key
is derived deterministically from the network, the payer public key and the
resource id (`buy-<32 hex chars>`), so a retry after a transport reconnect or a
lost response reuses the original key instead of generating a new one. The server
can then resolve the retry to the original receipt rather than settling a second
payment.

An explicit key (1-128 characters of letters, digits, `.`, `_`, `:`, `-`) passed to
the internal `buy` helper takes precedence over the derived key.

If a response is lost, confirm the outcome with `mindvault_purchase_history` or
`mindvault_tx_status` before retrying. See `docs/mcp-x402-retry-classification.md`.
