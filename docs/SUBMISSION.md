# Hackathon Submission Draft

## Current factual description

BriefLock is a NEAR creative milestone payment workflow that binds a client-approved brief, an exact delivery-file hash, and one fixed creator account. Its Rust `near-sdk` contract atomically funds immutable terms, lets only the original client approve the current version/hash, freezes approved work, and derives payout amount and recipient from stored state during asynchronous settlement. The React dashboard hashes actual selected bytes and uses Wallet Selector for explicit testnet signing when configured; it also has a credential-free simulation fallback. A deterministic rules-based assistant reports observable metadata without signing or redirecting funds. Attack Lab demonstrates blocked unauthorized approval, stale-version approval, post-approval replacement, invoice recipient redirection, payout replay, and release-before-approval attempts. Unit and `near-workspaces` sandbox tests cover the contract invariants. Testnet deployment and receipts are reported only when a user-controlled account is configured.

## Intended form values

- Project name: `BriefLock — Verified Delivery, Protected Creator Payments`
- Tracks: `security`, `realworld`
- Lead name: `Sumit Kumar Raju` (confirm before submission)
- Team size: human-provided, not inferred
- Email: human-provided, not inferred for the form
- Mainnet NEAR payout address: human-provided; never use a testnet account or invent one
- Public repository: <https://github.com/sumitkumarraju/brieflock>
- Demo post: human must publish the X post; this assistant does not post on the user’s behalf
- Consent: must be explicitly confirmed before submitting

## X draft

Creative work needs more than a payment button: it needs the approved brief, the exact file version, and the right creator to stay bound together.

We built BriefLock at @NEARProtocol Hackathon: a policy-bound milestone payment workflow where AI can review observable facts, but only the client can approve the exact delivery bytes. Attack Lab demonstrates stale-version, invoice-redirection, unauthorized-approval, and replay defenses.

@NEARProtocol #NEARHackathon

Add the real public repository and demo media before posting. Do not claim testnet receipts until they exist.
