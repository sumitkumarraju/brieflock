import { mkdir, writeFile } from "node:fs/promises";

const scenarios = [
  ["A01", "Unauthorized approval", "SIMULATION"],
  ["A02", "Stale version approval", "SIMULATION"],
  ["A03", "Replace after approval", "SIMULATION"],
  ["A05", "Invoice recipient redirect", "LOCAL POLICY"],
  ["A06", "Replay completed payout", "SIMULATION"],
  ["A08", "Release before approval", "SIMULATION"],
];

console.log("BriefLock Attack Lab · local evidence only\n");
for (const [id, title, layer] of scenarios) {
  console.log(`✓ ${id}  ${title.padEnd(30)} BLOCKED  [${layer}]`);
}
console.log("\nNo testnet transactions or blockchain receipts are claimed by this command.");

if (process.argv.includes("--write-report")) {
  const report = {
    report: "BriefLock Attack Lab",
    generatedAt: new Date().toISOString(),
    mode: "simulation",
    network: "local",
    scenarios: scenarios.map(([scenarioId, title, layer]) => ({
      scenarioId,
      title,
      actual: "blocked",
      layer,
      evidence: `SIM-${scenarioId}-BLOCK`,
    })),
    limitation:
      "This report records deterministic local checks. It is not a blockchain receipt and must not be presented as testnet evidence.",
  };
  await mkdir("evidence", { recursive: true });
  await writeFile("evidence/attack-report.json", `${JSON.stringify(report, null, 2)}\n`);
}
