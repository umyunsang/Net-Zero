import { createHash } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";

import { DatabaseService } from "../../src/database/database.service.js";
import { ObjectStorageService } from "../../src/evidence/object-storage.service.js";
import { bearer, createTestApp, describeIntegration, login, resetPublicData, uploadTestEvidence } from "../helpers/test-app.js";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describeIntegration("privacy retention", () => {
  let app: NestFastifyApplication;
  let user: string;
  let reviewer: string;
  let database: DatabaseService;

  beforeAll(async () => { await resetPublicData(); app = await createTestApp(); database = app.get(DatabaseService); });
  beforeEach(async () => { await resetPublicData(); user = await login(app, "user"); reviewer = await login(app, "reviewer"); });
  afterAll(async () => { await app?.close(); });

  it("denies the token immediately after account deletion and tombstones the account's evidence", async () => {
    const uploaded = await uploadTestEvidence(app, user, {
      kind: "photo",
      mimeType: "image/jpeg",
      body: Buffer.from("evidence to delete"),
      capture: { capturedAt: new Date().toISOString(), camera: { make: "Test", model: "Camera" } },
    });
    const before = await database.query<{ object_key: string }>("select object_key from evidence where id=$1", [uploaded.evidenceId]);
    const objectKey = before.rows[0]!.object_key;
    await request(app.getHttpServer()).get(`/api/evidence/${uploaded.evidenceId}/content`).set(bearer(reviewer)).expect(403);
    await request(app.getHttpServer()).delete("/api/account").set(bearer(user)).expect(200);
    await request(app.getHttpServer()).get("/api/claims").set(bearer(user)).expect(401);
    await request(app.getHttpServer()).get(`/api/evidence/${uploaded.evidenceId}/content`).set(bearer(reviewer)).expect(404);
    const deleted = await database.query<{ account_deletion_state: string; deleted_at: Date | null }>("select account_deletion_state,deleted_at from users where id=$1", ["11111111-1111-4111-8111-111111111111"]);
    expect(deleted.rows[0]).toMatchObject({ account_deletion_state: "deleted" });
    expect(deleted.rows[0]?.deleted_at).not.toBeNull();
    const evidence = await database.query<{ object_key: string; content_type: string | null; sha256: string | null; captured_at: Date | null; fingerprints: number }>(
      `select evidence.object_key,evidence.content_type,evidence.sha256,evidence.captured_at,
              count(fingerprint.evidence_id)::int fingerprints
       from evidence
       left join evidence_fingerprints fingerprint on fingerprint.evidence_id=evidence.id
       where evidence.id=$1
       group by evidence.id`,
      [uploaded.evidenceId],
    );
    expect(evidence.rows[0]).toMatchObject({
      object_key: `tombstoned/${uploaded.evidenceId}`,
      content_type: null,
      sha256: null,
      captured_at: null,
      fingerprints: 1,
    });
    await expect(app.get(ObjectStorageService).get(objectKey)).rejects.toThrow();
  });

  it("revokes privileged reads while a failed physical deletion remains retryable", async () => {
    const uploaded = await uploadTestEvidence(app, user, {
      kind: "photo",
      mimeType: "image/jpeg",
      body: Buffer.from("retry deletion evidence"),
      capture: { capturedAt: new Date().toISOString(), camera: { make: "Test", model: "Camera" } },
    });
    const storage = app.get(ObjectStorageService);
    const deletion = vi.spyOn(storage, "delete").mockRejectedValueOnce(new Error("storage unavailable"));
    await request(app.getHttpServer()).delete("/api/account").set(bearer(user)).expect(409);
    const deleting = await database.query<{ account_deletion_state: string }>("select account_deletion_state from users where id='11111111-1111-4111-8111-111111111111'");
    expect(deleting.rows[0]?.account_deletion_state).toBe("deleting");
    await request(app.getHttpServer()).get(`/api/evidence/${uploaded.evidenceId}/content`).set(bearer(reviewer)).expect(404);
    await request(app.getHttpServer()).get("/api/claims").set(bearer(user)).expect(401);
    deletion.mockRestore();
    await request(app.getHttpServer()).delete("/api/account").set(bearer(user)).expect(200);
  });

  it("sets evidence expiry exactly 30 days after a claim reaches a terminal state", async () => {
    const fixture = await database.query<{ claim_id: string; evidence_id: string }>(`
      with draft as (insert into claim_drafts(user_id) values ('11111111-1111-4111-8111-111111111111') returning id),
      session as (insert into upload_sessions(user_id,claim_draft_id,object_key,content_type,byte_size,expected_sha256,state,kind,captured_at,camera_make,camera_model,expires_at,orphan_eligible_at)
        select '11111111-1111-4111-8111-111111111111',id,'retention/' || gen_random_uuid(),'image/jpeg',1,repeat('a',64),'finalized','photo',now(),'Test','Camera',now()+interval '1 hour',now()+interval '1 day' from draft returning id,claim_draft_id,object_key),
      proof as (insert into evidence(user_id,upload_session_id,claim_draft_id,kind,object_key,content_type,sha256,captured_at)
        select '11111111-1111-4111-8111-111111111111',id,claim_draft_id,'photo',object_key,'image/jpeg',repeat('a',64),now() from session returning id),
      claim as (insert into claims(user_id,activity,state,idempotency_scope,idempotency_key,request_digest) values ('11111111-1111-4111-8111-111111111111','tree','pending_review','retention','retention-key',repeat('b',64)) returning id)
      insert into claim_evidence(claim_id,evidence_id) select claim.id,proof.id from claim,proof returning claim_id,evidence_id`);
    const claimId = fixture.rows[0]?.claim_id;
    await database.query("update claims set state='rejected',decided_at=now() where id=$1", [claimId]);
    const expiry = await database.query<{ expires_in_days: number }>("select round(extract(epoch from (expires_at-decided_at))/86400)::int expires_in_days from evidence join claim_evidence on evidence.id=claim_evidence.evidence_id join claims on claims.id=claim_evidence.claim_id where claims.id=$1", [claimId]);
    expect(expiry.rows[0]?.expires_in_days).toBe(30);
  });

  it("serializes an in-flight upload before account deletion and removes the uploaded object", async () => {
    const raw = Buffer.from("upload and deletion race");
    const sha256 = createHash("sha256").update(raw).digest("hex");
    const initialized = await request(app.getHttpServer()).post("/api/evidence/init").set(bearer(user)).send({
      kind: "photo",
      mimeType: "image/jpeg",
      sizeBytes: raw.length,
      sha256,
      capture: { capturedAt: new Date().toISOString(), camera: { make: "Test", model: "Race" } },
    }).expect(201);
    const storage = app.get(ObjectStorageService);
    const enteredStorage = deferred();
    const releaseStorage = deferred();
    const originalPutStream = storage.putStream.bind(storage);
    const put = vi.spyOn(storage, "putStream").mockImplementation(async (...args) => {
      enteredStorage.resolve();
      await releaseStorage.promise;
      await originalPutStream(...args);
    });
    const uploadPromise = request(app.getHttpServer())
      .post(`/api/evidence/${initialized.body.uploadId}/content`)
      .set(bearer(user))
      .set("x-upload-token", initialized.body.uploadToken)
      .set("content-type", "image/jpeg")
      .send(raw)
      .then((response) => response);
    await enteredStorage.promise;
    let deletionSettled = false;
    const deletionPromise = request(app.getHttpServer())
      .delete("/api/account")
      .set(bearer(user))
      .then((response) => {
        deletionSettled = true;
        return response;
      });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(deletionSettled).toBe(false);
    releaseStorage.resolve();
    expect((await uploadPromise).status).toBe(201);
    expect((await deletionPromise).status).toBe(200);
    put.mockRestore();
    const session = await database.query<{ object_key: string }>("select object_key from upload_sessions where id=$1", [initialized.body.uploadId]);
    expect(session.rows[0]?.object_key).toBe(`tombstoned/${initialized.body.uploadId}`);
  });

  it("lets an authorized read finish before deletion and denies every later privileged read", async () => {
    const uploaded = await uploadTestEvidence(app, user, {
      kind: "photo",
      mimeType: "image/jpeg",
      body: Buffer.from("read and deletion race"),
      capture: { capturedAt: new Date().toISOString(), camera: { make: "Test", model: "Race" } },
    });
    await database.query(
      `with claim as (
         insert into claims(
           user_id,activity,state,impact_status,idempotency_scope,idempotency_key,
           request_digest,reason_code
         ) values(
           '11111111-1111-4111-8111-111111111111','tree','pending_review','pending',
           'tree','read-race',repeat('d',64),'tree_ambiguous'
         ) returning id
       )
       insert into claim_evidence(claim_id,evidence_id)
       select claim.id,$1 from claim`,
      [uploaded.evidenceId],
    );
    const storage = app.get(ObjectStorageService);
    const enteredStorage = deferred();
    const releaseStorage = deferred();
    const originalGet = storage.get.bind(storage);
    const get = vi.spyOn(storage, "get").mockImplementation(async (...args) => {
      enteredStorage.resolve();
      await releaseStorage.promise;
      return originalGet(...args);
    });
    const readPromise = request(app.getHttpServer())
      .get(`/api/evidence/${uploaded.evidenceId}/content`)
      .set(bearer(reviewer))
      .then((response) => response);
    await enteredStorage.promise;
    let deletionSettled = false;
    const deletionPromise = request(app.getHttpServer())
      .delete("/api/account")
      .set(bearer(user))
      .then((response) => {
        deletionSettled = true;
        return response;
      });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(deletionSettled).toBe(false);
    releaseStorage.resolve();
    expect((await readPromise).status).toBe(200);
    expect((await deletionPromise).status).toBe(200);
    get.mockRestore();
    await request(app.getHttpServer()).get(`/api/evidence/${uploaded.evidenceId}/content`).set(bearer(reviewer)).expect(404);
  });
});

if (!process.env.TEST_DATABASE_URL) describe("privacy retention configuration", () => it.skip("requires TEST_DATABASE_URL and object-storage test settings", () => undefined));
