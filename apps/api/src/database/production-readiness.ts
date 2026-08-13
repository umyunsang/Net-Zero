import "../load-env.js";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import pg from "pg";

import { configHash, fixtureHash, READINESS_SOURCE_FILES, sourceHash } from "./demo-readiness.js";

const REQUIRED_ACTIVITIES = ["bus", "recycling", "tree"] as const;
type ProductionFactorRow = { activity: string; ready: boolean; factor_id: string | null };
type FixtureRow = Record<string, string | number | boolean | null>;

export function buildProductionReport(input: { rows: ProductionFactorRow[]; marker: string | null; fixtureHash: string; sourceHash: string; configHash: string; runId?: string; generatedAt?: string }) {
  const missingActivities = REQUIRED_ACTIVITIES.filter((activity) => !input.rows.find((row) => row.activity === activity)?.ready);
  const factorsReady = input.rows.length === REQUIRED_ACTIVITIES.length && missingActivities.length === 0;
  const markerMatches = input.marker === "production";
  // Human, physical, regulator, and partner evidence is intentionally never inferred from database rows.
  return {
    schemaVersion: 3, kind: "production-readiness-gate-report", command: "pnpm db:production-readiness", runId: input.runId ?? randomUUID(), generatedAt: input.generatedAt ?? new Date().toISOString(),
    status: "failed", exitCode: 1, productionReady: false,
    observedDatabase: { marker: input.marker, expectedScope: "production", markerMatches },
    provenance: { sourceFiles: READINESS_SOURCE_FILES, sourceHash: input.sourceHash, configHash: input.configHash, fixtureHash: input.fixtureHash },
    factors: { ready: factorsReady, missingActivities, activities: Object.fromEntries(input.rows.map((row) => [row.activity, { ready: row.ready, factorId: row.factor_id }])) },
    physicalEvidence: { status: "not_collected" }, tgoEndorsed: false,
    realIntegrations: { identity: "not_integrated", transit: "not_integrated", treeAi: "not_integrated", recyclingBin: "not_integrated", merchantPayment: "not_integrated" },
    messageThai: "ยังไม่พร้อมใช้งานจริง: รายงานตรวจเฉพาะปัจจัยและตัวทำเครื่องหมายฐานข้อมูล; หลักฐานทางกายภาพ การรับรองโดย อบก. และการเชื่อมพันธมิตรยังไม่ได้เก็บหรือเชื่อมต่อ",
  };
}

async function run(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const pool = new pg.Pool({ connectionString: databaseUrl });
  try {
    const [factors, marker, fixtures] = await Promise.all([
      pool.query<ProductionFactorRow>("select activity,ready,factor_id from production_factor_readiness order by activity"),
      pool.query<{ data_scope: string }>("select data_scope from deployment_metadata where singleton=true"),
      pool.query<FixtureRow>(`select 'factor' kind,manifest.activity || ':' || coalesce(manifest.expected_material,'') identifier,factor.id::text id,factor.review_digest || ':' || coalesce(approval.reviewed_digest,'missing') digest from current_demo_factor_manifest manifest join factor_catalog factor on factor.id=manifest.factor_id left join mock_demo_factor_approvals approval on approval.factor_id=factor.id union all select 'route',code || ':' || version::text,id::text,encode(digest(code || ':' || version::text,'sha256'),'hex') from routes union all select 'bin',code,id::text,encode(digest(code,'sha256'),'hex') from qr_bins union all select 'reward',id::text,id::text,encode(digest(title_th || ':' || point_cost::text,'sha256'),'hex') from rewards order by 1,2,3`),
    ]);
    const report = buildProductionReport({ rows: factors.rows, marker: marker.rows[0]?.data_scope ?? null, fixtureHash: fixtureHash(fixtures.rows), sourceHash: await sourceHash(), configHash: configHash(process.env) });
    await writeFile(new URL("../../../../artifacts/production-readiness-gate.json", import.meta.url), `${JSON.stringify(report, null, 2)}\n`);
    console.error(JSON.stringify(report, null, 2));
    process.exitCode = report.exitCode;
  } finally { await pool.end(); }
}

if (process.argv[1] && new URL(`file://${process.argv[1]}`).href === import.meta.url) await run();
