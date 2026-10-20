# MCP catalog comparison

`mindvault_compare_catalogs` compares the catalogs of two explicitly named
network profiles, `testnet` and `mainnet`, to help operators verify that a
deployment matches across networks.

- Arguments: `left` and `right` (both required, must differ) and an optional
  `limit` (1-100, default 100) applied to each profile.
- Read-only: the tool issues `GET /resources` for each profile and nothing else.
  No wallet, API key, or confirmation flag is needed and nothing is written.
- Each side is labeled with its network, x402 network id, API URL, and registry
  contract id (`null` when none is configured, for example before a mainnet
  deployment). Contract and RPC overrides from the environment apply only to the
  profile matching the server's active network.
- Resources are matched by id. Differences are normalized first: prices compare
  numerically, whitespace in descriptions is collapsed, and tags are lowercased,
  de-duplicated, and sorted.
- Output lists ids present on only one side, field-level differences (`title`,
  `description`, `price`, `resourceType`, `verificationStatus`, `tags`) for ids on
  both, and the count of identical resources. `truncated` is true when either
  side hit the limit, so resources beyond it were not compared.

If both profiles share one `MINDVAULT_URL`, the two catalogs come from the same
API and will normally be identical; point each deployment at its own API to get
a meaningful comparison.
