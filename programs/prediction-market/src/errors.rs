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
}
