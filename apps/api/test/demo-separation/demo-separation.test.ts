import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";

import { DatabaseService } from "../../src/database/database.service.js";
import { RewardsService } from "../../src/rewards/rewards.service.js";
import { bearer, createTestApp, describeIntegration, login, resetPublicData, uploadTestEvidence } from "../helpers/test-app.js";

describeIntegration("demo and real-data separation", () => {
  let app: NestFastifyApplication;
  let user: string;
  let admin: string;
  let database: DatabaseService;

  beforeAll(async () => { await resetPublicData(); app = await createTestApp(); database = app.get(DatabaseService); });
  beforeEach(async () => { await resetPublicData(); user = await login(app, "user"); admin = await login(app, "admin"); });
  afterAll(async () => { await app?.close(); });

  it("returns only demo rewards to a demo user and keeps real rewards outside that catalog", async () => {
    await database.query(`
      with account as (insert into users(email,display_name,role,is_demo) values ('real@example.test','ผู้ใช้จริง','merchant',false) returning id),
      merchant as (insert into merchants(user_id,name,is_demo) select id,'ร้านค้าจริง',false from account returning id)
      insert into rewards(merchant_id,title_th,point_cost,is_demo) select id,'รางวัลข้อมูลจริง',1,false from merchant`);
    const catalog = await request(app.getHttpServer()).get("/api/rewards").set(bearer(user)).expect(200);
    expect(catalog.body.items).toHaveLength(2);
    expect(catalog.body.items.every((item: { titleThai: string }) => item.titleThai.includes("สาธิต"))).toBe(true);
    const scopes = await database.query<{ is_demo: boolean; count: number }>("select is_demo,count(*)::int count from rewards group by is_demo order by is_demo");
    expect(scopes.rows).toEqual([{ is_demo: false, count: 1 }, { is_demo: true, count: 2 }]);
  });

  it("derives reward labels from persisted scope and rejects cross-scope voucher operators", async () => {
    const rewards = app.get(RewardsService);
    const demoCatalog = await request(app.getHttpServer()).get("/api/rewards").set(bearer(user)).expect(200);
    expect(demoCatalog.body).toMatchObject({ dataScope: "mock_demo", isMock: true, demoOnly: true });
    expect(demoCatalog.body.items.every((item: { dataScope: string; isMock: boolean; demoOnly: boolean }) => item.dataScope === "mock_demo" && item.isMock && item.demoOnly)).toBe(true);

    const production = await database.query<{ user_id: string; voucher_id: string }>(`
      with operator as (
        insert into users(email,display_name,role,is_demo)
        values ('production-admin@example.test','ผู้ดูแลจริง','admin',false)
        returning id
      ),
      owner as (
        insert into users(email,display_name,role,is_demo)
        values ('production-owner@example.test','ผู้ใช้จริง','user',false)
        returning id
      ),
      merchant_account as (
        insert into users(email,display_name,role,is_demo)
        values ('production-merchant@example.test','ร้านค้าจริง','merchant',false)
        returning id
      ),
      merchant as (
        insert into merchants(user_id,name,is_demo)
        select id,'ร้านค้าจริง',false from merchant_account
        returning id
      ),
      reward as (
        insert into rewards(merchant_id,title_th,point_cost,is_demo)
        select id,'รางวัลจริง',10,false from merchant
        returning id
      ),
      voucher as (
        insert into vouchers(user_id,reward_id,point_cost,token_hash,display_code,expires_at)
        select owner.id,reward.id,10,repeat('a',64),'PRODUCTION-VOUCHER',now()+interval '7 days'
        from owner cross join reward
        returning id
      )
      select operator.id user_id, voucher.id voucher_id from operator cross join voucher`);
    const productionRow = production.rows[0];
    if (!productionRow) throw new Error("production scope fixture was not created");
    const productionCatalog = await rewards.catalog({ id: productionRow.user_id, role: "admin", displayName: "ผู้ดูแลจริง" });
    expect(productionCatalog).toMatchObject({ dataScope: "production", isMock: false, demoOnly: false });
    expect(productionCatalog.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ titleThai: "รางวัลจริง", dataScope: "production", isMock: false, demoOnly: false }),
    ]));

    const demoVoucher = await database.query<{ id: string }>(
      `insert into vouchers(user_id,reward_id,point_cost,token_hash,display_code,expires_at)
       values ('11111111-1111-4111-8111-111111111111','66666666-6666-4666-8666-666666666661',20,repeat('b',64),'DEMO-CROSS-SCOPE',now()+interval '7 days')
       returning id`,
    );
    const demoVoucherRow = demoVoucher.rows[0];
    if (!demoVoucherRow) throw new Error("demo voucher fixture was not created");
    await expect(rewards.cancelByOperator(
      { id: productionRow.user_id, role: "admin", displayName: "ผู้ดูแลจริง" },
      demoVoucherRow.id,
      "production-admin-cross-scope",
    )).rejects.toMatchObject({ status: 403 });
  });

  it("stores leaderboard projections in distinct demo and real scopes", async () => {
    await database.query("insert into community_projections(week_start,is_demo,points) values (date_trunc('week',now() at time zone 'Asia/Bangkok')::date,true,7),(date_trunc('week',now() at time zone 'Asia/Bangkok')::date,false,99)");
    const scopes = await database.query<{ is_demo: boolean; points: number }>("select is_demo,points from community_projections order by is_demo");
    expect(scopes.rows).toEqual([{ is_demo: false, points: 99 }, { is_demo: true, points: 7 }]);
    const leaderboard = await request(app.getHttpServer()).get("/api/leaderboard/weekly").set(bearer(user)).expect(200);
    expect(leaderboard.body.data_scope).toBe("demo");
  });

  it("keeps synthetic factors outside both production and mock approvals", async () => {
    const synthetic = await database.query<{ id: string }>(`
      insert into factor_catalog(activity,code,version,value,unit,source_url,methodology_code,effective_at,disclaimer_th,proxy_copy_th,is_synthetic)
      values ('tree','TEST_SYNTHETIC_ONLY','v1',9.5,'kgCO2e/tree/year','https://example.test/source','TEST_ONLY',now(),'ค่าทดสอบ','ค่าทดสอบ',true) returning id`);
    await expect(database.query("update factor_catalog set status='approved',approved_by='44444444-4444-4444-8444-444444444444',approved_at=now() where id=$1", [synthetic.rows[0]?.id])).rejects.toThrow();
    await expect(database.query(
      `insert into mock_demo_factor_approvals(factor_id,approved_by,approved_role,reviewed_digest)
       select id,'44444444-4444-4444-8444-444444444444','admin',review_digest from factor_catalog where id=$1`,
      [synthetic.rows[0]?.id],
    )).rejects.toThrow();
    const readiness = await request(app.getHttpServer()).get("/api/admin/factors/demo-readiness").set(bearer(admin)).expect(200);
    expect(readiness.body.syntheticFactorsAccepted).toBe(false);
    expect(readiness.body.mockDemoReady).toBe(true);
  });

  it("keeps all three readiness rows fail-closed when a manifest entry is missing or mismatched", async () => {
    const client = await database.pool.connect();
    try {
      await client.query("begin");
      await client.query("set local session_replication_role='replica'");
      await client.query("delete from demo_factor_manifest_revisions where activity='tree'");
      await client.query("delete from demo_factor_manifest where activity='tree'");
      await client.query("commit");
    } finally {
      client.release();
    }
    const missing = await request(app.getHttpServer()).get("/api/admin/factors/demo-readiness").set(bearer(admin)).expect(200);
    expect(Object.keys(missing.body.activities).sort()).toEqual(["bus", "recycling", "tree"]);
    expect(missing.body).toMatchObject({ mockDemoReady: false, productionReady: false, activities: { tree: { ready: false, factorId: null } } });

    await resetPublicData();
    const mismatchClient = await database.pool.connect();
    try {
      await mismatchClient.query("begin");
      await mismatchClient.query("set local session_replication_role='replica'");
      await mismatchClient.query(
        `update factor_catalog
         set activity='bus'
         where id=(select factor_id from current_demo_factor_manifest where activity='tree')`,
      );
      await mismatchClient.query("commit");
    } finally {
      mismatchClient.release();
    }
    const mismatched = await request(app.getHttpServer()).get("/api/admin/factors/demo-readiness").set(bearer(admin)).expect(200);
    expect(mismatched.body).toMatchObject({ mockDemoReady: false, activities: { tree: { ready: false, factorId: null } } });
  });

  it("labels seeded factors as immutable mock/demo-only approvals while production remains unavailable", async () => {
    const readiness = await request(app.getHttpServer()).get("/api/admin/factors/demo-readiness").set(bearer(admin)).expect(200);
    expect(readiness.body).toMatchObject({
      mockDemoReady: true,
      productionReady: false,
      tgoEndorsed: false,
      physicalEvidence: false,
      syntheticFactorsAccepted: false,
      activities: {
        bus: { approvalScope: "mock_demo", isMock: true, demoOnly: true },
        recycling: { approvalScope: "mock_demo", isMock: true, demoOnly: true },
        tree: { approvalScope: "mock_demo", isMock: true, demoOnly: true },
      },
    });
    const factors = await request(app.getHttpServer()).get("/api/admin/factors").set(bearer(admin)).expect(200);
    expect(factors.body.items).toHaveLength(6);
    expect(factors.body.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: "draft", mock_approval_scope: "mock_demo", mock_is_mock: true, mock_demo_only: true }),
    ]));
    expect(factors.body.items.every((factor: { review_digest: string; mock_approved_at: string }) => /^[a-f0-9]{64}$/.test(factor.review_digest) && !!factor.mock_approved_at)).toBe(true);
  });

  it("never promotes factor-only production prerequisites to aggregate production readiness", async () => {
    const productionAdmin = await database.query<{ id: string }>(
      `insert into users(email,display_name,role,is_demo)
       values('production-admin@example.test','ผู้ดูแลข้อมูลจริง','admin',false)
       returning id`,
    );
    const client = await database.pool.connect();
    try {
      await client.query("begin");
      await client.query("set local session_replication_role='replica'");
      await client.query("delete from mock_demo_factor_approvals");
      await client.query(
        `update factor_catalog
         set status='approved',approved_by=$1,approved_role='admin',approved_at=now()
         where id in (select factor_id from current_demo_factor_manifest)`,
        [productionAdmin.rows[0]!.id],
      );
      await client.query("update deployment_metadata set data_scope='production' where singleton=true");
      await client.query("commit");
    } finally {
      client.release();
    }
    const readiness = await request(app.getHttpServer())
      .get("/api/admin/factors/demo-readiness")
      .set(bearer(admin))
      .expect(200);
    expect(readiness.body).toMatchObject({
      productionFactorsReady: true,
      productionReady: false,
      tgoEndorsed: false,
      physicalEvidence: false,
    });
  });

  it("never lets a production-scoped claim consume a mock-demo approval", async () => {
    const claim = await database.query<{ id: string }>(
      `with account as (
         insert into users(email,display_name,role,is_demo)
         values ('real-factor-scope@example.test','ผู้ใช้ขอบเขตจริง','user',false)
         returning id
       )
       insert into claims(
         user_id,activity,state,impact_status,idempotency_scope,idempotency_key,
         request_digest,impact_input,reason_code,decided_at
       )
       select id,'tree','verified','blocked_factor_approval','tree','real-mock-scope-denial',
              repeat('a',64),'{}'::jsonb,'verified_ai',now()
       from account
       returning id`,
    );
    const evaluated = await database.query<{ credited: boolean }>(
      "select evaluate_blocked_claim_impact($1) credited",
      [claim.rows[0]!.id],
    );
    expect(evaluated.rows[0]?.credited).toBe(false);
    const valueRows = await database.query<{ calculations: number; carbon: number; points: number }>(
      `select
         (select count(*)::int from calculation_snapshots where claim_id=$1) calculations,
         (select count(*)::int from carbon_ledger where claim_id=$1) carbon,
         (select count(*)::int from point_ledger where claim_id=$1) points`,
      [claim.rows[0]!.id],
    );
    expect(valueRows.rows[0]).toEqual({ calculations: 0, carbon: 0, points: 0 });
  });

  it("counts a corrected claim once and includes its compensating point entry in the Bangkok week", async () => {
    const factors = await request(app.getHttpServer()).get("/api/admin/factors").set(bearer(admin)).expect(200);
    const treeFactor = factors.body.items.find((factor: { activity: string }) => factor.activity === "tree");
    await request(app.getHttpServer()).patch(`/api/admin/factors/${treeFactor.id}/approve`).set(bearer(admin)).send({}).expect(200);
    const capturedAt = new Date().toISOString();
    const evidence = await uploadTestEvidence(app, user, {
      kind: "photo",
      mimeType: "image/jpeg",
      body: Buffer.from("corrected-leaderboard-tree"),
      capture: {
        capturedAt,
        camera: { make: "Test", model: "Corrected tree" },
        latitude: 13.7649,
        longitude: 100.5383,
      },
    });
    const tree = await request(app.getHttpServer())
      .post("/api/actions/tree")
      .set(bearer(user))
      .set("idempotency-key", "corrected-leaderboard-tree")
      .send({
        evidenceIds: [evidence.evidenceId],
        speciesThaiName: "ต้นไม้แก้ไขผล",
        plantedAt: capturedAt,
        quantity: 1,
        latitude: "13.7649",
        longitude: "100.5383",
        demoAiResult: "pass",
      })
      .expect(201);
    expect(tree.body.claim.awarded_points).toBe(15);
    await request(app.getHttpServer())
      .post(`/api/review/claims/${tree.body.claim.id}/corrections`)
      .set(bearer(admin))
      .send({ correctedTotalKgCo2e: "8.000000", reason: "ทดสอบรายการชดเชยในอันดับ" })
      .expect(201);
    const leaderboard = await request(app.getHttpServer()).get("/api/leaderboard/weekly").set(bearer(user)).expect(200);
    expect(leaderboard.body.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ pseudonym_th: "ผู้ใช้-ใบไม้-1001", weekly_points: 15 }),
      expect.objectContaining({ pseudonym_th: "ใบไม้ยามเช้า", weekly_points: 75 }),
    ]));
    expect(leaderboard.body.community_totals.verified_weekly_points).toBe(15);

    const week = await database.query<{ week_start: string }>(
      "select date_trunc('week',now() at time zone 'Asia/Bangkok')::date::text week_start",
    );
    await database.query("select rebuild_bangkok_weekly_projections($1::date,true)", [week.rows[0]!.week_start]);
    const projection = await database.query<{
      leaderboard_points: number;
      community_points: number;
      projected: string;
      avoided: string;
    }>(
      `select
         (select points from weekly_leaderboard where week_start=$1::date and user_id='11111111-1111-4111-8111-111111111111') leaderboard_points,
         community.points community_points,
         community.projected_sequestration_kg_co2e::text projected,
         community.avoided_kg_co2e::text avoided
       from community_projections community
       where community.week_start=$1::date and community.is_demo=true`,
      [week.rows[0]!.week_start],
    );
    expect(projection.rows[0]).toEqual({
      leaderboard_points: 15,
      community_points: 15,
      projected: "8.000000",
      avoided: "0.000000",
    });
  });
});

if (!process.env.TEST_DATABASE_URL) describe("demo separation configuration", () => it.skip("requires TEST_DATABASE_URL and object-storage test settings", () => undefined));
