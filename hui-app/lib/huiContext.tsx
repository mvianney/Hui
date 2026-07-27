/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Program, AnchorProvider, BN, web3 } from '@coral-xyz/anchor';
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from '@solana/spl-token';
import { Circle, CreateCircleInput, Slot, MemberReputation } from './types';
import idl from './idl.json';

// ── Constants ──────────────────────────────────────────────
const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID ?? 'BAUzUZpbXTqtfWaRd4ANUgLA1wSh6QiKTt6ChhdWWdpB'
);

// ── Toast ───────────────────────────────────────────────────
export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

// ── Context shape ────────────────────────────────────────────
interface HuiContextValue {
  circles: Circle[];
  currentCircle: Circle | null;
  isLoading: boolean;
  toasts: Toast[];
  addToast: (message: string, type: Toast['type']) => void;
  removeToast: (id: string) => void;
  loadCircles: () => Promise<void>;
  loadCircle: (id: string) => Promise<Circle | null>;
  lookupInviteCode: (code: string) => Promise<Circle | null>;
  createCircle: (input: CreateCircleInput) => Promise<{ circle: Circle; inviteCode: string } | null>;
  joinCircle: (circleId: string, chosenSlot: number, displayName: string) => Promise<boolean>;
  startCircle: (circleId: string) => Promise<boolean>;
  contribute: (circleId: string) => Promise<boolean>;
  getMemberReputation: (circle: Circle, wallet: string) => MemberReputation | null;
}

const HuiContext = createContext<HuiContextValue | null>(null);

export function useHui() {
  const ctx = useContext(HuiContext);
  if (!ctx) throw new Error('useHui must be used inside HuiProvider');
  return ctx;
}

// ── PDA helpers ──────────────────────────────────────────────
function findCirclePda(creator: PublicKey, nonce: BN): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('circle'), creator.toBuffer(), nonce.toArrayLike(Buffer, 'le', 8)],
    PROGRAM_ID
  );
}
function findVaultPda(circle: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), circle.toBuffer()],
    PROGRAM_ID
  );
}
function findMemberRecordPda(circle: PublicKey, member: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('member_record'), circle.toBuffer(), member.toBuffer()],
    PROGRAM_ID
  );
}

// ── Data marshalling ─────────────────────────────────────────
function circleFromOnChain(pda: PublicKey, raw: any): Circle {
  const totalRounds: number = raw.totalRounds;
  const slotsFilled: number = raw.slotsFilled;
  const payoutOrder: string[] = raw.payoutOrder.map((p: PublicKey) => p.toBase58());
  const defaultKey = PublicKey.default.toBase58();

  const slots: Slot[] = Array.from({ length: totalRounds }, (_, i) => {
    const wallet = payoutOrder[i];
    const isFilled = wallet !== defaultKey;
    return {
      index: i,
      round: i + 1,
      member: isFilled
        ? { wallet, displayName: '', slotIndex: i, payoutRound: i + 1, roundsContributed: 0, roundsMissed: 0, receivedPayout: false }
        : null,
    };
  });

  const statusKey = Object.keys(raw.status)[0] as 'pending' | 'active' | 'completed';

  return {
    id: pda.toBase58(),
    name: raw.name,
    creator: raw.creator.toBase58(),
    contributionAmount: raw.contributionAmount.toNumber(),
    frequencySeconds: raw.frequencySeconds.toNumber(),
    totalRounds,
    currentRound: raw.currentRound,
    slotsFilled,
    status: statusKey,
    roundStartTs: raw.roundStartTs.toNumber(),
    slots,
    members: slots.filter(s => s.member !== null).map(s => s.member!),
    inviteCode: pda.toBase58().slice(0, 8).toUpperCase(),
  };
}

// ── Provider ─────────────────────────────────────────────────
export function HuiProvider({ children }: { children: React.ReactNode }) {
  const { connection } = useConnection();
  const wallet = useWallet();

  const [circles, setCircles] = useState<Circle[]>([]);
  const [currentCircle, setCurrentCircle] = useState<Circle | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nonceRef = useRef<number>(Date.now());

  const addToast = useCallback((message: string, type: Toast['type']) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 5000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(t => t.filter(x => x.id !== id));
  }, []);

  function getProgram(): Program | null {
    if (!wallet.publicKey || !wallet.signTransaction) return null;
    const provider = new AnchorProvider(connection, wallet as any, { commitment: 'confirmed' });
    return new Program(idl as any, provider);
  }

  // ── loadCircles ─────────────────────────────────────────────
  const loadCircles = useCallback(async () => {
    if (!wallet.publicKey) return;
    const program = getProgram();
    if (!program) return;
    try {
      const all = await (program.account as any).circle.all([
        { memcmp: { offset: 8, bytes: wallet.publicKey.toBase58() } },
      ]);
      const parsed = all.map((a: any) => circleFromOnChain(a.publicKey, a.account));
      setCircles(parsed);
    } catch (e) {
      console.error('loadCircles', e);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet.publicKey, connection]);

  // ── loadCircle ──────────────────────────────────────────────
  const loadCircle = useCallback(async (id: string): Promise<Circle | null> => {
    const program = getProgram();
    if (!program) return null;
    try {
      const pda = new PublicKey(id);
      const raw = await (program.account as any).circle.fetch(pda);
      const circle = circleFromOnChain(pda, raw);

      for (const slot of circle.slots) {
        if (!slot.member) continue;
        const memberPubkey = new PublicKey(slot.member.wallet);
        const [recordPda] = findMemberRecordPda(pda, memberPubkey);
        try {
          const record = await (program.account as any).memberRecord.fetch(recordPda);
          slot.member.displayName = record.displayName;
          slot.member.roundsContributed = record.roundsContributed;
          slot.member.roundsMissed = record.roundsMissed;
          slot.member.receivedPayout = record.receivedPayout;
        } catch { /* record not yet created */ }
      }
      circle.members = circle.slots.filter(s => s.member !== null).map(s => s.member!);

      try {
        const [vaultPda] = findVaultPda(pda);
        const vaultAccount = await getAccount(connection, vaultPda);
        circle.vaultBalance = Number(vaultAccount.amount);
      } catch { circle.vaultBalance = 0; }

      setCurrentCircle(circle);
      return circle;
    } catch (e) {
      console.error('loadCircle', e);
      return null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet.publicKey, connection]);

  // ── lookupInviteCode ────────────────────────────────────────
  const lookupInviteCode = useCallback(async (code: string): Promise<Circle | null> => {
    const program = getProgram();
    if (!program) return null;
    try {
      const all = await (program.account as any).circle.all();
      const match = all.find((a: any) => {
        const shortCode = a.publicKey.toBase58().slice(0, 8).toUpperCase();
        return shortCode === code.toUpperCase();
      });
      if (!match) return null;
      return circleFromOnChain(match.publicKey, match.account);
    } catch (e) {
      console.error('lookupInviteCode', e);
      return null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet.publicKey, connection]);

  // ── createCircle ────────────────────────────────────────────
  const createCircle = useCallback(async (
    input: CreateCircleInput
  ): Promise<{ circle: Circle; inviteCode: string } | null> => {
    if (!wallet.publicKey) { addToast('Connect your wallet first', 'error'); return null; }
    const program = getProgram();
    if (!program) return null;

    setIsLoading(true);
    try {
      const nonce = new BN(nonceRef.current++);
      const [circlePda] = findCirclePda(wallet.publicKey, nonce);
      const [vaultPda] = findVaultPda(circlePda);
      const [memberRecordPda] = findMemberRecordPda(circlePda, wallet.publicKey);

      const usdcMintStr = process.env.NEXT_PUBLIC_USDC_MINT;
      if (!usdcMintStr) throw new Error('NEXT_PUBLIC_USDC_MINT not set');
      const usdcMint = new PublicKey(usdcMintStr);

      const frequencySeconds = input.frequency === 'weekly' ? 7 * 24 * 3600 : 30 * 24 * 3600;
      const contributionAmount = new BN(input.contributionAmount * 1_000_000);

      // Construct create instruction
      const createIx = await (program.methods as any)
        .createCircle(
          nonce,
          input.name,
          contributionAmount,
          new BN(frequencySeconds),
          input.totalMembers
        )
        .accounts({
          creator: wallet.publicKey,
          circle: circlePda,
          vault: vaultPda,
          usdcMint,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .instruction();

      // Construct join instruction for the creator
      const joinIx = await (program.methods as any)
        .joinCircle(input.creatorChosenSlot, input.creatorDisplayName)
        .accounts({
          member: wallet.publicKey,
          circle: circlePda,
          memberRecord: memberRecordPda,
          systemProgram: SystemProgram.programId,
        })
        .instruction();

      // Bundle both instructions in a single transaction
      const tx = new web3.Transaction().add(createIx, joinIx);
      await (program.provider as AnchorProvider).sendAndConfirm(tx);

      const raw = await (program.account as any).circle.fetch(circlePda);
      const circle = circleFromOnChain(circlePda, raw);
      addToast(`Circle "${circle.name}" created!`, 'success');
      return { circle, inviteCode: circle.inviteCode! };
    } catch (e: any) {
      console.error('createCircle', e);
      addToast(e.message ?? 'Failed to create circle', 'error');
      return null;
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet.publicKey, connection, addToast]);

  // ── joinCircle ───────────────────────────────────────────────
  const joinCircle = useCallback(async (
    circleId: string,
    chosenSlot: number,
    displayName: string
  ): Promise<boolean> => {
    if (!wallet.publicKey) { addToast('Connect your wallet first', 'error'); return false; }
    const program = getProgram();
    if (!program) return false;

    setIsLoading(true);
    try {
      const circlePda = new PublicKey(circleId);
      const [memberRecordPda] = findMemberRecordPda(circlePda, wallet.publicKey);

      await (program.methods as any)
        .joinCircle(chosenSlot, displayName)
        .accounts({
          member: wallet.publicKey,
          circle: circlePda,
          memberRecord: memberRecordPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      addToast(`Joined slot ${chosenSlot + 1} as ${displayName}!`, 'success');
      return true;
    } catch (e: any) {
      console.error('joinCircle', e);
      const msg = e?.error?.errorCode?.code === 'SlotAlreadyTaken'
        ? 'That slot was just taken — pick another'
        : e.message ?? 'Failed to join circle';
      addToast(msg, 'error');
      return false;
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet.publicKey, connection, addToast]);

  // ── startCircle ──────────────────────────────────────────────
  const startCircle = useCallback(async (circleId: string): Promise<boolean> => {
    if (!wallet.publicKey) { addToast('Connect your wallet first', 'error'); return false; }
    const program = getProgram();
    if (!program) return false;

    setIsLoading(true);
    try {
      const circlePda = new PublicKey(circleId);
      await (program.methods as any)
        .startCircle()
        .accounts({ creator: wallet.publicKey, circle: circlePda })
        .rpc();
      addToast('Circle started! Round 1 is open.', 'success');
      return true;
    } catch (e: any) {
      console.error('startCircle', e);
      const msg = e?.error?.errorCode?.code === 'NotAllSlotsFilled'
        ? 'All slots must be filled before starting'
        : e.message ?? 'Failed to start circle';
      addToast(msg, 'error');
      return false;
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet.publicKey, connection, addToast]);

  // ── contribute ────────────────────────────────────────────────
  const contribute = useCallback(async (circleId: string): Promise<boolean> => {
    if (!wallet.publicKey) { addToast('Connect your wallet first', 'error'); return false; }
    const program = getProgram();
    if (!program) return false;

    setIsLoading(true);
    try {
      const circlePda = new PublicKey(circleId);
      const [vaultPda] = findVaultPda(circlePda);
      const [memberRecordPda] = findMemberRecordPda(circlePda, wallet.publicKey);

      const vaultAccount = await getAccount(connection, vaultPda);
      const mint = vaultAccount.mint;

      const memberAta = await getAssociatedTokenAddress(mint, wallet.publicKey);
      try {
        await getAccount(connection, memberAta);
      } catch {
        const tx = new web3.Transaction().add(
          createAssociatedTokenAccountInstruction(wallet.publicKey, memberAta, wallet.publicKey, mint)
        );
        await (program.provider as AnchorProvider).sendAndConfirm(tx);
      }

      await (program.methods as any)
        .contribute()
        .accounts({
          member: wallet.publicKey,
          circle: circlePda,
          memberRecord: memberRecordPda,
          vault: vaultPda,
          memberTokenAccount: memberAta,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      addToast('Contribution sent!', 'success');
      return true;
    } catch (e: any) {
      console.error('contribute', e);
      addToast(e.message ?? 'Failed to contribute', 'error');
      return false;
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet.publicKey, connection, addToast]);

  // ── getMemberReputation ───────────────────────────────────────
  const getMemberReputation = useCallback((circle: Circle, walletAddr: string): MemberReputation | null => {
    const member = circle.members.find(m => m.wallet === walletAddr);
    if (!member) return null;
    return {
      wallet: member.wallet,
      displayName: member.displayName,
      roundsContributed: member.roundsContributed,
      roundsMissed: member.roundsMissed,
      receivedPayout: member.receivedPayout,
    };
  }, []);

  return (
    <HuiContext.Provider value={{
      circles, currentCircle, isLoading, toasts,
      addToast, removeToast,
      loadCircles, loadCircle, lookupInviteCode,
      createCircle, joinCircle, startCircle, contribute,
      getMemberReputation,
    }}>
      {children}
    </HuiContext.Provider>
  );
}
