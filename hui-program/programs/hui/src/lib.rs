use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;

// Placeholder program ID — update after `anchor keys list` or `anchor build`.
declare_id!("BAUzUZpbXTqtfWaRd4ANUgLA1wSh6QiKTt6ChhdWWdpB");

#[program]
pub mod hui {
    use super::*;

    /// Create a new Hụi savings circle with a fixed payout order.
    pub fn create_circle(
        ctx: Context<CreateCircle>,
        circle_nonce: u64,
        name: String,
        contribution_amount: u64,
        frequency_seconds: i64,
        total_rounds: u8,
        payout_order: Vec<Pubkey>,
    ) -> Result<()> {
        instructions::create_circle::handler(
            ctx,
            circle_nonce,
            name,
            contribution_amount,
            frequency_seconds,
            total_rounds,
            payout_order,
        )
    }

    /// Member accepts their spot in the circle.
    pub fn join_circle(ctx: Context<JoinCircle>) -> Result<()> {
        instructions::join_circle::handler(ctx)
    }

    /// Contribute USDC for the current round.
    pub fn contribute(ctx: Context<Contribute>) -> Result<()> {
        instructions::contribute::handler(ctx)
    }

    /// Trigger payout to the current round's recipient (permissionless).
    pub fn trigger_payout(ctx: Context<TriggerPayout>) -> Result<()> {
        instructions::trigger_payout::handler(ctx)
    }

    /// Mark a member as missed after grace period (permissionless).
    pub fn mark_missed(ctx: Context<MarkMissed>) -> Result<()> {
        instructions::mark_missed::handler(ctx)
    }

    /// Finalize a member's record after circle completion (permissionless).
    pub fn finalize_member(ctx: Context<FinalizeMember>) -> Result<()> {
        instructions::finalize_member::handler(ctx)
    }
}
