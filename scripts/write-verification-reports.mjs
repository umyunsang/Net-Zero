import { createHash, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { access, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { assertFresh, assertSourceBound, assertSourceStable, isIgnoredSourceDirectory, isSourceFile } from "./evidence-lib.mjs";

const sourceTargets = [
  ".env.example",
  "package.json",
  "pnpm-workspace.yaml",
  "pnpm-lock.yaml",
  "tsconfig.base.json",
  "compose.yaml",
  "README.md",
  "apps/api",
  "apps/worker",
  "apps/web",
  "packages/domain",
  "packages/contracts",
  "migrations", "seed", "docs", "scripts"
];
async function collectSources(target) {
  const details = await stat(target);
  if (details.isFile()) return [target];
  const entries = await readdir(target, { withFileTypes: true });
  const nested = await Promise.all(entries
    .filter((entry) => !entry.isDirectory() || !isIgnoredSourceDirectory(entry.name))
    .map((entry) => collectSources(join(target, entry.name))));
  return nested.flat();
}
const sourceFiles = [...new Set((await Promise.all(sourceTargets.map(collectSources))).flat())]
  .filter(isSourceFile)
  .sort();

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) throw new Error("TEST_DATABASE_URL is required for an atomic verification run");

const sha256 = (value) => `sha256:${createHash("sha256").update(value).digest("hex")}`;
const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const hashSources = async (files) => {
  const framed = [];
  for (const path of files) framed.push(`${path}\n${await readFile(path, "utf8")}`);
  return sha256(framed.join("\n"));
};
const runId = randomUUID();
const sourceHashBefore = await hashSources(sourceFiles);
const startedAtMs = Date.now();
const commands = [];

function run(command, args, { expectedStatus = 0, env = {} } = {}) {
  const rendered = [command, ...args].join(" ");
  commands.push(rendered);
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    stdio: "inherit"
  });
  if (result.status !== expectedStatus) {
    throw new Error(`${rendered} exited ${result.status}; expected ${expectedStatus}`);
  }
}

function databaseName(databaseUrl) {
  const name = new URL(databaseUrl).pathname.slice(1);
  if (!/^[a-zA-Z0-9_]+$/.test(name)) throw new Error("TEST_DATABASE_URL must name a simple local test database");
  return name;
}

const testDatabase = databaseName(testDatabaseUrl);
run("docker", ["exec", "net-zero-postgres-1", "dropdb", "--if-exists", "-U", "netzero", testDatabase]);
run("docker", ["exec", "net-zero-postgres-1", "createdb", "-U", "netzero", testDatabase]);

run("pnpm", ["typecheck"]);
run("pnpm", ["build"]);
run("pnpm", ["db:test-from-empty"], { env: { TEST_DATABASE_URL: testDatabaseUrl } });
run("docker", ["exec", "net-zero-postgres-1", "dropdb", "-U", "netzero", testDatabase]);
run("docker", ["exec", "net-zero-postgres-1", "createdb", "-U", "netzero", testDatabase]);
run("pnpm", ["db:migrate"], { env: { DATABASE_URL: testDatabaseUrl } });
run("pnpm", ["db:reset-demo"], { env: {
  DATABASE_URL: testDatabaseUrl,
  NODE_ENV: "test",
  MOCK_DEMO_ENABLED: "true",
  OUTBOUND_INTEGRATIONS: "disabled",
  DATABASE_DATA_SCOPE: "mock_demo",
  OBJECT_STORAGE_DATA_SCOPE: "mock_demo",
} });
run("pnpm", ["test"], { env: { TEST_DATABASE_URL: testDatabaseUrl } });
run("pnpm", ["--filter", "@net-zero/api", "exec", "vitest", "run", "--reporter=json", "--outputFile=test-results/vitest-results.json"], { env: { TEST_DATABASE_URL: testDatabaseUrl } });
run("pnpm", ["--filter", "@net-zero/domain", "exec", "vitest", "run", "--reporter=json", "--outputFile=test-results/vitest-results.json"]);
run("pnpm", ["--filter", "@net-zero/contracts", "exec", "vitest", "run", "--reporter=json", "--outputFile=test-results/vitest-results.json"]);
run("pnpm", ["--filter", "@net-zero/worker", "exec", "vitest", "run", "--reporter=json", "--outputFile=test-results/vitest-results.json"]);
run("pnpm", ["test:e2e"]);
const readinessEnvironment = {
  DATABASE_URL: testDatabaseUrl,
  NODE_ENV: "test",
  MOCK_DEMO_ENABLED: "true",
  OUTBOUND_INTEGRATIONS: "disabled",
  DATABASE_DATA_SCOPE: "mock_demo",
  OBJECT_STORAGE_DATA_SCOPE: "mock_demo",
};
run("pnpm", ["db:demo-readiness"], { env: { ...readinessEnvironment, MOCK_DEMO_CORE_VERIFIED: "true" } });
run("pnpm", ["db:production-readiness"], { expectedStatus: 1, env: readinessEnvironment });

const sourceHashAfter = await hashSources(sourceFiles);
assertSourceStable(sourceHashBefore, sourceHashAfter);
const sourceHash = sourceHashAfter;

const rawResultPaths = [
  "apps/api/test-results/vitest-results.json",
  "packages/domain/test-results/vitest-results.json",
  "packages/contracts/test-results/vitest-results.json",
  "apps/worker/test-results/vitest-results.json",
  "apps/web/test-results/playwright-results.json",
  "artifacts/demo-readiness-gate.json",
  "artifacts/production-readiness-gate.json",
  "artifacts/physical-device-gate.json"
];
for (const path of rawResultPaths) assertFresh((await stat(path)).mtimeMs, startedAtMs, path);

const vitestReport = async (path) => {
  const report = await readJson(path);
  const assertions = (report.testResults ?? []).flatMap((suite) => suite.assertionResults ?? []);
  const failed = report.numFailedTests ?? assertions.filter((test) => test.status === "failed").length;
  const passed = report.numPassedTests ?? assertions.filter((test) => test.status === "passed").length;
  const suitesPassed = report.numPassedTestSuites ?? (report.testResults ?? []).filter((suite) => suite.status === "passed").length;
  if (failed !== 0 || passed === 0 || report.success === false) throw new Error(`${path} does not prove a passed Vitest run`);
  return { testsPassed: passed, testFilesPassed: suitesPassed };
};

const playwright = await readJson("apps/web/test-results/playwright-results.json");
const browserTests = [];
const visit = (suite) => {
  for (const spec of suite.specs ?? []) browserTests.push(...(spec.tests ?? []));
  for (const child of suite.suites ?? []) visit(child);
};
for (const suite of playwright.suites ?? []) visit(suite);
const browserPassed = browserTests.filter((test) => test.results?.at(-1)?.status === "passed").length;
if (browserPassed === 0 || browserPassed !== browserTests.length) throw new Error("Playwright JSON does not prove a fully passed browser run");

const [api, domain, contracts, worker, mockReadiness, productionReadiness, physicalGate] = await Promise.all([
  vitestReport("apps/api/test-results/vitest-results.json"),
  vitestReport("packages/domain/test-results/vitest-results.json"),
  vitestReport("packages/contracts/test-results/vitest-results.json"),
  vitestReport("apps/worker/test-results/vitest-results.json"),
  readJson("artifacts/demo-readiness-gate.json"),
  readJson("artifacts/production-readiness-gate.json"),
  readJson("artifacts/physical-device-gate.json")
]);
for (const [label, artifact] of [["mock readiness", mockReadiness], ["production readiness", productionReadiness], ["synthetic browser gate", physicalGate]]) {
  assertFresh(Date.parse(artifact.generatedAt), startedAtMs, label);
  if (!artifact.runId) throw new Error(`${label} has no run ID`);
}
if (mockReadiness.status !== "passed" || mockReadiness.mockDemoReady !== true) throw new Error("Mock-demo readiness did not pass");
if (productionReadiness.status !== "failed" || productionReadiness.productionReady !== false || productionReadiness.exitCode !== 1) throw new Error("Production readiness did not fail closed as expected");
if (physicalGate.status !== "passed" || physicalGate.physicalEvidence?.status !== "not_collected" || physicalGate.deviceApisCalled !== false) throw new Error("Synthetic browser gate does not deny physical evidence/device APIs");

const readinessSourceHash = await hashSources(mockReadiness.provenance.sourceFiles);
assertSourceBound(mockReadiness.provenance.sourceHash, readinessSourceHash, "mock readiness");
assertSourceBound(productionReadiness.provenance.sourceHash, readinessSourceHash, "production readiness");
const physicalSourceHash = await hashSources(physicalGate.sourceFiles);
assertSourceBound(physicalGate.sourceHash, physicalSourceHash, "synthetic browser gate");

const fileProof = async (path) => {
  await access(path);
  return { path, sha256: sha256(await readFile(path)), gateInput: false, sourceBinding: "supplementary-live-observation" };
};
const supplementaryPaths = ["artifacts/live-pwa-login.png", "artifacts/live-pwa-admin.png", "artifacts/web-automation-transcript.json"];
const supplementaryEvidence = [];
for (const path of supplementaryPaths) {
  try {
    supplementaryEvidence.push(await fileProof(path));
  } catch {
    // Live-browser observations are optional and never gate atomic verification.
  }
}
const generatedAt = new Date().toISOString();

await writeFile("artifacts/api-package-test-report.json", `${JSON.stringify({
  schemaVersion: 4,
  kind: "api-package-test-report",
  verificationRunId: runId,
  startedAt: new Date(startedAtMs).toISOString(),
  generatedAt,
  sourceFiles,
  sourceHash,
  sourceStableDuringRun: true,
  commands,
  result: { exitCode: 0, ...api },
  readiness: {
    mockDemo: { runId: mockReadiness.runId, status: mockReadiness.status, sourceHash: mockReadiness.provenance.sourceHash, artifact: "artifacts/demo-readiness-gate.json" },
    production: { runId: productionReadiness.runId, status: productionReadiness.status, exitCode: productionReadiness.exitCode, sourceHash: productionReadiness.provenance.sourceHash, artifact: "artifacts/production-readiness-gate.json" }
  },
  coverage: [
    "server-derived mock_demo and production scope boundaries",
    "immutable factor review digest and single calculation/ledger authority",
    "cross-scope reviewer, evidence, route, QR, reward, and aggregate denial",
    "three deterministic action flows through API and PostgreSQL",
    "provider isolation, idempotency, voucher races, privacy, and audit lineage",
    "persistent empty-database bootstrap marker and local-only configuration refusal",
    "stale-result and source-change rejection in the evidence writer"
  ],
  verdict: "passed"
}, null, 2)}\n`);

await writeFile("artifacts/browser-e2e-report.json", `${JSON.stringify({
  schemaVersion: 4,
  kind: "browser-automation-test-report",
  verificationRunId: runId,
  startedAt: new Date(startedAtMs).toISOString(),
  generatedAt,
  sourceHash,
  sourceStableDuringRun: true,
  command: "pnpm test:e2e",
  result: { exitCode: 0, projects: ["chromium-desktop", "pixel-7"], testsPassed: browserPassed },
  physicalGate: { runId: physicalGate.runId, sourceHash: physicalGate.sourceHash, configHash: physicalGate.configHash, fixtureHash: physicalGate.fixtureHash, artifact: "artifacts/physical-device-gate.json" },
  coverage: [
    "visible Thai mock/synthetic/demo-only trust boundary",
    "deterministic JPEG and route fixtures without device API calls",
    "exact 30000 millisecond foreground intervals and background failure",
    "reviewer evidence-open error, rewards, merchant, and readiness interactions",
    "factor-only prerequisites never render aggregate production readiness"
  ],
  supplementaryEvidence,
  verdict: "passed"
}, null, 2)}\n`);

await writeFile("artifacts/algorithm-boundary-report.json", `${JSON.stringify({
  schemaVersion: 4,
  kind: "algorithm-boundary-test-report",
  verificationRunId: runId,
  startedAt: new Date(startedAtMs).toISOString(),
  generatedAt,
  sourceHash,
  sourceStableDuringRun: true,
  result: { exitCode: 0, domainTestsPassed: domain.testsPassed, contractTestsPassed: contracts.testsPassed, workerTestsPassed: worker.testsPassed, browserTestsPassed: browserPassed },
  adversarialCoverage: [
    "bus temporal, coverage, speed, stop, corridor, and duplicate boundaries",
    "half-even carbon arithmetic and point caps",
    "mock approval digest/scope mismatch and production factor denial",
    "synthetic fixture exact interval and background fail-closed behavior",
    "voucher concurrent terminal transitions and immutable ledger balances",
    "stale verification artifacts and mid-run source changes"
  ],
  verdict: "passed"
}, null, 2)}\n`);
