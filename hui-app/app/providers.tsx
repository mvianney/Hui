'use client';

import React from 'react';
import { HuiProvider } from '@/lib/huiContext';
import { WalletProvider } from '@/components/wallet/WalletButton';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WalletProvider>
      <HuiProvider>
        {children}
      </HuiProvider>
    </WalletProvider>
  );
}
