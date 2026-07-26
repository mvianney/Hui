'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import WalletButton, { useWallet } from '@/components/wallet/WalletButton';

export default function Header() {
  const { connected } = useWallet();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => setMobileMenuOpen(!mobileMenuOpen);

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-hui-surface/80 backdrop-blur-md border-b border-hui-border transition-all duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo & Subtitle */}
          <Link href="/" className="flex flex-col items-start justify-center group">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-hui-primary group-hover:text-hui-primary-dark transition-colors duration-200">
                Hụi
              </span>
              <div className="w-2 h-2 rounded-full bg-hui-accent"></div>
            </div>
            <span className="text-xs text-hui-text-secondary hidden sm:block">
              On-Chain Savings Circle
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8">
            {connected && (
              <>
                <Link href="/#circles" className="text-sm font-medium text-hui-text hover:text-hui-primary transition-colors duration-200">
                  My Circles
                </Link>
                <Link href="/create" className="text-sm font-medium text-hui-text hover:text-hui-primary transition-colors duration-200">
                  Create
                </Link>
              </>
            )}
            <WalletButton />
          </nav>

          {/* Mobile Menu Button */}
          <div className="flex items-center gap-4 md:hidden">
            <WalletButton />
            <button
              onClick={toggleMobileMenu}
              className="text-hui-text hover:text-hui-primary transition-colors duration-200 focus:outline-none"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Nav */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-hui-surface border-b border-hui-border">
          <div className="px-4 pt-2 pb-4 space-y-1">
            {connected && (
              <>
                <Link
                  href="/#circles"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2 rounded-md text-base font-medium text-hui-text hover:text-hui-primary hover:bg-hui-bg transition-colors duration-200"
                >
                  My Circles
                </Link>
                <Link
                  href="/create"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2 rounded-md text-base font-medium text-hui-text hover:text-hui-primary hover:bg-hui-bg transition-colors duration-200"
                >
                  Create
                </Link>
              </>
            )}
            {!connected && (
              <div className="px-3 py-2 text-sm text-hui-text-secondary">
                Connect your wallet to access more features.
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
