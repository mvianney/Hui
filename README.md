# Hụi On-Chain

A trustless implementation of the Vietnamese rotating savings circle (*hụi*) on the Solana blockchain.

## What This Is

Hụi is a traditional Vietnamese ROSCA (Rotating Savings and Credit Association) where a group of members each contribute a fixed amount every round, and one member receives the entire pot per round until everyone has received once. The problem with traditional hụi is custody risk — the organizer (*chủ hụi*) holds all the money, and absconding (*giật hụi*) is a documented real-world failure mode. This project replaces the human custodian with a Solana program-controlled escrow vault. Contributions go into the vault on-chain; payouts are triggered only when all members have contributed for the round. No single party can take the money.

This project was built as part of a hackathon/bounty to demonstrate a production-ready Solana smart contract for traditional finance use cases in Southeast Asia.

---

## Current Status

**Anchor program:** Deployed and verified on Solana Devnet.
- Program ID: `BAUzUZpbXTqtfWaRd4ANUgLA1wSh6QiKTt6ChhdWWdpB`
- 12/12 tests passing (happy path, missed payment scenario, negative tests)
- Instructions implemented: `create_circle`, `join_circle`, `contribute`, `trigger_payout`, `mark_missed`, `finalize_member`

**Frontend (Next.js):** Wired to real on-chain Anchor program calls — no mock data layer.
- Wallet connection via Phantom (using `@solana/wallet-adapter-react`)
- Creates circles, joins via invite code, contributes SPL tokens, triggers payouts
- Reads live on-chain state for circle dashboard
- Production build passes with zero TypeScript/ESLint errors

**Tested end-to-end:** Full 5-round lifecycle executed programmatically against local validator with real transaction signatures and balance changes verified per round.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contract | Rust, Anchor 0.30.1 |
| Blockchain | Solana (Devnet / local validator) |
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Wallet | Phantom via `@solana/wallet-adapter-react` |
| Token | SPL Token (mock USDC for devnet testing) |

---

## Local Setup

### Requirements

- Rust + Cargo (`rustup`)
- Solana CLI ≥ 1.18
- Anchor CLI 1.0.2 (`cargo install --git https://github.com/coral-xyz/anchor avm`)
- Node.js ≥ 18
- Phantom browser extension

### Run the frontend

```bash
cd hui-app
cp .env.example .env.local     # adjust values if needed
npm install
npm run dev
# Open http://localhost:3000
```

### Run Anchor tests (requires local validator)

```bash
cd hui-program
anchor test
# Runs 12 tests against a local validator spun up automatically
```

### Deploy program to devnet (already deployed — only needed if redeploying)

```bash
cd hui-program
anchor build
solana program deploy target/deploy/hui.so \
  --program-id target/deploy/hui-keypair.json \
  --url https://api.devnet.solana.com
```

---

## Devnet Program

- **Program ID:** `BAUzUZpbXTqtfWaRd4ANUgLA1wSh6QiKTt6ChhdWWdpB`
- **Explorer:** https://explorer.solana.com/address/BAUzUZpbXTqtfWaRd4ANUgLA1wSh6QiKTt6ChhdWWdpB?cluster=devnet
- **To test:** Switch Phantom to Devnet, get test SOL from https://faucet.solana.com, open the frontend

---

## Known Limitations

- **Fixed payout order only.** Payout order is set at circle creation and cannot be changed. A bidding/auction mechanism for payout position (standard in commercial hụi) is on the roadmap.
- **Single verifier model for missed payments.** `mark_missed` can currently only be called by the circle creator acting as sole verifier. A decentralised quorum model is not yet implemented.
- **Simulated members are local-only.** The frontend can auto-sign contributions for non-real members, but this feature is strictly gated to localhost/local validator and will refuse to run on devnet or mainnet.
- **Mock USDC only on devnet.** The app uses a locally-minted SPL test token as a USDC stand-in. Real USDC integration requires Circle's token on mainnet.
- **No reputation portability.** On-chain reputation records exist per circle but are not yet aggregated or cross-referenced across multiple circles.
- **No dispute resolution.** If a member misses a payment and the creator does not call `mark_missed`, the round stalls. There is no timeout-based auto-resolution yet.

---

## Roadmap

- [ ] Bidding auction for payout position (members bid SOL to go earlier)
- [ ] Decentralised missed-payment verification (quorum of members, not just creator)
- [ ] Cross-circle reputation aggregation on-chain
- [ ] Real USDC integration (mainnet)
- [ ] Timeout-based auto-resolution for stalled rounds
- [ ] Mobile-optimised UI
- [ ] Mainnet deployment
