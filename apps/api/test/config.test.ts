import { describe, expect, it } from "vitest";

import { getConfig } from "../src/config.js";
import { OidcIdentityProviderAdapter } from "../src/auth/identity-provider.js";

const baseEnvironment = {
  PORT: "3000",
  WEB_ORIGIN: "http://localhost:5173",
  DATABASE_URL: "postgres://netzero:password@localhost:5432/netzero",
  DATABASE_DATA_SCOPE: "mock_demo",
  JWT_SECRET: "test-jwt-secret-that-is-long-enough-for-hs256",
  FINGERPRINT_HMAC_KEY: "test-fingerprint-key-that-is-long-enough-for-hmac",
  OBJECT_STORAGE_ENDPOINT: "http://localhost:9000",
  OBJECT_STORAGE_DATA_SCOPE: "mock_demo",
  OBJECT_STORAGE_REGION: "ap-southeast-1",
  OBJECT_STORAGE_BUCKET: "net-zero-evidence",
  OBJECT_STORAGE_ACCESS_KEY: "netzero",
  OBJECT_STORAGE_SECRET_KEY: "test-object-storage-secret",
  OUTBOUND_INTEGRATIONS: "disabled",
} satisfies NodeJS.ProcessEnv;

describe("mock demo configuration boundary", () => {
  it("keeps the external identity adapter fail-closed without network behavior", async () => {
    await expect(new OidcIdentityProviderAdapter().verifyExternalToken("fixture")).rejects.toThrow(
      "external_identity_provider_not_configured",
    );
  });
  it("accepts localhost mock resources outside production", () => {
    expect(getConfig({ ...baseEnvironment, NODE_ENV: "test", MOCK_DEMO_ENABLED: "true" }).MOCK_DEMO_ENABLED).toBe(true);
  });

  it("accepts IPv6 loopback mock resources outside production", () => {
    expect(getConfig({
      ...baseEnvironment,
      NODE_ENV: "test",
      MOCK_DEMO_ENABLED: "true",
      DATABASE_URL: "postgres://netzero:password@[::1]:5432/netzero",
      OBJECT_STORAGE_ENDPOINT: "http://[::1]:9000",
      WEB_ORIGIN: "http://[::1]:5173",
    }).DATABASE_DATA_SCOPE).toBe("mock_demo");
  });

  it("rejects mock mode in production", () => {
    expect(() => getConfig({ ...baseEnvironment, NODE_ENV: "production", MOCK_DEMO_ENABLED: "true" })).toThrow(
      "MOCK_DEMO_ENABLED: mock demo mode cannot run in production",
    );
  });

  it("accepts production only with mock disabled and production-scoped resources", () => {
    expect(getConfig({
      ...baseEnvironment,
      NODE_ENV: "production",
      MOCK_DEMO_ENABLED: "false",
      DATABASE_DATA_SCOPE: "production",
      OBJECT_STORAGE_DATA_SCOPE: "production",
    }).MOCK_DEMO_ENABLED).toBe(false);
  });

  it("rejects production with mock-disabled but mis-scoped resources", () => {
    expect(() => getConfig({
      ...baseEnvironment,
      NODE_ENV: "production",
      MOCK_DEMO_ENABLED: "false",
      DATABASE_DATA_SCOPE: "mock_demo",
      OBJECT_STORAGE_DATA_SCOPE: "production",
    })).toThrow("production requires production database and object storage scopes");
  });

  it("rejects mock_demo resources when mock mode is disabled outside production", () => {
    expect(() => getConfig({
      ...baseEnvironment,
      NODE_ENV: "test",
      MOCK_DEMO_ENABLED: "false",
    })).toThrow("mock_demo resources require mock demo mode");
  });

  it("rejects mock mode when resource scopes differ", () => {
    expect(() => getConfig({
      ...baseEnvironment,
      NODE_ENV: "test",
      MOCK_DEMO_ENABLED: "true",
      OBJECT_STORAGE_DATA_SCOPE: "production",
    })).toThrow("mock demo mode requires mock_demo database and object storage scopes");
  });

  it("rejects enabled outbound integrations in mock mode", () => {
    expect(() => getConfig({
      ...baseEnvironment,
      NODE_ENV: "test",
      MOCK_DEMO_ENABLED: "true",
      OUTBOUND_INTEGRATIONS: "enabled",
    })).toThrow("outbound integrations disabled");
  });

  it.each([
    ["DATABASE_URL", "postgres://netzero:password@db.example.test:5432/netzero"],
    ["OBJECT_STORAGE_ENDPOINT", "https://objects.example.test"],
    ["WEB_ORIGIN", "https://app.example.test"],
  ])("rejects remote %s in mock mode", (key, value) => {
    expect(() => getConfig({ ...baseEnvironment, NODE_ENV: "test", MOCK_DEMO_ENABLED: "true", [key]: value })).toThrow(
      "mock demo mode requires localhost-only database, object storage, and web origin",
    );
  });
});
