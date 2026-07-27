use anchor_lang::prelude::*;

#[error_code]
pub enum HuiError {
    #[msg("Circle name exceeds 32 bytes")]
    NameTooLong,
    #[msg("Contribution amount must be greater than zero")]
    InvalidAmount,
    #[msg("Frequency must be greater than zero")]
    InvalidFrequency,
    #[msg("Total rounds must be between 2 and 20")]
    InvalidTotalRounds,
    #[msg("Circle is not in Pending status")]
    CircleNotPending,
    #[msg("Circle is not in Active status")]
    CircleNotActive,
    #[msg("Circle is not completed")]
    NotCompleted,
    #[msg("Member has already joined this circle")]
    AlreadyJoined,
    #[msg("Not a member of this circle")]
    NotAMember,
    #[msg("Member has already contributed this round")]
    AlreadyContributed,
    #[msg("Member has already received their payout")]
    AlreadyReceivedPayout,
    #[msg("Round is not yet complete — not all members have contributed")]
    RoundNotComplete,
    #[msg("Invalid recipient for this round")]
    InvalidRecipient,
    #[msg("Grace period has not elapsed yet")]
    GracePeriodNotElapsed,
    #[msg("Member has already been marked as missed this round")]
    AlreadyMissed,
    #[msg("Member has already paid this round")]
    MemberAlreadyPaid,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Chosen slot is out of bounds for this circle")]
    SlotOutOfBounds,
    #[msg("That slot has already been taken by another member")]
    SlotAlreadyTaken,
    #[msg("Not all slots are filled — cannot start circle yet")]
    NotAllSlotsFilled,
    #[msg("Only the circle creator can perform this action")]
    Unauthorized,
    #[msg("Member record has already been finalized")]
    AlreadyFinalized,
}
