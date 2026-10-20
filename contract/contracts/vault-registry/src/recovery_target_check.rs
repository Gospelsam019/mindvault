//! Validation of the replacement address passed to `recover_admin`.
//!
//! A recovery must never hand the admin role to an address that already holds
//! an active governance position. `Error::SameAdmin` is reused for every
//! rejected target because the error enum is full (see contract/README.md,
//! "Error budget").

use soroban_sdk::{Address, Env};

use crate::{DataKey, Error};

/// Reject `new_admin` when it equals the current admin, the recovery admin, or
/// a pending admin whose nomination is still live (not yet expired). Reads
/// only; callers must invoke this before mutating any storage.
pub(crate) fn ensure_valid_recovery_target(
    env: &Env,
    new_admin: &Address,
    current_admin: &Address,
    recovery_admin: &Address,
) -> Result<(), Error> {
    if new_admin == current_admin || new_admin == recovery_admin {
        return Err(Error::SameAdmin);
    }
    let pending: Option<Address> = env.storage().instance().get(&DataKey::PendingAdmin);
    if let Some(pending) = pending {
        let expiry: u32 = env
            .storage()
            .instance()
            .get::<DataKey, u32>(&DataKey::PendingAdminExpiry)
            .unwrap_or(0);
        if pending == *new_admin && env.ledger().sequence() < expiry {
            return Err(Error::SameAdmin);
        }
    }
    Ok(())
}
