import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";

import { CommunityService } from "../../src/community/community.service.js";
import { TREE_PHOTO_VERIFIER, type TreePhotoVerifier } from "../../src/claims/tree-photo-verifier.js";
import { DatabaseService } from "../../src/database/database.service.js";
import {
  bearer,
  createTestApp,
  describeIntegration,
  login,
  resetPublicData,
  uploadTestEvidence,
} from "../helpers/test-app.js";

describeIntegration("complete Thai hackathon demo", () => {
  let app: NestFastifyApplication;
  let database: DatabaseService;
  let user: string;
  let merchant: string;
  let admin: string;

  beforeAll(async () => {
    await resetPublicData();
    app = await createTestApp();
    database = app.get(DatabaseService);
  });
  beforeEach(async () => {
    await resetPublicData();
    user = await login(app, "user");
    merchant = await login(app, "merchant");
    admin = await login(app, "admin");
  });
  afterAll(async () => {
    await app?.close();
  });

  it("links all three verified actions to separated impact, points, one-time reward, and demo-only community views", async () => {
    const treeProvider = app.get<TreePhotoVerifier>(TREE_PHOTO_VERIFIER);
    const providerCall = vi.spyOn(treeProvider, "verify").mockRejectedValue(new Error("external tree provider must not run"));
    const factors = await request(app.getHttpServer())
      .get("/api/admin/factors")
      .set(bearer(admin))
      .expect(200);
    expect(factors.body.items.map((factor: { activity: string }) => factor.activity).sort()).toEqual([
      "bus",
      "recycling",
      "tree",
    ]);
    for (const factor of factors.body.items as Array<{ id: string }>) {
      await request(app.getHttpServer())
        .patch(`/api/admin/factors/${factor.id}/approve`)
        .set(bearer(admin))
        .send({})
        .expect(200);
    }
    const readiness = await request(app.getHttpServer())
      .get("/api/admin/factors/demo-readiness")
      .set(bearer(admin))
      .expect(200);
    expect(readiness.body).toMatchObject({
      mockDemoReady: true,
      productionReady: false,
      tgoEndorsed: false,
      physicalEvidence: false,
    });

    const treeCapturedAt = new Date().toISOString();
    const treeEvidence = await uploadTestEvidence(app, user, {
      kind: "photo",
      mimeType: "image/jpeg",
      body: Buffer.from("complete-demo-tree-photo"),
      capture: {
        capturedAt: treeCapturedAt,
        camera: { make: "Playwright", model: "กล้องสาธิตในแอป" },
        latitude: 13.7649,
        longitude: 100.5383,
      },
    });
    const tree = await request(app.getHttpServer())
      .post("/api/actions/tree")
      .set(bearer(user))
      .set("idempotency-key", "complete-demo-tree")
      .send({
        evidenceIds: [treeEvidence.evidenceId],
        speciesThaiName: "ต้นราชพฤกษ์",
        plantedAt: treeCapturedAt,
        quantity: 1,
        latitude: "13.7649",
        longitude: "100.5383",
        demoAiResult: "pass",
      })
      .expect(201);
    expect(tree.body.claim).toMatchObject({
      activity: "tree",
      status: "verified",
      impact_status: "credited",
      awarded_points: 15,
      data_scope: "mock_demo",
      is_mock: true,
      demo_only: true,
    });
    expect(providerCall).not.toHaveBeenCalled();

    const recyclingCapturedAt = new Date().toISOString();
    const recyclingEvidence = await uploadTestEvidence(app, user, {
      kind: "photo",
      mimeType: "image/jpeg",
      body: Buffer.from("complete-demo-recycling-photo"),
      capture: {
        capturedAt: recyclingCapturedAt,
        camera: { make: "Playwright", model: "กล้องสาธิตในแอป" },
      },
    });
    const recycling = await request(app.getHttpServer())
      .post("/api/actions/recycling")
      .set(bearer(user))
      .set("idempotency-key", "complete-demo-recycling")
      .send({
        evidenceIds: [recyclingEvidence.evidenceId],
        binCode: "DEMO-BIN-BKK-01:TOKEN-0001",
        material: "plastic",
        itemCount: 46,
        droppedOffAt: recyclingCapturedAt,
      })
      .expect(201);
    expect(recycling.body.claim).toMatchObject({
      activity: "recycling",
      status: "verified",
      impact_status: "credited",
      awarded_points: 20,
    });

    const busStart = Date.now() - 180_000;
    const busLongitudes = [100.535, 100.5358, 100.53735, 100.5387, 100.5395, 100.54105, 100.5424];
    const samples = busLongitudes.map((longitude, index) => ({
      sampleId: `complete-demo-bus-${index}`,
      recordedAt: new Date(busStart + index * 30_000).toISOString(),
      latitude: "13.7649",
      longitude: longitude.toFixed(5),
      accuracyMeters: "5",
    }));
    const busEvidence = await uploadTestEvidence(app, user, {
      kind: "gps_trace",
      mimeType: "application/json",
      body: Buffer.from(JSON.stringify(samples)),
      capture: {
        capturedAt: samples[0]!.recordedAt,
        latitude: 13.7649,
        longitude: 100.535,
      },
    });
    const bus = await request(app.getHttpServer())
      .post("/api/actions/bus")
      .set(bearer(user))
      .set("idempotency-key", "complete-demo-bus")
      .send({
        evidenceIds: [busEvidence.evidenceId],
        routeName: "DEMO-BUS-01",
        boardedAt: samples[0]!.recordedAt,
        alightedAt: samples.at(-1)!.recordedAt,
        samples,
      })
      .expect(201);
    expect(bus.body.claim).toMatchObject({
      activity: "bus",
      status: "verified",
      impact_status: "credited",
      awarded_points: 3,
    });

    const lineage = await database.query<{
      activity: string;
      impact_type: string;
      kg_co2e: string;
      points: number;
      is_demo: boolean;
      is_synthetic: boolean;
      factor_status: string;
      approval_scope: string;
      calculation_is_mock: boolean;
      calculation_demo_only: boolean;
      reviewed_digest: string;
      approved_by: string;
    }>(
      `select
         claim.activity::text activity,
         carbon.impact_type::text impact_type,
         carbon.kg_co2e::text,
         coalesce(points.points, 0)::int points,
         account.is_demo,
         factor.is_synthetic,
         factor.status::text factor_status,
         calculation.approval_scope,
         calculation.is_mock calculation_is_mock,
         calculation.demo_only calculation_demo_only,
         calculation.reviewed_digest,
         calculation.factor_snapshot->>'approved_by' approved_by
       from claims claim
       join users account on account.id = claim.user_id
       join calculation_snapshots calculation on calculation.claim_id = claim.id and calculation.entry_kind = 'original'
       join factor_catalog factor on factor.id = calculation.factor_id
       join carbon_ledger carbon on carbon.calculation_id = calculation.id
       left join lateral (
         select sum(point_ledger.points)::int points
         from point_ledger
         where point_ledger.claim_id = claim.id and point_ledger.kind = 'credit'
       ) points on true
       where claim.id = any($1::uuid[])
       order by claim.activity`,
      [[tree.body.claim.id, recycling.body.claim.id, bus.body.claim.id]],
    );
    expect(lineage.rows.map((row) => row.activity)).toEqual(["bus", "recycling", "tree"]);
    expect(lineage.rows.find((row) => row.activity === "tree")).toMatchObject({
      impact_type: "projected_sequestration",
      kg_co2e: "9.500000",
      points: 15,
      is_demo: true,
      is_synthetic: false,
      factor_status: "draft",
      approval_scope: "mock_demo",
      calculation_is_mock: true,
      calculation_demo_only: true,
      approved_by: "44444444-4444-4444-8444-444444444444",
    });
    expect(lineage.rows.every((row) => /^[a-f0-9]{64}$/.test(row.reviewed_digest))).toBe(true);
    expect(lineage.rows.filter((row) => row.activity !== "tree").every((row) => row.impact_type === "avoided")).toBe(true);
    const mockAudit = await database.query<{ event_type: string; metadata: Record<string, unknown> }>(
      `select event_type,metadata
       from audit_events
       where event_type in ('factor.mock_demo_seeded','impact.credited')
       order by event_type,subject_id`,
    );
    expect(mockAudit.rows.filter((row) => row.event_type === "factor.mock_demo_seeded")).toHaveLength(3);
    expect(mockAudit.rows.filter((row) => row.event_type === "impact.credited")).toHaveLength(3);
    expect(mockAudit.rows.every((row) =>
      row.metadata.data_scope === "mock_demo"
      && row.metadata.is_mock === true
      && row.metadata.demo_only === true,
    )).toBe(true);

    const dashboardBeforeReward = await request(app.getHttpServer())
      .get("/api/dashboard")
      .set(bearer(user))
      .expect(200);
    expect(dashboardBeforeReward.body.points).toBe(38);
    expect(Number(dashboardBeforeReward.body.personal.estimated_avoided_co2e)).toBeGreaterThan(0);
    expect(dashboardBeforeReward.body.personal.projected_sequestration_co2e).toBe("9.500000");
    expect(dashboardBeforeReward.body.community).toEqual(dashboardBeforeReward.body.personal);

    const catalog = await request(app.getHttpServer())
      .get("/api/rewards")
      .set(bearer(user))
      .expect(200);
    const reward = catalog.body.items.find((item: { pointsCost: number }) => item.pointsCost === 20);
    expect(reward).toBeDefined();
    const issued = await request(app.getHttpServer())
      .post("/api/rewards/vouchers")
      .set(bearer(user))
      .set("idempotency-key", "complete-demo-voucher")
      .send({ rewardId: reward.rewardId })
      .expect(201);
    const redeemed = await request(app.getHttpServer())
      .post("/api/merchant/vouchers/scan")
      .set(bearer(merchant))
      .set("idempotency-key", "complete-demo-redemption")
      .send({ code: issued.body.voucher.code })
      .expect(201);
    const redemptionReplay = await request(app.getHttpServer())
      .post("/api/merchant/vouchers/scan")
      .set(bearer(merchant))
      .set("idempotency-key", "complete-demo-redemption")
      .send({ code: issued.body.voucher.code })
      .expect(201);
    const rejectedReuse = await request(app.getHttpServer())
      .post("/api/merchant/vouchers/scan")
      .set(bearer(merchant))
      .set("idempotency-key", "complete-demo-redemption-reuse")
      .send({ code: issued.body.voucher.code })
      .expect(409);
    expect(redeemed.body).toMatchObject({ status: "redeemed" });
    expect(redemptionReplay.body).toEqual(redeemed.body);
    expect(rejectedReuse.body).toMatchObject({ code: "VOUCHER_ALREADY_REDEEMED" });
    const listedVouchers = await request(app.getHttpServer())
      .get("/api/rewards/vouchers")
      .set(bearer(user))
      .expect(200);
    expect(listedVouchers.body).toEqual([
      expect.objectContaining({
        voucherId: issued.body.voucher.voucherId,
        rewardId: reward.rewardId,
        code: issued.body.voucher.code,
        titleThai: "ส่วนลดสินค้า 20 บาท (สาธิต)",
        state: "redeemed",
        dataScope: "mock_demo",
        isMock: true,
        demoOnly: true,
      }),
    ]);
    expect(listedVouchers.body[0]).not.toHaveProperty("status");
    expect(listedVouchers.body[0]).not.toHaveProperty("title");
    const voucherProof = await database.query<{ debits: number; redemptions: number; balance: number }>(
      `select
         (select count(*)::int from point_ledger where voucher_id = $1 and kind = 'debit') debits,
         (select count(*)::int from redemptions where voucher_id = $1) redemptions,
         (select balance from point_balances where user_id = '11111111-1111-4111-8111-111111111111') balance`,
      [issued.body.voucher.voucherId],
    );
    expect(voucherProof.rows[0]).toEqual({ debits: 1, redemptions: 1, balance: 18 });
    const voucherAudit = await database.query<{ event_type: string; metadata: Record<string, unknown> }>(
      `select event_type,metadata from audit_events
       where subject_id=$1 and event_type in ('voucher.issued','voucher.redeemed')
       order by event_type`,
      [issued.body.voucher.voucherId],
    );
    expect(voucherAudit.rows.map((row) => row.event_type)).toEqual(["voucher.issued", "voucher.redeemed"]);
    expect(voucherAudit.rows.every((row) =>
      row.metadata.data_scope === "mock_demo"
      && row.metadata.is_mock === true
      && row.metadata.demo_only === true
      && typeof row.metadata.correlation_id === "string"
      && typeof row.metadata.actor_role === "string",
    )).toBe(true);

    const demoLeaderboard = await request(app.getHttpServer())
      .get("/api/leaderboard/weekly")
      .set(bearer(user))
      .expect(200);
    expect(demoLeaderboard.body).toMatchObject({
      data_scope: "demo",
      viewer: { opted_in: true, pseudonym_th: "ผู้ใช้-ใบไม้-1001" },
      community_totals: {
        verified_weekly_points: 38,
        projected_sequestration_co2e: "9.500000",
      },
    });
    expect(demoLeaderboard.body.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ pseudonym_th: "ผู้ใช้-ใบไม้-1001", weekly_points: 38 }),
      expect.objectContaining({ pseudonym_th: "ใบไม้ยามเช้า", weekly_points: 75 }),
      expect.objectContaining({ pseudonym_th: "สายลมเจ้าพระยา", weekly_points: 63 }),
    ]));
    const auditLineage = await database.query<{ event_type: string }>(
      `select event_type from audit_events
       where metadata->>'correlation_id'='mock-demo:FIXTURE-BKK-20260812-01'
       order by event_type`,
    );
    expect([...new Set(auditLineage.rows.map((row) => row.event_type))]).toEqual(expect.arrayContaining([
      "claim.submitted",
      "factor.mock_demo_approved",
      "factor.mock_demo_seeded",
      "impact.credited",
      "read_model.dashboard_read",
      "read_model.leaderboard_read",
      "voucher.issued",
      "voucher.redeemed",
    ]));

    const realUserId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    await database.query(
      `with account as (
         insert into users(id,email,display_name,role,is_demo)
         values ($1,'real.scope@example.test','ผู้ใช้ข้อมูลจริง','user',false)
         returning id
       )
       insert into point_balances(user_id,balance) select id,0 from account`,
      [realUserId],
    );
    const community = app.get(CommunityService);
    const realDashboard = await community.getDashboard(realUserId);
    const realLeaderboard = await community.getWeeklyLeaderboard(realUserId);
    expect(realDashboard.community).toEqual({
      estimated_avoided_co2e: "0",
      projected_sequestration_co2e: "0",
    });
    expect(realLeaderboard).toMatchObject({
      data_scope: "real",
      entries: [],
      community_totals: {
        verified_weekly_points: 0,
        estimated_avoided_co2e: "0",
        projected_sequestration_co2e: "0",
      },
    });

    await request(app.getHttpServer())
      .put("/api/leaderboard/consent")
      .set(bearer(user))
      .send({ optedIn: false })
      .expect(200);
    const optedOut = await request(app.getHttpServer())
      .get("/api/leaderboard/weekly")
      .set(bearer(user))
      .expect(200);
    expect(optedOut.body.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ pseudonym_th: "ใบไม้ยามเช้า", weekly_points: 75 }),
      expect.objectContaining({ pseudonym_th: "ต้นกล้าริมทาง", weekly_points: 12 }),
    ]));
    expect(optedOut.body.viewer).toEqual({ opted_in: false, pseudonym_th: null });
    expect(optedOut.body.community_totals.verified_weekly_points).toBe(38);
  });
});

if (!process.env.TEST_DATABASE_URL) {
  describe("complete Thai hackathon demo configuration", () => {
    it.skip("requires TEST_DATABASE_URL and object-storage test settings", () => undefined);
  });
}
