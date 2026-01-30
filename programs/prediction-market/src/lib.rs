#![allow(unexpected_cfgs)] // Allow Solana-specific cfg values emitted by Anchor macros

use anchor_lang::prelude::*;
mod state;
mod instructions;
mod errors;

use instructions::*;
pub use errors::*;

declare_id!("HjX8LkQdV4RMmvzbsxkkszNCX5tVDRdd2hp8xk1RKcJ1");

#[program]
pub mod prediction_market {
    use super::*;

    pub fn create_football_market(
        ctx: Context<CreateMarket>, 
        question: String,
        home_team: String,
        away_team: String,
        game_key: String,
        start_time: i64,
        end_time: i64,
        resolution_time: i64
    ) -> Result<()> {
        create_market(ctx, question, home_team, away_team, game_key, start_time, end_time, resolution_time)
    }

    pub fn place_bet_on_market(
        ctx: Context<PlaceBet>,
        amount: u64,
        bet_home_wins: bool
    ) -> Result<()> {
        place_bet(ctx, amount, bet_home_wins)
    }

    pub fn resolve_market(
        ctx: Context<ResolveMarket>
    ) -> Result<()> {
        resolve_with_switchboard_oracle(ctx)
    }

    pub fn claim_winnings_from_market(
        ctx: Context<ClaimWinnings>
    ) -> Result<()> {
        claim_winnings(ctx)
    }
    pub fn collect_fees_from_market(
        ctx: Context<CollectFees>
    ) -> Result<()> {
        collect_fees(ctx)
    }
    pub fn update_feed(
        ctx: Context<UpdateOracleFeed>
    ) -> Result<()> {
        update_oracle_feed(ctx)
    }
}

