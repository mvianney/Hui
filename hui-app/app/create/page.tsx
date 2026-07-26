'use client';

import React, { useState, useEffect } from 'react';
import { useHui } from '@/lib/huiContext';
import { useWallet } from '@/components/wallet/WalletButton';
import { Frequency } from '@/lib/types';
import Link from 'next/link';

export default function CreateCirclePage() {
  const { connected, publicKey, connect } = useWallet();
  const { createCircle } = useHui();
  
  const [name, setName] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [frequency, setFrequency] = useState<Frequency>('monthly');
  const [membersCount, setMembersCount] = useState<number | ''>('');
  const [members, setMembers] = useState<string[]>(['']);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdCircleId, setCreatedCircleId] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);

  useEffect(() => {
    if (typeof membersCount === 'number' && membersCount >= 2 && membersCount <= 12) {
      const newMembers = [...members];
      while (newMembers.length < membersCount) {
        newMembers.push('');
      }
      if (newMembers.length > membersCount) {
        newMembers.splice(membersCount);
      }
      setMembers(newMembers);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [membersCount]);

  const handleMemberChange = (index: number, value: string) => {
    const newMembers = [...members];
    newMembers[index] = value;
    setMembers(newMembers);
  };

  const moveMember = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index > 0) {
      const newMembers = [...members];
      [newMembers[index - 1], newMembers[index]] = [newMembers[index], newMembers[index - 1]];
      setMembers(newMembers);
    } else if (direction === 'down' && index < members.length - 1) {
      const newMembers = [...members];
      [newMembers[index + 1], newMembers[index]] = [newMembers[index], newMembers[index + 1]];
      setMembers(newMembers);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!connected || !publicKey) return;
    if (!name || !amount || !membersCount || membersCount < 2 || membersCount > 12) return;
    
    setIsSubmitting(true);
    try {
      const input = {
        name,
        contributionAmount: Number(amount),
        frequency,
        totalRounds: Number(membersCount),
        memberNames: members
      };
      
      const newCircle = createCircle(input, publicKey);
      if (newCircle) {
        setCreatedCircleId(newCircle.id);
        setInviteCode(newCircle.inviteCode);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!connected) {
    return (
      <div className="max-w-lg mx-auto py-12 px-4 text-center">
        <h1 className="text-2xl font-bold text-hui-text mb-4">Connect Wallet to Create a Circle</h1>
        <p className="text-hui-text-secondary mb-8">You need to connect your wallet to create a new Hụi circle.</p>
        <button onClick={connect} className="bg-hui-primary text-white rounded-xl px-6 py-3 font-medium hover:bg-hui-primary-dark transition-all duration-200">
          Connect Wallet
        </button>
      </div>
    );
  }

  if (createdCircleId) {
    return (
      <div className="max-w-lg mx-auto py-12 px-4">
        <div className="bg-hui-surface rounded-2xl border border-hui-border shadow-sm p-8 text-center">
          <div className="w-16 h-16 bg-hui-success-light text-hui-success rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          </div>
          <h1 className="text-2xl font-bold text-hui-text mb-2">Circle Created Successfully!</h1>
          <p className="text-hui-text-secondary mb-6">{name} • {amount} USDC / {frequency} • {membersCount} Members</p>
          
          <div className="bg-hui-bg rounded-xl p-6 mb-8 border border-hui-border">
            <p className="text-sm font-medium text-hui-text-secondary mb-2 uppercase tracking-wide">Invite Code</p>
            <p className="text-4xl font-bold text-hui-primary tracking-widest">{inviteCode}</p>
          </div>
          
          <div className="flex flex-col gap-3">
            <button className="bg-hui-primary-light text-hui-primary rounded-xl px-6 py-3 font-medium hover:bg-teal-100 transition-all duration-200 w-full" onClick={() => navigator.clipboard.writeText(`hui.app/join?code=${inviteCode}`)}>
              Copy Invite Link
            </button>
            <Link href={`/circle/${createdCircleId}`} className="bg-hui-primary text-white rounded-xl px-6 py-3 font-medium hover:bg-hui-primary-dark transition-all duration-200 w-full inline-block">
              Go to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold text-hui-text mb-6">Create New Circle</h1>
      
      <form onSubmit={handleSubmit} className="bg-hui-surface rounded-2xl border border-hui-border shadow-sm p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-hui-text mb-2">Circle Name</label>
          <input type="text" required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Hụi Gia Đình" className="w-full rounded-xl border border-hui-border bg-white px-4 py-3 text-hui-text focus:outline-none focus:ring-2 focus:ring-hui-primary focus:border-transparent transition-all" />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-hui-text mb-2">Amount (USDC)</label>
            <input type="number" required min="1" value={amount} onChange={e => setAmount(Number(e.target.value) || '')} placeholder="50" className="w-full rounded-xl border border-hui-border bg-white px-4 py-3 text-hui-text focus:outline-none focus:ring-2 focus:ring-hui-primary focus:border-transparent transition-all" />
          </div>
          <div>
            <label className="block text-sm font-medium text-hui-text mb-2">Frequency</label>
            <select value={frequency} onChange={e => setFrequency(e.target.value as Frequency)} className="w-full rounded-xl border border-hui-border bg-white px-4 py-3 text-hui-text focus:outline-none focus:ring-2 focus:ring-hui-primary focus:border-transparent transition-all">
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-hui-text mb-2">Number of Members (2-12)</label>
          <input type="number" required min="2" max="12" value={membersCount} onChange={e => setMembersCount(Number(e.target.value) || '')} placeholder="5" className="w-full rounded-xl border border-hui-border bg-white px-4 py-3 text-hui-text focus:outline-none focus:ring-2 focus:ring-hui-primary focus:border-transparent transition-all" />
        </div>

        {typeof membersCount === 'number' && membersCount >= 2 && membersCount <= 12 && (
          <div className="space-y-4 pt-4 border-t border-hui-border">
            <label className="block text-sm font-medium text-hui-text">Payout Order</label>
            <p className="text-sm text-hui-text-secondary mb-4">Set the order in which members receive the pot. You are automatically in the first slot.</p>
            
            <div className="space-y-3">
              {members.map((member, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-hui-bg text-hui-text-secondary flex items-center justify-center text-sm font-medium border border-hui-border flex-shrink-0">
                    {index + 1}
                  </div>
                  <input type="text" required value={member} onChange={e => handleMemberChange(index, e.target.value)} placeholder={index === 0 ? "Your Display Name" : `Member ${index + 1} Name`} className="flex-1 rounded-xl border border-hui-border bg-white px-4 py-2 text-hui-text focus:outline-none focus:ring-2 focus:ring-hui-primary transition-all" />
                  <div className="flex flex-col gap-1">
                    <button type="button" onClick={() => moveMember(index, 'up')} disabled={index === 0} className="text-hui-text-tertiary hover:text-hui-text disabled:opacity-30 p-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                    </button>
                    <button type="button" onClick={() => moveMember(index, 'down')} disabled={index === members.length - 1} className="text-hui-text-tertiary hover:text-hui-text disabled:opacity-30 p-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <button type="submit" disabled={isSubmitting || !name || !amount || !membersCount || membersCount < 2 || membersCount > 12} className="w-full bg-hui-primary text-white rounded-xl px-6 py-3 font-medium hover:bg-hui-primary-dark transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed mt-6">
          {isSubmitting ? 'Creating...' : 'Create Circle'}
        </button>
      </form>
    </div>
  );
}
