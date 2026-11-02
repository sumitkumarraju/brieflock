# Engineering Decisions

## 2026-11-02 · Build a judgeable local slice first

The workspace had no existing BriefLock repository, no NEAR CLI, and no Rustup-installed WASM target. We chose a local simulation first so the reviewer can run the user-visible commitment workflow without credentials. The UI labels every simulated balance, payout, and attack result; it does not manufacture transaction hashes.

## 2026-11-02 · React/Vite instead of extending a sibling Jarvis app

`/Users/skr/jarvis` contains unrelated apps and scripts. BriefLock lives in its own repository at `/Users/skr/jarvis/BriefLock` to avoid coupling or overwriting existing work. Vite keeps the demo portable and fast to run from a clean checkout.

## 2026-11-02 · Rules-based assistant is the default

No AI subscription is required for the baseline. The assistant reports observable metadata and commitment consistency only. Optional model integration must remain advisory, schema-validated, and unable to sign or choose a payout destination.

## 2026-11-02 · Testnet is not claimed yet

The repository now contains the Rust contract, contract unit tests, and `near-workspaces` sandbox tests, plus a Wallet Selector/RPC adapter. The default application still demonstrates local invariants until `VITE_NEAR_CONTRACT_ID` points at a user-controlled testnet deployment. No testnet transaction or receipt is claimed without that configuration.

## 2026-11-02 · Keep simulation and chain state separate

The UI shares domain types between adapters but never treats local state as chain truth. A configured contract causes reads to come from finalized RPC state and writes to go through Wallet Selector. A missing contract ID keeps the no-credential simulation path available for reviewers.
