# MCP resource metadata diff (API vs registry)

The API-versus-registry metadata diff is provided by `mindvault_check_consistency`,
so no separate tool is added.

- Read-only: it reads `GET /resources/:id/meta` from the API and `get` from the
  vault-registry contract, and writes nothing.
- Field-level report: `matches` and `mismatches` list `price`, `listed`
  (API verification status against on-chain listing), `metadata` (access URL
  against the on-chain metadata pointer), and `id`, each with the `api` and
  `onchain` values side by side.
- Missing records: `apiFound` / `onchainFound`, `missingInApi` /
  `missingInOnchain`, and a `summary` distinguish a resource that exists on only
  one side from one that exists on neither.
- Protected content: only public metadata is read. The `/meta` endpoint never
  returns the paid resource body, and the report contains no content, only the
  public access URL and metadata pointer.
- Network context: the registry side is read from the active network profile's
  contract (see `mindvault_registry_info` for the contract id and network); use
  `mindvault_switch_network_profile` to diff against another network.
- Pass `expectedMetadataHash` to also assert the on-chain digest anchor matches a
  digest you computed yourself.
