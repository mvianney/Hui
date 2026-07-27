import { NextRequest, NextResponse } from 'next/server';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { getOrCreateAssociatedTokenAccount, mintTo, getAccount } from '@solana/spl-token';

// 1000 USDC (6 decimal places)
const FAUCET_AMOUNT = 1_000 * 1_000_000;
// 1 hour cooldown per wallet
const COOLDOWN_MS = 60 * 60 * 1_000;
// Only active on devnet
const IS_DEVNET = (process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? '').includes('devnet');

// In-memory rate limiter (resets on cold start — fine for devnet)
const lastMint = new Map<string, number>();

export async function POST(req: NextRequest) {
  if (!IS_DEVNET) {
    return NextResponse.json({ error: 'Faucet only available on devnet' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const recipient: string = body.recipient;

    if (!recipient) {
      return NextResponse.json({ error: 'Missing recipient address' }, { status: 400 });
    }

    // Validate it's a valid pubkey
    let recipientPubkey: PublicKey;
    try {
      recipientPubkey = new PublicKey(recipient);
    } catch {
      return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
    }

    // Rate limit check
    const now = Date.now();
    const last = lastMint.get(recipient);
    if (last && now - last < COOLDOWN_MS) {
      const remainingMin = Math.ceil((COOLDOWN_MS - (now - last)) / 60_000);
      return NextResponse.json(
        { error: `Already minted recently. Try again in ${remainingMin} min.` },
        { status: 429 }
      );
    }

    // Load mint authority keypair — server-only env var, never in browser bundle
    const faucetKeypairStr = process.env.FAUCET_KEYPAIR;
    if (!faucetKeypairStr) {
      return NextResponse.json({ error: 'Faucet not configured (FAUCET_KEYPAIR missing)' }, { status: 500 });
    }
    const faucetKeypair = Keypair.fromSecretKey(
      Uint8Array.from(JSON.parse(faucetKeypairStr) as number[])
    );

    const mintAddress = process.env.NEXT_PUBLIC_USDC_MINT;
    if (!mintAddress) {
      return NextResponse.json({ error: 'USDC mint not configured' }, { status: 500 });
    }
    const mintPubkey = new PublicKey(mintAddress);

    const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.devnet.solana.com';
    const connection = new Connection(rpcUrl, 'confirmed');

    // Get or create the recipient's associated token account
    const ata = await getOrCreateAssociatedTokenAccount(
      connection,
      faucetKeypair,       // payer for ATA creation
      mintPubkey,
      recipientPubkey
    );

    // Check current balance — don't mint if they already have plenty
    let currentBalance = BigInt(0);
    try {
      const accountInfo = await getAccount(connection, ata.address);
      currentBalance = accountInfo.amount;
    } catch { /* ATA was just created, balance is 0 */ }

    const MAX_BALANCE = BigInt(5_000 * 1_000_000); // 5000 USDC cap
    if (currentBalance >= MAX_BALANCE) {
      return NextResponse.json(
        { error: 'Wallet already has enough test USDC (≥5000). No top-up needed.' },
        { status: 400 }
      );
    }

    // Mint tokens
    const sig = await mintTo(
      connection,
      faucetKeypair,       // payer
      mintPubkey,
      ata.address,         // destination ATA
      faucetKeypair,       // mint authority
      FAUCET_AMOUNT
    );

    lastMint.set(recipient, now);

    return NextResponse.json({ signature: sig, amount: 1000 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[faucet]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// Also support GET to check balance
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet');
  if (!wallet) return NextResponse.json({ balance: 0 });

  try {
    const mintAddress = process.env.NEXT_PUBLIC_USDC_MINT;
    if (!mintAddress) return NextResponse.json({ balance: 0 });

    const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.devnet.solana.com';
    const connection = new Connection(rpcUrl, 'confirmed');

    const { getAssociatedTokenAddress } = await import('@solana/spl-token');
    const ata = await getAssociatedTokenAddress(
      new PublicKey(mintAddress),
      new PublicKey(wallet)
    );
    const accountInfo = await getAccount(connection, ata);
    const balance = Number(accountInfo.amount) / 1_000_000;
    return NextResponse.json({ balance });
  } catch {
    return NextResponse.json({ balance: 0 });
  }
}
