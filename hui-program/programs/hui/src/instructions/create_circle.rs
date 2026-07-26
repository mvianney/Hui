use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::errors::HuiError;
use crate::state::*;

/// Creates a new Hụi circle and its escrow vault.
///
/// The creator specifies all member pubkeys in payout_order upfront.
/// Circle starts as Pending — each member must call `join_circle` to opt in.
/// Once all members have joined, status flips to Active automatically.
///
/// Design choice: creator specifies full payout_order at creation rather than
/// members filling open slots. This is because:
/// 1. In traditional hụi, the organizer coordinates who's in and the payout order
///    before the circle starts — it's a deliberate arrangement, not first-come-first-served.
/// 2. Having the full member list upfront allows the Circle account to be fully sized
///    at init time (no realloc needed).
/// 3. The frontend's "invite code" flow maps cleanly: creator creates circle with known
///    members → shares invite code → each member joins via code → circle starts.

#[derive(Accounts)]
#[instruction(
    circle_nonce: u64,
    name: String,
    contribution_amount: u64,
    frequency_seconds: i64,
    total_rounds: u8,
    payout_order: Vec<Pubkey>,
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
    payout_order: Vec<Pubkey>,
) -> Result<()> {
    // --- Validation ---
    require!(name.len() <= 32, HuiError::NameTooLong);
    require!(contribution_amount > 0, HuiError::InvalidAmount);
    require!(frequency_seconds > 0, HuiError::InvalidFrequency);
    require!(
        total_rounds >= 2 && total_rounds <= MAX_ROUNDS as u8,
        HuiError::InvalidTotalRounds
    );
    require!(
        payout_order.len() == total_rounds as usize,
        HuiError::InvalidPayoutOrder
    );

    // Check for duplicate members
    for i in 0..payout_order.len() {
        for j in (i + 1)..payout_order.len() {
            require!(payout_order[i] != payout_order[j], HuiError::DuplicateMember);
        }
    }

    // --- Initialize Circle ---
    let circle = &mut ctx.accounts.circle;
    circle.creator = ctx.accounts.creator.key();
    circle.name = name;
    circle.contribution_amount = contribution_amount;
    circle.frequency_seconds = frequency_seconds;
    circle.total_rounds = total_rounds;
    circle.current_round = 0; // No round active yet (Pending)
    circle.member_count = total_rounds; // In fixed-order, member_count == total_rounds
    circle.status = CircleStatus::Pending;
    circle.round_start_ts = 0;
    circle.vault_bump = ctx.bumps.vault;
    circle.bump = ctx.bumps.circle;
    circle.circle_nonce = circle_nonce;
    circle.members_joined = 0;
    circle.contributions = [0u32; MAX_ROUNDS];

    // Copy payout_order into the fixed-size array
    let mut po = [Pubkey::default(); MAX_MEMBERS];
    for (i, key) in payout_order.iter().enumerate() {
        po[i] = *key;
    }
    circle.payout_order = po;

    msg!(
        "Circle '{}' created with {} members, {} lamports/round",
        circle.name,
        circle.member_count,
        circle.contribution_amount
    );

    Ok(())
}
