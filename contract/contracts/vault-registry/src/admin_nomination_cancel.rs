//! Cancellation of a pending admin nomination (`cancel_admin_nomination`).
//!
//! The nomination is two-step and time-gated (`nominate_new_admin`, then
//! `accept_admin` after `ADMIN_NOMINATION_MIN_GAP`). Cancelling removes the
//! pending nominee together with its expiry and nominated-at ledger, so a
//! cancelled nominee can no longer accept. `PendingAdminNotSet` is reused for
//! "nothing to cancel" because the error enum is full.

use soroban_sdk::{symbol_short, Address, Env};

use crate::{DataKey, Error};

/// Clear the pending nomination and emit `nomcancel` with the cancelled
/// nominee. Only the current admin may call this.
pub(crate) fn cancel(env: &Env) -> Result<(), Error> {
    let admin: Address = env
        .storage()
        .instance()
        .get(&DataKey::Admin)
        .ok_or(Error::AdminNotSet)?;
    admin.require_auth();
    let pending: Address = env
        .storage()
        .instance()
        .get(&DataKey::PendingAdmin)
        .ok_or(Error::PendingAdminNotSet)?;
    env.storage().instance().remove(&DataKey::PendingAdmin);
    env.storage()
        .instance()
        .remove(&DataKey::PendingAdminExpiry);
    env.storage()
        .instance()
        .remove(&DataKey::PendingAdminNominatedAt);
    env.events().publish((symbol_short!("nomcancel"),), pending);
    Ok(())
}
