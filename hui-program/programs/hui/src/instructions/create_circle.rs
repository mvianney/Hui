use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::errors::HuiError;
use crate::state::*;

/// Create a new Hụi circle.
///
/// Signature change from v1: payout_order: Vec<Pubkey> is REMOVED.
/// The circle is created with empty slots. Members choose their own
/// slot positions when calling join_circle. The creator must also call
/// join_circle to claim a slot. start_circle activates the circle once
/// all slots are filled.
#[derive(Accounts)]
#[instruction(
    circle_nonce: u64,
    name: String,
    contribution_amount: u64,
    frequency_seconds: i64,
    total_rounds: u8,
)]
pub struct CreateCircle<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        init,
        payer = creator,
        space = 8 + Circle::INIT_SPACE,
        seeds = [b"circle", creator.key().as_ref(), &circle_nonce.to_le_bytes()],
        bump,
    )]
    pub circle: Box<Account<'info, Circle>>,

    #[account(
        init,
        payer = creator,
        seeds = [b"vault", circle.key().as_ref()],
        bump,
        token::mint = usdc_mint,
        token::authority = circle,
    )]
    pub vault: Account<'info, TokenAccount>,

    pub usdc_mint: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(
    ctx: Context<CreateCircle>,
    circle_nonce: u64,
    name: String,
    contribution_amount: u64,
    frequency_seconds: i64,
    total_rounds: u8,
) -> Result<()> {
    require!(name.len() <= 32, HuiError::NameTooLong);
    require!(contribution_amount > 0, HuiError::InvalidAmount);
    require!(frequency_seconds > 0, HuiError::InvalidFrequency);
    require!(
        total_rounds >= 2 && total_rounds <= MAX_ROUNDS as u8,
        HuiError::InvalidTotalRounds
    );

    let circle = &mut ctx.accounts.circle;
    circle.creator = ctx.accounts.creator.key();
    circle.name = name;
    circle.contribution_amount = contribution_amount;
    circle.frequency_seconds = frequency_seconds;
    circle.total_rounds = total_rounds;
    circle.current_round = 0;
    circle.member_count = total_rounds;
    circle.status = CircleStatus::Pending;
    circle.round_start_ts = 0;
    circle.vault_bump = ctx.bumps.vault;
    circle.bump = ctx.bumps.circle;
    circle.circle_nonce = circle_nonce;
    circle.slots_filled = 0;
    circle.contributions = [0u32; MAX_ROUNDS];
    circle.payout_order = [Pubkey::default(); MAX_MEMBERS];

    msg!(
        "Circle '{}' created — {} slots open, {} lamports/round",
        circle.name,
        circle.total_rounds,
        circle.contribution_amount
    );

    Ok(())
}
