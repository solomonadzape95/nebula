#![cfg(test)]

use soroban_sdk::{
    testutils::{Address as _, Ledger as _},
    Address, Env, IntoVal, String,
};

use crate::{NxlmToken, NxlmTokenClient};

struct Fixture<'a> {
    env: Env,
    token: NxlmTokenClient<'a>,
    vault: Address,
}

fn setup() -> Fixture<'static> {
    let env = Env::default();
    env.mock_all_auths();

    let vault = Address::generate(&env);
    let contract_id = env.register(
        NxlmToken,
        (
            vault.clone(),
            7_u32,
            String::from_str(&env, "Nebula Staked XLM"),
            String::from_str(&env, "nXLM"),
        ),
    );

    Fixture {
        token: NxlmTokenClient::new(&env, &contract_id),
        env,
        vault,
    }
}

#[test]
fn metadata_matches_construction() {
    let f = setup();
    assert_eq!(f.token.decimals(), 7);
    assert_eq!(f.token.name(), String::from_str(&f.env, "Nebula Staked XLM"));
    assert_eq!(f.token.symbol(), String::from_str(&f.env, "nXLM"));
    assert_eq!(f.token.minter(), f.vault);
}

#[test]
fn mint_credits_balance() {
    let f = setup();
    let user = Address::generate(&f.env);

    f.token.mint(&user, &1_000);

    assert_eq!(f.token.balance(&user), 1_000);
}

#[test]
fn mint_requires_minter_auth() {
    let env = Env::default();
    let vault = Address::generate(&env);
    let user = Address::generate(&env);
    let contract_id = env.register(
        NxlmToken,
        (
            vault.clone(),
            7_u32,
            String::from_str(&env, "Nebula Staked XLM"),
            String::from_str(&env, "nXLM"),
        ),
    );
    let token = NxlmTokenClient::new(&env, &contract_id);

    // Authorize only the user, never the vault. The mint must not go through.
    env.mock_auths(&[soroban_sdk::testutils::MockAuth {
        address: &user,
        invoke: &soroban_sdk::testutils::MockAuthInvoke {
            contract: &contract_id,
            fn_name: "mint",
            args: (user.clone(), 1_000_i128).into_val(&env),
            sub_invokes: &[],
        },
    }]);

    assert!(token.try_mint(&user, &1_000).is_err());
}

#[test]
fn transfer_moves_balance() {
    let f = setup();
    let alice = Address::generate(&f.env);
    let bob = Address::generate(&f.env);
    f.token.mint(&alice, &1_000);

    f.token.transfer(&alice, &bob, &400);

    assert_eq!(f.token.balance(&alice), 600);
    assert_eq!(f.token.balance(&bob), 400);
}

#[test]
fn transfer_beyond_balance_fails() {
    let f = setup();
    let alice = Address::generate(&f.env);
    let bob = Address::generate(&f.env);
    f.token.mint(&alice, &100);

    assert!(f.token.try_transfer(&alice, &bob, &101).is_err());
    assert_eq!(f.token.balance(&alice), 100);
}

#[test]
fn negative_amounts_are_rejected() {
    let f = setup();
    let alice = Address::generate(&f.env);
    let bob = Address::generate(&f.env);
    f.token.mint(&alice, &100);

    assert!(f.token.try_transfer(&alice, &bob, &-1).is_err());
    assert!(f.token.try_mint(&alice, &-1).is_err());
    assert!(f.token.try_burn(&alice, &-1).is_err());
}

#[test]
fn burn_reduces_balance() {
    let f = setup();
    let alice = Address::generate(&f.env);
    f.token.mint(&alice, &1_000);

    f.token.burn(&alice, &250);

    assert_eq!(f.token.balance(&alice), 750);
}

#[test]
fn allowance_permits_delegated_transfer() {
    let f = setup();
    let alice = Address::generate(&f.env);
    let bob = Address::generate(&f.env);
    let carol = Address::generate(&f.env);
    f.token.mint(&alice, &1_000);

    f.token.approve(&alice, &bob, &500, &(f.env.ledger().sequence() + 100));
    assert_eq!(f.token.allowance(&alice, &bob), 500);

    f.token.transfer_from(&bob, &alice, &carol, &300);

    assert_eq!(f.token.balance(&alice), 700);
    assert_eq!(f.token.balance(&carol), 300);
    assert_eq!(f.token.allowance(&alice, &bob), 200);
}

#[test]
fn transfer_from_beyond_allowance_fails() {
    let f = setup();
    let alice = Address::generate(&f.env);
    let bob = Address::generate(&f.env);
    let carol = Address::generate(&f.env);
    f.token.mint(&alice, &1_000);

    f.token.approve(&alice, &bob, &100, &(f.env.ledger().sequence() + 100));

    assert!(f.token.try_transfer_from(&bob, &alice, &carol, &101).is_err());
}

#[test]
fn expired_allowance_reads_as_zero() {
    let f = setup();
    let alice = Address::generate(&f.env);
    let bob = Address::generate(&f.env);
    f.token.mint(&alice, &1_000);

    let expires_at = f.env.ledger().sequence() + 10;
    f.token.approve(&alice, &bob, &500, &expires_at);

    f.env.ledger().set_sequence_number(expires_at + 1);

    assert_eq!(f.token.allowance(&alice, &bob), 0);
}

#[test]
fn allowance_expiring_in_the_past_is_rejected() {
    let f = setup();
    let alice = Address::generate(&f.env);
    let bob = Address::generate(&f.env);

    f.env.ledger().set_sequence_number(100);

    assert!(f.token.try_approve(&alice, &bob, &500, &99).is_err());
}
