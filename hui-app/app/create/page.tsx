'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useHui } from '@/lib/huiContext';
import { useWallet } from '@/components/wallet/WalletButton';
import { Frequency } from '@/lib/types';

export default function CreatePage() {
  const router = useRouter();
  const { connected } = useWallet();
  const { createCircle, isLoading } = useHui();

  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<Frequency>('monthly');
  const [totalMembers, setTotalMembers] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ circleId: string; inviteCode: string } | null>(null);

  if (!connected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-hui-bg px-4">
        <div className="card text-center max-w-sm w-full">
          <div className="text-4xl mb-4">🔗</div>
          <h1 className="text-xl font-bold text-hui-text mb-2">Connect Your Wallet</h1>
          <p className="text-hui-text-secondary text-sm">You need a connected wallet to create a circle.</p>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const amtNum = parseFloat(amount);
    const membersNum = parseInt(totalMembers);

    if (!name.trim()) { setError('Circle name is required'); return; }
    if (isNaN(amtNum) || amtNum <= 0) { setError('Contribution amount must be > 0'); return; }
    if (isNaN(membersNum) || membersNum < 2 || membersNum > 20) { setError('Members must be between 2 and 20'); return; }
    if (selectedSlot === null) { setError('Please pick your payout slot'); return; }
    if (!displayName.trim()) { setError('Your display name is required'); return; }

    const res = await createCircle({
      name: name.trim(),
      contributionAmount: amtNum,
      frequency,
      totalMembers: membersNum,
      creatorChosenSlot: selectedSlot,
      creatorDisplayName: displayName.trim(),
    });
    if (res) {
      setResult({ circleId: res.circle.id, inviteCode: res.inviteCode });
    }
  }

  if (result) {
    const joinUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/join?code=${result.inviteCode}`
      : `/join?code=${result.inviteCode}`;

    return (
      <div className="min-h-screen flex items-center justify-center bg-hui-bg px-4 py-12">
        <div className="card max-w-lg w-full text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold text-hui-text mb-2">Circle Created!</h1>
          <p className="text-hui-text-secondary mb-6 text-sm">
            Share the invite code so other members can join the remaining open slots.
          </p>

          <div className="bg-hui-primary-light rounded-xl p-4 mb-4">
            <p className="text-xs text-hui-text-secondary mb-1 font-medium uppercase tracking-wide">Invite Code</p>
            <p className="text-3xl font-bold text-hui-primary tracking-widest">{result.inviteCode}</p>
          </div>

          <div className="bg-stone-50 rounded-xl p-3 mb-6 flex items-center gap-2">
            <p className="text-sm text-hui-text-secondary truncate flex-1">{joinUrl}</p>
            <button
              onClick={() => navigator.clipboard.writeText(joinUrl)}
              className="btn-secondary text-sm px-3 py-1.5 shrink-0"
            >
              Copy
            </button>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => router.push(`/circle/${result.circleId}`)}
              className="btn-primary flex-1"
            >
              Go to Dashboard →
            </button>
          </div>
        </div>
      </div>
    );
  }

  const membersNum = parseInt(totalMembers) || 0;
  const isMembersValid = membersNum >= 2 && membersNum <= 20;

  return (
    <div className="min-h-screen bg-hui-bg px-4 py-12">
      <div className="max-w-lg mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-hui-text mb-2">Create a Circle</h1>
          <p className="text-hui-text-secondary">Set the terms, select your own slot, and invite others to join.</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-5">
          {/* Circle name */}
          <div>
            <label className="block text-sm font-medium text-hui-text mb-1.5">Circle Name</label>
            <input
              className="input w-full"
              placeholder="e.g. Hụi Gia Đình"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={32}
            />
          </div>

          {/* Contribution amount */}
          <div>
            <label className="block text-sm font-medium text-hui-text mb-1.5">Contribution per Round (USDC)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-hui-text-secondary font-medium">$</span>
              <input
                className="input w-full pl-7"
                type="number"
                min="1"
                step="1"
                placeholder="50"
                value={amount}
                onChange={e => setAmount(e.target.value)}
              />
            </div>
          </div>

          {/* Frequency */}
          <div>
            <label className="block text-sm font-medium text-hui-text mb-1.5">Frequency</label>
            <select
              className="input w-full"
              value={frequency}
              onChange={e => setFrequency(e.target.value as Frequency)}
            >
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          {/* Total members */}
          <div>
            <label className="block text-sm font-medium text-hui-text mb-1.5">Number of Members / Rounds</label>
            <input
              className="input w-full"
              type="number"
              min="2"
              max="20"
              placeholder="5"
              value={totalMembers}
              onChange={e => {
                setTotalMembers(e.target.value);
                setSelectedSlot(null); // Reset selected slot when rounds change
              }}
            />
          </div>

          {/* Creator's Display Name & Slot Picker (Only visible if rounds input is valid) */}
          {isMembersValid && (
            <div className="pt-4 border-t border-hui-border space-y-5 animate-slideUp">
              <div>
                <label className="block text-sm font-medium text-hui-text mb-1.5">Your Display Name</label>
                <input
                  className="input w-full"
                  placeholder="e.g. Lan (Creator), Uncle Minh…"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value.slice(0, 32))}
                  maxLength={32}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-hui-text mb-1.5">Pick Your Payout Slot</label>
                <p className="text-xs text-hui-text-secondary mb-3">
                  Select the round you would like to receive the total pot.
                </p>
                <div className="grid grid-cols-5 gap-2">
                  {Array.from({ length: membersNum }).map((_, idx) => {
                    const selected = selectedSlot === idx;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedSlot(idx)}
                        className={[
                          'rounded-xl p-3 text-center border-2 transition-all duration-150',
                          selected
                            ? 'bg-hui-primary border-hui-primary text-white shadow-lg scale-105'
                            : 'bg-white border-hui-border text-hui-text hover:border-hui-primary hover:scale-105 cursor-pointer',
                        ].join(' ')}
                      >
                        <div className="text-lg font-bold">{idx + 1}</div>
                        <div className="text-xs mt-0.5">{selected ? 'Mine' : 'Open'}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Summary */}
          {amount && totalMembers && !isNaN(parseFloat(amount)) && isMembersValid && (
            <div className="bg-hui-primary-light rounded-xl p-4 text-sm">
              <p className="font-medium text-hui-primary mb-1">Circle Summary</p>
              <p className="text-hui-text-secondary">
                {membersNum} members × ${parseFloat(amount).toFixed(0)} USDC = <strong className="text-hui-text">${(membersNum * parseFloat(amount)).toFixed(0)} pot</strong> each round
              </p>
              <p className="text-hui-text-secondary mt-1">
                Duration: ~{membersNum} {frequency === 'weekly' ? 'weeks' : 'months'}
              </p>
            </div>
          )}

          {error && <p className="text-hui-error text-sm">{error}</p>}

          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary w-full"
          >
            {isLoading ? 'Creating Circle…' : 'Create Circle'}
          </button>
        </form>
      </div>
    </div>
  );
}
