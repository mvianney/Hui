use anchor_lang::prelude::*;

use crate::errors::HuiError;
use crate::state::*;

/// Marks a member as having missed their contribution for the current round.
///
/// Callable by anyone (permissionless) after the round deadline + grace period
/// has elapsed AND the target member has not contributed.
///
/// KNOWN LIMITATION (MVP): marking a member as missed does NOT advance the
/// round. The round stays open/blocked until the missing member pays or an
/// off-chain resolution occurs. This is intentionally simple and honest.
///
/// ROADMAP: A future version should add:
/// - A backstop mechanism (e.g., after 2× grace period, skip the defaulter
///   and advance the round using a partial pot or staked collateral)
/// - Stake/collateral requirement at join time to cover potential defaults
/// - Penalty/slashing logic for defaulters

#[derive(Accounts)]
pub struct MarkMissed<'info> {
    /// Anyone can call this — permissionless.
    pub caller: Signer<'info>,

    #[account(
        mut,
        constraint = circle.status == CircleStatus::Active @ HuiError::CircleNotActive,
    )]
    pub circle: Account<'info, Circle>,

    /// CHECK: The member being marked as missed. Not a signer — we only need
    /// their pubkey for the MemberRecord PDA derivation.
    pub member: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [b"member_record", circle.key().as_ref(), member.key().as_ref()],
        bump = member_record.bump,
        constraint = member_record.member == member.key() @ HuiError::NotAMember,
        constraint = member_record.circle == circle.key() @ HuiError::NotAMember,
    )]
    pub member_record: Account<'info, MemberRecord>,
}

pub fn handler(ctx: Context<MarkMissed>) -> Result<()> {
    let circle = &ctx.accounts.circle;
    let member_key = ctx.accounts.member.key();

    // Find member index
    let member_index = circle
        .member_index(&member_key)
        .ok_or(HuiError::NotAMember)?;

    let round_index = (circle.current_round - 1) as usize;

    // Verify this member has NOT contributed (can't mark as missed if they paid)
    require!(
        !circle.has_contributed(round_index, member_index),
        HuiError::MemberAlreadyPaid
    );

    // Verify grace period has elapsed:
    // round_start_ts + frequency_seconds + GRACE_PERIOD_SECONDS < now
    let clock = Clock::get()?;
    let deadline = circle
        .round_start_ts
        .checked_add(circle.frequency_seconds)
        .and_then(|t| t.checked_add(GRACE_PERIOD_SECONDS))
        .ok_or(HuiError::Overflow)?;

    require!(
        clock.unix_timestamp > deadline,
        HuiError::GracePeriodNotElapsed
    );

    // Update member record
    let record = &mut ctx.accounts.member_record;
    record.rounds_missed += 1;

    msg!(
        "Member {} marked as missed for round {} (total missed: {})",
        member_key,
        circle.current_round,
        record.rounds_missed
    );

    // NOTE: Round does NOT advance. It stays open/blocked.
    // The circle is stuck until either:
    // - The missing member pays (contribute instruction)
    // - Off-chain resolution occurs (future: backstop mechanism)

    Ok(())
}
