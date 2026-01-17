use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;

pub fn update_oracle_feed(
    ctx: Context<UpdateOracleFeed>
) -> Result<()> {
    require!(
        ctx.accounts.authority.key() == ctx.accounts.market.authority,
        PredictionMarketError::UnauthorizedUpdater
    );
    
    let market = &mut ctx.accounts.market;
    market.oracle_feed = ctx.accounts.oracle_feed.key();
    
    Ok(())
}

#[derive(Accounts)]
pub struct UpdateOracleFeed<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,
    
    /// CHECK: New Oracle feed
    pub oracle_feed: AccountInfo<'info>,
    
    pub authority: Signer<'info>,
}