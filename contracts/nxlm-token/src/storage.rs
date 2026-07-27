use soroban_sdk::{contracttype, panic_with_error, Address, Env, String};

use crate::error::TokenError;

const DAY_IN_LEDGERS: u32 = 17_280;

pub(crate) const INSTANCE_BUMP: u32 = 30 * DAY_IN_LEDGERS;
pub(crate) const INSTANCE_THRESHOLD: u32 = INSTANCE_BUMP - DAY_IN_LEDGERS;

pub(crate) const BALANCE_BUMP: u32 = 120 * DAY_IN_LEDGERS;
pub(crate) const BALANCE_THRESHOLD: u32 = BALANCE_BUMP - DAY_IN_LEDGERS;

#[derive(Clone)]
#[contracttype]
pub struct AllowanceKey {
    pub from: Address,
    pub spender: Address,
}

#[derive(Clone)]
#[contracttype]
pub struct AllowanceValue {
    pub amount: i128,
    pub expiration_ledger: u32,
}

#[derive(Clone)]
#[contracttype]
pub struct Metadata {
    pub decimals: u32,
    pub name: String,
    pub symbol: String,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    /// The vault. The only address permitted to mint.
    Minter,
    Metadata,
    Balance(Address),
    Allowance(AllowanceKey),
}

pub(crate) fn extend_instance(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_THRESHOLD, INSTANCE_BUMP);
}

pub(crate) fn is_initialized(env: &Env) -> bool {
    env.storage().instance().has(&DataKey::Minter)
}

pub(crate) fn read_minter(env: &Env) -> Address {
    env.storage()
        .instance()
        .get(&DataKey::Minter)
        .unwrap_or_else(|| panic_with_error!(env, TokenError::NotInitialized))
}

pub(crate) fn write_minter(env: &Env, minter: &Address) {
    env.storage().instance().set(&DataKey::Minter, minter);
}

pub(crate) fn read_metadata(env: &Env) -> Metadata {
    env.storage()
        .instance()
        .get(&DataKey::Metadata)
        .unwrap_or_else(|| panic_with_error!(env, TokenError::NotInitialized))
}

pub(crate) fn write_metadata(env: &Env, metadata: &Metadata) {
    env.storage().instance().set(&DataKey::Metadata, metadata);
}

pub(crate) fn read_balance(env: &Env, addr: &Address) -> i128 {
    let key = DataKey::Balance(addr.clone());
    match env.storage().persistent().get::<_, i128>(&key) {
        Some(balance) => {
            env.storage()
                .persistent()
                .extend_ttl(&key, BALANCE_THRESHOLD, BALANCE_BUMP);
            balance
        }
        None => 0,
    }
}

fn write_balance(env: &Env, addr: &Address, amount: i128) {
    let key = DataKey::Balance(addr.clone());
    env.storage().persistent().set(&key, &amount);
    env.storage()
        .persistent()
        .extend_ttl(&key, BALANCE_THRESHOLD, BALANCE_BUMP);
}

pub(crate) fn receive_balance(env: &Env, addr: &Address, amount: i128) {
    let balance = read_balance(env, addr);
    // `overflow-checks = true` in the release profile makes this a trap rather than a wrap.
    write_balance(env, addr, balance + amount);
}

pub(crate) fn spend_balance(env: &Env, addr: &Address, amount: i128) {
    let balance = read_balance(env, addr);
    if balance < amount {
        panic_with_error!(env, TokenError::InsufficientBalance);
    }
    write_balance(env, addr, balance - amount);
}

/// Reads an allowance, treating an expired one as zero.
pub(crate) fn read_allowance(env: &Env, from: &Address, spender: &Address) -> AllowanceValue {
    let key = DataKey::Allowance(AllowanceKey {
        from: from.clone(),
        spender: spender.clone(),
    });
    match env.storage().temporary().get::<_, AllowanceValue>(&key) {
        Some(allowance) if allowance.expiration_ledger >= env.ledger().sequence() => allowance,
        _ => AllowanceValue {
            amount: 0,
            expiration_ledger: 0,
        },
    }
}

pub(crate) fn write_allowance(
    env: &Env,
    from: &Address,
    spender: &Address,
    amount: i128,
    expiration_ledger: u32,
) {
    if amount > 0 && expiration_ledger < env.ledger().sequence() {
        panic_with_error!(env, TokenError::InvalidExpirationLedger);
    }

    let key = DataKey::Allowance(AllowanceKey {
        from: from.clone(),
        spender: spender.clone(),
    });
    env.storage().temporary().set(
        &key,
        &AllowanceValue {
            amount,
            expiration_ledger,
        },
    );

    // Keep the entry alive exactly as long as the allowance is valid — no longer.
    if amount > 0 {
        let live_for = expiration_ledger
            .checked_sub(env.ledger().sequence())
            .unwrap_or(0);
        env.storage().temporary().extend_ttl(&key, live_for, live_for);
    }
}

pub(crate) fn spend_allowance(env: &Env, from: &Address, spender: &Address, amount: i128) {
    let allowance = read_allowance(env, from, spender);
    if allowance.amount < amount {
        panic_with_error!(env, TokenError::InsufficientAllowance);
    }
    if amount > 0 {
        write_allowance(
            env,
            from,
            spender,
            allowance.amount - amount,
            allowance.expiration_ledger,
        );
    }
}

pub(crate) fn check_non_negative(env: &Env, amount: i128) {
    if amount < 0 {
        panic_with_error!(env, TokenError::NegativeAmount);
    }
}
