'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useHui } from '@/lib/huiContext';
import { useWallet } from '@/components/wallet/WalletButton';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Modal } from '@/components/ui/Modal';
import { Countdown } from '@/components/ui/Countdown';
import Link from 'next/link';

export default function CircleDashboardPage() {
  const { id } = useParams() as { id: string };
  const { currentCircle, loadCircle, contribute, isLoading } = useHui();
  const { connected, publicKey } = useWallet();

  const [isContributeModalOpen, setIsContributeModalOpen] = useState(false);
  const [isContributing, setIsContributing] = useState(false);
  const [expandedRounds, setExpandedRounds] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (id) {
      loadCircle(id);
    }
  }, [id, loadCircle]);

  if (isLoading || !currentCircle) {
    return (
      <div className="max-w-lg mx-auto py-12 px-4 text-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="h-8 bg-hui-border rounded w-3/4"></div>
          <div className="h-4 bg-hui-border rounded w-1/2"></div>
          <div className="w-full h-32 bg-hui-border rounded-2xl mt-4"></div>
          <div className="w-full h-24 bg-hui-border rounded-2xl"></div>
          <div className="w-full h-24 bg-hui-border rounded-2xl"></div>
        </div>
      </div>
    );
  }

  // Completed circle — show banner to completion page
  if (currentCircle.status === 'completed') {
    return (
      <div className="max-w-lg mx-auto py-8 px-4 text-center space-y-6">
        <div className="bg-hui-success-light text-hui-success p-6 rounded-2xl border border-hui-success/30">
          <div className="w-16 h-16 bg-hui-success text-white rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          </div>
          <h1 className="text-2xl font-bold mb-2">Circle Completed!</h1>
          <p className="mb-4 text-hui-success/80">All {currentCircle.totalRounds} rounds of {currentCircle.name} have been completed.</p>
          <Link href={`/circle/${id}/complete`} className="bg-hui-success text-white rounded-xl px-6 py-3 font-medium hover:bg-opacity-90 transition-all inline-block">
            View Final Results & Reputation
          </Link>
        </div>
      </div>
    );
  }

  const currentRound = currentCircle.rounds.find(r => r.roundNumber === currentCircle.currentRound);

  // Determine connected user's contribution status this round
  const hasContributedThisRound = currentRound?.contributionsReceived.some(
    c => c.memberWallet === publicKey && c.status === 'paid'
  );

  const contributionsCount = currentRound?.contributionsReceived.filter(c => c.status === 'paid').length || 0;
  const totalMembers = currentCircle.members.length;

  const currentRecipient = currentCircle.members.find(
    m => m.walletAddress === currentRound?.recipientWallet
  );

  const handleContribute = async () => {
    if (!connected || !publicKey || !currentRound) return;
    setIsContributing(true);
    // Simulate transaction delay
    await new Promise(resolve => setTimeout(resolve, 500));
    contribute(currentCircle.id, publicKey, currentRound.roundNumber);
    setIsContributing(false);
    setIsContributeModalOpen(false);
  };

  const toggleRound = (roundNumber: number) => {
    setExpandedRounds(prev => ({ ...prev, [roundNumber]: !prev[roundNumber] }));
  };

  return (
    <div className="max-w-lg mx-auto py-8 px-4 space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
            currentCircle.status === 'active' ? 'bg-hui-success-light text-hui-success' :
            currentCircle.status === 'pending' ? 'bg-hui-warning-light text-hui-warning' :
            'bg-hui-bg text-hui-text-secondary'
          }`}>
            {currentCircle.status.charAt(0).toUpperCase() + currentCircle.status.slice(1)}
          </span>
          <span className="text-sm font-medium text-hui-text-secondary">
            Round {currentCircle.currentRound} of {currentCircle.totalRounds}
          </span>
        </div>
        <h1 className="text-3xl font-bold text-hui-text">{currentCircle.name}</h1>
        <p className="text-hui-text-secondary">{currentCircle.contributionAmount} USDC · {currentCircle.frequency}</p>

        {currentCircle.status === 'active' && currentRound && (
          <div className="mt-4 inline-block">
            <Countdown targetDate={currentRound.dueDate} label="Next Round Due" />
          </div>
        )}
      </div>

      {/* Pending state */}
      {currentCircle.status === 'pending' && (
        <div className="bg-hui-warning-light/50 rounded-2xl border border-hui-warning/20 p-6 text-center">
          <p className="text-hui-warning font-medium mb-1">Waiting for Members</p>
          <p className="text-sm text-hui-text-secondary">
            {currentCircle.members.filter(m => m.hasJoined).length} of {currentCircle.totalRounds} members have joined.
            Share the invite code to fill remaining slots.
          </p>
          <div className="mt-4 bg-white rounded-xl p-3 border border-hui-border inline-block">
            <span className="text-xs text-hui-text-secondary uppercase tracking-wide">Invite Code</span>
            <p className="text-2xl font-bold tracking-widest text-hui-primary">{currentCircle.inviteCode}</p>
          </div>
        </div>
      )}

      {/* Contribution Progress */}
      {currentCircle.status === 'active' && currentRound && (
        <div className="bg-hui-surface rounded-2xl border border-hui-border shadow-sm p-6 space-y-6">
          <div>
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-lg font-bold text-hui-text">Current Round</h2>
              <span className="text-sm font-medium text-hui-text-secondary">{contributionsCount} of {totalMembers} contributed</span>
            </div>
            <ProgressBar value={(contributionsCount / totalMembers) * 100} color="primary" size="lg" showPercentage />
          </div>

          {currentRecipient && (
            <div className="bg-hui-accent-light/40 rounded-xl p-4 flex items-center gap-3 border border-hui-accent/20">
              <div className="w-10 h-10 rounded-full bg-hui-accent/20 flex items-center justify-center text-hui-accent">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 1a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" /></svg>
              </div>
              <div>
                <p className="text-sm font-bold text-hui-accent">Pot goes to: {currentRecipient.displayName}</p>
                <p className="text-xs text-hui-text-secondary">{currentCircle.contributionAmount * totalMembers} USDC total</p>
              </div>
            </div>
          )}

          {publicKey && !hasContributedThisRound && (
            <button
              onClick={() => setIsContributeModalOpen(true)}
              className="w-full bg-hui-primary text-white rounded-xl px-6 py-4 font-bold text-lg hover:bg-hui-primary-dark transition-all duration-200 shadow-lg shadow-hui-primary/20"
            >
              Contribute {currentCircle.contributionAmount} USDC
            </button>
          )}
          {publicKey && hasContributedThisRound && (
            <div className="w-full bg-hui-success-light text-hui-success rounded-xl px-6 py-3 font-medium text-center flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              You&apos;ve contributed this round
            </div>
          )}
        </div>
      )}

      {/* Member List */}
      <div>
        <h2 className="text-lg font-bold text-hui-text mb-4">Members</h2>
        <div className="space-y-3">
          {currentCircle.members.map(member => {
            const isMe = member.walletAddress === publicKey;
            const isRecipientThisRound = member.walletAddress === currentRound?.recipientWallet;
            const contribution = currentRound?.contributionsReceived.find(
              c => c.memberWallet === member.walletAddress
            );
            const status = contribution?.status || 'pending';

            // Count past missed rounds
            const missedRoundsCount = member.contributionHistory.filter(c => c.status === 'missed').length;

            return (
              <div key={member.walletAddress} className={`bg-hui-surface rounded-2xl border p-4 flex items-center justify-between transition-all ${isMe ? 'border-hui-primary ring-1 ring-hui-primary/30' : 'border-hui-border'}`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-hui-bg flex items-center justify-center text-hui-text font-bold">
                    {member.displayName.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-hui-text">{member.displayName}</span>
                      {isMe && <span className="text-[10px] bg-hui-primary-light text-hui-primary px-2 py-0.5 rounded-full font-bold">YOU</span>}
                    </div>
                    <span className="text-xs text-hui-text-tertiary">{member.walletAddress}</span>

                    {missedRoundsCount > 0 && (
                      <div className="text-[10px] text-hui-warning mt-1">Missed {missedRoundsCount} round{missedRoundsCount > 1 ? 's' : ''}</div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 text-right">
                  {isRecipientThisRound ? (
                    <span className="text-xs bg-hui-accent-light text-hui-accent font-bold px-3 py-1.5 rounded-full flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 1a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" /></svg>
                      Receives Pot
                    </span>
                  ) : (
                    currentCircle.status === 'active' && (
                      <span className="flex items-center gap-1">
                        {status === 'paid' && <svg className="w-5 h-5 text-hui-success" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                        {status === 'pending' && <svg className="w-5 h-5 text-hui-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                        {status === 'missed' && <svg className="w-5 h-5 text-hui-error" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>}
                      </span>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Payout Order */}
      <div>
        <h2 className="text-lg font-bold text-hui-text mb-4">Payout Order</h2>
        <div className="bg-hui-surface rounded-2xl border border-hui-border overflow-hidden">
          {currentCircle.members
            .sort((a, b) => (a.payoutRound ?? 0) - (b.payoutRound ?? 0))
            .map((member, idx) => {
              const roundNumber = member.payoutRound ?? idx + 1;
              const isPast = roundNumber < currentCircle.currentRound;
              const isCurrent = roundNumber === currentCircle.currentRound;

              return (
                <div key={member.walletAddress} className={`flex items-center justify-between p-4 ${idx !== 0 ? 'border-t border-hui-border' : ''} ${isCurrent ? 'bg-hui-accent-light/30' : ''}`}>
                  <div className="flex items-center gap-3">
                    <span className={`font-medium w-6 text-center ${isPast ? 'text-hui-success' : isCurrent ? 'text-hui-accent' : 'text-hui-text-tertiary'}`}>
                      {roundNumber}
                    </span>
                    <span className={`font-medium ${isCurrent ? 'text-hui-accent font-bold' : 'text-hui-text'}`}>
                      {member.displayName} {member.walletAddress === publicKey ? '(You)' : ''}
                    </span>
                  </div>
                  <div className="text-sm">
                    {isPast ? (
                      <span className="text-hui-success flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        Received — Round {roundNumber}
                      </span>
                    ) : isCurrent ? (
                      <span className="text-hui-accent font-medium">This Round</span>
                    ) : (
                      <span className="text-hui-text-tertiary">Round {roundNumber}</span>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Round History (Collapsible) */}
      <div>
        <h2 className="text-lg font-bold text-hui-text mb-4">Round History</h2>
        <div className="space-y-2">
          {currentCircle.rounds
            .filter(r => r.status === 'complete' || r.status === 'open')
            .sort((a, b) => b.roundNumber - a.roundNumber)
            .map(round => {
              const isExpanded = expandedRounds[round.roundNumber];
              const paidCount = round.contributionsReceived.filter(c => c.status === 'paid').length;

              return (
                <div key={round.roundNumber} className="bg-hui-surface rounded-2xl border border-hui-border overflow-hidden">
                  <button
                    onClick={() => toggleRound(round.roundNumber)}
                    className="w-full flex items-center justify-between p-4 hover:bg-hui-bg/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        round.status === 'complete' ? 'bg-hui-success-light text-hui-success' : 'bg-hui-warning-light text-hui-warning'
                      }`}>
                        {round.roundNumber}
                      </span>
                      <span className="font-medium text-hui-text">Round {round.roundNumber}</span>
                      <span className="text-sm text-hui-text-secondary">→ {round.recipientName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-hui-text-tertiary">{paidCount}/{totalMembers} paid</span>
                      <svg className={`w-4 h-4 text-hui-text-tertiary transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-hui-border pt-3 space-y-2">
                      <p className="text-xs text-hui-text-secondary">Due: {new Date(round.dueDate).toLocaleDateString()}</p>
                      {round.contributionsReceived.map(c => {
                        const member = currentCircle.members.find(m => m.walletAddress === c.memberWallet);
                        return (
                          <div key={c.memberWallet} className="flex items-center justify-between text-sm">
                            <span className="text-hui-text">{member?.displayName || c.memberWallet}</span>
                            <span className={c.status === 'paid' ? 'text-hui-success' : c.status === 'missed' ? 'text-hui-error' : 'text-hui-warning'}>
                              {c.status === 'paid' ? '✓ Paid' : c.status === 'missed' ? '✗ Missed' : '⏳ Pending'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>

      {/* Contribute Modal */}
      <Modal isOpen={isContributeModalOpen} onClose={() => !isContributing && setIsContributeModalOpen(false)} title="Confirm Contribution">
        <div className="space-y-6">
          <div className="bg-hui-bg rounded-xl p-6 text-center">
            <p className="text-sm font-medium text-hui-text-secondary mb-1">You are contributing</p>
            <p className="text-3xl font-bold text-hui-primary mb-1">{currentCircle.contributionAmount} USDC</p>
            <p className="text-xs text-hui-text-tertiary mb-4">Round {currentCircle.currentRound} of {currentCircle.totalRounds}</p>
            <div className="bg-white rounded-lg p-3 inline-block border border-hui-border">
              <p className="text-xs text-hui-text-secondary">Recipient this round</p>
              <p className="font-bold text-hui-text">{currentRecipient?.displayName}</p>
            </div>
          </div>

          <button
            onClick={handleContribute}
            disabled={isContributing}
            className="w-full bg-hui-primary text-white rounded-xl px-6 py-4 font-bold hover:bg-hui-primary-dark transition-all duration-200 disabled:opacity-50 flex justify-center items-center gap-2"
          >
            {isContributing ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Confirming Transaction...
              </>
            ) : 'Sign & Submit Contribution'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
