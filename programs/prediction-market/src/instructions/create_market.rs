use anchor_lang::prelude::*;

use crate::state::*;
use switchboard_solana::ID as SWITCHBOARD_PROGRAM_ID;

pub fn create_market(
        ctx: Context<CreateMarket>,
        question: String,
        home_team: String,
        away_team: String,
        game_key: String,
        start_time: i64,
        end_time: i64,
        resolution_time: i64,
    ) -> Result<()> {
        let market = &mut ctx.accounts.market;
        market.authority = ctx.accounts.authority.key();
        market.question = question;
        market.home_team = home_team;
        market.away_team = away_team;
        market.game_key = game_key;
        market.start_time = start_time;
        market.end_time = end_time;
        market.resolution_time = resolution_time;
        market.yes_pool = 0; 
        market.no_pool = 0;  
        market.resolved = false;
        market.outcome = None;
        market.is_draw = false;
        market.oracle_feed = ctx.accounts.oracle_feed.key();
        market.bump = ctx.bumps.market;
        Ok(())
    }

#[derive(Accounts)]
#[instruction(question: String, home_team: String, away_team: String, game_key: String)]
pub struct CreateMarket<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Market::INIT_SPACE,
        seeds = [b"market", game_key.as_bytes()],
        bump,
    )]
    pub market: Account<'info, Market>,

    #[account(mut)]
    pub authority: Signer<'info>,

    /// CHECK: Switchboard aggregator account - validated by owner check
    #[account(owner = SWITCHBOARD_PROGRAM_ID)]
    pub oracle_feed: AccountInfo<'info>,

    pub system_program: Program<'info, System>,

}