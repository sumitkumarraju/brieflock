#!/usr/bin/env bash
set -euo pipefail

if [ -f "$HOME/.cargo/env" ]; then
  # shellcheck disable=SC1090
  source "$HOME/.cargo/env"
fi

if ! command -v cargo >/dev/null 2>&1; then
  echo "cargo is required. Install Rust through rustup: https://rustup.rs" >&2
  exit 1
fi

if ! rustup target list --installed 2>/dev/null | grep -q '^wasm32-unknown-unknown$'; then
  echo "The wasm32-unknown-unknown target is missing. Run: rustup target add wasm32-unknown-unknown" >&2
  exit 1
fi

cargo build \
  --manifest-path contracts/brieflock/Cargo.toml \
  --target wasm32-unknown-unknown \
  --release

echo "Built contracts/brieflock/target/wasm32-unknown-unknown/release/brieflock_contract.wasm"
