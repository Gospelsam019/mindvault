// ── Admin-role rotation event payloads (#29) ──────────────────────────────
//
// Every admin / recovery-admin mutation publishes `RoleRotation { actor,
// previous, replacement }` under a stable single-topic symbol.

fn last_rotation(env: &Env, topic: &str) -> RoleRotation {
    let all = env.events().all();
    let (_, topics, data) = all.get_unchecked(all.len() - 1);
    assert_eq!(topics.len(), 1, "role rotation events carry only their topic");
    let sym: Symbol = Symbol::try_from_val(env, &topics.get(0).unwrap()).unwrap();
    assert_eq!(sym, Symbol::new(env, topic));
    RoleRotation::try_from_val(env, &data).unwrap()
}

#[test]
fn bootstrap_setadmin_event_carries_actor_and_replacement() {
    let (env, _creator, client) = setup();
    let admin = Address::generate(&env);

    client.nominate_new_admin(&admin);

    assert_eq!(
        last_rotation(&env, "setadmin"),
        RoleRotation {
            actor: admin.clone(),
            previous: None,
            replacement: Some(admin),
        }
    );
}

#[test]
fn nomadmin_event_carries_current_admin_and_nominee() {
    let (env, _creator, admin, client) = setup_with_admin();
    let nominee = Address::generate(&env);

    client.nominate_new_admin(&nominee);

    assert_eq!(
        last_rotation(&env, "nomadmin"),
        RoleRotation {
            actor: admin.clone(),
            previous: Some(admin),
            replacement: Some(nominee),
        }
    );
}

#[test]
fn accadmin_event_carries_previous_and_new_admin() {
    let (env, _creator, admin, client) = setup_with_admin();
    let nominee = Address::generate(&env);
    client.nominate_new_admin(&nominee);
    env.ledger()
        .set_sequence_number(env.ledger().sequence() + ADMIN_NOMINATION_MIN_GAP);

    client.accept_admin(&nominee);

    assert_eq!(
        last_rotation(&env, "accadmin"),
        RoleRotation {
            actor: nominee.clone(),
            previous: Some(admin),
            replacement: Some(nominee),
        }
    );
}

#[test]
fn setrecov_event_tracks_previous_recovery_admin() {
    let (env, _creator, admin, client) = setup_with_admin();
    let first = Address::generate(&env);
    let second = Address::generate(&env);

    client.set_recovery_admin(&Some(first.clone()));
    assert_eq!(
        last_rotation(&env, "setrecov"),
        RoleRotation {
            actor: admin.clone(),
            previous: None,
            replacement: Some(first.clone()),
        }
    );

    client.set_recovery_admin(&Some(second.clone()));
    assert_eq!(
        last_rotation(&env, "setrecov"),
        RoleRotation {
            actor: admin.clone(),
            previous: Some(first.clone()),
            replacement: Some(second.clone()),
        }
    );

    client.set_recovery_admin(&None);
    assert_eq!(
        last_rotation(&env, "setrecov"),
        RoleRotation {
            actor: admin,
            previous: Some(second),
            replacement: None,
        }
    );
}

#[test]
fn recover_event_carries_recovery_actor_and_both_admins() {
    let (env, _creator, admin, client) = setup_with_admin();
    let recovery = Address::generate(&env);
    let replacement = Address::generate(&env);
    client.set_recovery_admin(&Some(recovery.clone()));

    client.recover_admin(&replacement);

    assert_eq!(
        last_rotation(&env, "recover"),
        RoleRotation {
            actor: recovery,
            previous: Some(admin),
            replacement: Some(replacement),
        }
    );
}
