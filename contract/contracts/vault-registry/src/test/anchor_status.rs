// ── Anchor lifecycle status (#41) ─────────────────────────────────────────

#[test]
fn derive_status_covers_every_state() {
    use crate::anchor_status::derive_status;

    assert_eq!(derive_status(false, false, 0, MAX_ANCHOR_ATTEMPTS), None);
    assert_eq!(
        derive_status(false, false, 1, MAX_ANCHOR_ATTEMPTS),
        Some(AnchorStatus::Pending)
    );
    assert_eq!(
        derive_status(false, false, MAX_ANCHOR_ATTEMPTS, MAX_ANCHOR_ATTEMPTS),
        Some(AnchorStatus::Failed)
    );
    assert_eq!(
        derive_status(false, true, 0, MAX_ANCHOR_ATTEMPTS),
        Some(AnchorStatus::Failed)
    );
    // An anchor wins over any leftover failure or attempt bookkeeping.
    assert_eq!(
        derive_status(true, true, MAX_ANCHOR_ATTEMPTS, MAX_ANCHOR_ATTEMPTS),
        Some(AnchorStatus::Confirmed)
    );
}

#[test]
fn anchor_status_is_none_without_activity() {
    let (env, creator, client) = setup();
    let id = register_default(&env, &creator, &client, "anchst0");
    let buyer = Address::generate(&env);

    assert_eq!(client.get_anchor_status(&id, &buyer), None);
}

#[test]
fn anchor_status_moves_pending_then_failed_then_confirmed() {
    let (env, creator, admin, client) = setup_with_admin();
    let id = register_default(&env, &creator, &client, "anchst1");
    let verifier = Address::generate(&env);
    client.add_verifier(&verifier);
    let buyer = Address::generate(&env);
    let bad_hash = String::from_str(&env, "");

    // A rejected attempt leaves the pair pending while retries remain.
    assert!(!client.attempt_anchor_purchase_receipt(&verifier, &id, &buyer, &bad_hash));
    assert_eq!(
        client.get_anchor_status(&id, &buyer),
        Some(AnchorStatus::Pending)
    );

    // Exhausting the attempt cap makes the pair failed.
    for _ in 1..MAX_ANCHOR_ATTEMPTS {
        env.ledger()
            .set_sequence_number(env.ledger().sequence() + ANCHOR_RETRY_BACKOFF_LEDGERS);
        client.attempt_anchor_purchase_receipt(&verifier, &id, &buyer, &bad_hash);
    }
    assert_eq!(
        client.get_anchor_status(&id, &buyer),
        Some(AnchorStatus::Failed)
    );

    // A different buyer is unaffected and confirms on a successful anchor.
    let other = Address::generate(&env);
    client.anchor_purchase_receipt(&verifier, &id, &other, &String::from_str(&env, "tx-hash-1"));
    assert_eq!(
        client.get_anchor_status(&id, &other),
        Some(AnchorStatus::Confirmed)
    );
    let _ = admin;
}
