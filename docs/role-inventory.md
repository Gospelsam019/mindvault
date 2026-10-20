# Role inventory

`list_role_members(role, cursor, limit)` is a read-only page over the holders of a protocol role, for deployment audits and operational tooling.

- `role`: `Admin`, `Verifier`, `Moderator` or `Settler`.
- Result: `RolePage { members, next_cursor }`. Members are in grant order, so pages are deterministic; `next_cursor` is `None` on the last page. A cursor past the end returns an empty page.
- `limit` is capped at 20 (`ROLE_PAGE_CAP`).
- `Admin` returns the single current admin (empty before one is set).
- The method never mutates state.

## Membership limits

Verifier, moderator and settler holders are tracked in an index kept by `add_*`, `remove_*` and `rotate_verifier`. At most 50 (`MAX_ROLE_MEMBERS`) addresses are tracked per role; a grant beyond that fails with `BatchTooLarge` (the error enum is full, so no new code was added). Re-granting an existing member is a no-op for the index.

Grants made before this index existed are not listed until they are granted again. `is_verifier`, `is_moderator` and `is_settler` remain the authoritative membership checks.
