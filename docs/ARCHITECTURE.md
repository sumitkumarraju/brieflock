# BriefLock Architecture

## Current prototype boundary

The app has two explicit adapters. The default is a local simulation with a domain layer that mirrors the contract semantics. When `VITE_NEAR_CONTRACT_ID` is set, `src/lib/near.ts` uses Wallet Selector for signing and `near-api-js` for read-only RPC state. `src/lib/commitment.ts` remains pure and has no React or wallet dependency. `src/lib/demoState.ts` supplies owned fictional fixtures. `src/lib/attackLab.ts` invokes the same local rules used by the UI and reports the execution layer.

```text
selected bytes ──SHA-256──> reviewed file commitment
                                │
locked brief ───────────────────┼──> client review UI
fixed amount + recipient ──────┘             │
                                             │ explicit human approval
                                             ▼
                                    local settlement adapter
```

The UI may display a simulation receipt, but it never presents it as a NEAR transaction. Canonical status is held in the `Commission` domain object rather than a browser “paid” flag.

## Implemented NEAR boundary

The next adapter will map these operations to a Rust contract:

| Domain operation | Contract method |
| --- | --- |
| Fund immutable terms | `create_and_fund` |
| Submit or replace bytes commitment | `submit_delivery` |
| Approve exact version + hash | `approve_delivery` |
| Settle fixed recipient/amount | `release` |
| Reclaim expired unapproved principal | `refund_expired` |
| Creator cancellation | `creator_cancel` |
| Resolve asynchronous transfer | private `on_settlement` callback |

The contract must derive settlement destination and amount from stored terms. No model output, invoice field, or arbitrary caller argument may supply either value.

The browser intentionally does not hold signing keys. Wallet Selector is configured with a method-limited access key request for operational methods; owner approval and cancellation still require the contract's one-yocto authorization check. The app refreshes canonical state after a returned receipt and never marks a payout paid solely because a wallet flow opened.

## State model

```text
FUNDED ──submit──> SUBMITTED ──approve──> APPROVED ──release──> PAID
   │                     │                  │
   └────eligible refund──┴────refund───────┘ (not allowed after approval)
                              ▼
                           REFUNDED
```

An approved delivery is frozen. A replacement increments the delivery version and invalidates any stale browser review. Release is terminal and can happen at most once. A pending payout/refund reserves the principal before scheduling the transfer; the private callback either finalizes the terminal state or restores the prior claimable state on a failed transfer.

## File integrity

The brief is normalized to UTF-8 text before hashing. Delivery identity is SHA-256 over actual file bytes, never a filename, URL, object URL, MIME label, or ETag. The review screen recomputes the hash locally and blocks approval on mismatch.

## Adapter separation

Simulation and future chain adapters share domain types but must not share truth. Simulation records carry a `simulation` mode label. Testnet mode must re-read finalized contract state and receipt outcomes after wallet actions; a wallet transaction being initiated is not equivalent to a confirmed payout.
