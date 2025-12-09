use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};
use crate::state::*;
use crate::errors::*;

pub fn claim_winnings(ctx: Context<ClaimWinnings>) -> Result <()> {
    let market = &ctx.accounts.market;
    let position = &mut ctx.accounts.position;

    require!(market.resolved, PredictionMarketError::MarketNotResolved);

    let mut winnings: u64 = 0;

    if market.is_draw {
        let total_bet = position.yes_amount.checked_add(position.no_amount).ok_or(PredictionMarketError::MathOverflow)?;
        winnings = total_bet;
    } else if let Some(outcome) = market.outcome {
        if outcome {
            // Home team won - payout to yes bettors
            require!(market.yes_pool > 0, PredictionMarketError::MathOverflow);
            let yes_pool = market.yes_pool;
            let no_pool = market.no_pool;
            let total_pool = yes_pool.checked_add(no_pool).ok_or(PredictionMarketError::MathOverflow)?;
            winnings = position.yes_amount
                .checked_mul(total_pool)
                .ok_or(PredictionMarketError::MathOverflow)?
                .checked_div(yes_pool)
                .ok_or(PredictionMarketError::MathOverflow)?;
        } else {
            // Away team won - payout to no bettors
            require!(market.no_pool > 0, PredictionMarketError::MathOverflow);
            let yes_pool = market.yes_pool;
            let no_pool = market.no_pool;
            let total_pool = yes_pool.checked_add(no_pool).ok_or(PredictionMarketError::MathOverflow)?;
            winnings = position.no_amount
                .checked_mul(total_pool)
                .ok_or(PredictionMarketError::MathOverflow)?
                .checked_div(no_pool)
                .ok_or(PredictionMarketError::MathOverflow)?;
        }
    }

    require!(winnings > 0, PredictionMarketError::NoWinningsToClaim);

    let market_key = market.key();
    let cpi_accounts = anchor_spl::token::Transfer {
        from: ctx.accounts.market_vault.to_account_info(),
        to: ctx.accounts.user_token_account.to_account_info(),
        authority: ctx.accounts.market_vault.to_account_info(),
    };
    let vault_seeds = &[
        b"vault",
        market_key.as_ref(),
        &[ctx.bumps.market_vault]
    ];
    let signer = &[&vault_seeds[..]];
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
    anchor_spl::token::transfer(cpi_ctx, winnings)?;

    // Reset position after claiming winnings
    position.yes_amount = 0;
    position.no_amount = 0;

    msg!("Payout claimed: {} tokens", winnings);

    Ok(())
}

#[derive(Accounts)]
pub struct ClaimWinnings<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,

    #[account(
        mut,
        constraint = position.user == user.key() @ PredictionMarketError::InvalidVault,
        constraint = position.market == market.key() @ PredictionMarketError::InvalidVault
    )]
    pub position: Account<'info, Position>,

    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        constraint = user_token_account.owner == user.key() @ PredictionMarketError::InvalidVault,
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"vault", market.key().as_ref()],
        bump,
    )]
    pub market_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}