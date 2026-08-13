import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { createHash, createHmac } from "node:crypto";
import type { PoolClient } from "pg";
import { applyRecyclingReview, calculatePoints, Decimal, decideTreeOutcome, evaluateBus, type GpsSample } from "@net-zero/domain";
import { DatabaseService } from "../database/database.service.js";
import { getConfig } from "../config.js";
import { TREE_PHOTO_VERIFIER, type TreePhotoVerifier } from "./tree-photo-verifier.js";

type State = "submitted" | "pending" | "pending_review" | "verified" | "rejected";
type Activity = "bus" | "tree" | "recycling";

@Injectable()
export class ClaimsService {
  private readonly config = getConfig();

  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(TREE_PHOTO_VERIFIER) private readonly treePhotoVerifier: TreePhotoVerifier,
  ) {}

  async submitBus(userId: string, input: any, idempotencyKey: string) {
    this.requiredKey(idempotencyKey);
    return this.database.transaction(async client => {
      const requestDigest = this.requestDigest(input);
      await this.lockIdempotency(client, userId, "bus", idempotencyKey);
      const replay = await this.beginClaimIdempotency(client, userId, "bus", idempotencyKey, requestDigest);
      if (replay !== undefined) return replay;
      const prepared = await this.prepareBusEvaluation(client, userId, input);
      const { canonicalPayload, distanceKm, end, evaluation, fingerprint, oracle, start } = prepared;
      const claim = await this.createClaim(client, userId, "bus", idempotencyKey, requestDigest, evaluation.status, evaluation.reason ?? "bus_metric_unavailable");
      await client.query("update claims set impact_input=$2 where id=$1", [claim, JSON.stringify({ distance_km: distanceKm.toFixed(6), route_code: input.routeName })]);
      await client.query(
        `insert into bus_claim_metrics(
          claim_id,route_id,route_version,config_hash,boarded_at,alighted_at,
          gps_coverage,speed_window_pass,stop_pair_pass,corridor_pass,distance_km
        ) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [claim, oracle.routeId, oracle.routeVersion, oracle.configHash, start, end, this.percent(evaluation.metrics.coverage), this.percent(evaluation.metrics.speed), this.percent(evaluation.metrics.stops), this.percent(evaluation.metrics.route), distanceKm],
      );
      await this.storeBusRepresentatives(client, prepared.gpsEvidenceId, evaluation.representatives);
      if (evaluation.status === "verified") {
        await client.query(
          "insert into fingerprints(claim_id,user_id,type,digest,version,key_id,config_hash,payload) values($1,$2,'trip',$3,'trip-hmac-v1',$4,$5,$6)",
          [claim, userId, fingerprint, this.config.FINGERPRINT_KEY_ID, oracle.configHash, JSON.stringify(canonicalPayload)],
        );
        await this.credit(client, claim, userId, "bus");
      }
      await this.bindEvidence(client, claim, input.evidenceIds);
      await this.audit(client, userId, "claim.submitted", "claim", claim, { activity: "bus", reason: evaluation.reason });
      const response = await this.claimResponse(client, claim);
      await this.completeClaimIdempotency(client, userId, "bus", idempotencyKey, claim, response);
      return response;
    });
  }

  async retryBus(userId: string, claimId: string, input: any, idempotencyKey: string) {
    this.requiredKey(idempotencyKey);
    return this.database.transaction(async client => {
      const operation = `bus-retry:${claimId}`;
      const requestDigest = this.requestDigest(input);
      await this.lockIdempotency(client, userId, operation, idempotencyKey);
      const replay = await this.beginClaimIdempotency(client, userId, operation, idempotencyKey, requestDigest);
      if (replay !== undefined) return replay;
      const existing = await client.query<{ state: State; route_code: string; boarded_at: Date; alighted_at: Date }>(
        `select claim.state,route.code route_code,metrics.boarded_at,metrics.alighted_at
         from claims claim
         join bus_claim_metrics metrics on metrics.claim_id=claim.id
         join routes route on route.id=metrics.route_id
         where claim.id=$1 and claim.user_id=$2 and claim.activity='bus'
         for update of claim,metrics`,
        [claimId, userId],
      );
      const claim = existing.rows[0];
      if (!claim) throw new NotFoundException({ code: "NOT_FOUND", message: "ไม่พบรายการรถโดยสาร" });
      if (claim.state !== "pending") {
        throw new ConflictException({ code: "CONFLICT", message: "ลองตรวจซ้ำได้เฉพาะรายการรถโดยสารที่ยังรอข้อมูล" });
      }
      if (
        claim.route_code !== input.routeName ||
        claim.boarded_at.getTime() !== new Date(input.boardedAt).getTime() ||
        claim.alighted_at.getTime() !== new Date(input.alightedAt).getTime()
      ) {
        throw new ConflictException({
          code: "CONFLICT",
          message: "การตรวจซ้ำต้องใช้เส้นทางและช่วงเวลาเดียวกับรายการเดิม",
        });
      }

      const prepared = await this.prepareBusEvaluation(client, userId, input);
      const { canonicalPayload, distanceKm, end, evaluation, fingerprint, oracle, start } = prepared;
      const reason = evaluation.reason ?? "bus_metric_unavailable";
      await client.query(
        `update claims
         set state=$2::claim_state,reason_code=$3,
             decided_at=case when $2::claim_state in ('verified','rejected') then now() else null end,
             impact_input=$4
         where id=$1`,
        [claimId, evaluation.status, reason, JSON.stringify({ distance_km: distanceKm.toFixed(6), route_code: input.routeName })],
      );
      await client.query(
        `insert into bus_claim_metrics(
           claim_id,route_id,route_version,config_hash,boarded_at,alighted_at,
           gps_coverage,speed_window_pass,stop_pair_pass,corridor_pass,distance_km
         ) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         on conflict(claim_id) do update set
           route_id=excluded.route_id,route_version=excluded.route_version,config_hash=excluded.config_hash,
           boarded_at=excluded.boarded_at,alighted_at=excluded.alighted_at,
           gps_coverage=excluded.gps_coverage,speed_window_pass=excluded.speed_window_pass,
           stop_pair_pass=excluded.stop_pair_pass,corridor_pass=excluded.corridor_pass,
           distance_km=excluded.distance_km`,
        [claimId, oracle.routeId, oracle.routeVersion, oracle.configHash, start, end, this.percent(evaluation.metrics.coverage), this.percent(evaluation.metrics.speed), this.percent(evaluation.metrics.stops), this.percent(evaluation.metrics.route), distanceKm],
      );
      await this.storeBusRepresentatives(client, prepared.gpsEvidenceId, evaluation.representatives);
      await client.query(
        "insert into claim_transitions(claim_id,from_state,to_state,actor_id,reason_code) values($1,'pending',$2,$3,$4)",
        [claimId, evaluation.status, userId, reason],
      );
      if (evaluation.status === "verified") {
        await client.query(
          "insert into fingerprints(claim_id,user_id,type,digest,version,key_id,config_hash,payload) values($1,$2,'trip',$3,'trip-hmac-v1',$4,$5,$6)",
          [claimId, userId, fingerprint, this.config.FINGERPRINT_KEY_ID, oracle.configHash, JSON.stringify(canonicalPayload)],
        );
        await this.credit(client, claimId, userId, "bus");
      }
      await this.bindEvidence(client, claimId, input.evidenceIds);
      await this.audit(client, userId, "claim.bus_retried", "claim", claimId, { state: evaluation.status, reason });
      const response = await this.claimResponse(client, claimId);
      await this.completeClaimIdempotency(client, userId, operation, idempotencyKey, claimId, response);
      return response;
    });
  }

  async submitTree(userId: string, input: any, idempotencyKey: string, isDemo = false) {
    this.requiredKey(idempotencyKey);
    return this.database.transaction(async client => {
      const requestDigest = this.requestDigest(input);
      await this.lockIdempotency(client, userId, "tree", idempotencyKey);
      const replay = await this.beginClaimIdempotency(client, userId, "tree", idempotencyKey, requestDigest);
      if (replay !== undefined) return replay;
      await this.assertEvidence(client, userId, input.evidenceIds, "photo");
      const planted = new Date(input.plantedAt); if (Number.isNaN(planted.valueOf())) this.invalid("เวลาเพาะปลูกไม่ถูกต้อง");
      const captureMatch = await client.query(
        `select 1 from evidence
         where id=any($1::uuid[]) and location is not null and captured_at is not null
           and ST_DWithin(location,ST_SetSRID(ST_MakePoint($2,$3),4326)::geography,100)
           and abs(extract(epoch from (captured_at-$4::timestamptz))) <= 900`,
        [input.evidenceIds, Number(input.longitude), Number(input.latitude), planted],
      );
      if (!(captureMatch.rowCount ?? 0)) this.invalid("พิกัดหรือเวลาของภาพต้นไม้ไม่ตรงกับข้อมูลที่ส่ง");
      const digest = this.fingerprint(["tree", input.speciesThaiName, planted.toISOString(), input.latitude, input.longitude, ...[...input.evidenceIds].sort()]);
      const visual = await client.query<{ digest: string; key_id: string }>(
        `select fingerprint.digest,fingerprint.key_id
         from evidence_fingerprints fingerprint
         join evidence on evidence.id = fingerprint.evidence_id
         where evidence.id = any($1::uuid[]) and evidence.kind = 'photo'
         order by (fingerprint.key_id=$2) desc,fingerprint.key_id`,
        [input.evidenceIds, this.config.FINGERPRINT_KEY_ID],
      );
      const visualHashes = visual.rows.map(row => row.digest);
      const visualKeyIds = visual.rows.map(row => row.key_id);
      const visualHash = visualHashes[0];
      if (!visualHash) throw new Error("ไม่พบลายนิ้วมือหลักฐานภาพ");
      const locationFingerprint = this.treeLocationFingerprintPayload(Number(input.latitude), Number(input.longitude));
      await client.query("select pg_advisory_xact_lock(hashtextextended('tree-dedup-global',0))");
      const duplicate = await client.query<{
        exact_location_duplicate: boolean;
        retained_location_match: boolean;
        visual_duplicate: boolean;
        nearest_distance_m: string | null;
      }>(
        `select
           exists(
             select 1 from claims prior
             join claim_evidence binding on binding.claim_id=prior.id
             join evidence prior_evidence on prior_evidence.id=binding.evidence_id
             where prior.activity='tree' and prior.state='verified' and prior_evidence.location is not null
               and ST_DWithin(prior_evidence.location,ST_SetSRID(ST_MakePoint($1,$2),4326)::geography,5)
           ) as exact_location_duplicate,
           exists(
             select 1 from tree_claim_signals signal
             join claims prior on prior.id=signal.claim_id and prior.state='verified'
             where signal.location_hashes && $4::text[]
           ) as retained_location_match,
           exists(
             select 1 from tree_claim_signals signal
             join claims prior on prior.id=signal.claim_id and prior.state='verified'
             where signal.visual_hashes && $3::text[]
           ) as visual_duplicate,
           (
             select min(ST_Distance(prior_evidence.location,ST_SetSRID(ST_MakePoint($1,$2),4326)::geography))::text
             from claims prior
             join claim_evidence binding on binding.claim_id=prior.id
             join evidence prior_evidence on prior_evidence.id=binding.evidence_id
             where prior.activity='tree' and prior.state='verified' and prior_evidence.location is not null
           ) as nearest_distance_m`,
        [Number(input.longitude), Number(input.latitude), visualHashes, locationFingerprint.candidateHashes],
      );
      const duplicateSignals = duplicate.rows[0] ?? {
        exact_location_duplicate: false,
        retained_location_match: false,
        visual_duplicate: false,
        nearest_distance_m: null,
      };
      const providerResult = isDemo
        ? { outcome: input.demoAiResult ?? "unavailable", modelVersion: "demo-fixture-v1", nearestVisualSimilarityPercent: duplicateSignals.visual_duplicate ? 100 : 0 }
        : await this.treePhotoVerifier.verify(input.evidenceIds);
      const fixture = providerResult.outcome;
      if (!(["pass", "wrong_type", "ambiguous", "unavailable"] as string[]).includes(fixture)) this.invalid("ผลตรวจสอบภาพสาธิตไม่ถูกต้อง");
      const visualSimilarity = Math.max(duplicateSignals.visual_duplicate ? 100 : 0, providerResult.nearestVisualSimilarityPercent ?? 0);
      const visualDuplicate = visualSimilarity >= 90;
      const outcome = duplicateSignals.retained_location_match && !duplicateSignals.exact_location_duplicate
        ? { status: "pending_review" as const, reason: "tree_ambiguous" as const }
        : decideTreeOutcome({
            ai: fixture as "pass" | "wrong_type" | "ambiguous" | "unavailable",
            locationDuplicate: duplicateSignals.exact_location_duplicate,
            visualDuplicate,
          });
      const state: State = outcome.status;
      const claim = await this.createClaim(client, userId, "tree", idempotencyKey, requestDigest, state, outcome.reason);
      await client.query("update claims set impact_input=$2 where id=$1", [claim, JSON.stringify({ quantity: 1, time_basis: "one_year" })]);
      await client.query(
        "insert into tree_ai_results(claim_id,model_version,visual_hash,visual_similarity,nearest_distance_m,outcome) values($1,$2,$3,$4,$5,$6)",
        [
          claim,
          providerResult.modelVersion,
          visualHash,
          visualSimilarity,
          duplicateSignals.nearest_distance_m,
          outcome.status === "verified"
            ? "pass"
            : outcome.reason === "duplicate_evidence"
              ? "duplicate"
              : outcome.reason === "tree_wrong_type"
                ? "reject"
                : "manual_review",
        ],
      );
      await client.query(
        "insert into tree_claim_signals(claim_id,visual_hashes,key_ids,location_hashes,location_key_ids,captured_at) values($1,$2,$3,$4,$5,$6)",
        [claim, visualHashes, visualKeyIds, locationFingerprint.centerHashes, locationFingerprint.keyIds, planted],
      );
      if (state === "verified") {
        await client.query(
          "insert into fingerprints(claim_id,user_id,type,digest,version,key_id,payload) values($1,$2,'tree',$3,'tree-hmac-v1',$4,$5)",
          [claim, userId, digest, this.config.FINGERPRINT_KEY_ID, JSON.stringify({ visual_hashes: visualHashes, key_ids: visualKeyIds, location_hashes: locationFingerprint.centerHashes, location_key_ids: locationFingerprint.keyIds })],
        );
        await this.credit(client, claim, userId, "tree");
      }
      await this.bindEvidence(client, claim, input.evidenceIds);
      await this.audit(client, userId, "claim.submitted", "claim", claim, { activity: "tree", reason: outcome.reason });
      const response = await this.claimResponse(client, claim);
      await this.completeClaimIdempotency(client, userId, "tree", idempotencyKey, claim, response);
      return response;
    });
  }

  async submitRecycling(userId: string, input: any, idempotencyKey: string) {
    this.requiredKey(idempotencyKey);
    return this.database.transaction(async client => {
      const requestDigest = this.requestDigest(input);
      await this.lockIdempotency(client, userId, "recycling", idempotencyKey);
      const replay = await this.beginClaimIdempotency(client, userId, "recycling", idempotencyKey, requestDigest);
      if (replay !== undefined) return replay;
      await this.assertEvidence(client, userId, input.evidenceIds, "photo");
      const tokenHash = createHash("sha256").update(input.binCode).digest("hex");
      const token = await client.query<{ bin_id: string; is_demo: boolean }>(
        `select token.bin_id,account.is_demo
         from qr_tokens token
         join qr_bins bin on bin.id = token.bin_id and bin.active = true and bin.is_demo=token.is_demo
         join users account on account.id = $2 and account.is_demo = token.is_demo
         where token.token_hash = $1 and token.consumed_at is null and token.expires_at > now()
         for update of token`,
        [tokenHash, userId],
      );
      if (!token.rows[0]) this.invalid("รหัส QR จุดรับไม่ถูกต้อง หมดอายุ หรือถูกใช้แล้ว");
      const redemption = token.rows[0]!;
      const autoVerifyDemo = redemption.is_demo
        && this.config.MOCK_DEMO_ENABLED
        && this.config.DATABASE_DATA_SCOPE === "mock_demo";
      const state: State = autoVerifyDemo ? "verified" : "pending_review";
      const reason = autoVerifyDemo ? "reviewer_confirmed" : "recycling_pending_review";
      const impactInput = {
        material: input.material,
        declared_count: input.itemCount,
        ...(autoVerifyDemo ? { approved_count: input.itemCount } : {}),
      };
      const claim = await this.createClaim(client, userId, "recycling", idempotencyKey, requestDigest, state, reason);
      await client.query("update claims set impact_input=$2 where id=$1", [claim, JSON.stringify(impactInput)]);
      await client.query(
        "insert into recycling_declarations(claim_id,user_id,bin_id,material,declared_count,approved_count) values($1,$2,$3,$4,$5,$6)",
        [claim, userId, redemption.bin_id, input.material, input.itemCount, autoVerifyDemo ? input.itemCount : null],
      );
      await client.query("update qr_tokens set consumed_at=now(),consumed_claim_id=$2 where token_hash=$1", [tokenHash, claim]);
      await client.query("insert into qr_token_redemptions(token_hash,bin_id,claim_id,consumed_at) values($1,$2,$3,now())", [tokenHash, redemption.bin_id, claim]);
      if (autoVerifyDemo) await this.credit(client, claim, userId, "recycling");
      await this.bindEvidence(client, claim, input.evidenceIds);
      await this.audit(client, userId, "claim.submitted", "claim", claim, {
        activity: "recycling",
        evidence: "delivery_only",
        verification: autoVerifyDemo ? "mock_demo_auto_verified" : "review_required",
      });
      const response = await this.claimResponse(client, claim);
      await this.completeClaimIdempotency(client, userId, "recycling", idempotencyKey, claim, response);
      return response;
    });
  }

  async listClaims(userId: string) { const result = await this.database.query<{ id: string }>("select id from claims where user_id=$1 order by submitted_at desc", [userId]); return { items: await Promise.all(result.rows.map(row => this.claimResponse(this.database.pool, row.id))) }; }
  async reviewQueue(actorId: string, status: string) {
    const state = status === "pending" ? "pending" : "pending_review";
    const result = await this.database.query<{ id: string }>(
      `select claim.id from claims claim
       join users owner on owner.id=claim.user_id
       join users actor on actor.id=$1
       where claim.state=$2 and owner.is_demo=actor.is_demo order by claim.submitted_at asc`,
      [actorId, state],
    );
    return { items: await Promise.all(result.rows.map(row => this.claimResponse(this.database.pool, row.id))) };
  }

  async review(userId: string, claimId: string, input: any) { return this.database.transaction(async client => {
    const found = await client.query<{ user_id: string; activity: Activity; state: State }>(
      `select claim.user_id,claim.activity,claim.state from claims claim
       join users owner on owner.id=claim.user_id join users actor on actor.id=$2
       where claim.id=$1 and owner.is_demo=actor.is_demo for update of claim`,
      [claimId,userId],
    ); const claim = found.rows[0]; if (!claim) throw new NotFoundException({ code: "NOT_FOUND", message: "ไม่พบรายการเคลม" }); if (claim.state !== "pending" && claim.state !== "pending_review") throw new ConflictException({ code: "CONFLICT", message: "รายการนี้ถูกพิจารณาแล้ว" });
    if (claim.activity === "bus") {
      throw new ConflictException({
        code: "CONFLICT",
        message: "รายการรถโดยสารต้องผ่านกฎตรวจอัตโนมัติครบทุกข้อ ผู้ตรวจสอบไม่สามารถเปลี่ยนเป็นสถานะผ่านได้",
      });
    }
    let state: State = input.decision === "reject" ? "rejected" : "verified"; let reason = input.reason ?? (state === "verified" ? "reviewer_confirmed" : "reviewer_rejected");
    let approvedCount = 0;
    if (claim.activity === "recycling" && state === "verified") {
      const declaration = await client.query<{ material: string; declared_count: number }>("select material,declared_count from recycling_declarations where claim_id=$1", [claimId]);
      const row = declaration.rows[0];
      if (!row) this.invalid("ไม่พบข้อมูลการส่งมอบ");
      approvedCount = input.approvedItemCount ?? row.declared_count;
      const decision = applyRecyclingReview({ category: row.material, count: row.declared_count }, "approve", { category: row.material, count: approvedCount });
      reason = decision.reason;
      await client.query("update recycling_declarations set approved_count=$2 where claim_id=$1", [claimId, approvedCount]);
      await client.query("update claims set impact_input=$2 where id=$1", [claimId, JSON.stringify({ material: row.material, declared_count: row.declared_count, approved_count: approvedCount })]);
    }
    await client.query("update claims set state=$2,reason_code=$3,decided_at=now() where id=$1", [claimId, state, reason]);
    await client.query("insert into claim_reviews(claim_id,reviewer_id,decision,reason_code) values($1,$2,$3,$4)", [claimId,userId,state,reason]);
    await client.query("insert into claim_transitions(claim_id,from_state,to_state,actor_id,reason_code) values($1,$2,$3,$4,$5)", [claimId,claim.state,state,userId,reason]);
    if (state === "verified") await this.credit(client, claimId, claim.user_id, claim.activity);
    await this.audit(client,userId,"claim.reviewed","claim",claimId,{state,reason});
    return this.claimResponse(client,claimId);
  }); }

  async listFactors() {
    const rows = await this.database.query(
      `select factor.*,
              mock.approval_scope as mock_approval_scope,
              mock.is_mock as mock_is_mock,
              mock.demo_only as mock_demo_only,
              mock.approved_by as mock_approved_by,
              mock.approved_role as mock_approved_role,
              mock.approved_at as mock_approved_at,
              mock.reviewed_digest as mock_reviewed_digest
       from factor_catalog factor
       left join mock_demo_factor_approvals mock on mock.factor_id=factor.id
       order by factor.effective_at desc`,
    );
    return { items: rows.rows };
  }
  async createFactor(actor: string, input: any) {
    return this.database.transaction(async client => {
      if (input.activity === "tree" && Number(input.value) !== 9.5) {
        this.invalid("พร็อกซีต้นไม้สำหรับ MVP ต้องเป็น 9.5 กก. CO₂e ต่อต้นต่อหนึ่งปี");
      }
      const assumptions = { ...(input.assumptions ?? {}), ...(input.proxyCopyThai ? { proxy: input.proxyCopyThai } : {}) };
      const row = await client.query<{ id: string }>(
        `insert into factor_catalog(
          activity,code,version,value,unit,source_url,methodology_code,effective_at,
          assumptions,disclaimer_th,proxy_copy_th,is_synthetic
        ) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,false) returning id`,
        [input.activity,input.code,input.version,input.value,input.unit,input.sourceUrl,input.methodologyCode,input.effectiveAt,assumptions,input.disclaimerThai,input.proxyCopyThai],
      );
      const id = row.rows[0]!.id;
      await this.audit(client,actor,"factor.created","factor",id,{ source_url: input.sourceUrl, methodology_code: input.methodologyCode });
      return { id, status:"draft" };
    });
  }

  async approveFactor(actor: string, id: string) {
    return this.database.transaction(async client => {
      const actorRow = await client.query<{ role: string; is_demo: boolean }>(
        "select role,is_demo from users where id=$1 and deleted_at is null for share",
        [actor],
      );
      const account = actorRow.rows[0];
      if (!account || account.role !== "admin") {
        throw new ConflictException({ code: "CONFLICT", message: "เฉพาะผู้ดูแลระบบเท่านั้นที่อนุมัติปัจจัยได้" });
      }
      if (account.is_demo) {
        const approval = await client.query<{ activity: Activity; reviewed_digest: string; approved_at: string }>(
          `insert into mock_demo_factor_approvals(
             factor_id,approval_scope,approved_by,approved_role,is_mock,demo_only,reviewed_digest
           )
           select id,'mock_demo',$2,'admin',true,true,review_digest
           from factor_catalog
           where id=$1 and status='draft' and is_synthetic=false
             and code !~* '^(test|synthetic|fixture)([-_]|$)'
             and exists(select 1 from demo_factor_manifest where factor_id=$1)
           on conflict(factor_id) do nothing
           returning (select activity from factor_catalog where id=$1) activity,reviewed_digest,approved_at`,
          [id, actor],
        );
        const created = approval.rows[0] ?? (await client.query<{ activity: Activity; reviewed_digest: string; approved_at: string }>(
          `select factor.activity,mock.reviewed_digest,mock.approved_at
           from mock_demo_factor_approvals mock join factor_catalog factor on factor.id=mock.factor_id
           where mock.factor_id=$1 and mock.approved_by=$2 and mock.approval_scope='mock_demo'
             and mock.is_mock and mock.demo_only and mock.reviewed_digest=factor.review_digest
             and factor.status='draft' and factor.is_synthetic=false`,
          [id, actor],
        )).rows[0];
        if (!created) throw new ConflictException({ code: "CONFLICT", message: "ปัจจัยไม่อยู่ในสถานะที่อนุมัติเดโมได้" });
        const blocked = await client.query<{ id: string; user_id: string; activity: Activity }>(
          `select claim.id,claim.user_id,claim.activity from claims claim
           join users owner on owner.id=claim.user_id
           where claim.activity=$1 and claim.state='verified' and claim.impact_status='blocked_factor_approval'
             and owner.is_demo=true order by claim.submitted_at for update`,
          [created.activity],
        );
        for (const claim of blocked.rows) await this.credit(client, claim.id, claim.user_id, claim.activity);
        await this.audit(client,actor,"factor.mock_demo_approved","factor",id,{ approval_scope: "mock_demo", reviewed_digest: created.reviewed_digest, credited_blocked_claims: blocked.rowCount ?? 0 });
        return { id, status:"draft", approvalScope:"mock_demo", isMock:true, demoOnly:true, creditedBlockedClaims: blocked.rowCount ?? 0 };
      }
      const updated = await client.query<{ activity: Activity }>(
        `update factor_catalog
         set status='approved',approved_by=$2,approved_role='admin',approved_at=now()
         where id=$1 and status='draft' and is_synthetic=false
           and code !~* '^(test|synthetic|fixture)([-_]|$)'
           and not exists(select 1 from mock_demo_factor_approvals where factor_id=$1)
         returning activity`,
        [id,actor],
      );
      const approved = updated.rows[0];
      if (!approved) throw new ConflictException({ code: "CONFLICT", message: "ปัจจัยไม่อยู่ในสถานะที่อนุมัติได้หรือเป็นข้อมูลสังเคราะห์" });
      const blocked = await client.query<{ id: string; user_id: string; activity: Activity }>(
        `select id,user_id,activity from claims
         where activity=$1 and state='verified' and impact_status='blocked_factor_approval'
         order by submitted_at for update`,
        [approved.activity],
      );
      for (const claim of blocked.rows) await this.credit(client, claim.id, claim.user_id, claim.activity);
      await this.audit(client,actor,"factor.approved","factor",id,{ credited_blocked_claims: blocked.rowCount ?? 0 });
      return { id,status:"approved",creditedBlockedClaims: blocked.rowCount ?? 0 };
    });
  }

  async demoReadiness() {
    const result = await this.database.query<{ activity: Activity; ready: boolean; factor_id: string | null }>(
      "select activity,ready,factor_id from mock_demo_factor_readiness order by activity",
    );
    const production = await this.database.query<{ ready: boolean }>("select ready from production_factor_readiness");
    const marker = await this.database.query<{ data_scope: "mock_demo" | "production" }>(
      "select data_scope from deployment_metadata where singleton=true",
    );
    const databaseScope = marker.rows[0]?.data_scope ?? null;
    const mockLabels = await this.database.query<{ activity: Activity; approval_scope: string | null; is_mock: boolean | null; demo_only: boolean | null }>(
      `select manifest.activity,mock.approval_scope,mock.is_mock,mock.demo_only
       from demo_factor_manifest manifest
       left join mock_demo_factor_approvals mock on mock.factor_id=manifest.factor_id`,
    );
    const labels = Object.fromEntries(mockLabels.rows.map(row => [row.activity, row]));
    const activities = Object.fromEntries(result.rows.map(row => [row.activity, {
      ready: row.ready, factorId: row.factor_id,
      approvalScope: labels[row.activity]?.approval_scope ?? null,
      isMock: labels[row.activity]?.is_mock ?? false,
      demoOnly: labels[row.activity]?.demo_only ?? false,
    }]));
    const requiredActivities: Activity[] = ["bus", "recycling", "tree"];
    const productionFactorsReady = production.rows.length === requiredActivities.length && production.rows.every(row => row.ready);
    return {
      mockDemoReady: databaseScope === "mock_demo" && result.rows.length === requiredActivities.length &&
        requiredActivities.every(activity => activities[activity]?.ready === true),
      readinessKind: "factor-prerequisites-only",
      activities,
      databaseScope,
      productionFactorsReady,
      productionReady: false,
      tgoEndorsed: false,
      physicalEvidence: false,
      syntheticFactorsAccepted: false,
      integrations: ["mock_demo_factor_approvals"],
    };
  }

  async correctImpact(actor: string, claimId: string, input: { correctedTotalKgCo2e: string; reason: string }) {
    return this.database.transaction(async client => {
      const claim = await client.query<{ user_id: string; activity: Activity; state: State; impact_status: string; data_scope: "mock_demo" | "production" }>(
        `select claim.user_id,claim.activity,claim.state,claim.impact_status,claim.data_scope from claims claim
         join users owner on owner.id=claim.user_id join users reviewer on reviewer.id=$2
         where claim.id=$1 and owner.is_demo=reviewer.is_demo for update of claim`,
        [claimId,actor],
      );
      const target = claim.rows[0];
      if (!target) throw new NotFoundException({ code: "NOT_FOUND", message: "ไม่พบรายการเคลม" });
      if (target.state !== "verified" || target.impact_status !== "credited") {
        this.invalid("แก้ไขได้เฉพาะคำขอที่ผ่านและบันทึกผลกระทบแล้ว");
      }
      const original = await client.query<{
        calculation_id: string;
        carbon_id: string;
        factor_id: string;
        impact_type: "avoided" | "projected_sequestration";
        factor_snapshot: Record<string, unknown>;
        disclaimer_th: string;
        approval_scope: "production" | "mock_demo";
        is_mock: boolean;
        demo_only: boolean;
        reviewed_digest: string | null;
      }>(
        `select calculation.id calculation_id,carbon.id carbon_id,calculation.factor_id,
                calculation.impact_type,calculation.factor_snapshot,calculation.disclaimer_th,
                calculation.approval_scope,calculation.is_mock,calculation.demo_only,calculation.reviewed_digest
         from calculation_snapshots calculation
         join carbon_ledger carbon on carbon.calculation_id=calculation.id
         where calculation.claim_id=$1 and calculation.entry_kind='original'
         for share of calculation,carbon`,
        [claimId],
      );
      const source = original.rows[0];
      if (!source) throw new Error("ไม่พบรายการต้นฉบับสำหรับแก้ไข");
      const totals = await client.query<{ kg: string; points: number }>(
        `select
           (select coalesce(sum(kg_co2e),0)::text from carbon_ledger where claim_id=$1) kg,
           (select coalesce(sum(points),0)::int from point_ledger where claim_id=$1) points`,
        [claimId],
      );
      const previous = totals.rows[0] ?? { kg: "0", points: 0 };
      const corrected = new Decimal(input.correctedTotalKgCo2e);
      if (!corrected.isFinite() || corrected.isNegative()) this.invalid("ผลรวมที่แก้ไขต้องเป็นเลขไม่ติดลบ");
      const carbonDelta = corrected.minus(previous.kg).toDecimalPlaces(6, Decimal.ROUND_HALF_EVEN).toFixed(6);
      const calculatedPoints = calculatePoints(source.impact_type === "projected_sequestration" ? "projected_sequestration_co2e" : "estimated_avoided_co2e", corrected.toFixed(6));
      const targetPoints = target.data_scope === "mock_demo" && target.activity === "tree"
        ? 15
        : target.data_scope === "mock_demo" && target.activity === "bus"
          ? 3
          : calculatedPoints;
      const pointDelta = targetPoints - previous.points;
      if (new Decimal(carbonDelta).isZero() && pointDelta === 0) this.invalid("ค่าที่แก้ไขไม่เปลี่ยนจากผลรวมปัจจุบัน");
      const calculation = await client.query<{ id: string }>(
        `insert into calculation_snapshots(
           claim_id,factor_id,entry_kind,correction_of,impact_type,input,formula,
           result_kg_co2e,factor_snapshot,disclaimer_th,approval_scope,is_mock,demo_only,reviewed_digest
         ) values($1,$2,'correction',$3,$4,$5,'compensating correction',$6,$7,$8,$9,$10,$11,$12)
         returning id`,
        [claimId,source.factor_id,source.calculation_id,source.impact_type,JSON.stringify({ previous_total_kg_co2e: previous.kg, corrected_total_kg_co2e: corrected.toFixed(6), reason: input.reason }),carbonDelta,JSON.stringify(source.factor_snapshot),source.disclaimer_th,source.approval_scope,source.is_mock,source.demo_only,source.reviewed_digest],
      );
      await client.query(
        `insert into carbon_ledger(claim_id,calculation_id,entry_kind,correction_of,impact_type,kg_co2e)
         values($1,$2,'correction',$3,$4,$5)`,
        [claimId,calculation.rows[0]!.id,source.carbon_id,source.impact_type,carbonDelta],
      );
      if (pointDelta !== 0) {
        await client.query(
          "insert into point_ledger(user_id,claim_id,kind,points,metadata) values($1,$2,'compensation',$3,$4)",
          [target.user_id,claimId,pointDelta,JSON.stringify({ reason: input.reason, corrected_total_kg_co2e: corrected.toFixed(6) })],
        );
      }
      await this.audit(client,actor,"impact.corrected","claim",claimId,{ carbon_delta: carbonDelta, point_delta: pointDelta, reason: input.reason });
      return { claimId, correctedTotalKgCo2e: corrected.toFixed(6), points: targetPoints };
    });
  }

  private async credit(client: PoolClient, claimId: string, _userId: string, _activity: Activity) {
    await client.query(
      "update claims set impact_status='blocked_factor_approval' where id=$1 and state='verified' and impact_status <> 'credited'",
      [claimId],
    );
    await client.query("select evaluate_blocked_claim_impact($1)", [claimId]);
  }
  async creditBlockedClaim(claimId: string) { return this.database.transaction(async client => { const row = await client.query<{ user_id: string; activity: Activity }>("select user_id,activity from claims where id=$1 and state='verified' and impact_status='blocked_factor_approval' for update", [claimId]); if (row.rows[0]) await this.credit(client, claimId, row.rows[0].user_id, row.rows[0].activity); }); }
  private async createClaim(client: PoolClient, userId: string, activity: Activity, key: string, requestDigest: string, state: State, reason: string) {
    const row = await client.query<{ id: string }>(
      `insert into claims(
         user_id,data_scope,is_mock,is_synthetic,demo_only,fixture_id,
         activity,state,idempotency_scope,idempotency_key,request_digest
       )
       select account.id,account.data_scope,account.is_mock,account.is_demo,account.demo_only,
              case when account.is_demo then 'mock-demo:' || $2 else null end,
              $2,'submitted',$2,$3,$4
       from users account where account.id=$1
       returning id`,
      [userId, activity, key, requestDigest],
    );
    const claimId = row.rows[0]!.id;
    await client.query("insert into claim_transitions(claim_id,to_state,actor_id,reason_code) values($1,'submitted',$2,'submitted')", [claimId, userId]);
    await client.query("update claims set state=$2::claim_state,reason_code=$3,decided_at=case when $2::claim_state in ('verified','rejected') then now() else null end where id=$1", [claimId, state, reason]);
    await client.query("insert into claim_transitions(claim_id,from_state,to_state,actor_id,reason_code) values($1,'submitted',$2,$3,$4)", [claimId, state, userId, reason]);
    return claimId;
  }
  private claimIdempotencyScope(user: string, operation: string) {
    return `claim:${operation}:${user}`;
  }
  private async beginClaimIdempotency(
    client: PoolClient,
    user: string,
    operation: string,
    key: string,
    requestDigest: string,
  ): Promise<unknown | undefined> {
    const scope = this.claimIdempotencyScope(user, operation);
    const inserted = await client.query(
      `insert into idempotency_records(scope,key,request_hash,expires_at)
       values($1,$2,$3,now()+interval '30 days')
       on conflict do nothing`,
      [scope, key, requestDigest],
    );
    if (inserted.rowCount) return undefined;
    const existing = await client.query<{ request_hash: string; response_body: unknown }>(
      "select request_hash,response_body from idempotency_records where scope=$1 and key=$2 for update",
      [scope, key],
    );
    const row = existing.rows[0];
    if (!row) throw new ConflictException({ code: "CONFLICT", message: "ไม่สามารถตรวจสอบรหัสป้องกันการส่งซ้ำได้" });
    if (row.request_hash !== requestDigest) {
      throw new ConflictException({ code: "CONFLICT", message: "รหัสป้องกันการส่งซ้ำถูกใช้กับข้อมูลอื่นแล้ว" });
    }
    if (row.response_body === null) {
      throw new ConflictException({ code: "CONFLICT", message: "คำขอเดิมยังดำเนินการไม่เสร็จ" });
    }
    return row.response_body;
  }
  private completeClaimIdempotency(
    client: PoolClient,
    user: string,
    operation: string,
    key: string,
    claimId: string,
    response: unknown,
  ) {
    return client.query(
      `update idempotency_records
       set response_status=201,response_body=$4::jsonb,resource_id=$3
       where scope=$1 and key=$2`,
      [this.claimIdempotencyScope(user, operation), key, claimId, JSON.stringify(response)],
    );
  }
  private async lockIdempotency(client: PoolClient, user: string, operation: string, key: string) {
    await client.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [`${user}:${operation}:${key}`]);
  }
  private async bindEvidence(client: PoolClient, claimId: string, evidenceIds: string[]) {
    for (const evidenceId of [...new Set(evidenceIds)].sort()) {
      await client.query("insert into claim_evidence(claim_id,evidence_id) values($1,$2)", [claimId, evidenceId]);
    }
    await client.query(
      `update claim_drafts set state='submitted'
       where id in (select claim_draft_id from evidence where id=any($1::uuid[])) and state='draft'`,
      [evidenceIds],
    );
  }
  private treeLocationFingerprintPayload(latitude: number, longitude: number) {
    const gridMeters = 0.5;
    const metersPerDegreeLatitude = 111_320;
    const metersPerDegreeLongitude = 107_800;
    const x = Math.round(longitude * metersPerDegreeLongitude / gridMeters);
    const y = Math.round(latitude * metersPerDegreeLatitude / gridMeters);
    const keys = this.fingerprintKeys();
    const centerHashes = keys.map(key => this.fingerprint(["tree-location-cell-v1", x, y], key.key));
    const keyIds = keys.map(key => key.id);
    const radiusCells = Math.ceil(5 / gridMeters);
    const candidateHashes: string[] = [];
    for (const key of keys) {
      for (let dx = -radiusCells; dx <= radiusCells; dx += 1) {
        for (let dy = -radiusCells; dy <= radiusCells; dy += 1) {
          if (Math.hypot(dx * gridMeters, dy * gridMeters) > 5 + Math.SQRT2 * gridMeters) continue;
          candidateHashes.push(this.fingerprint(["tree-location-cell-v1", x + dx, y + dy], key.key));
        }
      }
    }
    return { centerHashes, keyIds, candidateHashes };
  }
  private tripFingerprintPayload(route: string, samples: readonly GpsSample[]) {
    const signature_sets = Object.fromEntries(this.fingerprintKeys().map(key => [
      key.id,
      [...new Set(samples.map(sample => {
        const tick = Math.floor(sample.timestamp.getTime() / 30_000);
        return this.fingerprint(["trip-slot", tick, sample.latitude.toFixed(4), sample.longitude.toFixed(4)], key.key);
      }))].sort(),
    ]));
    return { route, signature_sets };
  }
  private async isDuplicateTrip(client: PoolClient, userId: string, route: string, samples: readonly GpsSample[], exactDigest: string) {
    const candidates = await client.query<{ digest: string; payload: { route?: string; signature_sets?: Record<string, string[]> } }>(
      `select fingerprint.digest,fingerprint.payload
       from fingerprints fingerprint
       join claims claim on claim.id=fingerprint.claim_id
       where fingerprint.type='trip' and claim.user_id=$1 and claim.state='verified'`,
      [userId],
    );
    const current = this.tripFingerprintPayload(route, samples);
    for (const candidate of candidates.rows) {
      if (candidate.digest === exactDigest) return true;
      if (!candidate.payload.signature_sets) continue;
      for (const [keyId, signatures] of Object.entries(current.signature_sets)) {
        const candidateSignatures = candidate.payload.signature_sets[keyId];
        if (!candidateSignatures) continue;
        const prior = new Set(candidateSignatures);
        const shared = signatures.filter(signature => prior.has(signature)).length;
        if (shared * 100 >= Math.max(signatures.length, prior.size, 1) * 80) return true;
      }
    }
    return false;
  }
  private requestDigest(input: unknown) { return createHash("sha256").update(this.canonicalJson(input)).digest("hex"); }
  private canonicalJson(value: unknown): string { if (value === null || typeof value === "boolean" || typeof value === "string" || typeof value === "number") return JSON.stringify(value); if (Array.isArray(value)) return `[${value.map(item => this.canonicalJson(item)).join(",")}]`; const record = value as Record<string, unknown>; return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${this.canonicalJson(record[key])}`).join(",")}}`; }
  private async assertEvidence(client:PoolClient,user:string,ids:string[],kind:string) {
    if (!Array.isArray(ids)||!ids.length) this.invalid("ต้องมีหลักฐาน");
    const result=await client.query<{id:string}>(
      `select evidence.id from evidence
       where evidence.user_id=$1 and evidence.id=any($2::uuid[]) and evidence.kind=$3
         and evidence.deleted_at is null and (evidence.expires_at is null or evidence.expires_at>now())
         and not exists(select 1 from claim_evidence binding where binding.evidence_id=evidence.id)
       for update`,
      [user,ids,kind],
    );
    if(result.rowCount!==new Set(ids).size) this.invalid("หลักฐานไม่ครบ หมดอายุ หรือถูกใช้กับคำขออื่นแล้ว");
  }
  private async prepareBusEvaluation(client: PoolClient, userId: string, input: any) {
    const start = new Date(input.boardedAt);
    const end = new Date(input.alightedAt);
    if (start > end) this.invalid("เวลาขึ้นรถต้องไม่อยู่หลังเวลาลงรถ");
    await this.assertEvidence(client, userId, input.evidenceIds, "gps_trace");
    const traceDigest = createHash("sha256").update(JSON.stringify(input.samples)).digest("hex");
    const matchingTrace = await client.query(
      "select 1 from evidence where id=any($1::uuid[]) and kind='gps_trace' and sha256=$2",
      [input.evidenceIds, traceDigest],
    );
    if (!(matchingTrace.rowCount ?? 0)) this.invalid("ร่องรอย GPS ที่อัปโหลดไม่ตรงกับตัวอย่างที่ส่งตรวจ");
    const samples: GpsSample[] = input.samples.map((sample: any, index: number) => ({
      id: sample.sampleId ?? `${index}`,
      timestamp: new Date(sample.recordedAt),
      latitude: Number(sample.latitude),
      longitude: Number(sample.longitude),
      accuracyMeters: Number(sample.accuracyMeters),
    }));
    await client.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [`bus-physical:${userId}`]);
    const owner = await client.query<{ is_demo: boolean }>("select is_demo from users where id=$1", [userId]);
    if (!owner.rows[0]) this.invalid("ไม่พบบัญชีผู้ใช้");
    const oracle = await this.busOracle(client, input.routeName, start, end, samples, owner.rows[0]!.is_demo);
    const preliminaryEvaluation = evaluateBus(samples, oracle.config, false);
    const canonicalSamples = preliminaryEvaluation.representatives;
    const canonicalPayload = this.tripFingerprintPayload(input.routeName, canonicalSamples);
    const fingerprint = this.fingerprint(["trip", JSON.stringify(canonicalPayload)]);
    const duplicate = await this.isDuplicateTrip(client, userId, input.routeName, canonicalSamples, fingerprint);
    const evaluation = duplicate ? evaluateBus(samples, oracle.config, true) : preliminaryEvaluation;
    const gpsEvidence = await client.query<{ id: string }>(
      "select id from evidence where id=any($1::uuid[]) and kind='gps_trace' limit 1",
      [input.evidenceIds],
    );
    const gpsEvidenceId = gpsEvidence.rows[0]?.id;
    if (!gpsEvidenceId) this.invalid("ไม่พบหลักฐานร่องรอย GPS");
    return {
      canonicalPayload,
      distanceKm: this.distanceKm(evaluation.representatives),
      evaluation,
      fingerprint,
      gpsEvidenceId,
      oracle,
      start,
      end,
    };
  }
  private async storeBusRepresentatives(client: PoolClient, evidenceId: string, samples: readonly GpsSample[]) {
    for (const sample of samples) {
      await client.query(
        `insert into gps_samples(evidence_id,stable_id,captured_at,location,accuracy_m)
         values($1,$2,$3,ST_SetSRID(ST_MakePoint($4,$5),4326)::geography,$6)
         on conflict(evidence_id,stable_id) do nothing`,
        [evidenceId, sample.id, sample.timestamp, sample.longitude, sample.latitude, sample.accuracyMeters],
      );
    }
  }
  private async busOracle(client: PoolClient, routeName: string, start: Date, end: Date, samples: readonly GpsSample[], ownerIsDemo: boolean) {
    const route = await client.query<{ id: string; version: number }>("select id,version from routes where code=$1 and is_demo=$2 order by version desc limit 1", [routeName, ownerIsDemo]);
    if (!route.rows[0]) this.invalid("ไม่พบเส้นทางรถโดยสารที่อนุมัติ");
    const routeId = route.rows[0].id;
    const stops = await client.query<{ id: string; sequence: number; longitude: string; latitude: string; geofence_m: string }>("select s.id,s.sequence,ST_X(s.location::geometry)::text longitude,ST_Y(s.location::geometry)::text latitude,s.geofence_m::text from route_stops s where s.route_id=$1", [routeId]);
    const corridor = await client.query<{ config_hash: string }>("select config_hash from route_corridors where route_id=$1 order by version desc limit 1", [routeId]);
    const corridorAvailable = corridor.rows[0] !== undefined;
    const insideRoute = new Set<string>();
    if (corridorAvailable) {
      const checks = await client.query<{ key: string; inside: boolean }>(
        `select sample.key,
                exists(
                  select 1 from route_corridors
                  where route_id=$1 and config_hash=$3
                    and ST_Covers(corridor,ST_SetSRID(ST_MakePoint(sample.longitude,sample.latitude),4326))
                ) as inside
         from jsonb_to_recordset($2::jsonb) as sample(key text,longitude double precision,latitude double precision)`,
        [
          routeId,
          JSON.stringify(samples.map((sample) => ({
            key: `${sample.longitude}:${sample.latitude}`,
            longitude: sample.longitude,
            latitude: sample.latitude,
          }))),
          corridor.rows[0]!.config_hash,
        ],
      );
      for (const check of checks.rows) if (check.inside) insideRoute.add(check.key);
    }
    const distance = (a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) => this.haversine(a.latitude, a.longitude, b.latitude, b.longitude);
    return {
      routeId,
      routeVersion: route.rows[0].version,
      configHash: corridor.rows[0]?.config_hash ?? "route-corridor-unavailable",
      corridorAvailable,
      config: {
        start, end, maxAccuracyMeters: 100, routeAvailable: corridorAvailable,
        isInsideStop: (point: { latitude: number; longitude: number }) => stops.rows.find(stop => distance(point, { latitude: Number(stop.latitude), longitude: Number(stop.longitude) }) <= Number(stop.geofence_m))?.id ?? null,
        isInsideRoute: (point: { latitude: number; longitude: number }) => insideRoute.has(`${point.longitude}:${point.latitude}`),
        distanceMeters: distance,
        stopPairDistanceMeters: (fromStopId: string, toStopId: string) => {
          const from = stops.rows.find(stop => stop.id === fromStopId);
          const to = stops.rows.find(stop => stop.id === toStopId);
          return from && to && to.sequence === from.sequence + 1
            ? distance({ latitude: Number(from.latitude), longitude: Number(from.longitude) }, { latitude: Number(to.latitude), longitude: Number(to.longitude) })
            : null;
        },
      },
    };
  }
  private async claimResponse(client:{query:PoolClient["query"]},id:string) {
    const r=await client.query<any>(
      "select claim.id,claim.activity,claim.state,claim.impact_status,claim.reason_code,claim.submitted_at,claim.decided_at,claim.data_scope,claim.is_mock,claim.is_synthetic,claim.demo_only,claim.fixture_id from claims claim where claim.id=$1",
      [id],
    );
    const c=r.rows[0];
    if (!c) throw new NotFoundException({code:"NOT_FOUND",message:"ไม่พบคำขอ"});
    const ledger = await client.query<any>("select kg_co2e::text,impact_type from carbon_ledger where claim_id=$1",[id]);
    const points = await client.query<any>("select coalesce(sum(points),0)::int points from point_ledger where claim_id=$1",[id]);
    const evidence = await client.query<{ evidence_id: string }>("select evidence_id from claim_evidence where claim_id=$1 order by evidence_id",[id]);
    return {claim:{
      id:c.id,activity:c.activity,status:c.state,impact_status:c.impact_status,
      data_scope:c.data_scope,
      is_mock:c.is_mock,
      is_synthetic:c.is_synthetic,
      demo_only:c.demo_only,
      fixture_id:c.fixture_id,
      reason_code:c.reason_code,submitted_at:c.submitted_at.toISOString(),
      decided_at:c.decided_at?.toISOString()??null,
      awarded_points:points.rows[0]?.points ?? 0,impacts:ledger.rows,
      evidence_ids:evidence.rows.map(row=>row.evidence_id),
    }};
  }
  private fingerprintKeys(){return [{id:this.config.FINGERPRINT_KEY_ID,key:this.config.FINGERPRINT_HMAC_KEY},...(this.config.FINGERPRINT_PREVIOUS_KEY_ID&&this.config.FINGERPRINT_PREVIOUS_HMAC_KEY?[{id:this.config.FINGERPRINT_PREVIOUS_KEY_ID,key:this.config.FINGERPRINT_PREVIOUS_HMAC_KEY}]:[])];} private percent(metric:any){return metric.available?Number((metric.ratio*100).toFixed(4)):0;} private distanceKm(samples: readonly { latitude: number; longitude: number }[]){let m=0;for(let i=1;i<samples.length;i++){const previous=samples[i-1];const current=samples[i];if(!previous||!current)continue;m+=this.haversine(previous.latitude,previous.longitude,current.latitude,current.longitude);}return m/1000;} private haversine(a:number,b:number,c:number,d:number){const r=Math.PI/180,x=(c-a)*r,y=(d-b)*r;const q=Math.sin(x/2)**2+Math.cos(a*r)*Math.cos(c*r)*Math.sin(y/2)**2;return 6371000*2*Math.atan2(Math.sqrt(q),Math.sqrt(1-q));} private fingerprint(parts:unknown[],key=this.config.FINGERPRINT_HMAC_KEY){return createHmac("sha256",key).update(JSON.stringify(parts)).digest("hex");} private requiredKey(k:string){if(!k) this.invalid("ต้องระบุรหัสป้องกันการส่งซ้ำ");} private invalid(message:string):never{throw new BadRequestException({code:"VALIDATION_ERROR",message});}
  private async audit(c:PoolClient,a:string,e:string,t:string,id:string,m:unknown){
    const actor=await c.query<{is_demo:boolean;role:string}>("select is_demo,role::text from users where id=$1",[a]);
    const isMock=actor.rows[0]?.is_demo===true;
    const metadata={
      ...(typeof m==="object"&&m!==null&&!Array.isArray(m)?m as Record<string,unknown>:{detail:m}),
      correlation_id:isMock?"mock-demo:FIXTURE-BKK-20260812-01":`${e}:${id}`,
      actor_role:actor.rows[0]?.role??"unknown",
      data_scope:isMock?"mock_demo":"production",
      is_mock:isMock,
      demo_only:isMock,
      fixture_id:isMock?"FIXTURE-BKK-20260812-01":null,
      outcome:e,
    };
    await c.query("insert into audit_events(actor_id,event_type,subject_type,subject_id,metadata) values($1,$2,$3,$4,$5)",[a,e,t,id,JSON.stringify(metadata)]);
  }
}
