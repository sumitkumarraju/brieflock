# NEAR Testnet Runbook

This is the shortest path from a clean checkout to a real BriefLock contract on NEAR testnet. Use a dedicated testnet account; never paste a seed phrase or full-access private key into chat or commit it.

## 1. Install current tooling

Follow the current official NEAR setup instructions at <https://docs.near.org/smart-contracts/quickstart> for Rustup, the WASM target, and NEAR CLI-RS.

```sh
rustup target add wasm32-unknown-unknown
npm ci
```

## 2. Build and deploy

Use a dedicated testnet account with its key imported into NEAR CLI-RS, then run:

```sh
npm run build:contract
./scripts/deploy-testnet.sh your-contract.testnet
```

The helper selects the testnet network explicitly and deploys and initializes the contract with `new` in one transaction. Use it for a fresh contract account. Deployment authority remains with the account owner; the contract is not immutable merely because it is deployed.

## 3. Configure the browser

Create `.env.local` (ignored by Git):

```sh
VITE_NEAR_NETWORK=testnet
VITE_NEAR_CONTRACT_ID=your-contract.testnet
VITE_NEAR_MILESTONE_ID=kanso-001
```

Start the app:

```sh
npm run dev
```

The dashboard then:

1. connects through Wallet Selector / My NEAR Wallet;
2. funds a commission with principal plus a separate 0.02 NEAR storage reserve;
3. hashes delivery bytes in the browser;
4. signs `submit_delivery` and `approve_delivery` with exactly one yoctoNEAR;
5. calls `release` without a recipient or amount argument;
6. waits for a final transaction outcome and re-reads finalized `get_milestone` state before displaying payout or refund evidence.

After funding, share the dashboard URL containing `?milestone=<id>` with the creator. Exchange the actual file through your existing delivery channel. Use **Disconnect** to switch between client and creator wallets.

## 4. Direct read-only verification

```sh
near view your-contract.testnet get_config '{}' --networkId testnet
near view your-contract.testnet get_milestone '{"milestone_id":"kanso-001"}' --networkId testnet
```

If the browser says a wallet flow opened without a returned outcome, do not replay a financial operation blindly. Wait for the wallet redirect/finalization, then refresh the dashboard and inspect the canonical state.

## 5. Evidence levels

- `SIMULATION`: browser-only local state; useful for a no-wallet walkthrough.
- `SANDBOX`: `near-workspaces` executes the compiled contract locally.
- `TESTNET`: Wallet Selector transaction and finalized RPC state; only this layer should be described as a public-chain demo.

The repository does not contain a deployment account, private key, or fabricated transaction hash.
