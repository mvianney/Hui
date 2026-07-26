use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::errors::HuiError;
use crate::state::*;

/// Contributes USDC for the current round.
///
/// Transfers contribution_amount from the member's token account into the
/// vault via CPI to the SPL Token program, then marks the member as paid
/// in the Circle's contribution bitmap.
///
/// Does NOT auto-trigger payout — use the separate permissionless
/// `trigger_payout` instruction after all members have contributed.
///
/// Tradeoff: keeping contribute and payout separate means an extra
/// transaction for the payout step, but it simplifies account validation
/// (contribute doesn't need the recipient's token account) and makes the
/// code easier to audit. Since trigger_payout is permissionless, the last
/// contributor (or any crank) can call it immediately after in the same
/// transaction bundle.

#[derive(Accounts)]
pub struct Contribute<'info> {
    pub member: Signer<'info>,

    #[account(
        mut,
        constraint = circle.status == CircleStatus::Active @ HuiError::CircleNotActive,
    )]
    pub circle: Account<'info, Circle>,

    #[account(
        mut,
        seeds = [b"member_record", circle.key().as_ref(), member.key().as_ref()],
        bump = member_record.bump,
        constraint = member_record.member == member.key() @ HuiError::NotAMember,
        constraint = member_record.circle == circle.key() @ HuiError::NotAMember,
    )]
    pub member_record: Account<'info, MemberRecord>,

    #[account(
        mut,
        seeds = [b"vault", circle.key().as_ref()],
        bump = circle.vault_bump,
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = member_token_account.owner == member.key(),
        constraint = member_token_account.mint == vault.mint,
    )]
    pub member_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<Contribute>) -> Result<()> {
    let circle = &mut ctx.accounts.circle;
    let member_key = ctx.accounts.member.key();

    // Find member index
    let member_index = circle
        .member_index(&member_key)
        .ok_or(HuiError::NotAMember)?;

    // Validate round
    let round_index = (circle.current_round - 1) as usize;

    // Check not already contributed this round
    require!(
        !circle.has_contributed(round_index, member_index),
        HuiError::AlreadyContributed
    );

    // Transfer USDC from member to vault
    let transfer_accounts = Transfer {
        from: ctx.accounts.member_token_account.to_account_info(),
        to: ctx.accounts.vault.to_account_info(),
        authority: ctx.accounts.member.to_account_info(),
    };

    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            transfer_accounts,
        ),
        circle.contribution_amount,
    )?;

    // Mark as contributed
    circle.set_contributed(round_index, member_index);

    // Update member record
    let record = &mut ctx.accounts.member_record;
    record.rounds_contributed += 1;

    msg!(
        "Member {} contributed {} for round {}",
        member_key,
        circle.contribution_amount,
        circle.current_round
    );

    Ok(())
}
