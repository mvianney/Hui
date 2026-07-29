'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useHui } from '@/lib/huiContext';
import { useWallet } from '@/components/wallet/WalletButton';
import { Circle } from '@/lib/types';
import { ProgressBar } from '@/components/ui/ProgressBar';

function statusBadge(status: string) {
  if (status === 'active') return <span className="badge badge-success">Active</span>;
  if (status === 'pending') return <span className="badge badge-warning">Pending</span>;
  return <span className="badge badge-info">Completed</span>;
}

function truncate(addr: string) {
  return addr.slice(0, 4) + '…' + addr.slice(-4);
}

export default function CircleDashboard() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { publicKey } = useWallet();
  const { loadCircle, startCircle, contribute, triggerPayout, isLoading } = useHui();

  const [circle, setCircle] = useState<Circle | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));

  const refresh = useCallback(async () => {
    const c = await loadCircle(id);
    setCircle(c);
    setLoading(false);
  }, [id, loadCircle]);

  useEffect(() => { refresh(); }, [refresh]);

  // Tick the countdown clock
  useEffect(() => {
    if (!circle || circle.status !== 'active') return;
    const interval = setInterval(() => {
      setNow(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [circle]);

  // Poll for state updates while pending (members joining)
  useEffect(() => {
    if (!circle || circle.status !== 'pending') return;
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [circle, refresh]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-hui-bg">
        <div className="text-hui-text-secondary animate-pulse">Loading circle…</div>
      </div>
    );
  }

  if (!circle) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-hui-bg px-4">
        <div className="card text-center max-w-sm">
          <p className="text-hui-text font-medium mb-2">Circle not found</p>
          <button onClick={() => router.push('/')} className="btn-ghost text-sm">← Back home</button>
        </div>
      </div>
    );
  }

  const isCreator = publicKey === circle.creator;
  const allSlotsFilled = circle.slotsFilled === circle.totalRounds;
  const slotsOpen = circle.totalRounds - circle.slotsFilled;
  const potAmount = (circle.contributionAmount * circle.totalRounds / 1_000_000).toFixed(0);
  const myMember = circle.members.find(m => m.wallet === publicKey);
  const mySlotIndex = circle.slots.find(s => s.member?.wallet === publicKey)?.index;
  
  const hasPaidCurrentRound = circle.status === 'active' && mySlotIndex !== undefined
    ? (circle.contributions[circle.currentRound - 1] & (1 << mySlotIndex)) !== 0
    : false;

  const roundIndex = circle.status === 'active' ? circle.currentRound - 1 : 0;
  const expectedMask = (1 << circle.totalRounds) - 1;
  const currentMask = circle.contributions && circle.contributions[roundIndex] !== undefined
    ? circle.contributions[roundIndex]
    : 0;
  const isRoundFullyPaid = circle.status === 'active' && (currentMask & expectedMask) === expectedMask;

  const currentRecipient = circle.status === 'active'
    ? circle.slots[circle.currentRound - 1]?.member
    : null;
  const recipientName = currentRecipient?.displayName || (currentRecipient ? truncate(currentRecipient.wallet) : 'Recipient');

  // Timeline splits
  const totalCycle = circle.frequencySeconds;
  const windowSeconds = Math.floor(totalCycle * 5 / 7);
  const contributionDeadlineTs = circle.roundStartTs + windowSeconds;
  const secondsRemaining = contributionDeadlineTs - now;
  const isOverdue = secondsRemaining < 0;

  function formatCountdown(sec: number) {
    if (sec <= 0) return 'Payment window closed (Overdue)';
    const days = Math.floor(sec / (24 * 3600));
    const hours = Math.floor((sec % (24 * 3600)) / 3600);
    const minutes = Math.floor((sec % 3600) / 60);
    const seconds = sec % 60;
    
    const segments = [];
    if (days > 0) segments.push(`${days}d`);
    if (hours > 0 || days > 0) segments.push(`${hours}h`);
    if (minutes > 0 || hours > 0 || days > 0) segments.push(`${minutes}m`);
    segments.push(`${seconds}s`);
    return segments.join(' ') + ' remaining';
  }

  async function handleStart() {
    const ok = await startCircle(circle!.id);
    if (ok) await refresh();
  }

  async function handleContribute() {
    const ok = await contribute(circle!.id);
    if (ok) await refresh();
  }

  async function handleReleasePayout() {
    const ok = await triggerPayout(circle!.id);
    if (ok) await refresh();
  }

  return (
    <div className="min-h-screen bg-hui-bg px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-5">

        {/* Header */}
        <div className="card">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold text-hui-text">{circle.name}</h1>
                {statusBadge(circle.status)}
              </div>
              <p className="text-sm text-hui-text-secondary">
                ${(circle.contributionAmount / 1_000_000).toFixed(0)} USDC per round ·{' '}
                {circle.frequencySeconds === 604800 ? 'Weekly' : 'Monthly'}{' '}
                {circle.status === 'active' && circle.roundStartTs > 0 ? (
                  <span>
                    (Due:{' '}
                    {new Date(contributionDeadlineTs * 1000).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                    )
                  </span>
                ) : (
                  <span>(Due: TBD)</span>
                )} ·{' '}
                {circle.totalRounds} members
              </p>
            </div>
            <div className="flex gap-6">
              {circle.vaultBalance !== undefined && circle.vaultBalance > 0 && (
                <div className="text-right">
                  <p className="text-xs text-hui-text-tertiary mb-0.5">Vault Escrow</p>
                  <p className="text-2xl font-bold text-hui-text">${(circle.vaultBalance / 1_000_000).toFixed(2)}</p>
                </div>
              )}
              <div className="text-right">
                <p className="text-xs text-hui-text-tertiary mb-0.5">Pot per round</p>
                <p className="text-2xl font-bold text-hui-primary">${potAmount}</p>
              </div>
            </div>
          </div>

          {circle.status === 'active' && (
            <div className="mt-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-hui-text-secondary font-medium">Round {circle.currentRound} of {circle.totalRounds}</span>
                {currentRecipient && (
                  <span className="text-hui-text-secondary">
                    Payout → <strong>{currentRecipient.displayName || truncate(currentRecipient.wallet)}</strong>
                  </span>
                )}
              </div>
              <ProgressBar
                value={(circle.currentRound / circle.totalRounds) * 100}
                color="primary"
                size="md"
              />
            </div>
          )}
        </div>

        {/* Slot grid — visible when pending or active */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-hui-text">
              {circle.status === 'pending' ? 'Slots' : 'Payout Order'}
            </h2>
            {circle.status === 'pending' && (
              <span className="text-sm text-hui-text-secondary">
                {slotsOpen} open · {circle.slotsFilled} filled
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {circle.slots.map(slot => {
              const isFilled = slot.member !== null;
              const isMe = slot.member?.wallet === publicKey;
              const isPaying = circle.status === 'active' && circle.currentRound === slot.round;
              return (
                <div
                  key={slot.index}
                  className={[
                    'rounded-xl border-2 p-3 transition-all',
                    isPaying ? 'border-hui-primary bg-hui-primary-light' :
                    isMe ? 'border-teal-400 bg-teal-50' :
                    isFilled ? 'border-stone-200 bg-stone-50' :
                    'border-dashed border-stone-300 bg-white',
                  ].join(' ')}
                >
                  <div className="flex items-start justify-between mb-1">
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${isPaying ? 'bg-hui-primary text-white' : 'bg-stone-100 text-stone-500'}`}>
                      Round {slot.round}
                    </span>
                    {isMe && <span className="text-xs text-teal-600 font-medium">You</span>}
                    {isPaying && !isMe && <span className="text-xs text-hui-primary font-medium">↑ Receiving</span>}
                  </div>
                  {isFilled ? (
                    <>
                      <p className="font-semibold text-hui-text text-sm truncate mt-1">{slot.member!.displayName || '—'}</p>
                      <p className="text-xs text-hui-text-tertiary font-mono truncate">{truncate(slot.member!.wallet)}</p>
                    </>
                  ) : (
                    <div className="mt-1">
                      <p className="text-sm text-stone-400 italic">Open slot</p>
                      <button
                        onClick={() => router.push(`/join?code=${circle.inviteCode}`)}
                        className="text-xs text-hui-primary font-medium hover:underline mt-0.5"
                      >
                        Share invite →
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Pending actions */}
        {circle.status === 'pending' && (
          <div className="card">
            <h3 className="font-semibold text-hui-text mb-3">
              {allSlotsFilled ? 'Pending Start' : 'Waiting for Members'}
            </h3>
            <ProgressBar
              value={(circle.slotsFilled / circle.totalRounds) * 100}
              label={`${circle.slotsFilled} of ${circle.totalRounds} slots filled`}
              showPercentage
              color={allSlotsFilled ? 'success' : 'warning'}
            />

            {!myMember && (
              <button
                onClick={() => router.push(`/join?code=${circle.inviteCode}`)}
                className="btn-secondary w-full mt-4"
              >
                Join this circle & pick your slot
              </button>
            )}

            {isCreator && (
              <div className={`mt-4 rounded-xl p-4 ${allSlotsFilled ? 'bg-hui-success-light' : 'bg-stone-50'}`}>
                <p className="text-sm font-medium mb-2">
                  {allSlotsFilled
                    ? '✅ All slots filled — ready to start!'
                    : `⏳ Waiting for ${slotsOpen} more member${slotsOpen !== 1 ? 's' : ''}`}
                </p>
                <p className="text-xs text-hui-text-secondary mb-3">
                  Only you (the creator) can start the circle. Once started, contributions begin immediately.
                </p>
                <button
                  onClick={handleStart}
                  disabled={!allSlotsFilled || isLoading}
                  className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Starting…' : 'Start Circle'}
                </button>
              </div>
            )}

            {/* Invite code */}
            <div className="mt-4 bg-hui-primary-light rounded-xl p-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-hui-text-secondary mb-0.5">Invite Code</p>
                <p className="font-bold text-hui-primary tracking-widest font-mono">{circle.inviteCode}</p>
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(`${window.location.origin}/join?code=${circle.inviteCode}`)}
                className="btn-secondary text-sm px-3 py-1.5"
              >
                Copy Link
              </button>
            </div>
          </div>
        )}

        {/* Active actions */}
        {circle.status === 'active' && myMember && (
          <div className="space-y-4">
            {/* Contribution Box */}
            <div className="card">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold text-hui-text">Round {circle.currentRound} Contribution</h3>
                {circle.status === 'active' && !hasPaidCurrentRound && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isOverdue ? 'bg-hui-error-light text-hui-error' : 'bg-hui-primary-light text-hui-primary'}`}>
                    {isOverdue ? 'Overdue' : formatCountdown(secondsRemaining)}
                  </span>
                )}
              </div>
              <p className="text-sm text-hui-text-secondary mb-4">
                {hasPaidCurrentRound 
                  ? 'Your contribution for this round has been successfully recorded on-chain.'
                  : isOverdue
                  ? `Payment window is closed, but you can still submit your $${(circle.contributionAmount / 1_000_000).toFixed(0)} USDC contribution late.`
                  : `Contribute $${(circle.contributionAmount / 1_000_000).toFixed(0)} USDC to the vault.`}
              </p>
              <button
                onClick={handleContribute}
                disabled={isLoading || hasPaidCurrentRound}
                className={[
                  'btn-primary w-full transition-all duration-200',
                  hasPaidCurrentRound 
                    ? 'bg-stone-100 hover:bg-stone-100 text-stone-400 border border-stone-200 cursor-not-allowed opacity-80'
                    : ''
                ].join(' ')}
              >
                {isLoading 
                  ? 'Sending…' 
                  : hasPaidCurrentRound 
                  ? '✓ Contributed — waiting for others' 
                  : `Contribute $${(circle.contributionAmount / 1_000_000).toFixed(0)} USDC`}
              </button>
            </div>

            {/* Safety Fallback Payout Button */}
            {isRoundFullyPaid && isCreator && (
              <div className="card bg-hui-warning-light border border-hui-warning/30">
                <h3 className="font-semibold text-hui-text mb-1 text-hui-warning">Payout Fallback Required</h3>
                <p className="text-sm text-hui-text-secondary mb-4">
                  All members have paid, but the automated payout transaction failed or didn&apos;t trigger. Use this button to manually release the pot to <strong>{recipientName}</strong>.
                </p>
                <button
                  onClick={handleReleasePayout}
                  disabled={isLoading}
                  className="btn-primary w-full bg-hui-warning hover:bg-amber-600 border-none"
                >
                  {isLoading ? 'Processing…' : `Release Pot to ${recipientName}`}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Completed */}
        {circle.status === 'completed' && (
          <div className="card bg-hui-success-light border-hui-success text-center">
            <div className="text-3xl mb-2">🎊</div>
            <h3 className="font-bold text-hui-text mb-1">Circle Complete</h3>
            <p className="text-sm text-hui-text-secondary">All {circle.totalRounds} rounds finished. Everyone received their payout.</p>
            <button onClick={() => router.push('/')} className="btn-primary mt-4">Back to Home</button>
          </div>
        )}
      </div>
    </div>
  );
}
