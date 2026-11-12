import {
  canApprove,
  canRelease,
  canReplaceDelivery,
  validateInvoiceRecipient,
} from "./commitment";
import { createDelivery } from "./demoState";
import type { AttackResult, AttackScenario, Commission } from "../types";

export const ATTACK_SCENARIOS: AttackScenario[] = [
  {
    id: "A01",
    title: "Unauthorized approval",
    description: "An attacker tries to approve Maya's commission as a different account.",
    expected: "Reject caller; no approval is recorded.",
    category: "authorization",
  },
  {
    id: "A02",
    title: "Stale version approval",
    description: "A browser reviewed v1, then the creator submitted v2 before approval.",
    expected: "Reject the old version/hash pair.",
    category: "commitment",
  },
  {
    id: "A03",
    title: "Replace after approval",
    description: "The creator attempts to overwrite the delivery after client approval.",
    expected: "Freeze the approved commitment.",
    category: "commitment",
  },
  {
    id: "A05",
    title: "Invoice recipient redirect",
    description: "An untrusted invoice proposes paying attacker.testnet instead of the creator.",
    expected: "Reject the invoice proposal; the contract recipient stays fixed.",
    category: "prompt safety",
  },
  {
    id: "A06",
    title: "Replay completed payout",
    description: "A second release call attempts to spend the same commission principal.",
    expected: "Reject replay; terminal PAID state remains unchanged.",
    category: "settlement",
  },
  {
    id: "A08",
    title: "Release before approval",
    description: "A runner tries to release a funded commission before client approval.",
    expected: "Reject release; principal remains claimable.",
    category: "settlement",
  },
];

function cloneWithStatus(commission: Commission, status: Commission["status"]): Commission {
  return { ...commission, status };
}

export function runAttackScenario(
  scenarioId: string,
  commission: Commission,
): AttackResult {
  let result: { allowed: boolean; reason: string };
  let startingStatus = commission.status;

  switch (scenarioId) {
    case "A01": {
      const delivery = createDelivery(1);
      const submitted = { ...cloneWithStatus(commission, "SUBMITTED"), currentDelivery: delivery };
      startingStatus = submitted.status;
      const check = canApprove(submitted, "attacker.testnet", delivery.version, delivery.hash);
      result = check;
      break;
    }
    case "A02": {
      const upgraded: Commission = {
        ...commission,
        status: "SUBMITTED",
        currentDelivery: createDelivery(2),
      };
      startingStatus = upgraded.status;
      const check = canApprove(
        upgraded,
        upgraded.clientId,
        1,
        createDelivery(1).hash,
      );
      result = check;
      break;
    }
    case "A03": {
      const approved = cloneWithStatus(commission, "APPROVED");
      startingStatus = approved.status;
      result = canReplaceDelivery(approved, approved.creatorId);
      break;
    }
    case "A05":
      result = validateInvoiceRecipient(commission.creatorId, "attacker.testnet");
      break;
    case "A06": {
      const paid = { ...cloneWithStatus(commission, "PAID"), approvedDelivery: createDelivery(1) };
      startingStatus = paid.status;
      result = canRelease(
        paid,
        paid.approvedDelivery?.version ?? 1,
        paid.approvedDelivery?.hash ?? "",
      );
      break;
    }
    case "A08":
      result = canRelease(
        cloneWithStatus(commission, "FUNDED"),
        1,
        createDelivery(1).hash,
      );
      break;
    default:
      result = {
        allowed: false,
        reason: "Scenario is not registered in this demo build.",
      };
  }

  return {
    scenarioId,
    actual: result.allowed ? "allowed" : "blocked",
    layer: scenarioId === "A05" ? "LOCAL POLICY" : "SIMULATION",
    reason: result.reason,
    before: startingStatus,
    after: startingStatus,
    evidence: `SIM-${scenarioId}-${result.allowed ? "ALLOW" : "BLOCK"}`,
    ranAt: new Date().toISOString(),
  };
}

export function runAllAttackScenarios(
  commission: Commission,
): Record<string, AttackResult> {
  return Object.fromEntries(
    ATTACK_SCENARIOS.map((scenario) => [
      scenario.id,
      runAttackScenario(scenario.id, commission),
    ]),
  );
}
