'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useWallet } from '@/components/wallet/WalletButton';
import { useHui } from '@/lib/huiContext';

export default function LandingPage() {
  const { connected } = useWallet();
  const { circles, loadCircles, isLoading } = useHui();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (connected) {
      loadCircles();
    }
  }, [connected, loadCircles]);

  // Don't render complex conditional hydration content until mounted
  const isReady = mounted;

  return (
    <div className="flex flex-col gap-16 pb-20">
      {/* Hero Section */}
      <section className="relative px-4 pt-20 pb-16 sm:px-6 lg:px-8 max-w-5xl mx-auto text-center">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-hui-primary-light via-hui-bg to-hui-bg opacity-70"></div>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-hui-text mb-6">
          Hụi — Trustless <span className="text-hui-primary">Savings Circles</span>
        </h1>
        <p className="max-w-2xl mx-auto text-lg sm:text-xl text-hui-text-secondary mb-10">
          The traditional Vietnamese rotating savings circle, reimagined. 
          Pool funds with friends and family, secured by Solana smart contracts with zero middleman risk.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          {isReady && !connected ? (
            <>
              <div className="relative group cursor-not-allowed w-full sm:w-auto">
                <button disabled className="bg-hui-primary/50 text-white rounded-xl px-8 py-4 font-medium w-full sm:w-auto">
                  Create a Circle
                </button>
                <div className="absolute bottom-full mb-2 hidden group-hover:block bg-hui-surface text-hui-text text-sm rounded-md shadow-md border border-hui-border px-3 py-1 whitespace-nowrap left-1/2 -translate-x-1/2">
                  Connect your wallet first
                </div>
              </div>
              <div className="relative group cursor-not-allowed w-full sm:w-auto">
                <button disabled className="bg-hui-primary-light/50 text-hui-primary/50 rounded-xl px-8 py-4 font-medium w-full sm:w-auto">
                  Join a Circle
                </button>
                <div className="absolute bottom-full mb-2 hidden group-hover:block bg-hui-surface text-hui-text text-sm rounded-md shadow-md border border-hui-border px-3 py-1 whitespace-nowrap left-1/2 -translate-x-1/2">
                  Connect your wallet first
                </div>
              </div>
            </>
          ) : (
            <>
              <Link href="/create" className="bg-hui-primary text-white hover:bg-hui-primary-dark rounded-xl px-8 py-4 font-medium transition-all duration-200 w-full sm:w-auto text-center shadow-sm">
                Create a Circle
              </Link>
              <Link href="/join" className="bg-hui-primary-light text-hui-primary hover:bg-teal-100 rounded-xl px-8 py-4 font-medium transition-all duration-200 w-full sm:w-auto text-center">
                Join a Circle
              </Link>
            </>
          )}
        </div>
      </section>

      {/* How It Works Section */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full">
        <h2 className="text-3xl font-bold text-center mb-10 text-hui-text">How It Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            { step: '1', title: 'Create or Join', desc: 'Start a circle with friends or family using an invite code.' },
            { step: '2', title: 'Contribute', desc: 'Everyone contributes a fixed amount of USDC each round.' },
            { step: '3', title: 'Take the Pot', desc: 'One member receives the full pooled amount each round.' },
            { step: '4', title: 'Fair & Secure', desc: 'Smart contracts guarantee fairness and track reputation.' }
          ].map((item) => (
            <div key={item.step} className="bg-hui-surface p-6 rounded-2xl border border-hui-border shadow-sm hover:shadow-md transition-shadow duration-200 relative overflow-hidden">
              <div className="text-4xl font-bold text-hui-primary-light mb-4">{item.step}</div>
              <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
              <p className="text-hui-text-secondary text-sm">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Why On-Chain Section */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full">
        <h2 className="text-3xl font-bold text-center mb-10 text-hui-text">Why On-Chain?</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-hui-surface p-8 rounded-2xl border border-hui-border shadow-sm">
            <div className="w-12 h-12 bg-hui-primary-light rounded-xl flex items-center justify-center mb-6 text-hui-primary">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-3">No More &ldquo;Giật Hụi&rdquo;</h3>
            <p className="text-hui-text-secondary">Funds are held securely in a program-controlled escrow. No single individual holds the money, eliminating the risk of organizers running away.</p>
          </div>
          
          <div className="bg-hui-surface p-8 rounded-2xl border border-hui-border shadow-sm">
            <div className="w-12 h-12 bg-hui-primary-light rounded-xl flex items-center justify-center mb-6 text-hui-primary">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-3">Transparent & Verifiable</h3>
            <p className="text-hui-text-secondary">Every contribution, payout, and round progression is recorded publicly on the Solana blockchain for all members to verify.</p>
          </div>
          
          <div className="bg-hui-surface p-8 rounded-2xl border border-hui-border shadow-sm">
            <div className="w-12 h-12 bg-hui-primary-light rounded-xl flex items-center justify-center mb-6 text-hui-primary">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-3">Build Your Reputation</h3>
            <p className="text-hui-text-secondary">Successfully completing circles builds your on-chain reputation, proving your financial reliability for future borrowing or circles.</p>
          </div>
        </div>
      </section>

      {/* My Circles Section (Only when connected) */}
      {isReady && connected && (
        <section id="circles" className="px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full pt-10 border-t border-hui-border">
          <div className="flex justify-between items-end mb-8">
            <h2 className="text-3xl font-bold text-hui-text">My Circles</h2>
            <Link href="/create" className="text-hui-primary hover:text-hui-primary-dark font-medium transition-colors">
              + New Circle
            </Link>
          </div>
          
          {isLoading ? (
            <div className="flex justify-center items-center py-20">
              <div className="w-8 h-8 border-4 border-hui-primary-light border-t-hui-primary rounded-full animate-spin"></div>
            </div>
          ) : circles && circles.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {circles.map(circle => (
                <Link key={circle.id} href={`/circle/${circle.id}`} className="block group">
                  <div className="bg-hui-surface p-6 rounded-2xl border border-hui-border shadow-sm group-hover:shadow-md group-hover:border-hui-primary/30 transition-all duration-200">
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="text-xl font-bold text-hui-text">{circle.name}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        circle.status === 'active' ? 'bg-hui-success-light text-hui-success' :
                        circle.status === 'completed' ? 'bg-hui-bg text-hui-text-secondary' :
                        'bg-hui-warning-light text-hui-warning'
                      }`}>
                        {circle.status.charAt(0).toUpperCase() + circle.status.slice(1)}
                      </span>
                    </div>
                    
                    <div className="flex justify-between text-sm mb-4">
                      <div className="text-hui-text-secondary">
                        <span className="block mb-1">Round</span>
                        <span className="font-semibold text-hui-text">{circle.currentRound} / {circle.totalRounds}</span>
                      </div>
                      <div className="text-hui-text-secondary text-right">
                        <span className="block mb-1">Contribution</span>
                        <span className="font-semibold text-hui-text">{circle.contributionAmount} USDC</span>
                      </div>
                    </div>
                    
                    <div className="w-full bg-hui-bg rounded-full h-2 mb-2">
                      <div 
                        className="bg-hui-primary h-2 rounded-full transition-all duration-500" 
                        style={{ width: `${(circle.currentRound / circle.totalRounds) * 100}%` }}
                      ></div>
                    </div>
                    <div className="text-xs text-hui-text-tertiary flex justify-between">
                      <span>{circle.members.length} members</span>
                      <span>Next: {circle.rounds.find(r => r.roundNumber === circle.currentRound)?.dueDate ? new Date(circle.rounds.find(r => r.roundNumber === circle.currentRound)!.dueDate).toLocaleDateString() : 'TBD'}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="bg-hui-surface rounded-2xl border border-hui-border border-dashed p-12 text-center">
              <div className="w-16 h-16 bg-hui-bg rounded-full flex items-center justify-center mx-auto mb-4 text-hui-text-tertiary">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-hui-text mb-2">No circles yet</h3>
              <p className="text-hui-text-secondary mb-6 max-w-md mx-auto">
                You haven&apos;t joined any savings circles yet. Create a new one to invite friends, or join an existing one using an invite code.
              </p>
              <div className="flex gap-4 justify-center">
                <Link href="/create" className="bg-hui-primary text-white hover:bg-hui-primary-dark rounded-xl px-6 py-2.5 font-medium transition-all duration-200">
                  Create Circle
                </Link>
                <Link href="/join" className="bg-hui-primary-light text-hui-primary hover:bg-teal-100 rounded-xl px-6 py-2.5 font-medium transition-all duration-200">
                  Enter Invite Code
                </Link>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
