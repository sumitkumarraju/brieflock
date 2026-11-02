import type { ActivityEvent, Commission, DeliveryCommitment } from "../types";

export const DEMO_BRIEF = `Create a 4:5 launch poster for Kanso Coffee's winter menu.
Tone: warm, quiet, editorial.
Include the Kanso Coffee wordmark, the line "Winter, poured slowly", and a clear opening date.
Deliver one PNG, minimum 1600 × 2000 px, with no unlicensed stock imagery.`;

export const DEMO_DELIVERY_V1 =
  "BRIEFLOCK DEMO POSTER\nKANSO COFFEE\nWINTER, POURED SLOWLY\nOPENING 06 DECEMBER";

export const DEMO_DELIVERY_V2 =
  "BRIEFLOCK DEMO POSTER V2\nKANSO COFFEE\nWINTER, POURED SLOWLY\nOPENING 06 DECEMBER\nROASTED IN SMALL BATCHES";

export const DEMO_BRIEF_HASH =
  "05625f8c4e7044642b53531dab39c4f5f07eec6f1bd3ebb59dc76998de826e36";
export const DEMO_V1_HASH =
  "9b559d61f6ec7c0ad23865cf5f67aa4be893df1ef02ea0c0d58b5e9f75a833fe";
export const DEMO_V2_HASH =
  "8db4ff8811870f1e22ac0b6b52afaa21bbd37ea730f27b679ace5db5ebd26282";

export const DEMO_CLIENT = "maya.kanso.testnet";
export const DEMO_CREATOR = "studio.kanso.testnet";

function event(
  id: string,
  label: string,
  detail: string,
  tone: ActivityEvent["tone"],
  timestamp: string,
): ActivityEvent {
  return { id, label, detail, tone, timestamp };
}

export function createDelivery(version: 1 | 2): DeliveryCommitment {
  return version === 1
    ? {
        version: 1,
        fileName: "kanso-winter-poster-v1.png",
        mimeType: "image/png",
        sizeBytes: 1_482_000,
        hash: DEMO_V1_HASH,
        submittedAt: "Today · 09:14",
        source: "demo fixture",
      }
    : {
        version: 2,
        fileName: "kanso-winter-poster-v2.png",
        mimeType: "image/png",
        sizeBytes: 1_539_000,
        hash: DEMO_V2_HASH,
        submittedAt: "Today · 09:22",
        source: "demo fixture",
      };
}

export function createInitialCommission(): Commission {
  const delivery = createDelivery(1);

  return {
    id: "BL-2401",
    title: "Kanso Coffee · winter launch poster",
    clientId: DEMO_CLIENT,
    creatorId: DEMO_CREATOR,
    creatorName: "Kanso Studio",
    contractId: "brieflock-demo.testnet",
    brief: DEMO_BRIEF,
    briefHash: DEMO_BRIEF_HASH,
    amountNear: "2.40",
    amountYocto: "2400000000000000000000000",
    submitBy: "08 Nov 2026",
    reviewUntil: "12 Nov 2026",
    status: "SUBMITTED",
    currentDelivery: delivery,
    approvedDelivery: null,
    payout: null,
    activity: [
      event(
        "funded",
        "Commission funded",
        "2.40 NEAR locked with immutable terms",
        "success",
        "Today · 09:02",
      ),
      event(
        "submitted-1",
        "Delivery v1 submitted",
        "kanso-winter-poster-v1.png · exact bytes committed",
        "neutral",
        "Today · 09:14",
      ),
    ],
  };
}

export function addActivity(
  commission: Commission,
  activity: ActivityEvent,
): Commission {
  return { ...commission, activity: [activity, ...commission.activity] };
}
