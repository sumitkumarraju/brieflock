#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <contract-account.testnet>" >&2
  exit 2
fi

CONTRACT_ID="$1"
WASM="contracts/brieflock/target/wasm32-unknown-unknown/release/brieflock_contract.wasm"

case "$CONTRACT_ID" in
  *.testnet) ;;
  *) echo "Refusing deployment: this helper only accepts a .testnet account." >&2; exit 1 ;;
esac

if ! command -v near >/dev/null 2>&1; then
  echo "near CLI is required. Install the current NEAR CLI-RS from https://docs.near.org/tools/near-cli" >&2
  exit 1
fi

if [ ! -f "$WASM" ]; then
  echo "Contract WASM is missing. Run npm run build:contract first." >&2
  exit 1
fi

near contract deploy "$CONTRACT_ID" \
  use-file "$WASM" \
  with-init-call new json-args '{}' \
  prepaid-gas '100 Tgas' attached-deposit '0 NEAR' \
  network-config testnet sign-with-keychain send
echo "Deployed and initialized $CONTRACT_ID on NEAR testnet."
