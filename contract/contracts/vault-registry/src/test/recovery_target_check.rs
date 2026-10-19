// `recover_admin` target validation (#27): the replacement may not be the
// current admin, the recovery admin, or a live pending admin, and a rejected
// request must leave every role untouched.

fn recovery_fixture<'a>() -> (Env, Address, Address, VaultRegistryClient<'a>) {
    let (env, _creator, client) = setup();
    let admin = Address::generate(&env);
    client.nominate_new_admin(&admin);
    let recovery = Address::generate(&env);
    client.set_recovery_admin(&Some(recovery.clone()));
    (env, admin, recovery, client)
}

#[test]
fn recover_admin_rejects_current_admin_without_role_changes() {
    let (_env, admin, recovery, client) = recovery_fixture();
    assert_eq!(client.try_recover_admin(&admin), Err(Ok(Error::SameAdmin)));
    assert_eq!(client.admin(), Some(admin));
    assert_eq!(client.recovery_admin(), Some(recovery));
}

#[test]
fn recover_admin_rejects_recovery_admin_without_role_changes() {
    let (_env, admin, recovery, client) = recovery_fixture();
    assert_eq!(
        client.try_recover_admin(&recovery),
        Err(Ok(Error::SameAdmin))
    );
    assert_eq!(client.admin(), Some(admin));
    assert_eq!(client.recovery_admin(), Some(recovery));
}

#[test]
fn recover_admin_rejects_live_pending_admin_without_role_changes() {
    let (env, admin, recovery, client) = recovery_fixture();
    let pending = Address::generate(&env);
    client.nominate_new_admin(&pending);

    assert_eq!(
        client.try_recover_admin(&pending),
        Err(Ok(Error::SameAdmin))
    );
    assert_eq!(client.admin(), Some(admin));
    assert_eq!(client.recovery_admin(), Some(recovery));
    assert_eq!(client.pending_admin(), Some(pending));
}

#[test]
fn recover_admin_accepts_expired_pending_admin_as_target() {
    let (env, _admin, _recovery, client) = recovery_fixture();
    let pending = Address::generate(&env);
    client.nominate_new_admin(&pending);
    let expiry = client.pending_admin_expiry().unwrap();
    env.ledger().set_sequence_number(expiry);

    assert_eq!(client.try_recover_admin(&pending), Ok(Ok(())));
    assert_eq!(client.admin(), Some(pending));
    assert_eq!(client.pending_admin(), None);
}

#[test]
fn recover_admin_accepts_fresh_address_and_clears_pending() {
    let (env, _admin, recovery, client) = recovery_fixture();
    let pending = Address::generate(&env);
    client.nominate_new_admin(&pending);
    let fresh = Address::generate(&env);

    assert_eq!(client.try_recover_admin(&fresh), Ok(Ok(())));
    assert_eq!(client.admin(), Some(fresh));
    assert_eq!(client.pending_admin(), None);
    assert_eq!(client.recovery_admin(), Some(recovery));
}
