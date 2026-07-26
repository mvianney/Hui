'use client';

import React, { useState } from 'react';
import { useHui } from '@/lib/huiContext';
import { useWallet } from '@/components/wallet/WalletButton';
import { useRouter } from 'next/navigation';
import { Circle } from '@/lib/types';

export default function JoinCirclePage() {
  const { connected, publicKey, connect } = useWallet();
  const { lookupInviteCode, joinCircle, addToast } = useHui();
  const router = useRouter();

  const [inviteCode, setInviteCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [foundCircle, setFoundCircle] = useState<Circle | null>(null);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode || inviteCode.length !== 6) return;
    
    setIsLookingUp(true);
    setError(null);
    try {
      const circle = await lookupInviteCode(inviteCode);
      if (circle) {
        setFoundCircle(circle);
      } else {
        setError('No circle found with this code');
        setFoundCircle(null);
      }
    } catch {
      setError('An error occurred while looking up the code');
      setFoundCircle(null);
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleJoin = async () => {
    if (!connected || !publicKey || !foundCircle || !displayName) return;
    
    setIsJoining(true);
    try {
      const result = joinCircle(foundCircle.id, publicKey, displayName);
      if (result) {
        router.push(`/circle/${foundCircle.id}`);
      }
    } catch {
      addToast('error', 'Could not join the circle. It may be full.');
    } finally {
      setIsJoining(false);
    }
  };

  if (!connected) {
    return (
      <div className="max-w-lg mx-auto py-12 px-4 text-center">
        <h1 className="text-2xl font-bold text-hui-text mb-4">Connect Wallet to Join a Circle</h1>
        <p className="text-hui-text-secondary mb-8">You need to connect your wallet to join an existing Hụi circle.</p>
        <button onClick={connect} className="bg-hui-primary text-white rounded-xl px-6 py-3 font-medium hover:bg-hui-primary-dark transition-all duration-200">
          Connect Wallet
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold text-hui-text mb-6">Join Circle</h1>
      
      {!foundCircle ? (
        <form onSubmit={handleLookup} className="bg-hui-surface rounded-2xl border border-hui-border shadow-sm p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-hui-text mb-2">Invite Code</label>
            <input 
              type="text" 
              required 
              maxLength={6}
              value={inviteCode} 
              onChange={e => setInviteCode(e.target.value.toUpperCase())} 
              placeholder="XXXXXX" 
              className="w-full rounded-xl border border-hui-border bg-white px-4 py-3 text-hui-text focus:outline-none focus:ring-2 focus:ring-hui-primary focus:border-transparent transition-all uppercase tracking-widest text-center text-xl font-medium" 
            />
          </div>
          
          {error && <p className="text-hui-error text-sm">{error}</p>}
          
          <button type="submit" disabled={isLookingUp || inviteCode.length !== 6} className="w-full bg-hui-primary text-white rounded-xl px-6 py-3 font-medium hover:bg-hui-primary-dark transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
            {isLookingUp ? 'Looking up...' : 'Look Up Circle'}
          </button>
        </form>
      ) : (
        <div className="bg-hui-surface rounded-2xl border border-hui-border shadow-sm p-6 space-y-6">
          <div className="flex justify-between items-start mb-2">
            <h2 className="text-xl font-bold text-hui-text">{foundCircle.name}</h2>
            <button onClick={() => setFoundCircle(null)} className="text-sm text-hui-primary hover:underline">Change Code</button>
          </div>
          
          <div className="flex items-center gap-4 text-hui-text-secondary text-sm bg-hui-bg p-4 rounded-xl border border-hui-border">
            <div className="flex flex-col">
              <span className="font-medium text-hui-text">{foundCircle.contributionAmount} USDC</span>
              <span>Contribution</span>
            </div>
            <div className="w-px h-8 bg-hui-border"></div>
            <div className="flex flex-col">
              <span className="font-medium text-hui-text capitalize">{foundCircle.frequency}</span>
              <span>Frequency</span>
            </div>
          </div>
          
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-hui-text">Members</span>
              <span className="text-sm text-hui-text-secondary">{foundCircle.members.filter(m => m.hasJoined).length} of {foundCircle.totalRounds} joined</span>
            </div>
            <div className="space-y-2">
              {foundCircle.members.filter(m => m.hasJoined).map((member) => (
                <div key={member.walletAddress} className="flex items-center justify-between p-3 rounded-xl bg-hui-bg border border-hui-border">
                  <span className="font-medium text-hui-text">{member.displayName}</span>
                  <span className="text-xs text-hui-text-tertiary truncate max-w-[100px]">{member.walletAddress.slice(0, 4)}...{member.walletAddress.slice(-4)}</span>
                </div>
              ))}
              {foundCircle.members.filter(m => !m.hasJoined).map((_, i) => (
                <div key={`empty-${i}`} className="flex items-center p-3 rounded-xl bg-white border border-dashed border-hui-border">
                  <span className="text-hui-text-tertiary italic">Available Slot</span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="pt-4 border-t border-hui-border">
            <label className="block text-sm font-medium text-hui-text mb-2">Your Display Name</label>
            <input 
              type="text" 
              required 
              value={displayName} 
              onChange={e => setDisplayName(e.target.value)} 
              placeholder="e.g. Nguyễn Văn A" 
              className="w-full rounded-xl border border-hui-border bg-white px-4 py-3 text-hui-text focus:outline-none focus:ring-2 focus:ring-hui-primary focus:border-transparent transition-all mb-4" 
            />
            
            <button 
              onClick={handleJoin} 
              disabled={isJoining || !displayName || foundCircle.members.length >= foundCircle.totalRounds} 
              className="w-full bg-hui-primary text-white rounded-xl px-6 py-3 font-medium hover:bg-hui-primary-dark transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isJoining ? 'Joining...' : 'Join Circle'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
