use anchor_lang::prelude::*;

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

    #[msg("Wrong round number — does not match current round")]
    WrongRound,

    #[msg("Already contributed this round")]
    AlreadyContributed,

    #[msg("Round is not yet complete — not all members have contributed")]
    RoundNotComplete,

    #[msg("Circle is already completed")]
    CircleCompleted,

    #[msg("Total rounds must be between 2 and 20")]
    InvalidTotalRounds,

    #[msg("Contribution amount must be greater than zero")]
    InvalidAmount,

    #[msg("Invalid recipient token account")]
    InvalidRecipient,

    #[msg("Grace period has not yet elapsed — cannot mark as missed")]
    GracePeriodNotElapsed,

    #[msg("Member has already contributed this round — cannot mark as missed")]
    MemberAlreadyPaid,

    #[msg("Name too long — maximum 32 bytes")]
    NameTooLong,

    #[msg("Frequency must be a positive number of seconds")]
    InvalidFrequency,

    #[msg("Arithmetic overflow")]
    Overflow,

    #[msg("Circle has already been fully completed")]
    AlreadyFinalized,

    #[msg("Circle is not yet completed — cannot finalize member record")]
    NotCompleted,
}
