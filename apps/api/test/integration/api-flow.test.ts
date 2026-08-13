import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";
import request from "supertest";
import { Logger } from "@nestjs/common";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";

import { DatabaseService } from "../../src/database/database.service.js";
import { ObjectStorageService } from "../../src/evidence/object-storage.service.js";
import { EvidenceService } from "../../src/evidence/evidence.service.js";
import { RewardsService } from "../../src/rewards/rewards.service.js";
import { ClaimsService } from "../../src/claims/claims.service.js";
import { bearer, createTestApp, demoIds, describeIntegration, login, resetPublicData, uploadTestEvidence } from "../helpers/test-app.js";

const digest = (body: Buffer) => createHash("sha256").update(body).digest("hex");

describeIntegration("real API flow", () => {
  let app: NestFastifyApplication;
  let user: string;
  let reviewer: string;
  let admin: string;

  beforeAll(async () => { await resetPublicData(); app = await createTestApp(); });
  beforeEach(async () => { await resetPublicData(); user = await login(app, "user"); reviewer = await login(app, "reviewer"); admin = await login(app, "admin"); });
  afterAll(async () => { await app?.close(); });

  async function removeMockApproval(activity: "bus" | "recycling" | "tree") {
    const client = await app.get(DatabaseService).pool.connect();
    try {
      await client.query("begin");
      await client.query("set local session_replication_role='replica'");
      await client.query(
        `delete from mock_demo_factor_approvals
         where factor_id=(select factor_id from demo_factor_manifest where activity=$1)`,
        [activity],
      );
      await client.query("commit");
    } finally {
      client.release();
    }
  }

  it("issues exactly the four demo identities and rejects invalid role and role-protected JWT use", async () => {
    const roles = ["user", "reviewer", "merchant", "admin"] as const;
    const logins = await Promise.all(roles.map((role) => request(app.getHttpServer()).post("/api/auth/demo-login").send({ role }).expect(201)));
    expect(logins.map((response) => response.body.user.role).sort()).toEqual([...roles].sort());
    await request(app.getHttpServer()).post("/api/auth/demo-login").send({ role: "operator" }).expect(400);
    await request(app.getHttpServer()).get("/api/review/claims").set(bearer(user)).expect(403);
    await request(app.getHttpServer()).get("/api/claims").set("Authorization", "Bearer not-a-jwt").expect(401);
    const accounts = await app.get(DatabaseService).query<{ role: string; count: number }>(
      "select role::text,count(*)::int count from users where is_demo=true group by role order by role",
    );
    expect(accounts.rows).toEqual([
      { role: "admin", count: 1 },
      { role: "merchant", count: 1 },
      { role: "reviewer", count: 1 },
      { role: "user", count: 1 },
    ]);

    const secret = process.env.JWT_SECRET!;
    const keyid = process.env.JWT_KEY_ID!;
    const sign = (
      claims: { role: string; is_demo: boolean },
      options: { issuer?: string; audience?: string; expiresIn?: number } = {},
      signingSecret = secret,
    ) => jwt.sign(claims, signingSecret, {
      algorithm: "HS256",
      keyid,
      subject: demoIds.user,
      issuer: options.issuer ?? "net-zero-api",
      audience: options.audience ?? "net-zero-web",
      ...(options.expiresIn === undefined ? {} : { expiresIn: options.expiresIn }),
    });
    const invalidTokens = [
      sign({ role: "user", is_demo: true }),
      sign({ role: "user", is_demo: true }, { expiresIn: -1 }),
      sign({ role: "user", is_demo: true }, { expiresIn: 7_200 }),
      sign({ role: "user", is_demo: true }, { issuer: "wrong-issuer", expiresIn: 60 }),
      sign({ role: "user", is_demo: true }, { audience: "wrong-audience", expiresIn: 60 }),
      sign({ role: "admin", is_demo: true }, { expiresIn: 60 }),
      sign({ role: "user", is_demo: true }, { expiresIn: 60 }, "wrong-signing-secret-that-is-long-enough"),
    ];
    for (const invalidToken of invalidTokens) {
      await request(app.getHttpServer()).get("/api/claims").set(bearer(invalidToken)).expect(401);
    }
    await expect(app.get(RewardsService).scan(
      { id: demoIds.user, role: "user", displayName: "ผู้ใช้สาธิต" },
      "ANY-CODE",
      "wrong-role-service-boundary",
    )).rejects.toMatchObject({ status: 403 });
  });

  it("denies demo reviewers, evidence readers, and route resolvers across the production scope", async () => {
    const database = app.get(DatabaseService);
    const owner = await database.query<{ id: string }>(
      `insert into users(email,display_name,role,is_demo)
       values('production-owner@example.test','ผู้ใช้ขอบเขตจริง','user',false)
       returning id`,
    );
    const ownerId = owner.rows[0]!.id;
    const claim = await database.query<{ id: string }>(
      `insert into claims(
         user_id,activity,state,impact_status,idempotency_scope,idempotency_key,
         request_digest,impact_input,reason_code
       ) values($1,'recycling','pending_review','pending','recycling','scope-review',
                repeat('a',64),'{"material":"plastic","declared_count":1}'::jsonb,'recycling_pending_review')
       returning id`,
      [ownerId],
    );
    const queue = await request(app.getHttpServer())
      .get("/api/review/claims?status=pending_review")
      .set(bearer(reviewer))
      .expect(200);
    expect(queue.body.items).toEqual([]);
    await request(app.getHttpServer())
      .patch(`/api/review/claims/${claim.rows[0]!.id}`)
      .set(bearer(reviewer))
      .send({ decision: "approve", approvedItemCount: 1 })
      .expect(404);
    await request(app.getHttpServer())
      .post(`/api/review/claims/${claim.rows[0]!.id}/corrections`)
      .set(bearer(admin))
      .send({ correctedTotalKgCo2e: "1.000000", reason: "ทดสอบขอบเขต" })
      .expect(404);

    const evidenceService = app.get(EvidenceService);
    const photo = Buffer.from("production-scope-photo");
    const photoHash = digest(photo);
    const photoInit = await evidenceService.init(ownerId, {
      kind: "photo",
      mimeType: "image/jpeg",
      sizeBytes: photo.length,
      sha256: photoHash,
      capture: {
        capturedAt: new Date().toISOString(),
        camera: { make: "Production", model: "Scope" },
      },
    });
    await evidenceService.upload(ownerId, photoInit.uploadId, photoInit.uploadToken, "image/jpeg", photo);
    const photoEvidence = await evidenceService.finalize(ownerId, photoInit.uploadId, photoHash);
    await request(app.getHttpServer())
      .get(`/api/evidence/${photoEvidence.evidenceId}/content`)
      .set(bearer(reviewer))
      .expect(403);

    const start = Date.now();
    const busLongitudes = [100.535, 100.5358, 100.53735, 100.5387, 100.5395, 100.54105, 100.5424];
    const samples = busLongitudes.map((longitude, index) => ({
      sampleId: `production-route-${index}`,
      recordedAt: new Date(start + index * 30_000).toISOString(),
      latitude: "13.7649",
      longitude: longitude.toFixed(5),
      accuracyMeters: "5",
    }));
    const trace = Buffer.from(JSON.stringify(samples));
    const traceHash = digest(trace);
    const traceInit = await evidenceService.init(ownerId, {
      kind: "gps_trace",
      mimeType: "application/json",
      sizeBytes: trace.length,
      sha256: traceHash,
      capture: {
        capturedAt: samples[0]!.recordedAt,
        latitude: 13.7649,
        longitude: 100.535,
      },
    });
    await evidenceService.upload(ownerId, traceInit.uploadId, traceInit.uploadToken, "application/json", trace);
    const traceEvidence = await evidenceService.finalize(ownerId, traceInit.uploadId, traceHash);
    await expect(app.get(ClaimsService).submitBus(ownerId, {
      evidenceIds: [traceEvidence.evidenceId],
      routeName: "DEMO-BUS-01",
      boardedAt: samples[0]!.recordedAt,
      alightedAt: samples.at(-1)!.recordedAt,
      samples,
    }, "production-route-scope")).rejects.toThrow("ไม่พบเส้นทางรถโดยสาร");
  });

  it("uploads, finalizes, and lets only the owner read raw evidence", async () => {
    const raw = Buffer.from("test image evidence");
    const sha256 = digest(raw);
    const init = await request(app.getHttpServer()).post("/api/evidence/init").set(bearer(user)).send({
      kind: "photo", mimeType: "image/jpeg", sizeBytes: raw.length, sha256,
      capture: { capturedAt: new Date().toISOString(), camera: { make: "Test", model: "Camera" }, latitude: 13.7649, longitude: 100.5383 },
    }).expect(201);
    await request(app.getHttpServer()).post(`/api/evidence/${init.body.uploadId}/content`).set(bearer(user)).set("x-upload-token", "wrong").set("content-type", "image/jpeg").send(raw).expect(409);
    await request(app.getHttpServer()).post(`/api/evidence/${init.body.uploadId}/content`).set(bearer(user)).set("x-upload-token", init.body.uploadToken).set("content-type", "image/jpeg").send(raw).expect(201);
    await request(app.getHttpServer()).post(`/api/evidence/${init.body.uploadId}/finalize`).set(bearer(user)).send({ sha256: "0".repeat(64) }).expect(409);
    const finalized = await request(app.getHttpServer()).post(`/api/evidence/${init.body.uploadId}/finalize`).set(bearer(user)).send({ sha256 }).expect(201);
    await request(app.getHttpServer()).get(`/api/evidence/${finalized.body.evidenceId}/content`).set(bearer(reviewer)).expect(403);
    const content = await request(app.getHttpServer()).get(`/api/evidence/${finalized.body.evidenceId}/content`).set(bearer(user)).buffer(true).parse((response, done) => { const chunks: Buffer[] = []; response.on("data", (chunk) => chunks.push(chunk)); response.on("end", () => done(null, Buffer.concat(chunks))); });
    expect(content.body).toEqual(raw);

    const reviewerEvidence = await uploadTestEvidence(app, reviewer, {
      kind: "photo",
      mimeType: "image/jpeg",
      body: Buffer.from("reviewer-owned evidence"),
      capture: { capturedAt: new Date().toISOString(), camera: { make: "Test", model: "Reviewer camera" } },
    });
    await request(app.getHttpServer()).get(`/api/evidence/${reviewerEvidence.evidenceId}/content`).set(bearer(user)).expect(403);
    await request(app.getHttpServer()).get(`/api/evidence/${reviewerEvidence.evidenceId}/content`).set(bearer(reviewer)).expect(200);
  });

  it("records the storage cause and cleanup outcome when upload and cleanup both fail", async () => {
    const raw = Buffer.from("storage cleanup failure");
    const initialized = await request(app.getHttpServer()).post("/api/evidence/init").set(bearer(user)).send({
      kind: "photo",
      mimeType: "image/jpeg",
      sizeBytes: raw.length,
      sha256: digest(raw),
      capture: { capturedAt: new Date().toISOString(), camera: { make: "Test", model: "Failure" } },
    }).expect(201);
    const storage = app.get(ObjectStorageService);
    const put = vi.spyOn(storage, "putStream").mockRejectedValueOnce(new Error("simulated put failure"));
    const cleanup = vi.spyOn(storage, "delete").mockRejectedValueOnce(new Error("simulated delete failure"));
    const log = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    const response = await request(app.getHttpServer())
      .post(`/api/evidence/${initialized.body.uploadId}/content`)
      .set(bearer(user))
      .set("x-upload-token", initialized.body.uploadToken)
      .set("content-type", "image/jpeg")
      .send(raw)
      .expect(409);
    expect(response.body).toMatchObject({ code: "UPLOAD_INVALID" });
    expect(cleanup).toHaveBeenCalledOnce();
    expect(log).toHaveBeenCalledWith(expect.stringContaining('"cleanupOutcome":"delete_failed"'));
    expect(log).toHaveBeenCalledWith(expect.stringContaining('"uploadErrorName":"Error"'));
    log.mockRestore();
    cleanup.mockRestore();
    put.mockRestore();
  });

  it("enforces mock-reviewed factor immutability and QR bin scope at the database boundary", async () => {
    const database = app.get(DatabaseService);
    const factor = await database.query<{ factor_id: string }>(
      "select factor_id from mock_demo_factor_approvals limit 1",
    );
    await expect(database.query(
      "update factor_catalog set source_url='https://example.invalid/changed' where id=$1",
      [factor.rows[0]!.factor_id],
    )).rejects.toThrow();
    await expect(database.query(
      `insert into qr_tokens(token_hash,bin_id,is_demo,expires_at)
       select repeat('a',64),id,false,now()+interval '1 hour' from qr_bins where is_demo=true limit 1`,
    )).rejects.toThrow();
  });

  it("streams fragmented evidence through the locked upload boundary before finalization", async () => {
    const raw = Buffer.from("fragmented streaming evidence");
    const sha256 = digest(raw);
    const initialized = await request(app.getHttpServer()).post("/api/evidence/init").set(bearer(user)).send({
      kind: "photo",
      mimeType: "image/jpeg",
      sizeBytes: raw.length,
      sha256,
      capture: { capturedAt: new Date().toISOString(), camera: { make: "Test", model: "Stream" } },
    }).expect(201);
    await app.get(EvidenceService).upload(
      demoIds.user,
      initialized.body.uploadId,
      initialized.body.uploadToken,
      "image/jpeg",
      Readable.from([raw.subarray(0, 5), raw.subarray(5, 13), raw.subarray(13)]),
    );
    const finalized = await request(app.getHttpServer())
      .post(`/api/evidence/${initialized.body.uploadId}/finalize`)
      .set(bearer(user))
      .send({ sha256 })
      .expect(201);
    const stored = await app.get(ObjectStorageService).get(
      (await app.get(DatabaseService).query<{ object_key: string }>(
        "select object_key from evidence where id=$1",
        [finalized.body.evidenceId],
      )).rows[0]!.object_key,
    );
    expect(stored.body).toEqual(raw);
  });

  it("fails closed when the stored object changes before finalize", async () => {
    const raw = Buffer.from("original evidence");
    const sha256 = digest(raw);
    const init = await request(app.getHttpServer()).post("/api/evidence/init").set(bearer(user)).send({
      kind: "photo",
      mimeType: "image/jpeg",
      sizeBytes: raw.length,
      sha256,
      capture: { capturedAt: new Date().toISOString(), camera: { make: "Test", model: "Camera" } },
    }).expect(201);
    await request(app.getHttpServer()).post(`/api/evidence/${init.body.uploadId}/content`).set(bearer(user)).set("x-upload-token", init.body.uploadToken).set("content-type", "image/jpeg").send(raw).expect(201);
    const session = await app.get(DatabaseService).query<{ object_key: string }>(
      "select object_key from upload_sessions where id=$1",
      [init.body.uploadId],
    );
    const objectKey = session.rows[0]!.object_key;
    await app.get(ObjectStorageService).put(objectKey, Buffer.from("tampered"), "image/jpeg", sha256);
    await request(app.getHttpServer()).post(`/api/evidence/${init.body.uploadId}/finalize`).set(bearer(user)).send({ sha256 }).expect(409);
    const failed = await app.get(DatabaseService).query<{ state: string }>("select state from upload_sessions where id=$1", [init.body.uploadId]);
    expect(failed.rows[0]?.state).toBe("failed");
    await expect(app.get(ObjectStorageService).get(objectKey)).rejects.toThrow();
  });

  it("blocks an unapproved tree factor then credits its verified claim exactly once after admin approval", async () => {
    await removeMockApproval("tree");
    const raw = Buffer.from("tree photo");
    const sha256 = digest(raw);
    const init = await request(app.getHttpServer()).post("/api/evidence/init").set(bearer(user)).send({ kind: "photo", mimeType: "image/jpeg", sizeBytes: raw.length, sha256, capture: { capturedAt: new Date().toISOString(), camera: { make: "Test", model: "Camera" }, latitude: 13.7649, longitude: 100.5383 } }).expect(201);
    await request(app.getHttpServer()).post(`/api/evidence/${init.body.uploadId}/content`).set(bearer(user)).set("x-upload-token", init.body.uploadToken).set("content-type", "image/jpeg").send(raw).expect(201);
    const evidence = await request(app.getHttpServer()).post(`/api/evidence/${init.body.uploadId}/finalize`).set(bearer(user)).send({ sha256 }).expect(201);
    const plantedAt = new Date().toISOString();
    const claim = await request(app.getHttpServer()).post("/api/actions/tree").set(bearer(user)).set("idempotency-key", "tree-approved-flow").send({ evidenceIds: [evidence.body.evidenceId], speciesThaiName: "ต้นไม้ทดสอบ", plantedAt, quantity: 1, latitude: "13.7649", longitude: "100.5383", demoAiResult: "pass" }).expect(201);
    expect(claim.body.claim.impact_status).toBe("blocked_factor_approval");
    const beforeApproval = await app.get(DatabaseService).query<{ carbon: number; points: number }>(
      `select
         (select count(*)::int from carbon_ledger where claim_id=$1) carbon,
         (select count(*)::int from point_ledger where claim_id=$1) points`,
      [claim.body.claim.id],
    );
    expect(beforeApproval.rows[0]).toEqual({ carbon: 0, points: 0 });
    const factors = await request(app.getHttpServer()).get("/api/admin/factors").set(bearer(admin)).expect(200);
    const tree = factors.body.items.find((factor: { activity: string }) => factor.activity === "tree");
    const approved = await request(app.getHttpServer()).patch(`/api/admin/factors/${tree.id}/approve`).set(bearer(admin)).send({}).expect(200);
    expect(approved.body.creditedBlockedClaims).toBe(1);
    const replayedApproval = await request(app.getHttpServer()).patch(`/api/admin/factors/${tree.id}/approve`).set(bearer(admin)).send({}).expect(200);
    expect(replayedApproval.body.creditedBlockedClaims).toBe(0);
    const calculation = await app.get(DatabaseService).query<{ factor_snapshot: Record<string, unknown>; result: string }>(
      "select factor_snapshot,result_kg_co2e::text result from calculation_snapshots where claim_id=$1 and entry_kind='original'",
      [claim.body.claim.id],
    );
    expect(calculation.rows[0]?.result).toBe("9.500000");
    expect(calculation.rows[0]?.factor_snapshot).toMatchObject({
      id: tree.id,
      activity: "tree",
      code: "TREE_ONE_YEAR_PROXY",
      value: "9.500000000",
      status: "draft",
      approved_role: "admin",
      approved_by: demoIds.admin,
      approval_scope: "mock_demo",
      is_mock: true,
      demo_only: true,
      assumptions: { time_basis: "one_year" },
    });
    expect(calculation.rows[0]?.factor_snapshot.reviewed_digest).toMatch(/^[a-f0-9]{64}$/);
    const ledger = await app.get(DatabaseService).query<{ count: number; points: number }>(
      "select count(*)::int count,coalesce(sum(points),0)::int points from point_ledger where claim_id=$1",
      [claim.body.claim.id],
    );
    expect(ledger.rows[0]).toEqual({ count: 1, points: 15 });
    await request(app.getHttpServer()).post(`/api/review/claims/${claim.body.claim.id}/corrections`).set(bearer(admin)).send({ correctedTotalKgCo2e: "8.000000", reason: "แก้ค่าประมาณหลังทบทวน" }).expect(201);
    const corrected = await app.get(DatabaseService).query<{ carbon: string; points: number; corrections: number }>(
      `select
         (select sum(kg_co2e)::text from carbon_ledger where claim_id=$1) carbon,
         (select sum(points)::int from point_ledger where claim_id=$1) points,
         (select count(*)::int from calculation_snapshots where claim_id=$1 and entry_kind='correction') corrections`,
      [claim.body.claim.id],
    );
    expect(corrected.rows[0]).toEqual({ carbon: "8.000000", points: 20, corrections: 1 });
    await expect(app.get(DatabaseService).query("update point_ledger set points=points+1 where claim_id=$1", [claim.body.claim.id])).rejects.toThrow();
    await expect(app.get(DatabaseService).query("update calculation_snapshots set result_kg_co2e=0 where claim_id=$1", [claim.body.claim.id])).rejects.toThrow();
  });

  it("rolls back every value mutation when calculation insertion returns no id", async () => {
    const database = app.get(DatabaseService);
    const factors = await request(app.getHttpServer()).get("/api/admin/factors").set(bearer(admin)).expect(200);
    const treeFactor = factors.body.items.find((factor: { activity: string }) => factor.activity === "tree");
    await request(app.getHttpServer()).patch(`/api/admin/factors/${treeFactor.id}/approve`).set(bearer(admin)).send({}).expect(200);

    const capturedAt = new Date().toISOString();
    const evidence = await uploadTestEvidence(app, user, {
      kind: "photo",
      mimeType: "image/jpeg",
      body: Buffer.from("calculation rollback photo"),
      capture: {
        capturedAt,
        camera: { make: "Test", model: "Rollback" },
        latitude: 13.7649,
        longitude: 100.5383,
      },
    });
    const before = await database.query<{
      balance: number;
      calculations: number;
      carbon_entries: number;
      point_entries: number;
    }>(
      `select
         (select balance from point_balances where user_id=$1) balance,
         (select count(*)::int from calculation_snapshots) calculations,
         (select count(*)::int from carbon_ledger) carbon_entries,
         (select count(*)::int from point_ledger) point_entries`,
      [demoIds.user],
    );

    let response: request.Response | undefined;
    try {
      await database.query(`
        create function test_drop_calculation_insert() returns trigger
        language plpgsql as $$ begin return null; end $$;
        create trigger test_drop_calculation_insert
        before insert on calculation_snapshots
        for each row execute function test_drop_calculation_insert()
      `);
      response = await request(app.getHttpServer())
        .post("/api/actions/tree")
        .set(bearer(user))
        .set("idempotency-key", "calculation-no-returning-id")
        .send({
          evidenceIds: [evidence.evidenceId],
          speciesThaiName: "ต้นไม้ทดสอบธุรกรรม",
          plantedAt: capturedAt,
          quantity: 1,
          latitude: "13.7649",
          longitude: "100.5383",
          demoAiResult: "pass",
        });
    } finally {
      await database.query("drop trigger if exists test_drop_calculation_insert on calculation_snapshots");
      await database.query("drop function if exists test_drop_calculation_insert()");
    }
    expect(response?.status).toBe(500);
    expect(response?.body).toMatchObject({ code: "INTERNAL_ERROR" });

    const after = await database.query<{
      balance: number;
      calculations: number;
      carbon_entries: number;
      point_entries: number;
      claims: number;
      bindings: number;
      idempotency_records: number;
    }>(
      `select
         (select balance from point_balances where user_id=$1) balance,
         (select count(*)::int from calculation_snapshots) calculations,
         (select count(*)::int from carbon_ledger) carbon_entries,
         (select count(*)::int from point_ledger) point_entries,
         (select count(*)::int from claims where user_id=$1 and idempotency_key='calculation-no-returning-id') claims,
         (select count(*)::int from claim_evidence where evidence_id=$2) bindings,
         (select count(*)::int from idempotency_records where key='calculation-no-returning-id') idempotency_records`,
      [demoIds.user, evidence.evidenceId],
    );
    expect(after.rows[0]).toEqual({
      ...before.rows[0],
      claims: 0,
      bindings: 0,
      idempotency_records: 0,
    });
  });

  it("replays a matching idempotent tree request and rejects a changed request", async () => {
    await removeMockApproval("tree");
    const raw = Buffer.from("idempotency photo");
    const sha256 = digest(raw);
    const init = await request(app.getHttpServer()).post("/api/evidence/init").set(bearer(user)).send({ kind: "photo", mimeType: "image/jpeg", sizeBytes: raw.length, sha256, capture: { capturedAt: new Date().toISOString(), camera: { make: "Test", model: "Camera" }, latitude: 13.7649, longitude: 100.5383 } }).expect(201);
    await request(app.getHttpServer()).post(`/api/evidence/${init.body.uploadId}/content`).set(bearer(user)).set("x-upload-token", init.body.uploadToken).set("content-type", "image/jpeg").send(raw).expect(201);
    const evidence = await request(app.getHttpServer()).post(`/api/evidence/${init.body.uploadId}/finalize`).set(bearer(user)).send({ sha256 }).expect(201);
    const body = { evidenceIds: [evidence.body.evidenceId], speciesThaiName: "ต้นไม้ทดสอบ", plantedAt: new Date().toISOString(), quantity: 1, latitude: "13.7649", longitude: "100.5383", demoAiResult: "pass" };
    const first = await request(app.getHttpServer()).post("/api/actions/tree").set(bearer(user)).set("idempotency-key", "same-key").send(body).expect(201);
    expect(first.body.claim.impact_status).toBe("blocked_factor_approval");
    const factors = await request(app.getHttpServer()).get("/api/admin/factors").set(bearer(admin)).expect(200);
    const treeFactor = factors.body.items.find((factor: { activity: string }) => factor.activity === "tree");
    await request(app.getHttpServer()).patch(`/api/admin/factors/${treeFactor.id}/approve`).set(bearer(admin)).send({}).expect(200);
    const replay = await request(app.getHttpServer()).post("/api/actions/tree").set(bearer(user)).set("idempotency-key", "same-key").send(body).expect(201);
    expect(replay.body).toEqual(first.body);
    const current = await request(app.getHttpServer()).get("/api/claims").set(bearer(user)).expect(200);
    expect(current.body.items[0].claim.impact_status).toBe("credited");
    await request(app.getHttpServer()).post("/api/actions/tree").set(bearer(user)).set("idempotency-key", "same-key").send({ ...body, speciesThaiName: "ต้นไม้อื่น" }).expect(409);
  });

  it("retains irreversible tree duplicate signals after raw evidence is purged", async () => {
    const body = Buffer.from("same tree image");
    const firstCapturedAt = new Date().toISOString();
    const firstEvidence = await uploadTestEvidence(app, user, {
      kind: "photo",
      mimeType: "image/jpeg",
      body,
      capture: { capturedAt: firstCapturedAt, camera: { make: "Test", model: "Camera" }, latitude: 13.7649, longitude: 100.5383 },
    });
    const first = await request(app.getHttpServer()).post("/api/actions/tree").set(bearer(user)).set("idempotency-key", "tree-before-purge").send({
      evidenceIds: [firstEvidence.evidenceId],
      speciesThaiName: "ต้นไม้เดิม",
      plantedAt: firstCapturedAt,
      quantity: 1,
      latitude: "13.7649",
      longitude: "100.5383",
      demoAiResult: "pass",
    }).expect(201);
    expect(first.body.claim.status).toBe("verified");
    const factors = await request(app.getHttpServer()).get("/api/admin/factors").set(bearer(admin)).expect(200);
    const tree = factors.body.items.find((factor: { activity: string }) => factor.activity === "tree");
    await request(app.getHttpServer()).patch(`/api/admin/factors/${tree.id}/approve`).set(bearer(admin)).send({}).expect(200);
    await app.get(DatabaseService).query(
      `update evidence
       set deleted_at=now(),tombstoned_at=now(),object_key='tombstoned/' || id::text,
           content_type=null,sha256=null,captured_at=null,location=null
       where id=$1`,
      [firstEvidence.evidenceId],
    );

    const secondCapturedAt = new Date().toISOString();
    const secondEvidence = await uploadTestEvidence(app, user, {
      kind: "photo",
      mimeType: "image/jpeg",
      body,
      capture: { capturedAt: secondCapturedAt, camera: { make: "Test", model: "Camera" }, latitude: 13.7649, longitude: 100.5383 },
    });
    const second = await request(app.getHttpServer()).post("/api/actions/tree").set(bearer(user)).set("idempotency-key", "tree-after-purge").send({
      evidenceIds: [secondEvidence.evidenceId],
      speciesThaiName: "ต้นไม้เดิม",
      plantedAt: secondCapturedAt,
      quantity: 1,
      latitude: "13.7649",
      longitude: "100.5383",
      demoAiResult: "pass",
    }).expect(201);
    expect(second.body.claim).toMatchObject({ status: "pending_review", reason_code: "tree_ambiguous", awarded_points: 0 });
    const valueRows = await app.get(DatabaseService).query<{ calculations: number; point_entries: number }>(
      `select
         (select count(*)::int from calculation_snapshots where claim_id in ($1,$2)) calculations,
         (select count(*)::int from point_ledger where claim_id in ($1,$2) and kind='credit') point_entries`,
      [first.body.claim.id, second.body.claim.id],
    );
    expect(valueRows.rows[0]).toEqual({ calculations: 1, point_entries: 1 });
  });

  it("records a clear wrong-type tree image as an AI rejection rather than a duplicate", async () => {
    const capturedAt = new Date().toISOString();
    const evidence = await uploadTestEvidence(app, user, {
      kind: "photo",
      mimeType: "image/jpeg",
      body: Buffer.from("wrong tree type"),
      capture: {
        capturedAt,
        camera: { make: "Test", model: "Wrong type" },
        latitude: 13.7649,
        longitude: 100.5383,
      },
    });
    const response = await request(app.getHttpServer())
      .post("/api/actions/tree")
      .set(bearer(user))
      .set("idempotency-key", "tree-wrong-type")
      .send({
        evidenceIds: [evidence.evidenceId],
        speciesThaiName: "ไม่ใช่ต้นไม้",
        plantedAt: capturedAt,
        quantity: 1,
        latitude: "13.7649",
        longitude: "100.5383",
        demoAiResult: "wrong_type",
      })
      .expect(201);
    expect(response.body.claim).toMatchObject({ status: "rejected", reason_code: "tree_wrong_type" });
    const result = await app.get(DatabaseService).query<{ outcome: string }>(
      "select outcome from tree_ai_results where claim_id=$1",
      [response.body.claim.id],
    );
    expect(result.rows[0]?.outcome).toBe("reject");
  });

  it("serializes physical bus duplicates across fresh claim and evidence IDs", async () => {
    const factors = await request(app.getHttpServer()).get("/api/admin/factors").set(bearer(admin)).expect(200);
    const busFactor = factors.body.items.find((factor: { activity: string }) => factor.activity === "bus");
    await request(app.getHttpServer()).patch(`/api/admin/factors/${busFactor.id}/approve`).set(bearer(admin)).send({}).expect(200);
    const start = Date.now() - 180_000;
    const longitudes = [100.535, 100.5358, 100.53735, 100.5387, 100.5395, 100.54105, 100.5424];
    const samples = longitudes.map((longitude, index) => ({
      sampleId: `sample-${index}`,
      recordedAt: new Date(start + index * 30_000).toISOString(),
      latitude: "13.7649",
      longitude: longitude.toFixed(5),
      accuracyMeters: "5",
    }));
    const paddedSamples = samples.flatMap((sample, index) => [
      sample,
      {
        ...sample,
        sampleId: `padding-${index}`,
        recordedAt: new Date(new Date(sample.recordedAt).getTime() + 1_000).toISOString(),
        accuracyMeters: "10",
      },
    ]);
    const trace = Buffer.from(JSON.stringify(samples));
    const paddedTrace = Buffer.from(JSON.stringify(paddedSamples));
    const [firstEvidence, secondEvidence] = await Promise.all([
      uploadTestEvidence(app, user, { kind: "gps_trace", mimeType: "application/json", body: trace, capture: { capturedAt: samples[0]!.recordedAt, latitude: 13.7649, longitude: 100.535 } }),
      uploadTestEvidence(app, user, { kind: "gps_trace", mimeType: "application/json", body: paddedTrace, capture: { capturedAt: samples[0]!.recordedAt, latitude: 13.7649, longitude: 100.535 } }),
    ]);
    const submit = (key: string, evidenceId: string, submittedSamples: typeof samples) => request(app.getHttpServer()).post("/api/actions/bus").set(bearer(user)).set("idempotency-key", key).send({
      evidenceIds: [evidenceId],
      routeName: "DEMO-BUS-01",
      boardedAt: samples[0]!.recordedAt,
      alightedAt: samples.at(-1)!.recordedAt,
      samples: submittedSamples,
    });
    const responses = await Promise.all([
      submit("bus-physical-a", firstEvidence.evidenceId, samples),
      submit("bus-physical-b", secondEvidence.evidenceId, paddedSamples),
    ]);
    expect(responses.map(response => response.status)).toEqual([201, 201]);
    expect(responses.map(response => response.body.claim.status).sort()).toEqual(["rejected", "verified"]);
    expect(responses.find(response => response.body.claim.status === "rejected")?.body.claim.reason_code).toBe("duplicate_evidence");
    const values = await app.get(DatabaseService).query<{ calculations: number; carbon_entries: number; fingerprints: number }>(
      `select
         (select count(*)::int from calculation_snapshots where claim_id=any($1::uuid[])) calculations,
         (select count(*)::int from carbon_ledger where claim_id=any($1::uuid[])) carbon_entries,
         (select count(*)::int from fingerprints where claim_id=any($1::uuid[]) and type='trip') fingerprints`,
      [responses.map(response => response.body.claim.id)],
    );
    expect(values.rows[0]).toEqual({ calculations: 1, carbon_entries: 1, fingerprints: 1 });
  });

  it("re-evaluates a pending bus claim in place and credits it only once", async () => {
    const factors = await request(app.getHttpServer()).get("/api/admin/factors").set(bearer(admin)).expect(200);
    const busFactor = factors.body.items.find((factor: { activity: string }) => factor.activity === "bus");
    await request(app.getHttpServer()).patch(`/api/admin/factors/${busFactor.id}/approve`).set(bearer(admin)).send({}).expect(200);

    const start = Date.now() - 180_000;
    const longitudes = [100.535, 100.5358, 100.53735, 100.5387, 100.5395, 100.54105, 100.5424];
    const completeSamples = longitudes.map((longitude, index) => ({
      sampleId: `retry-sample-${index}`,
      recordedAt: new Date(start + index * 30_000).toISOString(),
      latitude: "13.7649",
      longitude: longitude.toFixed(5),
      accuracyMeters: "5",
    }));
    const sparseSamples = [completeSamples[0]!, completeSamples.at(-1)!];
    const [sparseEvidence, completeEvidence] = await Promise.all([
      uploadTestEvidence(app, user, {
        kind: "gps_trace",
        mimeType: "application/json",
        body: Buffer.from(JSON.stringify(sparseSamples)),
        capture: { capturedAt: sparseSamples[0]!.recordedAt, latitude: 13.7649, longitude: 100.535 },
      }),
      uploadTestEvidence(app, user, {
        kind: "gps_trace",
        mimeType: "application/json",
        body: Buffer.from(JSON.stringify(completeSamples)),
        capture: { capturedAt: completeSamples[0]!.recordedAt, latitude: 13.7649, longitude: 100.535 },
      }),
    ]);
    const shared = {
      routeName: "DEMO-BUS-01",
      boardedAt: completeSamples[0]!.recordedAt,
      alightedAt: completeSamples.at(-1)!.recordedAt,
    };
    const pending = await request(app.getHttpServer())
      .post("/api/actions/bus")
      .set(bearer(user))
      .set("idempotency-key", "bus-retry-pending")
      .send({ ...shared, evidenceIds: [sparseEvidence.evidenceId], samples: sparseSamples })
      .expect(201);
    expect(pending.body.claim).toMatchObject({ status: "pending", reason_code: "bus_insufficient_coverage", awarded_points: 0 });

    const retryBody = { ...shared, evidenceIds: [completeEvidence.evidenceId], samples: completeSamples };
    const verified = await request(app.getHttpServer())
      .post(`/api/actions/bus/${pending.body.claim.id}/retry`)
      .set(bearer(user))
      .set("idempotency-key", "bus-retry-verified")
      .send(retryBody)
      .expect(201);
    expect(verified.body.claim).toMatchObject({ id: pending.body.claim.id, status: "verified", reason_code: "reviewer_confirmed" });

    const replay = await request(app.getHttpServer())
      .post(`/api/actions/bus/${pending.body.claim.id}/retry`)
      .set(bearer(user))
      .set("idempotency-key", "bus-retry-verified")
      .send(retryBody)
      .expect(201);
    expect(replay.body).toEqual(verified.body);

    const values = await app.get(DatabaseService).query<{
      calculations: number;
      carbon_entries: number;
      claim_rows: number;
      evidence_bindings: number;
      fingerprints: number;
      point_credits: number;
    }>(
      `select
         (select count(*)::int from claims where id=$1) claim_rows,
         (select count(*)::int from calculation_snapshots where claim_id=$1) calculations,
         (select count(*)::int from carbon_ledger where claim_id=$1) carbon_entries,
         (select count(*)::int from point_ledger where claim_id=$1 and kind='credit') point_credits,
         (select count(*)::int from fingerprints where claim_id=$1 and type='trip') fingerprints,
         (select count(*)::int from claim_evidence where claim_id=$1) evidence_bindings`,
      [pending.body.claim.id],
    );
    expect(values.rows[0]).toEqual({
      calculations: 1,
      carbon_entries: 1,
      claim_rows: 1,
      evidence_bindings: 2,
      fingerprints: 1,
      point_credits: 0,
    });
  });

  it("auto-verifies demo recycling from its QR submission and preserves the bus pending boundary path", async () => {
    const photo = Buffer.from("recycling photo");
    const photoHash = digest(photo);
    const photoInit = await request(app.getHttpServer()).post("/api/evidence/init").set(bearer(user)).send({ kind: "photo", mimeType: "image/jpeg", sizeBytes: photo.length, sha256: photoHash, capture: { capturedAt: new Date().toISOString(), camera: { make: "Test", model: "Camera" } } }).expect(201);
    await request(app.getHttpServer()).post(`/api/evidence/${photoInit.body.uploadId}/content`).set(bearer(user)).set("x-upload-token", photoInit.body.uploadToken).set("content-type", "image/jpeg").send(photo).expect(201);
    const photoEvidence = await request(app.getHttpServer()).post(`/api/evidence/${photoInit.body.uploadId}/finalize`).set(bearer(user)).send({ sha256: photoHash }).expect(201);
    const recycling = await request(app.getHttpServer()).post("/api/actions/recycling").set(bearer(user)).set("idempotency-key", "recycling-review-flow").send({ evidenceIds: [photoEvidence.body.evidenceId], binCode: "DEMO-BIN-BKK-01:TOKEN-0001", material: "plastic", itemCount: 2, droppedOffAt: new Date().toISOString() }).expect(201);
    expect(recycling.body.claim).toMatchObject({ status: "verified", impact_status: "credited" });
    const declaration = await app.get(DatabaseService).query<{ declared_count: number; approved_count: number }>(
      "select declared_count,approved_count from recycling_declarations where claim_id=$1",
      [recycling.body.claim.id],
    );
    expect(declaration.rows[0]).toEqual({ declared_count: 2, approved_count: 2 });
    await request(app.getHttpServer()).patch(`/api/review/claims/${recycling.body.claim.id}`).set(bearer(reviewer)).send({ decision: "approve", approvedItemCount: 2 }).expect(409);

    const samples = [{ recordedAt: new Date(Date.now() - 120_000).toISOString(), latitude: "13.7649", longitude: "100.5350", accuracyMeters: "5" }, { recordedAt: new Date(Date.now() - 60_000).toISOString(), latitude: "13.7649", longitude: "100.5387", accuracyMeters: "5" }];
    const trace = Buffer.from(JSON.stringify(samples));
    const traceHash = digest(trace);
    const traceInit = await request(app.getHttpServer()).post("/api/evidence/init").set(bearer(user)).send({ kind: "gps_trace", mimeType: "application/json", sizeBytes: trace.length, sha256: traceHash, capture: { capturedAt: new Date().toISOString() } }).expect(201);
    await request(app.getHttpServer()).post(`/api/evidence/${traceInit.body.uploadId}/content`).set(bearer(user)).set("x-upload-token", traceInit.body.uploadToken).set("content-type", "application/json").send(trace.toString("utf8")).expect(201);
    const traceEvidence = await request(app.getHttpServer()).post(`/api/evidence/${traceInit.body.uploadId}/finalize`).set(bearer(user)).send({ sha256: traceHash }).expect(201);
    await app.get(DatabaseService).query("insert into routes(code,version,is_demo) values('TEST-NO-CORRIDOR',1,true)");
    const bus = await request(app.getHttpServer()).post("/api/actions/bus").set(bearer(user)).set("idempotency-key", "bus-pending-boundary").send({ evidenceIds: [traceEvidence.body.evidenceId], routeName: "TEST-NO-CORRIDOR", boardedAt: new Date(Date.now() - 120_000).toISOString(), alightedAt: new Date().toISOString(), samples });
    expect(bus.status, JSON.stringify(bus.body)).toBe(201);
    expect(bus.body.claim).toMatchObject({ status: "pending", reason_code: "bus_insufficient_coverage" });
    await request(app.getHttpServer())
      .patch(`/api/review/claims/${bus.body.claim.id}`)
      .set(bearer(reviewer))
      .send({ decision: "approve" })
      .expect(409);
    const unchanged = await app.get(DatabaseService).query<{ state: string; credits: number }>(
      `select claim.state::text,
              (select count(*)::int from point_ledger where claim_id=claim.id and kind='credit') credits
       from claims claim where claim.id=$1`,
      [bus.body.claim.id],
    );
    expect(unchanged.rows[0]).toEqual({ state: "pending", credits: 0 });
  });
});

if (!process.env.TEST_DATABASE_URL) describe("real API flow configuration", () => it.skip("requires TEST_DATABASE_URL and object-storage test settings", () => undefined));
