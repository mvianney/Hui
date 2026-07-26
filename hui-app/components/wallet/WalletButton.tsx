'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { ConnectionProvider, WalletProvider as SolanaWalletProvider, useWallet as useSolanaWallet } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';
import '@solana/wallet-adapter-react-ui/styles.css';

interface WalletContextType {
  connected: boolean;
  publicKey: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextType>({
  connected: false,
  publicKey: null,
  connect: async () => {},
  disconnect: () => {},
});

const WalletProviderWrapper = ({ children }: { children: ReactNode }) => {
  const { connected, publicKey, connect, disconnect } = useSolanaWallet();

  const handleConnect = async () => {
    try {
      await connect();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDisconnect = () => {
    try {
      disconnect();
    } catch (e) {
      console.error(e);
    }
  };

  const contextValue: WalletContextType = {
    connected,
    publicKey: publicKey ? publicKey.toBase58() : null,
    connect: handleConnect,
    disconnect: handleDisconnect,
  };

  return (
    <WalletContext.Provider value={contextValue}>
      {children}
    </WalletContext.Provider>
  );
};

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  // Point to local validator
  const endpoint = 'https://api.devnet.solana.com';
  const wallets = [new PhantomWalletAdapter()];

  return (
    <ConnectionProvider endpoint={endpoint}>
      <SolanaWalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <WalletProviderWrapper>
            {children}
          </WalletProviderWrapper>
        </WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
};

export const useWallet = () => useContext(WalletContext);

const WalletMultiButtonDynamic = dynamic(
  () => import('@solana/wallet-adapter-react-ui').then((mod) => mod.WalletMultiButton),
  { ssr: false }
);

export default function WalletButton() {
  return (
    <div className="solana-wallet-btn">
      <WalletMultiButtonDynamic className="!bg-hui-primary !hover:bg-hui-primary-dark !rounded-xl !px-6 !py-3 !font-medium !text-white !transition-all !duration-200" />
    </div>
  );
}
