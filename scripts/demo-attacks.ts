import { mkdir, writeFile } from "node:fs/promises";
import { ATTACK_SCENARIOS, runAllAttackScenarios } from "../src/lib/attackLab";
import { createInitialCommission } from "../src/lib/demoState";

const results = runAllAttackScenarios(createInitialCommission());
console.log("BriefLock Attack Lab · local evidence only");
const scenarios = ATTACK_SCENARIOS.map(({ id, title }) => {
  const result = results[id];
  console.log(`${id} ${title.padEnd(30)} ${result.actual.toUpperCase()} [${result.layer}]`);
  return { title, ...result };
});

if (scenarios.some(({ actual }) => actual !== "blocked")) process.exitCode = 1;
if (process.argv.includes("--write-report")) {
  await mkdir("evidence", { recursive: true });
  await writeFile("evidence/attack-report.json", JSON.stringify({
    report: "BriefLock Attack Lab",
    generatedAt: new Date().toISOString(),
    mode: "simulation",
    scenarios,
    limitation: "Local checks only. No NEAR transactions were sent.",
  }, null, 2) + "\n");
}
