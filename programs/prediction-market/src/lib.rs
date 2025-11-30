use anchor_lang::prelude::*;

declare_id!("HjX8LkQdV4RMmvzbsxkkszNCX5tVDRdd2hp8xk1RKcJ1");

#[program]
pub mod prediction_market {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
