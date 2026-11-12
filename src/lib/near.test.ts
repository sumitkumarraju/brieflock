import { describe, expect, it } from "vitest";
import {
  extractNearReceipt,
  formatNearError,
  gasForNearMethod,
  getExplorerTransactionUrl,
  nearRuntime,
  verifyNearAccount,
  parseNearToYocto,
} from "./near";
import { createInitialCommission } from "./demoState";
import { mapNearMilestone } from "./nearState";

describe("NEAR runtime helpers", () => {
  it("uses the configured network defaults without inventing a contract", () => {
    expect(nearRuntime.network).toBe("testnet");
    expect(nearRuntime.contractId).toBe("");
    expect(nearRuntime.milestoneId).toBe("kanso-001");
  });

  it("reports a mainnet wallet used on the testnet build before asking for a signature", async () => {
    await expect(verifyNearAccount("reviewer.near")).rejects.toThrow("Select a testnet account");
  });

  it("builds a network-specific explorer link from an actual transaction hash", () => {
    expect(getExplorerTransactionUrl("abc/123")).toContain("/txns/abc%2F123");
  });

  it("normalizes unknown wallet failures into an actionable message", () => {
    expect(formatNearError(new Error("wallet rejected"))).toBe("wallet rejected");
    expect(formatNearError({ unexpected: true })).toContain("NEAR RPC");
  });

  it("parses human NEAR amounts into exact yoctoNEAR without floating point", () => {
    expect(parseNearToYocto("2.4")).toBe("2400000000000000000000000");
    expect(parseNearToYocto("0.02")).toBe("20000000000000000000000");
    expect(() => parseNearToYocto("2.1234567890123456789012345")).toThrow();
  });

  it("extracts a real transaction receipt without fabricating one", () => {
    expect(
      extractNearReceipt({
        final_execution_status: "FINAL",
        status: { SuccessValue: "" },
        transaction: { hash: "9x-real-tx" },
        transaction_outcome: { id: "9x-real-tx", block_hash: "block-7" },
      }),
    ).toEqual({
      transactionHash: "9x-real-tx",
      blockHash: "block-7",
      finalStatus: "FINAL",
      succeeded: true,
      failed: false,
      explorerUrl: "https://testnet.nearblocks.io/txns/9x-real-tx",
    });
    expect(extractNearReceipt(undefined)).toBeNull();
    expect(extractNearReceipt({ final_execution_status: "FINAL" })).toBeNull();
  });

  it("keeps wallet hashes pending until a final successful result exists", () => {
    const transaction = { hash: "pending-tx" };
    expect(extractNearReceipt({ transaction })).toMatchObject({ succeeded: false, failed: false });
    expect(extractNearReceipt({ transaction, final_execution_status: "FINAL" })).toMatchObject({ succeeded: false });
    expect(extractNearReceipt({ transaction, status: { SuccessValue: "" }, final_execution_status: "EXECUTED" }))
      .toMatchObject({ succeeded: false });
  });

  it("budgets extra gas for settlement and its callback", () => {
    for (const method of ["release", "refund_expired", "creator_cancel"]) {
      expect(gasForNearMethod(method)).toBe(100_000_000_000_000n);
    }
    expect(gasForNearMethod("approve_delivery")).toBe(30_000_000_000_000n);
  });

  it("marks a finalized failed transaction as failed instead of a payout receipt", () => {
    expect(
      extractNearReceipt({
        final_execution_status: "FINAL",
        status: { Failure: { error_message: "receiver does not exist" } },
        transaction: { hash: "9x-failed-tx" },
        transaction_outcome: { id: "9x-failed-tx", block_hash: "block-8" },
      }),
    ).toMatchObject({
      transactionHash: "9x-failed-tx",
      succeeded: false,
      errorMessage: "receiver does not exist",
    });
  });

  it("maps finalized chain state while preserving the receipt captured this session", () => {
    const previous = {
      ...createInitialCommission(),
      id: "kanso-001",
      payout: {
        amountNear: "2.40",
        recipient: "studio.kanso.testnet",
        mode: "testnet" as const,
        transactionHash: "9x-real-tx",
        explorerUrl: "https://testnet.nearblocks.io/txns/9x-real-tx",
        confirmedAt: "Now",
      },
    };
    const mapped = mapNearMilestone(
      {
        milestone_id: "kanso-001",
        schema_version: 1,
        terms_version: 1,
        client_id: "maya.kanso.testnet",
        creator_id: "studio.kanso.testnet",
        amount_yocto: "2400000000000000000000000",
        brief_hash: "a".repeat(64),
        created_at_ns: "1794000000000000000",
        submit_by_ns: "1794600000000000000",
        review_until_ns: "1795200000000000000",
        status: "Paid",
        delivery_version: "1",
        delivery_hash: "b".repeat(64),
        submitted_at_ns: "1794100000000000000",
        approved_version: "1",
        approved_hash: "b".repeat(64),
        approved_at_ns: "1794200000000000000",
        pending_attempt_id: null,
        pending_kind: null,
        pending_amount_yocto: null,
        pending_recipient: null,
        storage_reserve_yocto: "20000000000000000000000",
        last_settlement_error: null,
      },
      previous,
    );

    expect(mapped.status).toBe("PAID");
    expect(mapped.amountNear).toBe("2.40");
    expect(mapped.payout).toEqual(previous.payout);
    expect(mapped.activity[0].executionLayer).toBe("TESTNET");
    expect(mapped.submitBy).not.toBe("1794600000000000000");
  });
});
