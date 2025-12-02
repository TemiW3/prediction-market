use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount, Transfer, transfer};
use crate::state::*;
use crate::errors::*;


pub fn place_bet(ctx: Context<PlaceBet>, amount:u64, bet_home_wins: bool) -> Result <()> {
    let clock = Clock::get()?;
    require!(clock.unix_timestamp < ctx.accounts.market.start_time, PredictionMarketError::MarketAlreadyStarted);
    require!(!ctx.accounts.market.resolved, PredictionMarketError::MarketAlreadyResolved);

    let cpi_accounts = Transfer {
        from: ctx.accounts.user_token_account.to_account_info(),
        to: ctx.accounts.market_vault.to_account_info(),
        authority: ctx.accounts.user.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    transfer(cpi_ctx, amount)?;

    let market = &mut ctx.accounts.market;
    if bet_home_wins {
        market.yes_pool = market.yes_pool.checked_add(amount).unwrap();
    } else {
        market.no_pool = market.no_pool.checked_add(amount).unwrap(); 
    }

    let position = &mut ctx.accounts.position;
    if position.user == Pubkey::default() {
        position.user = ctx.accounts.user.key();
        position.market = ctx.accounts.market.key();
        position.yes_amount = 0;
        position.no_amount = 0;
        position.bump = ctx.bumps.position;
    }

    if bet_home_wins {
        position.yes_amount = position.yes_amount.checked_add(amount).unwrap();
    } else {
        position.no_amount = position.no_amount.checked_add(amount).unwrap();
    }

    Ok(())
}

#[derive(Accounts)]
pub struct PlaceBet<'info>{
    #[account(mut)]
    pub market: Account<'info, Market>,

    #[account(
        init_if_needed,
        payer = user,
        space = 8 + Position::INIT_SPACE,
        seeds = [b"position", market.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub position: Account<'info, Position>,

    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"vault", market.key().as_ref()],
        bump,
        constraint = market_vault.key() == market.vault @ PredictionMarketError::InvalidVault
    )]
    pub market_vault: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>
}