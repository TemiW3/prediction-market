use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount, Transfer};
use crate::state::*;
use crate::errors::*;

pub fn collect_fees(ctx: Context<CollectFees>) -> Result<()> {
    let market = &mut ctx.accounts.market;

    require!(
        market.authority == ctx.accounts.authority.key(),
        PredictionMarketError::UnauthorizedFeeCollector
    );

    let fees = market.fees_collected;
    require!(fees > 0, PredictionMarketError::NoFeesToCollect);

    let cpi_accounts = Transfer {
        from: ctx.accounts.market_vault.to_account_info(),
        to: ctx.accounts.fee_receiver.to_account_info(),
        authority: ctx.accounts.market_vault.to_account_info(),
    };

    let market_key = market.key();
    let vault_seeds = &[b"vault", market_key.as_ref(), &[ctx.bumps.market_vault]];
    let signer = &[&vault_seeds[..]];
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
    anchor_spl::token::transfer(cpi_ctx, fees)?;

    market.fees_collected = 0;

    Ok(())
}

#[derive(Accounts)]
pub struct CollectFees<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,

    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        constraint = fee_receiver.owner == authority.key() @ PredictionMarketError::InvalidVault,
        constraint = fee_receiver.mint == market_vault.mint @ PredictionMarketError::InvalidVault
    )]
    pub fee_receiver: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"vault", market.key().as_ref()],
        bump,
    )]
    pub market_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}