// ============================================================
// Hụi On-Chain — Mock Data Layer
// All functions here simulate what will later be Anchor RPC
// calls. The UI consumes these through HuiContext — swapping
// this file for real Anchor calls requires zero UI changes.
// ============================================================

import {
  Circle,
  Member,
  Round,
  Contribution,
  CreateCircleInput,
  MemberReputation,
  Frequency,
} from './types';

// -----------------------------------------------------------
// Helpers
// -----------------------------------------------------------

function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function addWeeks(date: Date, weeks: number): Date {
  return addDays(date, weeks * 7);
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function getNextDueDate(startDate: Date, roundNumber: number, frequency: Frequency): Date {
  if (frequency === 'weekly') {
    return addWeeks(startDate, roundNumber - 1);
  }
  return addMonths(startDate, roundNumber - 1);
}

// -----------------------------------------------------------
// Vietnamese mock names & realistic data
// -----------------------------------------------------------

const MOCK_WALLETS = [
  '7xKp...3mNv',
  'BqYt...8dFw',
  'Hn5R...kL2j',
  'WcMx...pQ9s',
  'Dj4U...nR7e',
  'Fv8Z...tG1a',
];

const MOCK_NAMES = [
  'Nguyễn Thị Lan',
  'Trần Văn Minh',
  'Phạm Thị Hương',
  'Lê Hoàng Nam',
  'Võ Thị Mai',
  'Đặng Quốc Bảo',
];

// -----------------------------------------------------------
// Seed data: a sample active circle for demo purposes
// -----------------------------------------------------------

function createSeedCircle(): Circle {
  const now = new Date();
  const startDate = addDays(now, -14); // started 2 weeks ago
  const totalRounds = 5;
  const currentRound = 3;
  const frequency: Frequency = 'monthly';
  const contributionAmount = 50; // 50 USDC

  const members: Member[] = MOCK_NAMES.slice(0, 5).map((name, i) => ({
    walletAddress: MOCK_WALLETS[i],
    displayName: name,
    hasJoined: true,
    contributionHistory: [],
    hasReceivedPayout: i < currentRound - 1, // rounds 1 & 2 already paid out
    payoutRound: i + 1,
  }));

  const rounds: Round[] = [];

  // Completed rounds (1 & 2)
  for (let r = 1; r <= currentRound - 1; r++) {
    const contributions: Contribution[] = members.map((m) => ({
      memberWallet: m.walletAddress,
      roundNumber: r,
      status: 'paid' as const,
      paidAt: addDays(startDate, (r - 1) * 30 + Math.floor(Math.random() * 3)).toISOString(),
    }));

    members.forEach((m) => {
      m.contributionHistory.push(
        contributions.find((c) => c.memberWallet === m.walletAddress)!
      );
    });

    rounds.push({
      roundNumber: r,
      dueDate: getNextDueDate(startDate, r, frequency).toISOString(),
      recipientWallet: members[r - 1].walletAddress,
      recipientName: members[r - 1].displayName,
      contributionsReceived: contributions,
      status: 'complete',
    });
  }

  // Current round (3) — some members have paid, some haven't
  const currentContributions: Contribution[] = members.map((m, i) => ({
    memberWallet: m.walletAddress,
    roundNumber: currentRound,
    status: i < 3 ? ('paid' as const) : ('pending' as const),
    paidAt: i < 3 ? addDays(now, -Math.floor(Math.random() * 3)).toISOString() : undefined,
  }));

  members.forEach((m) => {
    m.contributionHistory.push(
      currentContributions.find((c) => c.memberWallet === m.walletAddress)!
    );
  });

  rounds.push({
    roundNumber: currentRound,
    dueDate: getNextDueDate(startDate, currentRound, frequency).toISOString(),
    recipientWallet: members[currentRound - 1].walletAddress,
    recipientName: members[currentRound - 1].displayName,
    contributionsReceived: currentContributions,
    status: 'open',
  });

  // Future rounds (4 & 5)
  for (let r = currentRound + 1; r <= totalRounds; r++) {
    rounds.push({
      roundNumber: r,
      dueDate: getNextDueDate(startDate, r, frequency).toISOString(),
      recipientWallet: members[r - 1].walletAddress,
      recipientName: members[r - 1].displayName,
      contributionsReceived: [],
      status: 'upcoming',
    });
  }

  return {
    id: 'hui-demo-001',
    name: 'Hụi Gia Đình Nguyễn',
    inviteCode: 'HUI5NK',
    contributionAmount,
    frequency,
    totalRounds,
    currentRound,
    members,
    payoutOrder: members.map((m) => m.walletAddress),
    rounds,
    status: 'active',
    createdAt: startDate.toISOString(),
    organizerWallet: MOCK_WALLETS[0],
  };
}

// A completed circle for the reputation demo
function createCompletedCircle(): Circle {
  const startDate = addDays(new Date(), -150);
  const totalRounds = 4;
  const frequency: Frequency = 'monthly';
  const contributionAmount = 25;

  const memberNames = ['Bùi Thị Ngọc', 'Hoàng Văn Tùng', 'Ngô Thị Yến', 'Đỗ Minh Quân'];
  const memberWallets = ['Ak3P...vN8x', 'Rm7L...bH2q', 'Ys9D...fJ4w', 'Ct6K...gM1z'];

  const members: Member[] = memberNames.map((name, i) => {
    const contributions: Contribution[] = [];
    for (let r = 1; r <= totalRounds; r++) {
      // Member index 2 missed round 3
      const isMissed = i === 2 && r === 3;
      contributions.push({
        memberWallet: memberWallets[i],
        roundNumber: r,
        status: isMissed ? 'missed' : 'paid',
        paidAt: isMissed ? undefined : addDays(startDate, (r - 1) * 30 + i).toISOString(),
      });
    }

    return {
      walletAddress: memberWallets[i],
      displayName: name,
      hasJoined: true,
      contributionHistory: contributions,
      hasReceivedPayout: true,
      payoutRound: i + 1,
    };
  });

  const rounds: Round[] = [];
  for (let r = 1; r <= totalRounds; r++) {
    rounds.push({
      roundNumber: r,
      dueDate: getNextDueDate(startDate, r, frequency).toISOString(),
      recipientWallet: memberWallets[r - 1],
      recipientName: memberNames[r - 1],
      contributionsReceived: members.map((m) => m.contributionHistory[r - 1]),
      status: 'complete',
    });
  }

  return {
    id: 'hui-demo-002',
    name: 'Hụi Bạn Thân',
    inviteCode: 'HUI9BT',
    contributionAmount,
    frequency,
    totalRounds,
    currentRound: totalRounds,
    members,
    payoutOrder: memberWallets,
    rounds,
    status: 'completed',
    createdAt: startDate.toISOString(),
    organizerWallet: memberWallets[0],
  };
}

// -----------------------------------------------------------
// In-memory state
// -----------------------------------------------------------

let circles: Circle[] = [createSeedCircle(), createCompletedCircle()];

// -----------------------------------------------------------
// Public API — consumed by HuiContext
// -----------------------------------------------------------

export function getCircles(): Circle[] {
  return [...circles];
}

export function getCircle(id: string): Circle | undefined {
  return circles.find((c) => c.id === id);
}

export function getCircleByInviteCode(code: string): Circle | undefined {
  return circles.find((c) => c.inviteCode.toUpperCase() === code.toUpperCase());
}

export function createCircle(
  input: CreateCircleInput,
  organizerWallet: string
): Circle {
  const id = generateId();
  const inviteCode = generateInviteCode();
  const now = new Date();

  // The organizer is the first member, rest are placeholders
  const members: Member[] = input.memberNames.map((name, i) => ({
    walletAddress: i === 0 ? organizerWallet : `slot-${i}-${generateId()}`,
    displayName: name,
    hasJoined: i === 0, // only organizer is joined initially
    contributionHistory: [],
    hasReceivedPayout: false,
    payoutRound: i + 1,
  }));

  const rounds: Round[] = [];
  for (let r = 1; r <= input.totalRounds; r++) {
    rounds.push({
      roundNumber: r,
      dueDate: getNextDueDate(now, r, input.frequency).toISOString(),
      recipientWallet: members[r - 1]?.walletAddress ?? '',
      recipientName: members[r - 1]?.displayName ?? '',
      contributionsReceived: [],
      status: r === 1 ? 'open' : 'upcoming',
    });
  }

  const circle: Circle = {
    id,
    name: input.name,
    inviteCode,
    contributionAmount: input.contributionAmount,
    frequency: input.frequency,
    totalRounds: input.totalRounds,
    currentRound: 1,
    members,
    payoutOrder: members.map((m) => m.walletAddress),
    rounds,
    status: members.filter((m) => m.hasJoined).length === input.totalRounds ? 'active' : 'pending',
    createdAt: now.toISOString(),
    organizerWallet,
  };

  circles = [...circles, circle];
  return circle;
}

export function joinCircle(
  circleId: string,
  walletAddress: string,
  displayName: string
): Circle | undefined {
  const circle = circles.find((c) => c.id === circleId);
  if (!circle) return undefined;

  // Find first un-joined slot
  const slot = circle.members.find((m) => !m.hasJoined && m.walletAddress.startsWith('slot-'));
  if (!slot) return undefined;

  slot.walletAddress = walletAddress;
  slot.displayName = displayName;
  slot.hasJoined = true;

  // Update payout order
  const idx = circle.payoutOrder.indexOf(slot.walletAddress);
  if (idx === -1) {
    // Find old slot address and replace it
    const oldSlotIdx = circle.payoutOrder.findIndex((w) => w.startsWith('slot-'));
    if (oldSlotIdx !== -1) {
      circle.payoutOrder[oldSlotIdx] = walletAddress;
    }
  }

  // Update round recipients if needed
  circle.rounds.forEach((r) => {
    if (r.recipientWallet.startsWith('slot-')) {
      const memberForRound = circle.members.find((m) => m.payoutRound === r.roundNumber);
      if (memberForRound && memberForRound.hasJoined) {
        r.recipientWallet = memberForRound.walletAddress;
        r.recipientName = memberForRound.displayName;
      }
    }
  });

  // Check if circle should become active
  if (circle.members.every((m) => m.hasJoined)) {
    circle.status = 'active';
  }

  circles = circles.map((c) => (c.id === circleId ? circle : c));
  return circle;
}

export function contribute(
  circleId: string,
  walletAddress: string,
  roundNumber: number
): Circle | undefined {
  const circle = circles.find((c) => c.id === circleId);
  if (!circle) return undefined;

  const round = circle.rounds.find((r) => r.roundNumber === roundNumber);
  if (!round) return undefined;

  // Update the contribution in the round
  const existing = round.contributionsReceived.find(
    (c) => c.memberWallet === walletAddress
  );
  if (existing) {
    existing.status = 'paid';
    existing.paidAt = new Date().toISOString();
  } else {
    round.contributionsReceived.push({
      memberWallet: walletAddress,
      roundNumber,
      status: 'paid',
      paidAt: new Date().toISOString(),
    });
  }

  // Update member's contribution history
  const member = circle.members.find((m) => m.walletAddress === walletAddress);
  if (member) {
    const histEntry = member.contributionHistory.find(
      (c) => c.roundNumber === roundNumber
    );
    if (histEntry) {
      histEntry.status = 'paid';
      histEntry.paidAt = new Date().toISOString();
    } else {
      member.contributionHistory.push({
        memberWallet: walletAddress,
        roundNumber,
        status: 'paid',
        paidAt: new Date().toISOString(),
      });
    }
  }

  // Check if round is complete (all members paid)
  const allPaid = circle.members.every((m) =>
    round.contributionsReceived.some(
      (c) => c.memberWallet === m.walletAddress && c.status === 'paid'
    )
  );

  if (allPaid) {
    round.status = 'complete';

    // Mark recipient as having received payout
    const recipient = circle.members.find(
      (m) => m.walletAddress === round.recipientWallet
    );
    if (recipient) {
      recipient.hasReceivedPayout = true;
    }

    // Advance to next round if there is one
    const nextRound = circle.rounds.find(
      (r) => r.roundNumber === roundNumber + 1
    );
    if (nextRound) {
      circle.currentRound = nextRound.roundNumber;
      nextRound.status = 'open';

      // Initialize pending contributions for new round
      circle.members.forEach((m) => {
        nextRound.contributionsReceived.push({
          memberWallet: m.walletAddress,
          roundNumber: nextRound.roundNumber,
          status: 'pending',
        });
        m.contributionHistory.push({
          memberWallet: m.walletAddress,
          roundNumber: nextRound.roundNumber,
          status: 'pending',
        });
      });
    } else {
      // All rounds complete
      circle.status = 'completed';
    }
  }

  circles = circles.map((c) => (c.id === circleId ? circle : c));
  return circle;
}

export function getMemberReputation(
  circle: Circle,
  walletAddress: string
): MemberReputation | undefined {
  const member = circle.members.find((m) => m.walletAddress === walletAddress);
  if (!member) return undefined;

  const paid = member.contributionHistory.filter((c) => c.status === 'paid').length;
  const missed = member.contributionHistory.filter((c) => c.status === 'missed').length;
  const total = paid + missed;

  return {
    walletAddress: member.walletAddress,
    displayName: member.displayName,
    circleName: circle.name,
    totalRounds: circle.totalRounds,
    roundsCompleted: paid,
    roundsMissed: missed,
    payoutReceived: member.hasReceivedPayout,
    payoutRound: member.payoutRound ?? 0,
    completionRate: total > 0 ? Math.round((paid / total) * 100) : 100,
    completedAt: circle.rounds[circle.rounds.length - 1]?.dueDate ?? new Date().toISOString(),
  };
}

// -----------------------------------------------------------
// Reset — useful for testing
// -----------------------------------------------------------

export function resetMockData(): void {
  circles = [createSeedCircle(), createCompletedCircle()];
}
