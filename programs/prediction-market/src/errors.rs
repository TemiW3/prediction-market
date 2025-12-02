use anchor_lang::prelude::*;

#[error_code]
pub enum PredictionMarketError {
    #[msg("Market has already started")]
    MarketAlreadyStarted,
    #[msg("Market has already been resolved")]
    MarketAlreadyResolved,
    #[msg("Invalid vault for this market")]
    InvalidVault,
}
