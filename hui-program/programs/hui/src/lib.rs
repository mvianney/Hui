use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("BAUzUZpbXTqtfWaRd4ANUgLA1wSh6QiKTt6ChhdWWdpB");

#[program]
pub mod hui {
    use super::*;

    /// Create a new Hụi savings circle.
    /// payout_order is no longer an argument — members choose their own slots via join_circle.
    pub fn create_circle(
        ctx: Context<CreateCircle>,
        circle_nonce: u64,
        name: String,
        contribution_amount: u64,
        frequency_seconds: i64,
        total_rounds: u8,
    ) -> Result<()> {
        instructions::create_circle::handler(
            ctx,
            circle_nonce,
            name,
            contribution_amount,
            frequency_seconds,
            total_rounds,
        )
    }

    /// Member joins the circle by claiming a specific slot (0-indexed).
    /// chosen_slot determines which round they receive the payout.
    pub fn join_circle(
        ctx: Context<JoinCircle>,
        chosen_slot: u8,
        display_name: String,
    ) -> Result<()> {
        instructions::join_circle::handler(ctx, chosen_slot, display_name)
    }

    /// Creator explicitly activates the circle once all slots are filled.
    /// Replaces the old auto-activate logic in join_circle.
    pub fn start_circle(ctx: Context<StartCircle>) -> Result<()> {
        instructions::start_circle::handler(ctx)
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
