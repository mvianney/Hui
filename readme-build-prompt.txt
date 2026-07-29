Write/update README.md at the project root to be accurate, professional, and reflect the ACTUAL 
current state of the build — not aspirational claims. Pull real values from the codebase itself 
rather than guessing (Program ID from declare_id!() in lib.rs / Anchor.toml, deployed cluster, 
etc.) — do not leave placeholders.

LIVE APP: https://hui-mu.vercel.app

STRUCTURE:

1. Title + one-line tagline
   "Hụi On-Chain — A trustless implementation of Vietnam's traditional rotating savings circle 
   (hụi) on Solana."

2. Live Demo
   - Link: https://hui-mu.vercel.app
   - Note it's running on Solana Devnet (test funds only, not real money)
   - Note there's an in-app "Get Test USDC" faucet button so anyone (including judges) can test 
     without needing CLI tools — mention they just need a Phantom wallet switched to Devnet

3. What This Is (2-3 sentences)
   - Explain hụi in plain terms: rotating savings circle, members contribute each round, one 
     member receives the pot per round until everyone has received once
   - State the real problem this solves: giật hụi (organizer absconding with funds) and bể hụi/vỡ 
     hụi (scheme collapse) — real, recurring, documented financial harm in Vietnam
   - State the mechanism: funds are held in a program-controlled escrow vault, not by any single 
     trusted person; payout releases automatically once all members contribute for a round

4. Why On-Chain (short, direct — pull this from hui-project-brief.md, condense it)
   - The failure mode is a single trusted custodian; a PDA escrow + automatic/permissionless 
     payout removes exactly that point of failure
   - Note hụi's existing legal recognition under Article 471 of Vietnam's 2015 Civil Code

5. Tech Stack
   - Solana / Anchor (Rust) for the on-chain program
   - Next.js 14 (App Router), TypeScript, Tailwind for the frontend
   - @solana/wallet-adapter-react (Phantom) for wallet connection
   - Deployed on Vercel

6. Program Info
   - Program ID: [pull the real one from declare_id!() in lib.rs — do not guess]
   - Cluster: Devnet
   - Link to the program on Solana Explorer for the devnet cluster (construct the correct 
     explorer.solana.com URL using the real Program ID and ?cluster=devnet)

7. How It Works (the actual current flow — describe accurately based on what's really built)
   - Creator sets up a circle: name, contribution amount, frequency, number of slots — and joins 
     by picking their own slot during creation
   - Shareable invite code/link — other members join by entering their name and picking an open 
     slot (taken slots are visibly disabled)
   - Dashboard updates live as members join, showing name, wallet, and chosen slot
   - Once all slots are filled, the creator clicks "Start Circle" to begin
   - Each round has a calculated contribution deadline shown on-screen (based on frequency); the 
     round stays open past the deadline — contributions late are still accepted, no hard cutoff
   - Once all members contribute for a round, payout to that round's recipient fires automatically 
     — no manual action required in the normal path
   - A creator-only fallback "Release Payout" button exists only if the automatic trigger fails 
     to fire, to unstick the round

8. Known Limitations (be honest and specific — this is a stated judging criterion, not a weakness 
   to hide)
   - Fixed payout order only — the traditional interest-rate bidding auction mechanism is not 
     implemented (explicitly scoped as a future phase)
   - No automatic circle closure or refund logic if a member never contributes — the round simply 
     stays open indefinitely; mark_missed can flag a non-paying member publicly, but does not 
     unblock or force-close the round
   - Contribution deadlines shown in the UI are informational only — there is no on-chain 
     enforcement preventing late payment
   - USDC used is a test token minted via an in-app devnet-only faucet, not real USDC
   - Single-verifier trust model was considered for related future work but is not part of this 
     project's scope

9. Local Setup (for anyone wanting to run/verify it themselves)
   - Toolchain requirements: Rust, Solana CLI, Anchor CLI (avm), Node.js — list how to verify each 
     is installed
   - Clone, install frontend deps, environment variables needed (list them without real secret 
     values: NEXT_PUBLIC_SOLANA_RPC_URL, NEXT_PUBLIC_PROGRAM_ID, NEXT_PUBLIC_USDC_MINT — note 
     FAUCET_KEYPAIR is a server-only secret, not something a cloner needs unless running their own 
     faucet)
   - How to run the Anchor program build/test locally
   - How to run the frontend dev server

10. Roadmap
    - Interest-rate bidding auction (the traditional hụi mechanism)
    - Automatic circle closure / refund handling on missed payments
    - Broader credit/reputation integration using on-chain payment history
    - Mainnet-ready token handling (real USDC, not test tokens)

Keep tone factual and confident, not promotional — write it the way a serious technical 
submission would be written, not marketing copy. Pull every factual detail (Program ID, actual 
built behavior) from the real codebase, not from memory or assumption. Show me the final README 
content before considering this done.
