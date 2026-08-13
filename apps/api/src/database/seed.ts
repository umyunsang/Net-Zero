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
];

const pool = new pg.Pool({ connectionString: config.DATABASE_URL });
try {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await assertMockDemoDatabase(client, { allowInitialize: false });
    for (const file of seedFiles) {
      await client.query(await readFile(fileURLToPath(file), "utf8"));
    }
    await client.query("COMMIT");
    console.log("โหลดบัญชี ข้อมูลสาธิต ปัจจัยฉบับร่าง และผลการทบทวน fixture ขอบเขต mock_demo แล้ว");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
} finally {
  await pool.end();
}
