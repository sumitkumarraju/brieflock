# Hackathon Submission Draft

## Current factual description

BriefLock is a NEAR-oriented creative milestone payment workflow that binds a client-approved brief, an exact delivery-file hash, and one fixed creator account. The current prototype provides a local simulation of the guarded workflow: the browser hashes selected bytes, only the client role can approve the current version, approved work is frozen, and the payout rule derives its recipient and amount from locked commission terms. A deterministic rules-based assistant reports observable metadata without signing or redirecting funds. Attack Lab demonstrates blocked unauthorized approval, stale-version approval, post-approval replacement, invoice recipient redirection, payout replay, and release-before-approval attempts. The repository clearly labels simulation evidence; the NEAR Rust contract and sandbox suite are the next integration milestone.

## Intended form values

- Project name: `BriefLock — Verified Delivery, Protected Creator Payments`
- Tracks: `security`, `realworld`
- Lead name: `Sumit Kumar Raju` (confirm before submission)
- Team size: human-provided, not inferred
- Email: human-provided, not inferred for the form
- Mainnet NEAR payout address: human-provided; never use a testnet account or invent one
- Public repository: to be added after GitHub publication
- Demo post: human must publish the X post; this assistant does not post on the user’s behalf
- Consent: must be explicitly confirmed before submitting

## X draft

Creative work needs more than a payment button: it needs the approved brief, the exact file version, and the right creator to stay bound together.

We built BriefLock at @NEARProtocol Hackathon: a policy-bound milestone payment workflow where AI can review observable facts, but only the client can approve the exact delivery bytes. Attack Lab demonstrates stale-version, invoice-redirection, unauthorized-approval, and replay defenses.

@NEARProtocol #NEARHackathon

Add the real public repository and demo media before posting. Do not claim testnet receipts until they exist.
