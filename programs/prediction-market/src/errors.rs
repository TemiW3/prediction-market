use anchor_lang::prelude::*;

#[error_code]
pub enum PredictionMarketError {
    #[msg("Market has already started")]
    MarketAlreadyStarted,
    #[msg("Market has already been resolved")]
    MarketAlreadyResolved,
    #[msg("Invalid vault for this market")]
    InvalidVault,
    #[msg("Invalid position owner for this position account")]
    InvalidPositionOwner,
    #[msg("Invalid position market linkage")]
    InvalidPositionMarket,
    #[msg("Invalid token account owner")]
    InvalidTokenAccountOwner,
    #[msg("Invalid token mint for this operation")]
    InvalidTokenMint,
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
    #[msg("Unauthorized to collect fees")]
    UnauthorizedFeeCollector,
    #[msg("No fees to collect")]
    NoFeesToCollect,
    #[msg("Invalid oracle value")]
    InvalidOracleValue,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Unauthorized to resolve this market")]
    UnauthorizedResolver,
}
