# BriefLock Demo Script

## 90-second cut

**0–12 seconds — the problem**

“A creative payment should authorize one agreed delivery to one agreed creator. A mutable link or a persuasive invoice should not be able to change that.”

Show the Overview card: fixed recipient, 2.40 NEAR principal, and the current delivery version.

**12–30 seconds — exact bytes**

Open Delivery review. Click **Verify demo fixture bytes**. Point to the actual SHA-256 digest and the **Exact bytes match** result. “The browser hashes the bytes the reviewer selects. A filename is not a commitment.”

**30–45 seconds — human approval**

Click **Approve this exact version**, return to Overview, and show the stepper move to Approved. “The rules-based assistant can explain checks, but it cannot press approval.”

**45–58 seconds — fixed settlement**

Click **Release payout**. Show the creator account and amount in the timeline. “This local adapter derives the destination from locked terms; it does not accept a recipient from an invoice.” In a testnet recording, open the linked finalized receipt; in the default recording, keep the simulation label visible.

**58–78 seconds — Attack Lab**

Open Attack Lab and click **Run all checks**. Highlight unauthorized approval, stale version approval, replacement after approval, invoice redirect, replay, and release before approval. “Each result is labeled SIMULATION or LOCAL POLICY rather than pretending to be a chain receipt.”

**78–90 seconds — honest boundary**

Open Evidence and download the report. “The report separates local attack evidence from chain state. The core product property is explicit: AI can advise; only the client can approve the exact bytes.”

## Recording notes

- Keep the Simulation / Local badge visible unless recording with an actual configured testnet contract.
- Do not show invented explorer URLs or transaction hashes.
- If recording a live file substitution, select a different file and show the mismatch before resetting the demo.
- Use the report only as local evidence until sandbox and testnet receipts exist.

## Testnet variant

After following [`NEAR_TESTNET.md`](./NEAR_TESTNET.md), configure `VITE_NEAR_CONTRACT_ID`, connect the wallet, and fund a new commission. Select the actual delivery file in **Delivery Review** before signing `submit_delivery`; select the same bytes again for client approval. Release is permissionless but still reads the fixed recipient and amount from the contract. Show the **TESTNET** evidence badge and open the returned NEARBlocks transaction link. Never describe the local Attack Lab checks as testnet transactions.
