// `cancel_admin_nomination` (#26): admin-only, errors when nothing is pending,
// and a cancelled nominee can no longer accept.

#[test]
fn cancel_admin_nomination_clears_pending_and_blocks_accept() {
    let (env, _creator, client) = setup();
    let admin = Address::generate(&env);
    client.nominate_new_admin(&admin);
    let nominee = Address::generate(&env);
    client.nominate_new_admin(&nominee);
    assert_eq!(client.pending_admin(), Some(nominee.clone()));

    client.cancel_admin_nomination();

    assert_eq!(client.pending_admin(), None);
    assert_eq!(client.pending_admin_expiry(), None);
    assert_eq!(client.admin(), Some(admin));
    env.ledger()
        .set_sequence_number(env.ledger().sequence() + ADMIN_NOMINATION_MIN_GAP);
    assert_eq!(
        client.try_accept_admin(&nominee),
        Err(Ok(Error::AdminNominationExpired))
    );
}

#[test]
fn cancel_admin_nomination_without_pending_returns_pending_admin_not_set() {
    let (env, _creator, client) = setup();
    client.nominate_new_admin(&Address::generate(&env));
    assert_eq!(
        client.try_cancel_admin_nomination(),
        Err(Ok(Error::PendingAdminNotSet))
    );
}

#[test]
fn cancel_admin_nomination_without_admin_returns_admin_not_set() {
    let (_env, _creator, client) = setup();
    assert_eq!(
        client.try_cancel_admin_nomination(),
        Err(Ok(Error::AdminNotSet))
    );
}

#[test]
fn cancel_admin_nomination_requires_current_admin_auth() {
    let env = Env::default();
    let contract_id = env.register(VaultRegistry, ());
    let client = VaultRegistryClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let nominee = Address::generate(&env);
    env.mock_all_auths();
    client.nominate_new_admin(&admin);
    client.nominate_new_admin(&nominee);

    let outsider = Address::generate(&env);
    env.mock_auths(&[MockAuth {
        address: &outsider,
        invoke: &MockAuthInvoke {
            contract: &contract_id,
            fn_name: "cancel_admin_nomination",
            args: ().into_val(&env),
            sub_invokes: &[],
        },
    }]);
    assert!(client.try_cancel_admin_nomination().is_err());
    assert_eq!(client.pending_admin(), Some(nominee));
}

#[test]
fn cancel_admin_nomination_allows_renomination_and_emits_event() {
    let (env, _creator, client) = setup();
    client.nominate_new_admin(&Address::generate(&env));
    let first = Address::generate(&env);
    client.nominate_new_admin(&first);
    client.cancel_admin_nomination();
    let events = env.events().all();
    let last = events.get(events.len() - 1).unwrap();
    let topics: Vec<Val> = last.1.clone();
    let topic0: Symbol = topics.get(0).unwrap().try_into_val(&env).unwrap();
    assert_eq!(topic0, symbol_short!("nomcancel"));

    let second = Address::generate(&env);
    client.nominate_new_admin(&second);
    assert_eq!(client.pending_admin(), Some(second));
}
