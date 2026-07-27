use soroban_sdk::{contracttype, panic_with_error, Address, Env, Vec};

use crate::error::VaultError;

const DAY_IN_LEDGERS: u32 = 17_280;
pub(crate) const INSTANCE_BUMP: u32 = 30 * DAY_IN_LEDGERS;
pub(crate) const INSTANCE_THRESHOLD: u32 = INSTANCE_BUMP - DAY_IN_LEDGERS;

/// Shares minted to the vault itself on the first deposit and never redeemable.
///
/// With `total_assets` tracked in state, the classic first-depositor attack is already
/// impossible; this makes total supply structurally unable to sit at 1, which is the precondition
/// for every share-rounding exploit. 1000 stroops = 0.0001 XLM — an immaterial cost paid once.
pub(crate) const DEAD_SHARES: i128 = 1_000;

pub(crate) const MAX_FEE_BPS: u32 = 2_000; // 20%
pub(crate) const BPS_DENOMINATOR: u32 = 10_000;

#[derive(Clone)]
#[contracttype]
pub struct Config {
    /// The asset users deposit — XLM via its Stellar Asset Contract.
    pub underlying: Address,
    /// The nXLM share token. This vault is its sole minter.
    pub share_token: Address,
    /// Multisig with authority over strategies and parameters.
    pub admin: Address,
    /// Permitted to call `allocate` and `harvest`. Operationally hot, economically powerless.
    pub keeper: Address,
    /// Receives the protocol fee taken from harvested yield.
    pub fee_recipient: Address,
}

#[derive(Clone)]
#[contracttype]
pub struct Params {
    /// Protocol fee on harvested yield, in basis points.
    pub fee_bps: u32,
    /// Share of total assets held idle for instant redemptions, in basis points.
    pub reserve_bps: u32,
    /// Hard ceiling on total assets. Bounds blast radius during beta. 0 means uncapped.
    pub deposit_cap: i128,
}

/// A registered yield venue.
///
/// The registry lives inside the vault rather than in its own contract: the vault is its only
/// consumer, and a separate contract would add a cross-contract call to every deposit and harvest
/// plus a second upgrade boundary to audit, in exchange for no capability the vault admin does not
/// already have.
#[derive(Clone)]
#[contracttype]
pub struct StrategyInfo {
    pub address: Address,
    /// Target share of deployable assets, in basis points.
    pub weight_bps: u32,
    /// Maximum underlying this strategy may hold. Bounds the blast radius of a single venue.
    pub cap: i128,
    /// Paused strategies receive no new allocations but can still be withdrawn from.
    pub paused: bool,
    /// Underlying the vault has sent here, less what has come back. Cost basis, not market value.
    pub deployed: i128,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Config,
    Params,
    /// Total underlying the vault accounts for: idle + deployed + realized yield.
    TotalAssets,
    /// Total nXLM in existence, including dead shares.
    TotalShares,
    /// Underlying sitting in the vault, available for instant redemption.
    Idle,
    Strategies,
    DepositsPaused,
}

pub(crate) fn extend_instance(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_THRESHOLD, INSTANCE_BUMP);
}

pub(crate) fn is_initialized(env: &Env) -> bool {
    env.storage().instance().has(&DataKey::Config)
}

fn get_or_panic<V: soroban_sdk::TryFromVal<Env, soroban_sdk::Val>>(env: &Env, key: &DataKey) -> V {
    env.storage()
        .instance()
        .get(key)
        .unwrap_or_else(|| panic_with_error!(env, VaultError::NotInitialized))
}

pub(crate) fn read_config(env: &Env) -> Config {
    get_or_panic(env, &DataKey::Config)
}

pub(crate) fn write_config(env: &Env, config: &Config) {
    env.storage().instance().set(&DataKey::Config, config);
}

pub(crate) fn read_params(env: &Env) -> Params {
    get_or_panic(env, &DataKey::Params)
}

pub(crate) fn write_params(env: &Env, params: &Params) {
    env.storage().instance().set(&DataKey::Params, params);
}

pub(crate) fn read_total_assets(env: &Env) -> i128 {
    env.storage()
        .instance()
        .get(&DataKey::TotalAssets)
        .unwrap_or(0)
}

pub(crate) fn write_total_assets(env: &Env, value: i128) {
    env.storage().instance().set(&DataKey::TotalAssets, &value);
}

pub(crate) fn read_total_shares(env: &Env) -> i128 {
    env.storage()
        .instance()
        .get(&DataKey::TotalShares)
        .unwrap_or(0)
}

pub(crate) fn write_total_shares(env: &Env, value: i128) {
    env.storage().instance().set(&DataKey::TotalShares, &value);
}

pub(crate) fn read_idle(env: &Env) -> i128 {
    env.storage().instance().get(&DataKey::Idle).unwrap_or(0)
}

pub(crate) fn write_idle(env: &Env, value: i128) {
    env.storage().instance().set(&DataKey::Idle, &value);
}

pub(crate) fn read_strategies(env: &Env) -> Vec<StrategyInfo> {
    env.storage()
        .instance()
        .get(&DataKey::Strategies)
        .unwrap_or_else(|| Vec::new(env))
}

pub(crate) fn write_strategies(env: &Env, strategies: &Vec<StrategyInfo>) {
    env.storage().instance().set(&DataKey::Strategies, strategies);
}

pub(crate) fn read_deposits_paused(env: &Env) -> bool {
    env.storage()
        .instance()
        .get(&DataKey::DepositsPaused)
        .unwrap_or(false)
}

pub(crate) fn write_deposits_paused(env: &Env, paused: bool) {
    env.storage()
        .instance()
        .set(&DataKey::DepositsPaused, &paused);
}

/// Index of a strategy in the registry, or `None`.
pub(crate) fn find_strategy(strategies: &Vec<StrategyInfo>, address: &Address) -> Option<u32> {
    for (index, info) in strategies.iter().enumerate() {
        if &info.address == address {
            return Some(index as u32);
        }
    }
    None
}
