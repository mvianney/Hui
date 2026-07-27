'use client';

import React, { useState, useEffect } from 'react';
import { useWallet } from '@/components/wallet/WalletButton';

export function FaucetButton() {
  const { connected, publicKey } = useWallet();
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchBalance = async () => {
    if (!publicKey) return;
    try {
      const res = await fetch(`/api/faucet?wallet=${publicKey}`);
      const data = await res.json();
      setBalance(data.balance);
    } catch {
      setBalance(0);
    }
  };

  useEffect(() => {
    if (connected && publicKey) {
      fetchBalance();
      const interval = setInterval(fetchBalance, 10000);
      return () => clearInterval(interval);
    } else {
      setBalance(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, publicKey]);

  const handleFaucet = async () => {
    if (!publicKey) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/faucet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient: publicKey }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to request tokens');
      }
      setMessage({ text: `Success! Minted ${data.amount} test USDC.`, type: 'success' });
      fetchBalance();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to request tokens';
      setMessage({ text: msg, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  if (!connected) return null;

  return (
    <div className="flex flex-col gap-2 p-4 bg-hui-primary-light/50 border border-hui-primary/20 rounded-xl mt-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-hui-text-secondary font-medium uppercase">Test Wallet Balance</p>
          <p className="text-lg font-bold text-hui-text">
            {balance !== null ? `${balance.toFixed(2)} USDC` : 'Loading...'}
          </p>
        </div>
        <button
          onClick={handleFaucet}
          disabled={loading}
          className="btn-primary py-2 px-4 text-sm"
        >
          {loading ? 'Minting...' : 'Get Test USDC'}
        </button>
      </div>
      {message && (
        <p className={`text-xs ${message.type === 'success' ? 'text-hui-success' : 'text-hui-error'}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
