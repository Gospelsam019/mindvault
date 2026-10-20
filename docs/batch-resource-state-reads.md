# Batch resource-state reads

`get_resource_states(ids)` returns the lifecycle state (`ResourceState`) of up to 20 resources in one call, so indexers need not issue one RPC call per resource.

- Maximum: 20 ids (`MAX_STATE_BATCH`). More fails with `BatchTooLarge` before anything is read.
- Result: `Vec<Option<ResourceState>>` parallel to `ids`. Order and duplicates are preserved.
- Unknown ids and ids that fail format validation are `None` (same as `exists_many`) instead of failing the whole batch.
- Read-only; unlike `get_many` it does not bump entry TTLs.
