use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;
use switchboard_solana::aggregator::AggregatorAccountData;

pub fn resolve_with_switchboard_oracle(ctx: Context<ResolveMarket>) -> Result<()> {
    let clock = Clock::get()?;
    require!(clock.unix_timestamp > ctx.accounts.market.resolution_time, PredictionMarketError::TooEarlyToResolve);
    require!(!ctx.accounts.market.resolved, PredictionMarketError::MarketAlreadyResolved);

    let aggregator = ctx.accounts.oracle_feed.load()?;

    let current_value = aggregator.get_result()?;
    // Convert SwitchboardDecimal to an integer by accounting for scale
    let scaled_i128: i128 = current_value.mantissa
        .checked_div(10i128.pow(current_value.scale as u32))
        .ok_or(PredictionMarketError::MathOverflow)?;
    let result = scaled_i128 as i64;

    msg!("Switchboard oracle result: {}", result);

    require!(result != -1, PredictionMarketError::MatchNotFinished);

    let market = &mut ctx.accounts.market;

    if result == 2 {
        market.is_draw = true;
        market.resolved = true;
        market.outcome = None;
    } else {
        let home_won = result == 1;
        market.is_draw = false;
        market.resolved = true;
        market.outcome = Some(home_won);

        msg!(
            "Match resolved: {} {} vs {}",
                if home_won { "Home wins" } else { "Away wins" },
                market.home_team,
                market.away_team
            );
        }
    
        market.final_result_value = result;

    Ok(())
}

#[derive(Accounts)]
pub struct ResolveMarket<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,

    /// CHECK: Switchboard feed - validated by address match
    #[account(
        constraint = oracle_feed.key() == market.oracle_feed @ PredictionMarketError::InvalidFeed
    )]
    pub oracle_feed: AccountLoader<'info, AggregatorAccountData>,
}