use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum VaultError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    /// Caller holds neither the admin nor the keeper role.
    Unauthorized = 3,
    /// The share token does not name this vault as its minter.
    ShareTokenNotBound = 4,

    /// Amount must be strictly positive.
    InvalidAmount = 10,
    /// The deposit is too small to mint a single share at the current price.
    DepositTooSmall = 11,
    /// The very first deposit must exceed the permanently locked dead shares.
    FirstDepositTooSmall = 12,
    /// Redemption would return zero underlying — the caller would lose their shares for nothing.
    RedeemTooSmall = 13,

    /// Deposits are paused. Redemptions are never pausable.
    DepositsPaused = 20,
    /// Deposit would push total assets past the vault cap.
    CapExceeded = 21,

    /// Strategies could not free enough underlying to satisfy this redemption.
    InsufficientLiquidity = 30,
    StrategyNotFound = 31,
    StrategyAlreadyRegistered = 32,
    /// Strategy's underlying token does not match the vault's.
    StrategyAssetMismatch = 33,
    /// Registered strategy weights must sum to at most 100%.
    InvalidWeights = 34,
    /// Cannot remove a strategy that still holds assets.
    StrategyNotEmpty = 35,
    /// Strategy does not name this vault as its owner, so this vault could not withdraw from it.
    StrategyVaultMismatch = 36,

    /// Fee is expressed in basis points and cannot exceed the configured maximum.
    InvalidFee = 40,
    /// Reserve target is expressed in basis points and cannot exceed 100%.
    InvalidReserve = 41,
    /// The share token is vault accounting, not a stray donation, and cannot be swept.
    SweepProtected = 42,

    /// Arithmetic overflowed. Reaching this means an input was absurd.
    MathOverflow = 50,
    /// A strategy reported a gain it did not actually deliver.
    StrategyOverreported = 51,
}
