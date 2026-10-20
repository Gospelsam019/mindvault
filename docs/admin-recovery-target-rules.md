# Admin recovery target rules

`recover_admin(new_admin)` replaces the admin immediately, so the replacement must not already hold an active governance position. The call is rejected with `SameAdmin` (the error enum is full, so no new code is added) when `new_admin` is:

| Target | Result |
| --- | --- |
| the current admin | `SameAdmin` |
| the recovery admin | `SameAdmin` |
| the pending admin, nomination still live | `SameAdmin` |
| the pending admin, nomination expired | accepted |
| any other address | accepted; admin set, pending nomination cleared |

Rejected requests change nothing: admin, recovery admin and the pending nomination are left as they were. Validation lives in `recovery_target_check.rs` and runs before any storage write.
