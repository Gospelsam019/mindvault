//! Anchor lifecycle status (#41).
//!
//! The status is *derived* on read from the records the anchor paths already
//! maintain, so no stored record changes shape and every anchor written before
//! this module existed reads as [`AnchorStatus::Confirmed`].
//!
//! Transitions for a `(resource_id, buyer)` pair (`None` = no anchor activity):
//!
//! ```text
//! None --rejected attempt--> Pending --attempts reach MAX_ANCHOR_ATTEMPTS--> Failed
//! None/Pending --failure recorded (record_anchor_failure, settler path)------> Failed
//! None/Pending/Failed --anchor written------------------------------------> Confirmed
//! ```
//!
//! `Confirmed` is terminal: anchors are immutable (duplicates are rejected and
//! `write_anchor` is the only writer), and writing one clears the failure and
//! attempt records. `Failed -> Confirmed` is the documented retry transition.
//! The `anchor` event is emitted exactly when a pair becomes `Confirmed`, and
//! `anchrfail` accompanies every `Failed` record, so reads and events agree.

use soroban_sdk::contracttype;

/// Lifecycle status of a purchase receipt anchor.
///
/// Discriminants are stable; append new variants only.
#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum AnchorStatus {
    /// Rejected attempts are on record but retries are still allowed.
    Pending = 0,
    /// The anchor is written and readable via `get_purchase_receipt`.
    Confirmed = 1,
    /// An outstanding failure record exists or the attempt cap was reached.
    Failed = 2,
}

/// Pure derivation shared by the contract entry point and tests.
pub(crate) fn derive_status(
    has_anchor: bool,
    has_failure: bool,
    rejected_attempts: u32,
    max_attempts: u32,
) -> Option<AnchorStatus> {
    if has_anchor {
        Some(AnchorStatus::Confirmed)
    } else if has_failure || rejected_attempts >= max_attempts {
        Some(AnchorStatus::Failed)
    } else if rejected_attempts > 0 {
        Some(AnchorStatus::Pending)
    } else {
        None
    }
}
