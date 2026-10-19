# Admin role rotation events

Every admin or recovery-admin mutation publishes the same payload under a stable
single-topic event symbol:

```
RoleRotation { actor: Address, previous: Option<Address>, replacement: Option<Address> }
```

| Topic      | Emitted by                                            | actor            | previous                    | replacement          |
| ---------- | ----------------------------------------------------- | ---------------- | --------------------------- | -------------------- |
| `setadmin` | first `nominate_new_admin`, `bootstrap_dual_admin`    | the new admin    | `None`                      | the new admin        |
| `nomadmin` | `nominate_new_admin` (rotation)                       | current admin    | current admin               | nominee              |
| `accadmin` | `accept_admin`                                        | new admin        | previous admin              | new admin            |
| `setrecov` | `bootstrap_dual_admin`, `set_recovery_admin`          | admin            | previous recovery admin     | new recovery or `None` |
| `recover`  | `recover_admin`                                       | recovery admin   | replaced admin              | new admin            |

Moderator and verifier grants, revocations and rotations already carry full data
(`RoleChange { admin, target, granted }` and `VerifierRotation`) and are unchanged.

## Breaking change

Before this change `setadmin`, `nomadmin` and `accadmin` carried a bare `Address`,
`setrecov` carried `Option<Address>` and `recover` carried an untyped
`(old_admin, new_admin)` tuple. Indexers decoding those payloads must switch to
`RoleRotation`. Topics are unchanged.
