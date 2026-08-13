import { createHash, randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
const sourceFiles = [
  "apps/web/src/App.tsx",
  "apps/web/src/synthetic-fixtures.json",
  "apps/web/src/synthetic-fixture.jpg",
  "apps/web/e2e/app.spec.ts",
  "apps/web/e2e/device-gate.spec.ts",
  "apps/web/playwright.config.ts",
  "apps/web/scripts/write-device-gate-report.mjs",
];

const sha256 = (value) => `sha256:${createHash("sha256").update(value).digest("hex")}`;
const canonicalJson = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
};

const sourceContents = await Promise.all(sourceFiles.map(async (path) => [
  path,
  await readFile(new URL(`../../../${path}`, import.meta.url), "utf8"),
]));
const fixtures = JSON.parse(await readFile(new URL("../src/synthetic-fixtures.json", import.meta.url), "utf8"));
const playwright = JSON.parse(await readFile(new URL("../test-results/playwright-results.json", import.meta.url), "utf8"));
const tests = [];
const visit = (suite) => {
  for (const spec of suite.specs ?? []) tests.push(...(spec.tests ?? []));
  for (const child of suite.suites ?? []) visit(child);
};
for (const suite of playwright.suites ?? []) visit(suite);
const passed = tests.filter((test) => test.results?.at(-1)?.status === "passed");
if (tests.length === 0 || passed.length !== tests.length) {
  throw new Error("Playwright JSON does not prove a fully passed browser run");
}

const config = {
  browserProjects: ["chromium-desktop", "pixel-7"],
  deviceApisCalled: false,
  fixtureId: fixtures.fixtureId,
  samplingIntervalMilliseconds: fixtures.samplingIntervalMilliseconds,
};
const report = {
  schemaVersion: 3,
  kind: "synthetic-fixture-browser-gate-report",
  status: "passed",
  command: "pnpm test:e2e",
  runId: randomUUID(),
  generatedAt: new Date().toISOString(),
  sourceFiles,
  sourceHash: sha256(sourceContents.map(([path, content]) => `${path}\n${content}`).join("\n")),
  configHash: sha256(canonicalJson(config)),
  fixtureHash: sha256(canonicalJson(fixtures)),
  samplingIntervalMilliseconds: fixtures.samplingIntervalMilliseconds,
  synthetic: true,
  demoOnly: true,
  deviceApisCalled: false,
  fixtureId: fixtures.fixtureId,
  browserMatrix: config.browserProjects,
  covered: [
    "deterministic JPEG fixture without camera access",
    "deterministic synthetic route without geolocation access",
    "exact 30000 millisecond foreground sample interval",
    "background lifecycle fail-closed behavior",
    "visible mock/demo-only and physical-evidence-not-collected disclosure"
  ],
  playwrightCasesPassed: passed.length,
  physicalEvidence: { status: "not_collected" },
  productionReady: false,
  tgoEndorsed: false,
  safetyThai: "ผลนี้มาจาก browser automation ที่ใช้ฟิกซ์เจอร์สังเคราะห์โดยไม่เรียกกล้องหรือ GPS ของอุปกรณ์ ไม่ใช่หลักฐานจากอุปกรณ์จริง",
};
await writeFile(new URL("../../../artifacts/physical-device-gate.json", import.meta.url), `${JSON.stringify(report, null, 2)}\n`);
