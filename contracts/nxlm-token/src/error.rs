use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum TokenError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    /// Amounts are always non-negative; a negative amount is a caller bug, not a valid operation.
    NegativeAmount = 3,
    InsufficientBalance = 4,
    InsufficientAllowance = 5,
    /// An allowance may not be set to expire in the past.
    InvalidExpirationLedger = 6,
    /// Caller is not the minter (the vault).
    NotMinter = 7,
}
