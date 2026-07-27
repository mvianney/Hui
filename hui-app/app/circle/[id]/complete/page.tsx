'use client';

import React, { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useHui } from '@/lib/huiContext';
import { useWallet } from '@/components/wallet/WalletButton';

export default function CircleCompletePage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { currentCircle, loadCircle, getMemberReputation, isLoading, addToast } = useHui();
  const { publicKey } = useWallet();

  useEffect(() => {
    if (id) loadCircle(id);
  }, [id, loadCircle]);

  if (isLoading || !currentCircle) {
    return (
      <div className="max-w-lg mx-auto py-12 px-4 text-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="h-8 bg-hui-border rounded w-3/4"></div>
          <div className="h-4 bg-hui-border rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (currentCircle.status !== 'completed') {
    if (typeof window !== 'undefined') router.push(`/circle/${id}`);
    return null;
  }

  const amountUsdc = currentCircle.contributionAmount / 1_000_000;
  const totalPotUsdc = amountUsdc * currentCircle.members.length;
  const frequencyLabel = currentCircle.frequencySeconds === 604800 ? 'Weekly' : 'Monthly';

  const handleShare = () => {
    addToast('Coming soon: downloadable on-chain proof', 'info');
  };

  return (
    <div className="max-w-lg mx-auto py-8 px-4 space-y-8 animate-fadeIn">
      {/* Celebration Header */}
      <div className="text-center space-y-4">
        <div className="w-20 h-20 bg-gradient-to-br from-hui-success to-teal-400 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-teal-200">
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-hui-text">Circle Completed!</h1>
        <p className="text-hui-text-secondary">All rounds have finished and payouts distributed.</p>
      </div>

      {/* Circle Summary */}
      <div className="bg-hui-surface rounded-2xl border border-hui-border shadow-sm p-6 grid grid-cols-2 gap-6">
        <div>
          <p className="text-sm font-medium text-hui-text-secondary mb-1">Total Distributed</p>
          <p className="text-2xl font-bold text-hui-primary">${(totalPotUsdc * currentCircle.totalRounds).toFixed(0)} USDC</p>
        </div>
        <div>
          <p className="text-sm font-medium text-hui-text-secondary mb-1">Rounds</p>
          <p className="text-2xl font-bold text-hui-text">{currentCircle.totalRounds}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-hui-text-secondary mb-1">Per Round Pot</p>
          <p className="text-lg font-bold text-hui-text">${totalPotUsdc.toFixed(0)} USDC</p>
        </div>
        <div>
          <p className="text-sm font-medium text-hui-text-secondary mb-1">Frequency</p>
          <p className="text-lg font-bold text-hui-text">{frequencyLabel}</p>
        </div>
      </div>

      {/* Shareable Reputation Card for connected member */}
      {publicKey && (() => {
        const myMember = currentCircle.members.find(m => m.wallet === publicKey);
        const myRep = publicKey ? getMemberReputation(currentCircle, publicKey) : null;
        if (!myMember || !myRep) return null;
        const completionRate = currentCircle.totalRounds > 0
          ? Math.round((myRep.roundsContributed / currentCircle.totalRounds) * 100)
          : 0;

        return (
          <div className="relative">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-hui-primary to-hui-accent rounded-2xl blur opacity-30"></div>
            <div className="relative bg-stone-900 rounded-2xl p-6 text-white overflow-hidden shadow-xl">
              <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-hui-primary rounded-full opacity-20 blur-xl"></div>

              <div className="flex justify-between items-start mb-6">
                <div>
                  <p className="text-stone-400 text-xs font-bold tracking-widest uppercase mb-1">Hụi On-Chain</p>
                  <h3 className="text-xl font-bold">{currentCircle.name}</h3>
                </div>
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-sm border border-white/20">
                  <svg className="w-5 h-5 text-yellow-300" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-stone-400 text-sm mb-1">Participant</p>
                  <p className="font-bold text-lg">{myMember.displayName || myMember.wallet.slice(0, 8) + '…'}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                    <p className="text-stone-400 text-xs mb-1">Completion Rate</p>
                    <p className={`text-xl font-bold ${completionRate === 100 ? 'text-green-300' : 'text-amber-300'}`}>
                      {completionRate}%
                    </p>
                    <p className="text-stone-500 text-xs">{myRep.roundsContributed}/{currentCircle.totalRounds} rounds</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                    <p className="text-stone-400 text-xs mb-1">Pot Received</p>
                    <p className="text-xl font-bold text-white">${totalPotUsdc.toFixed(0)} USDC</p>
                    <p className="text-stone-500 text-xs">Round {myMember.payoutRound}</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button onClick={handleShare} className="flex-1 bg-white text-stone-900 rounded-xl py-2.5 font-bold text-sm hover:bg-stone-200 transition-colors">
                  Share Proof
                </button>
                <button onClick={handleShare} className="flex-1 bg-white/10 border border-white/20 text-white rounded-xl py-2.5 font-bold text-sm hover:bg-white/20 transition-colors">
                  Download
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* All Member Records */}
      <div>
        <h2 className="text-lg font-bold text-hui-text mb-4">Final Member Records</h2>
        <div className="space-y-3">
          {currentCircle.members.map(member => {
            const rep = getMemberReputation(currentCircle, member.wallet);
            if (!rep) return null;
            const rate = currentCircle.totalRounds > 0
              ? Math.round((rep.roundsContributed / currentCircle.totalRounds) * 100)
              : 0;
            const rateColorBg = rate === 100 ? 'bg-hui-success-light' : rate >= 80 ? 'bg-hui-warning-light' : 'bg-hui-error-light';
            const rateColorText = rate === 100 ? 'text-hui-success' : rate >= 80 ? 'text-hui-warning' : 'text-hui-error';

            return (
              <div key={member.wallet} className="bg-hui-surface rounded-2xl border border-hui-border p-4 flex items-center justify-between">
                <div>
                  <p className="font-bold text-hui-text">{member.displayName || '—'}</p>
                  <p className="text-xs text-hui-text-secondary font-mono">{member.wallet.slice(0, 6)}…{member.wallet.slice(-4)}</p>
                  <p className="text-xs text-hui-text-tertiary mt-1">Received pot in Round {member.payoutRound}</p>
                  {rep.roundsMissed > 0 && (
                    <p className="text-xs text-hui-warning mt-1">Missed {rep.roundsMissed} round{rep.roundsMissed > 1 ? 's' : ''}</p>
                  )}
                </div>
                <div className="flex flex-col items-end">
                  <div className={`px-3 py-1 rounded-full text-sm font-bold ${rateColorBg} ${rateColorText}`}>
                    {rate}%
                  </div>
                  <span className="text-xs text-hui-text-tertiary mt-1">{rep.roundsContributed}/{currentCircle.totalRounds}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="text-center pb-8">
        <button onClick={() => router.push('/')} className="text-hui-primary font-medium hover:underline">
          ← Back to Home
        </button>
      </div>
    </div>
  );
}
