# BriefLock

> **Approve the work. Bind the payment.**

BriefLock is a NEAR-oriented creative milestone payment workflow. It connects an approved brief, the exact bytes of a delivered file, and one fixed creator account. The assistant can explain observable checks, but it cannot approve work or redirect a payout.

## Current build status

This repository contains a judgeable prototype with a real contract boundary:

- polished React/Vite dashboard;
- clearly labeled **local simulation** mode;
- real browser SHA-256 hashing of selected file bytes;
- delivery version and hash mismatch protection;
- client-only approval rule;
- approved-work freeze and fixed recipient/amount release rule;
- creator replacement and client refund boundaries;
- deterministic rules-based review without an AI key;
- Attack Lab with six named adversarial scenarios;
- downloadable, honestly labeled simulation evidence report;
- responsive desktop/mobile layout and Playwright smoke coverage.
- Rust `near-sdk` contract with immutable terms, exact version/hash approval, fixed-recipient async settlement, refunds, and storage reserve accounting;
- Rust unit tests plus `near-workspaces` sandbox integration tests for normal payout, replay, unauthorized approval, and stale approvals;
- Wallet Selector v10 integration that activates against NEAR testnet when `VITE_NEAR_CONTRACT_ID` is configured;
- exact yoctoNEAR amount parsing and testnet explorer/account links.

The default checkout remains credential-free and starts in clearly labeled local simulation mode. No testnet deployment or receipt is claimed until a user-controlled contract account is configured.

## Run locally

Requirements: Node.js 22.12+ or Node.js 24.

```sh
npm ci
npm run dev
```

Open <http://127.0.0.1:4173>.

### Enable NEAR testnet mode

Install the current NEAR CLI-RS and create/use a user-controlled testnet account. Build and deploy the contract:

```sh
npm run build:contract
./scripts/deploy-testnet.sh <your-contract-account.testnet>
```

Copy `.env.example` to `.env.local` and set:

```sh
VITE_NEAR_NETWORK=testnet
VITE_NEAR_CONTRACT_ID=<your-contract-account.testnet>
VITE_NEAR_MILESTONE_ID=kanso-001
```

Restart Vite. The top bar will show **TESTNET · READY**, wallet connection will use Wallet Selector, and the app will re-read finalized contract state after actions. Browser simulation remains the fallback when the contract ID is empty.

### Judge walkthrough

1. Open **Delivery review**.
2. Click **Verify demo fixture bytes**. The app hashes the fixture bytes with the browser Web Crypto API.
3. Confirm **Exact bytes match**, then click **Approve this exact version**.
4. Return to **Overview** and click **Release payout**. The result is labeled simulation; no chain transaction is sent.
5. Open **Attack Lab** and click **Run all checks**.
6. Open **Evidence** to inspect the state timeline or download the JSON report.
7. Reset the demo before recording another run.

## Checks

```sh
npm run typecheck
npm test
npm run build
npm run demo:attacks
npm run demo:attacks -- --write-report
npx playwright install chromium
npm run test:e2e
npm run test:contract
npm run test:sandbox
npm run build:contract
```

The baseline unit, contract, sandbox, and browser tests require no paid AI service. The contract commands require Rust and the `wasm32-unknown-unknown` target. The Attack Lab CLI runs the same local policies as the dashboard. Testnet deployment requires a user-controlled account and wallet.

## Why NEAR

The Rust contract on NEAR is the canonical production boundary. Funding atomically stores immutable milestone terms; only the original client can approve the current version/hash; release derives amount and recipient from contract state; asynchronous settlement and refunds remain contract state transitions. The browser adapter reads with RPC and signs with Wallet Selector only when explicitly configured. The local adapter mirrors the same semantics so the interface can be tested before a wallet or testnet account is available.

## Trust boundaries

- A SHA-256 digest binds bytes, not quality, copyright, malware safety, or legal compliance.
- A browser only verifies the bytes the reviewer actually selects.
- Rules-based review is advice, not an approval oracle.
- Briefs, invoices, file metadata, and future model output are untrusted input.
- Local simulation evidence is not a blockchain receipt; sandbox evidence is not testnet evidence.
- No private key, seed phrase, model key, or mainnet funds are required or stored.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md), [`docs/DECISIONS.md`](docs/DECISIONS.md), and [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md).
For the real-chain setup, see [`docs/NEAR_TESTNET.md`](docs/NEAR_TESTNET.md).

## Hackathon submission state

- Event: NEAR HACKATHON
- Intended tracks: AI Security & Defense; Real-World Money
- Project: BriefLock — Verified Delivery, Protected Creator Payments
- Public repository: <https://github.com/sumitkumarraju/brieflock>
- Demo post: not published
- Testnet contract: user-controlled configuration required; no deployment is claimed in this repository

The final application must use factual implementation language and include the human-provided email, team size, mainnet payout account, public repository URL, and public X demo URL. Do not submit placeholders.

## License

MIT. See [`LICENSE`](LICENSE).
