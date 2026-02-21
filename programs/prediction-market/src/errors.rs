use anchor_lang::prelude::*;

#[error_code]
pub enum PredictionMarketError {
    #[msg("Market has already started")]
    MarketAlreadyStarted,
    #[msg("Market has already been resolved")]
    MarketAlreadyResolved,
    #[msg("Invalid vault for this market")]
    InvalidVault,
    #[msg("Invalid oracle feed for this market")]
    InvalidFeed,
    #[msg("Too early to resolve the market")]
    TooEarlyToResolve,
    #[msg("Math operation overflowed")]
    MathOverflow,
    #[msg("Match is not finished yet according to the oracle")]
    MatchNotFinished,
    #[msg("Market is not yet resolved")]
    MarketNotResolved,
    #[msg("No winnings to claim")]
    NoWinningsToClaim,
    #[msg("Unauthorized to resolve this market")]
    UnauthorizedResolver,
    #[msg("Unauthorized to update the oracle feed")]
    UnauthorizedUpdater,
    #[msg("Unauthorized to collect fees")]
    UnauthorizedFeeCollector,
    #[msg("No fees to collect")]
    NoFeesToCollect,
    #[msg("Invalid oracle value")]
    InvalidOracleValue,
    #[msg("Invalid amount")]
    InvalidAmount,
}
