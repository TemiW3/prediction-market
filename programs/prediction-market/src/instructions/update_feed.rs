use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;
use switchboard_solana::ID as SWITCHBOARD_PROGRAM_ID;

pub fn update_oracle_feed(
    ctx: Context<UpdateOracleFeed>
) -> Result<()> {
    let clock = Clock::get()?;
    require!(clock.unix_timestamp < ctx.accounts.market.start_time, PredictionMarketError::MarketAlreadyStarted);
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
    
    /// CHECK: New Switchboard oracle feed (owner check)
    #[account(owner = SWITCHBOARD_PROGRAM_ID)]
    pub oracle_feed: AccountInfo<'info>,
    
    pub authority: Signer<'info>,
}