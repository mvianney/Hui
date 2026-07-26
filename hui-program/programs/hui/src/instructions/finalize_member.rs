use anchor_lang::prelude::*;

use crate::errors::HuiError;
use crate::state::*;

/// Finalizes a member's record after the circle has completed.
///
/// Sets `completed_circle = true` on the MemberRecord PDA. This is a
/// separate instruction (rather than built into trigger_payout) because
/// trigger_payout can only access one MemberRecord (the recipient's),
/// and we need to finalize ALL members' records.
///
/// Permissionless — anyone can call for any member after circle completion.

#[derive(Accounts)]
pub struct FinalizeMember<'info> {
    /// Anyone can call — permissionless.
    pub caller: Signer<'info>,

    #[account(
        constraint = circle.status == CircleStatus::Completed @ HuiError::NotCompleted,
    )]
    pub circle: Account<'info, Circle>,

    /// CHECK: The member whose record we're finalizing.
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

pub fn handler(ctx: Context<FinalizeMember>) -> Result<()> {
    let record = &mut ctx.accounts.member_record;

    require!(!record.completed_circle, HuiError::AlreadyFinalized);

    record.completed_circle = true;

    msg!(
        "Member {} record finalized (contributed: {}, missed: {}, payout: {})",
        record.member,
        record.rounds_contributed,
        record.rounds_missed,
        record.received_payout,
    );

    Ok(())
}
