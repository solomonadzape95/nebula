#![cfg(test)]
//! Tests run against a local stand-in for a Blend pool.
//!
//! The stand-in implements the same contract interface the adapter calls and models the one
//! behaviour that matters for accounting: a bToken rate that rises as interest accrues. That is
//! enough to prove the adapter realizes interest without touching principal, respects pool
//! liquidity, and keeps its cost basis straight.
//!
//! What it cannot prove is the authorization path — `mock_all_auths` makes every `require_auth`
//! succeed, so the allowance dance in `deposit` is exercised for its token effects but not for its
//! auth semantics. That needs a real pool on testnet.

use soroban_sdk::{
    contract, contractimpl, contracttype,
    testutils::{Address as _, Ledger as _},
    token::{StellarAssetClient, TokenClient},
    Address, Env, Map, Vec,
};

use crate::{
    blend::{Positions, Request, Reserve, ReserveConfig, ReserveData, SCALAR_12},
    BlendStrategy, BlendStrategyClient,
};

const XLM: i128 = 10_000_000;
const RESERVE_INDEX: u32 = 3; // deliberately not 0, so an index bug cannot pass by accident

// ------------------------------------------------------------------ stand-in pool

#[derive(Clone)]
#[contracttype]
enum PoolKey {
    Underlying,
    BRate,
    Supply(Address),
}

#[contract]
pub struct FakePool;

#[contractimpl]
impl FakePool {
    pub fn __constructor(env: Env, underlying: Address) {
        env.storage().instance().set(&PoolKey::Underlying, &underlying);
        env.storage().instance().set(&PoolKey::BRate, &SCALAR_12);
    }

    /// Simulate interest: raise the bToken rate and fund the pool so the gain is withdrawable.
    pub fn accrue(env: Env, new_b_rate: i128) {
        env.storage().instance().set(&PoolKey::BRate, &new_b_rate);
    }

    pub fn get_reserve(env: Env, asset: Address) -> Reserve {
        Reserve {
            asset,
            config: ReserveConfig {
                index: RESERVE_INDEX,
                decimals: 7,
                c_factor: 0,
                l_factor: 0,
                util: 0,
                max_util: 9_500_000,
                r_base: 0,
                r_one: 0,
                r_two: 0,
                r_three: 0,
                reactivity: 0,
                supply_cap: 0,
                enabled: true,
            },
            data: ReserveData {
                d_rate: SCALAR_12,
                b_rate: env.storage().instance().get(&PoolKey::BRate).unwrap(),
                ir_mod: 0,
                b_supply: 0,
                d_supply: 0,
                backstop_credit: 0,
                last_time: 0,
            },
            scalar: 10_000_000,
        }
    }

    pub fn get_positions(env: Env, address: Address) -> Positions {
        let b_tokens: i128 = env
            .storage()
            .instance()
            .get(&PoolKey::Supply(address))
            .unwrap_or(0);
        let mut supply = Map::new(&env);
        supply.set(RESERVE_INDEX, b_tokens);
        Positions {
            liabilities: Map::new(&env),
            collateral: Map::new(&env),
            supply,
        }
    }

    pub fn submit(
        env: Env,
        from: Address,
        spender: Address,
        to: Address,
        requests: Vec<Request>,
    ) -> Positions {
        Self::process(env, from, spender, to, requests, false)
    }

    pub fn submit_with_allowance(
        env: Env,
        from: Address,
        spender: Address,
        to: Address,
        requests: Vec<Request>,
    ) -> Positions {
        Self::process(env, from, spender, to, requests, true)
    }

    pub fn claim(env: Env, from: Address, _reserve_token_ids: Vec<u32>, _to: Address) -> i128 {
        let _ = (env, from);
        0
    }

    fn process(
        env: Env,
        from: Address,
        spender: Address,
        to: Address,
        requests: Vec<Request>,
        use_allowance: bool,
    ) -> Positions {
        let underlying: Address = env.storage().instance().get(&PoolKey::Underlying).unwrap();
        let b_rate: i128 = env.storage().instance().get(&PoolKey::BRate).unwrap();
        let token = TokenClient::new(&env, &underlying);
        let me = env.current_contract_address();

        for request in requests.iter() {
            let held: i128 = env
                .storage()
                .instance()
                .get(&PoolKey::Supply(from.clone()))
                .unwrap_or(0);

            match request.request_type {
                0 => {
                    // Supply
                    if use_allowance {
                        token.transfer_from(&me, &spender, &me, &request.amount);
                    } else {
                        token.transfer(&spender, &me, &request.amount);
                    }
                    let minted = request.amount * SCALAR_12 / b_rate;
                    env.storage()
                        .instance()
                        .set(&PoolKey::Supply(from.clone()), &(held + minted));
                }
                1 => {
                    // Withdraw — Blend clamps a request larger than the position.
                    let position_value = held * b_rate / SCALAR_12;
                    let paid = request.amount.min(position_value).min(token.balance(&me));
                    let burned = ((paid * SCALAR_12 + b_rate - 1) / b_rate).min(held);
                    if paid > 0 {
                        token.transfer(&me, &to, &paid);
                    }
                    env.storage()
                        .instance()
                        .set(&PoolKey::Supply(from.clone()), &(held - burned));
                }
                other => panic!("unexpected request type {other}"),
            }
        }

        Self::get_positions(env, from)
    }
}

// ------------------------------------------------------------------ fixture

struct Fixture<'a> {
    env: Env,
    strategy: BlendStrategyClient<'a>,
    strategy_id: Address,
    pool: FakePoolClient<'a>,
    pool_id: Address,
    underlying: TokenClient<'a>,
    minter: StellarAssetClient<'a>,
    vault: Address,
}

impl Fixture<'_> {
    /// Raise the bToken rate and fund the pool so the accrued interest is actually payable.
    fn accrue(&self, multiplier_bps: i128) {
        self.pool.accrue(&(SCALAR_12 * multiplier_bps / 10_000));
        let owed = self.strategy.total_assets() - self.underlying.balance(&self.pool_id);
        if owed > 0 {
            self.minter.mint(&self.pool_id, &owed);
        }
    }

    fn fund_vault(&self, amount: i128) {
        self.minter.mint(&self.vault, &amount);
    }

    /// Move underlying from the vault into the strategy, then tell it to deploy — the push
    /// discipline the `Strategy` trait requires.
    fn deposit(&self, amount: i128) {
        self.underlying.transfer(&self.vault, &self.strategy_id, &amount);
        self.strategy.deposit(&amount);
    }
}

fn setup() -> Fixture<'static> {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_sequence_number(100);

    let issuer = Address::generate(&env);
    let vault = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(issuer);
    let underlying = sac.address();

    let pool_id = env.register(FakePool, (underlying.clone(),));
    let strategy_id = env.register(
        BlendStrategy,
        (underlying.clone(), vault.clone(), pool_id.clone()),
    );

    Fixture {
        strategy: BlendStrategyClient::new(&env, &strategy_id),
        pool: FakePoolClient::new(&env, &pool_id),
        underlying: TokenClient::new(&env, &underlying),
        minter: StellarAssetClient::new(&env, &underlying),
        strategy_id,
        pool_id,
        vault,
        env,
    }
}

// ------------------------------------------------------------------ tests

#[test]
fn constructor_caches_the_reserve_index_and_pool() {
    let f = setup();
    assert_eq!(f.strategy.pool(), f.pool_id);
    assert_eq!(f.strategy.basis(), 0);
    assert_eq!(f.strategy.total_assets(), 0);
}

#[test]
fn deposit_supplies_the_pool_and_records_basis() {
    let f = setup();
    f.fund_vault(1_000 * XLM);

    f.deposit(1_000 * XLM);

    assert_eq!(f.strategy.basis(), 1_000 * XLM);
    assert_eq!(f.strategy.total_assets(), 1_000 * XLM);
    assert_eq!(f.underlying.balance(&f.pool_id), 1_000 * XLM);
    assert_eq!(
        f.underlying.balance(&f.strategy_id),
        0,
        "the strategy must not sit on idle underlying"
    );
}

#[test]
fn accrued_interest_shows_up_as_position_value_not_basis() {
    let f = setup();
    f.fund_vault(1_000 * XLM);
    f.deposit(1_000 * XLM);

    f.accrue(11_000); // bToken rate +10%

    assert_eq!(f.strategy.basis(), 1_000 * XLM, "principal is unchanged");
    assert_eq!(f.strategy.total_assets(), 1_100 * XLM);
    assert_eq!(f.strategy.pending_interest(), 100 * XLM);
}

#[test]
fn harvest_realizes_interest_and_leaves_principal_working() {
    let f = setup();
    f.fund_vault(1_000 * XLM);
    f.deposit(1_000 * XLM);
    f.accrue(11_000);

    let realized = f.strategy.harvest();

    assert_eq!(realized, 100 * XLM);
    assert_eq!(
        f.underlying.balance(&f.vault),
        100 * XLM,
        "yield lands in the vault as spendable underlying"
    );
    assert_eq!(f.strategy.basis(), 1_000 * XLM, "basis must not move on harvest");

    // Blend burns bTokens rounded *up* on withdrawal, so realizing interest costs the position a
    // stroop or two. Rounding against the supplier is the correct direction — it protects the
    // pool's other suppliers — so the assertion allows for it rather than pretending it is exact.
    let principal = f.strategy.total_assets();
    assert!(
        (1_000 * XLM - principal) <= 10,
        "principal should stay supplied and keep earning, got {principal}"
    );
    assert_eq!(f.strategy.pending_interest(), 0);
}

#[test]
fn harvest_with_no_interest_is_a_no_op() {
    let f = setup();
    f.fund_vault(1_000 * XLM);
    f.deposit(1_000 * XLM);

    assert_eq!(f.strategy.harvest(), 0);
    assert_eq!(f.underlying.balance(&f.vault), 0);
    assert_eq!(f.strategy.total_assets(), 1_000 * XLM);
}

#[test]
fn repeated_harvests_sweep_interest_and_leave_principal_flat() {
    let f = setup();
    f.fund_vault(1_000 * XLM);
    f.deposit(1_000 * XLM);

    f.accrue(11_000); // +10% on the position
    let first = f.strategy.harvest();
    f.accrue(12_100); // a further +10% on what is left supplied
    let second = f.strategy.harvest();

    // Each harvest yields ~10% of the *principal*, not a compounding amount, because the previous
    // harvest swept the interest out. Compounding is the vault's job: harvested XLM lands in the
    // reserve and `allocate` puts it back to work, which is what lifts the share price.
    assert!((first - 100 * XLM).abs() <= 10, "first harvest was {first}");
    assert!((second - 100 * XLM).abs() <= 10, "second harvest was {second}");
    assert!(f.underlying.balance(&f.vault) >= 200 * XLM - 20);

    let principal = f.strategy.total_assets();
    assert!(
        (1_000 * XLM - principal) <= 20,
        "principal should be untouched across harvests, got {principal}"
    );
}

#[test]
fn withdraw_returns_underlying_and_reduces_basis() {
    let f = setup();
    f.fund_vault(1_000 * XLM);
    f.deposit(1_000 * XLM);

    let returned = f.strategy.withdraw(&(400 * XLM));

    assert_eq!(returned, 400 * XLM);
    assert_eq!(f.underlying.balance(&f.vault), 400 * XLM);
    assert_eq!(f.strategy.basis(), 600 * XLM);
    assert_eq!(f.strategy.total_assets(), 600 * XLM);
}

#[test]
fn withdrawing_everything_empties_the_position() {
    let f = setup();
    f.fund_vault(1_000 * XLM);
    f.deposit(1_000 * XLM);

    let returned = f.strategy.withdraw(&(1_000 * XLM));

    assert_eq!(returned, 1_000 * XLM);
    assert_eq!(f.strategy.basis(), 0);
    assert_eq!(f.strategy.total_assets(), 0);
}

#[test]
fn withdraw_reports_the_measured_amount_when_the_pool_is_short() {
    let f = setup();
    f.fund_vault(1_000 * XLM);
    f.deposit(1_000 * XLM);

    // Borrowers have drawn most of the reserve; only 250 XLM of cash is left.
    let drained = f.underlying.balance(&f.pool_id) - 250 * XLM;
    let borrower = Address::generate(&f.env);
    f.underlying.transfer(&f.pool_id, &borrower, &drained);

    let returned = f.strategy.withdraw(&(1_000 * XLM));

    assert_eq!(returned, 250 * XLM, "reports what arrived, not what was asked for");
    assert_eq!(f.underlying.balance(&f.vault), 250 * XLM);
    assert_eq!(f.strategy.basis(), 750 * XLM);
}

#[test]
fn max_withdrawable_is_bounded_by_pool_liquidity() {
    let f = setup();
    f.fund_vault(1_000 * XLM);
    f.deposit(1_000 * XLM);

    assert_eq!(f.strategy.max_withdrawable(), 1_000 * XLM);

    let borrower = Address::generate(&f.env);
    f.underlying.transfer(&f.pool_id, &borrower, &(700 * XLM));

    assert_eq!(
        f.strategy.max_withdrawable(),
        300 * XLM,
        "a fully utilized reserve cannot be exited even though the position is real"
    );
    assert_eq!(f.strategy.total_assets(), 1_000 * XLM, "the position itself is unchanged");
}

#[test]
fn negative_amounts_are_rejected() {
    let f = setup();
    assert!(f.strategy.try_deposit(&-1).is_err());
    assert!(f.strategy.try_withdraw(&-1).is_err());
}

#[test]
fn zero_amounts_are_no_ops() {
    let f = setup();
    f.strategy.deposit(&0);
    assert_eq!(f.strategy.withdraw(&0), 0);
    assert_eq!(f.strategy.basis(), 0);
}
