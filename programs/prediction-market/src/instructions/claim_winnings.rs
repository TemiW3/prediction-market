use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount, Transfer, transfer};
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
            let yes_pool = market.yes_pool;
            let no_pool = market.no_pool;
            winnings = position.yes_amount
                .checked_mul(yes_pool.checked_add(no_pool).ok_or(PredictionMarketError::MathOverflow)?)
                .ok_or(PredictionMarketError::MathOverflow)?
                .checked_div(yes_pool)
                .ok_or(PredictionMarketError::MathOverflow)?;
        } else {
            let yes_pool = market.yes_pool;
            let no_pool = market.no_pool;
            winnings = position.no_amount
                .checked_mul(yes_pool.checked_add(no_pool).ok_or(PredictionMarketError::MathOverflow)?)
                .ok_or(PredictionMarketError::MathOverflow)?
                .checked_div(no_pool)
                .ok_or(PredictionMarketError::MathOverflow)?;
        }
    }

    require!(winnings > 0, PredictionMarketError::NoWinningsToClaim);

    let cpi_accounts = anchor_spl::token::Transfer {
        from: ctx.accounts.market_vault.to_account_info(),
        to: ctx.accounts.user_token_account.to_account_info(),
        authority: ctx.accounts.market.to_account_info(),
    };
    let seeds = &[b"vault", market.authority.as_ref(), &[market.bump]];
    let signer = &[&seeds[..]];
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

    #[account(mut)]
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
        bump = market.bump,
    )]
    pub market_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}