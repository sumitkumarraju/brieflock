# Engineering Decisions

## 2026-11-02 · Build a judgeable local slice first

The workspace had no existing BriefLock repository, no NEAR CLI, and no Rustup-installed WASM target. We chose a local simulation first so the reviewer can run the user-visible commitment workflow without credentials. The UI labels every simulated balance, payout, and attack result; it does not manufacture transaction hashes.

## 2026-11-02 · React/Vite instead of extending a sibling Jarvis app

`/Users/skr/jarvis` contains unrelated apps and scripts. BriefLock lives in its own repository at `/Users/skr/jarvis/BriefLock` to avoid coupling or overwriting existing work. Vite keeps the demo portable and fast to run from a clean checkout.

## 2026-11-02 · Rules-based assistant is the default

No AI subscription is required for the baseline. The assistant reports observable metadata and commitment consistency only. Optional model integration must remain advisory, schema-validated, and unable to sign or choose a payout destination.

## 2026-11-02 · Testnet is not claimed yet

The application currently demonstrates local invariants, not live NEAR execution. The next engineering milestone is the Rust contract and `near-workspaces` adversarial suite, followed by Wallet Selector and a user-controlled testnet account.
