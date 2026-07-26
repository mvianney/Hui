#!/bin/bash
set -e

echo "=== Installing Solana CLI ==="
sh -c "$(curl -sSfL https://release.anza.xyz/v1.18.18/install)"
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
echo 'export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"' >> ~/.bashrc

echo "=== Configuring Solana for devnet ==="
solana config set --url devnet
solana-keygen new --no-bip39-passphrase --silent

echo "=== Installing Anchor CLI v0.29.0 ==="
cargo install --git https://github.com/coral-xyz/anchor --tag v0.29.0 anchor-cli --locked

echo "=== Installing npm dependencies ==="
cd /workspaces/*/hui-program 2>/dev/null || cd /workspaces/Hui/hui-program
npm install

echo "=== Setup complete ==="
echo "Run: anchor build && anchor test"
solana --version
anchor --version
