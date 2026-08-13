import type { PoolClient } from "pg";

import type { AppConfig } from "../config.js";

export function assertMockDemoConfig(config: AppConfig): void {
  if (
    !config.MOCK_DEMO_ENABLED ||
    config.NODE_ENV === "production" ||
    config.DATABASE_DATA_SCOPE !== "mock_demo" ||
    config.OBJECT_STORAGE_DATA_SCOPE !== "mock_demo"
  ) {
    throw new Error("ปฏิเสธคำสั่งข้อมูลเดโม: การตั้งค่าไม่ได้จำกัดอยู่ใน mock_demo ที่ปลอดภัย");
  }
}

async function assertEligibleInitialization(client: PoolClient): Promise<void> {
  const tables = await client.query<{ tablename: string }>(
    `select tablename
     from pg_tables
     where schemaname='public'
       and tablename not in ('schema_migrations','spatial_ref_sys','deployment_metadata')
     order by tablename`,
  );
  for (const { tablename } of tables.rows) {
    const identifier = `"${tablename.replaceAll('"', '""')}"`;
    const content = await client.query<{ present: boolean }>(
      `select exists(select 1 from ${identifier} limit 1) present`,
    );
    if (content.rows[0]?.present) {
      throw new Error(`ปฏิเสธการเริ่มต้น mock_demo: ตาราง ${tablename} มีข้อมูลอยู่แล้ว`);
    }
  }
}

/**
 * Locks and verifies the persistent data-scope marker. Only reset-demo may
 * initialize an absent marker, and only after checking the database is eligible.
 * Call inside the command's transaction before any destructive mutation.
 */
export async function assertMockDemoDatabase(
  client: PoolClient,
  options: { allowInitialize: boolean },
): Promise<void> {
  const marker = await client.query<{ data_scope: "mock_demo" | "production" }>(
    "SELECT data_scope FROM deployment_metadata WHERE singleton = true FOR UPDATE",
  );

  if (marker.rows[0]?.data_scope === "mock_demo") {
    return;
  }
  if (marker.rows[0]?.data_scope === "production") {
    throw new Error("ปฏิเสธคำสั่งข้อมูลเดโม: ฐานข้อมูลถูกทำเครื่องหมายเป็น production");
  }
  if (!options.allowInitialize) {
    throw new Error("ปฏิเสธการ seed: ฐานข้อมูลไม่มีเครื่องหมาย mock_demo แบบถาวร");
  }

  await assertEligibleInitialization(client);
  await client.query("INSERT INTO deployment_metadata (singleton, data_scope) VALUES (true, 'mock_demo')");
}
