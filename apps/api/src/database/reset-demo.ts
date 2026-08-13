import "../load-env.js";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { getConfig } from "../config.js";
import { assertMockDemoConfig, assertMockDemoDatabase } from "./demo-mode.js";

const config = getConfig();
assertMockDemoConfig(config);

const seedFiles = [
  new URL("../../../../seed/demo/001_demo.sql", import.meta.url),
  new URL("../../../../seed/approved-factors/001_tgo_candidates.sql", import.meta.url),
  new URL("../../../../seed/approved-factors/002_carbon_impact_v2.sql", import.meta.url),
];

const pool = new pg.Pool({ connectionString: config.DATABASE_URL });
try {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await assertMockDemoDatabase(client, { allowInitialize: true });
    const tables = await client.query<{ tablename: string }>(
      "select tablename from pg_tables where schemaname='public' and tablename not in ('schema_migrations','spatial_ref_sys','deployment_metadata')",
    );
    if (tables.rows.length > 0) {
      const names = tables.rows.map(({ tablename }) => `"${tablename.replaceAll('"', '""')}"`).join(",");
      await client.query(`TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE`);
    }
    for (const file of seedFiles) {
      await client.query(await readFile(fileURLToPath(file), "utf8"));
    }
    await client.query("COMMIT");
    console.log("รีเซ็ตข้อมูล mock_demo แบบ deterministic แล้ว; ไม่มีข้อมูล production ถูกใช้");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
} finally {
  await pool.end();
}
