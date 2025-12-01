use anchor_lang::prelude::*;
mod state;
mod instructions;

use instructions::*;

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
}

