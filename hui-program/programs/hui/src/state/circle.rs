use anchor_lang::prelude::*;

pub const MAX_MEMBERS: usize = 20;
pub const MAX_ROUNDS: usize = 20;
pub const GRACE_PERIOD_SECONDS: i64 = 86_400; // 24 hours

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum CircleStatus {
    Pending,
    Active,
    Completed,
}

/// Main Circle account.
///
/// PDA seeds: ["circle", creator, circle_nonce.to_le_bytes()]
///
/// Key design change from v1: payout_order is no longer set at creation.
/// Instead each member picks their slot when calling join_circle. The slot
/// index determines their payout round. start_circle (creator-only) activates
/// the circle once all slots are filled.
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
    /// How many slots have been claimed so far via join_circle.
    pub slots_filled: u8,
    /// Per-round contribution bitmaps (bit i = member i contributed in round i+1).
    pub contributions: [u32; MAX_ROUNDS],
    /// Payout order built incrementally as members choose slots.
    /// payout_order[i] is the wallet that will receive the pot in round i+1.
    /// Pubkey::default() means slot i is still open.
    pub payout_order: [Pubkey; MAX_MEMBERS],
}

impl Circle {
    /// Find a member's slot index in payout_order. Returns None if not a member.
    pub fn member_index(&self, member: &Pubkey) -> Option<usize> {
        self.payout_order[..self.member_count as usize]
            .iter()
            .position(|m| m == member)
    }

    /// Check if member at `index` has contributed in the given round (0-indexed).
    pub fn has_contributed(&self, round_index: usize, member_index: usize) -> bool {
        self.contributions[round_index] & (1u32 << member_index) != 0
    }

    /// Mark member at `index` as contributed for the given round (0-indexed).
    pub fn set_contributed(&mut self, round_index: usize, member_index: usize) {
        self.contributions[round_index] |= 1u32 << member_index;
    }

    /// True when all members have contributed for the given round (0-indexed).
    pub fn all_contributed(&self, round_index: usize) -> bool {
        let mask = (1u32 << self.member_count) - 1;
        self.contributions[round_index] & mask == mask
    }

    /// Get the recipient pubkey for the current round.
    pub fn current_recipient(&self) -> Pubkey {
        self.payout_order[(self.current_round - 1) as usize]
    }

    /// True when every slot has been claimed.
    pub fn all_slots_filled(&self) -> bool {
        self.slots_filled == self.total_rounds
    }
}
