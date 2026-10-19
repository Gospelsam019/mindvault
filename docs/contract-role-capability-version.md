# Role capability version

`registry_info` returns `role_capability_version: u32`, a compact version of the
role surface (admin rotation, recovery admin, moderator and verifier roles, and
the shape of their events). Clients should compare it before invoking optional
role methods instead of probing for missing methods.

| Version | Role surface |
| ------- | ------------ |
| 1 | `nominate_new_admin`, `accept_admin`, `bootstrap_dual_admin`, `set_recovery_admin`, `recover_admin`, `add_moderator`, `remove_moderator`, `add_verifier`, `rotate_verifier`; `RoleChange`, `VerifierRotation` and `RoleRotation` events |

The value is the constant `ROLE_CAPABILITY_VERSION` in
`contract/contracts/vault-registry/src/capability_version.rs`. It is bumped when a
role method is added or removed or a role event payload changes shape. Tests check
the value and that every listed role method exists in `METHOD_SCHEMA`.

`RegistryInfo` gained the field at the end of the struct; existing fields are
unchanged. TypeScript bindings must be regenerated (`pnpm contract:bindings`).
