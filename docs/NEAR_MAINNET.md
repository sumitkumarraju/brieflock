# Mainnet launch

BriefLock’s hosted testnet release uses testnet wallets. Mainnet wallet accounts need a mainnet deployment. A public account ID is enough for a read-only lookup. Wallet connection and transaction signing require the account owner to authorize them in the wallet.

## Deploy and configure

Use a fresh dedicated mainnet contract account you control. Keep your personal wallet available as a client or creator. Review the contract and the deploy account’s upgrade authority before accepting customer funds.

1. Install NEAR CLI-RS, Rust, the `wasm32-unknown-unknown` target, and npm dependencies.
2. Run `./scripts/prepare-mainnet.sh <dedicated-contract-account.near>`. It builds the WASM and prints the command for review.
3. Sign the printed deploy-and-initialize transaction with the dedicated account in your local NEAR CLI. The account needs enough NEAR for storage and gas. The command deploys and initializes in one transaction.
4. Verify `get_config` on the deployed mainnet account. Build the frontend with `VITE_NEAR_NETWORK=mainnet` and `VITE_NEAR_CONTRACT_ID` set to that contract account. Publish the build on your HTTPS host.
5. Connect your mainnet wallet and verify a small authorized milestone using a separate creator wallet. Confirm the exact file hash, fixed recipient, finalized payout and receipt. Verify creator cancellation and client expiry refund on separate unapproved milestones.

The previously verified chain settlement used testnet funds. Mainnet connection and payment verification remain pending until a deployment and wallet-authorized transactions occur. Keep private keys in your wallet or local keychain.

[NEAR CLI documentation](https://docs.near.org/tools/cli)
