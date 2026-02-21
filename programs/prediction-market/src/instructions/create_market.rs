use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};
use crate::state::*;

pub fn create_market(
        ctx: Context<CreateMarket>,
        question: String,
        home_team: String,
        away_team: String,
        game_key: String,
        start_time: i64,
        end_time: i64,
        resolution_time: i64,
        oracle_feed: [u8; 32]
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
        market.draw_pool = 0; 
        market.resolved = false;
        market.outcome = None;
        market.is_draw = false;
        market.oracle_feed = oracle_feed;
        market.vault = ctx.accounts.vault.key();
        market.bump = ctx.bumps.market;

        msg!(
        "Market created: {} vs {} | Game key: {}", 
        market.home_team, 
        market.away_team,
        market.game_key
        );

        msg!("Feed hash stored: {:?}", market.oracle_feed);
        Ok(())
    }

#[derive(Accounts)]
#[instruction(game_key: String)]
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

    #[account(
        init,
        payer = authority,
        seeds = [b"vault", market.key().as_ref()],
        bump,
        token::mint = mint,
        token::authority = vault
    )]
    pub vault: Account<'info, TokenAccount>,

    pub mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,

}