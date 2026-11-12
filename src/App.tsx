import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  BadgeCheck,
  Banknote,
  Blocks,
  Check,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  Clock3,
  Code2,
  Copy,
  Download,
  ExternalLink,
  FileCheck2,
  FileCode2,
  FileText,
  FileUp,
  Fingerprint,
  Gauge,
  Hash,
  History,
  KeyRound,
  LockKeyhole,
  Menu,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserRound,
  WalletCards,
  X,
  Zap,
} from "lucide-react";
import {
  canApprove,
  canRefund,
  canRelease,
  canReplaceDelivery,
} from "./lib/commitment";
import {
  addActivity,
  createDelivery,
  createInitialCommission,
  DEMO_DELIVERY_V1,
  DEMO_DELIVERY_V2,
} from "./lib/demoState";
import {
  ATTACK_SCENARIOS,
  runAllAttackScenarios,
  runAttackScenario,
} from "./lib/attackLab";
import { formatBytes, normalizeBrief, sha256Hex, shortHash } from "./lib/hash";
import {
  disconnectNearWallet,
  formatNearError,
  getExplorerAccountUrl,
  isNearConfigured,
  nearRuntime,
  parseNearToYocto,
  readNearContract,
  showNearWalletModal,
  signNearContractCall,
  subscribeToNearAccounts,
} from "./lib/near";
import { mapNearMilestone, type NearMilestoneView } from "./lib/nearState";
import type {
  ActivityEvent,
  AttackResult,
  Commission,
  CommissionStatus,
  DeliveryCommitment,
  ReviewedFile,
  ViewId,
} from "./types";

const navItems: Array<{ id: ViewId; label: string; icon: typeof Gauge }> = [
  { id: "overview", label: "Overview", icon: Gauge },
  { id: "review", label: "Delivery review", icon: FileCheck2 },
  { id: "attacks", label: "Attack Lab", icon: ShieldAlert },
  { id: "evidence", label: "Evidence", icon: History },
];

const statusLabels: Record<CommissionStatus, string> = {
  FUNDED: "Funded",
  SUBMITTED: "Awaiting approval",
  APPROVED: "Approved",
  PAYOUT_PENDING: "Payout pending",
  REFUND_PENDING: "Refund pending",
  PAID: "Paid",
  REFUNDED: "Refunded",
};

const statusClasses: Record<CommissionStatus, string> = {
  FUNDED: "status-neutral",
  SUBMITTED: "status-amber",
  APPROVED: "status-teal",
  PAYOUT_PENDING: "status-amber",
  REFUND_PENDING: "status-purple",
  PAID: "status-green",
  REFUNDED: "status-purple",
};

function nowLabel(): string {
  return `Today · ${new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date())}`;
}

function newEvent(
  id: string,
  label: string,
  detail: string,
  tone: ActivityEvent["tone"],
): ActivityEvent {
  return { id, label, detail, tone, timestamp: nowLabel() };
}

function StatusPill({ status }: { status: CommissionStatus }) {
  return (
    <span className={`status-pill ${statusClasses[status]}`}>
      <span className="status-dot" />
      {statusLabels[status]}
    </span>
  );
}

function HashValue({ value, label = "SHA-256" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copyHash() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="hash-value">
      <span className="hash-label">{label}</span>
      <code>{shortHash(value, 10)}</code>
      <button className="icon-button tiny" onClick={copyHash} aria-label="Copy hash">
        {copied ? <Check size={13} /> : <Copy size={13} />}
      </button>
    </div>
  );
}

function IconBadge({ children, tone = "teal" }: { children: React.ReactNode; tone?: string }) {
  return <span className={`icon-badge icon-badge-${tone}`}>{children}</span>;
}

function Stepper({ status }: { status: CommissionStatus }) {
  const steps: Array<{ key: CommissionStatus; label: string }> = [
    { key: "FUNDED", label: "Funded" },
    { key: "SUBMITTED", label: "Submitted" },
    { key: "APPROVED", label: "Approved" },
    { key: "PAID", label: "Paid" },
  ];
  const order = ["FUNDED", "SUBMITTED", "APPROVED", "PAID"];
  const currentIndex = status === "REFUNDED" ? 4 : status === "PAYOUT_PENDING" ? 3 : status === "REFUND_PENDING" ? 4 : order.indexOf(status);

  return (
    <div className="stepper" aria-label="Commission progress">
      {steps.map((step, index) => {
        const complete = index <= currentIndex;
        const current = step.key === status;
        return (
          <div className="stepper-item" key={step.key}>
            <div className={`step-marker ${complete ? "complete" : ""} ${current ? "current" : ""}`}>
              {complete ? <Check size={13} strokeWidth={3} /> : <span>{index + 1}</span>}
            </div>
            <span className={current ? "step-label current" : "step-label"}>{step.label}</span>
            {index < steps.length - 1 && <div className={`step-line ${index < currentIndex ? "complete" : ""}`} />}
          </div>
        );
      })}
    </div>
  );
}

function App() {
  const [activeView, setActiveView] = useState<ViewId>("overview");
  const [commission, setCommission] = useState<Commission>(() => createInitialCommission());
  const [reviewedFile, setReviewedFile] = useState<ReviewedFile | null>(() => {
    const delivery = createDelivery(1);
    return {
      fileName: delivery.fileName,
      mimeType: delivery.mimeType,
      sizeBytes: delivery.sizeBytes,
      hash: delivery.hash,
      source: "demo fixture",
    };
  });
  const [reviewVerified, setReviewVerified] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "warning" | "error"; text: string } | null>(
    null,
  );
  const [attackResults, setAttackResults] = useState<Record<string, AttackResult>>({});
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isHashing, setIsHashing] = useState(false);
  const [nearAccount, setNearAccount] = useState<string | null>(null);
  const [nearBusy, setNearBusy] = useState(false);
  const [activeMilestoneId, setActiveMilestoneId] = useState(() => new URLSearchParams(window.location.search).get("milestone") || nearRuntime.milestoneId);
  const [createOpen, setCreateOpen] = useState(false);
  const liveConfigured = isNearConfigured();
  const [liveStateStatus, setLiveStateStatus] = useState<"checking" | "available" | "missing" | "error">(liveConfigured ? "checking" : "available");
  const [liveStateError, setLiveStateError] = useState<string | null>(null);

  useEffect(() => {
    if (!liveConfigured) return undefined;
    let unsubscribe: (() => void) | undefined;
    subscribeToNearAccounts((accounts) => setNearAccount(accounts[0] ?? null))
      .then((cleanup) => {
        unsubscribe = cleanup;
      })
      .catch(() => undefined);
    return () => unsubscribe?.();
  }, [liveConfigured]);

  const currentDelivery = commission.currentDelivery;
  const reviewMatch = Boolean(
    reviewedFile && currentDelivery && reviewedFile.hash === currentDelivery.hash,
  );
  const canApproveCurrent = Boolean(
    currentDelivery && reviewVerified && reviewMatch && commission.status === "SUBMITTED",
  );

  const completedAttacks = Object.keys(attackResults).length;
  const blockedAttacks = Object.values(attackResults).filter((result) => result.actual === "blocked").length;

  async function syncLiveState(milestoneId = activeMilestoneId) {
    if (!liveConfigured) return;
    setNearBusy(true);
    setLiveStateStatus("checking");
    setLiveStateError(null);
    try {
      const chain = await readNearContract<NearMilestoneView | null>("get_milestone", {
        milestone_id: milestoneId,
      });
      if (!chain) {
        setLiveStateStatus("missing");
        showNotice(`No milestone ${milestoneId} exists on ${nearRuntime.network}.`, "warning");
        return;
      }
      setLiveStateStatus("available");
      setCommission((current) => mapNearMilestone(chain, current));
      setReviewedFile(null);
      setReviewVerified(false);
      showNotice("Finalized state reloaded from the NEAR contract.");
      return chain;
    } catch (error) {
      setLiveStateStatus("error");
      setLiveStateError(formatNearError(error));
      showNotice(formatNearError(error), "error");
    } finally {
      setNearBusy(false);
    }
  }

  useEffect(() => {
    if (liveConfigured) void syncLiveState(activeMilestoneId);
    // The configured milestone is intentionally read once on startup; subsequent writes call sync explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveConfigured]);

  async function connectNearWallet() {
    if (!liveConfigured) {
      showNotice("Simulation is active. Set VITE_NEAR_CONTRACT_ID after deploying the contract to enable testnet wallet actions.", "warning");
      return;
    }
    try {
      await showNearWalletModal();
    } catch (error) {
      showNotice(formatNearError(error), "error");
    }
  }

  async function signLiveAction(
    methodName: string,
    args: Record<string, unknown>,
    depositYocto: string,
    successMessage: string,
    expectedSigner?: string,
  ) {
    if (!nearAccount) {
      showNotice("Connect a NEAR testnet wallet before signing this action.", "warning");
      return;
    }
    if (expectedSigner && nearAccount !== expectedSigner) {
      showNotice(`This action requires ${expectedSigner}. The connected wallet is ${nearAccount}.`, "error");
      return;
    }
    setNearBusy(true);
    try {
      const receipt = await signNearContractCall(methodName, args, depositYocto);
      if (!receipt) {
        showNotice(`${successMessage} Wallet flow opened. Wait for finality, then refresh chain state.`, "warning");
        return;
      }

      const settlement = methodName === "release" || methodName === "refund_expired";
      const chain = await syncLiveState();
      const settled = settlement && chain?.status === (methodName === "release" ? "Paid" : "Refunded");
      const receiptActivity = {
        id: `tx-${receipt.transactionHash}`,
        label: `${successMessage.replace(" signed.", "")} finalized`,
        detail: `${receipt.transactionHash}${receipt.blockHash ? ` · block ${receipt.blockHash}` : ""}`,
        timestamp: nowLabel(),
        tone: "success" as const,
        executionLayer: "TESTNET" as const,
        transactionHash: receipt.transactionHash,
        explorerUrl: receipt.explorerUrl,
      };
      setCommission((current) =>
        addActivity(
          {
            ...current,
            payout: settled
              ? {
                  amountNear: current.amountNear,
                  recipient: methodName === "release" ? current.creatorId : current.clientId,
                  mode: "testnet",
                  transactionHash: receipt.transactionHash,
                  explorerUrl: receipt.explorerUrl,
                  blockHash: receipt.blockHash,
                  confirmedAt: nowLabel(),
                }
              : current.payout,
          },
          receiptActivity,
        ),
      );
      if (settlement && !settled) {
        showNotice(chain?.last_settlement_error ?? "The transaction was finalized. Refresh to confirm settlement state.", "warning");
      } else if (chain) {
        showNotice(`${successMessage.replace(" signed.", "")} confirmed on NEAR.`);
      }
    } catch (error) {
      showNotice(formatNearError(error), "error");
    } finally {
      setNearBusy(false);
    }
  }

  async function createCommission(draft: CommissionDraft) {
    setNearBusy(true);
    try {
      const brief = normalizeBrief(draft.brief);
      const briefHash = await sha256Hex(brief);
      const amountYocto = parseNearToYocto(draft.amountNear);
      const storageReserveYocto = parseNearToYocto("0.02");
      const createdAtNs = BigInt(Date.now()) * 1_000_000n;
      const submitByNs = createdAtNs + 7n * 86_400_000_000_000n;
      const reviewUntilNs = createdAtNs + 14n * 86_400_000_000_000n;
      const milestoneId = `brieflock-${Date.now()}`;

      if (liveConfigured) {
        if (!nearAccount) {
          showNotice("Connect the client wallet before funding a NEAR commission.", "warning");
          return;
        }
        const receipt = await signNearContractCall(
          "create_and_fund",
          {
            milestone_id: milestoneId,
            creator_id: draft.creatorId,
            amount_yocto: amountYocto,
            brief_hash: briefHash,
            submit_by_ns: submitByNs.toString(),
            review_until_ns: reviewUntilNs.toString(),
          },
          (BigInt(amountYocto) + BigInt(storageReserveYocto)).toString(),
        );
        if (!receipt) {
          showNotice("Wallet flow opened. Wait for finality before looking up the new milestone.", "warning");
          return;
        }
        setActiveMilestoneId(milestoneId);
        const milestoneUrl = new URL(window.location.href);
        milestoneUrl.searchParams.set("milestone", milestoneId);
        window.history.replaceState(null, "", milestoneUrl);
        setCreateOpen(false);
        setCommission((current) =>
          addActivity(
            {
              ...current,
              id: milestoneId,
              title: draft.title,
              clientId: nearAccount ?? current.clientId,
              creatorId: draft.creatorId,
              creatorName: draft.creatorId,
              contractId: nearRuntime.contractId,
              brief,
              briefHash,
              amountNear: draft.amountNear,
              amountYocto,
              submitBy: new Date(Number(submitByNs / 1_000_000n)).toLocaleDateString(),
              reviewUntil: new Date(Number(reviewUntilNs / 1_000_000n)).toLocaleDateString(),
              status: "FUNDED",
              currentDelivery: null,
              approvedDelivery: null,
              payout: null,
              activity: [],
            },
            {
              id: `tx-${receipt.transactionHash}`,
              label: "Funding finalized on NEAR",
              detail: `${amountYocto} yoctoNEAR principal + storage reserve · ${receipt.transactionHash}`,
              timestamp: nowLabel(),
              tone: "success",
              executionLayer: "TESTNET",
              transactionHash: receipt.transactionHash,
              explorerUrl: receipt.explorerUrl,
            },
          ),
        );
        await syncLiveState(milestoneId);
        showNotice("Commission funded on NEAR. Finalized terms are now canonical.");
        return;
      }

      const local = createInitialCommission();
      setCommission({
        ...local,
        id: milestoneId,
        title: draft.title,
        creatorId: draft.creatorId,
        creatorName: draft.creatorId,
        brief,
        briefHash,
        amountNear: draft.amountNear,
        amountYocto,
        status: "FUNDED",
        currentDelivery: null,
        approvedDelivery: null,
        payout: null,
        activity: [
          newEvent("created", "Commission created", `${draft.amountNear} NEAR reserved with immutable terms`, "success"),
        ],
      });
      setActiveView("overview");
      setCreateOpen(false);
      showNotice("Commission created in simulation. Add a delivery before approval.");
    } catch (error) {
      showNotice(formatNearError(error), "error");
    } finally {
      setNearBusy(false);
    }
  }

  const nextAction = useMemo(() => {
    if (commission.status === "FUNDED") {
      return {
        eyebrow: "Creator action required",
        title: "Submit the first delivery",
        body: "The principal is locked. The fixed creator can now commit version 1.",
        button: "Submit delivery v1",
        target: "overview" as ViewId,
      };
    }
    if (commission.status === "SUBMITTED") {
      return {
        eyebrow: "Client action required",
        title: currentDelivery ? `Review delivery v${currentDelivery.version}` : "Waiting for delivery",
        body: "Verify the exact bytes on this device before signing approval.",
        button: "Open delivery review",
        target: "review" as ViewId,
      };
    }
    if (commission.status === "APPROVED") {
      return {
        eyebrow: "Ready to settle",
        title: "Release the locked payment",
        body: "The payout target and amount are read from the commission terms.",
        button: "Release payout",
        target: "overview" as ViewId,
      };
    }
    if (commission.status === "PAYOUT_PENDING" || commission.status === "REFUND_PENDING") {
      return {
        eyebrow: "Awaiting finalized receipt",
        title: commission.status === "PAYOUT_PENDING" ? "Payout is in flight" : "Refund is in flight",
        body: "Do not replay the action. BriefLock is waiting for the contract callback to resolve the attempt.",
        button: "Refresh chain state",
        target: "evidence" as ViewId,
      };
    }
    if (commission.status === "PAID") {
      return {
        eyebrow: "Settlement complete",
        title: liveConfigured ? "Payment confirmed on NEAR" : "Payment confirmed in simulation",
        body: "Inspect the evidence ledger for the full approval and payout chain.",
        button: "View evidence",
        target: "evidence" as ViewId,
      };
    }
    return {
      eyebrow: "Terminal state",
        title: liveConfigured ? "Principal returned on NEAR" : "Principal returned in simulation",
      body: "This commission cannot be approved or paid after refund.",
      button: "View evidence",
      target: "evidence" as ViewId,
    };
  }, [commission.status, currentDelivery, liveConfigured]);

  function showNotice(text: string, tone: "success" | "warning" | "error" = "success") {
    setNotice({ text, tone });
    window.setTimeout(() => setNotice(null), 4800);
  }

  function navigate(view: ViewId) {
    setActiveView(view);
    setMobileNavOpen(false);
  }

  function resetDemo() {
    const fresh = createInitialCommission();
    setCommission(fresh);
    setReviewedFile({
      fileName: fresh.currentDelivery!.fileName,
      mimeType: fresh.currentDelivery!.mimeType,
      sizeBytes: fresh.currentDelivery!.sizeBytes,
      hash: fresh.currentDelivery!.hash,
      source: "demo fixture",
    });
    setReviewVerified(false);
    setAttackResults({});
    showNotice("Demo reset to a funded commission with delivery v1.");
  }

  async function verifyDemoFixture() {
    if (!currentDelivery) return;
    setIsHashing(true);
    const bytes = currentDelivery.version === 1 ? DEMO_DELIVERY_V1 : DEMO_DELIVERY_V2;
    const hash = await sha256Hex(bytes);
    const matches = hash === currentDelivery.hash;
    setReviewedFile({
      fileName: currentDelivery.fileName,
      mimeType: currentDelivery.mimeType,
      sizeBytes: currentDelivery.sizeBytes,
      hash,
      source: "demo fixture",
    });
    setReviewVerified(matches);
    setIsHashing(false);
    showNotice(
      matches
        ? `Verified the actual fixture bytes for delivery v${currentDelivery.version}.`
        : "The fixture bytes do not match the current chain commitment.",
      matches ? "success" : "error",
    );
  }

  async function handleFileSelection(file: File | undefined) {
    if (!file) return;
    setIsHashing(true);
    try {
      const hash = await sha256Hex(await file.arrayBuffer());
      const matches = currentDelivery?.hash === hash;
      setReviewedFile({
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        hash,
        source: "local file",
      });
      setReviewVerified(matches);
      showNotice(
        matches
          ? "Exact delivery bytes match the current commitment. Human approval is ready."
          : currentDelivery
            ? "File hashed on this device, but it does not match the current commitment."
            : "File hashed on this device. Commit it as the next delivery when ready.",
        matches ? "success" : "warning",
      );
    } catch {
      showNotice("The file could not be hashed in this browser.", "error");
    } finally {
      setIsHashing(false);
    }
  }

  async function submitReplacement() {
    const check = canReplaceDelivery(commission, commission.creatorId);
    if (!check.allowed) {
      showNotice(check.reason, "error");
      return;
    }
    const version = commission.currentDelivery ? commission.currentDelivery.version + 1 : 1;
    const selectedDelivery = reviewedFile?.source === "local file"
      ? {
          version,
          fileName: reviewedFile.fileName,
          mimeType: reviewedFile.mimeType,
          sizeBytes: reviewedFile.sizeBytes,
          hash: reviewedFile.hash,
          submittedAt: nowLabel(),
          source: "local file" as const,
        }
      : null;
    if (liveConfigured && !selectedDelivery) {
      showNotice("Choose the actual delivery file in Delivery Review before signing its on-chain commitment.", "warning");
      setActiveView("review");
      return;
    }
    if (!selectedDelivery && version > 2) {
      showNotice("Choose a local delivery file before submitting another version.", "warning");
      setActiveView("review");
      return;
    }
    const delivery = selectedDelivery ?? createDelivery(version === 1 ? 1 : 2);
    if (liveConfigured) {
      await signLiveAction(
        "submit_delivery",
        {
          milestone_id: commission.id,
          expected_previous_version: String(commission.currentDelivery?.version ?? 0),
          delivery_hash: delivery.hash,
        },
        "1",
        "Delivery submission signed.",
        commission.creatorId,
      );
      return;
    }
    setCommission((current) =>
      addActivity(
        { ...current, status: "SUBMITTED", currentDelivery: delivery, approvedDelivery: null, payout: null },
        newEvent(
          `submitted-${delivery.version}`,
          `Delivery v${delivery.version} submitted`,
          `${delivery.fileName} · previous review is now stale`,
          "warning",
        ),
      ),
    );
    setReviewVerified(false);
    showNotice("Version 2 submitted. Any approval of version 1 must now fail.", "warning");
  }

  async function approveDelivery() {
    if (!currentDelivery) return;
    const check = canApprove(
      commission,
      commission.clientId,
      currentDelivery.version,
      currentDelivery.hash,
    );
    if (!reviewVerified || !reviewMatch) {
      showNotice("Approval is blocked until this device verifies the exact current bytes.", "error");
      return;
    }
    if (!check.allowed) {
      showNotice(check.reason, "error");
      return;
    }
    if (liveConfigured) {
      await signLiveAction(
        "approve_delivery",
        {
          milestone_id: commission.id,
          version: String(currentDelivery.version),
          delivery_hash: currentDelivery.hash,
        },
        "1",
        "Approval signed.",
        commission.clientId,
      );
      return;
    }
    setCommission((current) =>
      addActivity(
        { ...current, status: "APPROVED", approvedDelivery: currentDelivery },
        newEvent(
          "approved",
          `Client approved delivery v${currentDelivery.version}`,
          "Version and SHA-256 commitment are now frozen",
          "success",
        ),
      ),
    );
    showNotice("Approval recorded. The creator cannot replace this commitment now.");
  }

  async function releasePayout() {
    if (!commission.approvedDelivery) return;
    const check = canRelease(
      commission,
      commission.approvedDelivery.version,
      commission.approvedDelivery.hash,
    );
    if (!check.allowed) {
      showNotice(check.reason, "error");
      return;
    }
    if (liveConfigured) {
      await signLiveAction(
        "release",
        {
          milestone_id: commission.id,
          version: String(commission.approvedDelivery.version),
          delivery_hash: commission.approvedDelivery.hash,
        },
        "0",
        "Release request signed.",
      );
      return;
    }
    const payout = {
      amountNear: commission.amountNear,
      recipient: commission.creatorId,
      mode: "simulation" as const,
      simulationId: "SIM-PAYOUT-BL-2401",
      confirmedAt: nowLabel(),
    };
    setCommission((current) =>
      addActivity(
        { ...current, status: "PAID", payout },
        newEvent(
          "paid",
          "Payout confirmed in simulation",
          `${payout.amountNear} NEAR → ${payout.recipient}`,
          "success",
        ),
      ),
    );
    showNotice("Payout confirmed in simulation. No testnet transaction was sent.");
  }

  async function refundCommission() {
    const check = canRefund(commission, commission.clientId);
    if (!check.allowed) {
      showNotice(check.reason, "error");
      return;
    }
    if (liveConfigured) {
      await signLiveAction(
        "refund_expired",
        { milestone_id: commission.id },
        "1",
        "Refund request signed.",
        commission.clientId,
      );
      return;
    }
    setCommission((current) =>
      addActivity(
        { ...current, status: "REFUNDED" },
        newEvent(
          "refunded",
          "Principal returned in simulation",
          `${current.amountNear} NEAR → ${current.clientId}`,
          "warning",
        ),
      ),
    );
    showNotice("The unapproved principal was returned to the original client.", "warning");
  }

  function runAttack(id: string) {
    const result = runAttackScenario(id, commission);
    setAttackResults((current) => ({ ...current, [id]: result }));
    showNotice(`${id} blocked: ${result.reason}`, "success");
  }

  function runAllAttacks() {
    const results = runAllAttackScenarios(commission);
    setAttackResults(results);
    showNotice(`${Object.keys(results).length} attack checks completed.`, "success");
  }

  function downloadEvidence() {
    const report = {
      report: "BriefLock Attack Lab",
      generatedAt: new Date().toISOString(),
      mode: liveConfigured ? "testnet" : "simulation",
      network: liveConfigured ? nearRuntime.network : "local",
      contractId: liveConfigured ? nearRuntime.contractId : null,
      commissionId: commission.id,
      status: commission.status,
      payout: commission.payout,
      scenarios: Object.values(attackResults),
      limitation: liveConfigured
        ? "Attack Lab scenarios remain local policy simulations. The commission state and any linked transaction hash come from the configured NEAR contract."
        : "Simulation evidence is not a blockchain receipt. Compile and run the NEAR sandbox contract before claiming on-chain execution.",
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "brieflock-attack-report.json";
    anchor.click();
    URL.revokeObjectURL(url);
    showNotice(`Downloaded the current ${liveConfigured ? "testnet" : "simulation"} evidence report.`);
  }

  function renderView() {
    switch (activeView) {
      case "review":
        return (
          <ReviewView
            commission={commission}
            currentDelivery={currentDelivery}
            reviewedFile={reviewedFile}
            reviewMatch={reviewMatch}
            reviewVerified={reviewVerified}
            isHashing={isHashing}
            onVerifyDemo={verifyDemoFixture}
            onSelectFile={handleFileSelection}
            onApprove={approveDelivery}
            onSubmitReplacement={submitReplacement}
            liveConfigured={liveConfigured}
          />
        );
      case "attacks":
        return (
          <AttackLabView
            results={attackResults}
            completed={completedAttacks}
            blocked={blockedAttacks}
            onRun={runAttack}
            onRunAll={runAllAttacks}
            liveConfigured={liveConfigured}
          />
        );
      case "evidence":
        return (
          <EvidenceView
            commission={commission}
            attackResults={attackResults}
            onDownload={downloadEvidence}
            onCopy={() => showNotice(liveConfigured ? "Chain evidence context is included in the downloaded report." : "Evidence is generated from the current local state.", liveConfigured ? "success" : "warning")}
            liveConfigured={liveConfigured}
          />
        );
      default:
        return (
          <OverviewView
            commission={commission}
            nextAction={nextAction}
            onNavigate={navigate}
            onRelease={releasePayout}
            onRefund={refundCommission}
            onSubmitReplacement={submitReplacement}
            onReset={resetDemo}
            onNew={() => setCreateOpen(true)}
            liveConfigured={liveConfigured}
          />
        );
    }
  }

  return (
    <div className="app-shell">
      {mobileNavOpen && <button className="mobile-overlay" onClick={() => setMobileNavOpen(false)} />}
      <aside className={`sidebar ${mobileNavOpen ? "mobile-open" : ""}`}>
        <div className="brand-lockup">
          <div className="brand-mark"><LockKeyhole size={17} strokeWidth={2.4} /></div>
          <div>
            <div className="brand-name">BriefLock</div>
            <div className="brand-tagline">payment commitments</div>
          </div>
          <button className="sidebar-close" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation">
            <X size={17} />
          </button>
        </div>

        <div className="workspace-label">Workspace</div>
        <nav className="main-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                className={`nav-item ${activeView === item.id ? "active" : ""}`}
                key={item.id}
                onClick={() => navigate(item.id)}
              >
                <Icon size={17} strokeWidth={activeView === item.id ? 2.2 : 1.8} />
                <span>{item.label}</span>
                {item.id === "attacks" && completedAttacks > 0 && <span className="nav-count">{blockedAttacks}</span>}
                {activeView === item.id && <ChevronRight className="nav-arrow" size={14} />}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-divider" />
        <div className="workspace-label">Protocol</div>
        <div className="protocol-list">
          <div className="protocol-item"><span className="protocol-status online" />{nearAccount ? `${nearRuntime.network} chain connected` : liveConfigured ? `${nearRuntime.network} contract ready` : "Local simulation"}</div>
          <div className="protocol-item"><Blocks size={14} />{liveConfigured ? nearRuntime.contractId : "NEAR contract model"}</div>
          <div className="protocol-item"><KeyRound size={14} />{nearAccount ?? "No wallet connected"}</div>
        </div>

        <div className="sidebar-bottom">
          <div className="side-contract-card">
            <div className="side-contract-top"><span>Demo commission</span><span className="mono">{commission.id}</span></div>
            <div className="side-contract-title">Kanso Coffee</div>
            <StatusPill status={commission.status} />
            <div className="side-contract-meta"><span>Principal</span><strong>{commission.amountNear} NEAR</strong></div>
          </div>
          <div className="user-row">
            <div className="avatar">SK</div>
            <div className="user-copy"><strong>Builder workspace</strong><span>local operator</span></div>
            <button className="icon-button"><RefreshCw size={15} /></button>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <button className="mobile-menu-button" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation"><Menu size={19} /></button>
          <div className="breadcrumbs"><span>BriefLock</span><ChevronRight size={13} /><strong>{navItems.find((item) => item.id === activeView)?.label}</strong></div>
          <div className="topbar-actions">
            <span data-network={liveConfigured ? nearRuntime.network.toUpperCase() : "LOCAL"} className={`network-pill ${nearAccount ? "network-live" : ""}`}><span className="network-dot" /> {nearAccount ? `${nearRuntime.network.toUpperCase()} · CHAIN` : liveConfigured ? `${nearRuntime.network.toUpperCase()} · READY` : "SIMULATION · LOCAL"}</span>
            <button className="wallet-button" onClick={connectNearWallet} disabled={nearBusy}>
              <WalletCards size={15} />
              {nearAccount ? <span className="wallet-account">{nearAccount}</span> : liveConfigured ? "Connect wallet" : "Testnet wallet"}
            </button>
            {nearAccount && <button className="text-button" disabled={nearBusy} onClick={() => {
              void disconnectNearWallet().catch((error) => showNotice(formatNearError(error), "error"));
            }}>Disconnect</button>}
            {nearAccount && <a className="icon-button top-icon" href={getExplorerAccountUrl(nearAccount)} target="_blank" rel="noreferrer" aria-label="Open account on explorer"><ExternalLink size={16} /></a>}
            <button className="icon-button top-icon" aria-label="View contract model"><Code2 size={17} /></button>
            <div className="top-avatar">SK</div>
          </div>
        </header>

        <div className="page-wrap">
          {notice && (
            <div className={`toast toast-${notice.tone}`} role="status">
              {notice.tone === "success" ? <CircleCheck size={16} /> : <CircleAlert size={16} />}
              <span>{notice.text}</span>
              <button onClick={() => setNotice(null)} aria-label="Dismiss notification"><X size={14} /></button>
            </div>
          )}
          {liveConfigured && liveStateStatus !== "available" ? (
            <LiveSetupView
              milestoneId={activeMilestoneId}
              busy={nearBusy}
              connected={Boolean(nearAccount)}
              error={liveStateError}
              status={liveStateStatus}
              onConnect={connectNearWallet}
              onNew={() => setCreateOpen(true)}
              onRefresh={() => void syncLiveState()}
            />
          ) : renderView()}
          {createOpen && <CreateCommissionModal liveConfigured={liveConfigured} busy={nearBusy} onClose={() => setCreateOpen(false)} onSubmit={createCommission} />}
        </div>
      </main>
    </div>
  );
}

function LiveSetupView({
  milestoneId,
  busy,
  connected,
  error,
  status,
  onConnect,
  onNew,
  onRefresh,
}: {
  milestoneId: string;
  busy: boolean;
  connected: boolean;
  error: string | null;
  status: "checking" | "available" | "missing" | "error";
  onConnect: () => void;
  onNew: () => void;
  onRefresh: () => void;
}) {
  const checking = status === "checking";
  const hasError = status === "error";
  return (
    <section className="live-setup card">
      <div className="live-setup-mark">{checking ? <RefreshCw className="spin" size={22} /> : hasError ? <CircleAlert size={22} /> : <Blocks size={22} />}</div>
      <span className="section-kicker">{nearRuntime.network.toUpperCase()} / {checking ? "READING CANONICAL STATE" : hasError ? "RPC READ FAILED" : "NO MILESTONE SELECTED"}</span>
      <h1>{checking ? "Reading the contract state." : hasError ? "The chain could not be read." : "Connect a real commission to the dashboard."}</h1>
      <p>{checking ? `Looking up ${milestoneId} on ${nearRuntime.contractId}.` : hasError ? error : <>No commission named <code>{milestoneId}</code> was found on <code>{nearRuntime.contractId}</code>. This screen will not fall back to local balances while testnet mode is enabled.</>}</p>
      <div className="live-setup-checks">
        <div><span className={connected ? "setup-check ready" : "setup-check"}>{connected ? <Check size={12} /> : <CircleDashed size={12} />}</span><span><strong>Wallet</strong><small>{connected ? "Connected for signing" : "Connect before funding"}</small></span></div>
        <div><span className="setup-check ready"><Check size={12} /></span><span><strong>Contract</strong><small>{nearRuntime.contractId}</small></span></div>
        <div><span className={`setup-check ${checking ? "ready" : ""}`}>{checking ? <RefreshCw className="spin" size={12} /> : <CircleDashed size={12} />}</span><span><strong>Canonical state</strong><small>{checking ? "Reading finalized RPC state" : hasError ? "Read failed; retry required" : "Waiting for a funded milestone"}</small></span></div>
      </div>
      <div className="live-setup-actions"><button className="button button-primary" onClick={onNew} disabled={busy || checking || hasError}><WalletCards size={15} /> Fund a commission</button><button className="button button-quiet" onClick={onConnect} disabled={busy}>{connected ? "Wallet connected" : "Connect wallet"}</button><button className="text-button" onClick={onRefresh} disabled={busy}><RefreshCw size={13} /> {hasError ? "Retry state read" : "Refresh state"}</button></div>
    </section>
  );
}

interface CommissionDraft {
  title: string;
  creatorId: string;
  amountNear: string;
  brief: string;
}

function CreateCommissionModal({
  liveConfigured,
  busy,
  onClose,
  onSubmit,
}: {
  liveConfigured: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (draft: CommissionDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<CommissionDraft>({
    title: "Kanso Coffee · winter launch poster",
    creatorId: "studio.kanso.testnet",
    amountNear: "2.40",
    brief: "Create a 4:5 launch poster for Kanso Coffee's winter menu.\nTone: warm, quiet, editorial.\nInclude the Kanso Coffee wordmark, the line ‘Winter, poured slowly’, and a clear opening date.\nDeliver one PNG, minimum 1600 × 2000 px.",
  });

  function update(field: keyof CommissionDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit(draft);
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="create-modal" role="dialog" aria-modal="true" aria-labelledby="create-commission-title">
        <div className="modal-header"><div><span className="section-kicker">NEW COMMISSION / IMMUTABLE TERMS</span><h2 id="create-commission-title">Fund a protected milestone.</h2><p>Lock the brief, recipient, amount, and review boundaries before a file exists.</p></div><button className="icon-button" onClick={onClose} aria-label="Close new commission"><X size={17} /></button></div>
        <form onSubmit={submit} className="commission-form">
          <label className="field"><span>Commission name</span><input value={draft.title} onChange={(event) => update("title", event.target.value)} required maxLength={120} /><small>Visible label only; the brief hash is the canonical content commitment.</small></label>
          <div className="form-row"><label className="field"><span>Creator account</span><input value={draft.creatorId} onChange={(event) => update("creatorId", event.target.value)} pattern="^(([a-z0-9]+[\-_])*[a-z0-9]+\.)*([a-z0-9]+[\-_])*[a-z0-9]+$" required /><small>Fixed NEAR account that can submit and receive.</small></label><label className="field amount-field"><span>Principal <em>NEAR</em></span><input inputMode="decimal" value={draft.amountNear} onChange={(event) => update("amountNear", event.target.value)} pattern="^\d+(\.\d+)?$" required /><small>Exact yoctoNEAR conversion; no floating point.</small></label></div>
          <label className="field"><span>Canonical creative brief</span><textarea value={draft.brief} onChange={(event) => update("brief", event.target.value)} rows={6} minLength={20} maxLength={4000} required /><small>Normalized UTF-8 bytes are hashed before funding. Storage reserve: 0.02 NEAR.</small></label>
          <div className="modal-policy"><ShieldCheck size={16} /><span><strong>{liveConfigured ? "NEAR testnet transaction" : "Simulation record"}</strong>{liveConfigured ? " Wallet approval funds the contract; finalized state replaces browser state." : " No funds move. Set VITE_NEAR_CONTRACT_ID to enable the live path."}</span></div>
          <div className="modal-actions"><button type="button" className="button button-quiet" onClick={onClose}>Cancel</button><button type="submit" className="button button-primary" disabled={busy}>{busy ? <RefreshCw className="spin" size={15} /> : <WalletCards size={15} />}{busy ? "Waiting for wallet…" : liveConfigured ? "Fund on NEAR testnet" : "Create in simulation"}<ArrowUpRight size={14} /></button></div>
        </form>
      </section>
    </div>
  );
}

interface OverviewProps {
  commission: Commission;
  nextAction: { eyebrow: string; title: string; body: string; button: string; target: ViewId };
  onNavigate: (view: ViewId) => void;
  onRelease: () => void;
  onRefund: () => void;
  onSubmitReplacement: () => void;
  onReset: () => void;
  onNew: () => void;
  liveConfigured: boolean;
}

function OverviewView({
  commission,
  nextAction,
  onNavigate,
  onRelease,
  onRefund,
  onSubmitReplacement,
  onReset,
  onNew,
  liveConfigured,
}: OverviewProps) {
  const isApproved = commission.status === "APPROVED";
  const isSubmitted = commission.status === "SUBMITTED";
  return (
    <>
      <PageHeader
        kicker="CREATIVE PAYMENT CONTROL"
        title="Approve the work. Bind the payment."
        description="A single commitment connects the brief, the exact delivery bytes, and the only account allowed to receive the milestone."
        action={<div className="header-actions"><button className="button button-primary" onClick={onNew}><WalletCards size={15} /> New commission</button><button className="button button-quiet" onClick={onReset}><RotateCcw size={15} /> Reset demo</button></div>}
      />

      <div className="trust-strip">
        <div className="trust-strip-icon"><ShieldCheck size={18} /></div>
        <div><strong>Human approval is the authority.</strong><span>Rules-based review can explain the brief. It cannot sign, redirect, or release funds.</span></div>
        <span className="trust-strip-tag">POLICY-BOUND</span>
      </div>

      <section className="commission-hero card">
        <div className="hero-heading-row">
          <div className="hero-id"><span className="section-kicker">COMMISSION / {commission.id}</span><StatusPill status={commission.status} /></div>
          <span className="lock-indicator"><LockKeyhole size={14} /> Terms locked</span>
        </div>
        <div className="hero-main-row">
          <div><h2>{commission.title}</h2><p>One milestone · native NEAR principal · {liveConfigured ? `${nearRuntime.network} contract state` : "simulation ledger"}</p></div>
          <div className="amount-block"><span>Escrow principal</span><strong>{commission.amountNear} <small>NEAR</small></strong><em>≈ locked at funding</em></div>
        </div>
        <div className="hero-details-grid">
          <DetailItem icon={<UserRound size={15} />} label="Client" value={commission.clientId} />
          <DetailItem icon={<Fingerprint size={15} />} label="Fixed recipient" value={commission.creatorId} verified />
          <DetailItem icon={<Hash size={15} />} label="Brief commitment" value={shortHash(commission.briefHash, 9)} mono />
          <DetailItem icon={<Clock3 size={15} />} label="Review boundary" value={commission.reviewUntil} />
        </div>
        <Stepper status={commission.status} />
      </section>

      <div className="overview-grid">
        <section className="next-action-card card">
          <div className="next-action-top"><IconBadge tone={commission.status === "PAID" ? "green" : "teal"}><Zap size={16} /></IconBadge><span>{nextAction.eyebrow}</span></div>
          <h3>{nextAction.title}</h3>
          <p>{nextAction.body}</p>
          <div className="next-action-footer">
            <button
              className="button button-primary"
              onClick={() => {
                if (isApproved) onRelease();
                else if (commission.status === "FUNDED") onSubmitReplacement();
                else onNavigate(nextAction.target);
              }}
              disabled={commission.status === "REFUNDED"}
            >
              {nextAction.button} <ArrowUpRight size={15} />
            </button>
            <span className="button-note"><ShieldCheck size={13} /> guarded by contract rules</span>
          </div>
        </section>

        <section className="mini-stats card">
          <div className="mini-stat"><span>Committed file</span><strong>{commission.currentDelivery ? `v${commission.currentDelivery.version}` : "—"}</strong><em>{commission.currentDelivery ? shortHash(commission.currentDelivery.hash, 5) : "No delivery yet"}</em></div>
          <div className="mini-stat"><span>Approval</span><strong>{commission.approvedDelivery ? "Signed" : "Pending"}</strong><em>{commission.approvedDelivery ? `v${commission.approvedDelivery.version} frozen` : "Client action required"}</em></div>
           <div className="mini-stat"><span>Settlement</span><strong>{commission.payout ? "Confirmed" : commission.status.includes("PENDING") ? "Pending" : "Unreleased"}</strong><em>{commission.payout ? commission.payout.recipient : commission.status.includes("PENDING") ? "Awaiting callback" : "No transfer started"}</em></div>
        </section>
      </div>

      <div className="lower-grid">
        <section className="card activity-card">
          <CardHeader icon={<History size={16} />} title="Commitment timeline" action={<button className="text-button" onClick={() => onNavigate("evidence")}>View evidence <ArrowUpRight size={13} /></button>} />
          <ActivityTimeline events={commission.activity.slice(0, 4)} />
        </section>
        <section className="card creator-card">
          <CardHeader icon={<FileUp size={16} />} title="Creator workspace" action={<span className="small-label">SIGNED BY {commission.creatorId}</span>} />
          <div className="creator-content">
            <div className="creator-avatar">KS</div>
            <div><strong>Kanso Studio</strong><p>Only this account can submit or replace a delivery before approval.</p></div>
          </div>
          <div className="creator-actions">
            <button className="button button-secondary" onClick={onSubmitReplacement} disabled={!isSubmitted && commission.status !== "FUNDED"}>Submit version {commission.currentDelivery ? 2 : 1} <FileUp size={14} /></button>
            <button className="button button-quiet danger-button" onClick={onRefund} disabled={!isSubmitted}>Return principal</button>
          </div>
        </section>
      </div>

      <div className="disclosure"><CircleAlert size={15} /><span>{liveConfigured ? `NEAR ${nearRuntime.network} mode: this view is backed by ${nearRuntime.contractId}. Refresh after every wallet action to read finalized contract state.` : "Simulation mode: balances, approvals, and evidence are local state. Set VITE_NEAR_CONTRACT_ID after deployment to switch this workflow to NEAR testnet."}</span></div>
    </>
  );
}

interface ReviewProps {
  commission: Commission;
  currentDelivery: DeliveryCommitment | null;
  reviewedFile: ReviewedFile | null;
  reviewMatch: boolean;
  reviewVerified: boolean;
  isHashing: boolean;
  onVerifyDemo: () => void;
  onSelectFile: (file: File | undefined) => void;
  onApprove: () => void;
  onSubmitReplacement: () => void;
  liveConfigured: boolean;
}

function ReviewView({
  commission,
  currentDelivery,
  reviewedFile,
  reviewMatch,
  reviewVerified,
  isHashing,
  onVerifyDemo,
  onSelectFile,
  onApprove,
  onSubmitReplacement,
  liveConfigured,
}: ReviewProps) {
  const approved = commission.status === "APPROVED" || commission.status === "PAID";
  const canCommitSelected = commission.status === "FUNDED" && reviewedFile?.source === "local file";
  return (
    <>
      <PageHeader
        kicker="DELIVERY REVIEW / HUMAN SIGN-OFF"
        title="Verify the bytes before you approve."
        description="The contract never sees a file. Your browser hashes the exact bytes you choose, then binds approval to that digest."
        action={
          <label className="button button-secondary upload-button">
            <FileUp size={15} /> Choose local file
            <input type="file" onChange={(event) => onSelectFile(event.target.files?.[0])} />
          </label>
        }
      />

      <div className="review-banner">
        <div className="review-banner-icon"><Fingerprint size={19} /></div>
        <div><strong>Approval target: {currentDelivery ? `version ${currentDelivery.version}` : "none"}</strong><span>One signature binds this delivery version and hash to {commission.amountNear} NEAR for {commission.creatorId}.</span></div>
        <div className="review-banner-right"><span>Review by</span><strong>{commission.reviewUntil}</strong></div>
      </div>

      <div className="review-layout">
        <section className="preview-column">
          <div className="preview-card card">
            <div className="preview-card-top"><span className="section-kicker">SELECTED DELIVERY</span><span className="preview-source"><span className="source-dot" /> {reviewedFile?.source ?? "No file"}</span></div>
            <div className="poster-preview">
              <div className="poster-grain" />
              <div className="poster-topline"><span>KC / 24</span><span>WINTER MENU</span></div>
              <div className="poster-title"><span>WINTER,</span><strong>POURED<br />SLOWLY</strong></div>
              <div className="poster-circle"><div className="poster-cup" /></div>
              <div className="poster-footer"><span>KANSO COFFEE</span><span>OPENING<br /><strong>06.12</strong></span></div>
            </div>
            <div className="preview-file-row">
              <div className="file-icon"><FileCode2 size={18} /></div>
              <div className="file-copy"><strong>{reviewedFile?.fileName ?? "Select a delivery file"}</strong><span>{reviewedFile ? `${reviewedFile.mimeType} · ${formatBytes(reviewedFile.sizeBytes)}` : "No bytes selected"}</span></div>
              {reviewedFile && reviewMatch && reviewVerified ? <span className="verified-label"><BadgeCheck size={14} /> Match</span> : <span className="pending-label">Needs check</span>}
            </div>
          </div>

          <div className="brief-card card">
            <CardHeader icon={<FileText size={16} />} title="Locked brief" action={<span className="small-label">CANONICAL TEXT</span>} />
            <p className="brief-text">{commission.brief}</p>
            <HashValue value={commission.briefHash} label="BRIEF SHA-256" />
          </div>
        </section>

        <section className="commitment-column">
          <div className="card commitment-card">
            <div className="commitment-card-heading"><div><span className="section-kicker">COMMITMENT CHECK</span><h3>Does this file match?</h3></div>{reviewVerified && reviewMatch ? <span className="check-seal"><CircleCheck size={16} /> Verified</span> : <span className="check-seal pending"><CircleDashed size={16} /> Unverified</span>}</div>
            <div className="check-list">
              <CheckRow label="Delivery version" value={currentDelivery ? `Version ${currentDelivery.version}` : "Missing"} state={Boolean(currentDelivery)} />
              <CheckRow label="Bytes on this device" value={reviewedFile ? formatBytes(reviewedFile.sizeBytes) : "Select a file"} state={Boolean(reviewedFile)} />
              <CheckRow label="SHA-256 commitment" value={reviewedFile ? shortHash(reviewedFile.hash, 7) : "Not calculated"} state={Boolean(reviewedFile && reviewMatch)} warning={Boolean(reviewedFile && !reviewMatch)} />
              <CheckRow label="Fixed payout recipient" value={commission.creatorId} state />
              <CheckRow label="Human sign-off" value={approved ? "Already approved" : "Required"} state={approved} warning={approved} />
            </div>
            {reviewedFile && (
              <div className={`hash-inspection ${reviewMatch ? "match" : "mismatch"}`}>
                <div className="hash-inspection-heading"><span>{reviewMatch ? <CircleCheck size={15} /> : <CircleAlert size={15} />} {reviewMatch ? "Exact bytes match" : "Commitment mismatch"}</span><span>{reviewedFile.source}</span></div>
                <code>{reviewedFile.hash}</code>
                {!reviewMatch && currentDelivery && <p>Expected {shortHash(currentDelivery.hash, 11)} from the current submission. Approval is disabled.</p>}
              </div>
            )}
            <div className="review-actions">
              {!liveConfigured && <button className="button button-secondary full-button" onClick={onVerifyDemo} disabled={isHashing || approved}>
                {isHashing ? <RefreshCw className="spin" size={15} /> : <Fingerprint size={15} />} {isHashing ? "Hashing bytes…" : "Verify demo fixture bytes"}
              </button>}
              {canCommitSelected && <button className="button button-secondary full-button" onClick={onSubmitReplacement} disabled={isHashing}>
                <LockKeyhole size={15} /> Commit selected file as delivery v1
              </button>}
              <button className="button button-primary full-button" onClick={onApprove} disabled={!currentDelivery || !reviewVerified || !reviewMatch || approved || commission.status !== "SUBMITTED"}>
                <LockKeyhole size={15} /> {approved ? "Approval frozen" : "Approve this exact version"}
              </button>
              <span className="action-caption"><ShieldCheck size={13} /> A model or invoice can never click this button for you.</span>
            </div>
          </div>

          <div className="card rules-card">
            <CardHeader icon={<Sparkles size={16} />} title="Rules-based review" action={<span className="mode-label">NO API KEY</span>} />
            <p>Deterministic checks only. This assistant reports observable facts and never evaluates subjective quality or grants payment authority.</p>
            <div className="rules-pills"><span><Check size={12} /> PNG delivery</span><span><Check size={12} /> 4:5 brief target</span><span><Check size={12} /> Version bound</span></div>
          </div>

          <div className="card replacement-card">
            <div className="replacement-icon"><RefreshCw size={16} /></div>
            <div><strong>Need a new version?</strong><p>Before approval, the creator can replace the file. Any stale browser review must fail closed.</p></div>
            <button className="text-button" onClick={onSubmitReplacement} disabled={approved || commission.status !== "SUBMITTED"}>Submit v2 <ArrowUpRight size={13} /></button>
          </div>
        </section>
      </div>
    </>
  );
}

interface AttackProps {
  results: Record<string, AttackResult>;
  completed: number;
  blocked: number;
  onRun: (id: string) => void;
  onRunAll: () => void;
  liveConfigured: boolean;
}

function AttackLabView({ results, completed, blocked, onRun, onRunAll, liveConfigured }: AttackProps) {
  return (
    <>
      <PageHeader
        kicker="ADVERSARIAL VERIFICATION"
        title="Prove the guardrails."
        description="A beautiful approval screen is not a security property. Attack Lab turns the commitments into named, repeatable checks."
        action={<button className="button button-primary" onClick={onRunAll}><Play size={14} fill="currentColor" /> Run all checks</button>}
      />
      <div className="attack-summary-grid">
        <div className="attack-summary card"><IconBadge tone="teal"><ShieldCheck size={17} /></IconBadge><div><span>Checks run</span><strong>{completed}<small> / {ATTACK_SCENARIOS.length}</small></strong></div></div>
        <div className="attack-summary card"><IconBadge tone="green"><BadgeCheck size={17} /></IconBadge><div><span>Blocked</span><strong>{blocked}<small> attacks</small></strong></div></div>
        <div className="attack-summary card"><IconBadge tone="purple"><Code2 size={17} /></IconBadge><div><span>Execution layer</span><strong>Local<small> simulation</small></strong></div></div>
      </div>
      <div className="attack-lab-layout">
        <section className="attack-list card">
          <div className="attack-list-heading"><div><span className="section-kicker">SCENARIOS / 06</span><h2>Known failure modes</h2></div><span className="small-label">EXPECTED: BLOCKED</span></div>
          <div className="scenario-list">
            {ATTACK_SCENARIOS.map((scenario) => {
              const result = results[scenario.id];
              return (
                <div className={`scenario-row ${result ? "has-result" : ""}`} key={scenario.id}>
                  <div className={`scenario-number ${result?.actual === "blocked" ? "passed" : ""}`}>{result?.actual === "blocked" ? <Check size={14} strokeWidth={3} /> : scenario.id}</div>
                  <div className="scenario-copy"><div className="scenario-title-line"><strong>{scenario.title}</strong><span className={`category-tag category-${scenario.category.replace(" ", "-")}`}>{scenario.category}</span></div><p>{scenario.description}</p><span className="expected-line"><span>Expected</span>{scenario.expected}</span>{result && <div className="result-line"><span className="result-blocked">BLOCKED</span><span>{result.layer}</span><code>{result.evidence}</code></div>}</div>
                  <button className={`button ${result ? "button-quiet" : "button-secondary"} scenario-action`} onClick={() => onRun(scenario.id)}>{result ? <RefreshCw size={14} /> : <Play size={13} fill="currentColor" />} {result ? "Replay" : "Run"}</button>
                </div>
              );
            })}
          </div>
        </section>
        <aside className="attack-aside">
          <div className="card invariant-card"><div className="invariant-orbit"><div className="orbit-core"><LockKeyhole size={20} /></div><span className="orbit-dot orbit-dot-1" /><span className="orbit-dot orbit-dot-2" /><span className="orbit-dot orbit-dot-3" /></div><span className="section-kicker">THE INVARIANT</span><h3>AI can advise.<br /><em>Only the client can approve.</em></h3><p>Release accepts no recipient or amount from a prompt, invoice, or browser role toggle. It reads immutable terms.</p><div className="invariant-foot"><ShieldCheck size={14} /> enforced below the UI</div></div>
           <div className="card layers-card"><CardHeader icon={<LayersIcon />} title="Evidence layers" /><div className="layer-row"><span className="layer-dot simulation" /><div><strong>SIMULATION</strong><p>Pure domain rules and local state</p></div></div><div className="layer-row"><span className="layer-dot policy" /><div><strong>LOCAL POLICY</strong><p>Adapter rejects untrusted invoice data</p></div></div><div className="layer-row muted"><span className="layer-dot sandbox" /><div><strong>{liveConfigured ? "NEAR CONTRACT" : "SANDBOX CONTRACT"}</strong><p>{liveConfigured ? "Commission state is read from configured testnet" : "Rust contract covered by near-workspaces tests"}</p></div></div></div>
        </aside>
      </div>
      <div className="disclosure"><CircleAlert size={15} /><span>Attack Lab results are labeled honestly. A blocked simulation is evidence of the local invariant, not proof of a deployed contract transaction.</span></div>
    </>
  );
}

function LayersIcon() {
  return <Blocks size={16} />;
}

interface EvidenceProps {
  commission: Commission;
  attackResults: Record<string, AttackResult>;
  onDownload: () => void;
  onCopy: () => void;
  liveConfigured: boolean;
}

function EvidenceView({ commission, attackResults, onDownload, onCopy, liveConfigured }: EvidenceProps) {
  const hasTestnetReceipt = commission.payout?.mode === "testnet" && Boolean(commission.payout.transactionHash);
  return (
    <>
      <PageHeader
        kicker={liveConfigured ? `AUDIT TRAIL / ${nearRuntime.network.toUpperCase()} STATE` : "AUDIT TRAIL / LOCAL LEDGER"}
        title="Evidence over theatre."
        description={liveConfigured ? "Canonical commission state is read from NEAR. Transaction links are shown only when Wallet Selector returns a real finalized receipt." : "Every visible status on this screen comes from the current local state. Export it, inspect it, and know exactly what still needs NEAR sandbox proof."}
        action={<button className="button button-secondary" onClick={onDownload}><Download size={15} /> Download JSON</button>}
      />
      <div className="evidence-grid">
        <section className="card canonical-card"><CardHeader icon={<Fingerprint size={16} />} title="Canonical commission state" action={<span className={`network-pill small-network ${liveConfigured ? "network-live" : ""}`}><span className="network-dot" /> {liveConfigured ? nearRuntime.network.toUpperCase() : "LOCAL"}</span>} /><div className="canonical-status"><span className={`large-status-dot ${commission.status.toLowerCase()}`} /><div><span>Current state</span><strong>{statusLabels[commission.status]}</strong></div><span className="canonical-id mono">{commission.id}</span></div><div className="canonical-grid"><DetailItem label="Contract model" value={commission.contractId} icon={<Blocks size={14} />} mono /><DetailItem label="Principal" value={`${commission.amountNear} NEAR`} icon={<Banknote size={14} />} /><DetailItem label="Locked recipient" value={commission.creatorId} icon={<UserRound size={14} />} verified /><DetailItem label="Payout evidence" value={<ReceiptEvidence payout={commission.payout} />} icon={<FileCode2 size={14} />} mono /></div><div className="commitment-lines"><div><span>Brief hash</span><HashValue value={commission.briefHash} /></div>{commission.currentDelivery && <div><span>Delivery v{commission.currentDelivery.version}</span><HashValue value={commission.currentDelivery.hash} /></div>}</div>{hasTestnetReceipt && <div className="receipt-banner"><BadgeCheck size={15} /><span><strong>Finalized testnet receipt</strong><a href={commission.payout?.explorerUrl} target="_blank" rel="noreferrer">Open on NEARBlocks <ExternalLink size={12} /></a></span></div>}</section>
         <section className="card export-card"><div className="export-icon"><Download size={18} /></div><span className="section-kicker">REPRODUCIBLE REPORT</span><h3>Take the evidence with you.</h3><p>{liveConfigured ? "The downloaded report includes the configured network, contract ID, receipt evidence, and local Attack Lab results." : "The downloaded report includes execution layers, before/after states, and the explicit simulation limitation."}</p><button className="button button-primary full-button" onClick={onDownload}>Export {liveConfigured ? "chain" : "attack"} report <Download size={14} /></button><button className="text-button centered-button" onClick={onCopy}><Copy size={13} /> Copy report context</button></section>
      </div>
      <section className="card full-timeline-card"><CardHeader icon={<History size={16} />} title="State transition timeline" action={<span className="small-label">{commission.activity.length} EVENTS</span>} /><ActivityTimeline events={commission.activity} /></section>
      <section className="card evidence-results-card"><CardHeader icon={<ShieldCheck size={16} />} title="Attack evidence" action={<span className="small-label">{Object.keys(attackResults).length} RECORDED</span>} />{Object.keys(attackResults).length === 0 ? <EmptyEvidence /> : <div className="evidence-result-list">{Object.values(attackResults).map((result) => <div className="evidence-result-row" key={result.scenarioId}><span className="evidence-check"><Check size={13} /></span><strong>{result.scenarioId}</strong><span className="result-blocked">BLOCKED</span><span>{result.layer}</span><code>{result.evidence}</code></div>)}</div>}</section>
       <div className="limitation-panel"><ShieldAlert size={17} /><div><strong>What this proves — and what it does not</strong><p>{liveConfigured ? "This view proves the configured contract state and any linked finalized receipt. Attack Lab remains a local adversarial model; it is not a replacement for a deployed contract transaction." : "This build proves the commitment rules, mismatch detection, fixed-recipient policy, and replay boundaries in a deterministic local demo. It does not yet prove a NEAR receipt, wallet signature, asynchronous callback, or testnet balance change."}</p></div></div>
    </>
  );
}

function EmptyEvidence() {
  return <div className="empty-evidence"><CircleDashed size={19} /><span>Run Attack Lab checks to populate this ledger.</span></div>;
}

function ReceiptEvidence({ payout }: { payout: Commission["payout"] }) {
  if (!payout) return <>Not settled</>;
  if (payout.mode === "testnet" && payout.transactionHash && payout.explorerUrl) {
    return <a className="receipt-link" href={payout.explorerUrl} target="_blank" rel="noreferrer">{shortHash(payout.transactionHash, 8)} <ExternalLink size={11} /></a>;
  }
  return <>{payout.simulationId ?? "Settled"}</>;
}

function PageHeader({ kicker, title, description, action }: { kicker: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="page-header"><div><div className="section-kicker">{kicker}</div><h1>{title}</h1><p>{description}</p></div>{action && <div className="page-header-action">{action}</div>}</div>;
}

function DetailItem({ icon, label, value, mono, verified }: { icon?: React.ReactNode; label: string; value: React.ReactNode; mono?: boolean; verified?: boolean }) {
  return <div className="detail-item">{icon && <span className="detail-icon">{icon}</span>}<div><span>{label}</span><strong className={mono ? "mono" : ""}>{value} {verified && <BadgeCheck className="inline-check" size={13} />}</strong></div></div>;
}

function CardHeader({ icon, title, action }: { icon: React.ReactNode; title: string; action?: React.ReactNode }) {
  return <div className="card-header"><div><span className="card-header-icon">{icon}</span><strong>{title}</strong></div>{action}</div>;
}

function ActivityTimeline({ events }: { events: ActivityEvent[] }) {
  return <div className="timeline">{events.map((event, index) => <div className="timeline-item" key={event.id}><div className={`timeline-marker timeline-${event.tone}`}>{event.tone === "success" ? <Check size={12} strokeWidth={3} /> : event.tone === "warning" ? <CircleAlert size={12} /> : <span />}</div><div className="timeline-copy"><div><strong>{event.label}</strong><time>{event.timestamp}</time></div><p>{event.detail}</p>{event.explorerUrl && event.transactionHash && <a className="timeline-receipt" href={event.explorerUrl} target="_blank" rel="noreferrer">Open receipt <ExternalLink size={11} /></a>}</div>{index < events.length - 1 && <div className="timeline-rail" />}</div>)}</div>;
}

function CheckRow({ label, value, state, warning }: { label: string; value: string; state: boolean; warning?: boolean }) {
  return <div className="check-row"><span className={`check-row-icon ${warning ? "warning" : state ? "pass" : "pending"}`}>{warning ? <CircleAlert size={13} /> : state ? <Check size={13} strokeWidth={3} /> : <CircleDashed size={13} />}</span><span>{label}</span><strong className={warning ? "warning-text" : ""}>{value}</strong></div>;
}

export default App;
