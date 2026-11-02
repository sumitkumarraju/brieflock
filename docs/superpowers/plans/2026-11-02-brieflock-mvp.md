# BriefLock MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a credible, judge-friendly BriefLock prototype that demonstrates exact-version creative delivery approval, fixed-recipient settlement rules, and reproducible adversarial checks without pretending local simulation is live blockchain execution.

**Architecture:** A React/Vite dashboard owns presentation and a small typed domain layer owns the simulation state machine. SHA-256 commitments are calculated from actual browser bytes with Web Crypto. Contract-facing boundaries are documented so the simulation adapter can later be replaced by NEAR RPC and Wallet Selector without changing the user flow.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, lucide-react, browser Web Crypto API, CSS custom properties.

---

### Task 1: Establish the app shell

**Files:**
- Create: `package.json`, `index.html`, `vite.config.ts`, `vitest.config.ts`
- Create: `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `.gitignore`, `.env.example`, `LICENSE`

- [ ] **Step 1: Install dependencies**

Run `npm install` from `/Users/skr/jarvis/BriefLock`.

Expected: a lockfile is created without changing any sibling Jarvis project.

- [ ] **Step 2: Verify the empty app build**

Run `npm run typecheck` and `npm run build`.

Expected: both commands exit successfully after the source entry is added.

### Task 2: Define and test commitment rules

**Files:**
- Create: `src/types.ts`
- Create: `src/lib/commitment.ts`
- Create: `src/lib/commitment.test.ts`
- Create: `src/lib/hash.ts`

- [ ] **Step 1: Write failing rule tests**

Cover exact version/hash approval, frozen approved work, fixed recipient release, replay rejection, and recipient-redirection rejection.

- [ ] **Step 2: Implement pure rule functions**

Expose `canApprove`, `canReplaceDelivery`, `canRelease`, `validateInvoiceRecipient`, `normalizeBrief`, and typed result objects.

- [ ] **Step 3: Implement browser SHA-256 helpers**

Use `crypto.subtle.digest("SHA-256", bytes)` and return lowercase hexadecimal. Never hash filenames or object URLs as delivery identity.

- [ ] **Step 4: Run focused tests**

Run `npm test -- src/lib/commitment.test.ts`.

Expected: all rule tests pass.

### Task 3: Create the simulation state and Attack Lab model

**Files:**
- Create: `src/lib/demoState.ts`
- Create: `src/lib/attackLab.ts`
- Create: `scripts/demo-attacks.mjs`

- [ ] **Step 1: Seed a fictional Kanso Coffee commission**

Use a clearly labeled test commission, deterministic brief/delivery fixtures, and no fabricated transaction identifiers.

- [ ] **Step 2: Implement scenario execution**

Return expected result, actual result, execution layer, before/after status, and a simulation evidence label for A01, A02, A03, A05, A06, and A08.

- [ ] **Step 3: Add the CLI smoke report**

`npm run demo:attacks` prints a compact report showing each local policy check as `SIMULATION`, never `TESTNET`.

### Task 4: Build the dashboard interface

**Files:**
- Create: `src/main.tsx`, `src/App.tsx`, `src/styles.css`

- [ ] **Step 1: Add persistent navigation and mode disclosure**

Show Overview, Delivery review, Attack Lab, and Evidence views with a visible Simulation mode badge.

- [ ] **Step 2: Add the overview workflow**

Render fixed terms, current state, amount, recipient, brief hash, next action, activity timeline, and a launch-ready commission card.

- [ ] **Step 3: Add delivery submission and review**

Allow the creator to submit the demo version or select a local file. Recompute the selected bytes on the client, display the digest, and prevent approval when the reviewed digest differs from the current commitment.

- [ ] **Step 4: Add approval and release controls**

Require an explicit approval confirmation, freeze the delivery after approval, and make release derive its recipient and amount from stored state.

- [ ] **Step 5: Add Attack Lab and evidence views**

Run individual or all scenarios, display honest execution layers, and offer a downloadable JSON report generated from current simulation results.

### Task 5: Document trust boundaries and judge reproduction

**Files:**
- Create: `README.md`, `docs/ARCHITECTURE.md`, `docs/THREAT_MODEL.md`, `docs/DECISIONS.md`, `docs/DEMO_SCRIPT.md`, `docs/SUBMISSION.md`

- [ ] **Step 1: Document what is real now**

State that the first slice is a local simulation, which protections are exercised locally, and which NEAR contract/testnet pieces remain next.

- [ ] **Step 2: Document the demo path**

Give a judge exact commands and click steps from Overview through Attack Lab.

- [ ] **Step 3: Run a clean verification pass**

Run `npm run typecheck`, `npm test`, `npm run build`, and `npm run demo:attacks`.

Expected: all pass and documentation contains no claim of a live receipt.
