'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useHui } from '@/lib/huiContext';
import { useWallet } from '@/components/wallet/WalletButton';
import { Circle } from '@/lib/types';

function JoinInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { connected, publicKey } = useWallet();
  const { lookupInviteCode, joinCircle, isLoading } = useHui();

  const [code, setCode] = useState(searchParams.get('code') ?? '');
  const [circle, setCircle] = useState<Circle | null>(null);
  const [lookupError, setLookupError] = useState('');
  const [looking, setLooking] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [nameError, setNameError] = useState('');
  const [joined, setJoined] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (code.length === 8) handleLookup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLookup() {
    setLookupError('');
    setCircle(null);
    setSelectedSlot(null);
    setIsExpanded(false);
    if (code.length < 6) { setLookupError('Code must be at least 6 characters'); return; }
    setLooking(true);
    const found = await lookupInviteCode(code);
    setLooking(false);
    if (!found) { setLookupError('No circle found with this code'); return; }
    if (found.status !== 'pending') { setLookupError('This circle is no longer accepting members'); return; }
    setCircle(found);
  }

  async function handleJoin() {
    if (!connected) return;
    if (selectedSlot === null) { setNameError('Pick a slot first'); return; }
    if (!displayName.trim()) { setNameError('Display name is required'); return; }
    setNameError('');
    const ok = await joinCircle(circle!.id, selectedSlot, displayName.trim());
    if (ok) setJoined(true);
  }

  const mySlot = circle?.slots.find(s => s.member?.wallet === publicKey);
  const creatorMember = circle?.members.find(m => m.wallet === circle.creator);
  const creatorName = creatorMember?.displayName || (circle ? circle.creator.slice(0, 6) + '…' : '');

  if (!connected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-hui-bg px-4">
        <div className="card text-center max-w-sm w-full">
          <div className="text-4xl mb-4">🔗</div>
          <h1 className="text-xl font-bold text-hui-text mb-2">Connect Your Wallet</h1>
          <p className="text-hui-text-secondary text-sm">You need a connected wallet to join a circle.</p>
        </div>
      </div>
    );
  }

  if (joined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-hui-bg px-4">
        <div className="card text-center max-w-sm w-full">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-2xl font-bold text-hui-text mb-2">You&apos;re In!</h1>
          <p className="text-hui-text-secondary text-sm mb-6">
            You claimed Slot {selectedSlot! + 1} — you&apos;ll receive the payout in Round {selectedSlot! + 1}.
          </p>
          <button onClick={() => router.push(`/circle/${circle!.id}`)} className="btn-primary w-full">
            Go to Circle Dashboard →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-hui-bg px-4 py-12">
      <div className="max-w-lg mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-hui-text mb-2">Join a Circle</h1>
          <p className="text-hui-text-secondary">Enter an invite code, then pick your payout slot.</p>
        </div>

        <div className="card mb-6">
          <label className="block text-sm font-medium text-hui-text mb-1.5">Invite Code</label>
          <div className="flex gap-2">
            <input
              className="input flex-1 uppercase tracking-widest font-mono text-lg"
              placeholder="ABCD1234"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase().slice(0, 8))}
              onKeyDown={e => e.key === 'Enter' && handleLookup()}
              maxLength={8}
            />
            <button onClick={handleLookup} disabled={looking} className="btn-primary px-5">
              {looking ? '…' : 'Look Up'}
            </button>
          </div>
          {lookupError && <p className="text-hui-error text-sm mt-2">{lookupError}</p>}
        </div>

        {circle && (
          <div className="space-y-5">
            {mySlot ? (
              <div className="card bg-hui-success-light border-hui-success text-center">
                <p className="font-medium text-hui-success">You already hold Slot {mySlot.index + 1} in this circle.</p>
                <button onClick={() => router.push(`/circle/${circle.id}`)} className="btn-primary mt-3">
                  Go to Dashboard →
                </button>
              </div>
            ) : (
              <div className="card overflow-hidden transition-all duration-300">
                {/* Clickable Header Section */}
                <button
                  type="button"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="w-full text-left focus:outline-none"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-2xl font-bold text-hui-text mb-1">{circle.name}</h2>
                      <p className="text-sm text-hui-text-secondary">Created by <strong className="text-hui-text">{creatorName}</strong></p>
                    </div>
                    <span className="text-hui-primary transition-transform duration-300 transform font-semibold">
                      {isExpanded ? 'Collapse ▲' : 'Join Circle ▼'}
                    </span>
                  </div>

                  <div className="flex gap-4 text-sm text-hui-text-secondary flex-wrap mt-4 border-t border-hui-border/50 pt-4">
                    <span>${(circle.contributionAmount / 1_000_000).toFixed(0)} USDC / round</span>
                    <span>{circle.frequencySeconds === 604800 ? 'Weekly' : 'Monthly'}</span>
                    <span>{circle.slotsFilled} / {circle.totalRounds} members</span>
                    <span className={`badge ${circle.slotsFilled < circle.totalRounds ? 'badge-info' : 'badge-success'}`}>
                      {circle.totalRounds - circle.slotsFilled} open
                    </span>
                  </div>

                  {!isExpanded && (
                    <div className="mt-4 flex items-center justify-center p-2.5 bg-hui-primary-light text-hui-primary font-medium text-sm rounded-xl animate-pulse">
                      Tap here to pick your slot & join
                    </div>
                  )}
                </button>

                {/* Collapsible Content Area */}
                <div
                  className={[
                    'transition-all duration-300 ease-in-out overflow-hidden',
                    isExpanded ? 'max-h-[800px] opacity-100 mt-6 pt-6 border-t border-hui-border' : 'max-h-0 opacity-0',
                  ].join(' ')}
                >
                  <div className="space-y-5">
                    {/* Your Display Name */}
                    <div>
                      <label className="block text-sm font-medium text-hui-text mb-1.5">Your Display Name</label>
                      <input
                        className="input w-full"
                        placeholder="e.g. Lan, Uncle Minh…"
                        value={displayName}
                        onChange={e => setDisplayName(e.target.value.slice(0, 32))}
                        maxLength={32}
                      />
                      <p className="text-xs text-hui-text-tertiary mt-1">Shown to other members on the dashboard.</p>
                    </div>

                    {/* Pick Slot */}
                    <div>
                      <h3 className="font-semibold text-hui-text text-sm mb-3">Pick Your Payout Slot</h3>
                      <p className="text-xs text-hui-text-secondary mb-4">
                        The slot number corresponds to the round you will receive the full pot.
                      </p>
                      <div className="grid grid-cols-5 gap-2">
                        {circle.slots.map(slot => {
                          const taken = slot.member !== null;
                          const selected = selectedSlot === slot.index;
                          return (
                            <button
                              key={slot.index}
                              disabled={taken}
                              onClick={() => setSelectedSlot(slot.index)}
                              title={taken ? `Taken by ${slot.member?.displayName || slot.member?.wallet.slice(0, 6)}` : `Round ${slot.round}`}
                              className={[
                                'relative rounded-xl p-3 text-center border-2 transition-all duration-150',
                                taken
                                  ? 'bg-stone-100 border-stone-200 text-stone-400 cursor-not-allowed'
                                  : selected
                                  ? 'bg-hui-primary border-hui-primary text-white shadow-lg scale-105'
                                  : 'bg-white border-hui-border text-hui-text hover:border-hui-primary hover:scale-105 cursor-pointer',
                              ].join(' ')}
                            >
                              <div className="text-lg font-bold">{slot.round}</div>
                              <div className="text-xs mt-0.5">{taken ? slot.member?.displayName || '●' : 'Open'}</div>
                              {taken && (
                                <div className="absolute -top-1 -right-1 w-4 h-4 bg-hui-primary rounded-full flex items-center justify-center">
                                  <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                      {selectedSlot !== null && (
                        <p className="text-sm text-hui-primary font-medium mt-3">
                          ✓ Slot {selectedSlot + 1} selected — you receive the pot in Round {selectedSlot + 1}
                        </p>
                      )}
                    </div>

                    {nameError && <p className="text-hui-error text-sm">{nameError}</p>}
                    <button onClick={handleJoin} disabled={isLoading} className="btn-primary w-full mt-4">
                      {isLoading ? 'Joining…' : `Join Slot ${selectedSlot !== null ? selectedSlot + 1 : ''}`}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense>
      <JoinInner />
    </Suspense>
  );
}
