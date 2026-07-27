#![no_std]
//! The Nebula vault.
//!
//! Users deposit XLM and receive `nXLM`, a value-accruing claim on the vault. The vault deploys
//! the XLM across registered yield strategies (Blend, Aquarius) and harvests their rewards back
//! into itself. Shares are never rebased; instead each share becomes redeemable for more XLM.
//!
//! # The one invariant that matters
//!
//! ```text
//! total_assets == idle + Σ strategy.deployed
//! ```
//!
//! `total_assets` is *tracked state*, never a live token-balance read. That single choice is what
//! makes the first-depositor "inflation" attack structurally impossible here: a donation sent
//! directly to the vault address does not appear in `total_assets`, so it cannot move the share
//! price. Yield enters the accounting only through `harvest`, and only in the amount the vault
//! measured arriving.

mod error;
mod events;
mod math;
mod storage;

#[cfg(test)]
mod test;

use soroban_sdk::{contract, contractimpl, panic_with_error, token::TokenClient, Address, Env, Vec};

use nebula_interfaces::{ShareTokenClient, StrategyClient};

pub use error::VaultError;
use events::{
    Allocate, Deposit, DepositsPaused, Harvest, StrategyAdded, StrategyRemoved, StrategyUpdated,
    Unwind, Withdraw,
};
use math::{apply_bps, assets_for_shares, checked_add, checked_sub, shares_for_assets};
pub use storage::{Config, Params, StrategyInfo};
use storage::{
    extend_instance, find_strategy, is_initialized, read_config, read_deposits_paused, read_idle,
    read_params, read_strategies, read_total_assets, read_total_shares, write_config,
    write_deposits_paused, write_idle, write_params, write_strategies, write_total_assets,
    write_total_shares, BPS_DENOMINATOR, DEAD_SHARES, MAX_FEE_BPS,
};

/// One whole nXLM in stroops. Used as the denomination for the quoted share price.
const ONE_SHARE: i128 = 10_000_000;

#[contract]
pub struct NebulaVault;

#[contractimpl]
impl NebulaVault {
    #[allow(clippy::too_many_arguments)]
    pub fn __constructor(
        env: Env,
        underlying: Address,
        share_token: Address,
        admin: Address,
        keeper: Address,
        fee_recipient: Address,
        fee_bps: u32,
        reserve_bps: u32,
        deposit_cap: i128,
    ) {
        if is_initialized(&env) {
            panic_with_error!(&env, VaultError::AlreadyInitialized);
        }
        validate_params(&env, fee_bps, reserve_bps);

        // The share token fixes its minter at construction, so the two contracts must be deployed
        // to a matching pair of addresses (see `scripts/deploy.sh`: the vault's address is derived
        // from a salt, the token is constructed against it, then the vault is deployed to it).
        // Verifying the binding here turns a deploy-order mistake into a failed deployment rather
        // than a live vault that can never mint.
        if ShareTokenClient::new(&env, &share_token).minter() != env.current_contract_address() {
            panic_with_error!(&env, VaultError::ShareTokenNotBound);
        }

        write_config(
            &env,
            &Config {
                underlying,
                share_token,
                admin,
                keeper,
                fee_recipient,
            },
        );
        write_params(
            &env,
            &Params {
                fee_bps,
                reserve_bps,
                deposit_cap,
            },
        );
        extend_instance(&env);
    }

    // ---------------------------------------------------------------- user actions

    /// Deposit `amount` of the underlying and receive nXLM. Returns shares minted.
    ///
    /// Deposited funds land in `idle`; deploying them into strategies is a separate keeper
    /// action. Keeping the two apart means a user's deposit never pays the gas for someone
    /// else's rebalance, and a misbehaving strategy cannot fail a deposit.
    pub fn deposit(env: Env, from: Address, amount: i128) -> i128 {
        from.require_auth();
        if amount <= 0 {
            panic_with_error!(&env, VaultError::InvalidAmount);
        }
        if read_deposits_paused(&env) {
            panic_with_error!(&env, VaultError::DepositsPaused);
        }
        extend_instance(&env);

        let config = read_config(&env);
        let params = read_params(&env);
        let total_assets = read_total_assets(&env);
        let total_shares = read_total_shares(&env);

        let new_total_assets = checked_add(&env, total_assets, amount);
        if params.deposit_cap > 0 && new_total_assets > params.deposit_cap {
            panic_with_error!(&env, VaultError::CapExceeded);
        }

        let minted = shares_for_assets(&env, amount, total_assets, total_shares);

        // On the very first deposit a slice of shares is locked in the vault forever, so total
        // supply can never sit at a value small enough for share rounding to be exploitable.
        let (to_user, to_lock) = if total_shares == 0 {
            if minted <= DEAD_SHARES {
                panic_with_error!(&env, VaultError::FirstDepositTooSmall);
            }
            (minted - DEAD_SHARES, DEAD_SHARES)
        } else {
            if minted == 0 {
                panic_with_error!(&env, VaultError::DepositTooSmall);
            }
            (minted, 0)
        };

        TokenClient::new(&env, &config.underlying).transfer(
            &from,
            &env.current_contract_address(),
            &amount,
        );

        let shares = ShareTokenClient::new(&env, &config.share_token);
        shares.mint(&from, &to_user);
        if to_lock > 0 {
            shares.mint(&env.current_contract_address(), &to_lock);
        }

        write_total_assets(&env, new_total_assets);
        write_total_shares(&env, checked_add(&env, total_shares, minted));
        write_idle(&env, checked_add(&env, read_idle(&env), amount));

        Deposit {
            from,
            assets: amount,
            shares: to_user,
            share_price: Self::share_price(env.clone()),
            total_assets: new_total_assets,
        }
        .publish(&env);

        to_user
    }

    /// Burn `shares` and receive the underlying they are worth. Returns the amount returned.
    ///
    /// Served from the idle reserve when possible; otherwise strategies are unwound in registry
    /// order until enough is free. Redemption is never pausable.
    pub fn redeem(env: Env, from: Address, shares: i128) -> i128 {
        from.require_auth();
        if shares <= 0 {
            panic_with_error!(&env, VaultError::InvalidAmount);
        }
        extend_instance(&env);

        let config = read_config(&env);
        let total_assets = read_total_assets(&env);
        let total_shares = read_total_shares(&env);

        let assets = assets_for_shares(&env, shares, total_assets, total_shares);
        if assets == 0 {
            panic_with_error!(&env, VaultError::RedeemTooSmall);
        }

        // Burn first: the caller's claim is extinguished before any value moves out.
        ShareTokenClient::new(&env, &config.share_token).burn(&from, &shares);
        write_total_shares(&env, checked_sub(&env, total_shares, shares));
        write_total_assets(&env, checked_sub(&env, total_assets, assets));

        ensure_idle(&env, assets);
        write_idle(&env, checked_sub(&env, read_idle(&env), assets));

        TokenClient::new(&env, &config.underlying).transfer(
            &env.current_contract_address(),
            &from,
            &assets,
        );

        Withdraw {
            from,
            shares,
            assets,
            share_price: Self::share_price(env.clone()),
            total_assets: read_total_assets(&env),
        }
        .publish(&env);

        assets
    }

    // ---------------------------------------------------------------- keeper actions

    /// Deploy idle underlying above the reserve target into strategies, by weight.
    pub fn allocate(env: Env) {
        let config = read_config(&env);
        config.keeper.require_auth();
        extend_instance(&env);

        let params = read_params(&env);
        let idle = read_idle(&env);
        let target_reserve = apply_bps(&env, read_total_assets(&env), params.reserve_bps);
        if idle <= target_reserve {
            return;
        }
        let deployable = idle - target_reserve;

        let token = TokenClient::new(&env, &config.underlying);
        let mut strategies = read_strategies(&env);
        let mut remaining_idle = idle;

        for index in 0..strategies.len() {
            let mut info = strategies.get_unchecked(index);
            if info.paused || info.weight_bps == 0 {
                continue;
            }

            let mut amount = apply_bps(&env, deployable, info.weight_bps);
            if info.cap > 0 {
                let room = checked_sub(&env, info.cap, info.deployed).max(0);
                amount = amount.min(room);
            }
            amount = amount.min(checked_sub(&env, remaining_idle, target_reserve).max(0));
            if amount <= 0 {
                continue;
            }

            // Push first, then instruct. The strategy never pulls from the vault.
            token.transfer(
                &env.current_contract_address(),
                &info.address,
                &amount,
            );
            StrategyClient::new(&env, &info.address).deposit(&amount);

            info.deployed = checked_add(&env, info.deployed, amount);
            strategies.set(index, info.clone());
            remaining_idle = checked_sub(&env, remaining_idle, amount);

            Allocate {
                strategy: info.address,
                amount,
            }
            .publish(&env);
        }

        write_strategies(&env, &strategies);
        write_idle(&env, remaining_idle);
    }

    /// Claim yield from every strategy, take the protocol fee, credit the rest to share price.
    ///
    /// Returns the net gain added to `total_assets`.
    pub fn harvest(env: Env) -> i128 {
        let config = read_config(&env);
        config.keeper.require_auth();
        extend_instance(&env);

        let params = read_params(&env);
        let token = TokenClient::new(&env, &config.underlying);
        let vault = env.current_contract_address();
        let strategies = read_strategies(&env);

        let mut gross = 0i128;
        for info in strategies.iter() {
            // Trust the measurement, not the report. A strategy that claims a gain it did not
            // deliver would otherwise inflate the share price for free.
            let before = token.balance(&vault);
            let reported = StrategyClient::new(&env, &info.address).harvest();
            let actual = checked_sub(&env, token.balance(&vault), before);
            if reported > actual {
                panic_with_error!(&env, VaultError::StrategyOverreported);
            }
            gross = checked_add(&env, gross, actual);
        }

        if gross == 0 {
            return 0;
        }

        let fee = apply_bps(&env, gross, params.fee_bps);
        let net = checked_sub(&env, gross, fee);

        if fee > 0 {
            token.transfer(&vault, &config.fee_recipient, &fee);
        }

        write_total_assets(&env, checked_add(&env, read_total_assets(&env), net));
        write_idle(&env, checked_add(&env, read_idle(&env), net));

        Harvest {
            gross,
            fee,
            net,
            share_price: Self::share_price(env.clone()),
            total_assets: read_total_assets(&env),
        }
        .publish(&env);

        net
    }

    // ---------------------------------------------------------------- views

    pub fn total_assets(env: Env) -> i128 {
        read_total_assets(&env)
    }

    pub fn total_shares(env: Env) -> i128 {
        read_total_shares(&env)
    }

    pub fn idle(env: Env) -> i128 {
        read_idle(&env)
    }

    /// Underlying redeemable for one whole nXLM, in stroops.
    pub fn share_price(env: Env) -> i128 {
        assets_for_shares(
            &env,
            ONE_SHARE,
            read_total_assets(&env),
            read_total_shares(&env),
        )
    }

    /// Shares a deposit of `amount` would mint right now, net of any dead-share lock.
    pub fn preview_deposit(env: Env, amount: i128) -> i128 {
        let total_shares = read_total_shares(&env);
        let minted = shares_for_assets(&env, amount, read_total_assets(&env), total_shares);
        if total_shares == 0 {
            (minted - DEAD_SHARES).max(0)
        } else {
            minted
        }
    }

    /// Underlying that redeeming `shares` would return right now.
    pub fn preview_redeem(env: Env, shares: i128) -> i128 {
        assets_for_shares(
            &env,
            shares,
            read_total_assets(&env),
            read_total_shares(&env),
        )
    }

    /// Underlying that could be redeemed this instant, from reserve plus liquid strategy capacity.
    pub fn available_liquidity(env: Env) -> i128 {
        let mut available = read_idle(&env);
        for info in read_strategies(&env).iter() {
            let liquid = StrategyClient::new(&env, &info.address)
                .max_withdrawable()
                .min(info.deployed);
            available = checked_add(&env, available, liquid.max(0));
        }
        available
    }

    pub fn config(env: Env) -> Config {
        read_config(&env)
    }

    pub fn params(env: Env) -> Params {
        read_params(&env)
    }

    pub fn strategies(env: Env) -> Vec<StrategyInfo> {
        read_strategies(&env)
    }

    pub fn deposits_paused(env: Env) -> bool {
        read_deposits_paused(&env)
    }

    // ---------------------------------------------------------------- admin

    pub fn add_strategy(env: Env, address: Address, weight_bps: u32, cap: i128) {
        let config = require_admin(&env);
        let mut strategies = read_strategies(&env);

        if find_strategy(&strategies, &address).is_some() {
            panic_with_error!(&env, VaultError::StrategyAlreadyRegistered);
        }
        if StrategyClient::new(&env, &address).underlying() != config.underlying {
            panic_with_error!(&env, VaultError::StrategyAssetMismatch);
        }

        strategies.push_back(StrategyInfo {
            address: address.clone(),
            weight_bps,
            cap,
            paused: false,
            deployed: 0,
        });
        assert_weights_valid(&env, &strategies);
        write_strategies(&env, &strategies);

        StrategyAdded {
            strategy: address,
            weight_bps,
            cap,
        }
        .publish(&env);
    }

    pub fn set_strategy(env: Env, address: Address, weight_bps: u32, cap: i128, paused: bool) {
        require_admin(&env);
        let mut strategies = read_strategies(&env);
        let index = find_strategy(&strategies, &address)
            .unwrap_or_else(|| panic_with_error!(&env, VaultError::StrategyNotFound));

        let mut info = strategies.get_unchecked(index);
        info.weight_bps = weight_bps;
        info.cap = cap;
        info.paused = paused;
        strategies.set(index, info);

        assert_weights_valid(&env, &strategies);
        write_strategies(&env, &strategies);

        StrategyUpdated {
            strategy: address,
            weight_bps,
            cap,
            paused,
        }
        .publish(&env);
    }

    /// Deregister a strategy. It must already be fully unwound.
    pub fn remove_strategy(env: Env, address: Address) {
        require_admin(&env);
        let mut strategies = read_strategies(&env);
        let index = find_strategy(&strategies, &address)
            .unwrap_or_else(|| panic_with_error!(&env, VaultError::StrategyNotFound));

        if strategies.get_unchecked(index).deployed > 0 {
            panic_with_error!(&env, VaultError::StrategyNotEmpty);
        }
        strategies.remove(index);
        write_strategies(&env, &strategies);

        StrategyRemoved {
            strategy: address,
            deployed: 0,
        }
        .publish(&env);
    }

    /// Pull underlying back from a strategy into the reserve. Returns the amount recovered.
    ///
    /// Both roles may call this: the keeper for routine rebalancing, the admin to evacuate a
    /// venue in an emergency. `caller` is explicit so the check is one comparison rather than two
    /// near-identical entry points.
    pub fn unwind(env: Env, caller: Address, address: Address, amount: i128) -> i128 {
        let config = read_config(&env);
        if caller != config.admin && caller != config.keeper {
            panic_with_error!(&env, VaultError::Unauthorized);
        }
        caller.require_auth();
        extend_instance(&env);

        withdraw_from_strategy(&env, &address, amount)
    }

    pub fn set_params(env: Env, fee_bps: u32, reserve_bps: u32, deposit_cap: i128) {
        require_admin(&env);
        validate_params(&env, fee_bps, reserve_bps);
        write_params(
            &env,
            &Params {
                fee_bps,
                reserve_bps,
                deposit_cap,
            },
        );
    }

    /// Halt deposits. Redemptions are deliberately unaffected — a vault that can trap funds is a
    /// custodian, and Nebula is not one.
    pub fn set_deposits_paused(env: Env, paused: bool) {
        require_admin(&env);
        write_deposits_paused(&env, paused);
        DepositsPaused { paused }.publish(&env);
    }

    pub fn set_keeper(env: Env, keeper: Address) {
        let mut config = require_admin(&env);
        config.keeper = keeper;
        write_config(&env, &config);
    }

    pub fn set_admin(env: Env, admin: Address) {
        let mut config = require_admin(&env);
        config.admin = admin;
        write_config(&env, &config);
    }

    /// Sweep tokens that are not part of vault accounting — donations, or an airdrop that landed
    /// on the vault address. Because `total_assets` is tracked rather than measured, these are
    /// invisible to the share price and would otherwise be stranded forever.
    pub fn sweep(env: Env, token: Address, to: Address) -> i128 {
        let config = require_admin(&env);
        let client = TokenClient::new(&env, &token);
        let balance = client.balance(&env.current_contract_address());

        // For the underlying, everything the vault accounts for must stay put.
        let sweepable = if token == config.underlying {
            checked_sub(&env, balance, read_idle(&env)).max(0)
        } else {
            balance
        };

        if sweepable > 0 {
            client.transfer(&env.current_contract_address(), &to, &sweepable);
        }
        sweepable
    }
}

// -------------------------------------------------------------------- internals

fn require_admin(env: &Env) -> Config {
    let config = read_config(env);
    config.admin.require_auth();
    extend_instance(env);
    config
}

fn validate_params(env: &Env, fee_bps: u32, reserve_bps: u32) {
    if fee_bps > MAX_FEE_BPS {
        panic_with_error!(env, VaultError::InvalidFee);
    }
    if reserve_bps > BPS_DENOMINATOR {
        panic_with_error!(env, VaultError::InvalidReserve);
    }
}

fn assert_weights_valid(env: &Env, strategies: &Vec<StrategyInfo>) {
    let mut total = 0u32;
    for info in strategies.iter() {
        total = total.saturating_add(info.weight_bps);
    }
    if total > BPS_DENOMINATOR {
        panic_with_error!(env, VaultError::InvalidWeights);
    }
}

/// Free up enough idle underlying to cover `needed`, unwinding strategies in registry order.
fn ensure_idle(env: &Env, needed: i128) {
    let mut idle = read_idle(env);
    if idle >= needed {
        return;
    }

    let strategies = read_strategies(env);
    for info in strategies.iter() {
        if idle >= needed {
            break;
        }
        let shortfall = needed - idle;

        // Never ask for more than this strategy's cost basis: value above it is unrealized yield
        // that `total_assets` has not recognized, so withdrawing it here would break the
        // `total_assets == idle + Σ deployed` invariant.
        let request = StrategyClient::new(env, &info.address)
            .max_withdrawable()
            .min(info.deployed)
            .min(shortfall);
        if request <= 0 {
            continue;
        }

        idle = checked_add(env, idle, withdraw_from_strategy(env, &info.address, request));
    }

    if idle < needed {
        panic_with_error!(env, VaultError::InsufficientLiquidity);
    }
}

/// Withdraw from one strategy, crediting the measured arrival rather than the reported one.
fn withdraw_from_strategy(env: &Env, address: &Address, amount: i128) -> i128 {
    let config = read_config(env);
    let token = TokenClient::new(env, &config.underlying);
    let vault = env.current_contract_address();

    let mut strategies = read_strategies(env);
    let index = find_strategy(&strategies, address)
        .unwrap_or_else(|| panic_with_error!(env, VaultError::StrategyNotFound));
    let mut info = strategies.get_unchecked(index);

    let request = amount.min(info.deployed);
    if request <= 0 {
        return 0;
    }

    let before = token.balance(&vault);
    let reported = StrategyClient::new(env, address).withdraw(&request);
    let actual = checked_sub(env, token.balance(&vault), before);
    if reported > actual {
        panic_with_error!(env, VaultError::StrategyOverreported);
    }

    info.deployed = checked_sub(env, info.deployed, actual).max(0);
    strategies.set(index, info);
    write_strategies(env, &strategies);
    write_idle(env, checked_add(env, read_idle(env), actual));

    Unwind {
        strategy: address.clone(),
        amount: actual,
    }
    .publish(env);

    actual
}
