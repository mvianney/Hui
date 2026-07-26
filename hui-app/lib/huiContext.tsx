/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
'use client';

// ============================================================
// Hụi On-Chain — React Context
// Real Solana Program implementation.
// ============================================================

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Program, AnchorProvider, web3, BN } from '@coral-xyz/anchor';
import { PublicKey, Keypair, SystemProgram } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync, createAssociatedTokenAccountInstruction, createMintToInstruction, createInitializeMintInstruction } from '@solana/spl-token';
import { Circle, CreateCircleInput, MemberReputation, Member, Contribution, Round, CircleStatus } from './types';
import idl from './idl.json';

// --- Toast System ---
export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

// --- Context Shape ---
interface HuiContextValue {
  circles: Circle[];
  currentCircle: Circle | undefined;
  loadCircles: () => void;
  loadCircle: (id: string) => void;
  lookupInviteCode: (code: string) => Promise<Circle | undefined>;
  createCircle: (input: CreateCircleInput, organizerWallet: string) => Circle;
  joinCircle: (circleId: string, wallet: string, displayName: string) => Circle | undefined;
  contribute: (circleId: string, wallet: string, roundNumber: number) => Circle | undefined;
  getMemberReputation: (circle: Circle, wallet: string) => MemberReputation | undefined;
  toasts: Toast[];
  addToast: (type: Toast['type'], message: string) => void;
  removeToast: (id: string) => void;
  isLoading: boolean;
}

const HuiContext = createContext<HuiContextValue | undefined>(undefined);

// --- Constants ---
const PROGRAM_ID = new PublicKey(idl.address || 'BAUzUZpbXTqtfWaRd4ANUgLA1wSh6QiKTt6ChhdWWdpB');

// Deterministic keypair generator from string
const deriveKeypairFromName = (seedStr: string): Keypair => {
  const seed = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    let hash = 0;
    for (let j = 0; j < seedStr.length; j++) {
      hash = (hash << 5) - hash + seedStr.charCodeAt(j) + i;
      hash |= 0;
    }
    seed[i] = Math.abs(hash) % 256;
  }
  return Keypair.fromSeed(seed);
};

// Custom browser-safe Wallet implementation for simulated members
class SimpleKeypairWallet {
  constructor(public keypair: Keypair) {}
  get publicKey(): PublicKey {
    return this.keypair.publicKey;
  }
  async signTransaction(tx: web3.Transaction): Promise<web3.Transaction> {
    tx.partialSign(this.keypair);
    return tx;
  }
  async signAllTransactions(txs: web3.Transaction[]): Promise<web3.Transaction[]> {
    return txs.map((t) => {
      t.partialSign(this.keypair);
      return t;
    });
  }
}

// Deterministic Mock USDC Mint Keypair
const usdcMintKeypair = deriveKeypairFromName('Hui_USDC_Mock_Mint_Keypair_Seed');
const usdcMint = usdcMintKeypair.publicKey;

// Local caching for display names (since they aren't on-chain)
const getCachedName = (walletAddress: string): string => {
  if (typeof window !== 'undefined') {
    const cached = localStorage.getItem(`hui_name_${walletAddress}`);
    if (cached) return cached;
  }
  return `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`;
};

const setCachedName = (walletAddress: string, name: string) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(`hui_name_${walletAddress}`, name);
  }
};

// --- PDA Helpers ---
const findCirclePda = (creator: PublicKey, nonce: number) => {
  const nonceBuffer = Buffer.alloc(8);
  nonceBuffer.writeBigUInt64LE(BigInt(nonce));
  return PublicKey.findProgramAddressSync(
    [Buffer.from('circle'), creator.toBuffer(), nonceBuffer],
    PROGRAM_ID
  );
};

const findVaultPda = (circleKey: PublicKey) => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), circleKey.toBuffer()],
    PROGRAM_ID
  );
};

const findMemberRecordPda = (circleKey: PublicKey, memberKey: PublicKey) => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('member_record'), circleKey.toBuffer(), memberKey.toBuffer()],
    PROGRAM_ID
  );
};

export function HuiProvider({ children }: { children: ReactNode }) {
  const { connection } = useConnection();
  const wallet = useWallet();

  const [circles, setCircles] = useState<Circle[]>([]);
  const [currentCircle, setCurrentCircle] = useState<Circle | undefined>();
  const [reputations, setReputations] = useState<Record<string, MemberReputation>>({});
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // --- Toast helpers ---
  const addToast = useCallback((type: Toast['type'], message: string) => {
    const id = Math.random().toString(36).substring(2, 8);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // --- Ensure Mock USDC Mint exists ---
  const ensureMockUSDCMint = async (provider: AnchorProvider) => {
    try {
      const mintInfo = await connection.getAccountInfo(usdcMint);
      if (!mintInfo) {
        console.log('Mock USDC mint does not exist. Initializing...');
        const MINT_SIZE = 82; // Size of SPL Mint Account
        const lamports = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);
        
        const tx = new web3.Transaction().add(
          web3.SystemProgram.createAccount({
            fromPubkey: provider.publicKey!,
            newAccountPubkey: usdcMint,
            space: MINT_SIZE,
            lamports,
            programId: TOKEN_PROGRAM_ID,
          }),
          createInitializeMintInstruction(usdcMint, 6, provider.publicKey!, provider.publicKey!)
        );
        
        await provider.sendAndConfirm(tx, [usdcMintKeypair]);
        console.log('Mock USDC mint initialized at:', usdcMint.toBase58());
      }
    } catch (e) {
      console.error('Failed to initialize mock USDC Mint:', e);
    }
  };

  // Helper to ensure member has funded ATA with USDC
  const ensureUSDCBalance = async (memberPubkey: PublicKey, amount: number, provider: AnchorProvider) => {
    const ata = getAssociatedTokenAddressSync(usdcMint, memberPubkey);
    const info = await connection.getAccountInfo(ata);
    const tx = new web3.Transaction();

    if (!info) {
      console.log(`Creating Associated Token Account for ${memberPubkey.toBase58()}...`);
      tx.add(
        createAssociatedTokenAccountInstruction(
          provider.publicKey!,
          ata,
          memberPubkey,
          usdcMint
        )
      );
    }

    tx.add(
      createMintToInstruction(
        usdcMint,
        ata,
        wallet.publicKey ? wallet.publicKey : provider.publicKey!,
        BigInt(amount * 1000000) // 6 decimals
      )
    );

    await provider.sendAndConfirm(tx);
  };

  // --- Mapper ---
  const mapOnChainCircleToCircle = useCallback((circleAccount: any, pubkey: PublicKey): Circle => {
    const data = circleAccount.account;
    const id = pubkey.toBase58();
    const inviteCode = id.slice(0, 6).toUpperCase();
    const freq = data.frequencySeconds.toString() === '604800' ? 'weekly' : 'monthly';

    let status: CircleStatus = 'pending';
    if (data.status.active) status = 'active';
    else if (data.status.completed) status = 'completed';

    const totalRounds = Number(data.totalRounds);
    const payoutOrder = data.payoutOrder
      .slice(0, totalRounds)
      .map((k: PublicKey) => k.toBase58());

    const members: Member[] = [];
    for (let i = 0; i < totalRounds; i++) {
      const address = payoutOrder[i];
      const hasJoined = (data.membersJoined & (1 << i)) !== 0;
      const name = getCachedName(address);

      const contributionHistory: Contribution[] = [];
      for (let r = 0; r < totalRounds; r++) {
        const bit = (data.contributions[r] & (1 << i)) !== 0;
        contributionHistory.push({
          memberWallet: address,
          roundNumber: r + 1,
          status: bit ? 'paid' : (r + 1 < Number(data.currentRound) ? 'missed' : 'pending'),
        });
      }

      members.push({
        walletAddress: address,
        displayName: name,
        hasJoined,
        contributionHistory,
        hasReceivedPayout: Number(data.currentRound) > i + 1 || (status === 'completed'),
        payoutRound: i + 1,
      });
    }

    const rounds: Round[] = [];
    for (let r = 0; r < totalRounds; r++) {
      const recipientWallet = payoutOrder[r];
      const recipientName = getCachedName(recipientWallet);
      const contributionsReceived: Contribution[] = [];

      for (let i = 0; i < totalRounds; i++) {
        const address = payoutOrder[i];
        const bit = (data.contributions[r] & (1 << i)) !== 0;
        contributionsReceived.push({
          memberWallet: address,
          roundNumber: r + 1,
          status: bit ? 'paid' : (r + 1 < Number(data.currentRound) ? 'missed' : 'pending'),
        });
      }

      let roundStatus: Round['status'] = 'upcoming';
      if (r + 1 < Number(data.currentRound)) {
        roundStatus = 'complete';
      } else if (r + 1 === Number(data.currentRound)) {
        roundStatus = 'open';
      }

      rounds.push({
        roundNumber: r + 1,
        dueDate: new Date((Number(data.roundStartTs) + r * Number(data.frequencySeconds)) * 1000).toISOString(),
        recipientWallet,
        recipientName,
        contributionsReceived,
        status: roundStatus,
      });
    }

    return {
      id,
      name: data.name,
      inviteCode,
      contributionAmount: Number(data.contributionAmount) / 1000000,
      frequency: freq as any,
      totalRounds,
      currentRound: Number(data.currentRound),
      members,
      payoutOrder,
      rounds,
      status,
      createdAt: new Date().toISOString(),
      organizerWallet: data.creator.toBase58(),
    };
  }, []);

  // --- Load Actions ---
  const loadCircles = useCallback(async () => {
    if (!wallet.connected) return;
    setIsLoading(true);
    try {
      const provider = new AnchorProvider(connection, wallet as any, { commitment: 'confirmed' });
      const program = new Program(idl as any, provider) as any;
      
      const fetched = await program.account.circle.all();
      const mapped = fetched.map((item: any) => mapOnChainCircleToCircle(item, item.publicKey));
      
      setCircles(mapped);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [connection, wallet, mapOnChainCircleToCircle]);

  const loadCircle = useCallback(async (id: string) => {
    setIsLoading(true);
    try {
      const provider = new AnchorProvider(connection, wallet as any, { commitment: 'confirmed' });
      const program = new Program(idl as any, provider) as any;
      const circlePda = new PublicKey(id);
      
      const account = await program.account.circle.fetch(circlePda);
      const mapped = mapOnChainCircleToCircle({ account }, circlePda);
      setCurrentCircle(mapped);

      // Fetch all member records for reputation views
      const records = await program.account.memberRecord.all([
        {
          memcmp: {
            offset: 40,
            bytes: id,
          }
        }
      ]);

      const repMap: Record<string, MemberReputation> = {};
      records.forEach((recordObj: any) => {
        const rec = recordObj.account;
        const wAddress = rec.member.toBase58();
        const dName = getCachedName(wAddress);
        
        repMap[wAddress] = {
          walletAddress: wAddress,
          displayName: dName,
          circleName: mapped.name,
          totalRounds: mapped.totalRounds,
          roundsCompleted: Number(rec.roundsContributed),
          roundsMissed: Number(rec.roundsMissed),
          payoutReceived: rec.receivedPayout,
          payoutRound: Number(rec.payoutRound),
          completionRate: mapped.totalRounds > 0 
            ? Math.round((Number(rec.roundsContributed) / mapped.totalRounds) * 100) 
            : 100,
          completedAt: new Date().toISOString(),
        };
      });
      setReputations(repMap);

    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [connection, wallet, mapOnChainCircleToCircle]);

  const lookupInviteCode = useCallback(async (code: string) => {
    try {
      const provider = new AnchorProvider(connection, wallet as any, { commitment: 'confirmed' });
      const program = new Program(idl as any, provider) as any;
      
      const fetched = await program.account.circle.all();
      const found = fetched.find((item: any) => item.publicKey.toBase58().slice(0, 6).toUpperCase() === code.toUpperCase());
      
      if (found) {
        return mapOnChainCircleToCircle(found, found.publicKey);
      }
    } catch (err) {
      console.error(err);
    }
    return undefined;
  }, [connection, wallet, mapOnChainCircleToCircle]);

  // --- Create ---
  const handleCreateCircle = useCallback(
    (input: CreateCircleInput, organizerWallet: string) => {
      if (!wallet.publicKey) {
        addToast('error', 'Wallet not connected');
        throw new Error('Wallet not connected');
      }

      const creatorKey = new PublicKey(wallet.publicKey);
      const nonce = Math.floor(Math.random() * 1000000);
      const [circlePda] = findCirclePda(creatorKey, nonce);
      const id = circlePda.toBase58();
      const inviteCode = id.slice(0, 6).toUpperCase();

      // Create a temporary circle object to return synchronously to UI
      const tempCircle: Circle = {
        id,
        name: input.name,
        inviteCode,
        contributionAmount: input.contributionAmount,
        frequency: input.frequency,
        totalRounds: input.totalRounds,
        currentRound: 0,
        members: input.memberNames.map((name, i) => {
          const address = i === 0 ? creatorKey.toBase58() : deriveKeypairFromName(`${id}_member_${i}_${name}`).publicKey.toBase58();
          setCachedName(address, name);
          return {
            walletAddress: address,
            displayName: name,
            hasJoined: i === 0,
            contributionHistory: [],
            hasReceivedPayout: false,
          };
        }),
        payoutOrder: input.memberNames.map((name, i) => {
          return i === 0 ? creatorKey.toBase58() : deriveKeypairFromName(`${id}_member_${i}_${name}`).publicKey.toBase58();
        }),
        rounds: [],
        status: 'pending',
        createdAt: new Date().toISOString(),
        organizerWallet: creatorKey.toBase58(),
      };

      // Background web3 transaction execution
      (async () => {
        try {
          const provider = new AnchorProvider(connection, wallet as any, { commitment: 'confirmed' });
          const program = new Program(idl as any, provider) as any;

          // Ensure mock mint exists
          await ensureMockUSDCMint(provider);

          const memberPubkeys: PublicKey[] = tempCircle.payoutOrder.map(addr => new PublicKey(addr));

          await program.methods
            .createCircle(
              new BN(nonce),
              input.name,
              new BN(input.contributionAmount * 1000000), // 6 decimals
              new BN(input.frequency === 'weekly' ? 604800 : 2592000),
              input.totalRounds,
              memberPubkeys
            )
            .accounts({
              creator: creatorKey,
              circle: circlePda,
              vault: findVaultPda(circlePda)[0],
              usdcMint,
              systemProgram: SystemProgram.programId,
              tokenProgram: TOKEN_PROGRAM_ID,
              rent: web3.SYSVAR_RENT_PUBKEY,
            })
            .rpc();

          console.log('Circle created on-chain.');
          addToast('success', `Circle "${tempCircle.name}" created on-chain!`);
          
          const circleAccount = await program.account.circle.fetch(circlePda);
          const circleObj = mapOnChainCircleToCircle({ account: circleAccount }, circlePda);
          setCircles((prev) => [...prev, circleObj]);
          setCurrentCircle(circleObj);
        } catch (err: any) {
          console.error(err);
          addToast('error', `Failed to create circle: ${err.message || err.toString()}`);
        }
      })();

      return tempCircle;
    },
    [connection, wallet, mapOnChainCircleToCircle, addToast]
  );

  // --- Join ---
  const handleJoinCircle = useCallback(
    (circleId: string, walletAddress: string, displayName: string) => {
      const circlePda = new PublicKey(circleId);
      const memberKey = new PublicKey(walletAddress);
      const memberPda = findMemberRecordPda(circlePda, memberKey)[0];

      // Cache display name
      setCachedName(walletAddress, displayName);

      // Create a temporary updated circle object to return synchronously to UI
      const updatedMembers = currentCircle?.members.map(m => 
        m.walletAddress === walletAddress ? { ...m, hasJoined: true } : m
      ) || [];
      
      const tempCircle: Circle | undefined = currentCircle ? {
        ...currentCircle,
        members: updatedMembers,
        status: updatedMembers.every(m => m.hasJoined) ? 'active' : 'pending',
        currentRound: updatedMembers.every(m => m.hasJoined) ? 1 : 0
      } : undefined;

      // Background web3 transaction execution
      (async () => {
        try {
          const provider = new AnchorProvider(connection, wallet as any, { commitment: 'confirmed' });
          const program = new Program(idl as any, provider) as any;

          let tx: string;
          if (wallet.publicKey && wallet.publicKey.toBase58() === walletAddress) {
            tx = await program.methods
              .joinCircle()
              .accounts({
                member: wallet.publicKey,
                circle: circlePda,
                memberRecord: memberPda,
                systemProgram: SystemProgram.programId,
              })
              .rpc();
          } else {
          // Simulated member join
          const isLocalhost = connection.rpcEndpoint.includes('127.0.0.1') || connection.rpcEndpoint.includes('localhost');
          if (!isLocalhost) {
            addToast('error', 'Simulated member actions are only supported on local host / local validator.');
            setIsLoading(false);
            return undefined;
          }

          const circleAccount = await program.account.circle.fetch(circlePda);
            const payoutOrder = circleAccount.payoutOrder.map((k: PublicKey) => k.toBase58());
            const index = payoutOrder.indexOf(walletAddress);
            if (index === -1) throw new Error('Wallet not in payout order');

            const memberKp = deriveKeypairFromName(`${circleId}_member_${index}_${displayName}`);
            
            // Auto-fund SOL for fees
            const solBalance = await connection.getBalance(memberKp.publicKey);
            if (solBalance < 5000000) {
              const transferTx = new web3.Transaction().add(
                web3.SystemProgram.transfer({
                  fromPubkey: wallet.publicKey!,
                  toPubkey: memberKp.publicKey,
                  lamports: 10000000,
                })
              );
              await provider.sendAndConfirm(transferTx);
            }

            const memberProvider = new AnchorProvider(connection, new SimpleKeypairWallet(memberKp) as any, { commitment: 'confirmed' });
            const memberProgram = new Program(idl as any, memberProvider) as any;

            tx = await memberProgram.methods
              .joinCircle()
              .accounts({
                member: memberKp.publicKey,
                circle: circlePda,
                memberRecord: memberPda,
                systemProgram: SystemProgram.programId,
              })
              .rpc();
          }

          console.log('Joined circle on-chain. Tx:', tx);
          addToast('success', `Joined successfully!`);

          const circleAccount = await program.account.circle.fetch(circlePda);
          const circleObj = mapOnChainCircleToCircle({ account: circleAccount }, circlePda);
          setCircles(prev => prev.map(c => c.id === circleId ? circleObj : c));
          if (currentCircle?.id === circleId) setCurrentCircle(circleObj);
        } catch (err: any) {
          console.error(err);
          addToast('error', `Failed to join: ${err.message || err.toString()}`);
        }
      })();

      return tempCircle;
    },
    [connection, wallet, currentCircle, mapOnChainCircleToCircle, addToast]
  );

  // --- Contribute ---
  const handleContribute = useCallback(
    (circleId: string, walletAddress: string, roundNumber: number) => {
      const circlePda = new PublicKey(circleId);
      const vaultPda = findVaultPda(circlePda)[0];
      const contributorKey = new PublicKey(walletAddress);
      const memberRecordPda = findMemberRecordPda(circlePda, contributorKey)[0];
      const memberAta = getAssociatedTokenAddressSync(usdcMint, contributorKey);

      // Create a temporary updated circle object to return synchronously to UI
      const tempCircle: Circle | undefined = currentCircle ? {
        ...currentCircle,
        members: currentCircle.members.map(m => {
          if (m.walletAddress === walletAddress) {
            const hist = [...m.contributionHistory];
            const idx = hist.findIndex(h => h.roundNumber === roundNumber);
            if (idx !== -1) hist[idx].status = 'paid';
            else hist.push({ memberWallet: walletAddress, roundNumber, status: 'paid' });
            return { ...m, contributionHistory: hist };
          }
          return m;
        })
      } : undefined;

      // Background web3 transaction execution
      (async () => {
        try {
          const provider = new AnchorProvider(connection, wallet as any, { commitment: 'confirmed' });
          const program = new Program(idl as any, provider) as any;

          const circleAccount = await program.account.circle.fetch(circlePda);
          const contributionAmount = Number(circleAccount.contributionAmount);

          // Ensure user has ATA and USDC
          await ensureUSDCBalance(contributorKey, contributionAmount / 1000000, provider);

          let tx: string;
          if (wallet.publicKey && wallet.publicKey.toBase58() === walletAddress) {
            tx = await program.methods
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
          } else {
          // Simulated member contribute
          const isLocalhost = connection.rpcEndpoint.includes('127.0.0.1') || connection.rpcEndpoint.includes('localhost');
          if (!isLocalhost) {
            addToast('error', 'Simulated member actions are only supported on local host / local validator.');
            setIsLoading(false);
            return undefined;
          }

          const payoutOrder = circleAccount.payoutOrder.map((k: PublicKey) => k.toBase58());
            const index = payoutOrder.indexOf(walletAddress);
            const name = getCachedName(walletAddress);
            const memberKp = deriveKeypairFromName(`${circleId}_member_${index}_${name}`);

            const solBalance = await connection.getBalance(memberKp.publicKey);
            if (solBalance < 5000000) {
              const transferTx = new web3.Transaction().add(
                web3.SystemProgram.transfer({
                  fromPubkey: wallet.publicKey!,
                  toPubkey: memberKp.publicKey,
                  lamports: 10000000,
                })
              );
              await provider.sendAndConfirm(transferTx);
            }

            const memberProvider = new AnchorProvider(connection, new SimpleKeypairWallet(memberKp) as any, { commitment: 'confirmed' });
            const memberProgram = new Program(idl as any, memberProvider) as any;

            tx = await memberProgram.methods
              .contribute()
              .accounts({
                member: memberKp.publicKey,
                circle: circlePda,
                memberRecord: memberRecordPda,
                vault: vaultPda,
                memberTokenAccount: memberAta,
                tokenProgram: TOKEN_PROGRAM_ID,
              })
              .rpc();
          }

          console.log('Contribution recorded on-chain. Tx:', tx);
          addToast('success', `Contributed successfully!`);

          // Check if round is ready for payout
          const updatedCircleAccount = await program.account.circle.fetch(circlePda);
          const mappedCircle = mapOnChainCircleToCircle({ account: updatedCircleAccount }, circlePda);
          
          const currentRoundIdx = Number(updatedCircleAccount.currentRound) - 1;
          const mask = (1 << Number(updatedCircleAccount.memberCount)) - 1;
          const allPaid = (updatedCircleAccount.contributions[currentRoundIdx] & mask) === mask;

          if (allPaid && updatedCircleAccount.status.active) {
            console.log('All contributions in. Triggering payout...');
            const recipientPubkey = updatedCircleAccount.payoutOrder[currentRoundIdx];
            const recipientAta = getAssociatedTokenAddressSync(usdcMint, recipientPubkey);

            // Ensure recipient has ATA
            const recipientAtaInfo = await connection.getAccountInfo(recipientAta);
            if (!recipientAtaInfo) {
              const createAtaTx = new web3.Transaction().add(
                createAssociatedTokenAccountInstruction(
                  wallet.publicKey || provider.publicKey!,
                  recipientAta,
                  recipientPubkey,
                  usdcMint
                )
              );
              await provider.sendAndConfirm(createAtaTx);
            }

            const payoutTx = await program.methods
              .triggerPayout()
              .accounts({
                payer: wallet.publicKey || provider.publicKey!,
                circle: circlePda,
                vault: vaultPda,
                recipient: recipientPubkey,
                recipientTokenAccount: recipientAta,
                tokenProgram: TOKEN_PROGRAM_ID,
              })
              .rpc();

            console.log('Payout distributed. Tx:', payoutTx);
            addToast('success', `Round ${roundNumber} complete! Payout distributed.`);

            const finalCircleAccount = await program.account.circle.fetch(circlePda);
            const finalCircle = mapOnChainCircleToCircle({ account: finalCircleAccount }, circlePda);

            setCircles(prev => prev.map(c => c.id === circleId ? finalCircle : c));
            if (currentCircle?.id === circleId) setCurrentCircle(finalCircle);
          } else {
            setCircles(prev => prev.map(c => c.id === circleId ? mappedCircle : c));
            if (currentCircle?.id === circleId) setCurrentCircle(mappedCircle);
          }
        } catch (err: any) {
          console.error(err);
          addToast('error', `Failed to contribute: ${err.message || err.toString()}`);
        }
      })();

      return tempCircle;
    },
    [connection, wallet, currentCircle, mapOnChainCircleToCircle, addToast]
  );

  const handleGetMemberReputation = useCallback(
    (circle: Circle, walletAddress: string) => {
      return reputations[walletAddress];
    },
    [reputations]
  );

  // Load circles automatically when wallet connects
  useEffect(() => {
    if (wallet.connected) {
      loadCircles();
    }
  }, [wallet.connected, loadCircles]);

  return (
    <HuiContext.Provider
      value={{
        circles,
        currentCircle,
        loadCircles,
        loadCircle,
        lookupInviteCode,
        createCircle: handleCreateCircle,
        joinCircle: handleJoinCircle,
        contribute: handleContribute,
        getMemberReputation: handleGetMemberReputation,
        toasts,
        addToast,
        removeToast,
        isLoading,
      }}
    >
      {children}
    </HuiContext.Provider>
  );
}

export function useHui(): HuiContextValue {
  const ctx = useContext(HuiContext);
  if (!ctx) {
    throw new Error('useHui must be used within a HuiProvider');
  }
  return ctx;
}
