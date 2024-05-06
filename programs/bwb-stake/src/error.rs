use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Protocol paused")]
    ProtocolPaused,
    #[msg["Pool is paused"]]
    PoolPaused,
    #[msg("Amount over balance")]
    AmountOverBalance,
    #[msg["Invalid order id"]]
    InvalidOrderId,
    #[msg["Not reach unstake time"]]
    NotMatchStakeDays,
    #[msg["Invalid admin"]]
    InvalidAdmin,
    #[msg["Not visible stake amount"]]
    NotVisibleStakeAmount,
    #[msg["Not stake time"]]
    NotStakeTime,
    #[msg["Reward exceed"]]
    RewardExceed,
    #[msg["Not start claim reward"]]
    NotStartClaimReward,
    #[msg("Arithmetic Error (overflow/underflow)")]
    ArithmeticError,
    #[msg("Not reach unstake time")]
    NotReachUnstakeTime
}
