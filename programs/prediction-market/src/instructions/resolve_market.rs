use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;
use switchboard_on_demand::on_demand::accounts::pull_feed::PullFeedAccountData;
use switchboard_on_demand::{ON_DEMAND_DEVNET_PID, ON_DEMAND_MAINNET_PID};

pub fn resolve_with_switchboard_oracle(ctx: Context<ResolveMarket>) -> Result<()> {
    // Ensure the feed account is owned by Switchboard On-Demand (devnet or mainnet program ID).
    // Crate uses a different `Pubkey` newtype than Anchor; compare raw bytes.
    let owner_bytes = ctx.accounts.oracle_feed.owner.to_bytes();
    require!(
        owner_bytes == ON_DEMAND_DEVNET_PID.to_bytes()
            || owner_bytes == ON_DEMAND_MAINNET_PID.to_bytes(),
        PredictionMarketError::InvalidFeed
    );

    let clock = Clock::get()?;
    let market = &mut ctx.accounts.market;
    
    // Check timing constraints
    require!(
        clock.unix_timestamp > market.resolution_time, 
        PredictionMarketError::TooEarlyToResolve
    );
    require!(
        !market.resolved, 
        PredictionMarketError::MarketAlreadyResolved
    );

    // Parse the Switchboard On-Demand pull feed
    let feed = PullFeedAccountData::parse(ctx.accounts.oracle_feed.data.borrow())
        .map_err(|_| PredictionMarketError::InvalidFeed)?;
    
    // Verify this is the correct feed for this market
    require!(
        feed.feed_hash == market.oracle_feed,
        PredictionMarketError::InvalidFeed
    );

    // Get the oracle result
    // Your API returns: -1 = not finished, 0 = away wins, 1 = home wins, 2 = draw
    
    // The correct API depends on your switchboard-on-demand version:
    // Try Option 1 first, if it doesn't compile, use Option 2
    
    // Option 1: Pass clock reference (most common in newer versions)
    let oracle_value = feed.value(clock.slot)
        .map_err(|_| PredictionMarketError::InvalidOracleValue)?;
    
    // Option 2: If Option 1 doesn't compile, try accessing as a field
    // let oracle_value = feed.value;
    
    // Convert to i8 (NOT u8, because we need to handle -1!)
    let result: i8 = oracle_value
        .try_into()
        .map_err(|_| PredictionMarketError::InvalidOracleValue)?;

    msg!("Switchboard On-Demand oracle result: {}", result);

    // Ensure match is finished (not -1)
    require!(
        result >= 0, 
        PredictionMarketError::MatchNotFinished
    );
    
    // Validate result is in expected range (0, 1, or 2)
    require!(
        result <= 2, 
        PredictionMarketError::InvalidOracleValue
    );

    // Update market based on result
    match result {
        0 => {
            // Away team wins
            market.is_draw = false;
            market.resolved = true;
            market.outcome = Some(false); // false = away wins
            msg!("Match resolved: Away wins - {}", market.away_team);
        },
        1 => {
            // Home team wins
            market.is_draw = false;
            market.resolved = true;
            market.outcome = Some(true); // true = home wins
            msg!("Match resolved: Home wins - {}", market.home_team);
        },
        2 => {
            // Draw
            market.is_draw = true;
            market.resolved = true;
            market.outcome = None;
            msg!("Match resolved: Draw - {} vs {}", market.home_team, market.away_team);
        },
        _ => unreachable!() // Already checked result <= 2
    }

    market.final_result_value = result as i64;

    Ok(())
}

#[derive(Accounts)]
pub struct ResolveMarket<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,

    #[account(
        constraint = authority.key() == market.authority @ PredictionMarketError::UnauthorizedResolver
    )]
    pub authority: Signer<'info>,

    /// CHECK: Switchboard On-Demand pull feed; owner verified in instruction (see crate `program_id`).
    pub oracle_feed: AccountInfo<'info>,
}