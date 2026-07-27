use anchor_lang::prelude::*;

use crate::errors::HuiError;
use crate::state::*;

/// Explicitly activate the circle — creator-only.
///
/// NEW instruction (replaces the auto-activate logic that was baked into join_circle v1).
///
/// Preconditions:
///   - Caller must be the circle creator
///   - Circle must be Pending
///   - All slots must be filled (slots_filled == total_rounds)
///
/// Effect:
///   - Sets status to Active
///   - Sets current_round to 1
///   - Records round start timestamp
#[derive(Accounts)]
pub struct StartCircle<'info> {
    #[account(
        mut,
        constraint = creator.key() == circle.creator @ HuiError::Unauthorized,
    )]
    pub creator: Signer<'info>,

    #[account(
        mut,
        constraint = circle.status == CircleStatus::Pending @ HuiError::CircleNotPending,
    )]
    pub circle: Account<'info, Circle>,
}

pub fn handler(ctx: Context<StartCircle>) -> Result<()> {
    let circle = &mut ctx.accounts.circle;

    require!(circle.all_slots_filled(), HuiError::NotAllSlotsFilled);

    circle.status = CircleStatus::Active;
    circle.current_round = 1;
    let clock = Clock::get()?;
    circle.round_start_ts = clock.unix_timestamp;

    msg!(
        "Circle '{}' started — {} members, round 1 of {} begins",
        circle.name,
        circle.total_rounds,
        circle.total_rounds
    );

    Ok(())
}
