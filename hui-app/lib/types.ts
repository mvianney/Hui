// ============================================================
// Hụi On-Chain — Frontend Types (v2: slot-picker flow)
// ============================================================

export type Frequency = 'weekly' | 'monthly';

export type CircleStatus = 'pending' | 'active' | 'completed';

/** One slot in the payout order. null = open/unclaimed. */
export interface Slot {
  index: number;          // 0-indexed position
  round: number;          // 1-indexed payout round (index + 1)
  member: Member | null;  // null if unclaimed
}

export interface Member {
  wallet: string;         // base58 pubkey
  displayName: string;
  slotIndex: number;      // 0-indexed
  payoutRound: number;    // 1-indexed
  roundsContributed: number;
  roundsMissed: number;
  receivedPayout: boolean;
}

export interface Circle {
  id: string;             // circle PDA base58
  name: string;
  creator: string;        // creator wallet base58
  contributionAmount: number;   // in USDC base units (6 decimals)
  frequencySeconds: number;
  totalRounds: number;
  currentRound: number;
  slotsFilled: number;
  status: CircleStatus;
  roundStartTs: number;
  vaultBalance?: number;
  slots: Slot[];          // length === totalRounds
  members: Member[];      // only filled slots
  inviteCode?: string;    // derived from circle PDA for sharing
}

export interface CreateCircleInput {
  name: string;
  contributionAmount: number;
  frequency: Frequency;
  totalMembers: number;
}

export interface MemberReputation {
  wallet: string;
  displayName: string;
  roundsContributed: number;
  roundsMissed: number;
  receivedPayout: boolean;
}
