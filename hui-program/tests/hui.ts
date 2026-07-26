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
// Hụi On-Chain — Anchor TypeScript Tests
//
// Simulates a full 5-member, 5-round circle end-to-end:
// create → all join → each round: all contribute → payout →
// verify balances → repeat → verify completion + reputation
//
// Also includes missed-payment and negative test cases.
// ============================================================

describe("hui", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Hui as Program<Hui>;
  const admin = provider.wallet as anchor.Wallet;

  // --- Constants ---
  const TOTAL_ROUNDS = 5;
  const CONTRIBUTION_AMOUNT = 50_000_000; // 50 USDC (6 decimals)
  const FREQUENCY_SECONDS = 7 * 24 * 60 * 60; // 1 week
  const CIRCLE_NONCE = new anchor.BN(1);

  // --- Accounts ---
  let usdcMint: PublicKey;
  let members: Keypair[];
  let memberTokenAccounts: PublicKey[];
  let circlePda: PublicKey;
  let circleBump: number;
  let vaultPda: PublicKey;
  let vaultBump: number;
  let memberRecordPdas: PublicKey[];

  // ============================================================
  // Helpers
  // ============================================================

  async function findCirclePda(creator: PublicKey, nonce: anchor.BN): Promise<[PublicKey, number]> {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from("circle"),
        creator.toBuffer(),
        nonce.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );
  }

  async function findVaultPda(circle: PublicKey): Promise<[PublicKey, number]> {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), circle.toBuffer()],
      program.programId
    );
  }

  async function findMemberRecordPda(
    circle: PublicKey,
    member: PublicKey
  ): Promise<[PublicKey, number]> {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("member_record"), circle.toBuffer(), member.toBuffer()],
      program.programId
    );
  }

  async function airdrop(pubkey: PublicKey, amount = 10 * anchor.web3.LAMPORTS_PER_SOL) {
    const sig = await provider.connection.requestAirdrop(pubkey, amount);
    await provider.connection.confirmTransaction(sig);
  }

  async function getVaultBalance(): Promise<number> {
    const vaultAccount = await getAccount(provider.connection, vaultPda);
    return Number(vaultAccount.amount);
  }

  async function getTokenBalance(tokenAccount: PublicKey): Promise<number> {
    const account = await getAccount(provider.connection, tokenAccount);
    return Number(account.amount);
  }

  // ============================================================
  // Setup: Create USDC mint, 5 member wallets, fund them
  // ============================================================

  before(async () => {
    // Create 5 member keypairs
    members = Array.from({ length: TOTAL_ROUNDS }, () => Keypair.generate());

    // Airdrop SOL to all members (for tx fees)
    for (const m of members) {
      await airdrop(m.publicKey);
    }

    // Create a mock USDC mint (admin is mint authority)
    usdcMint = await createMint(
      provider.connection,
      admin.payer,
      admin.publicKey,
      null,
      6 // 6 decimals like real USDC
    );

    // Create token accounts for each member and mint USDC
    memberTokenAccounts = [];
    for (const m of members) {
      const tokenAccount = await createAccount(
        provider.connection,
        m,
        usdcMint,
        m.publicKey
      );
      memberTokenAccounts.push(tokenAccount);

      // Mint 1000 USDC to each member
      await mintTo(
        provider.connection,
        admin.payer,
        usdcMint,
        tokenAccount,
        admin.publicKey,
        1000_000_000 // 1000 USDC
      );
    }

    // Derive PDAs
    [circlePda, circleBump] = await findCirclePda(members[0].publicKey, CIRCLE_NONCE);
    [vaultPda, vaultBump] = await findVaultPda(circlePda);

    // Derive MemberRecord PDAs
    memberRecordPdas = [];
    for (const m of members) {
      const [pda] = await findMemberRecordPda(circlePda, m.publicKey);
      memberRecordPdas.push(pda);
    }
  });

  // ============================================================
  // Test 1: Create Circle
  // ============================================================

  it("creates a circle with 5 members", async () => {
    const payoutOrder = members.map((m) => m.publicKey);

    await program.methods
      .createCircle(
        CIRCLE_NONCE,
        "Hụi Gia Đình",
        new anchor.BN(CONTRIBUTION_AMOUNT),
        new anchor.BN(FREQUENCY_SECONDS),
        TOTAL_ROUNDS,
        payoutOrder
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

    // Verify circle state
    const circle = await program.account.circle.fetch(circlePda);
    expect(circle.name).to.equal("Hụi Gia Đình");
    expect(circle.contributionAmount.toNumber()).to.equal(CONTRIBUTION_AMOUNT);
    expect(circle.totalRounds).to.equal(TOTAL_ROUNDS);
    expect(circle.currentRound).to.equal(0); // Not active yet
    expect(circle.memberCount).to.equal(TOTAL_ROUNDS);
    expect(Object.keys(circle.status)[0]).to.equal("pending");
    expect(circle.membersJoined).to.equal(0);

    // Verify vault exists with zero balance
    const vaultBalance = await getVaultBalance();
    expect(vaultBalance).to.equal(0);
  });

  // ============================================================
  // Test 2: All Members Join
  // ============================================================

  it("all 5 members join the circle", async () => {
    for (let i = 0; i < TOTAL_ROUNDS; i++) {
      await program.methods
        .joinCircle()
        .accounts({
          member: members[i].publicKey,
          circle: circlePda,
          memberRecord: memberRecordPdas[i],
          systemProgram: SystemProgram.programId,
        })
        .signers([members[i]])
        .rpc();

      // Verify MemberRecord
      const record = await program.account.memberRecord.fetch(memberRecordPdas[i]);
      expect(record.member.toBase58()).to.equal(members[i].publicKey.toBase58());
      expect(record.payoutRound).to.equal(i + 1);
      expect(record.receivedPayout).to.be.false;
      expect(record.completedCircle).to.be.false;
    }

    // After last member joins, circle should be Active
    const circle = await program.account.circle.fetch(circlePda);
    expect(Object.keys(circle.status)[0]).to.equal("active");
    expect(circle.currentRound).to.equal(1);
    expect(circle.roundStartTs.toNumber()).to.be.greaterThan(0);
  });

  // ============================================================
  // Test 3: Full 5-Round Cycle
  // ============================================================

  it("completes all 5 rounds with contributions and payouts", async () => {
    for (let round = 1; round <= TOTAL_ROUNDS; round++) {
      const recipientIndex = round - 1;
      const recipientBalanceBefore = await getTokenBalance(
        memberTokenAccounts[recipientIndex]
      );

      // All members contribute
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

      // Verify vault has the pot
      const vaultBalance = await getVaultBalance();
      expect(vaultBalance).to.equal(CONTRIBUTION_AMOUNT * TOTAL_ROUNDS);

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

      // Verify recipient received the pot
      const recipientBalanceAfter = await getTokenBalance(
        memberTokenAccounts[recipientIndex]
      );
      const expectedPot = CONTRIBUTION_AMOUNT * TOTAL_ROUNDS;
      expect(recipientBalanceAfter - recipientBalanceBefore).to.equal(
        expectedPot - CONTRIBUTION_AMOUNT // net gain = pot minus own contribution
      );

      // Verify vault is now empty
      const vaultBalanceAfter = await getVaultBalance();
      expect(vaultBalanceAfter).to.equal(0);

      // Verify recipient's MemberRecord
      const recipientRecord = await program.account.memberRecord.fetch(
        memberRecordPdas[recipientIndex]
      );
      expect(recipientRecord.receivedPayout).to.be.true;

      // Check circle state
      const circle = await program.account.circle.fetch(circlePda);
      if (round < TOTAL_ROUNDS) {
        expect(Object.keys(circle.status)[0]).to.equal("active");
        expect(circle.currentRound).to.equal(round + 1);
      } else {
        expect(Object.keys(circle.status)[0]).to.equal("completed");
      }
    }
  });

  // ============================================================
  // Test 4: Verify Final State After Completion
  // ============================================================

  it("verifies circle is Completed and all records are correct", async () => {
    const circle = await program.account.circle.fetch(circlePda);
    expect(Object.keys(circle.status)[0]).to.equal("completed");

    for (let i = 0; i < TOTAL_ROUNDS; i++) {
      const record = await program.account.memberRecord.fetch(memberRecordPdas[i]);
      expect(record.roundsContributed).to.equal(TOTAL_ROUNDS);
      expect(record.roundsMissed).to.equal(0);
      expect(record.receivedPayout).to.be.true;
      expect(record.payoutRound).to.equal(i + 1);
    }
  });

  // ============================================================
  // Test 5: Finalize Member Records
  // ============================================================

  it("finalizes all member records after completion", async () => {
    for (let i = 0; i < TOTAL_ROUNDS; i++) {
      await program.methods
        .finalizeMember()
        .accounts({
          caller: admin.publicKey,
          circle: circlePda,
          member: members[i].publicKey,
          memberRecord: memberRecordPdas[i],
        })
        .rpc();

      const record = await program.account.memberRecord.fetch(memberRecordPdas[i]);
      expect(record.completedCircle).to.be.true;
    }
  });

  // ============================================================
  // Negative Test Cases
  // ============================================================

  describe("negative tests (separate circle)", () => {
    const NONCE_2 = new anchor.BN(2);
    let circlePda2: PublicKey;
    let vaultPda2: PublicKey;
    let memberRecordPdas2: PublicKey[];
    const NUM_MEMBERS = 3;

    before(async () => {
      // Create a 3-member circle for negative tests
      [circlePda2] = await findCirclePda(members[0].publicKey, NONCE_2);
      [vaultPda2] = await findVaultPda(circlePda2);

      const payoutOrder = members.slice(0, NUM_MEMBERS).map((m) => m.publicKey);

      await program.methods
        .createCircle(
          NONCE_2,
          "Test Circle",
          new anchor.BN(CONTRIBUTION_AMOUNT),
          new anchor.BN(FREQUENCY_SECONDS),
          NUM_MEMBERS,
          payoutOrder
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

      // All 3 members join
      memberRecordPdas2 = [];
      for (let i = 0; i < NUM_MEMBERS; i++) {
        const [pda] = await findMemberRecordPda(circlePda2, members[i].publicKey);
        memberRecordPdas2.push(pda);

        await program.methods
          .joinCircle()
          .accounts({
            member: members[i].publicKey,
            circle: circlePda2,
            memberRecord: pda,
            systemProgram: SystemProgram.programId,
          })
          .signers([members[i]])
          .rpc();
      }
    });

    it("rejects contribution from a non-member", async () => {
      // members[3] is NOT in this 3-member circle
      const nonMember = members[3];
      const [fakePda] = await findMemberRecordPda(circlePda2, nonMember.publicKey);

      // Capture vault balance before to verify nothing changed
      const vaultBefore = await getTokenBalance(vaultPda2);

      try {
        await program.methods
          .contribute()
          .accounts({
            member: nonMember.publicKey,
            circle: circlePda2,
            memberRecord: fakePda,
            vault: vaultPda2,
            memberTokenAccount: memberTokenAccounts[3],
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([nonMember])
          .rpc();
        expect.fail("Should have thrown — non-member cannot contribute");
      } catch (err: any) {
        // MemberRecord PDA for a non-member doesn't exist, so Anchor throws
        // AccountNotInitialized (the PDA was never created via join_circle).
        // This is the correct rejection path — the seeds constraint fails.
        const errMsg = err.toString();
        const hasExpectedError = ["AccountNotFound", "ConstraintSeeds", "AccountOwnedByWrongProgram", "AccountNotInitialized"].some(x => errMsg.includes(x));
        expect(hasExpectedError, `Expected error message to contain one of the constraints, got: ${errMsg}`).to.be.true;
      }

      // Verify vault balance unchanged (no funds were transferred)
      const vaultAfter = await getTokenBalance(vaultPda2);
      expect(vaultAfter).to.equal(vaultBefore);
    });

    it("rejects double-contribution in the same round", async () => {
      // Member 0 contributes
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

      // Member 0 tries to contribute again
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
        expect.fail("Should have thrown");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("AlreadyContributed");
      }
    });

    it("rejects payout when round is incomplete", async () => {
      // Only member 0 has contributed (out of 3)
      try {
        await program.methods
          .triggerPayout()
          .accounts({
            payer: admin.publicKey,
            circle: circlePda2,
            vault: vaultPda2,
            recipientTokenAccount: memberTokenAccounts[0],
            recipientMemberRecord: memberRecordPdas2[0],
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();
        expect.fail("Should have thrown");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("RoundNotComplete");
      }
    });

    it("rejects mark_missed before grace period elapses", async () => {
      try {
        await program.methods
          .markMissed()
          .accounts({
            caller: admin.publicKey,
            circle: circlePda2,
            member: members[1].publicKey,
            memberRecord: memberRecordPdas2[1],
          })
          .rpc();
        expect.fail("Should have thrown");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("GracePeriodNotElapsed");
      }
    });

    it("rejects joining a circle that is already Active", async () => {
      // Circle is Active. Re-joining should fail because:
      // 1. Circle status constraint requires Pending (CircleNotPending), OR
      // 2. MemberRecord PDA already exists (Anchor init constraint)
      // Either error is a valid rejection.

      // Verify circle is indeed Active before the test
      const circleBefore = await program.account.circle.fetch(circlePda2);
      expect(Object.keys(circleBefore.status)[0]).to.equal("active");

      try {
        await program.methods
          .joinCircle()
          .accounts({
            member: members[0].publicKey,
            circle: circlePda2,
            memberRecord: memberRecordPdas2[0],
            systemProgram: SystemProgram.programId,
          })
          .signers([members[0]])
          .rpc();
        expect.fail("Should have thrown — cannot join Active circle");
      } catch (err: any) {
        // Anchor will reject because the Circle has status constraint requiring Pending,
        // or because the MemberRecord account already exists (PDA already initialized).
        const errStr = err.toString();
        const isStatusError = errStr.includes("CircleNotPending");
        const isAlreadyInitialized = errStr.includes("already in use") || errStr.includes("0x0");
        expect(isStatusError || isAlreadyInitialized).to.be.true;
      }

      // Verify circle state unchanged
      const circleAfter = await program.account.circle.fetch(circlePda2);
      expect(Object.keys(circleAfter.status)[0]).to.equal("active");
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
        expect.fail("Should have thrown");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("NotCompleted");
      }
    });
  });

  // ============================================================
  // Missed Payment Test (separate circle)
  // ============================================================

  describe("missed payment scenario", () => {
    const NONCE_3 = new anchor.BN(3);
    let circlePda3: PublicKey;
    let vaultPda3: PublicKey;
    let memberRecordPdas3: PublicKey[];
    const NUM_MEMBERS = 3;
    // Use very short frequency so grace period test is feasible
    // (in real tests with a local validator, we'd warp time)
    const SHORT_FREQUENCY = 1; // 1 second

    before(async () => {
      [circlePda3] = await findCirclePda(members[0].publicKey, NONCE_3);
      [vaultPda3] = await findVaultPda(circlePda3);

      const payoutOrder = members.slice(0, NUM_MEMBERS).map((m) => m.publicKey);

      await program.methods
        .createCircle(
          NONCE_3,
          "Missed Test",
          new anchor.BN(CONTRIBUTION_AMOUNT),
          new anchor.BN(SHORT_FREQUENCY),
          NUM_MEMBERS,
          payoutOrder
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

      // All join
      memberRecordPdas3 = [];
      for (let i = 0; i < NUM_MEMBERS; i++) {
        const [pda] = await findMemberRecordPda(circlePda3, members[i].publicKey);
        memberRecordPdas3.push(pda);

        await program.methods
          .joinCircle()
          .accounts({
            member: members[i].publicKey,
            circle: circlePda3,
            memberRecord: pda,
            systemProgram: SystemProgram.programId,
          })
          .signers([members[i]])
          .rpc();
      }
    });

    it("member 0 and 1 contribute, member 2 skips — verifies partial state and blocked round", async () => {
      // Capture balances before
      const member0BalanceBefore = await getTokenBalance(memberTokenAccounts[0]);
      const member1BalanceBefore = await getTokenBalance(memberTokenAccounts[1]);
      const member2BalanceBefore = await getTokenBalance(memberTokenAccounts[2]);

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

      // Verify vault has exactly 2 contributions
      const vaultBalance = await getTokenBalance(vaultPda3);
      expect(vaultBalance).to.equal(CONTRIBUTION_AMOUNT * 2);

      // Verify member balances decreased correctly
      const member0BalanceAfter = await getTokenBalance(memberTokenAccounts[0]);
      const member1BalanceAfter = await getTokenBalance(memberTokenAccounts[1]);
      const member2BalanceAfter = await getTokenBalance(memberTokenAccounts[2]);
      expect(member0BalanceBefore - member0BalanceAfter).to.equal(CONTRIBUTION_AMOUNT);
      expect(member1BalanceBefore - member1BalanceAfter).to.equal(CONTRIBUTION_AMOUNT);
      expect(member2BalanceAfter).to.equal(member2BalanceBefore); // Unchanged

      // Verify MemberRecord state: members 0 and 1 have contributed
      const record0 = await program.account.memberRecord.fetch(memberRecordPdas3[0]);
      const record1 = await program.account.memberRecord.fetch(memberRecordPdas3[1]);
      const record2 = await program.account.memberRecord.fetch(memberRecordPdas3[2]);
      expect(record0.roundsContributed).to.equal(1);
      expect(record1.roundsContributed).to.equal(1);
      expect(record2.roundsContributed).to.equal(0); // Skipped

      // Verify bitmap: bits 0 and 1 set, bit 2 clear
      const circle = await program.account.circle.fetch(circlePda3);
      const round0Bitmap = circle.contributions[0];
      expect(round0Bitmap & (1 << 0)).to.not.equal(0); // member 0 paid
      expect(round0Bitmap & (1 << 1)).to.not.equal(0); // member 1 paid
      expect(round0Bitmap & (1 << 2)).to.equal(0);      // member 2 skipped

      // Verify circle is still on round 1 (not advanced)
      expect(circle.currentRound).to.equal(1);
      expect(Object.keys(circle.status)[0]).to.equal("active");

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
        // If this somehow succeeds (clock drift), verify the record was updated
        const updatedRecord = await program.account.memberRecord.fetch(memberRecordPdas3[2]);
        expect(updatedRecord.roundsMissed).to.equal(1);
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("GracePeriodNotElapsed");
        // Verify member record unchanged
        const unchangedRecord = await program.account.memberRecord.fetch(memberRecordPdas3[2]);
        expect(unchangedRecord.roundsMissed).to.equal(0);
      }

      // Verify round is blocked — trigger_payout must fail
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
        expect.fail("Should have thrown — round is incomplete");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("RoundNotComplete");
      }

      // Final sanity: vault still has the partial contributions
      const vaultFinal = await getTokenBalance(vaultPda3);
      expect(vaultFinal).to.equal(CONTRIBUTION_AMOUNT * 2);
    });
  });
});
