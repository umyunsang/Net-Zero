import "reflect-metadata";

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import pg from "pg";
import request from "supertest";
import { describe } from "vitest";

import { AppModule } from "../../src/app.module.js";
import { ApiExceptionFilter } from "../../src/http/api-exception.filter.js";

export const testDatabaseUrl = process.env.TEST_DATABASE_URL;
export const describeIntegration = testDatabaseUrl ? describe : describe.skip;

const demoIds = {
  user: "11111111-1111-4111-8111-111111111111",
  reviewer: "22222222-2222-4222-8222-222222222222",
  merchant: "33333333-3333-4333-8333-333333333333",
  admin: "44444444-4444-4444-8444-444444444444",
} as const;

export type DemoRole = keyof typeof demoIds;

export async function resetPublicData(): Promise<void> {
  if (!testDatabaseUrl) return;
  const pool = new pg.Pool({ connectionString: testDatabaseUrl });
  try {
    const tables = await pool.query<{ tablename: string }>(
      "select tablename from pg_tables where schemaname = 'public' and tablename not in ('schema_migrations','spatial_ref_sys')",
    );
    if (tables.rows.length) {
      await pool.query(`truncate table ${tables.rows.map(({ tablename }) => `\"${tablename}\"`).join(", ")} restart identity cascade`);
    }
    await pool.query("insert into deployment_metadata(singleton,data_scope) values(true,'mock_demo')");
    for (const seed of [
      new URL("../../../../seed/demo/001_demo.sql", import.meta.url),
      new URL("../../../../seed/approved-factors/001_tgo_candidates.sql", import.meta.url),
    ]) {
      await pool.query(await readFile(fileURLToPath(seed), "utf8"));
    }
  } finally {
    await pool.end();
  }
}

export async function createTestApp(): Promise<NestFastifyApplication> {
  if (!testDatabaseUrl) throw new Error("TEST_DATABASE_URL is required");
  process.env.NODE_ENV = "test";
  process.env.MOCK_DEMO_ENABLED = "true";
  process.env.OUTBOUND_INTEGRATIONS = "disabled";
  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.DATABASE_DATA_SCOPE = "mock_demo";
  process.env.JWT_SECRET ??= "test-jwt-secret-that-is-long-enough-for-hs256";
  process.env.JWT_KEY_ID ??= "test-demo-v1";
  process.env.FINGERPRINT_HMAC_KEY ??= "test-fingerprint-key-that-is-long-enough-for-hmac";
  process.env.FINGERPRINT_KEY_ID ??= "test-fingerprint-v1";
  process.env.OBJECT_STORAGE_ENDPOINT ??= "http://localhost:9000";
  process.env.OBJECT_STORAGE_DATA_SCOPE = "mock_demo";
  process.env.OBJECT_STORAGE_REGION ??= "ap-southeast-1";
  process.env.OBJECT_STORAGE_BUCKET ??= "net-zero-evidence";
  process.env.OBJECT_STORAGE_ACCESS_KEY ??= "netzero";
  process.env.OBJECT_STORAGE_SECRET_KEY ??= "replace-with-object-storage-secret";

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ bodyLimit: 10 * 1024 * 1024 }),
    { bodyParser: false },
  );
  const fastify = app.getHttpAdapter().getInstance();
  fastify.removeContentTypeParser("application/json");
  for (const contentType of ["application/json", "image/jpeg", "image/webp"]) {
    fastify.addContentTypeParser(contentType, { parseAs: "buffer" }, (request, body, done) => {
      if (request.url.startsWith("/api/evidence/") && request.url.endsWith("/content")) return done(null, body);
      if (contentType !== "application/json") return done(new Error("Unsupported media type"));
      try { return done(null, JSON.parse(body.toString("utf8"))); } catch { return done(new Error("Invalid JSON")); }
    });
  }
  app.useGlobalFilters(new ApiExceptionFilter());
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}

export async function login(app: NestFastifyApplication, role: DemoRole): Promise<string> {
  const response = await request(app.getHttpServer()).post("/api/auth/demo-login").send({ role }).expect(201);
  return response.body.accessToken as string;
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

export async function uploadTestEvidence(
  app: NestFastifyApplication,
  token: string,
  input: {
    kind: "photo" | "gps_trace";
    mimeType: "image/jpeg" | "image/webp" | "application/json";
    body: Buffer;
    capture: {
      capturedAt: string;
      camera?: { make: string; model: string };
      latitude?: number;
      longitude?: number;
    };
  },
): Promise<{ uploadId: string; evidenceId: string; sha256: string }> {
  const sha256 = createHash("sha256").update(input.body).digest("hex");
  const initialized = await request(app.getHttpServer())
    .post("/api/evidence/init")
    .set(bearer(token))
    .send({
      kind: input.kind,
      mimeType: input.mimeType,
      sizeBytes: input.body.length,
      sha256,
      capture: input.capture,
    })
    .expect(201);
  await request(app.getHttpServer())
    .post(`/api/evidence/${initialized.body.uploadId}/content`)
    .set(bearer(token))
    .set("x-upload-token", initialized.body.uploadToken)
    .set("content-type", input.mimeType)
    .send(input.mimeType === "application/json" ? input.body.toString("utf8") : input.body)
    .expect(201);
  const finalized = await request(app.getHttpServer())
    .post(`/api/evidence/${initialized.body.uploadId}/finalize`)
    .set(bearer(token))
    .send({ sha256 })
    .expect(201);
  return { uploadId: initialized.body.uploadId, evidenceId: finalized.body.evidenceId, sha256 };
}

export { demoIds };
