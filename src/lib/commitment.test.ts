import { describe, expect, it } from "vitest";
import {
  canApprove,
  canRefund,
  canRelease,
  canReplaceDelivery,
  validateInvoiceRecipient,
} from "./commitment";
import { createDelivery, createInitialCommission } from "./demoState";

describe("BriefLock commitment rules", () => {
  it("only allows the original client to approve the exact current delivery", () => {
    const commission = createInitialCommission();

    expect(
      canApprove(
        commission,
        commission.clientId,
        commission.currentDelivery!.version,
        commission.currentDelivery!.hash,
      ).allowed,
    ).toBe(true);
    expect(
      canApprove(
        commission,
        "attacker.testnet",
        commission.currentDelivery!.version,
        commission.currentDelivery!.hash,
      ).allowed,
    ).toBe(false);
  });

  it("rejects a stale version after a replacement is submitted", () => {
    const commission = {
      ...createInitialCommission(),
      currentDelivery: createDelivery(2),
    };

    const result = canApprove(
      commission,
      commission.clientId,
      1,
      createDelivery(1).hash,
    );

    expect(result.allowed).toBe(false);
    expect(result.invariant).toContain("exact version");
  });

  it("freezes approved work and blocks replacement", () => {
    const commission = { ...createInitialCommission(), status: "APPROVED" as const };
    const result = canReplaceDelivery(commission, commission.creatorId);

    expect(result.allowed).toBe(false);
    expect(result.invariant).toContain("frozen");
  });

  it("does not allow release before approval or after payout", () => {
    const submitted = createInitialCommission();
    expect(
      canRelease(
        submitted,
        submitted.currentDelivery!.version,
        submitted.currentDelivery!.hash,
      ).allowed,
    ).toBe(false);

    const paid = {
      ...submitted,
      status: "PAID" as const,
      approvedDelivery: submitted.currentDelivery,
    };
    expect(
      canRelease(paid, paid.currentDelivery!.version, paid.currentDelivery!.hash).allowed,
    ).toBe(false);
  });

  it("never accepts a different invoice recipient", () => {
    expect(validateInvoiceRecipient("studio.kanso.testnet", "attacker.testnet").allowed).toBe(
      false,
    );
    expect(validateInvoiceRecipient("studio.kanso.testnet", "studio.kanso.testnet").allowed).toBe(
      true,
    );
  });

  it("allows only the client to refund an unapproved commission", () => {
    const commission = createInitialCommission();
    expect(canRefund(commission, commission.clientId).allowed).toBe(true);
    expect(canRefund(commission, commission.creatorId).allowed).toBe(false);
    expect(
      canRefund({ ...commission, status: "APPROVED" }, commission.clientId).allowed,
    ).toBe(false);
  });
});
