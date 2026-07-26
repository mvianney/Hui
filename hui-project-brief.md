# Hụi On-Chain — Project Brief

## 1. Bounty Info

**Program:** Superteam Vietnam bounty — "Design the onchain version of a real Web2/operator-known business."
**Prize:** 5,000 USDC
**Eligibility:** Vietnamese citizens or Vietnam-based residents only. Winners verify ID/residence before payout.
**Format:** Vietnamese and English read equally.

**Deliverables required:**
- Two-page pitch deck
- MVP or prototype (can be as simple as a clickable mockup or a flow on an existing product)
- Idea-stage submissions accepted but score lower

**Four required sections in the pitch:**
1. The business today — what it is, and the pain point it actually hits
2. Why onchain — the core of the pitch. If the honest answer is "it isn't," this bounty isn't for that idea. Honesty about limits is a plus.
3. How it works in practice
4. What's next — what you'd do tomorrow with a team and resources

**Judging criteria:**
- Who's behind it — do they actually know this space
- Names a real business and a real pain point
- Answers "why onchain" convincingly, not just because blockchain sounds good
- Shows how it works, with concrete next steps rather than a concept on paper
- Bonus: a model that could grow into a fundable company
- Bonus: designed to fit Vietnam's regulatory framework as it takes shape

---

## 2. Project Selected: Hụi (On-Chain Rotating Savings Circle)

**What hụi is:** Vietnam's traditional rotating savings and credit association (ROSCA). A fixed group of members contribute a set amount on a regular schedule (weekly/monthly). Each round, one member receives the full pot. In the traditional Vietnamese version, the recipient is sometimes chosen via an interest-rate bidding round rather than a fixed order — members who want the pot that round bid an interest rate, highest bidder wins the pot. An organizer ("chủ hụi"), often a woman running it through family/community trust networks, manages the circle and is traditionally on the hook to cover losses if a member defaults.

**The pain point:** Hụi runs entirely on trust with no enforcement layer. Two recurring failure modes have real names in Vietnamese:
- **"Giật hụi"** — the organizer absconds with the pooled funds.
- **"Bể hụi" / "vỡ hụi"** — the whole scheme collapses, wiping out collective savings, most damaging in rural areas where participants have no written agreements.

These collapses have cost billions of VND and are a recurring news category in Vietnam, not a hypothetical problem.

**Legal status:** Hụi is already legally recognized under **Article 471 of Vietnam's 2015 Civil Code**, with interest capped at 20% annually. This is not a legal gray zone — it's a regulated informal practice that current infrastructure fails to properly support.

---

## 3. Why This Scores Well Against Their Criteria

- **Real business, real pain point:** Bể hụi collapses are well-documented, not manufactured. Anchoring the pitch to this instantly signals operator/cultural understanding of Vietnam specifically (not a generic emerging-market fintech pitch).
- **"Why onchain" answers itself precisely:** The failure mode is not speed or cost — it's a single trusted party (the organizer) holding funds and controlling payout order with no enforcement. A smart contract that escrows funds and releases them by a program-enforced rule removes exactly that point of failure. This is a mechanism fix, not decoration.
- **Regulatory fit bonus, answerable directly:** Article 471 already recognizes hụi legally — this is digitizing something the law accepts, not asking for new legal ground. Strong, citable argument for the "fits Vietnam's regulatory framework" bonus.
- **Fundable-company bonus:** Digitized ROSCA/informal-credit infrastructure is a recognized fintech category globally — believable as a real company, not just a bounty demo.
- **Founder-credibility signal:** Doing this well (understanding the bidding mechanism, the chủ hụi's traditional liability role, the specific Vietnamese terms for fraud/collapse) is hard to fake — it reads as real cultural fluency, which is judging criterion #1.

---

## 4. Architecture

**Core actors:** Organizer (optional/first member), Members (hụi viên), the pot/vault.

**On-chain program (Solana / Anchor):**

1. **Circle creation** — defines contribution amount (in USDC), frequency (weekly/monthly), number of members = number of rounds, and payout order rule.
   - **MVP scope:** fixed payout order (round 1 → member A, round 2 → member B, etc.)
   - **Phase 2 (roadmap item, not MVP):** interest-rate bidding auction per round, matching the traditional Vietnamese mechanism.
2. **Vault (PDA)** — each circle has a program-derived escrow account holding contributions. No human — including the organizer — custodies the funds directly.
3. **Contribution instruction** — members deposit into the vault each round; program tracks payment status per member per round.
4. **Payout instruction** — once all members have contributed for that round, the program automatically releases the full pot to that round's designated recipient. No organizer discretion, no possibility of the organizer absconding with funds.
5. **Default handling** — logic for a missed contribution (grace period, flag visible to all members, and/or a small member-posted stake/backstop reflecting the traditional norm that the chủ hụi covers losses).
6. **On-chain reputation record** — completed circles and payment history are recorded permanently. A member's full participation history (rounds completed, any missed payments) becomes portable, verifiable proof of reliability — usable later as a credit signal to lenders who currently can't assess these members at all.

**Off-chain / app layer:**
- Next.js frontend, wallet connect (e.g. Phantom)
- Circle dashboard: member list, current round, who's paid, whose turn is next, countdown to next contribution deadline
- This is the clickable MVP/prototype for the bounty submission — full bidding-auction logic is not required to work end-to-end for the deck, only the fixed-order flow.

---

## 5. Build Stages

1. **Spec lock:** Fixed-order hụi only for MVP. Bidding auction explicitly scoped as "Phase 2" in the deck to reduce build risk while still showing roadmap depth.
2. **Anchor program:** Build circle creation, contribute, payout, and default/missed-payment handling instructions. This is the highest-stakes part — state machine correctness matters most here.
3. **Devnet deploy + tests:** Simulate a full circle end-to-end — create circle → contribute × N rounds → payout each round → completion — with a small test group (e.g. 5 members, 5 rounds).
4. **Frontend:** Circle dashboard, wallet connect, contribute action, round status display. Functional and honest over polished.
5. **Deck (2 pages):**
   - The business today + pain point (cite real bể hụi/giật hụi cases)
   - Why onchain (trust/enforcement mechanism, not speed/cost)
   - How it works (simplified diagram of the state machine above)
   - What's next (bidding mechanism, credit-scoring integration for lenders, pilot with one real hụi group)

---

## 6. Additional Context for Claude

- **Builder:** Vianney — full-stack developer, ~2 years in Solana ecosystem, active across multiple Superteam bounty chapters. Uses Claude for architecture/debugging/precise prompts, and an AI coding agent ("agy" / Antigravity CLI) to execute file writes.
- **Dev environment constraint:** Primary machine is a Chromebook with Crostini Linux container — no Docker, no local Rust toolchain, limited storage. This affects how Anchor/Solana tooling gets set up (may need cloud-based build/deploy workflow rather than fully local).
- **Eligibility note:** This bounty is restricted to Vietnamese citizens/residents with ID verification before payout. Builder is not Vietnam-based — this project is being built regardless, primarily as a portfolio/practice piece, with the understanding that prize payout may not be possible if eligibility doesn't hold.
- **Parallel projects:** Two other ideas are also being built for the same bounty by different builder/model pairings — SME trade financing/invoice factoring, and a real estate pre-sale escrow concept. This brief covers hụi only.
- **Model assignment:** Claude is the lead model for hụi specifically — responsible for architecture decisions and writing precise, ready-to-execute prompts for the "agy" coding agent, which handles actual file writing and execution.
