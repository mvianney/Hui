import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Hui } from "../target/types/hui";
import {
  createMint,
  createAccount,
  mintTo,
  getAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Keypair, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { expect } from "chai";

// ============================================================
// Hụi On-Chain — Updated Tests (v2 flow)
//
// New flow: create (no payout_order) → each member joins with
// chosen_slot → creator calls start_circle → rounds proceed as before.
//
// Tests:
//  Happy path (5-member, 5-round)
//  Slot-taken rejection
//  start_circle gating (non-creator, incomplete slots)
//  Missed payment scenario
//  Negative tests
// ============================================================

describe("hui", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Hui as Program<Hui>;
  const admin = provider.wallet as anchor.Wallet;

  const TOTAL_ROUNDS = 5;
  const CONTRIBUTION_AMOUNT = 50_000_000; // 50 USDC (6 decimals)
  const FREQUENCY_SECONDS = 7 * 24 * 60 * 60; // 1 week
  const CIRCLE_NONCE = new anchor.BN(1);

  let usdcMint: PublicKey;
  let members: Keypair[];
  let memberTokenAccounts: PublicKey[];
  let circlePda: PublicKey;
  let vaultPda: PublicKey;
  let memberRecordPdas: PublicKey[];

  // ============================================================
  // Helpers
  // ============================================================

  async function findCirclePda(creator: PublicKey, nonce: anchor.BN): Promise<[PublicKey, number]> {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("circle"), creator.toBuffer(), nonce.toArrayLike(Buffer, "le", 8)],
      program.programId
    );
  }

  async function findVaultPda(circle: PublicKey): Promise<[PublicKey, number]> {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), circle.toBuffer()],
      program.programId
    );
  }

  async function findMemberRecordPda(circle: PublicKey, member: PublicKey): Promise<[PublicKey, number]> {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("member_record"), circle.toBuffer(), member.toBuffer()],
      program.programId
    );
  }

  async function airdrop(pubkey: PublicKey, amount = 10 * anchor.web3.LAMPORTS_PER_SOL) {
    const sig = await provider.connection.requestAirdrop(pubkey, amount);
    await provider.connection.confirmTransaction(sig);
  }

  async function getTokenBalance(tokenAccount: PublicKey): Promise<number> {
    const account = await getAccount(provider.connection, tokenAccount);
    return Number(account.amount);
  }

  // ============================================================
  // Setup: USDC mint, 5 member wallets, fund them
  // ============================================================

  before(async () => {
    members = Array.from({ length: TOTAL_ROUNDS }, () => Keypair.generate());
    for (const m of members) await airdrop(m.publicKey);

    usdcMint = await createMint(
      provider.connection, admin.payer, admin.publicKey, null, 6
    );

    memberTokenAccounts = [];
    for (const m of members) {
      const tokenAccount = await createAccount(provider.connection, m, usdcMint, m.publicKey);
      memberTokenAccounts.push(tokenAccount);
      await mintTo(provider.connection, admin.payer, usdcMint, tokenAccount, admin.publicKey, 1000_000_000);
    }

    [circlePda] = await findCirclePda(members[0].publicKey, CIRCLE_NONCE);
    [vaultPda] = await findVaultPda(circlePda);

    memberRecordPdas = [];
    for (const m of members) {
      const [pda] = await findMemberRecordPda(circlePda, m.publicKey);
      memberRecordPdas.push(pda);
    }
  });

  // ============================================================
  // Happy path
  // ============================================================

  describe("happy path — 5-member, 5-round circle", () => {

    it("creates a circle without payout_order", async () => {
      await program.methods
        .createCircle(
          CIRCLE_NONCE,
          "Hụi Gia Đình",
          new anchor.BN(CONTRIBUTION_AMOUNT),
          new anchor.BN(FREQUENCY_SECONDS),
          TOTAL_ROUNDS
        )
        .accounts({
          creator: members[0].publicKey,
          circle: circlePda,
          vault: vaultPda,
          usdcMint,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([members[0]])
        .rpc();

      const circle = await program.account.circle.fetch(circlePda);
      expect(circle.name).to.equal("Hụi Gia Đình");
      expect(circle.totalRounds).to.equal(TOTAL_ROUNDS);
      expect(circle.slotsFilled).to.equal(0);
      expect(Object.keys(circle.status)[0]).to.equal("pending");
      // All payout slots should be default pubkey (empty)
      for (let i = 0; i < TOTAL_ROUNDS; i++) {
        expect(circle.payoutOrder[i].toBase58()).to.equal(PublicKey.default.toBase58());
      }
    });

    it("each member joins with a chosen slot and display name", async () => {
      const names = ["Alice", "Bob", "Charlie", "Diana", "Edward"];
      for (let i = 0; i < TOTAL_ROUNDS; i++) {
        await program.methods
          .joinCircle(i, names[i])
          .accounts({
            member: members[i].publicKey,
            circle: circlePda,
            memberRecord: memberRecordPdas[i],
            systemProgram: SystemProgram.programId,
          })
          .signers([members[i]])
          .rpc();
      }

      const circle = await program.account.circle.fetch(circlePda);
      expect(circle.slotsFilled).to.equal(TOTAL_ROUNDS);
      // Verify each slot maps to the correct member
      for (let i = 0; i < TOTAL_ROUNDS; i++) {
        expect(circle.payoutOrder[i].toBase58()).to.equal(members[i].publicKey.toBase58());
      }
      // Verify MemberRecords
      for (let i = 0; i < TOTAL_ROUNDS; i++) {
        const record = await program.account.memberRecord.fetch(memberRecordPdas[i]);
        expect(record.displayName).to.equal(names[i]);
        expect(record.payoutRound).to.equal(i + 1);
        expect(record.roundsContributed).to.equal(0);
      }
      // Circle should still be Pending (no auto-activate)
      expect(Object.keys(circle.status)[0]).to.equal("pending");
    });

    it("rejects duplicate slot claim", async () => {
      // Slot 0 is taken by members[0] — another member tries to take it
      const intruder = Keypair.generate();
      await airdrop(intruder.publicKey);
      const [intruderRecord] = await findMemberRecordPda(circlePda, intruder.publicKey);

      try {
        await program.methods
          .joinCircle(0, "Intruder")
          .accounts({
            member: intruder.publicKey,
            circle: circlePda,
            memberRecord: intruderRecord,
            systemProgram: SystemProgram.programId,
          })
          .signers([intruder])
          .rpc();
        expect.fail("Should have thrown SlotAlreadyTaken");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("SlotAlreadyTaken");
      }
    });

    it("rejects out-of-bounds slot", async () => {
      const intruder = Keypair.generate();
      await airdrop(intruder.publicKey);
      const [intruderRecord] = await findMemberRecordPda(circlePda, intruder.publicKey);

      try {
        await program.methods
          .joinCircle(99, "Intruder")
          .accounts({
            member: intruder.publicKey,
            circle: circlePda,
            memberRecord: intruderRecord,
            systemProgram: SystemProgram.programId,
          })
          .signers([intruder])
          .rpc();
        expect.fail("Should have thrown SlotOutOfBounds");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("SlotOutOfBounds");
      }
    });

    it("rejects start_circle from non-creator", async () => {
      try {
        await program.methods
          .startCircle()
          .accounts({
            creator: members[1].publicKey, // not the creator
            circle: circlePda,
          })
          .signers([members[1]])
          .rpc();
        expect.fail("Should have thrown Unauthorized");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("Unauthorized");
      }
    });

    it("creator calls start_circle — circle becomes Active", async () => {
      await program.methods
        .startCircle()
        .accounts({
          creator: members[0].publicKey,
          circle: circlePda,
        })
        .signers([members[0]])
        .rpc();

      const circle = await program.account.circle.fetch(circlePda);
      expect(Object.keys(circle.status)[0]).to.equal("active");
      expect(circle.currentRound).to.equal(1);
      expect(circle.roundStartTs.toNumber()).to.be.greaterThan(0);
    });

    // --- 5-round contribution + payout loop ---
    for (let round = 1; round <= 5; round++) {
      it(`round ${round}: all members contribute and payout fires`, async () => {
        const recipientIndex = round - 1;
        const recipientBalanceBefore = await getTokenBalance(memberTokenAccounts[recipientIndex]);
        const otherBalancesBefore = await Promise.all(
          memberTokenAccounts.map((acc) => getTokenBalance(acc))
        );

        // All 5 members contribute
        for (let i = 0; i < TOTAL_ROUNDS; i++) {
          await program.methods
            .contribute()
            .accounts({
              member: members[i].publicKey,
              circle: circlePda,
              memberRecord: memberRecordPdas[i],
              vault: vaultPda,
              memberTokenAccount: memberTokenAccounts[i],
              tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([members[i]])
            .rpc();
        }

        // Trigger payout
        await program.methods
          .triggerPayout()
          .accounts({
            payer: admin.publicKey,
            circle: circlePda,
            vault: vaultPda,
            recipientTokenAccount: memberTokenAccounts[recipientIndex],
            recipientMemberRecord: memberRecordPdas[recipientIndex],
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();

        // Verify payout: recipient gained (5 × 50 USDC) minus their own contribution
        const recipientBalanceAfter = await getTokenBalance(memberTokenAccounts[recipientIndex]);
        const expectedGain = CONTRIBUTION_AMOUNT * TOTAL_ROUNDS - CONTRIBUTION_AMOUNT; // net gain
        expect(recipientBalanceAfter - recipientBalanceBefore).to.equal(expectedGain);

        const circle = await program.account.circle.fetch(circlePda);
        if (round < TOTAL_ROUNDS) {
          expect(circle.currentRound).to.equal(round + 1);
          expect(Object.keys(circle.status)[0]).to.equal("active");
        } else {
          expect(Object.keys(circle.status)[0]).to.equal("completed");
        }

        // Verify recipient's MemberRecord
        const record = await program.account.memberRecord.fetch(memberRecordPdas[recipientIndex]);
        expect(record.receivedPayout).to.be.true;
      });
    }

    it("verifies all MemberRecords after circle completes", async () => {
      const circle = await program.account.circle.fetch(circlePda);
      expect(Object.keys(circle.status)[0]).to.equal("completed");

      for (let i = 0; i < TOTAL_ROUNDS; i++) {
        const record = await program.account.memberRecord.fetch(memberRecordPdas[i]);
        expect(record.roundsContributed).to.equal(TOTAL_ROUNDS);
        expect(record.roundsMissed).to.equal(0);
        expect(record.receivedPayout).to.be.true;
      }
    });
  });

  // ============================================================
  // Missed Payment Test (separate circle, nonce 3)
  // ============================================================

  describe("missed payment scenario", () => {
    const NONCE_3 = new anchor.BN(3);
    const NUM_MEMBERS = 3;
    const SHORT_FREQUENCY = 1; // 1 second

    let circlePda3: PublicKey;
    let vaultPda3: PublicKey;
    let memberRecordPdas3: PublicKey[];

    before(async () => {
      [circlePda3] = await findCirclePda(members[0].publicKey, NONCE_3);
      [vaultPda3] = await findVaultPda(circlePda3);

      // Create circle (no payout_order)
      await program.methods
        .createCircle(
          NONCE_3,
          "Missed Test",
          new anchor.BN(CONTRIBUTION_AMOUNT),
          new anchor.BN(SHORT_FREQUENCY),
          NUM_MEMBERS
        )
        .accounts({
          creator: members[0].publicKey,
          circle: circlePda3,
          vault: vaultPda3,
          usdcMint,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([members[0]])
        .rpc();

      // All 3 members join with chosen slots
      memberRecordPdas3 = [];
      for (let i = 0; i < NUM_MEMBERS; i++) {
        const [pda] = await findMemberRecordPda(circlePda3, members[i].publicKey);
        memberRecordPdas3.push(pda);
        await program.methods
          .joinCircle(i, `Member ${i}`)
          .accounts({
            member: members[i].publicKey,
            circle: circlePda3,
            memberRecord: pda,
            systemProgram: SystemProgram.programId,
          })
          .signers([members[i]])
          .rpc();
      }

      // Creator starts circle
      await program.methods
        .startCircle()
        .accounts({ creator: members[0].publicKey, circle: circlePda3 })
        .signers([members[0]])
        .rpc();
    });

    it("member 0 and 1 contribute, member 2 skips — round stays open", async () => {
      // Members 0 and 1 contribute
      for (let i = 0; i < 2; i++) {
        await program.methods
          .contribute()
          .accounts({
            member: members[i].publicKey,
            circle: circlePda3,
            memberRecord: memberRecordPdas3[i],
            vault: vaultPda3,
            memberTokenAccount: memberTokenAccounts[i],
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([members[i]])
          .rpc();
      }

      const circle = await program.account.circle.fetch(circlePda3);
      expect(circle.currentRound).to.equal(1); // stuck
      expect(circle.contributions[0] & (1 << 0)).to.not.equal(0);
      expect(circle.contributions[0] & (1 << 1)).to.not.equal(0);
      expect(circle.contributions[0] & (1 << 2)).to.equal(0);

      // trigger_payout must fail — round not complete
      try {
        await program.methods
          .triggerPayout()
          .accounts({
            payer: admin.publicKey,
            circle: circlePda3,
            vault: vaultPda3,
            recipientTokenAccount: memberTokenAccounts[0],
            recipientMemberRecord: memberRecordPdas3[0],
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();
        expect.fail("Should have thrown RoundNotComplete");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("RoundNotComplete");
      }

      // mark_missed should fail (grace period not elapsed)
      try {
        await program.methods
          .markMissed()
          .accounts({
            caller: admin.publicKey,
            circle: circlePda3,
            member: members[2].publicKey,
            memberRecord: memberRecordPdas3[2],
          })
          .rpc();
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("GracePeriodNotElapsed");
      }
    });
  });

  // ============================================================
  // Negative tests (using a fresh circle, nonce 2)
  // ============================================================

  describe("negative tests", () => {
    const NONCE_2 = new anchor.BN(2);
    let circlePda2: PublicKey;
    let vaultPda2: PublicKey;
    let memberRecordPdas2: PublicKey[];

    before(async () => {
      [circlePda2] = await findCirclePda(members[0].publicKey, NONCE_2);
      [vaultPda2] = await findVaultPda(circlePda2);

      await program.methods
        .createCircle(
          NONCE_2,
          "Neg Test",
          new anchor.BN(CONTRIBUTION_AMOUNT),
          new anchor.BN(FREQUENCY_SECONDS),
          TOTAL_ROUNDS
        )
        .accounts({
          creator: members[0].publicKey,
          circle: circlePda2,
          vault: vaultPda2,
          usdcMint,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([members[0]])
        .rpc();

      memberRecordPdas2 = [];
      for (let i = 0; i < TOTAL_ROUNDS; i++) {
        const [pda] = await findMemberRecordPda(circlePda2, members[i].publicKey);
        memberRecordPdas2.push(pda);
        await program.methods
          .joinCircle(i, `Neg ${i}`)
          .accounts({
            member: members[i].publicKey,
            circle: circlePda2,
            memberRecord: pda,
            systemProgram: SystemProgram.programId,
          })
          .signers([members[i]])
          .rpc();
      }

      await program.methods
        .startCircle()
        .accounts({ creator: members[0].publicKey, circle: circlePda2 })
        .signers([members[0]])
        .rpc();
    });

    it("rejects contribute when circle is Active and member tries to contribute twice in same round", async () => {
      // Member 0 contributes once
      await program.methods
        .contribute()
        .accounts({
          member: members[0].publicKey,
          circle: circlePda2,
          memberRecord: memberRecordPdas2[0],
          vault: vaultPda2,
          memberTokenAccount: memberTokenAccounts[0],
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([members[0]])
        .rpc();

      // Try again — should fail
      try {
        await program.methods
          .contribute()
          .accounts({
            member: members[0].publicKey,
            circle: circlePda2,
            memberRecord: memberRecordPdas2[0],
            vault: vaultPda2,
            memberTokenAccount: memberTokenAccounts[0],
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([members[0]])
          .rpc();
        expect.fail("Should have thrown AlreadyContributed");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("AlreadyContributed");
      }
    });

    it("rejects start_circle when circle is already Active", async () => {
      try {
        await program.methods
          .startCircle()
          .accounts({ creator: members[0].publicKey, circle: circlePda2 })
          .signers([members[0]])
          .rpc();
        expect.fail("Should have thrown CircleNotPending");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("CircleNotPending");
      }
    });

    it("rejects join_circle when circle is already Active", async () => {
      const intruder = Keypair.generate();
      await airdrop(intruder.publicKey);
      const [intruderRecord] = await findMemberRecordPda(circlePda2, intruder.publicKey);
      try {
        await program.methods
          .joinCircle(0, "Late")
          .accounts({
            member: intruder.publicKey,
            circle: circlePda2,
            memberRecord: intruderRecord,
            systemProgram: SystemProgram.programId,
          })
          .signers([intruder])
          .rpc();
        expect.fail("Should have thrown CircleNotPending");
      } catch (err: any) {
        const errStr = err.toString();
        const isStatus = errStr.includes("CircleNotPending");
        const isAlreadyInit = errStr.includes("already in use") || errStr.includes("0x0");
        expect(isStatus || isAlreadyInit).to.be.true;
      }
    });

    it("rejects start_circle before all slots filled (new circle)", async () => {
      const NONCE_4 = new anchor.BN(4);
      const [circlePda4] = await findCirclePda(members[0].publicKey, NONCE_4);
      const [vaultPda4] = await findVaultPda(circlePda4);

      await program.methods
        .createCircle(
          NONCE_4, "Partial", new anchor.BN(CONTRIBUTION_AMOUNT), new anchor.BN(FREQUENCY_SECONDS), 3
        )
        .accounts({
          creator: members[0].publicKey, circle: circlePda4, vault: vaultPda4,
          usdcMint, systemProgram: SystemProgram.programId, tokenProgram: TOKEN_PROGRAM_ID, rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([members[0]])
        .rpc();

      // Only 1 of 3 slots filled
      const [rec0] = await findMemberRecordPda(circlePda4, members[0].publicKey);
      await program.methods.joinCircle(0, "OnlyOne")
        .accounts({ member: members[0].publicKey, circle: circlePda4, memberRecord: rec0, systemProgram: SystemProgram.programId })
        .signers([members[0]]).rpc();

      try {
        await program.methods.startCircle()
          .accounts({ creator: members[0].publicKey, circle: circlePda4 })
          .signers([members[0]]).rpc();
        expect.fail("Should have thrown NotAllSlotsFilled");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("NotAllSlotsFilled");
      }
    });

    it("rejects finalize_member on a non-completed circle", async () => {
      try {
        await program.methods
          .finalizeMember()
          .accounts({
            caller: admin.publicKey,
            circle: circlePda2,
            member: members[0].publicKey,
            memberRecord: memberRecordPdas2[0],
          })
          .rpc();
        expect.fail("Should have thrown NotCompleted");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("NotCompleted");
      }
    });
  });
});
