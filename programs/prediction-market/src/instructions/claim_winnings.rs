use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};
use crate::state::*;
use crate::errors::*;

pub fn claim_winnings(ctx: Context<ClaimWinnings>) -> Result<()> {
    let market = &ctx.accounts.market;
    let position = &mut ctx.accounts.position;

    require!(market.resolved, PredictionMarketError::MarketNotResolved);

    let mut winnings: u64 = 0;

    if market.is_draw {
        // DRAW SCENARIO
        // Only users who bet on draw win!
        // Users who bet on home/away LOSE (just like draw bettors lose on home/away wins)
        
        if position.draw_amount > 0 {
            // User bet on draw and won!
            require!(market.draw_pool > 0, PredictionMarketError::MathOverflow);
            
            let total_pool = market.yes_pool
                .checked_add(market.no_pool)
                .ok_or(PredictionMarketError::MathOverflow)?
                .checked_add(market.draw_pool)
                .ok_or(PredictionMarketError::MathOverflow)?;
            
            winnings = position.draw_amount
                .checked_mul(total_pool)
                .ok_or(PredictionMarketError::MathOverflow)?
                .checked_div(market.draw_pool)
                .ok_or(PredictionMarketError::MathOverflow)?;
                
            msg!("Draw bettor wins: {} tokens", winnings);
        } else {
            // User bet on home or away - they LOSE!
            winnings = 0;
            msg!("Home/Away bettor loses on draw");
        }
    } else if let Some(outcome) = market.outcome {
        // HOME/AWAY WIN SCENARIO
        
        if outcome {
            // HOME TEAM WON
            if position.yes_amount > 0 {
                require!(market.yes_pool > 0, PredictionMarketError::MathOverflow);
                
                let total_pool = market.yes_pool
                    .checked_add(market.no_pool)
                    .ok_or(PredictionMarketError::MathOverflow)?
                    .checked_add(market.draw_pool)
                    .ok_or(PredictionMarketError::MathOverflow)?;
                
                winnings = position.yes_amount
                    .checked_mul(total_pool)
                    .ok_or(PredictionMarketError::MathOverflow)?
                    .checked_div(market.yes_pool)
                    .ok_or(PredictionMarketError::MathOverflow)?;
                    
                msg!("Home bettor wins: {} tokens", winnings);
            } else {
                // User bet on away or draw, no winnings
                winnings = 0;
            }
        } else {
            // AWAY TEAM WON
            if position.no_amount > 0 {
                require!(market.no_pool > 0, PredictionMarketError::MathOverflow);
                
                let total_pool = market.yes_pool
                    .checked_add(market.no_pool)
                    .ok_or(PredictionMarketError::MathOverflow)?
                    .checked_add(market.draw_pool)
                    .ok_or(PredictionMarketError::MathOverflow)?;
                
                winnings = position.no_amount
                    .checked_mul(total_pool)
                    .ok_or(PredictionMarketError::MathOverflow)?
                    .checked_div(market.no_pool)
                    .ok_or(PredictionMarketError::MathOverflow)?;
                    
                msg!("Away bettor wins: {} tokens", winnings);
            } else {
                // User bet on home or draw, no winnings
                winnings = 0;
            }
        }
    }

    require!(winnings > 0, PredictionMarketError::NoWinningsToClaim);

    // Transfer winnings to user
    let market_key = market.key();
    let cpi_accounts = anchor_spl::token::Transfer {
        from: ctx.accounts.market_vault.to_account_info(),
        to: ctx.accounts.user_token_account.to_account_info(),
        authority: ctx.accounts.market_vault.to_account_info(),
    };
    let bump = ctx.bumps.market_vault;
    let signer_seeds: &[&[&[u8]]] = &[&[
        b"vault",
        market_key.as_ref(),
        &[bump],
    ]];
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);
    anchor_spl::token::transfer(cpi_ctx, winnings)?;

    // Reset position after claiming winnings
    position.yes_amount = 0;
    position.no_amount = 0;
    position.draw_amount = 0;  // Don't forget this!

    msg!("Winnings claimed: {} tokens", winnings);

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