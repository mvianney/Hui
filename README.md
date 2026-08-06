# Hụi On-Chain
**A trustless implementation of Vietnam's traditional rotating savings circle (*hụi*) on Solana.**

---

## 🔗 Live Demo
* **App URL:** [https://hui-mu.vercel.app](https://hui-mu.vercel.app)
* **Target Network:** Solana Devnet
* 📄 Pitch Deck: [Hui-OnChain-Pitch-Deck.pdf](./Hui-OnChain-Pitch-Deck.pdf)
* **Testing Guide:**
  1. Install the [Phantom Wallet](https://phantom.app/) browser extension and switch the network settings to **Devnet**.
  2. Visit [https://hui-mu.vercel.app](https://hui-mu.vercel.app).
  3. Connect your wallet and click **"Get Test USDC"** to receive test USDC instantly. Note: you'll also need a small amount of Devnet SOL for transaction fees — if the in-app faucet doesn't provide this automatically, get free Devnet SOL manually from [faucet.solana.com](https://faucet.solana.com) before creating or joining a circle.

---

## 📖 What This Is
*Hụi* (also known as rotating savings circles or ROSCAs) is a popular, century-old traditional financial system in Vietnam and Southeast Asia. A group of trusted individuals gathers to pool money; each round, every member contributes a set amount, and one member receives the accumulated pool (the pot). The rounds repeat until every member has received the pot exactly once.

### The Problem
Traditional hụi relies entirely on a single trusted human custodian—the host (*chủ hụi*). Real-world custody failure is highly common; the host can abscond with the pool (*giật hụi*), or the circle can collapse due to unpaid contributions (*bể hụi / vỡ hụi*). This results in recurring, devastating financial harm to households that rely on hụi for credit.

### The Solution
**Hụi On-Chain** replaces the centralized custodian with a decentralized Solana program (smart contract). All pooled funds are held in a Program Derived Address (PDA) escrow vault governed solely by the code. 
* **Escrow Guarantee:** No individual (including the creator) can withdraw vault funds arbitrarily.
* **Automated Release:** Payouts are triggered automatically to that round's designated recipient's account the moment the final member's contribution for that round is confirmed.

---

## ⚡ Why On-Chain?
* **Zero Host Risk:** By moving custody to a smart contract escrow, the single point of failure (the host) is eliminated entirely.
* **Permissionless Payouts:** Funds are locked to the specific slots set during setup. Payout release does not depend on a host's approval.
* **Legal Context:** Hụi is a recognized, legally valid contract structure in Vietnam under **Article 471 of the 2015 Civil Code of Vietnam**, making an on-chain translation highly compatible with local regulatory environments.

---

## 🛠️ Tech Stack
* **On-Chain Program:** Rust, Anchor Framework (0.30.1)
* **Client Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS
* **Wallet Connection:** `@solana/wallet-adapter-react` (supporting Phantom and standard Solana wallets)
* **Tokens:** SPL Token Standard (representing test USDC)
* **Hosting:** Vercel

---

## 🗃️ Program Info
* **Cluster:** Devnet
* **Program ID:** `BAUzUZpbXTqtfWaRd4ANUgLA1wSh6QiKTt6ChhdWWdpB`
* **Solana Explorer:** [View on Explorer](https://explorer.solana.com/address/BAUzUZpbXTqtfWaRd4ANUgLA1wSh6QiKTt6ChhdWWdpB?cluster=devnet)

---

## ⚙️ How It Works (Actual Current Flow)
1. **Circle Creation:** The creator initializes a circle by specifying:
   * A circle name
   * Contribution amount per round (in USDC)
   * Round frequency (Weekly or Monthly)
   * Number of slots (rounds)
   * The creator chooses their own payout slot and inputs their display name directly during creation.
2. **Joining:** Other members join the circle by entering the shareable 6-character Invite Code. They choose from the remaining open slots (already taken slots are disabled) and input their display name.
3. **Pending Start:** The dashboard updates live as users join. Once all slots are filled (100% capacity), the status changes to "Pending Start". Only the circle's creator can click **"Start Circle"** to lock the slots, set the start timestamp, and begin the rounds.
4. **Contributions:** During an active round, members contribute the round amount. A countdown display indicates the contribution deadline (Weekly circles use a 5-day payment window; Monthly circles scale proportionally to a 21.4-day payment window out of the 30-day cycle). Contributions are accepted late past the deadline without a hard cutoff.
5. **Automated Payout:** When the final contribution transaction completes the round, the program automatically invokes `trigger_payout` in the same transaction flow, instantly releasing the vault balance to the designated slot recipient.
6. **Fallback Release:** If the automated trigger fails (network dropouts, RPC lag, etc.), a fallback **"Release Payout"** card becomes visible on the dashboard *only* to the circle's creator, enabling them to manually trigger the payout and unstick the round.

---

## ⚠️ Known Limitations
* **Fixed Payout Order Only:** Slot selections are chosen at join-time and remain fixed. The traditional interest bidding mechanism (where members bid interest rates to obtain early pots) is not yet supported.
* **No Auto-Closure or Auto-Refunds:** If a member fails to contribute, the round remains open indefinitely. The creator can call `mark_missed` to label a delinquent member publicly on-chain, but the circle does not automatically close or refund.
* **Deadlines are Informational:** The contribution deadlines shown on the dashboard are visual targets. There is no on-chain penalty enforcement preventing members from paying after the deadline.
* **Test Tokens Only:** The USDC token used is a test token minted through our Devnet faucet, not mainnet USDC.
* **Defaulter Marking is Permissionless but Blocked:** The `mark_missed` instruction is permissionless at the program level—any caller can flag a delinquent member after the grace period has elapsed. However, flagging does not unblock the round or auto-advance state; the round remains open until payment is received.

---

## 💻 Local Setup

### 1. Verification of Requirements
To run or verify this project, ensure you have the following toolchains installed:
```bash
# Verify Rust & Cargo
rustc --version
cargo --version

# Verify Solana CLI
solana --version

# Verify Anchor CLI
anchor --version

# Verify Node.js
node --version
```

### 2. Frontend Installation & Environment Setup
1. Navigate to the frontend directory:
   ```bash
   cd hui-app
   ```
2. Create your local environment configuration:
   ```bash
   cp .env.example .env.local
   ```
3. Configure the following environment variables in `.env.local`:
   * `NEXT_PUBLIC_SOLANA_RPC_URL`: Set to devnet (e.g., `https://api.devnet.solana.com` or custom RPC provider).
   * `NEXT_PUBLIC_PROGRAM_ID`: `BAUzUZpbXTqtfWaRd4ANUgLA1wSh6QiKTt6ChhdWWdpB`
   * `NEXT_PUBLIC_USDC_MINT`: The token mint address of your test USDC.
   * *Note: `FAUCET_KEYPAIR` is a server-only secret required for the faucet API and is not needed for general client/development setups.*
4. Install dependencies and start the local development server:
   ```bash
   npm install
   npm run dev
   # The client will run at http://localhost:3000
   ```

### 3. Anchor Smart Contract Setup & Tests
1. Navigate to the contract folder:
   ```bash
   cd hui-program
   ```
2. Build the program:
   ```bash
   anchor build
   ```
3. Run the automated integration tests:
   ```bash
   anchor test
   ```
   *This command spins up a local Solana validator automatically, deploys the program, and executes the suite of tests validating the ROSCA happy path, slot collision handling, start-circle auth, and missed payments scenarios.*

---

## 🗺️ Roadmap
- [ ] **Bidding Auction Mechanism:** Implement interest-rate bidding rounds where members bid interest to obtain earlier payouts.
- [ ] **Decentralized Disputes:** Upgrade missed-payment validation to require a quorum/majority vote of circle members instead of trusting the creator alone.
- [ ] **Auto-Closure and Refund Gating:** Implement timeout rules on stalled rounds to allow automated returns of escrowed deposits.
- [ ] **Mainnet Integration:** Switch token wrappers to interact with real USDC on Solana Mainnet.
