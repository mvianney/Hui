use anchor_lang::prelude::*;

/// Per-member, per-circle reputation record.
/// Tracks contribution history and payout status for the on-chain reputation feature.
///
/// PDA seeds: ["member_record", circle.key(), member.key()]
#[account]
#[derive(InitSpace)]
pub struct MemberRecord {
    /// The member's wallet.
    pub member: Pubkey,
    /// The circle this record belongs to.
    pub circle: Pubkey,
    /// Number of rounds this member successfully contributed.
    pub rounds_contributed: u8,
    /// Number of rounds this member was marked as missed.
    pub rounds_missed: u8,
    /// Whether this member has received their payout.
    pub received_payout: bool,
    /// Which round this member is scheduled to receive the pot (1-indexed).
    pub payout_round: u8,
    /// Set to true when the circle reaches Completed status.
    pub completed_circle: bool,
    /// PDA bump.
    pub bump: u8,
}
