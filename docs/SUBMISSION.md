# Hackathon Submission Draft

## Current factual description

BriefLock is a NEAR creative milestone payment workflow that binds a client-approved brief, an exact delivery-file hash, and one fixed creator account. Its Rust `near-sdk` contract atomically funds immutable terms, lets only the original client approve the current version/hash, freezes approved work, and derives payout amount and recipient from stored state during asynchronous settlement. The React dashboard hashes actual selected bytes and uses Wallet Selector for explicit testnet signing when configured; it also has a credential-free simulation fallback. A deterministic rules-based assistant reports observable metadata without signing or redirecting funds. Attack Lab demonstrates blocked unauthorized approval, stale-version approval, post-approval replacement, invoice recipient redirection, payout replay, and release-before-approval attempts. Unit and `near-workspaces` sandbox tests cover the contract invariants. The deployed testnet contract completed funding, delivery submission, approval and release. The milestone reached Paid and the creator balance increased by exactly 0.1 testnet NEAR. See [transaction evidence](../evidence/testnet-launch.json).

## Intended form values

- Project name: `BriefLock — Verified Delivery, Protected Creator Payments`
- Tracks: `security`, `realworld`
- Lead name: `Sumit Kumar Raju`
- Team size: human-provided, not inferred
- Email: human-provided, not inferred for the form
- Mainnet NEAR payout address: human-provided; never use a testnet account or invent one
- Public repository: <https://github.com/sumitkumarraju/brieflock>
- Demo post: pending publication
- Contact consent: form field

## X post

Built BriefLock at NEAR Hackathon @NEARProtocol. It binds freelance milestone payments to the exact file version a client approves and locks the creator’s payout address. Verified on NEAR testnet. #NEARHackathon

https://github.com/sumitkumarraju/brieflock

Attach the launch video before publishing. Paste the public X post URL into the hackathon form.
