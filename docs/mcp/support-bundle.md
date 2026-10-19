# Support bundle by incident ID (`mindvault_support_bundle`)

Exports a redacted bundle scoped to one incident, for attaching to a support
request. Unlike `mindvault_debug_bundle`, it never describes the whole server.

## Arguments

| Name         | Required | Description                                                                |
| ------------ | -------- | -------------------------------------------------------------------------- |
| `incidentId` | yes      | Correlation ID reported by the failing tool call, e.g. `mv-lx3k9a2-4f7q`.  |
| `maxEntries` | no       | Audit-log entries to include (1-200, default 100). The newest are kept.    |

A missing or malformed `incidentId` is rejected; there is no unscoped mode.

## Included fields

- `config`: `stellarNetwork`, `x402Network`, `baseUrl`, `registryContractId`.
- `profile`: active profile `name`, `hasWallet`, `publicKey`, `network`. Other
  profiles are never listed.
- `trace`: audit-log entries whose `correlationId` equals the incident ID (tool
  start/success/error and the network requests made under that call), plus
  `matched`, `scanned`, `truncated` and the sorted `tools` they name.
- `metrics.tools`: counters only for the tools named by those entries.
- `found`: false when no entry matched (audit logging disabled, rotated away, or
  an unknown ID).

## Guarantees

- Bounded: at most 200 entries, from the audit-log tail window already capped at
  256 KiB / 5000 lines.
- Redacted: entries are redacted when read, and the final document is swept for
  Stellar secret keys and shared secret patterns. Wallet secrets, API keys and
  tokens are never read.
- Deterministic: no timestamp or random input; entries keep log order.
- Local and read-only; no network calls. Requires `MINDVAULT_AUDIT_LOG_FILE` to
  have been set when the incident happened.
