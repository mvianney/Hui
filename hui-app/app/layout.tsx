import type { Metadata } from 'next';
import './globals.css';
import Providers from './providers';
import Header from '@/components/layout/Header';
import ToastContainer from '@/components/ui/Toast';

export const metadata: Metadata = {
  title: 'Hụi On-Chain — Savings Circle on Solana',
  description: 'Traditional Vietnamese rotating savings circles, now secured by smart contracts on Solana.',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon.png', type: 'image/png', sizes: '512x512' },
    ],
    apple: [
      { url: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-hui-bg text-hui-text">
        <Providers>
          <Header />
          <main className="min-h-screen pt-16">
            {children}
          </main>
          <ToastContainer />
        </Providers>
      </body>
    </html>
  );
}
