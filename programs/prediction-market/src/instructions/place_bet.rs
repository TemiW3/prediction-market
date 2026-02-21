use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount, Transfer, transfer};
use crate::state::*;
use crate::errors::*;


pub fn place_bet(ctx: Context<PlaceBet>, amount: u64, bet_type: BetType) -> Result<()> {
    let clock = Clock::get()?;
    require!(
        clock.unix_timestamp < ctx.accounts.market.start_time, 
        PredictionMarketError::MarketAlreadyStarted
    );
    require!(
        !ctx.accounts.market.resolved, 
        PredictionMarketError::MarketAlreadyResolved
    );
    require!(amount > 0, PredictionMarketError::InvalidAmount);

    const FEE_BASIS_POINTS: u64 = 50; // 0.5%
    const BASIS_POINT_DIVIDER: u64 = 10_000;

    let fee_amount = amount
        .checked_mul(FEE_BASIS_POINTS)
        .ok_or(PredictionMarketError::MathOverflow)?
        .checked_div(BASIS_POINT_DIVIDER)
        .ok_or(PredictionMarketError::MathOverflow)?;

    let amount_after_fee = amount
        .checked_add(fee_amount)
        .ok_or(PredictionMarketError::MathOverflow)?;

    // Transfer tokens from user to vault
    let cpi_accounts = Transfer {
        from: ctx.accounts.user_token_account.to_account_info(),
        to: ctx.accounts.market_vault.to_account_info(),
        authority: ctx.accounts.user.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    transfer(cpi_ctx, amount_after_fee)?;

    // Update market pools based on bet type
    let market = &mut ctx.accounts.market;
    match bet_type {
        BetType::Home => {
            market.yes_pool = market.yes_pool
                .checked_add(amount)
                .ok_or(PredictionMarketError::MathOverflow)?;
        },
        BetType::Away => {
            market.no_pool = market.no_pool
                .checked_add(amount)
                .ok_or(PredictionMarketError::MathOverflow)?;
        },
        BetType::Draw => {
            market.draw_pool = market.draw_pool
                .checked_add(amount)
                .ok_or(PredictionMarketError::MathOverflow)?;
        },
    }

    market.fees_collected = market.fees_collected
        .checked_add(fee_amount)
        .ok_or(PredictionMarketError::MathOverflow)?;

    // Initialize or update position
    let market_key = market.key();
    let position = &mut ctx.accounts.position;
    if position.user == Pubkey::default() {
        position.user = ctx.accounts.user.key();
        position.market = market_key;
        position.yes_amount = 0;
        position.no_amount = 0;
        position.draw_amount = 0;
        position.bump = ctx.bumps.position;
    }

    // Update position based on bet type
    match bet_type {
        BetType::Home => {
            position.yes_amount = position.yes_amount
                .checked_add(amount)
                .ok_or(PredictionMarketError::MathOverflow)?;
        },
        BetType::Away => {
            position.no_amount = position.no_amount
                .checked_add(amount)
                .ok_or(PredictionMarketError::MathOverflow)?;
        },
        BetType::Draw => {
            position.draw_amount = position.draw_amount
                .checked_add(amount)
                .ok_or(PredictionMarketError::MathOverflow)?;
        },
    }

    msg!(
        "Bet placed: {} tokens on {:?} for {} vs {}",
        amount,
        bet_type,
        market.home_team,
        market.away_team
    );

    Ok(())
}

#[derive(Accounts)]
pub struct PlaceBet<'info> {
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
    pub token_program: Program<'info, Token>,
}