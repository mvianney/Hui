use anchor_lang::prelude::*;

use crate::errors::HuiError;
use crate::state::*;

/// A prospective member accepts their spot in the circle and initializes
/// their MemberRecord PDA.
///
/// When the last expected member joins, the circle transitions from Pending
/// to Active and round 1 opens.

#[derive(Accounts)]
pub struct JoinCircle<'info> {
    #[account(mut)]
    pub member: Signer<'info>,

    #[account(
        mut,
        constraint = circle.status == CircleStatus::Pending @ HuiError::CircleNotPending,
    )]
    pub circle: Account<'info, Circle>,

    #[account(
        init,
        payer = member,
        space = 8 + MemberRecord::INIT_SPACE,
        seeds = [b"member_record", circle.key().as_ref(), member.key().as_ref()],
        bump,
    )]
    pub member_record: Account<'info, MemberRecord>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<JoinCircle>) -> Result<()> {
    let circle = &mut ctx.accounts.circle;
    let member_key = ctx.accounts.member.key();

    // Find the member's index in payout_order
    let member_index = circle
        .member_index(&member_key)
        .ok_or(HuiError::NotAMember)?;

    // Check they haven't already joined (redundant with init constraint on PDA,
    // but explicit for clarity)
    require!(!circle.has_joined(member_index), HuiError::AlreadyJoined);

    // Mark as joined
    circle.set_joined(member_index);

    // Initialize MemberRecord
    let record = &mut ctx.accounts.member_record;
    record.member = member_key;
    record.circle = circle.key();
    record.rounds_contributed = 0;
    record.rounds_missed = 0;
    record.received_payout = false;
    record.payout_round = (member_index + 1) as u8; // 1-indexed
    record.completed_circle = false;
    record.bump = ctx.bumps.member_record;

    msg!(
        "Member {} joined circle at position {}",
        member_key,
        member_index + 1
    );

    // Check if all members have now joined → activate the circle
    if circle.all_joined() {
        circle.status = CircleStatus::Active;
        circle.current_round = 1;
        let clock = Clock::get()?;
        circle.round_start_ts = clock.unix_timestamp;
        msg!("All members joined — circle is now Active, round 1 started");
    }

    Ok(())
}
