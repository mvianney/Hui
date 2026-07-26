use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::errors::HuiError;
use crate::state::*;

/// Permissionless payout instruction — anyone can call once all members
/// have contributed for the current round.
///
/// Transfers the full pot (contribution_amount × member_count) from the
/// vault to that round's designated recipient (per payout_order).
///
/// Then advances to the next round, or completes the circle if this was
/// the final round.
///
/// Being permissionless is the core design principle: no single party
/// (not even the organizer) can block or delay fund release. Once all
/// contributions are in, anyone can trigger the payout.

#[derive(Accounts)]
pub struct TriggerPayout<'info> {
    /// Anyone can call this — permissionless crank.
    pub payer: Signer<'info>,

    #[account(
        mut,
        constraint = circle.status == CircleStatus::Active @ HuiError::CircleNotActive,
    )]
    pub circle: Account<'info, Circle>,

    #[account(
        mut,
        seeds = [b"vault", circle.key().as_ref()],
        bump = circle.vault_bump,
    )]
    pub vault: Account<'info, TokenAccount>,

    /// The token account of this round's designated recipient.
    #[account(
        mut,
        constraint = recipient_token_account.mint == vault.mint @ HuiError::InvalidRecipient,
        constraint = recipient_token_account.owner == circle.current_recipient() @ HuiError::InvalidRecipient,
    )]
    pub recipient_token_account: Account<'info, TokenAccount>,

    /// The MemberRecord of the recipient, to mark received_payout.
    #[account(
        mut,
        seeds = [
            b"member_record",
            circle.key().as_ref(),
            circle.current_recipient().as_ref(),
        ],
        bump = recipient_member_record.bump,
    )]
    pub recipient_member_record: Account<'info, MemberRecord>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<TriggerPayout>) -> Result<()> {
    let circle = &mut ctx.accounts.circle;

    let round_index = (circle.current_round - 1) as usize;

    // Verify all members have contributed
    require!(
        circle.all_contributed(round_index),
        HuiError::RoundNotComplete
    );

    // Calculate pot: contribution_amount × member_count
    let pot = circle
        .contribution_amount
        .checked_mul(circle.member_count as u64)
        .ok_or(HuiError::Overflow)?;

    // Transfer pot from vault to recipient via PDA signing
    let creator_key = circle.creator;
    let nonce_bytes = circle.circle_nonce.to_le_bytes();
    let bump = circle.bump;

    let seeds: &[&[u8]] = &[
        b"circle",
        creator_key.as_ref(),
        &nonce_bytes,
        &[bump],
    ];
    let signer_seeds = &[seeds];

    let transfer_accounts = Transfer {
        from: ctx.accounts.vault.to_account_info(),
        to: ctx.accounts.recipient_token_account.to_account_info(),
        authority: circle.to_account_info(),
    };

    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            transfer_accounts,
            signer_seeds,
        ),
        pot,
    )?;

    // Update recipient's MemberRecord
    let record = &mut ctx.accounts.recipient_member_record;
    record.received_payout = true;

    msg!(
        "Payout of {} to {} for round {}",
        pot,
        circle.current_recipient(),
        circle.current_round
    );

    // Advance round or complete circle
    if circle.current_round >= circle.total_rounds {
        circle.status = CircleStatus::Completed;
        msg!("Circle completed — all {} rounds finished", circle.total_rounds);
    } else {
        circle.current_round += 1;
        let clock = Clock::get()?;
        circle.round_start_ts = clock.unix_timestamp;
        msg!("Advanced to round {}", circle.current_round);
    }

    Ok(())
}
