#!/usr/bin/env bash
set -euo pipefail

account="${1:-}"
if [[ ! "$account" =~ ^([a-z0-9]+([_-][a-z0-9]+)*\.)+near$ || ${#account} -gt 64 ]]; then
  echo "Usage: $0 <fresh-dedicated-contract-account.near>" >&2
  exit 2
fi

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"
npm run build:contract
wasm="contracts/brieflock/target/wasm32-unknown-unknown/release/brieflock_contract.wasm"
echo "Compiled BriefLock for review. Mainnet deployment must be signed by the dedicated account owner."
printf 'near contract deploy %q use-file %q with-init-call new json-args %q prepaid-gas %q attached-deposit %q network-config mainnet sign-with-keychain send\n' "$account" "$wasm" '{}' '100 Tgas' '0 NEAR'
printf '\nAfter the signed deploy, configure your frontend build:\nVITE_NEAR_NETWORK=mainnet\nVITE_NEAR_CONTRACT_ID=%s\n' "$account"
