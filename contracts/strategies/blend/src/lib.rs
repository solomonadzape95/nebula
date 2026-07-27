#![no_std]
//! Blend lending strategy.
//!
//! Supplies the vault's XLM to a Blend pool and earns borrower interest. This is the first real
//! yield venue behind the `Strategy` trait.
//!
//! # Two deliberate limits
//!
//! **Supply only, never collateral.** Blend distinguishes `Supply` from `SupplyCollateral`; only
//! the latter backs borrowing and carries a health factor. Nebula never borrows, so it uses plain
//! supply: the position cannot be liquidated and is withdrawable whenever the pool holds cash.
//!
//! **Harvest realizes interest, not emissions.** Interest accrues in the underlying itself — the
//! bToken rate rises — so it can be realized as XLM with no swap. BLND emissions are a different
//! asset and would need a DEX route to become XLM; until that exists, [`MockStrategy`]-style
//! auto-compounding of BLND is out of scope. `claim_emissions` sends them to the treasury instead,
//! and deliberately does not touch the share price. Counting an asset the vault cannot redeem
//! into would inflate the share price against XLM the vault does not have.
//!
//! [`MockStrategy`]: nebula_strategy_mock

mod blend;

#[cfg(test)]
mod test;

pub use blend::{
    b_token_emission_id, BlendPool, BlendPoolClient, Positions, Request, Reserve, ReserveConfig,
    ReserveData, REQUEST_SUPPLY, REQUEST_WITHDRAW, SCALAR_12,
};

use nebula_interfaces::Strategy;
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, token::TokenClient,
    vec, Address, Env,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum BlendStrategyError {
    NotInitialized = 1,
    NegativeAmount = 2,
    /// The pool's reserve for this asset does not match the configured underlying.
    ReserveMismatch = 3,
    /// Blend returned less than it was asked for without reporting a shortfall.
    UnexpectedShortfall = 4,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Underlying,
    Vault,
    Pool,
    /// Index of the underlying's reserve within the pool. Cached at construction.
    ReserveIndex,
    /// Underlying the vault has supplied here, less what has been returned.
    ///
    /// Interest is the amount by which the live position exceeds this number. Tracking basis
    /// locally is what lets `harvest` withdraw exactly the surplus and leave the principal at work.
    Basis,
}

#[contract]
pub struct BlendStrategy;

#[contractimpl]
impl BlendStrategy {
    pub fn __constructor(env: Env, underlying: Address, vault: Address, pool: Address) {
        let reserve = BlendPoolClient::new(&env, &pool).get_reserve(&underlying);
        if reserve.asset != underlying {
            panic_with_error!(&env, BlendStrategyError::ReserveMismatch);
        }

        let storage = env.storage().instance();
        storage.set(&DataKey::Underlying, &underlying);
        storage.set(&DataKey::Vault, &vault);
        storage.set(&DataKey::Pool, &pool);
        storage.set(&DataKey::ReserveIndex, &reserve.config.index);
        storage.set(&DataKey::Basis, &0i128);
    }

    /// The Blend pool this strategy supplies to.
    pub fn pool(env: Env) -> Address {
        read(&env, &DataKey::Pool)
    }

    /// Underlying supplied by the vault, less what has been returned. Interest is the gap between
    /// this and [`Strategy::total_assets`].
    pub fn basis(env: Env) -> i128 {
        read(&env, &DataKey::Basis)
    }

    /// Interest earned but not yet realized, denominated in the underlying.
    pub fn pending_interest(env: Env) -> i128 {
        (position_value(&env) - read::<i128>(&env, &DataKey::Basis)).max(0)
    }

    /// Claim BLND emissions to `to`, returning the amount claimed.
    ///
    /// Vault-authorized. BLND is not the underlying, so this intentionally does not feed the share
    /// price — see the module docs. Once a BLND→XLM route exists, this folds into `harvest`.
    pub fn claim_emissions(env: Env, to: Address) -> i128 {
        require_vault(&env);
        let pool: Address = read(&env, &DataKey::Pool);
        let index: u32 = read(&env, &DataKey::ReserveIndex);

        BlendPoolClient::new(&env, &pool).claim(
            &env.current_contract_address(),
            &vec![&env, b_token_emission_id(index)],
            &to,
        )
    }
}

#[contractimpl]
impl Strategy for BlendStrategy {
    fn underlying(env: Env) -> Address {
        read(&env, &DataKey::Underlying)
    }

    fn vault(env: Env) -> Address {
        read(&env, &DataKey::Vault)
    }

    fn deposit(env: Env, amount: i128) {
        require_vault(&env);
        require_non_negative(&env, amount);
        if amount == 0 {
            return;
        }

        let underlying: Address = read(&env, &DataKey::Underlying);
        let pool: Address = read(&env, &DataKey::Pool);
        let me = env.current_contract_address();

        // Grant a single-ledger allowance rather than letting the pool move our tokens two frames
        // down. A contract is auto-authorized only for calls it makes directly; `approve` is such
        // a call, so this needs no `authorize_as_current_contract`. Blend consumes the allowance
        // exactly, and anything left expires on the next ledger.
        TokenClient::new(&env, &underlying).approve(
            &me,
            &pool,
            &amount,
            &(env.ledger().sequence() + 1),
        );

        BlendPoolClient::new(&env, &pool).submit_with_allowance(
            &me,
            &me,
            &me,
            &vec![
                &env,
                Request {
                    request_type: REQUEST_SUPPLY,
                    address: underlying,
                    amount,
                },
            ],
        );

        write_basis(&env, read::<i128>(&env, &DataKey::Basis) + amount);
    }

    fn withdraw(env: Env, amount: i128) -> i128 {
        let vault = require_vault(&env);
        require_non_negative(&env, amount);
        if amount == 0 {
            return 0;
        }

        let returned = withdraw_to_self(&env, amount);
        if returned > 0 {
            let underlying: Address = read(&env, &DataKey::Underlying);
            TokenClient::new(&env, &underlying).transfer(
                &env.current_contract_address(),
                &vault,
                &returned,
            );
            let basis: i128 = read(&env, &DataKey::Basis);
            write_basis(&env, (basis - returned).max(0));
        }
        returned
    }

    fn harvest(env: Env) -> i128 {
        let vault = require_vault(&env);

        // Interest is whatever the live position is worth above what the vault put in. Withdrawing
        // exactly that leaves the principal earning and turns the yield into spendable XLM.
        let interest = (position_value(&env) - read::<i128>(&env, &DataKey::Basis)).max(0);
        if interest == 0 {
            return 0;
        }

        let realized = withdraw_to_self(&env, interest);
        if realized > 0 {
            let underlying: Address = read(&env, &DataKey::Underlying);
            TokenClient::new(&env, &underlying).transfer(
                &env.current_contract_address(),
                &vault,
                &realized,
            );
            // Basis is unchanged on purpose: only the surplus left, the principal stayed supplied.
        }
        realized
    }

    fn total_assets(env: Env) -> i128 {
        position_value(&env)
    }

    fn max_withdrawable(env: Env) -> i128 {
        let underlying: Address = read(&env, &DataKey::Underlying);
        let pool: Address = read(&env, &DataKey::Pool);

        // Bounded by the position *and* by the cash the pool actually holds: a fully utilized
        // reserve cannot be exited even though the position is real. The vault relies on this
        // being a lower bound it can act on, so it must reflect liquidity, not just ownership.
        let cash = TokenClient::new(&env, &underlying).balance(&pool);
        position_value(&env).min(cash).max(0)
    }
}

// -------------------------------------------------------------------- internals

/// Withdraw `amount` of the underlying from the pool into this contract, returning what arrived.
///
/// The return value is measured, not taken from Blend's reply, for the same reason the vault
/// measures what its strategies deliver: a number that is trusted rather than observed is a number
/// that can be wrong.
fn withdraw_to_self(env: &Env, amount: i128) -> i128 {
    let underlying: Address = read(env, &DataKey::Underlying);
    let pool: Address = read(env, &DataKey::Pool);
    let me = env.current_contract_address();
    let token = TokenClient::new(env, &underlying);

    let before = token.balance(&me);
    BlendPoolClient::new(env, &pool).submit(
        &me,
        &me,
        &me,
        &vec![
            env,
            Request {
                request_type: REQUEST_WITHDRAW,
                address: underlying,
                amount,
            },
        ],
    );
    token.balance(&me) - before
}

/// Current value of the supplied position, in the underlying.
fn position_value(env: &Env) -> i128 {
    let underlying: Address = read(env, &DataKey::Underlying);
    let pool: Address = read(env, &DataKey::Pool);
    let index: u32 = read(env, &DataKey::ReserveIndex);
    let client = BlendPoolClient::new(env, &pool);

    let b_tokens = client
        .get_positions(&env.current_contract_address())
        .supply
        .get(index)
        .unwrap_or(0);
    if b_tokens == 0 {
        return 0;
    }
    client.get_reserve(&underlying).to_asset_from_b_token(b_tokens)
}

fn read<V: soroban_sdk::TryFromVal<Env, soroban_sdk::Val>>(env: &Env, key: &DataKey) -> V {
    env.storage()
        .instance()
        .get(key)
        .unwrap_or_else(|| panic_with_error!(env, BlendStrategyError::NotInitialized))
}

fn write_basis(env: &Env, value: i128) {
    env.storage().instance().set(&DataKey::Basis, &value);
}

fn require_vault(env: &Env) -> Address {
    let vault: Address = read(env, &DataKey::Vault);
    vault.require_auth();
    vault
}

fn require_non_negative(env: &Env, amount: i128) {
    if amount < 0 {
        panic_with_error!(env, BlendStrategyError::NegativeAmount);
    }
}
