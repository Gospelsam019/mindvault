// ── Role capability version in registry_info (#30) ────────────────────────

#[test]
fn registry_info_exposes_role_capability_version() {
    let (_env, _creator, client) = setup();

    assert_eq!(
        client.registry_info().role_capability_version,
        ROLE_CAPABILITY_VERSION
    );
    assert_eq!(ROLE_CAPABILITY_VERSION, 1);
}

#[test]
fn role_capability_version_is_stable_across_calls_and_admin_changes() {
    let (env, _creator, admin, client) = setup_with_admin();
    let before = client.registry_info().role_capability_version;

    client.add_moderator(&Address::generate(&env));
    client.set_recovery_admin(&Some(Address::generate(&env)));
    let _ = admin;

    assert_eq!(client.registry_info().role_capability_version, before);
}

#[test]
fn role_capability_methods_exist_in_method_schema() {
    for method in crate::capability_version::ROLE_CAPABILITY_METHODS {
        assert!(
            METHOD_SCHEMA.iter().any(|(name, _)| name == method),
            "role capability method `{method}` is missing from METHOD_SCHEMA; \
             bump ROLE_CAPABILITY_VERSION when the role surface changes"
        );
    }
}
