# BriefLock Architecture

## Current prototype boundary

The current app is a local simulation with a domain layer that mirrors the intended contract semantics. `src/lib/commitment.ts` is deliberately pure and has no React or browser state dependency. `src/lib/demoState.ts` supplies owned fictional fixtures. `src/lib/attackLab.ts` invokes the same rules used by the UI and reports the execution layer.

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

## Intended NEAR boundary

The next adapter will map these operations to a Rust contract:

| Domain operation | Intended contract method |
| --- | --- |
| Fund immutable terms | `create_and_fund` |
| Submit or replace bytes commitment | `submit_delivery` |
| Approve exact version + hash | `approve_delivery` |
| Settle fixed recipient/amount | `release` |
| Reclaim expired unapproved principal | `refund_expired` |
| Creator cancellation | `creator_cancel` |
| Resolve asynchronous transfer | private `on_settlement` callback |

The contract must derive settlement destination and amount from stored terms. No model output, invoice field, or arbitrary caller argument may supply either value.

## State model

```text
FUNDED ──submit──> SUBMITTED ──approve──> APPROVED ──release──> PAID
   │                     │                  │
   └────eligible refund──┴────refund───────┘ (not allowed after approval)
                              ▼
                           REFUNDED
```

An approved delivery is frozen. A replacement increments the delivery version and invalidates any stale browser review. Release is terminal and can happen at most once.

## File integrity

The brief is normalized to UTF-8 text before hashing. Delivery identity is SHA-256 over actual file bytes, never a filename, URL, object URL, MIME label, or ETag. The review screen recomputes the hash locally and blocks approval on mismatch.

## Adapter separation

Simulation and future chain adapters share domain types but must not share truth. Simulation records carry a `simulation` mode label. Testnet mode must re-read finalized contract state and receipt outcomes after wallet actions; a wallet transaction being initiated is not equivalent to a confirmed payout.
