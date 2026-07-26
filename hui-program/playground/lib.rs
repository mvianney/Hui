// ============================================================
// Hụi On-Chain — Solana Playground consolidated lib.rs
//
// This is a single-file version of the Anchor program for use in
// Solana Playground (beta.solpg.io). All modules are inlined.
//
// To use: Create a new Anchor project in Playground, replace the
// generated lib.rs with this file, add `anchor-spl` dependency.
// ============================================================

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

// ============================================================
// Constants
// ============================================================

pub const MAX_MEMBERS: usize = 20;
pub const MAX_ROUNDS: usize = 20;
pub const GRACE_PERIOD_SECONDS: i64 = 86_400; // 24 hours

// ============================================================
// Errors
// ============================================================

#[error_code]
pub enum HuiError {
    #[msg("Payout order length must equal total rounds")]
    InvalidPayoutOrder,
    #[msg("Duplicate member in payout order")]
    DuplicateMember,
    #[msg("Not a member of this circle")]
    NotAMember,
    #[msg("Member has already joined this circle")]
    AlreadyJoined,
    #[msg("Circle is not in Active status")]
    CircleNotActive,
    #[msg("Circle is not in Pending status")]
    CircleNotPending,
    #[msg("Wrong round number")]
    WrongRound,
    #[msg("Already contributed this round")]
    AlreadyContributed,
    #[msg("Round is not yet complete")]
    RoundNotComplete,
    #[msg("Circle is already completed")]
    CircleCompleted,
    #[msg("Total rounds must be between 2 and 20")]
    InvalidTotalRounds,
    #[msg("Contribution amount must be greater than zero")]
    InvalidAmount,
    #[msg("Invalid recipient token account")]
    InvalidRecipient,
    #[msg("Grace period has not yet elapsed")]
    GracePeriodNotElapsed,
    #[msg("Member has already contributed this round")]
    MemberAlreadyPaid,
    #[msg("Name too long — maximum 32 bytes")]
    NameTooLong,
    #[msg("Frequency must be a positive number of seconds")]
    InvalidFrequency,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Circle has already been fully completed")]
    AlreadyFinalized,
    #[msg("Circle is not yet completed")]
    NotCompleted,
}

// ============================================================
// State: Circle
// ============================================================

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum CircleStatus {
    Pending,
    Active,
    Completed,
}

#[account]
#[derive(InitSpace)]
pub struct Circle {
    pub creator: Pubkey,
    #[max_len(32)]
    pub name: String,
    pub contribution_amount: u64,
    pub frequency_seconds: i64,
    pub total_rounds: u8,
    pub current_round: u8,
    pub member_count: u8,
    pub status: CircleStatus,
    pub round_start_ts: i64,
    pub vault_bump: u8,
    pub bump: u8,
    pub circle_nonce: u64,
    pub members_joined: u32,
    pub contributions: [u32; MAX_ROUNDS],
    pub payout_order: [Pubkey; MAX_MEMBERS],
}

impl Circle {
    pub fn member_index(&self, member: &Pubkey) -> Option<usize> {
        self.payout_order[..self.member_count as usize]
            .iter()
            .position(|m| m == member)
    }

    pub fn has_joined(&self, index: usize) -> bool {
        self.members_joined & (1u32 << index) != 0
    }

    pub fn set_joined(&mut self, index: usize) {
        self.members_joined |= 1u32 << index;
    }

    pub fn all_joined(&self) -> bool {
        let mask = (1u32 << self.member_count) - 1;
        self.members_joined & mask == mask
    }

    pub fn has_contributed(&self, round_index: usize, member_index: usize) -> bool {
        self.contributions[round_index] & (1u32 << member_index) != 0
    }

    pub fn set_contributed(&mut self, round_index: usize, member_index: usize) {
        self.contributions[round_index] |= 1u32 << member_index;
    }

    pub fn all_contributed(&self, round_index: usize) -> bool {
        let mask = (1u32 << self.member_count) - 1;
        self.contributions[round_index] & mask == mask
    }

    pub fn current_recipient(&self) -> Pubkey {
        self.payout_order[(self.current_round - 1) as usize]
    }
}

// ============================================================
// State: MemberRecord
// ============================================================

#[account]
#[derive(InitSpace)]
pub struct MemberRecord {
    pub member: Pubkey,
    pub circle: Pubkey,
    pub rounds_contributed: u8,
    pub rounds_missed: u8,
    pub received_payout: bool,
    pub payout_round: u8,
    pub completed_circle: bool,
    pub bump: u8,
}

// ============================================================
// Program
// ============================================================

#[program]
pub mod hui {
    use super::*;

    pub fn create_circle(
        ctx: Context<CreateCircle>,
        circle_nonce: u64,
        name: String,
        contribution_amount: u64,
        frequency_seconds: i64,
        total_rounds: u8,
        payout_order: Vec<Pubkey>,
    ) -> Result<()> {
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

        for i in 0..payout_order.len() {
            for j in (i + 1)..payout_order.len() {
                require!(payout_order[i] != payout_order[j], HuiError::DuplicateMember);
            }
        }

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
        circle.members_joined = 0;
        circle.contributions = [0u32; MAX_ROUNDS];

        let mut po = [Pubkey::default(); MAX_MEMBERS];
        for (i, key) in payout_order.iter().enumerate() {
            po[i] = *key;
        }
        circle.payout_order = po;

        msg!("Circle created: {}", circle.name);
        Ok(())
    }

    pub fn join_circle(ctx: Context<JoinCircle>) -> Result<()> {
        let circle = &mut ctx.accounts.circle;
        let member_key = ctx.accounts.member.key();

        let member_index = circle
            .member_index(&member_key)
            .ok_or(HuiError::NotAMember)?;

        require!(!circle.has_joined(member_index), HuiError::AlreadyJoined);
        circle.set_joined(member_index);

        let record = &mut ctx.accounts.member_record;
        record.member = member_key;
        record.circle = circle.key();
        record.rounds_contributed = 0;
        record.rounds_missed = 0;
        record.received_payout = false;
        record.payout_round = (member_index + 1) as u8;
        record.completed_circle = false;
        record.bump = ctx.bumps.member_record;

        msg!("Member {} joined at position {}", member_key, member_index + 1);

        if circle.all_joined() {
            circle.status = CircleStatus::Active;
            circle.current_round = 1;
            let clock = Clock::get()?;
            circle.round_start_ts = clock.unix_timestamp;
            msg!("All members joined — circle Active, round 1 started");
        }

        Ok(())
    }

    pub fn contribute(ctx: Context<Contribute>) -> Result<()> {
        let circle = &mut ctx.accounts.circle;
        let member_key = ctx.accounts.member.key();

        let member_index = circle
            .member_index(&member_key)
            .ok_or(HuiError::NotAMember)?;

        let round_index = (circle.current_round - 1) as usize;

        require!(
            !circle.has_contributed(round_index, member_index),
            HuiError::AlreadyContributed
        );

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

        circle.set_contributed(round_index, member_index);
        ctx.accounts.member_record.rounds_contributed += 1;

        msg!("Member {} contributed for round {}", member_key, circle.current_round);
        Ok(())
    }

    pub fn trigger_payout(ctx: Context<TriggerPayout>) -> Result<()> {
        let circle = &mut ctx.accounts.circle;
        let round_index = (circle.current_round - 1) as usize;

        require!(
            circle.all_contributed(round_index),
            HuiError::RoundNotComplete
        );

        let pot = circle
            .contribution_amount
            .checked_mul(circle.member_count as u64)
            .ok_or(HuiError::Overflow)?;

        let creator_key = circle.creator;
        let nonce_bytes = circle.circle_nonce.to_le_bytes();
        let bump = circle.bump;
        let seeds: &[&[u8]] = &[b"circle", creator_key.as_ref(), &nonce_bytes, &[bump]];
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

        ctx.accounts.recipient_member_record.received_payout = true;

        msg!("Payout {} to round {} recipient", pot, circle.current_round);

        if circle.current_round >= circle.total_rounds {
            circle.status = CircleStatus::Completed;
            msg!("Circle completed");
        } else {
            circle.current_round += 1;
            let clock = Clock::get()?;
            circle.round_start_ts = clock.unix_timestamp;
            msg!("Advanced to round {}", circle.current_round);
        }

        Ok(())
    }

    pub fn mark_missed(ctx: Context<MarkMissed>) -> Result<()> {
        let circle = &ctx.accounts.circle;
        let member_key = ctx.accounts.member.key();

        let member_index = circle
            .member_index(&member_key)
            .ok_or(HuiError::NotAMember)?;

        let round_index = (circle.current_round - 1) as usize;

        require!(
            !circle.has_contributed(round_index, member_index),
            HuiError::MemberAlreadyPaid
        );

        let clock = Clock::get()?;
        let deadline = circle
            .round_start_ts
            .checked_add(circle.frequency_seconds)
            .and_then(|t| t.checked_add(GRACE_PERIOD_SECONDS))
            .ok_or(HuiError::Overflow)?;

        require!(clock.unix_timestamp > deadline, HuiError::GracePeriodNotElapsed);

        ctx.accounts.member_record.rounds_missed += 1;
        msg!("Member {} marked missed for round {}", member_key, circle.current_round);

        Ok(())
    }

    pub fn finalize_member(ctx: Context<FinalizeMember>) -> Result<()> {
        let record = &mut ctx.accounts.member_record;
        require!(!record.completed_circle, HuiError::AlreadyFinalized);
        record.completed_circle = true;
        msg!("Member {} record finalized", record.member);
        Ok(())
    }
}

// ============================================================
// Account Contexts
// ============================================================

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

#[derive(Accounts)]
pub struct TriggerPayout<'info> {
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

    #[account(
        mut,
        constraint = recipient_token_account.mint == vault.mint @ HuiError::InvalidRecipient,
        constraint = recipient_token_account.owner == circle.current_recipient() @ HuiError::InvalidRecipient,
    )]
    pub recipient_token_account: Account<'info, TokenAccount>,

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

#[derive(Accounts)]
pub struct MarkMissed<'info> {
    pub caller: Signer<'info>,

    #[account(
        mut,
        constraint = circle.status == CircleStatus::Active @ HuiError::CircleNotActive,
    )]
    pub circle: Account<'info, Circle>,

    /// CHECK: The member being marked as missed — pubkey only.
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

#[derive(Accounts)]
pub struct FinalizeMember<'info> {
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
