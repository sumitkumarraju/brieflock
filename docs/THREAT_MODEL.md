# BriefLock Threat Model

## Assets

- the locked milestone principal;
- the agreed creator account and amount;
- the exact delivery version approved by the client;
- the client’s approval authority;
- evidence that distinguishes local policy checks from chain receipts.

## Threats and controls

| Threat | Control in current slice | NEAR proof still required |
| --- | --- | --- |
| Unauthorized account approves | caller check in pure rule layer | contract predecessor check + one-yocto policy |
| Stale browser approves v1 after v2 | current version and hash must match | contract optimistic version check |
| Creator replaces work after approval | approved status freezes mutation | contract state transition test |
| Invoice/model redirects recipient | local recipient policy rejects mismatch; release has no override | contract transfer target derives from stored creator |
| Release replay | terminal `PAID` is not releasable | async callback and replay test |
| Release before approval | release rule requires `APPROVED` | contract rejection with principal conserved |
| Browser changes local paid flag | UI does not treat browser flags as canonical chain state | re-read finalized contract state |
| File link changes after review | hash actual selected bytes | user must obtain the actual bytes; contract cannot inspect downloads |
| Prompt injection | model is not used by the baseline; rules-only output has no signing authority | keep model output outside contract authorization |
| Lost/failed transfer callback | not simulated as a live chain callback | pending state, private callback, and recovery tests |

## Explicit limitations

A digest detects byte mismatch but cannot establish artistic quality, ownership, originality, safety, or legal compliance. Client approval establishes only that the configured account signed the recorded commitment. The MVP does not solve subjective non-approval by a client, dispute arbitration, tax invoices, fiat settlement, or private file exchange.

## Operational rules

- local simulation and sandbox/testnet evidence must be labeled separately;
- no seed phrases or full-access wallet keys belong in chat or the repository;
- no model/API key belongs in browser code or public environment variables;
- no arbitrary admin withdrawal or upgrade claim should be made without documenting authority;
- timeouts must not blindly retry an asynchronous financial operation;
- mainnet money is out of scope until a separate operational review.
