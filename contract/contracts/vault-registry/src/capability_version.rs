//! Role capability version exposed through `registry_info` (#30).
//!
//! Clients use `RegistryInfo::role_capability_version` to detect which role
//! methods and role-event shapes exist before calling them, without probing
//! for missing methods. Bump [`ROLE_CAPABILITY_VERSION`] whenever a role method
//! is added or removed, or a role event payload changes shape.
//!
//! | Version | Role surface                                                                                     |
//! | ------- | ------------------------------------------------------------------------------------------------ |
//! | 1       | admin nomination/acceptance, recovery admin (`recover_admin`), moderator and verifier roles with `RoleChange` / `VerifierRotation` events, `RoleRotation` events for admin and recovery changes |

/// Current role capability version. See the module documentation.
pub const ROLE_CAPABILITY_VERSION: u32 = 1;

/// Role-related methods that exist at [`ROLE_CAPABILITY_VERSION`]. Kept next to
/// the version so tests can verify it against `METHOD_SCHEMA`.
#[cfg(test)]
pub const ROLE_CAPABILITY_METHODS: &[&str] = &[
    "nominate_new_admin",
    "accept_admin",
    "bootstrap_dual_admin",
    "set_recovery_admin",
    "recover_admin",
    "add_moderator",
    "remove_moderator",
    "add_verifier",
    "rotate_verifier",
];
