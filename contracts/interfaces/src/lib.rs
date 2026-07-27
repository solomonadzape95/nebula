#![no_std]
//! Shared interfaces between Nebula contracts.
//!
//! The `Strategy` trait is the single most important seam in the protocol: the vault only ever
//! talks to a yield venue through these five functions, so adding Blend, Aquarius, or anything
//! else is a new contract rather than a vault change.

use soroban_sdk::{contractclient, Address, Env};

/// A yield venue adapter.
///
/// Every strategy is denominated in the vault's underlying asset (XLM). A strategy never mints,
/// never holds shares, and never knows about `nXLM` — it only takes tokens in, puts them to work,
/// and gives tokens back.
///
/// # Transfer direction
///
/// Deposits are **pushed**, not pulled: the vault transfers the underlying to the strategy and
/// *then* calls `deposit` to tell it to deploy. This avoids relying on allowances or on
/// cross-contract auth subtleties for the hot path, and means a strategy can never move vault
/// funds it was not already given.
///
/// # Invariants every implementation must uphold
///
/// - `deposit` is called only after the vault has already transferred `amount` in.
/// - `withdraw` must return the *actual* amount transferred back, which may be less than
///   requested if the venue is illiquid. It must never report more than it moved.
/// - `harvest` must leave the claimed yield sitting in the vault's balance and return that
///   amount. Returning a number larger than what was transferred inflates the share price and
///   is a direct theft vector, so implementations measure the delta rather than trusting the
///   venue's accounting.
/// - `total_assets` must be non-decreasing except when value is genuinely lost or withdrawn.
/// - `max_withdrawable` must be a lower bound the vault can rely on: if it says 100, a
///   `withdraw(100)` must succeed.
#[contractclient(name = "StrategyClient")]
pub trait Strategy {
    /// Address of the underlying token this strategy accepts.
    fn underlying(env: Env) -> Address;

    /// The vault permitted to call the mutating functions below.
    fn vault(env: Env) -> Address;

    /// Deploy `amount` of the underlying — already transferred in by the vault — into the venue.
    ///
    /// Authorized to the vault only.
    fn deposit(env: Env, amount: i128);

    /// Unwind up to `amount` from the venue and transfer it to the vault.
    ///
    /// Returns the amount actually transferred, which may be less than `amount`.
    /// Authorized to the vault only.
    fn withdraw(env: Env, amount: i128) -> i128;

    /// Claim rewards, convert them to the underlying, and transfer them to the vault.
    ///
    /// Returns the amount of underlying gained. Authorized to the vault only.
    fn harvest(env: Env) -> i128;

    /// Current value of this strategy's position, denominated in the underlying.
    fn total_assets(env: Env) -> i128;

    /// How much the vault could withdraw right now without the call failing.
    fn max_withdrawable(env: Env) -> i128;
}

/// The subset of the share token the vault needs.
///
/// Declared here rather than importing the token crate so the vault depends on an interface
/// instead of an implementation — the share token can be swapped for any SEP-41 token that lets
/// the vault mint.
#[contractclient(name = "ShareTokenClient")]
pub trait ShareToken {
    fn mint(env: Env, to: Address, amount: i128);
    fn burn(env: Env, from: Address, amount: i128);
    fn balance(env: Env, id: Address) -> i128;
    /// The sole address permitted to mint. The vault checks this names itself before accepting
    /// a share token, so a mismatched deploy fails loudly instead of silently.
    fn minter(env: Env) -> Address;
}
