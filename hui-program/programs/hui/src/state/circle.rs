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

/// Main Circle account — holds all circle configuration, membership, and
/// per-round contribution tracking via bitmaps.
///
/// PDA seeds: ["circle", creator, circle_nonce.to_le_bytes()]
///
/// Design choice: contribution tracking uses a bitmap (`[u32; 20]`) rather
/// than separate PDA accounts per (circle, round, member). With a cap of 20
/// members, each u32 holds one round's contribution status (bit i = member i
/// has contributed). Total cost: 80 bytes vs 20×20 = 400 separate accounts.
/// Far cheaper, simpler, and faster to query.
#[account]
#[derive(InitSpace)]
pub struct Circle {
    /// The wallet that created this circle.
    pub creator: Pubkey,
    /// Human-readable circle name (max 32 UTF-8 bytes).
    #[max_len(32)]
    pub name: String,
    /// Per-round contribution in USDC base units (6 decimals, e.g. 50_000_000 = 50 USDC).
    pub contribution_amount: u64,
    /// Seconds between round deadlines.
    pub frequency_seconds: i64,
    /// Total number of rounds (and members). Range: [2, 20].
    pub total_rounds: u8,
    /// Current active round number (1-indexed). 0 when Pending.
    pub current_round: u8,
    /// Actual number of members in this circle (== total_rounds for MVP fixed-order).
    pub member_count: u8,
    /// Circle lifecycle status.
    pub status: CircleStatus,
    /// Unix timestamp when the current round opened.
    pub round_start_ts: i64,
    /// PDA bump for the vault token account.
    pub vault_bump: u8,
    /// PDA bump for this Circle account.
    pub bump: u8,
    /// Unique nonce used in PDA derivation (allows creator to make multiple circles).
    pub circle_nonce: u64,
    /// Bitmap: bit i is set when member i (by index in payout_order) has called join_circle.
    pub members_joined: u32,
    /// Per-round contribution bitmaps. contributions[r] bit i = member i contributed in round r+1.
    pub contributions: [u32; MAX_ROUNDS],
    /// Ordered list of member pubkeys. payout_order[i] receives the pot in round i+1.
    /// Unused slots (index >= member_count) are Pubkey::default().
    pub payout_order: [Pubkey; MAX_MEMBERS],
}

impl Circle {
    /// Find a member's index (position in payout_order). Returns None if not a member.
    pub fn member_index(&self, member: &Pubkey) -> Option<usize> {
        self.payout_order[..self.member_count as usize]
            .iter()
            .position(|m| m == member)
    }

    /// Check if member at `index` has called join_circle.
    pub fn has_joined(&self, index: usize) -> bool {
        self.members_joined & (1u32 << index) != 0
    }

    /// Mark member at `index` as joined.
    pub fn set_joined(&mut self, index: usize) {
        self.members_joined |= 1u32 << index;
    }

    /// True when all members have joined.
    pub fn all_joined(&self) -> bool {
        let mask = (1u32 << self.member_count) - 1;
        self.members_joined & mask == mask
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
}
