# Hụi On-Chain — Pitch Deck Source Document
This document compiles the factual, technical, and operational details of the **Hụi On-Chain** project to serve as the core reference source for generating pitch decks, submissions, or technical review materials.

---

## 1. Final Project Summary
* **Concept:** Hụi On-Chain is a decentralized, trustless implementation of Vietnam’s traditional rotating savings and credit association (ROSCA), known locally as *hụi*. It replaces the single, trusted human custodian (*chủ hụi*) with a secure, program-controlled escrow vault on the Solana blockchain. Pooled funds are locked in code, and payouts are automatically disbursed to slot recipients the moment round contributions are completed, eliminating the risk of fraud and host default.
* **Live App URL:** [https://hui-mu.vercel.app](https://hui-mu.vercel.app)
* **Devnet Program ID:** `BAUzUZpbXTqtfWaRd4ANUgLA1wSh6QiKTt6ChhdWWdpB`
* **Solana Explorer Link:** [Solana Explorer Address Profile](https://explorer.solana.com/address/BAUzUZpbXTqtfWaRd4ANUgLA1wSh6QiKTt6ChhdWWdpB?cluster=devnet)
* **GitHub Repository:** [https://github.com/mvianney/Hui.git](https://github.com/mvianney/Hui.git)

---

## 2. The Problem
* **Traditional ROSCA Failure (*Giật Hụi* & *Bể Hụi*):** In traditional Vietnamese rotating savings circles, a central organizer custodies all member deposits. This structure has two primary vulnerability points:
  1. *Giật Hụi:* The organizer runs away with the accumulated pot.
  2. *Bể Hụi / Vỡ Hụi:* The circle collapses due to unpaid contributions from members who received early pots, wiping out the savings of later-round participants.
* **Financial Impact:** These informal credit circles are heavily relied upon in rural and low-income Vietnamese communities. Collapses frequently result in collective losses totaling billions of VND, leading to severe local economic instability and litigation.
* **Legal and Regulatory Context:** Rotating savings circles are not a legal gray area in Vietnam; they are explicitly recognized and regulated under **Article 471 of the 2015 Civil Code of the Socialist Republic of Vietnam** (which caps interest rates at 20% per annum). The core issue is the absence of secure, automated custody infrastructure to enforce agreements.

---

## 3. Why On-Chain?
* **PDA Escrow Security:** Each circle's funds are held in a Program Derived Address (PDA) escrow account governed entirely by the Solana program. No individual—including the circle's creator or organizer—can withdraw, divert, or access these funds arbitrarily. They can only be released via the contract's strict payout rules.
* **Automated & Permissionless Payouts:** Traditional hụi relies on the organizer to manually distribute funds, introducing delay and gatekeeping risk. Hụi On-Chain automates this: as soon as the final contribution for a round is verified on-chain, the program auto-triggers the payout to that round's recipient immediately in the same transaction flow, requiring no human intervention.

---

## 4. How It Works (Actual Current Flow)
1. **Circle Creation:** The creator sets up a circle by defining the name, contribution amount (in USDC), frequency (Weekly or Monthly), and total member slots. During creation, the creator inputs their display name and picks their desired payout slot, joining the circle atomically.
2. **Invitation & Joining:** A shareable 6-character Invite Code is generated. Incoming members enter this code, pick from the remaining open slots (taken slots are disabled in the UI), input their display name, and join.
3. **Pending Gate & Activation:** The dashboard updates live. Once all slots are filled, the status shifts to "Pending Start". Only the creator can execute the `start_circle` instruction to lock the payout order, record the start time, and activate Round 1.
4. **Calculated Deadlines:** The dashboard displays a countdown timer for contributions.
   * *Weekly Circles:* A 5-day contribution window out of the 7-day cycle.
   * *Monthly Circles:* Scales proportionally to a 21.4-day contribution window out of the 30-day cycle.
   * *Late Payments:* Late contributions are accepted past the deadline; there is no hard program-level lockout.
5. **Automatic Payout Trigger:** When the last member of a round submits their contribution, the program executes the token transfer and immediately invokes the on-chain `trigger_payout` instruction in the same block, releasing the pot to that round’s recipient.
6. **Fallback Release Control:** If the automatic release transaction fails to fire (due to network dropouts or RPC node timeouts), a "Release Payout" card is rendered on the dashboard *only* for the creator, serving as a manual fallback to unstick the round.
7. **Test Faucet & SOL Top-Up:** To facilitate seamless testing for judges, the in-app faucet provides test USDC and automatically checks if the user's wallet has less than 0.05 SOL. If needed, the faucet server transfers a starter balance of 0.05 SOL to pay for transaction gas fees.

---

## 5. Built vs. Known Limitations

### What is Actually Built & Working:
* **Circle Creation:** Setup terms, automatic creator atomic join, and slot assignment.
* **Invite Flow:** 6-character uppercase codes and slot-picking logic.
* **Dashboard State Machine:** Live transition from Pending -> Active -> Completed.
* **Deadlines:** Dynamic countdown timers and proportional splits.
* **Contribution & Escrow:** On-chain SPL token deposits and PDA vault locks.
* **Automated Disbursal:** Instant payout triggers on final round contribution.
* **Creator Fallback:** Gated trigger fallback controls.
* **In-App Faucet:** Integrated USDC minting and SOL gas top-ups.

### Known Limitations (Intentionally Deferred):
* **Fixed Payout Order:** Payout positions are static. Interest-rate bidding rounds (where members bid interest rates to obtain early pots) are deferred.
* **No Auto-Closure or Auto-Refunds:** If a member defaults, the round stays open indefinitely. While anyone can call `mark_missed` to flag a defaulter on-chain, it does not advance the state or refund others automatically.
* **Visual-Only Deadlines:** Countdown timers are informational only; no on-chain penalties are enforced for late payments.
* **Devnet Constraints:** Running on Devnet using test USDC tokens and faucet SOL.

---

## 6. Technical Stack
* **On-Chain Contract:** Written in Rust using the **Anchor Framework (0.30.1)**.
* **Test Suite:** Includes 12 automated integration tests (`tests/hui.ts`) verifying:
  * Happy path lifecycle (5 members, 5 rounds).
  * Slot collision/double-booking rejections.
  * startCircle auth gating (non-creator rejection).
  * Missed payment marking conditions.
* **Client Application:** Next.js 14 (App Router), TypeScript, Tailwind CSS, `@solana/wallet-adapter-react`.
* **Deployment:** Client hosted on Vercel; Program deployed on Solana Devnet.

---

## 7. Roadmap
1. **Bidding Auction Mechanism:** Implement interest-rate bidding per round, allowing members to compete for early pots by bidding interest.
2. **Decentralized Dispute Resolution:** Shift missed-payment verification from a single verifier to a decentralized quorum vote of all circle members.
3. **Auto-Refund Backstops:** Implement timeout rules to allow members to refund their escrowed contributions if a circle stalls indefinitely due to default.
4. **Mainnet Integration:** Switch from SPL test tokens to real USDC on Solana Mainnet.

---

## 8. Screenshots Needed
Provide the following screen captures from the live deployment to complete the pitch deck:
1. **Landing Page:** Show the clean entry UI, tagline, and wallet connection state.
2. **Create Circle Page:** Capture the setup form, including the creator display name input and slot grid picker.
3. **Join Circle Page:** Capture the lookup result card, showing filled slots vs open slots, and the slot selection picker.
4. **Active Dashboard Page:** Show the dashboard mid-round with the countdown deadline timer, current round progress bar, checklist of who has contributed, and the vault balance prominent in the card.
5. **Completed State View:** Show the celebrate banner, total pot distributed, and individual member cards detailing completion rates.
