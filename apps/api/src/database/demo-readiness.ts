import "../load-env.js";
import { createHash, randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import pg from "pg";

import { getConfig, type AppConfig } from "../config.js";
import { assertMockDemoConfig } from "./demo-mode.js";

const REQUIRED_ACTIVITIES = ["bus", "recycling", "tree"] as const;
export const READINESS_SOURCE_FILES = [
  "package.json",
  "apps/api/package.json",
  "apps/api/src/config.ts",
  "apps/api/src/claims/claims.service.ts",
  "apps/api/src/community/community.service.ts",
  "apps/api/src/database/demo-mode.ts",
  "apps/api/src/database/demo-readiness.ts",
  "apps/api/src/database/production-readiness.ts",
  "apps/api/src/database/reset-demo.ts",
  "apps/api/src/evidence/evidence.service.ts",
  "apps/api/src/rewards/rewards.service.ts",
  "apps/api/test/demo-separation/full-demo.test.ts",
  "migrations/001_initial.sql",
  "migrations/004_carbon_impact_v2.sql",
  "seed/demo/001_demo.sql",
  "seed/approved-factors/001_tgo_candidates.sql",
  "seed/approved-factors/002_carbon_impact_v2.sql",
] as const;

type MockFactorRow = { activity: string; ready: boolean; factor_id: string | null; factor_status: string | null; approval_scope: string | null; is_mock: boolean | null; demo_only: boolean | null; review_digest: string | null; reviewed_digest: string | null };
type ProductionFactorRow = { activity: string; ready: boolean; factor_id: string | null };
type FixtureRow = Record<string, string | number | boolean | null>;

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function sha256(value: string): string { return `sha256:${createHash("sha256").update(value).digest("hex")}`; }

export async function sourceHash(): Promise<string> {
  const contents = await Promise.all(READINESS_SOURCE_FILES.map(async (path) => [path, await readFile(new URL(`../../../../${path}`, import.meta.url), "utf8")] as const));
  return sha256(contents.map(([path, content]) => `${path}\n${content}`).join("\n"));
}

export function redactedConfig(environment: Readonly<Record<string, string | undefined>>): Record<string, string | null> {
  const endpoint = environment.OBJECT_STORAGE_ENDPOINT;
  const databaseUrl = environment.DATABASE_URL;
  let databaseEndpoint: string | null = null;
  let resourceEndpoint: string | null = null;
  if (databaseUrl) {
    const parsed = new URL(databaseUrl);
    databaseEndpoint = `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  }
  if (endpoint) {
    const parsed = new URL(endpoint);
    resourceEndpoint = `${parsed.protocol}//${parsed.host}${parsed.pathname.replace(/\/$/, "")}`;
  }
  return {
    nodeEnv: environment.NODE_ENV ?? null,
    mockDemoEnabled: environment.MOCK_DEMO_ENABLED ?? null,
    outboundIntegrations: environment.OUTBOUND_INTEGRATIONS ?? null,
    databaseDataScope: environment.DATABASE_DATA_SCOPE ?? null,
    databaseEndpoint,
    objectStorageDataScope: environment.OBJECT_STORAGE_DATA_SCOPE ?? null,
    objectStorageEndpoint: resourceEndpoint,
    objectStorageBucket: environment.OBJECT_STORAGE_BUCKET ?? null,
  };
}

export function configHash(environment: Readonly<Record<string, string | undefined>>): string { return sha256(canonicalJson(redactedConfig(environment))); }
export function fixtureHash(fixtures: FixtureRow[]): string { return sha256(canonicalJson([...fixtures].sort((left, right) => canonicalJson(left).localeCompare(canonicalJson(right))))); }
export function mockDemoReadinessConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  const config = getConfig(environment);
  assertMockDemoConfig(config);
  return config;
}

export function interpretMockFactors(rows: MockFactorRow[]) {
  const activities = Object.fromEntries(rows.map((row) => [row.activity, {
    ready: row.ready,
    factorId: row.factor_id,
    factorStatus: row.factor_status,
    approvalScope: row.approval_scope,
    isMock: row.is_mock,
    demoOnly: row.demo_only,
    digestMatches: row.review_digest !== null && row.review_digest === row.reviewed_digest,
  }]));
  const missingActivities = REQUIRED_ACTIVITIES.filter((activity) => {
    const row = rows.find((candidate) => candidate.activity === activity);
    return !row || !row.ready || row.factor_status !== "draft" || row.approval_scope !== "mock_demo" || row.is_mock !== true || row.demo_only !== true || row.review_digest === null || row.review_digest !== row.reviewed_digest;
  });
  return { activities, missingActivities, ready: rows.length === REQUIRED_ACTIVITIES.length && missingActivities.length === 0 };
}

export function behavioralFlows(counts: { claims: number; vouchers: number; carbonLedger: number; pointLedger: number }) {
  const carbonPointsLedger = counts.carbonLedger === 0 && counts.pointLedger === 0
    ? "not_executed"
    : counts.carbonLedger > 0 && counts.pointLedger > 0
      ? "observed"
      : "partial";
  return {
    claims: counts.claims > 0 ? "observed" : "not_executed",
    vouchers: counts.vouchers > 0 ? "observed" : "not_executed",
    carbonPointsLedger,
    dashboardLeaderboard: "not_checked",
  } as const;
}

export function buildMockDemoReport(input: { rows: MockFactorRow[]; productionRows: ProductionFactorRow[]; marker: string | null; fixtureHash: string; sourceHash: string; configHash: string; counts: { claims: number; vouchers: number; carbonLedger: number; pointLedger: number }; completeDemo: boolean; runId?: string; generatedAt?: string }) {
  const factors = interpretMockFactors(input.rows);
  const markerMatches = input.marker === "mock_demo";
  const mockDemoReady = markerMatches && factors.ready && input.completeDemo;
  return {
    schemaVersion: 3, kind: "mock-demo-readiness-gate-report", command: "pnpm db:demo-readiness", runId: input.runId ?? randomUUID(), generatedAt: input.generatedAt ?? new Date().toISOString(),
    status: mockDemoReady ? "passed" : "failed", exitCode: mockDemoReady ? 0 : 1, mockDemoReady,
    observedDatabase: { marker: input.marker, expectedScope: "mock_demo", markerMatches },
    provenance: { sourceFiles: READINESS_SOURCE_FILES, sourceHash: input.sourceHash, configHash: input.configHash, fixtureHash: input.fixtureHash },
    factors: { ready: factors.ready, missingActivities: factors.missingActivities, activities: factors.activities },
    productionFactors: { ready: input.productionRows.length === REQUIRED_ACTIVITIES.length && input.productionRows.every((row) => row.ready), missingActivities: REQUIRED_ACTIVITIES.filter((activity) => !input.productionRows.find((row) => row.activity === activity)?.ready) },
    behavioralFlows: input.completeDemo
      ? { claims: "passed_test", vouchers: "passed_test", carbonPointsLedger: "passed_test", dashboardLeaderboard: "passed_test" }
      : behavioralFlows(input.counts),
    completeDemo: input.completeDemo ? "passed" : "not_executed",
    tgoEndorsed: false, physicalEvidence: { status: "not_collected" }, realIntegrations: { identity: "not_integrated", transit: "not_integrated", treeAi: "not_integrated", recyclingBin: "not_integrated", merchantPayment: "not_integrated" },
    messageThai: mockDemoReady ? "เดโมจำลองพร้อม: ขอบเขต ปัจจัย และผลการทดสอบ complete mock demo ผ่านใน source เดียวกัน" : "เดโมจำลองยังไม่พร้อม: ต้องผ่านตัวทำเครื่องหมายขอบเขต การทบทวนปัจจัย และ complete mock demo test ใน source เดียวกัน",
  };
}

async function run(): Promise<void> {
  const config = mockDemoReadinessConfig();
  if (process.env.MOCK_DEMO_CORE_VERIFIED !== "true") {
    throw new Error("ปฏิเสธ readiness: ต้องรันผ่าน atomic verification เพื่อยืนยัน complete mock demo");
  }
  const pool = new pg.Pool({ connectionString: config.DATABASE_URL });
  try {
    const [mock, production, marker, fixtures, counts] = await Promise.all([
      pool.query<MockFactorRow>(`select readiness.activity,readiness.ready,readiness.factor_id,factor.status::text factor_status,approval.approval_scope,approval.is_mock,approval.demo_only,factor.review_digest,approval.reviewed_digest from mock_demo_factor_readiness readiness left join factor_catalog factor on factor.id=readiness.factor_id left join mock_demo_factor_approvals approval on approval.factor_id=factor.id order by readiness.activity`),
      pool.query<ProductionFactorRow>("select activity,ready,factor_id from production_factor_readiness order by activity"),
      pool.query<{ data_scope: string }>("select data_scope from deployment_metadata where singleton=true"),
      pool.query<FixtureRow>(`select 'factor' kind,manifest.activity || ':' || coalesce(manifest.expected_material,'') identifier,factor.id::text id,factor.review_digest || ':' || coalesce(approval.reviewed_digest,'missing') digest from current_demo_factor_manifest manifest join factor_catalog factor on factor.id=manifest.factor_id left join mock_demo_factor_approvals approval on approval.factor_id=factor.id union all select 'route',code || ':' || version::text,id::text,encode(digest(code || ':' || version::text,'sha256'),'hex') from routes union all select 'bin',code,id::text,encode(digest(code,'sha256'),'hex') from qr_bins union all select 'reward',id::text,id::text,encode(digest(title_th || ':' || point_cost::text,'sha256'),'hex') from rewards order by 1,2,3`),
      pool.query<{ claims: string; vouchers: string; carbon_ledger: string; point_ledger: string }>("select (select count(*) from claims)::text claims,(select count(*) from vouchers)::text vouchers,(select count(*) from carbon_ledger)::text carbon_ledger,(select count(*) from point_ledger)::text point_ledger"),
    ]);
    const count = counts.rows[0];
    const report = buildMockDemoReport({ rows: mock.rows, productionRows: production.rows, marker: marker.rows[0]?.data_scope ?? null, fixtureHash: fixtureHash(fixtures.rows), sourceHash: await sourceHash(), configHash: configHash(process.env), counts: { claims: Number(count?.claims ?? 0), vouchers: Number(count?.vouchers ?? 0), carbonLedger: Number(count?.carbon_ledger ?? 0), pointLedger: Number(count?.point_ledger ?? 0) }, completeDemo: true });
    await writeFile(new URL("../../../../artifacts/demo-readiness-gate.json", import.meta.url), `${JSON.stringify(report, null, 2)}\n`);
    if (report.exitCode !== 0) console.error(report.messageThai); else console.log(report.messageThai);
    process.exitCode = report.exitCode;
  } finally { await pool.end(); }
}

if (process.argv[1] && new URL(`file://${process.argv[1]}`).href === import.meta.url) await run();
