use anchor_lang::prelude::*;

use crate::errors::HuiError;
use crate::state::*;

/// Join an open circle by claiming a specific slot.
///
/// Signature change from v1:
///   - chosen_slot: u8  — the 0-indexed position the member wants (determines payout round)
///   - display_name: String — human-readable name stored in MemberRecord
///
/// Removed from v1: no pre-set payout_order lookup. Anyone can join any
/// open slot. Circle does NOT auto-activate when full — creator must
/// explicitly call start_circle.
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

pub fn handler(
    ctx: Context<JoinCircle>,
    chosen_slot: u8,
    display_name: String,
) -> Result<()> {
    let circle = &mut ctx.accounts.circle;
    let member_key = ctx.accounts.member.key();

    // Validate slot index is within bounds
    require!(
        (chosen_slot as usize) < circle.total_rounds as usize,
        HuiError::SlotOutOfBounds
    );

    // Validate the slot is not already taken
    require!(
        circle.payout_order[chosen_slot as usize] == Pubkey::default(),
        HuiError::SlotAlreadyTaken
    );

    // Validate display name length
    require!(display_name.len() <= 32, HuiError::NameTooLong);

    // Claim the slot
    circle.payout_order[chosen_slot as usize] = member_key;
    circle.slots_filled += 1;

    // Initialize MemberRecord
    let record = &mut ctx.accounts.member_record;
    record.member = member_key;
    record.circle = circle.key();
    record.display_name = display_name;
    record.rounds_contributed = 0;
    record.rounds_missed = 0;
    record.received_payout = false;
    record.payout_round = chosen_slot + 1; // 1-indexed
    record.completed_circle = false;
    record.bump = ctx.bumps.member_record;

    msg!(
        "Member {} joined slot {} (payout round {}) — {}/{} slots filled",
        member_key,
        chosen_slot,
        chosen_slot + 1,
        circle.slots_filled,
        circle.total_rounds
    );

    Ok(())
}
