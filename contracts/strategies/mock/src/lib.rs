#![no_std]
//! A controllable `Strategy` implementation.
//!
//! Two jobs:
//!
//! 1. **Testing.** Real venues cannot be made to yield on demand, go illiquid, or lie about their
//!    returns. This one can, which is how the vault's accounting invariants get exercised.
//! 2. **Fallback.** If Blend's testnet deployment is unavailable during the demo window, this
//!    drops in behind the same trait and the vault does not change. That is the whole point of
//!    putting a trait at the seam.
//!
//! It is never deployed to mainnet.

use nebula_interfaces::Strategy;
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, token::TokenClient,
    Address, Env,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum MockError {
    NotInitialized = 1,
    NegativeAmount = 2,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Underlying,
    Vault,
    /// Cost basis the vault has deployed here.
    Position,
    /// Yield sitting in this contract's balance, waiting to be harvested.
    Pending,
    /// Simulated illiquidity ceiling. `None` means fully liquid.
    LiquidityLimit,
    /// Amount by which `harvest` and `withdraw` overstate what they actually transferred.
    Overreport,
}

#[contract]
pub struct MockStrategy;

#[contractimpl]
impl MockStrategy {
    pub fn __constructor(env: Env, underlying: Address, vault: Address) {
        env.storage().instance().set(&DataKey::Underlying, &underlying);
        env.storage().instance().set(&DataKey::Vault, &vault);
        env.storage().instance().set(&DataKey::Position, &0i128);
        env.storage().instance().set(&DataKey::Pending, &0i128);
        env.storage().instance().set(&DataKey::Overreport, &0i128);
    }

    /// Record yield that has already been transferred into this contract.
    ///
    /// Test-only: mint the underlying to this address first, then call this to make it harvestable.
    pub fn accrue(env: Env, amount: i128) {
        let pending: i128 = read(&env, &DataKey::Pending);
        env.storage()
            .instance()
            .set(&DataKey::Pending, &(pending + amount));
    }

    /// Cap what `max_withdrawable` reports, simulating a venue that cannot be exited in full.
    pub fn set_liquidity_limit(env: Env, limit: i128) {
        env.storage()
            .instance()
            .set(&DataKey::LiquidityLimit, &limit);
    }

    /// Make this strategy lie about its returns by `amount`, to prove the vault catches it.
    pub fn set_overreport(env: Env, amount: i128) {
        env.storage().instance().set(&DataKey::Overreport, &amount);
    }

    /// Destroy `amount` of the position without returning it, simulating a venue loss.
    pub fn simulate_loss(env: Env, amount: i128) {
        let position: i128 = read(&env, &DataKey::Position);
        env.storage()
            .instance()
            .set(&DataKey::Position, &(position - amount).max(0));
    }
}

#[contractimpl]
impl Strategy for MockStrategy {
    fn underlying(env: Env) -> Address {
        read(&env, &DataKey::Underlying)
    }

    fn vault(env: Env) -> Address {
        read(&env, &DataKey::Vault)
    }

    fn deposit(env: Env, amount: i128) {
        require_vault(&env);
        if amount < 0 {
            panic_with_error!(&env, MockError::NegativeAmount);
        }
        let position: i128 = read(&env, &DataKey::Position);
        env.storage()
            .instance()
            .set(&DataKey::Position, &(position + amount));
    }

    fn withdraw(env: Env, amount: i128) -> i128 {
        let vault: Address = require_vault(&env);
        if amount < 0 {
            panic_with_error!(&env, MockError::NegativeAmount);
        }

        let position: i128 = read(&env, &DataKey::Position);
        let sent = amount.min(position).min(Self::max_withdrawable(env.clone()));
        if sent > 0 {
            let underlying: Address = read(&env, &DataKey::Underlying);
            TokenClient::new(&env, &underlying).transfer(
                &env.current_contract_address(),
                &vault,
                &sent,
            );
            env.storage()
                .instance()
                .set(&DataKey::Position, &(position - sent));
        }

        sent + read::<i128>(&env, &DataKey::Overreport)
    }

    fn harvest(env: Env) -> i128 {
        let vault: Address = require_vault(&env);
        let pending: i128 = read(&env, &DataKey::Pending);

        if pending > 0 {
            let underlying: Address = read(&env, &DataKey::Underlying);
            TokenClient::new(&env, &underlying).transfer(
                &env.current_contract_address(),
                &vault,
                &pending,
            );
            env.storage().instance().set(&DataKey::Pending, &0i128);
        }

        pending + read::<i128>(&env, &DataKey::Overreport)
    }

    fn total_assets(env: Env) -> i128 {
        read::<i128>(&env, &DataKey::Position) + read::<i128>(&env, &DataKey::Pending)
    }

    fn max_withdrawable(env: Env) -> i128 {
        let position: i128 = read(&env, &DataKey::Position);
        match env
            .storage()
            .instance()
            .get::<_, i128>(&DataKey::LiquidityLimit)
        {
            Some(limit) => position.min(limit),
            None => position,
        }
    }
}

fn read<V: soroban_sdk::TryFromVal<Env, soroban_sdk::Val>>(env: &Env, key: &DataKey) -> V {
    env.storage()
        .instance()
        .get(key)
        .unwrap_or_else(|| panic_with_error!(env, MockError::NotInitialized))
}

fn require_vault(env: &Env) -> Address {
    let vault: Address = read(env, &DataKey::Vault);
    vault.require_auth();
    vault
}
