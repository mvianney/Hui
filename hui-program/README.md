# Hụi On-Chain — Anchor Program

Rotating savings circle (hụi) on Solana. Fixed-order payout, USDC escrow, on-chain reputation.

## Quick Start: Solana Playground (fastest, zero install)

> **This is the recommended path.** No local toolchain needed.

### Step-by-step

1. Go to [beta.solpg.io](https://beta.solpg.io)
2. Click **"Create a new project"** → choose **Anchor (Rust)**
3. Name it `hui`
4. **Replace** the generated `src/lib.rs` with the contents of [`playground/lib.rs`](playground/lib.rs)
5. In the left sidebar, click the **wrench icon** (Build & Deploy)
6. Under **"Program Crate Dependencies"**, click **Add** and add:
   - `anchor-spl` version `0.29.0`
7. Click **Build** — wait for green checkmark ✅
8. Click **Deploy** — this deploys to devnet automatically
9. Your program ID will appear — copy it and update the `declare_id!()` at the top of lib.rs
10. **Rebuild** and **Redeploy** with the correct program ID

### Running Tests in Playground

Playground has a built-in test UI, but for the full test suite:
1. Open the **Test** tab (flask icon)
2. You can write tests directly in Playground's JS editor
3. The test file at `tests/hui.ts` is designed for `anchor test` (local validator) — for Playground, you'd call instructions manually via the UI or adapt the test

### What to verify after deploy

```
1. Create a circle with 3 test wallets
2. Have each wallet call join_circle
3. Each wallet calls contribute (check vault balance increases)
4. Call trigger_payout (check recipient token account increases)
5. Repeat for all rounds → verify status = Completed
```

---

## GitHub Codespaces (full toolchain)

### Setup

1. Push this repo to GitHub
2. Click **Code → Codespaces → New codespace**
3. Wait for container to build (~5-10 min first time)
   - Installs: Rust, Solana CLI 1.18.18, Anchor CLI 0.29.0, Node 18
4. When terminal is ready, verify:

```bash
solana --version    # 1.18.18
anchor --version    # 0.29.0
```

### Build

```bash
cd hui-program
anchor build
```

First build takes ~2-3 minutes (compiling all dependencies).

After build, update the program ID:

```bash
# Get the generated program ID
anchor keys list
# Output: hui: <PROGRAM_ID>

# Update declare_id! in lib.rs
sed -i "s/Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS/<PROGRAM_ID>/" programs/hui/src/lib.rs

# Also update Anchor.toml
sed -i "s/Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS/<PROGRAM_ID>/" Anchor.toml

# Rebuild with correct ID
anchor build
```

### Test

```bash
anchor test
```

This spins up a local Solana validator, deploys the program, and runs all tests.

Expected output:
```
  hui
    ✓ creates a circle with 5 members
    ✓ all 5 members join the circle
    ✓ completes all 5 rounds with contributions and payouts
    ✓ verifies circle is Completed and all records are correct
    ✓ finalizes all member records after completion
    negative tests (separate circle)
      ✓ rejects contribution from a non-member
      ✓ rejects double-contribution in the same round
      ✓ rejects payout when round is incomplete
      ✓ rejects mark_missed before grace period elapses
      ✓ rejects joining a circle that is already Active
      ✓ rejects finalize_member on a non-completed circle
    missed payment scenario
      ✓ member 0 and 1 contribute, member 2 skips — verifies partial state

  12 passing
```

### Deploy to Devnet

```bash
# Ensure wallet has devnet SOL
solana airdrop 5

# Deploy
anchor deploy

# Verify
solana program show <PROGRAM_ID>
```

---

## Architecture

See the build report for full details. Key points:

- **Contribution tracking**: Bitmap on Circle account (`[u32; 20]`), 80 bytes total
- **Join flow**: Pending → Active (all members must opt in before circle starts)
- **Payout**: Separate permissionless `trigger_payout` instruction
- **Missed payments**: `mark_missed` flags member but round stays blocked (MVP limitation)
- **6 instructions**: create_circle, join_circle, contribute, trigger_payout, mark_missed, finalize_member
