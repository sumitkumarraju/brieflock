# BriefLock

> **Approve the work. Bind the payment.**

BriefLock is a NEAR-oriented creative milestone payment workflow. It connects an approved brief, the exact bytes of a delivered file, and one fixed creator account. The assistant can explain observable checks, but it cannot approve work or redirect a payout.

## Current build status

This repository contains the first judgeable prototype slice:

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

The NEAR Rust contract, `near-workspaces` sandbox suite, Wallet Selector, and testnet deployment are the next integration milestone. This README intentionally does **not** claim live contract execution, wallet signatures, explorer links, or testnet receipts yet.

## Run locally

Requirements: Node.js 20+.

```sh
npm ci
npm run dev
```

Open <http://127.0.0.1:4173>.

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
npm run test:e2e
```

The baseline unit and browser tests require no paid AI service or wallet credentials.

## Why NEAR

The intended production boundary is a Rust contract on NEAR. Funding atomically stores immutable milestone terms; only the original client can approve the current version/hash; release derives amount and recipient from contract state; asynchronous settlement and refunds remain contract state transitions. The local adapter mirrors those semantics so the interface can be tested before a wallet or testnet account is available.

## Trust boundaries

- A SHA-256 digest binds bytes, not quality, copyright, malware safety, or legal compliance.
- A browser only verifies the bytes the reviewer actually selects.
- Rules-based review is advice, not an approval oracle.
- Briefs, invoices, file metadata, and future model output are untrusted input.
- Local simulation evidence is not a blockchain receipt.
- No private key, seed phrase, model key, or mainnet funds are required or stored.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md), [`docs/DECISIONS.md`](docs/DECISIONS.md), and [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md).

## Hackathon submission state

- Event: NEAR HACKATHON
- Intended tracks: AI Security & Defense; Real-World Money
- Project: BriefLock — Verified Delivery, Protected Creator Payments
- Public repository: pending publication
- Demo post: not published
- Testnet contract: not deployed

The final application must use factual implementation language and include the human-provided email, team size, mainnet payout account, public repository URL, and public X demo URL. Do not submit placeholders.

## License

MIT. See [`LICENSE`](LICENSE).
