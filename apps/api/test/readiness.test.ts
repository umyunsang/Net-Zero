import { describe, expect, it } from "vitest";

import { behavioralFlows, buildMockDemoReport, configHash, fixtureHash, mockDemoReadinessConfig, redactedConfig, sourceHash } from "../src/database/demo-readiness.js";
import { buildProductionReport } from "../src/database/production-readiness.js";

const completeRows = ["bus", "recycling", "tree"].map((activity, index) => ({ activity, ready: true, factor_id: `00000000-0000-4000-8000-00000000000${index + 1}`, factor_status: "draft", approval_scope: "mock_demo", is_mock: true, demo_only: true, review_digest: "a".repeat(64), reviewed_digest: "a".repeat(64) }));
const productionRows = ["bus", "recycling", "tree"].map((activity, index) => ({ activity, ready: true, factor_id: `10000000-0000-4000-8000-00000000000${index + 1}` }));
const provenance = { fixtureHash: "sha256:fixture", sourceHash: "sha256:source", configHash: "sha256:config", runId: "00000000-0000-4000-8000-000000000001", generatedAt: "2026-01-01T00:00:00.000Z" };

describe("readiness report builders", () => {
  it("reports all-ready only for the measured mock scope and matching approvals", () => {
    const report = buildMockDemoReport({ rows: completeRows, productionRows, marker: "mock_demo", counts: { claims: 1, vouchers: 1, carbonLedger: 1, pointLedger: 1 }, completeDemo: true, ...provenance });
    expect(report).toMatchObject({ status: "passed", exitCode: 0, mockDemoReady: true, observedDatabase: { markerMatches: true } });
    expect(report.behavioralFlows).toEqual({ claims: "passed_test", vouchers: "passed_test", carbonPointsLedger: "passed_test", dashboardLeaderboard: "passed_test" });
  });

  it("fails on a missing approval, digest mismatch, or database mode mismatch", () => {
    const missing = buildMockDemoReport({ rows: completeRows.filter((row) => row.activity !== "tree"), productionRows, marker: "mock_demo", counts: { claims: 0, vouchers: 0, carbonLedger: 0, pointLedger: 0 }, completeDemo: true, ...provenance });
    const tampered = buildMockDemoReport({ rows: completeRows.map((row) => row.activity === "bus" ? { ...row, reviewed_digest: "b".repeat(64) } : row), productionRows, marker: "mock_demo", counts: { claims: 0, vouchers: 0, carbonLedger: 0, pointLedger: 0 }, completeDemo: true, ...provenance });
    const wrongScope = buildMockDemoReport({ rows: completeRows, productionRows, marker: "production", counts: { claims: 0, vouchers: 0, carbonLedger: 0, pointLedger: 0 }, completeDemo: true, ...provenance });
    for (const report of [missing, tampered, wrongScope]) expect(report).toMatchObject({ status: "failed", exitCode: 1, mockDemoReady: false });
    expect(tampered.factors.activities.bus.digestMatches).toBe(false);
  });

  it("does not pass readiness when the complete mock demo test is absent", () => {
    const report = buildMockDemoReport({ rows: completeRows, productionRows, marker: "mock_demo", counts: { claims: 0, vouchers: 0, carbonLedger: 0, pointLedger: 0 }, completeDemo: false, ...provenance });
    expect(report).toMatchObject({ mockDemoReady: false, status: "failed", exitCode: 1, completeDemo: "not_executed" });
  });

  it("marks reset fixtures without behavioral rows as not executed", () => {
    expect(behavioralFlows({ claims: 0, vouchers: 0, carbonLedger: 0, pointLedger: 0 })).toEqual({ claims: "not_executed", vouchers: "not_executed", carbonPointsLedger: "not_executed", dashboardLeaderboard: "not_checked" });
    expect(behavioralFlows({ claims: 1, vouchers: 0, carbonLedger: 1, pointLedger: 0 })).toEqual({ claims: "observed", vouchers: "not_executed", carbonPointsLedger: "partial", dashboardLeaderboard: "not_checked" });
  });

  it("keeps the production report negative and does not accept trust booleans", () => {
    const report = buildProductionReport({ rows: productionRows, marker: "production", ...provenance } as Parameters<typeof buildProductionReport>[0]);
    expect(report).toMatchObject({ productionReady: false, status: "failed", exitCode: 1, tgoEndorsed: false, physicalEvidence: { status: "not_collected" } });
    expect(report.realIntegrations).toEqual(expect.objectContaining({ identity: "not_integrated", merchantPayment: "not_integrated" }));
  });

  it("hashes only deterministic redacted configuration and canonical fixtures", async () => {
    const environment = { NODE_ENV: "test", DATABASE_URL: "postgres://user:password@db.example:5432/netzero", OBJECT_STORAGE_ENDPOINT: "https://access:secret@storage.example/bucket/", OBJECT_STORAGE_BUCKET: "net-zero-demo", JWT_SECRET: "must-not-leak" };
    const redacted = redactedConfig(environment);
    expect(JSON.stringify(redacted)).not.toContain("password");
    expect(JSON.stringify(redacted)).not.toContain("secret");
    expect(configHash(environment)).toBe(configHash({ ...environment, JWT_SECRET: "different-secret" }));
    expect(fixtureHash([{ kind: "bin", id: "b" }, { kind: "factor", id: "a" }])).toBe(fixtureHash([{ id: "a", kind: "factor" }, { id: "b", kind: "bin" }]));
    expect(await sourceHash()).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it("binds the mock readiness command to the validated local mock configuration", () => {
    const environment = {
      NODE_ENV: "test",
      MOCK_DEMO_ENABLED: "true",
      WEB_ORIGIN: "http://localhost:5173",
      DATABASE_URL: "postgres://netzero:netzero@localhost:5432/netzero",
      DATABASE_DATA_SCOPE: "mock_demo",
      JWT_SECRET: "test-jwt-secret-that-is-long-enough-for-hs256",
      FINGERPRINT_HMAC_KEY: "test-fingerprint-key-that-is-long-enough-for-hmac",
      OBJECT_STORAGE_ENDPOINT: "http://localhost:9000",
      OBJECT_STORAGE_DATA_SCOPE: "mock_demo",
      OBJECT_STORAGE_BUCKET: "net-zero-evidence",
      OBJECT_STORAGE_ACCESS_KEY: "netzero",
      OBJECT_STORAGE_SECRET_KEY: "test-object-storage-secret",
    };
    expect(mockDemoReadinessConfig(environment).DATABASE_DATA_SCOPE).toBe("mock_demo");
    expect(() => mockDemoReadinessConfig({ ...environment, MOCK_DEMO_ENABLED: "false" })).toThrow(
      "mock_demo resources require mock demo mode",
    );
    expect(() => mockDemoReadinessConfig({
      ...environment,
      DATABASE_URL: "postgres://netzero:netzero@db.example.test:5432/netzero",
    })).toThrow("localhost-only");
  });
});
