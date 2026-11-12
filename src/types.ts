export type CommissionStatus =
  | "FUNDED"
  | "SUBMITTED"
  | "APPROVED"
  | "PAYOUT_PENDING"
  | "REFUND_PENDING"
  | "PAID"
  | "REFUNDED";

export type ViewId = "overview" | "review" | "attacks" | "evidence";

export type ActivityTone = "neutral" | "success" | "warning" | "danger";

export type DeliverySource = "demo fixture" | "local file" | "on-chain";

export interface DeliveryCommitment {
  version: number;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  hash: string;
  submittedAt: string;
  source: DeliverySource;
}

export interface ActivityEvent {
  id: string;
  label: string;
  detail: string;
  timestamp: string;
  tone: ActivityTone;
  executionLayer?: "SIMULATION" | "TESTNET" | "MAINNET";
  transactionHash?: string;
  explorerUrl?: string;
}

export interface PayoutRecord {
  amountNear: string;
  recipient: string;
  mode: "simulation" | "testnet" | "mainnet";
  simulationId?: string;
  transactionHash?: string;
  explorerUrl?: string;
  blockHash?: string;
  confirmedAt: string;
}

export interface Commission {
  id: string;
  title: string;
  clientId: string;
  creatorId: string;
  creatorName: string;
  contractId: string;
  brief: string;
  briefHash: string;
  amountNear: string;
  amountYocto: string;
  submitBy: string;
  reviewUntil: string;
  submitByNs?: string;
  reviewUntilNs?: string;
  status: CommissionStatus;
  currentDelivery: DeliveryCommitment | null;
  approvedDelivery: DeliveryCommitment | null;
  payout: PayoutRecord | null;
  activity: ActivityEvent[];
}

export interface RuleResult {
  allowed: boolean;
  reason: string;
  invariant: string;
}

export interface AttackScenario {
  id: string;
  title: string;
  description: string;
  expected: string;
  category: "authorization" | "commitment" | "settlement" | "prompt safety";
}

export interface AttackResult {
  scenarioId: string;
  actual: "blocked" | "allowed" | "not-run";
  layer: "SIMULATION" | "LOCAL POLICY";
  reason: string;
  before: CommissionStatus;
  after: CommissionStatus;
  evidence: string;
  ranAt: string;
}

export interface ReviewedFile {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  hash: string;
  source: DeliverySource;
}
