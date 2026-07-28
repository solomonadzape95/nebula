#![no_std]
//! `nXLM` — the value-accruing receipt token for the Nebula vault.
//!
//! This is a plain SEP-41 token. It deliberately knows nothing about yield, share price, or
//! strategies: it is a claim on the vault, and the vault alone decides what a claim is worth.
//! Keeping the accounting out of the token is what lets `nXLM` be a *value-accruing* rather than
//! a rebasing token — balances only ever change on an explicit transfer, mint, or burn, so every
//! integrating protocol can treat it as an ordinary token.

mod error;
mod events;
mod storage;

#[cfg(test)]
mod test;

use soroban_sdk::{
    contract, contractimpl, panic_with_error, token::TokenInterface, Address, Env, MuxedAddress,
    String,
};

pub use error::TokenError;
use events::{Approve, Burn, Mint, Transfer};
use storage::{
    check_non_negative, extend_instance, is_initialized, read_allowance, read_balance,
    read_metadata, read_minter, receive_balance, spend_allowance, spend_balance, write_allowance,
    write_metadata, write_minter, Metadata,
};

#[contract]
pub struct NxlmToken;

#[contractimpl]
impl NxlmToken {
    /// One-time setup. `minter` is the vault address and is immutable thereafter.
    ///
    /// The minter is fixed at construction on purpose: a rotatable minter is an admin key that
    /// can print unbacked `nXLM`, which is the single largest trust assumption a vault token can
    /// carry. Fixing it means holders only need to trust the vault contract, not an operator.
    pub fn __constructor(env: Env, minter: Address, decimals: u32, name: String, symbol: String) {
        if is_initialized(&env) {
            panic_with_error!(&env, TokenError::AlreadyInitialized);
        }
        write_minter(&env, &minter);
        write_metadata(
            &env,
            &Metadata {
                decimals,
                name,
                symbol,
            },
        );
        extend_instance(&env);
    }

    /// Mint new shares. Vault only.
    pub fn mint(env: Env, to: Address, amount: i128) {
        check_non_negative(&env, amount);
        let minter = read_minter(&env);
        minter.require_auth();

        extend_instance(&env);
        receive_balance(&env, &to, amount);

        Mint { to, amount }.publish(&env);
    }

    /// The address permitted to mint — the Nebula vault.
    ///
    /// Total supply is deliberately *not* tracked here. The vault is the only thing that can
    /// change it, so it owns that number; a second copy in the token could only ever drift.
    pub fn minter(env: Env) -> Address {
        read_minter(&env)
    }
}

#[contractimpl]
impl TokenInterface for NxlmToken {
    fn allowance(env: Env, from: Address, spender: Address) -> i128 {
        extend_instance(&env);
        read_allowance(&env, &from, &spender).amount
    }

    fn approve(env: Env, from: Address, spender: Address, amount: i128, expiration_ledger: u32) {
        from.require_auth();
        check_non_negative(&env, amount);

        extend_instance(&env);
        write_allowance(&env, &from, &spender, amount, expiration_ledger);

        Approve {
            from,
            spender,
            amount,
            expiration_ledger,
        }
        .publish(&env);
    }

    fn balance(env: Env, id: Address) -> i128 {
        extend_instance(&env);
        read_balance(&env, &id)
    }

    /// `to` is a [`MuxedAddress`] so that custodial integrators can address a sub-account. The
    /// balance is always credited to the underlying Stellar address; the multiplexing id is
    /// routing metadata for the recipient, not a distinct ledger entry.
    fn transfer(env: Env, from: Address, to: MuxedAddress, amount: i128) {
        from.require_auth();
        check_non_negative(&env, amount);

        let to = to.address();
        extend_instance(&env);
        spend_balance(&env, &from, amount);
        receive_balance(&env, &to, amount);

        Transfer { from, to, amount }.publish(&env);
    }

    fn transfer_from(env: Env, spender: Address, from: Address, to: Address, amount: i128) {
        spender.require_auth();
        check_non_negative(&env, amount);

        extend_instance(&env);
        spend_allowance(&env, &from, &spender, amount);
        spend_balance(&env, &from, amount);
        receive_balance(&env, &to, amount);

        Transfer { from, to, amount }.publish(&env);
    }

    /// Destroy shares. Requires the holder's authorisation *and* the vault's.
    ///
    /// The second requirement is a deliberate departure from plain SEP-41. nXLM is a receipt: the
    /// vault's `total_shares` is the only record of how many exist, and it is written inside
    /// `redeem`. A burn that bypassed the vault would leave that number too high forever, so every
    /// remaining holder would be quoted a share price below what the vault can actually pay, and
    /// the underlying behind the destroyed shares would be unreachable by anyone — including the
    /// person who burned them. Requiring the minter means the only way to destroy a share is the
    /// path that also hands back what it was worth.
    fn burn(env: Env, from: Address, amount: i128) {
        from.require_auth();
        read_minter(&env).require_auth();
        check_non_negative(&env, amount);

        extend_instance(&env);
        spend_balance(&env, &from, amount);

        Burn { from, amount }.publish(&env);
    }

    /// Burn against an allowance. Gated on the vault for the same reason as [`Self::burn`], which
    /// leaves it unreachable in practice: the vault redeems from `from` directly and never spends
    /// an allowance. It stays implemented rather than panicking so the token still satisfies the
    /// interface every SEP-41 integrator compiles against.
    fn burn_from(env: Env, spender: Address, from: Address, amount: i128) {
        spender.require_auth();
        read_minter(&env).require_auth();
        check_non_negative(&env, amount);

        extend_instance(&env);
        spend_allowance(&env, &from, &spender, amount);
        spend_balance(&env, &from, amount);

        Burn { from, amount }.publish(&env);
    }

    fn decimals(env: Env) -> u32 {
        read_metadata(&env).decimals
    }

    fn name(env: Env) -> String {
        read_metadata(&env).name
    }

    fn symbol(env: Env) -> String {
        read_metadata(&env).symbol
    }
}
