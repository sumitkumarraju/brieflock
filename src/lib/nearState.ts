import type { ActivityEvent, Commission, CommissionStatus, DeliveryCommitment } from "../types";

export interface NearMilestoneView {
  milestone_id: string;
  schema_version: number;
  terms_version: number;
  client_id: string;
  creator_id: string;
  amount_yocto: string;
  brief_hash: string;
  created_at_ns: string;
  submit_by_ns: string;
  review_until_ns: string;
  status:
    | "Funded"
    | "Submitted"
    | "Approved"
    | "PayoutPending"
    | "RefundPending"
    | "Paid"
    | "Refunded";
  delivery_version: string | null;
  delivery_hash: string | null;
  submitted_at_ns: string | null;
  approved_version: string | null;
  approved_hash: string | null;
  approved_at_ns: string | null;
  pending_attempt_id: string | null;
  pending_kind: "Payout" | "Refund" | null;
  pending_amount_yocto: string | null;
  pending_recipient: string | null;
  storage_reserve_yocto: string;
  last_settlement_error: string | null;
}

function mapStatus(status: NearMilestoneView["status"]): CommissionStatus {
  return {
    Funded: "FUNDED",
    Submitted: "SUBMITTED",
    Approved: "APPROVED",
    PayoutPending: "PAYOUT_PENDING",
    RefundPending: "REFUND_PENDING",
    Paid: "PAID",
    Refunded: "REFUNDED",
  }[status] as CommissionStatus;
}

function formatNear(yocto: string): string {
  const value = BigInt(yocto);
  const base = 10n ** 24n;
  const whole = value / base;
  const fraction = (value % base).toString().padStart(24, "0").replace(/0+$/, "").padEnd(2, "0");
  return `${whole}.${fraction}`;
}

function formatChainDate(timestampNs: string): string {
  try {
    const milliseconds = Number(BigInt(timestampNs) / 1_000_000n);
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
      new Date(milliseconds),
    );
  } catch {
    return "Chain timestamp unavailable";
  }
}

function deliveryFromChain(
  version: string | null,
  hash: string | null,
  submittedAt: string | null,
): DeliveryCommitment | null {
  if (!version || !hash) return null;
  return {
    version: Number(version),
    fileName: `on-chain-delivery-v${version}`,
    mimeType: "application/octet-stream",
    sizeBytes: 0,
    hash,
    submittedAt: submittedAt ? formatChainDate(submittedAt) : "On-chain commitment",
    source: "on-chain",
  };
}

export function mapNearMilestone(
  chain: NearMilestoneView,
  previous: Commission | null,
  network: "mainnet" | "testnet" = "testnet",
): Commission {
  const sameMilestone = previous?.id === chain.milestone_id;
  const terminalSettlement = chain.status === "Paid" || chain.status === "Refunded";
  const currentDelivery = deliveryFromChain(
    chain.delivery_version,
    chain.delivery_hash,
    chain.submitted_at_ns,
  );
  const approvedDelivery = deliveryFromChain(
    chain.approved_version,
    chain.approved_hash,
    chain.approved_at_ns,
  );

  return {
    id: chain.milestone_id,
    title: (sameMilestone ? previous?.title : undefined) ?? `NEAR ${network} commission · ${chain.milestone_id}`,
    clientId: chain.client_id,
    creatorId: chain.creator_id,
    creatorName: (sameMilestone ? previous?.creatorName : undefined) ?? chain.creator_id,
    contractId: previous?.contractId ?? `configured ${network} contract`,
    brief: (sameMilestone && previous?.briefHash === chain.brief_hash ? previous.brief : undefined) ?? "The canonical brief is represented by the SHA-256 commitment recorded on NEAR.",
    briefHash: chain.brief_hash,
    amountNear: formatNear(chain.amount_yocto),
    amountYocto: chain.amount_yocto,
    submitBy: formatChainDate(chain.submit_by_ns),
    reviewUntil: formatChainDate(chain.review_until_ns),
    submitByNs: chain.submit_by_ns,
    reviewUntilNs: chain.review_until_ns,
    status: mapStatus(chain.status),
    currentDelivery,
    approvedDelivery,
    payout: sameMilestone && terminalSettlement ? previous?.payout ?? null : null,
    activity: [
      {
        id: "chain-state",
        label: "Canonical state loaded from NEAR",
        detail: `${chain.status} · ${chain.milestone_id}`,
        timestamp: "Finalized view",
        tone: chain.status === "Paid" ? "success" : "neutral",
        executionLayer: network === "mainnet" ? "MAINNET" : "TESTNET",
      } satisfies ActivityEvent,
      ...(sameMilestone ? previous?.activity.filter((event) => event.id !== "chain-state") ?? [] : []),
    ],
  };
}
