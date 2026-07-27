//! Blend pool interface, mirrored locally.
//!
//! Blend publishes `blend-contract-sdk`, but it pins `soroban-sdk 25` and Nebula is on 26 — two
//! major versions of the SDK cannot be linked into one contract. Mirroring the handful of types
//! this adapter actually touches costs a page of code and removes a hard version coupling to
//! Blend's release cadence.
//!
//! Struct field *names* and types must match Blend's exactly, because `contracttype` encodes to an
//! XDR map keyed by field name. Field order does not matter. Verified against
//! `blend-capital/blend-contracts-v2` at `pool/src/{contract,storage}.rs` and
//! `pool/src/pool/{actions,user,reserve}.rs`.

use soroban_sdk::{contractclient, contracttype, Address, Env, Map, Vec};

/// Fixed-point scalar for `b_rate` and `d_rate`: both carry 12 decimals.
pub const SCALAR_12: i128 = 1_000_000_000_000;

/// `RequestType::Supply` — supply without using the position as collateral.
///
/// Nebula never borrows, so it deliberately uses plain supply rather than `SupplyCollateral`.
/// A non-collateral position has no health factor, cannot be liquidated, and can always be
/// withdrawn as long as the pool holds cash.
pub const REQUEST_SUPPLY: u32 = 0;

/// `RequestType::Withdraw`.
pub const REQUEST_WITHDRAW: u32 = 1;

#[derive(Clone)]
#[contracttype]
pub struct Request {
    pub request_type: u32,
    pub address: Address,
    pub amount: i128,
}

#[derive(Clone)]
#[contracttype]
pub struct Positions {
    /// Reserve index -> liability share balance.
    pub liabilities: Map<u32, i128>,
    /// Reserve index -> collateral supply share balance.
    pub collateral: Map<u32, i128>,
    /// Reserve index -> non-collateral supply share balance. This is where Nebula's position sits.
    pub supply: Map<u32, i128>,
}

#[derive(Clone)]
#[contracttype]
pub struct ReserveConfig {
    pub index: u32,
    pub decimals: u32,
    pub c_factor: u32,
    pub l_factor: u32,
    pub util: u32,
    pub max_util: u32,
    pub r_base: u32,
    pub r_one: u32,
    pub r_two: u32,
    pub r_three: u32,
    pub reactivity: u32,
    pub supply_cap: i128,
    pub enabled: bool,
}

#[derive(Clone)]
#[contracttype]
pub struct ReserveData {
    pub d_rate: i128,
    /// bToken -> underlying conversion rate, 12 decimals. This is where the interest lives.
    pub b_rate: i128,
    pub ir_mod: i128,
    pub b_supply: i128,
    pub d_supply: i128,
    pub backstop_credit: i128,
    pub last_time: u64,
}

#[derive(Clone)]
#[contracttype]
pub struct Reserve {
    pub asset: Address,
    pub config: ReserveConfig,
    pub data: ReserveData,
    pub scalar: i128,
}

impl Reserve {
    /// Value `b_tokens` in the underlying asset. Rounds down, matching Blend's own
    /// `to_asset_from_b_token`, so this never overstates the position.
    pub fn to_asset_from_b_token(&self, b_tokens: i128) -> i128 {
        b_tokens
            .checked_mul(self.data.b_rate)
            .map(|scaled| scaled / SCALAR_12)
            .unwrap_or(i128::MAX)
    }
}

#[contractclient(name = "BlendPoolClient")]
pub trait BlendPool {
    fn get_reserve(env: Env, asset: Address) -> Reserve;

    fn get_positions(env: Env, address: Address) -> Positions;

    /// Modify `from`'s position. `spender` sends tokens to the pool via a direct transfer, so the
    /// spender must have authorized the pool's token move.
    fn submit(
        env: Env,
        from: Address,
        spender: Address,
        to: Address,
        requests: Vec<Request>,
    ) -> Positions;

    /// As `submit`, but the pool pulls incoming tokens with `transfer_from` against an allowance.
    ///
    /// This is the variant the adapter uses for supplying. A contract is automatically authorized
    /// for calls it makes *directly*, but not for a token move made two frames down by the pool —
    /// that would need `authorize_as_current_contract`. Granting an allowance first sidesteps the
    /// problem entirely, because the strategy calls `approve` on the token itself.
    fn submit_with_allowance(
        env: Env,
        from: Address,
        spender: Address,
        to: Address,
        requests: Vec<Request>,
    ) -> Positions;

    /// Claim BLND emissions for the given reserve token ids, sending them to `to`.
    fn claim(env: Env, from: Address, reserve_token_ids: Vec<u32>, to: Address) -> i128;
}

/// Emission token id for a reserve's bToken (the supply side).
///
/// Blend indexes emission tokens as `reserve_index * 2` for the dToken (borrow side) and
/// `reserve_index * 2 + 1` for the bToken (supply side).
pub fn b_token_emission_id(reserve_index: u32) -> u32 {
    reserve_index * 2 + 1
}
