//! Share-price arithmetic.
//!
//! Every function here rounds **down**. Combined with the direction of each call site — shares
//! minted on deposit round down, underlying returned on redeem rounds down — every rounding
//! error accrues to the vault and therefore to the remaining holders. An off-by-one that favours
//! the caller instead is drainable in a loop, so the direction is load-bearing, not cosmetic.

use soroban_sdk::{panic_with_error, Env};

use crate::error::VaultError;

/// Virtual assets and shares added to both sides of every conversion.
///
/// The primary defence against the first-depositor ("inflation") attack in this vault is that
/// `total_assets` is tracked in contract state and never derived from a live token balance, so a
/// direct donation to the vault address cannot move the share price at all. This offset is a
/// second layer: it keeps the ratio well-defined at zero supply and bounds the damage if a future
/// change ever reintroduces a balance read. It costs nothing, so it stays.
const VIRTUAL_ASSETS: i128 = 1;
const VIRTUAL_SHARES: i128 = 1;

/// Shares minted for a deposit of `assets`. Rounds down.
pub fn shares_for_assets(env: &Env, assets: i128, total_assets: i128, total_shares: i128) -> i128 {
    mul_div_floor(
        env,
        assets,
        checked_add(env, total_shares, VIRTUAL_SHARES),
        checked_add(env, total_assets, VIRTUAL_ASSETS),
    )
}

/// Underlying returned for a redemption of `shares`. Rounds down.
pub fn assets_for_shares(env: &Env, shares: i128, total_assets: i128, total_shares: i128) -> i128 {
    mul_div_floor(
        env,
        shares,
        checked_add(env, total_assets, VIRTUAL_ASSETS),
        checked_add(env, total_shares, VIRTUAL_SHARES),
    )
}

/// `a * b / denominator`, rounding down, trapping on overflow.
///
/// The multiplication happens before the division so precision is not lost to an intermediate
/// truncation. All three inputs are non-negative at every call site, so truncating division is
/// floor division.
fn mul_div_floor(env: &Env, a: i128, b: i128, denominator: i128) -> i128 {
    let product = a
        .checked_mul(b)
        .unwrap_or_else(|| panic_with_error!(env, VaultError::MathOverflow));
    product
        .checked_div(denominator)
        .unwrap_or_else(|| panic_with_error!(env, VaultError::MathOverflow))
}

pub fn checked_add(env: &Env, a: i128, b: i128) -> i128 {
    a.checked_add(b)
        .unwrap_or_else(|| panic_with_error!(env, VaultError::MathOverflow))
}

pub fn checked_sub(env: &Env, a: i128, b: i128) -> i128 {
    a.checked_sub(b)
        .unwrap_or_else(|| panic_with_error!(env, VaultError::MathOverflow))
}

/// `value * bps / 10_000`, rounding down.
pub fn apply_bps(env: &Env, value: i128, bps: u32) -> i128 {
    mul_div_floor(env, value, bps as i128, 10_000)
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::Env;

    #[test]
    fn first_deposit_is_one_to_one() {
        let env = Env::default();
        assert_eq!(shares_for_assets(&env, 1_000, 0, 0), 1_000);
    }

    #[test]
    fn round_trip_never_returns_more_than_deposited() {
        let env = Env::default();
        // A vault that has earned yield: 1_500 assets backing 1_000 shares.
        let (ta, ts) = (1_500_i128, 1_000_i128);

        for deposit in [1_i128, 7, 99, 1_000, 123_456_789] {
            let shares = shares_for_assets(&env, deposit, ta, ts);
            let back = assets_for_shares(&env, shares, ta + deposit, ts + shares);
            assert!(
                back <= deposit,
                "deposit {deposit} round-tripped to {back}, which is more than went in"
            );
        }
    }

    #[test]
    fn yield_raises_the_share_price() {
        let env = Env::default();
        let before = assets_for_shares(&env, 1_000, 1_000, 1_000);
        let after = assets_for_shares(&env, 1_000, 1_100, 1_000);
        assert!(after > before);
    }

    #[test]
    fn donation_cannot_be_simulated_through_the_math() {
        let env = Env::default();
        // Attacker holds 1 share against 1 asset. Even if `total_assets` were somehow inflated to
        // 10^12, the virtual offset keeps a subsequent 10^12 deposit from rounding to zero shares.
        let shares = shares_for_assets(&env, 1_000_000_000_000, 1_000_000_000_000, 1);
        assert!(shares > 0);
    }

    #[test]
    fn apply_bps_rounds_down() {
        let env = Env::default();
        assert_eq!(apply_bps(&env, 10_000, 1_000), 1_000); // 10%
        assert_eq!(apply_bps(&env, 9, 1_000), 0); // 0.9 -> 0
    }
}
