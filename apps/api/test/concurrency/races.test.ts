import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";

import { DatabaseService } from "../../src/database/database.service.js";
import { bearer, createTestApp, describeIntegration, login, resetPublicData } from "../helpers/test-app.js";

describeIntegration("voucher races", () => {
  let app: NestFastifyApplication;
  let user: string;
  let merchant: string;
  let database: DatabaseService;
  let balanceClaimId: string;

  beforeAll(async () => { await resetPublicData(); app = await createTestApp(); database = app.get(DatabaseService); });
  beforeEach(async () => {
    await resetPublicData();
    user = await login(app, "user"); merchant = await login(app, "merchant");
    const claim = await database.query<{ id: string }>(
      `insert into claims(user_id,activity,state,idempotency_scope,idempotency_key,request_digest,reason_code,decided_at)
       values ('11111111-1111-4111-8111-111111111111','tree','verified','tree','race-balance-fixture',repeat('f',64),'fixture',now())
       returning id`,
    );
    balanceClaimId = claim.rows[0]!.id;
    await database.query(
      `insert into point_ledger(user_id,claim_id,kind,points,metadata)
       values ('11111111-1111-4111-8111-111111111111',$1,'compensation',100,'{"reason":"voucher race fixture"}')`,
      [claim.rows[0]!.id],
    );
    const seededBalance = await database.query<{ balance: number }>(
      "select balance from point_balances where user_id='11111111-1111-4111-8111-111111111111'",
    );
    expect(seededBalance.rows[0]?.balance).toBe(100);
  });
  afterAll(async () => { await app?.close(); });

  it("allows one concurrent issue for an idempotency key and never makes balance negative", async () => {
    const issue = () => request(app.getHttpServer()).post("/api/rewards/vouchers").set(bearer(user)).set("idempotency-key", "issue-race").send({ rewardId: "66666666-6666-4666-8666-666666666661" });
    const responses = await Promise.all([issue(), issue(), issue()]);
    expect(responses.map((response) => response.status)).toEqual([201, 201, 201]);
    expect(new Set(responses.map((response) => response.body.voucher.voucherId)).size).toBe(1);
    const entries = await database.query<{ vouchers: number; debits: number }>(
      `select
         (select count(*)::int from vouchers where user_id='11111111-1111-4111-8111-111111111111') vouchers,
         (select count(*)::int from point_ledger where user_id='11111111-1111-4111-8111-111111111111' and kind='debit') debits`,
    );
    expect(entries.rows[0]).toEqual({ vouchers: 1, debits: 1 });
    const balance = await database.query<{ balance: number }>("select balance from point_balances where user_id=$1", ["11111111-1111-4111-8111-111111111111"]);
    expect(balance.rows[0]?.balance).toBeGreaterThanOrEqual(0);
  });

  it("serializes scan and cancellation so a voucher has one terminal outcome", async () => {
    const issued = await request(app.getHttpServer()).post("/api/rewards/vouchers").set(bearer(user)).set("idempotency-key", "issue-terminal-race").send({ rewardId: "66666666-6666-4666-8666-666666666661" }).expect(201);
    const voucher = issued.body.voucher;
    const [scan, cancel] = await Promise.all([
      request(app.getHttpServer()).post("/api/merchant/vouchers/scan").set(bearer(merchant)).set("idempotency-key", "scan-race").send({ code: voucher.code }),
      request(app.getHttpServer()).post(`/api/merchant/vouchers/${voucher.voucherId}/cancel`).set(bearer(merchant)).set("idempotency-key", "cancel-race").send({}),
    ]);
    expect([scan.status, cancel.status].sort()).toEqual([201, 409]);
    const state = await database.query<{ state: string }>("select state from vouchers where id=$1", [voucher.voucherId]);
    expect(["redeemed", "cancelled"]).toContain(state.rows[0]?.state);
    const terminal = await database.query<{ refunds: number; redemptions: number }>(
      `select
         (select count(*)::int from point_ledger where voucher_id=$1 and kind='refund') refunds,
         (select count(*)::int from redemptions where voucher_id=$1) redemptions`,
      [voucher.voucherId],
    );
    expect(terminal.rows[0]).toEqual(
      state.rows[0]?.state === "redeemed"
        ? { refunds: 0, redemptions: 1 }
        : { refunds: 1, redemptions: 0 },
    );
    const balance = await database.query<{ balance: number }>("select balance from point_balances where user_id=$1", ["11111111-1111-4111-8111-111111111111"]);
    expect(balance.rows[0]?.balance).toBeGreaterThanOrEqual(0);
  });

  it("prevents distinct idempotency keys from overspending the same balance", async () => {
    await database.query(
      `insert into point_ledger(user_id,claim_id,kind,points,metadata)
       values ('11111111-1111-4111-8111-111111111111',$1,'compensation',-80,'{"reason":"distinct-key race boundary"}')`,
      [balanceClaimId],
    );
    const issue = (key: string) => request(app.getHttpServer()).post("/api/rewards/vouchers").set(bearer(user)).set("idempotency-key", key).send({ rewardId: "66666666-6666-4666-8666-666666666661" });
    const responses = await Promise.all([issue("distinct-a"), issue("distinct-b")]);
    expect(responses.map(response => response.status).sort()).toEqual([201, 409]);
    const result = await database.query<{ vouchers: number; debits: number; balance: number }>(
      `select
         (select count(*)::int from vouchers where user_id='11111111-1111-4111-8111-111111111111') vouchers,
         (select count(*)::int from point_ledger where user_id='11111111-1111-4111-8111-111111111111' and kind='debit') debits,
         (select balance from point_balances where user_id='11111111-1111-4111-8111-111111111111') balance`,
    );
    expect(result.rows[0]).toEqual({ vouchers: 1, debits: 1, balance: 0 });
  });

  it("refunds the immutable issue cost and replays cancellation without a second refund", async () => {
    const issued = await request(app.getHttpServer()).post("/api/rewards/vouchers").set(bearer(user)).set("idempotency-key", "issue-snapshot").send({ rewardId: "66666666-6666-4666-8666-666666666661" }).expect(201);
    const voucherId = issued.body.voucher.voucherId;
    await database.query("update rewards set point_cost=40 where id='66666666-6666-4666-8666-666666666661'");
    await request(app.getHttpServer()).post(`/api/merchant/vouchers/${voucherId}/cancel`).set(bearer(user)).set("idempotency-key", "cancel-forbidden").send({}).expect(403);
    const cancelled = await request(app.getHttpServer()).post(`/api/merchant/vouchers/${voucherId}/cancel`).set(bearer(merchant)).set("idempotency-key", "cancel-stable").send({}).expect(201);
    const replay = await request(app.getHttpServer()).post(`/api/merchant/vouchers/${voucherId}/cancel`).set(bearer(merchant)).set("idempotency-key", "cancel-stable").send({}).expect(201);
    expect(replay.body).toEqual(cancelled.body);
    expect(cancelled.body.voucher).not.toHaveProperty("code");
    const result = await database.query<{ debited: number; refunded: number; balance: number }>(
      `select
         -coalesce(sum(points) filter (where kind='debit'),0)::int debited,
         coalesce(sum(points) filter (where kind='refund'),0)::int refunded,
         (select balance from point_balances where user_id='11111111-1111-4111-8111-111111111111') balance
       from point_ledger where voucher_id=$1`,
      [voucherId],
    );
    expect(result.rows[0]).toEqual({ debited: 20, refunded: 20, balance: 100 });
  });
});

if (!process.env.TEST_DATABASE_URL) describe("voucher race configuration", () => it.skip("requires TEST_DATABASE_URL and object-storage test settings", () => undefined));
