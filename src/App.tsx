import { useMemo, useState } from "react";
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
import { formatBytes, sha256Hex, shortHash } from "./lib/hash";
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
  PAID: "Paid",
  REFUNDED: "Refunded",
};

const statusClasses: Record<CommissionStatus, string> = {
  FUNDED: "status-neutral",
  SUBMITTED: "status-amber",
  APPROVED: "status-teal",
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
  const currentIndex = status === "REFUNDED" ? 4 : order.indexOf(status);

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

  const currentDelivery = commission.currentDelivery;
  const reviewMatch = Boolean(
    reviewedFile && currentDelivery && reviewedFile.hash === currentDelivery.hash,
  );
  const canApproveCurrent = Boolean(
    currentDelivery && reviewVerified && reviewMatch && commission.status === "SUBMITTED",
  );

  const completedAttacks = Object.keys(attackResults).length;
  const blockedAttacks = Object.values(attackResults).filter((result) => result.actual === "blocked").length;

  const nextAction = useMemo(() => {
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
    if (commission.status === "PAID") {
      return {
        eyebrow: "Settlement complete",
        title: "Payment confirmed in simulation",
        body: "Inspect the evidence ledger for the full approval and payout chain.",
        button: "View evidence",
        target: "evidence" as ViewId,
      };
    }
    return {
      eyebrow: "Terminal state",
      title: "Principal returned in simulation",
      body: "This commission cannot be approved or paid after refund.",
      button: "View evidence",
      target: "evidence" as ViewId,
    };
  }, [commission.status, currentDelivery]);

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
      setReviewedFile({
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        hash,
        source: "local file",
      });
      setReviewVerified(false);
      showNotice("File hashed on this device. Verify the commitment before approving.", "warning");
    } catch {
      showNotice("The file could not be hashed in this browser.", "error");
    } finally {
      setIsHashing(false);
    }
  }

  function submitReplacement() {
    const check = canReplaceDelivery(commission, commission.creatorId);
    if (!check.allowed) {
      showNotice(check.reason, "error");
      return;
    }
    const delivery = createDelivery(2);
    setCommission((current) =>
      addActivity(
        { ...current, status: "SUBMITTED", currentDelivery: delivery, approvedDelivery: null, payout: null },
        newEvent(
          "submitted-2",
          "Delivery v2 submitted",
          `${delivery.fileName} · previous review is now stale`,
          "warning",
        ),
      ),
    );
    setReviewVerified(false);
    showNotice("Version 2 submitted. Any approval of version 1 must now fail.", "warning");
  }

  function approveDelivery() {
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

  function releasePayout() {
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
    const payout = {
      amountNear: commission.amountNear,
      recipient: commission.creatorId,
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

  function refundCommission() {
    const check = canRefund(commission, commission.clientId);
    if (!check.allowed) {
      showNotice(check.reason, "error");
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
      mode: "simulation",
      network: "local",
      commissionId: commission.id,
      status: commission.status,
      scenarios: Object.values(attackResults),
      limitation:
        "Simulation evidence is not a blockchain receipt. Compile and run the NEAR sandbox contract before claiming on-chain execution.",
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "brieflock-attack-report.json";
    anchor.click();
    URL.revokeObjectURL(url);
    showNotice("Downloaded the current simulation evidence report.");
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
          />
        );
      case "evidence":
        return (
          <EvidenceView
            commission={commission}
            attackResults={attackResults}
            onDownload={downloadEvidence}
            onCopy={() => showNotice("Evidence is generated from the current local state.", "warning")}
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
          <div className="protocol-item"><span className="protocol-status online" />Local simulation</div>
          <div className="protocol-item"><Blocks size={14} />NEAR-compatible model</div>
          <div className="protocol-item"><KeyRound size={14} />No wallet connected</div>
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
            <span className="network-pill"><span className="network-dot" /> SIMULATION <span className="network-divider" /> LOCAL</span>
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
          {renderView()}
        </div>
      </main>
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
}

function OverviewView({
  commission,
  nextAction,
  onNavigate,
  onRelease,
  onRefund,
  onSubmitReplacement,
  onReset,
}: OverviewProps) {
  const isApproved = commission.status === "APPROVED";
  const isSubmitted = commission.status === "SUBMITTED";
  return (
    <>
      <PageHeader
        kicker="CREATIVE PAYMENT CONTROL"
        title="Approve the work. Bind the payment."
        description="A single commitment connects the brief, the exact delivery bytes, and the only account allowed to receive the milestone."
        action={<button className="button button-quiet" onClick={onReset}><RotateCcw size={15} /> Reset demo</button>}
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
          <div><h2>{commission.title}</h2><p>One milestone · native NEAR principal · simulation ledger</p></div>
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
          <div className="mini-stat"><span>Settlement</span><strong>{commission.payout ? "Confirmed" : "Unreleased"}</strong><em>{commission.payout ? commission.payout.recipient : "No transfer started"}</em></div>
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
            <button className="button button-secondary" onClick={onSubmitReplacement} disabled={!isSubmitted}>Submit version 2 <FileUp size={14} /></button>
            <button className="button button-quiet danger-button" onClick={onRefund} disabled={!isSubmitted}>Return principal</button>
          </div>
        </section>
      </div>

      <div className="disclosure"><CircleAlert size={15} /><span>Simulation mode: balances, approvals, and evidence are local state. The next integration replaces these adapters with a compiled NEAR contract and finalized receipts.</span></div>
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
}: ReviewProps) {
  const approved = commission.status === "APPROVED" || commission.status === "PAID";
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
              <button className="button button-secondary full-button" onClick={onVerifyDemo} disabled={isHashing || approved}>
                {isHashing ? <RefreshCw className="spin" size={15} /> : <Fingerprint size={15} />} {isHashing ? "Hashing bytes…" : "Verify demo fixture bytes"}
              </button>
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
}

function AttackLabView({ results, completed, blocked, onRun, onRunAll }: AttackProps) {
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
          <div className="card layers-card"><CardHeader icon={<LayersIcon />} title="Evidence layers" /><div className="layer-row"><span className="layer-dot simulation" /><div><strong>SIMULATION</strong><p>Pure domain rules and local state</p></div></div><div className="layer-row"><span className="layer-dot policy" /><div><strong>LOCAL POLICY</strong><p>Adapter rejects untrusted invoice data</p></div></div><div className="layer-row muted"><span className="layer-dot sandbox" /><div><strong>SANDBOX CONTRACT</strong><p>Next integration milestone</p></div></div></div>
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
}

function EvidenceView({ commission, attackResults, onDownload, onCopy }: EvidenceProps) {
  return (
    <>
      <PageHeader
        kicker="AUDIT TRAIL / LOCAL LEDGER"
        title="Evidence over theatre."
        description="Every visible status on this screen comes from the current local state. Export it, inspect it, and know exactly what still needs NEAR sandbox proof."
        action={<button className="button button-secondary" onClick={onDownload}><Download size={15} /> Download JSON</button>}
      />
      <div className="evidence-grid">
        <section className="card canonical-card"><CardHeader icon={<Fingerprint size={16} />} title="Canonical commission state" action={<span className="network-pill small-network"><span className="network-dot" /> LOCAL</span>} /><div className="canonical-status"><span className={`large-status-dot ${commission.status.toLowerCase()}`} /><div><span>Current state</span><strong>{statusLabels[commission.status]}</strong></div><span className="canonical-id mono">{commission.id}</span></div><div className="canonical-grid"><DetailItem label="Contract model" value={commission.contractId} icon={<Blocks size={14} />} mono /><DetailItem label="Principal" value={`${commission.amountNear} NEAR`} icon={<Banknote size={14} />} /><DetailItem label="Locked recipient" value={commission.creatorId} icon={<UserRound size={14} />} verified /><DetailItem label="Payout evidence" value={commission.payout?.simulationId ?? "Not settled"} icon={<FileCode2 size={14} />} mono /></div><div className="commitment-lines"><div><span>Brief hash</span><HashValue value={commission.briefHash} /></div>{commission.currentDelivery && <div><span>Delivery v{commission.currentDelivery.version}</span><HashValue value={commission.currentDelivery.hash} /></div>}</div></section>
        <section className="card export-card"><div className="export-icon"><Download size={18} /></div><span className="section-kicker">REPRODUCIBLE REPORT</span><h3>Take the evidence with you.</h3><p>The downloaded report includes execution layers, before/after states, and the explicit simulation limitation.</p><button className="button button-primary full-button" onClick={onDownload}>Export attack report <Download size={14} /></button><button className="text-button centered-button" onClick={onCopy}><Copy size={13} /> Copy report context</button></section>
      </div>
      <section className="card full-timeline-card"><CardHeader icon={<History size={16} />} title="State transition timeline" action={<span className="small-label">{commission.activity.length} EVENTS</span>} /><ActivityTimeline events={commission.activity} /></section>
      <section className="card evidence-results-card"><CardHeader icon={<ShieldCheck size={16} />} title="Attack evidence" action={<span className="small-label">{Object.keys(attackResults).length} RECORDED</span>} />{Object.keys(attackResults).length === 0 ? <EmptyEvidence /> : <div className="evidence-result-list">{Object.values(attackResults).map((result) => <div className="evidence-result-row" key={result.scenarioId}><span className="evidence-check"><Check size={13} /></span><strong>{result.scenarioId}</strong><span className="result-blocked">BLOCKED</span><span>{result.layer}</span><code>{result.evidence}</code></div>)}</div>}</section>
      <div className="limitation-panel"><ShieldAlert size={17} /><div><strong>What this proves — and what it does not</strong><p>This build proves the commitment rules, mismatch detection, fixed-recipient policy, and replay boundaries in a deterministic local demo. It does not yet prove a NEAR receipt, wallet signature, asynchronous callback, or testnet balance change.</p></div></div>
    </>
  );
}

function EmptyEvidence() {
  return <div className="empty-evidence"><CircleDashed size={19} /><span>Run Attack Lab checks to populate this ledger.</span></div>;
}

function PageHeader({ kicker, title, description, action }: { kicker: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="page-header"><div><div className="section-kicker">{kicker}</div><h1>{title}</h1><p>{description}</p></div>{action && <div className="page-header-action">{action}</div>}</div>;
}

function DetailItem({ icon, label, value, mono, verified }: { icon?: React.ReactNode; label: string; value: string; mono?: boolean; verified?: boolean }) {
  return <div className="detail-item">{icon && <span className="detail-icon">{icon}</span>}<div><span>{label}</span><strong className={mono ? "mono" : ""}>{value} {verified && <BadgeCheck className="inline-check" size={13} />}</strong></div></div>;
}

function CardHeader({ icon, title, action }: { icon: React.ReactNode; title: string; action?: React.ReactNode }) {
  return <div className="card-header"><div><span className="card-header-icon">{icon}</span><strong>{title}</strong></div>{action}</div>;
}

function ActivityTimeline({ events }: { events: ActivityEvent[] }) {
  return <div className="timeline">{events.map((event, index) => <div className="timeline-item" key={event.id}><div className={`timeline-marker timeline-${event.tone}`}>{event.tone === "success" ? <Check size={12} strokeWidth={3} /> : event.tone === "warning" ? <CircleAlert size={12} /> : <span />}</div><div className="timeline-copy"><div><strong>{event.label}</strong><time>{event.timestamp}</time></div><p>{event.detail}</p></div>{index < events.length - 1 && <div className="timeline-rail" />}</div>)}</div>;
}

function CheckRow({ label, value, state, warning }: { label: string; value: string; state: boolean; warning?: boolean }) {
  return <div className="check-row"><span className={`check-row-icon ${warning ? "warning" : state ? "pass" : "pending"}`}>{warning ? <CircleAlert size={13} /> : state ? <Check size={13} strokeWidth={3} /> : <CircleDashed size={13} />}</span><span>{label}</span><strong className={warning ? "warning-text" : ""}>{value}</strong></div>;
}

export default App;
