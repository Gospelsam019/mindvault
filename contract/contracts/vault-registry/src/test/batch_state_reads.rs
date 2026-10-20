// `get_resource_states` (#10): ordered, bounded batch lifecycle-state read.

#[test]
fn get_resource_states_preserves_order_and_missing_ids() {
    let (env, creator, client) = setup();
    let a = register_default(&env, &creator, &client, "statea");
    let b = register_default(&env, &creator, &client, "stateb");
    client.delist(&b);
    let missing = String::from_str(&env, "nosuchid");
    let malformed = String::from_str(&env, "Bad-Id");

    let ids = Vec::from_array(&env, [b.clone(), missing, a.clone(), malformed]);
    let states = client.get_resource_states(&ids);

    assert_eq!(states.len(), 4);
    assert_eq!(states.get(0).unwrap(), Some(client.get_resource_state(&b)));
    assert_eq!(states.get(1).unwrap(), None);
    assert_eq!(states.get(2).unwrap(), Some(ResourceState::Listed));
    assert_eq!(states.get(3).unwrap(), None);
    assert_ne!(client.get_resource_state(&b), ResourceState::Listed);
}

#[test]
fn get_resource_states_empty_batch_is_empty() {
    let (env, _creator, client) = setup();
    assert_eq!(client.get_resource_states(&Vec::new(&env)).len(), 0);
}

#[test]
fn get_resource_states_accepts_exactly_the_maximum() {
    let (env, _creator, client) = setup();
    let mut ids: Vec<String> = Vec::new(&env);
    for _ in 0..MAX_STATE_BATCH {
        ids.push_back(String::from_str(&env, "absent"));
    }
    let states = client.get_resource_states(&ids);
    assert_eq!(states.len(), MAX_STATE_BATCH);
    assert!(states.iter().all(|s| s.is_none()));
}

#[test]
fn get_resource_states_rejects_batch_above_maximum() {
    let (env, _creator, client) = setup();
    let mut ids: Vec<String> = Vec::new(&env);
    for _ in 0..(MAX_STATE_BATCH + 1) {
        ids.push_back(String::from_str(&env, "absent"));
    }
    assert_eq!(
        client.try_get_resource_states(&ids),
        Err(Ok(Error::BatchTooLarge))
    );
}
