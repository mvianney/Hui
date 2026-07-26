// ============================================================
// Hụi On-Chain — Core Types
// These mirror the future on-chain Anchor account structures.
// When swapping mock → real, only the data-fetching layer changes;
// these types stay the same.
// ============================================================

export type CircleStatus = 'pending' | 'active' | 'completed';
export type RoundStatus = 'upcoming' | 'open' | 'complete' | 'missed';
export type ContributionStatus = 'pending' | 'paid' | 'missed';
export type Frequency = 'weekly' | 'monthly';

export interface Contribution {
  memberWallet: string;
  roundNumber: number;
  status: ContributionStatus;
  paidAt?: string; // ISO date string
}

export interface Member {
  walletAddress: string;
  displayName: string;
  hasJoined: boolean;
  contributionHistory: Contribution[];
  hasReceivedPayout: boolean;
  payoutRound?: number; // which round this member receives the pot
}

export interface Round {
  roundNumber: number;
  dueDate: string; // ISO date string
  recipientWallet: string;
  recipientName: string;
  contributionsReceived: Contribution[];
  status: RoundStatus;
}

export interface Circle {
  id: string;
  name: string;
  inviteCode: string;
  contributionAmount: number; // in USDC
  frequency: Frequency;
  totalRounds: number;
  currentRound: number;
  members: Member[];
  payoutOrder: string[]; // wallet addresses in payout order
  rounds: Round[];
  status: CircleStatus;
  createdAt: string; // ISO date string
  organizerWallet: string;
}

// -----------------------------------------------------------
// Form / Action types (for create, join, contribute flows)
// -----------------------------------------------------------

export interface CreateCircleInput {
  name: string;
  contributionAmount: number;
  frequency: Frequency;
  totalRounds: number;
  memberNames: string[]; // display names in payout order
}

export interface JoinCircleInput {
  inviteCode: string;
  displayName: string;
}

export interface ContributeInput {
  circleId: string;
  roundNumber: number;
}

// -----------------------------------------------------------
// Reputation / completion summary
// -----------------------------------------------------------

export interface MemberReputation {
  walletAddress: string;
  displayName: string;
  circleName: string;
  totalRounds: number;
  roundsCompleted: number;
  roundsMissed: number;
  payoutReceived: boolean;
  payoutRound: number;
  completionRate: number; // 0–100
  completedAt: string; // ISO date string
}
