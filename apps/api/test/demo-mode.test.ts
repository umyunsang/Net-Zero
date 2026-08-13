import type { PoolClient, QueryResult } from "pg";
import { describe, expect, it, vi } from "vitest";

import { assertMockDemoDatabase } from "../src/database/demo-mode.js";

function clientWithRows(rows: unknown[][]): PoolClient {
  const query = vi.fn(async () => ({
    rows: rows.shift() ?? [],
    rowCount: 1,
  } as unknown as QueryResult));
  return { query } as unknown as PoolClient;
}

describe("persistent mock-demo database boundary", () => {
  it("accepts only an existing mock_demo marker for ordinary seeding", async () => {
    const client = clientWithRows([[{ data_scope: "mock_demo" }]]);
    await expect(assertMockDemoDatabase(client, { allowInitialize: false })).resolves.toBeUndefined();
    expect(client.query).toHaveBeenCalledTimes(1);
  });

  it("rejects production and missing markers for ordinary seeding", async () => {
    await expect(
      assertMockDemoDatabase(clientWithRows([[{ data_scope: "production" }]]), { allowInitialize: false }),
    ).rejects.toThrow("production");
    await expect(
      assertMockDemoDatabase(clientWithRows([[]]), { allowInitialize: false }),
    ).rejects.toThrow("ไม่มีเครื่องหมาย mock_demo");
  });

  it("initializes an empty eligible database exactly once for reset", async () => {
    const client = clientWithRows([[], [{ tablename: "routes" }, { tablename: "users" }], [{ present: false }], [{ present: false }], []]);
    await expect(assertMockDemoDatabase(client, { allowInitialize: true })).resolves.toBeUndefined();
    expect(client.query).toHaveBeenLastCalledWith(
      "INSERT INTO deployment_metadata (singleton, data_scope) VALUES (true, 'mock_demo')",
    );
  });

  it.each(["routes", "qr_tokens", "rewards", "factor_catalog"])(
    "rejects initialization when the unmarked database contains rows in %s",
    async (tablename) => {
    const client = clientWithRows([[], [{ tablename }], [{ present: true }]]);
    await expect(assertMockDemoDatabase(client, { allowInitialize: true })).rejects.toThrow("ปฏิเสธการเริ่มต้น mock_demo");
    expect(client.query).not.toHaveBeenCalledWith(
      "INSERT INTO deployment_metadata (singleton, data_scope) VALUES (true, 'mock_demo')",
    );
  });
});
