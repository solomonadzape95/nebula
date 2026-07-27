//! Typed contract events.
//!
//! These are the vault's public data feed: the indexer ingests them to reconstruct TVL, share
//! price history, and the depositor set without replaying contract state. Every field the
//! dashboard needs should be here, because an event that omits a field cannot be backfilled.

use soroban_sdk::{contractevent, Address};

#[contractevent(topics = ["deposit"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Deposit {
    #[topic]
    pub from: Address,
    pub assets: i128,
    pub shares: i128,
    /// Share price after the deposit, in underlying per whole share. Lets the indexer build the
    /// price series from events alone.
    pub share_price: i128,
    pub total_assets: i128,
}

#[contractevent(topics = ["withdraw"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Withdraw {
    #[topic]
    pub from: Address,
    pub shares: i128,
    pub assets: i128,
    pub share_price: i128,
    pub total_assets: i128,
}

#[contractevent(topics = ["harvest"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Harvest {
    /// Underlying that actually arrived from strategies.
    pub gross: i128,
    pub fee: i128,
    /// Gross less fee — the amount credited to share price.
    pub net: i128,
    pub share_price: i128,
    pub total_assets: i128,
}

#[contractevent(topics = ["allocate"], data_format = "single-value")]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Allocate {
    #[topic]
    pub strategy: Address,
    pub amount: i128,
}

#[contractevent(topics = ["unwind"], data_format = "single-value")]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Unwind {
    #[topic]
    pub strategy: Address,
    pub amount: i128,
}

#[contractevent(topics = ["strategy_added"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct StrategyAdded {
    #[topic]
    pub strategy: Address,
    pub weight_bps: u32,
    pub cap: i128,
}

#[contractevent(topics = ["strategy_updated"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct StrategyUpdated {
    #[topic]
    pub strategy: Address,
    pub weight_bps: u32,
    pub cap: i128,
    pub paused: bool,
}

#[contractevent(topics = ["strategy_removed"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct StrategyRemoved {
    #[topic]
    pub strategy: Address,
    /// Cost basis at removal. Always zero — a strategy holding assets cannot be removed — but
    /// recorded so the indexer never has to infer it.
    pub deployed: i128,
}

#[contractevent(topics = ["deposits_paused"], data_format = "single-value")]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DepositsPaused {
    pub paused: bool,
}
