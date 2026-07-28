#![cfg(test)]

use nebula_strategy_mock::{MockStrategy, MockStrategyClient};
use nxlm_token::{NxlmToken, NxlmTokenClient};
use soroban_sdk::{
    testutils::{Address as _, MockAuth, MockAuthInvoke},
    token::{StellarAssetClient, TokenClient},
    Address, Env, IntoVal, String,
};

use crate::{NebulaVault, NebulaVaultClient, VaultError};

const XLM: i128 = 10_000_000; // one whole unit in stroops

struct Fixture<'a> {
    env: Env,
    vault: NebulaVaultClient<'a>,
    vault_id: Address,
    shares: NxlmTokenClient<'a>,
    underlying: TokenClient<'a>,
    minter: StellarAssetClient<'a>,
    admin: Address,
    keeper: Address,
    fee_recipient: Address,
}

impl Fixture<'_> {
    fn user_with(&self, amount: i128) -> Address {
        let user = Address::generate(&self.env);
        self.minter.mint(&user, &amount);
        user
    }

    fn new_strategy(&self, weight_bps: u32, cap: i128) -> (Address, MockStrategyClient<'_>) {
        let id = self.env.register(
            MockStrategy,
            (self.underlying.address.clone(), self.vault_id.clone()),
        );
        self.vault.add_strategy(&id, &weight_bps, &cap);
        (id.clone(), MockStrategyClient::new(&self.env, &id))
    }

    /// Simulate a venue earning yield: mint the underlying into the strategy, then tell it the
    /// amount is harvestable.
    fn accrue_yield(&self, strategy: &Address, amount: i128) {
        self.minter.mint(strategy, &amount);
        MockStrategyClient::new(&self.env, strategy).accrue(&amount);
    }

    /// The invariant the whole vault rests on.
    fn assert_invariant(&self) {
        let deployed: i128 = self.vault.strategies().iter().map(|s| s.deployed).sum();
        assert_eq!(
            self.vault.total_assets(),
            self.vault.idle() + deployed,
            "total_assets must equal idle + Σ deployed"
        );
        assert!(
            self.underlying.balance(&self.vault_id) >= self.vault.idle(),
            "vault must hold at least the underlying it claims is idle"
        );
    }
}

fn setup_with(fee_bps: u32, reserve_bps: u32, deposit_cap: i128) -> Fixture<'static> {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let keeper = Address::generate(&env);
    let fee_recipient = Address::generate(&env);
    let issuer = Address::generate(&env);

    let sac = env.register_stellar_asset_contract_v2(issuer);
    let underlying = sac.address();

    // The token binds its minter at construction and the vault verifies that binding, so the
    // vault's address has to exist before the token does. On testnet this is a salted deploy; in
    // tests `register_at` reserves the address directly.
    let vault_id = Address::generate(&env);
    let share_token = env.register(
        NxlmToken,
        (
            vault_id.clone(),
            7_u32,
            String::from_str(&env, "Nebula Staked XLM"),
            String::from_str(&env, "nXLM"),
        ),
    );
    env.register_at(
        &vault_id,
        NebulaVault,
        (
            underlying.clone(),
            share_token.clone(),
            admin.clone(),
            keeper.clone(),
            fee_recipient.clone(),
            fee_bps,
            reserve_bps,
            deposit_cap,
        ),
    );

    Fixture {
        vault: NebulaVaultClient::new(&env, &vault_id),
        shares: NxlmTokenClient::new(&env, &share_token),
        underlying: TokenClient::new(&env, &underlying),
        minter: StellarAssetClient::new(&env, &underlying),
        vault_id,
        admin,
        keeper,
        fee_recipient,
        env,
    }
}

/// No fee, no reserve, no cap — the default for tests that are not about those parameters.
fn setup() -> Fixture<'static> {
    setup_with(0, 0, 0)
}

// ------------------------------------------------------------------ deposit & redeem

#[test]
fn first_deposit_mints_one_to_one_less_dead_shares() {
    let f = setup();
    let user = f.user_with(100 * XLM);

    let minted = f.vault.deposit(&user, &(100 * XLM));

    assert_eq!(minted, 100 * XLM - 1_000, "dead shares are locked in the vault");
    assert_eq!(f.shares.balance(&user), minted);
    assert_eq!(f.shares.balance(&f.vault_id), 1_000);
    assert_eq!(f.vault.total_assets(), 100 * XLM);
    assert_eq!(f.vault.total_shares(), 100 * XLM);
    f.assert_invariant();
}

#[test]
fn deposit_then_redeem_returns_the_deposit() {
    let f = setup();
    let user = f.user_with(100 * XLM);

    let minted = f.vault.deposit(&user, &(100 * XLM));
    let returned = f.vault.redeem(&user, &minted);

    // The only shortfall is the permanently locked dead shares.
    assert!(returned <= 100 * XLM);
    assert!(100 * XLM - returned <= 1_000);
    assert_eq!(f.underlying.balance(&user), returned);
    assert_eq!(f.shares.balance(&user), 0);
    f.assert_invariant();
}

#[test]
fn second_depositor_is_not_diluted() {
    let f = setup();
    let alice = f.user_with(100 * XLM);
    let bob = f.user_with(100 * XLM);

    f.vault.deposit(&alice, &(100 * XLM));
    let bob_shares = f.vault.deposit(&bob, &(100 * XLM));

    // Bob deposited the same amount at an unchanged share price, so he can redeem the same amount.
    assert_eq!(f.vault.preview_redeem(&bob_shares), 100 * XLM);
    f.assert_invariant();
}

#[test]
fn zero_and_negative_deposits_are_rejected() {
    let f = setup();
    let user = f.user_with(100 * XLM);

    assert_eq!(
        f.vault.try_deposit(&user, &0).err().unwrap().unwrap(),
        VaultError::InvalidAmount.into()
    );
    assert_eq!(
        f.vault.try_deposit(&user, &-1).err().unwrap().unwrap(),
        VaultError::InvalidAmount.into()
    );
}

#[test]
fn first_deposit_must_exceed_the_dead_share_lock() {
    let f = setup();
    let user = f.user_with(100 * XLM);

    assert_eq!(
        f.vault.try_deposit(&user, &500).err().unwrap().unwrap(),
        VaultError::FirstDepositTooSmall.into()
    );
}

#[test]
fn redeeming_more_shares_than_held_fails() {
    let f = setup();
    let user = f.user_with(100 * XLM);
    let minted = f.vault.deposit(&user, &(100 * XLM));

    assert!(f.vault.try_redeem(&user, &(minted + 1)).is_err());
}

// ------------------------------------------------------------------ the inflation attack

#[test]
fn donation_cannot_move_the_share_price() {
    let f = setup();
    let attacker = f.user_with(1_000 * XLM);
    let victim = f.user_with(100 * XLM);

    // Classic setup: be first in with dust, then donate a fortune straight to the vault address.
    f.vault.deposit(&attacker, &(1 * XLM));
    let price_before = f.vault.share_price();

    f.underlying
        .transfer(&attacker, &f.vault_id, &(500 * XLM));

    assert_eq!(
        f.vault.share_price(),
        price_before,
        "a direct donation must not touch a share price derived from tracked state"
    );

    // The victim's deposit is therefore priced normally and loses nothing to rounding.
    let victim_shares = f.vault.deposit(&victim, &(100 * XLM));
    assert!(victim_shares > 0);
    assert_eq!(f.vault.preview_redeem(&victim_shares), 100 * XLM);
    f.assert_invariant();
}

#[test]
fn donated_underlying_is_sweepable_not_stranded() {
    let f = setup();
    let donor = f.user_with(50 * XLM);
    let user = f.user_with(100 * XLM);
    f.vault.deposit(&user, &(100 * XLM));

    f.underlying
        .transfer(&donor, &f.vault_id, &(50 * XLM));

    let swept = f.vault.sweep(&f.underlying.address.clone(), &f.admin);

    assert_eq!(swept, 50 * XLM, "only the unaccounted surplus is sweepable");
    assert_eq!(f.underlying.balance(&f.admin), 50 * XLM);
    assert_eq!(f.vault.total_assets(), 100 * XLM);
    f.assert_invariant();
}

// ------------------------------------------------------------------ rounding

#[test]
fn rounding_never_favours_the_redeemer() {
    let f = setup();
    let seed = f.user_with(1_000 * XLM);
    f.vault.deposit(&seed, &(1_000 * XLM));

    // Put the vault at an awkward, non-round share price.
    let (strategy, _) = f.new_strategy(10_000, 0);
    f.vault.allocate();
    f.accrue_yield(&strategy, 333_333_333);
    f.vault.harvest();

    let mut rejected_as_dust = 0;
    for amount in [1_i128, 3, 7, 999, 100_003, 7 * XLM] {
        let user = f.user_with(amount);

        // Below one share's worth the vault must refuse outright rather than accept the deposit
        // and mint nothing — silently swallowing dust is how a vault steals from small users.
        if f.vault.preview_deposit(&amount) == 0 {
            assert_eq!(
                f.vault.try_deposit(&user, &amount).err().unwrap().unwrap(),
                VaultError::DepositTooSmall.into()
            );
            rejected_as_dust += 1;
            continue;
        }

        let minted = f.vault.deposit(&user, &amount);
        let returned = f.vault.redeem(&user, &minted);
        assert!(
            returned <= amount,
            "deposited {amount}, got back {returned} — rounding leaked value to the caller"
        );
    }
    assert!(rejected_as_dust > 0, "the dust branch never ran, so it is untested");
    f.assert_invariant();
}

// ------------------------------------------------------------------ strategies & yield

#[test]
fn allocate_deploys_idle_above_the_reserve_target() {
    let f = setup_with(0, 1_000, 0); // 10% reserve
    let user = f.user_with(1_000 * XLM);
    f.vault.deposit(&user, &(1_000 * XLM));

    let (strategy, client) = f.new_strategy(10_000, 0);
    f.vault.allocate();

    assert_eq!(f.vault.idle(), 100 * XLM, "10% stays back for instant exits");
    assert_eq!(client.total_assets(), 900 * XLM);
    assert_eq!(f.underlying.balance(&strategy), 900 * XLM);
    assert_eq!(f.vault.total_assets(), 1_000 * XLM, "allocating moves value, it does not create it");
    f.assert_invariant();
}

#[test]
fn allocate_splits_by_weight_and_respects_caps() {
    let f = setup_with(0, 0, 0);
    let user = f.user_with(1_000 * XLM);
    f.vault.deposit(&user, &(1_000 * XLM));

    let (_, big) = f.new_strategy(7_000, 0); // 70%, uncapped
    let (_, small) = f.new_strategy(3_000, 50 * XLM); // 30%, capped well below its share

    f.vault.allocate();

    assert_eq!(big.total_assets(), 700 * XLM);
    assert_eq!(small.total_assets(), 50 * XLM, "cap binds before weight");
    assert_eq!(f.vault.idle(), 250 * XLM, "the capped remainder stays idle");
    f.assert_invariant();
}

#[test]
fn paused_strategy_receives_no_allocation() {
    let f = setup();
    let user = f.user_with(1_000 * XLM);
    f.vault.deposit(&user, &(1_000 * XLM));

    let (id, client) = f.new_strategy(10_000, 0);
    f.vault.set_strategy(&id, &10_000, &0, &true);
    f.vault.allocate();

    assert_eq!(client.total_assets(), 0);
    assert_eq!(f.vault.idle(), 1_000 * XLM);
}

#[test]
fn weights_over_one_hundred_percent_are_rejected() {
    let f = setup();
    f.new_strategy(6_000, 0);

    let second = f.env.register(
        MockStrategy,
        (f.underlying.address.clone(), f.vault_id.clone()),
    );
    assert_eq!(
        f.vault
            .try_add_strategy(&second, &5_000, &0)
            .err()
            .unwrap()
            .unwrap(),
        VaultError::InvalidWeights.into()
    );
}

#[test]
fn harvest_raises_the_share_price() {
    let f = setup();
    let user = f.user_with(1_000 * XLM);
    let minted = f.vault.deposit(&user, &(1_000 * XLM));

    let (strategy, _) = f.new_strategy(10_000, 0);
    f.vault.allocate();

    let price_before = f.vault.share_price();
    f.accrue_yield(&strategy, 100 * XLM);
    let net = f.vault.harvest();

    assert_eq!(net, 100 * XLM);
    assert!(f.vault.share_price() > price_before);
    assert_eq!(f.vault.total_assets(), 1_100 * XLM);
    // The depositor's claim grew even though their share balance did not.
    assert_eq!(f.shares.balance(&user), minted);
    assert!(f.vault.preview_redeem(&minted) > 1_000 * XLM - XLM);
    f.assert_invariant();
}

#[test]
fn harvest_takes_the_protocol_fee_off_the_top() {
    let f = setup_with(1_000, 0, 0); // 10% fee
    let user = f.user_with(1_000 * XLM);
    f.vault.deposit(&user, &(1_000 * XLM));

    let (strategy, _) = f.new_strategy(10_000, 0);
    f.vault.allocate();
    f.accrue_yield(&strategy, 100 * XLM);

    let net = f.vault.harvest();

    assert_eq!(net, 90 * XLM);
    assert_eq!(f.underlying.balance(&f.fee_recipient), 10 * XLM);
    assert_eq!(f.vault.total_assets(), 1_090 * XLM);
    f.assert_invariant();
}

#[test]
fn harvest_with_no_yield_is_a_no_op() {
    let f = setup();
    let user = f.user_with(1_000 * XLM);
    f.vault.deposit(&user, &(1_000 * XLM));
    f.new_strategy(10_000, 0);
    f.vault.allocate();

    let before = f.vault.share_price();
    assert_eq!(f.vault.harvest(), 0);
    assert_eq!(f.vault.share_price(), before);
}

#[test]
fn a_strategy_that_overstates_its_yield_is_rejected() {
    let f = setup();
    let user = f.user_with(1_000 * XLM);
    f.vault.deposit(&user, &(1_000 * XLM));

    let (strategy, client) = f.new_strategy(10_000, 0);
    f.vault.allocate();

    // Claim 500 XLM of yield without transferring a stroop.
    client.set_overreport(&(500 * XLM));

    assert_eq!(
        f.vault.try_harvest().err().unwrap().unwrap(),
        VaultError::StrategyOverreported.into(),
        "the vault must trust what arrived, not what it was told"
    );
}

// ------------------------------------------------------------------ liquidity

#[test]
fn redemption_unwinds_strategies_when_the_reserve_is_short() {
    let f = setup_with(0, 0, 0);
    let user = f.user_with(1_000 * XLM);
    let minted = f.vault.deposit(&user, &(1_000 * XLM));

    let (_, client) = f.new_strategy(10_000, 0);
    f.vault.allocate();
    assert_eq!(f.vault.idle(), 0, "everything is deployed");

    let returned = f.vault.redeem(&user, &(minted / 2));

    assert!(returned > 0);
    assert_eq!(f.underlying.balance(&user), returned);
    assert!(client.total_assets() < 1_000 * XLM);
    f.assert_invariant();
}

#[test]
fn redemption_fails_cleanly_when_strategies_are_illiquid() {
    let f = setup_with(0, 0, 0);
    let user = f.user_with(1_000 * XLM);
    let minted = f.vault.deposit(&user, &(1_000 * XLM));

    let (_, client) = f.new_strategy(10_000, 0);
    f.vault.allocate();
    client.set_liquidity_limit(&(10 * XLM)); // venue is stuck

    assert_eq!(
        f.vault.try_redeem(&user, &minted).err().unwrap().unwrap(),
        VaultError::InsufficientLiquidity.into()
    );
    // The failed call must leave the caller's position untouched.
    assert_eq!(f.shares.balance(&user), minted);
    f.assert_invariant();
}

#[test]
fn available_liquidity_reports_reserve_plus_liquid_strategy_capacity() {
    let f = setup_with(0, 2_000, 0); // 20% reserve
    let user = f.user_with(1_000 * XLM);
    f.vault.deposit(&user, &(1_000 * XLM));

    let (_, client) = f.new_strategy(10_000, 0);
    f.vault.allocate();
    client.set_liquidity_limit(&(300 * XLM));

    assert_eq!(f.vault.available_liquidity(), 200 * XLM + 300 * XLM);
}

#[test]
fn unwind_returns_underlying_to_the_reserve() {
    let f = setup_with(0, 0, 0);
    let user = f.user_with(1_000 * XLM);
    f.vault.deposit(&user, &(1_000 * XLM));

    let (strategy, _) = f.new_strategy(10_000, 0);
    f.vault.allocate();

    let recovered = f.vault.unwind(&f.keeper, &strategy, &(400 * XLM));

    assert_eq!(recovered, 400 * XLM);
    assert_eq!(f.vault.idle(), 400 * XLM);
    assert_eq!(f.vault.total_assets(), 1_000 * XLM, "unwinding moves value, it does not create it");
    f.assert_invariant();
}

// ------------------------------------------------------------------ access control

#[test]
fn only_admin_can_add_a_strategy() {
    let env = Env::default();
    let f = setup();
    let stranger = Address::generate(&f.env);
    let strategy = f
        .env
        .register(MockStrategy, (f.underlying.address.clone(), f.vault_id.clone()));
    let _ = env;

    // Authorize the stranger for this exact call — the vault must still refuse, because auth is
    // not the same as authority.
    f.env.set_auths(&[]);
    f.env.mock_auths(&[MockAuth {
        address: &stranger,
        invoke: &MockAuthInvoke {
            contract: &f.vault_id,
            fn_name: "add_strategy",
            args: (strategy.clone(), 5_000_u32, 0_i128).into_val(&f.env),
            sub_invokes: &[],
        },
    }]);

    assert!(f.vault.try_add_strategy(&strategy, &5_000, &0).is_err());
}

#[test]
fn only_admin_or_keeper_can_unwind() {
    let f = setup();
    let user = f.user_with(1_000 * XLM);
    f.vault.deposit(&user, &(1_000 * XLM));
    let (strategy, _) = f.new_strategy(10_000, 0);
    f.vault.allocate();

    let stranger = Address::generate(&f.env);

    assert_eq!(
        f.vault
            .try_unwind(&stranger, &strategy, &(100 * XLM))
            .err()
            .unwrap()
            .unwrap(),
        VaultError::Unauthorized.into()
    );
    // Both privileged roles work.
    assert_eq!(f.vault.unwind(&f.keeper, &strategy, &(100 * XLM)), 100 * XLM);
    assert_eq!(f.vault.unwind(&f.admin, &strategy, &(100 * XLM)), 100 * XLM);
}

#[test]
fn a_strategy_holding_assets_cannot_be_removed() {
    let f = setup();
    let user = f.user_with(1_000 * XLM);
    f.vault.deposit(&user, &(1_000 * XLM));
    let (strategy, _) = f.new_strategy(10_000, 0);
    f.vault.allocate();

    assert_eq!(
        f.vault.try_remove_strategy(&strategy).err().unwrap().unwrap(),
        VaultError::StrategyNotEmpty.into()
    );

    f.vault.unwind(&f.keeper, &strategy, &(1_000 * XLM));
    f.vault.remove_strategy(&strategy);

    assert_eq!(f.vault.strategies().len(), 0);
    f.assert_invariant();
}

#[test]
fn a_strategy_for_the_wrong_asset_is_rejected() {
    let f = setup();
    let other_issuer = Address::generate(&f.env);
    let other_asset = f.env.register_stellar_asset_contract_v2(other_issuer);
    let strategy = f
        .env
        .register(MockStrategy, (other_asset.address(), f.vault_id.clone()));

    assert_eq!(
        f.vault
            .try_add_strategy(&strategy, &5_000, &0)
            .err()
            .unwrap()
            .unwrap(),
        VaultError::StrategyAssetMismatch.into()
    );
}

#[test]
fn a_strategy_bound_to_another_vault_is_rejected() {
    let f = setup();
    let other_vault = Address::generate(&f.env);
    let strategy = f.env.register(
        MockStrategy,
        (f.underlying.address.clone(), other_vault),
    );

    // Registering it would let `allocate` push assets somewhere this vault has no authority to
    // withdraw from — a one-way door discovered at the first redemption that needed the liquidity.
    assert_eq!(
        f.vault
            .try_add_strategy(&strategy, &5_000, &0)
            .err()
            .unwrap()
            .unwrap(),
        VaultError::StrategyVaultMismatch.into()
    );
}

// ------------------------------------------------------------------ strategy losses

#[test]
fn harvest_writes_down_a_strategy_that_lost_value() {
    let f = setup();
    let user = f.user_with(1_000 * XLM);
    f.vault.deposit(&user, &(1_000 * XLM));
    let (strategy, client) = f.new_strategy(10_000, 0);
    f.vault.allocate();

    assert_eq!(f.vault.strategies().get_unchecked(0).deployed, 1_000 * XLM);
    let price_before = f.vault.share_price();

    client.simulate_loss(&(200 * XLM));
    let credited = f.vault.harvest();

    assert_eq!(credited, -(200 * XLM), "harvest reports the drawdown");
    assert_eq!(f.vault.total_assets(), 800 * XLM);
    assert_eq!(f.vault.strategies().get_unchecked(0).deployed, 800 * XLM);
    assert!(
        f.vault.share_price() < price_before,
        "a share is worth less after the venue lost money"
    );
    f.assert_invariant();
}

#[test]
fn a_loss_is_split_across_holders_rather_than_paid_to_whoever_leaves_first() {
    // Half idle, half deployed, so the vault can pay the first redeemer in full out of the reserve
    // if it is quoting a stale price. That is exactly the race being tested.
    let f = setup_with(0, 5_000, 0);
    let alice = f.user_with(1_000 * XLM);
    let bob = f.user_with(1_000 * XLM);

    let alice_shares = f.vault.deposit(&alice, &(1_000 * XLM));
    let bob_shares = f.vault.deposit(&bob, &(1_000 * XLM));

    let (_, client) = f.new_strategy(10_000, 0);
    f.vault.allocate();
    assert_eq!(f.vault.idle(), 1_000 * XLM);

    // The venue loses 20% of everything. Nobody has harvested, so the vault has not been told.
    client.simulate_loss(&(200 * XLM));

    // Alice sprints for the exit before the keeper runs.
    let alice_out = f.vault.redeem(&alice, &alice_shares);
    let bob_out = f.vault.redeem(&bob, &bob_shares);

    assert!(
        alice_out < 1_000 * XLM,
        "redeeming first must not pay out at the pre-loss price"
    );
    // 200 XLM of loss across 2000 XLM of deposits is 10% each, and neither of them can dodge it by
    // being first. The tolerance is share rounding and the dead-share lock, not slippage.
    assert!(
        (alice_out - bob_out).abs() < XLM / 100,
        "alice got {alice_out} and bob got {bob_out}; a loss must land on both equally"
    );
    assert!(alice_out > 890 * XLM && alice_out < 900 * XLM);
    f.assert_invariant();
}

#[test]
fn depositing_after_an_unreported_loss_buys_in_at_the_lowered_price() {
    let f = setup();
    let alice = f.user_with(1_000 * XLM);
    let bob = f.user_with(1_000 * XLM);

    f.vault.deposit(&alice, &(1_000 * XLM));
    let (_, client) = f.new_strategy(10_000, 0);
    f.vault.allocate();

    client.simulate_loss(&(500 * XLM));

    // Without marking first, Bob would pay 1000 for a claim on 500 and hand Alice half of it.
    let bob_shares = f.vault.deposit(&bob, &(1_000 * XLM));

    assert_eq!(f.vault.total_assets(), 1_500 * XLM);
    assert!(
        f.vault.preview_redeem(&bob_shares) > 995 * XLM,
        "bob paid the post-loss price, so his claim is worth what he put in"
    );
    f.assert_invariant();
}

#[test]
fn no_fee_is_charged_on_a_harvest_that_nets_out_negative() {
    let f = setup_with(2_000, 0, 0); // 20% fee
    let user = f.user_with(1_000 * XLM);
    f.vault.deposit(&user, &(1_000 * XLM));
    let (strategy, client) = f.new_strategy(10_000, 0);
    f.vault.allocate();

    // 50 XLM of yield against 200 XLM of losses.
    f.accrue_yield(&strategy, 50 * XLM);
    client.simulate_loss(&(200 * XLM));
    f.vault.harvest();

    assert_eq!(
        f.underlying.balance(&f.fee_recipient),
        0,
        "the protocol does not bill for a period it lost money in"
    );
    f.assert_invariant();
}

#[test]
fn the_share_token_cannot_be_swept() {
    let f = setup();
    let user = f.user_with(100 * XLM);
    f.vault.deposit(&user, &(100 * XLM));

    // The vault's own nXLM is the dead-share lock, not a stray donation.
    assert_eq!(
        f.vault
            .try_sweep(&f.shares.address.clone(), &f.admin)
            .err()
            .unwrap()
            .unwrap(),
        VaultError::SweepProtected.into()
    );
    assert_eq!(f.shares.balance(&f.vault_id), 1_000);
}

// ------------------------------------------------------------------ pause & caps

#[test]
fn pausing_stops_deposits_but_never_redemptions() {
    let f = setup();
    let user = f.user_with(1_000 * XLM);
    let minted = f.vault.deposit(&user, &(500 * XLM));

    f.vault.set_deposits_paused(&true);

    assert_eq!(
        f.vault.try_deposit(&user, &(100 * XLM)).err().unwrap().unwrap(),
        VaultError::DepositsPaused.into()
    );
    // The whole point: a paused vault is not a vault that traps funds.
    assert!(f.vault.redeem(&user, &minted) > 0);
}

#[test]
fn the_deposit_cap_is_enforced() {
    let f = setup_with(0, 0, 500 * XLM);
    let user = f.user_with(1_000 * XLM);

    f.vault.deposit(&user, &(400 * XLM));

    assert_eq!(
        f.vault.try_deposit(&user, &(200 * XLM)).err().unwrap().unwrap(),
        VaultError::CapExceeded.into()
    );
    // Right up to the cap still works.
    f.vault.deposit(&user, &(100 * XLM));
    assert_eq!(f.vault.total_assets(), 500 * XLM);
}

#[test]
fn a_fee_above_the_maximum_is_rejected() {
    let f = setup();
    assert_eq!(
        f.vault.try_set_params(&2_001, &0, &0).err().unwrap().unwrap(),
        VaultError::InvalidFee.into()
    );
    f.vault.set_params(&2_000, &0, &0);
    assert_eq!(f.vault.params().fee_bps, 2_000);
}

// ------------------------------------------------------------------ end to end

#[test]
fn full_lifecycle_across_two_depositors_and_two_harvests() {
    let f = setup_with(1_000, 1_000, 0); // 10% fee, 10% reserve
    let alice = f.user_with(1_000 * XLM);
    let bob = f.user_with(1_000 * XLM);

    let alice_shares = f.vault.deposit(&alice, &(1_000 * XLM));
    let (strategy, _) = f.new_strategy(10_000, 0);
    f.vault.allocate();

    f.accrue_yield(&strategy, 100 * XLM);
    f.vault.harvest();
    f.vault.allocate();

    // Bob joins after the first harvest, so he buys in at the raised price and cannot claim any
    // of the yield that accrued before he arrived.
    let bob_shares = f.vault.deposit(&bob, &(1_000 * XLM));
    assert!(
        bob_shares < alice_shares,
        "the same deposit buys fewer shares once the price has risen"
    );

    f.vault.allocate();
    f.accrue_yield(&strategy, 200 * XLM);
    f.vault.harvest();

    let alice_out = f.vault.redeem(&alice, &alice_shares);
    let bob_out = f.vault.redeem(&bob, &bob_shares);

    assert!(alice_out > 1_000 * XLM, "alice earned two harvests");
    assert!(bob_out > 1_000 * XLM, "bob earned one");
    assert!(
        alice_out > bob_out,
        "alice was in for both harvests and must come out ahead"
    );
    assert!(f.underlying.balance(&f.fee_recipient) > 0);
    f.assert_invariant();
}
