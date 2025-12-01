use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Market{
    pub authority: Pubkey,
    #[max_len(200)]
    pub question: String,
    #[max_len(50)]
    pub home_team: String,
    #[max_len(50)]
    pub away_team: String,
    #[max_len(50)]
    pub game_key: String,
    pub start_time: i64,
    pub end_time: i64,
    pub resolution_time: i64,
    pub yes_pool: u64,
    pub no_pool: u64,
    pub resolved: bool,
    pub outcome: Option<bool>,
    pub is_draw: bool,
    pub oracle_feed: Pubkey,
    pub final_result_value: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Position {
    pub user: Pubkey,
    pub market: Pubkey,
    pub yes_amount: u64,
    pub no_amount: u64,
    pub bump: u8,
}