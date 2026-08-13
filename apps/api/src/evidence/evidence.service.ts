import { ConflictException, ForbiddenException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { Readable, Transform } from "node:stream";
import type { PoolClient } from "pg";

import { getConfig } from "../config.js";
import { DatabaseService } from "../database/database.service.js";
import { ObjectStorageService } from "./object-storage.service.js";
import type { EvidenceInit, EvidenceSession } from "./evidence.types.js";

type SessionRow = EvidenceSession;
type EvidenceRow = { userId: string; objectKey: string; contentType: string; deletedAt: Date | null; expiresAt: Date | null };
const digest = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");

@Injectable()
export class EvidenceService {
  private readonly logger = new Logger(EvidenceService.name);

  private readonly config = getConfig();
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(ObjectStorageService) private readonly storage: ObjectStorageService,
  ) {}

  async init(userId: string, input: EvidenceInit) {
    if (input.sizeBytes > this.config.EVIDENCE_UPLOAD_MAX_BYTES) throw this.invalid("ขนาดไฟล์หลักฐานเกินขีดจำกัด");
    const capturedAt = new Date(input.capture.capturedAt);
    return this.database.transaction(async (client) => {
      await this.lockActiveUser(client, userId);
      const owner = await client.query<{ is_demo: boolean }>("select is_demo from users where id=$1", [userId]);
      const isKnownFixture = this.config.MOCK_DEMO_ENABLED
        && owner.rows[0]?.is_demo === true
        && input.fixtureId === "FIXTURE-BKK-20260812-01";
      if (input.fixtureId !== undefined && !isKnownFixture) {
        throw this.invalid("fixtureId ไม่ได้รับอนุญาตสำหรับขอบเขตบัญชีนี้");
      }
      if (!isKnownFixture && (capturedAt.getTime() > Date.now() + 5 * 60_000 || capturedAt.getTime() < Date.now() - 24 * 60 * 60_000)) {
        throw this.invalid("เวลาบันทึกหลักฐานอยู่นอกช่วงที่อนุญาต");
      }
      const draftId = await this.lockOrCreateDraft(client, userId, input.claimDraftId);
      const id = randomUUID();
      const token = randomBytes(32).toString("base64url");
      const expiresAt = new Date(Date.now() + 15 * 60_000);
      await client.query(
        `insert into upload_sessions
          (id,user_id,claim_draft_id,object_key,content_type,byte_size,expected_sha256,upload_token_hash,state,kind,captured_at,camera_make,camera_model,fixture_id,latitude,longitude,expires_at,orphan_eligible_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,'draft',$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
        [id, userId, draftId, `evidence/${userId}/${id}`, input.mimeType, input.sizeBytes, input.sha256, digest(token), input.kind, input.capture.capturedAt, input.capture.camera?.make ?? null, input.capture.camera?.model ?? null, input.fixtureId ?? null, input.capture.latitude ?? null, input.capture.longitude ?? null, expiresAt, new Date(Date.now() + 24 * 60 * 60_000)],
      );
      return { uploadId: id, uploadToken: token, expiresAt: expiresAt.toISOString(), claimDraftId: draftId };
    });
  }

  /** Holds the user then session locks for the storage write: deletion cannot succeed ahead of this write. */
  async upload(userId: string, uploadId: string, token: string, contentType: string | undefined, body: Buffer | Readable) {
    if (Buffer.isBuffer(body) && body.length > this.config.EVIDENCE_UPLOAD_MAX_BYTES) throw this.invalid("ขนาดไฟล์หลักฐานเกินขีดจำกัด");
    return this.database.transaction(async (client) => {
      await this.lockActiveUser(client, userId);
      const session = await this.lockSession(client, uploadId);
      this.assertUpload(session, userId, token, contentType);
      await client.query("update upload_sessions set state = 'uploading' where id = $1", [session.id]);
      const hash = createHash("sha256");
      let byteSize = 0;
      const verifier = new Transform({
        transform: (chunk: Buffer, _encoding, callback) => {
          byteSize += chunk.length;
          if (byteSize > this.config.EVIDENCE_UPLOAD_MAX_BYTES || byteSize > session.byteSize) {
            callback(new Error("upload_size_mismatch"));
            return;
          }
          hash.update(chunk);
          callback(null, chunk);
        },
      });
      const source = Buffer.isBuffer(body) ? Readable.from([body]) : body;
      try {
        await this.storage.putStream(
          session.objectKey,
          source.pipe(verifier),
          session.contentType,
          session.byteSize,
          session.expectedSha256,
        );
      } catch (uploadError) {
        let cleanupOutcome: "deleted" | "delete_failed" = "deleted";
        let cleanupErrorName: string | null = null;
        try {
          await this.storage.delete(session.objectKey);
        } catch (cleanupError) {
          cleanupOutcome = "delete_failed";
          cleanupErrorName = cleanupError instanceof Error ? cleanupError.name : typeof cleanupError;
        }
        this.logger.error(JSON.stringify({
          event: "evidence.upload.storage_failed",
          uploadId: session.id,
          uploadErrorName: uploadError instanceof Error ? uploadError.name : typeof uploadError,
          cleanupOutcome,
          cleanupErrorName,
        }));
        // Rollback restores draft/token; no storage key is ever exposed by the API.
        throw new ConflictException({ code: "UPLOAD_INVALID", message: "จัดเก็บไฟล์หลักฐานไม่สำเร็จ โปรดลองอีกครั้ง" });
      }
      const actualDigest = hash.digest("hex");
      if (byteSize !== session.byteSize || !sameDigest(session.expectedSha256, actualDigest)) {
        await this.storage.delete(session.objectKey);
        throw this.invalid("ชนิด ขนาด หรือ SHA-256 ของไฟล์หลักฐานไม่ตรงกัน");
      }
      await client.query("update upload_sessions set state = 'uploaded', uploaded_at = now(), upload_token_hash = null where id = $1", [session.id]);
      return { uploadId: session.id, status: "uploaded" as const };
    });
  }

  async finalize(userId: string, uploadId: string, submittedDigest: string) {
    const outcome = await this.database.transaction(async (client) => {
      await this.lockActiveUser(client, userId);
      const session = await this.lockSession(client, uploadId);
      if (session.userId !== userId) throw new ForbiddenException({ code: "FORBIDDEN", message: "ไม่มีสิทธิ์ยืนยันหลักฐานนี้" });
      if (!sameDigest(session.expectedSha256, submittedDigest)) throw new ConflictException({ code: "CONFLICT", message: "SHA-256 สำหรับยืนยันไม่ตรงกับเซสชัน" });
      if (session.state === "finalized" && session.evidenceId) return { evidenceId: session.evidenceId, status: "ready" as const };
      if (session.state !== "uploaded") throw this.invalid("ไฟล์หลักฐานยังไม่พร้อมยืนยัน");
      const stored = await this.storage.get(session.objectKey);
      if (
        stored.contentType !== session.contentType ||
        stored.body.length !== session.byteSize ||
        !sameDigest(session.expectedSha256, digest(stored.body))
      ) {
        await this.storage.delete(session.objectKey);
        await client.query(
          "update upload_sessions set state='failed',upload_token_hash=null,completed_at=now() where id=$1",
          [session.id],
        );
        return { integrityError: true as const };
      }
      const result = await client.query<{ id: string }>(
        `insert into evidence (
           user_id,data_scope,is_mock,is_synthetic,demo_only,fixture_id,
           upload_session_id,claim_draft_id,kind,object_key,content_type,sha256,captured_at,location,expires_at
         )
         select session.user_id,account.data_scope,account.is_mock,$2::boolean,account.demo_only,$3,
           session.id,session.claim_draft_id,session.kind,session.object_key,session.content_type,session.expected_sha256,session.captured_at,
           case when latitude is null then null else ST_SetSRID(ST_MakePoint(longitude,latitude),4326)::geography end,
           now() + interval '30 days'
         from upload_sessions session join users account on account.id=session.user_id
         where session.id = $1 returning id`,
        [session.id, session.fixtureId !== null, session.fixtureId],
      );
      const evidenceId = result.rows[0]?.id;
      if (!evidenceId) throw new Error("ไม่สามารถยืนยันหลักฐานได้");
      const keys = [
        { id: this.config.FINGERPRINT_KEY_ID, key: this.config.FINGERPRINT_HMAC_KEY },
        ...(this.config.FINGERPRINT_PREVIOUS_KEY_ID && this.config.FINGERPRINT_PREVIOUS_HMAC_KEY
          ? [{ id: this.config.FINGERPRINT_PREVIOUS_KEY_ID, key: this.config.FINGERPRINT_PREVIOUS_HMAC_KEY }]
          : []),
      ];
      for (const key of keys) {
        const fingerprint = createHmac("sha256", key.key)
          .update(`evidence:${session.expectedSha256}`)
          .digest("hex");
        await client.query(
          "insert into evidence_fingerprints(evidence_id,fingerprint_type,key_id,digest) values($1,'hmac-sha256',$2,$3)",
          [evidenceId, key.id, fingerprint],
        );
      }
      await client.query("update upload_sessions set state = 'finalized', evidence_id = $2, finalized_at = now(), completed_at = now() where id = $1", [session.id, evidenceId]);
      return { evidenceId, status: "ready" as const };
    });
    if ("integrityError" in outcome) {
      throw new ConflictException({ code: "UPLOAD_INVALID", message: "ไฟล์ที่จัดเก็บไม่ตรงกับชนิด ขนาด หรือ SHA-256 ที่ยืนยัน" });
    }
    return outcome;
  }

  async content(userId: string, evidenceId: string) {
    const ownerLookup = await this.database.query<{ user_id: string }>(
      "select user_id from evidence where id=$1",
      [evidenceId],
    );
    const ownerId = ownerLookup.rows[0]?.user_id;
    if (!ownerId) throw new NotFoundException({ code: "NOT_FOUND", message: "ไม่พบหลักฐานหรือหลักฐานหมดอายุแล้ว" });
    return this.database.transaction(async (client) => {
      const accounts = await client.query<{ id: string; role: string; is_demo: boolean; account_deletion_state: string; deleted_at: Date | null }>(
        `select id,role::text,is_demo,account_deletion_state,deleted_at
         from users where id=any($1::uuid[])
         order by id for update`,
        [[...new Set([userId, ownerId])].sort()],
      );
      const actor = accounts.rows.find(account => account.id === userId);
      const owner = accounts.rows.find(account => account.id === ownerId);
      if (!actor || actor.deleted_at || actor.account_deletion_state !== "active") {
        throw new ForbiddenException({ code: "FORBIDDEN", message: "บัญชีถูกลบหรืออยู่ระหว่างการลบ" });
      }
      if (!owner || owner.deleted_at || owner.account_deletion_state !== "active") {
        throw new NotFoundException({ code: "NOT_FOUND", message: "ไม่พบหลักฐานหรือหลักฐานหมดอายุแล้ว" });
      }
      const result = await client.query<EvidenceRow>(
        `select user_id as "userId",object_key as "objectKey",content_type as "contentType",deleted_at as "deletedAt",expires_at as "expiresAt"
         from evidence where id = $1 for update`, [evidenceId],
      );
      const row = result.rows[0];
      if (!row || row.userId !== ownerId || row.deletedAt || (row.expiresAt !== null && row.expiresAt <= new Date())) throw new NotFoundException({ code: "NOT_FOUND", message: "ไม่พบหลักฐานหรือหลักฐานหมดอายุแล้ว" });
      let purpose = "owner_access";
      let claimId: string | null = null;
      let correlationId = actor.is_demo ? "mock-demo:FIXTURE-BKK-20260812-01" : `evidence:${evidenceId}`;
      if (row.userId !== userId) {
        if (!["reviewer", "admin"].includes(actor.role) || actor.is_demo !== owner.is_demo) {
          throw new ForbiddenException({ code: "FORBIDDEN", message: "ไม่มีสิทธิ์ดูหลักฐานนี้" });
        }
        const assignment = await client.query<{ claim_id: string }>(
          `select claim.id claim_id
           from claim_evidence binding
           join claims claim on claim.id=binding.claim_id
           where binding.evidence_id=$1
             and claim.data_scope=case when $2::boolean then 'mock_demo' else 'production' end
             and claim.state in ('pending','pending_review','verified')
           order by claim.submitted_at desc limit 1`,
          [evidenceId, actor.is_demo],
        );
        claimId = assignment.rows[0]?.claim_id ?? null;
        if (!claimId) throw new ForbiddenException({ code: "FORBIDDEN", message: "หลักฐานนี้ไม่ได้ผูกกับงานตรวจที่บัญชีนี้มีสิทธิ์" });
        purpose = "claim_review";
        const correlation = await client.query<{ correlation_id: string | null }>(
          `select metadata->>'correlation_id' correlation_id
           from audit_events
           where subject_type='claim' and subject_id=$1 and event_type='claim.submitted'
           order by created_at desc limit 1`,
          [claimId],
        );
        correlationId = correlation.rows[0]?.correlation_id ?? correlationId;
      }
      await client.query(
        "insert into evidence_access_audit(evidence_id,actor_id,purpose) values($1,$2,$3)",
        [evidenceId, userId, purpose],
      );
      await client.query(
        `insert into audit_events(actor_id,event_type,subject_type,subject_id,metadata)
         values($1,'evidence.content.read','evidence',$2,$3)`,
        [userId, evidenceId, JSON.stringify({
          correlation_id: correlationId,
          actor_role: actor.role,
          data_scope: actor.is_demo ? "mock_demo" : "production",
          is_mock: actor.is_demo,
          demo_only: actor.is_demo,
          fixture_id: actor.is_demo ? "FIXTURE-BKK-20260812-01" : null,
          purpose,
          claim_id: claimId,
          outcome: "read",
        })],
      );
      return this.storage.get(row.objectKey);
    });
  }

  /** Marks deletion first, then holds user/session locks through every physical delete. Failed deletion stays fail-closed and retryable. */
  async deleteAccountEvidence(userId: string): Promise<void> {
    await this.database.transaction(async (client) => {
      await client.query("select id from users where id = $1 for update", [userId]);
      await client.query("update users set account_deletion_state = 'deleting' where id = $1", [userId]);
    });
    try {
      await this.database.transaction(async (client) => {
        const user = await client.query<{ id: string }>("select id from users where id = $1 and account_deletion_state = 'deleting' for update", [userId]);
        if (!user.rows[0]) throw new ForbiddenException({ code: "FORBIDDEN", message: "บัญชีไม่พร้อมลบหลักฐาน" });
        const sessions = await client.query<{ id: string; objectKey: string }>("select id, object_key as \"objectKey\" from upload_sessions where user_id = $1 for update", [userId]);
        await client.query("update upload_sessions set state = 'revoked', upload_token_hash = null, revoked_at = now() where user_id = $1 and state not in ('tombstoned')", [userId]);
        for (const session of sessions.rows) await this.storage.delete(session.objectKey);
        await client.query(
          `update evidence set deleted_at = now(), tombstoned_at = now(), object_key = 'tombstoned/' || id::text,
             content_type = null, sha256 = null, captured_at = null, location = null
           where user_id = $1 and deleted_at is null`,
          [userId],
        );
        await client.query(
          `update upload_sessions set state = 'tombstoned', tombstoned_at = now(), object_key = 'tombstoned/' || id::text,
             content_type = null, expected_sha256 = null, captured_at = null, camera_make = null, camera_model = null,
             latitude = null, longitude = null where user_id = $1`,
          [userId],
        );
        await client.query(
          "update user_preferences set leaderboard_opt_in=false,leaderboard_pseudonym=null,updated_at=now() where user_id=$1",
          [userId],
        );
        await client.query(
          `update users
           set account_deletion_state='deleted',deleted_at=coalesce(deleted_at,now()),
               email='deleted-' || id::text || '@deleted.invalid',display_name='บัญชีที่ลบแล้ว'
           where id=$1`,
          [userId],
        );
      });
    } catch (error) {
      throw new ConflictException({ code: "CONFLICT", message: "ลบไฟล์หลักฐานไม่สำเร็จ บัญชียังถูกปิดกั้นและสามารถลองลบซ้ำได้" });
    }
  }

  private async lockOrCreateDraft(client: PoolClient, userId: string, draftId?: string): Promise<string> {
    if (!draftId) {
      const created = await client.query<{ id: string }>("insert into claim_drafts (user_id,state) values ($1,'draft') returning id", [userId]);
      if (!created.rows[0]) throw new Error("ไม่สามารถสร้างแบบร่างหลักฐานได้");
      return created.rows[0].id;
    }
    const draft = await client.query<{ id: string }>("select id from claim_drafts where id = $1 and user_id = $2 and state = 'draft' and deleted_at is null for update", [draftId, userId]);
    if (!draft.rows[0]) throw new ConflictException({ code: "CONFLICT", message: "ไม่พบหรือไม่สามารถแก้ไขแบบร่างการเคลมได้" });
    return draftId;
  }

  private async lockActiveUser(client: PoolClient, userId: string): Promise<void> {
    const user = await client.query<{ id: string }>("select id from users where id = $1 and deleted_at is null and account_deletion_state = 'active' for update", [userId]);
    if (!user.rows[0]) throw new ForbiddenException({ code: "FORBIDDEN", message: "บัญชีถูกลบหรืออยู่ระหว่างการลบ" });
  }

  private async lockSession(client: PoolClient, id: string): Promise<SessionRow> {
    const result = await client.query<SessionRow>(
      `select id,user_id as "userId",claim_draft_id as "claimDraftId",object_key as "objectKey",expected_sha256 as "expectedSha256",byte_size as "byteSize",content_type as "contentType",upload_token_hash as "uploadTokenHash",state,expires_at as "expiresAt",evidence_id as "evidenceId",fixture_id as "fixtureId" from upload_sessions where id = $1 for update`, [id],
    );
    if (!result.rows[0]) throw new NotFoundException({ code: "NOT_FOUND", message: "ไม่พบช่วงอัปโหลดหลักฐาน" });
    return result.rows[0];
  }

  private assertUpload(session: SessionRow, userId: string, token: string, contentType: string | undefined): void {
    if (session.userId !== userId) throw new ForbiddenException({ code: "FORBIDDEN", message: "ไม่มีสิทธิ์อัปโหลดหลักฐานนี้" });
    if (session.expiresAt <= new Date()) throw new ConflictException({ code: "UPLOAD_EXPIRED", message: "ช่วงอัปโหลดหลักฐานหมดอายุแล้ว" });
    if (session.state !== "draft" || !session.uploadTokenHash || !sameDigest(session.uploadTokenHash, digest(token))) throw this.invalid("โทเค็นอัปโหลดถูกใช้หรือถูกเพิกถอนแล้ว");
    if (session.contentType !== contentType) throw this.invalid("ชนิดไฟล์หลักฐานไม่ตรงกับช่วงอัปโหลด");
  }

  private invalid(message: string) { return new ConflictException({ code: "UPLOAD_INVALID", message }); }
}

function sameDigest(left: string, right: string): boolean {
  const a = Buffer.from(left); const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
