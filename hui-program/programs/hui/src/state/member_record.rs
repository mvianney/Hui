use anchor_lang::prelude::*;

/// Per-member, per-circle record.
/// PDA seeds: ["member_record", circle.key(), member.key()]
#[account]
#[derive(InitSpace)]
pub struct MemberRecord {
    pub member: Pubkey,
    pub circle: Pubkey,
    /// Display name chosen at join time (max 32 bytes).
    #[max_len(32)]
    pub display_name: String,
    pub rounds_contributed: u8,
    pub rounds_missed: u8,
    pub received_payout: bool,
    /// Which round this member receives the pot (1-indexed = slot + 1).
    pub payout_round: u8,
    pub completed_circle: bool,
    pub bump: u8,
}
