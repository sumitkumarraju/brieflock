import type { Commission, RuleResult } from "../types";

export function canApprove(
  commission: Commission,
  callerId: string,
  version: number,
  hash: string,
): RuleResult {
  if (callerId !== commission.clientId) {
    return {
      allowed: false,
      reason: "Only the original client can approve this commission.",
      invariant: "I02 · client authorization",
    };
  }

  if (commission.status !== "SUBMITTED") {
    return {
      allowed: false,
      reason: `Approval is unavailable while the commission is ${commission.status.toLowerCase()}.`,
      invariant: "I05 · approved work is frozen",
    };
  }

  if (!commission.currentDelivery) {
    return {
      allowed: false,
      reason: "A delivery must exist before the client can approve it.",
      invariant: "I03 · approval binds a delivery",
    };
  }

  if (
    commission.currentDelivery.version !== version ||
    commission.currentDelivery.hash !== hash
  ) {
    return {
      allowed: false,
      reason: "The reviewed version is stale or its bytes do not match the current submission.",
      invariant: "I03 · exact version + hash binding",
    };
  }

  return {
    allowed: true,
    reason: "The client is approving the exact current delivery commitment.",
    invariant: "I03 · exact version + hash binding",
  };
}

export function canReplaceDelivery(
  commission: Commission,
  callerId: string,
): RuleResult {
  if (callerId !== commission.creatorId) {
    return {
      allowed: false,
      reason: "Only the fixed creator can submit a delivery.",
      invariant: "I04 · creator authorization",
    };
  }

  if (commission.status === "APPROVED" || commission.status === "PAID") {
    return {
      allowed: false,
      reason: "Approved work is frozen and cannot be replaced.",
      invariant: "I05 · approved work is frozen",
    };
  }

  if (commission.status === "REFUNDED") {
    return {
      allowed: false,
      reason: "A refunded commission is terminal.",
      invariant: "I01 · terminal settlement",
    };
  }

  return {
    allowed: true,
    reason: "The creator may submit a new version before approval.",
    invariant: "I04 · creator authorization",
  };
}

export function canRelease(
  commission: Commission,
  version: number,
  hash: string,
): RuleResult {
  if (commission.status !== "APPROVED") {
    return {
      allowed: false,
      reason: "A payout cannot begin until the client has approved a delivery.",
      invariant: "I07 · no payment without approval",
    };
  }

  if (
    !commission.approvedDelivery ||
    commission.approvedDelivery.version !== version ||
    commission.approvedDelivery.hash !== hash
  ) {
    return {
      allowed: false,
      reason: "The release commitment does not match the approved delivery.",
      invariant: "I01 · settlement exclusivity",
    };
  }

  return {
    allowed: true,
    reason: `Release is fixed to ${commission.creatorId} for ${commission.amountNear} NEAR.`,
    invariant: "I06 · fixed recipient and amount",
  };
}

export function validateInvoiceRecipient(
  expectedRecipient: string,
  proposedRecipient: string,
): RuleResult {
  if (expectedRecipient !== proposedRecipient) {
    return {
      allowed: false,
      reason: `Invoice recipient ${proposedRecipient} does not match the locked creator ${expectedRecipient}.`,
      invariant: "I06 · invoice cannot redirect settlement",
    };
  }

  return {
    allowed: true,
    reason: "Invoice recipient matches the locked creator.",
    invariant: "I06 · invoice cannot redirect settlement",
  };
}

export function canRefund(commission: Commission, callerId: string): RuleResult {
  if (callerId !== commission.clientId) {
    return {
      allowed: false,
      reason: "Only the original client can request a refund in this MVP.",
      invariant: "I02 · client authorization",
    };
  }

  if (commission.status === "APPROVED" || commission.status === "PAID") {
    return {
      allowed: false,
      reason: "An approved commission cannot be converted into a refund.",
      invariant: "I05 · approval is final",
    };
  }

  if (commission.status === "REFUNDED") {
    return {
      allowed: false,
      reason: "This commission has already been refunded.",
      invariant: "I01 · terminal settlement",
    };
  }

  return {
    allowed: true,
    reason: "The original client can reclaim the unapproved principal.",
    invariant: "I01 · settlement exclusivity",
  };
}
