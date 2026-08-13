import { ConflictException, ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import type { PoolClient } from "pg";

import { DatabaseService } from "../database/database.service.js";
import type { CurrentAuthUser } from "../auth/auth.types.js";

type VoucherRow = {
  id: string;
  user_id: string;
  reward_id: string;
  title_th: string;
  point_cost: number;
  state: "issued" | "redeemed" | "expired" | "cancelled";
  issued_at: Date;
  expires_at: Date;
  redeemed_at: Date | null;
  cancelled_at: Date | null;
};

type Scope = "mock_demo" | "production";

type ScopeLabels = {
  dataScope: Scope;
  isMock: boolean;
  demoOnly: boolean;
};

type VoucherScopeRow = {
  operator_is_demo: boolean;
  owner_is_demo: boolean;
  reward_is_demo: boolean;
  merchant_is_demo: boolean;
  merchant_owner_is_demo: boolean | null;
};

@Injectable()
export class RewardsService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async catalog(user: CurrentAuthUser, page = 1, pageSize = 20) {
    const offset = (page - 1) * pageSize;
    const userScope = await this.database.query<{ is_demo: boolean }>("select is_demo from users where id = $1", [user.id]);
    const userScopeRow = userScope.rows[0];
    if (!userScopeRow) throw new ForbiddenException({ code: "FORBIDDEN", message: "ไม่พบขอบเขตบัญชีผู้ใช้" });
    const result = await this.database.query<{ id: string; merchant_id: string; title_th: string; point_cost: number; active: boolean; is_demo: boolean; total: string }>(
      `select r.id, r.merchant_id, r.title_th, r.point_cost, r.active, r.is_demo, count(*) over() as total
       from rewards r join merchants m on m.id = r.merchant_id join users u on u.id = $1
       where r.active and m.active and r.is_demo = u.is_demo and m.is_demo = u.is_demo
       order by r.title_th, r.id limit $2 offset $3`,
      [user.id, pageSize, offset],
    );
    const firstRow = result.rows[0];
    const totalItems = firstRow ? Number(firstRow.total) : 0;
    return {
      items: result.rows.map((row) => ({ rewardId: row.id, merchantId: row.merchant_id, titleThai: row.title_th, pointsCost: row.point_cost, active: row.active, labelThai: "รางวัล", ...this.scope(row.is_demo) })),
      pageInfo: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) },
      ...this.scope(userScopeRow.is_demo),
    };
  }

  async issue(user: CurrentAuthUser, rewardId: string, idempotencyKey: string) {
    const digest = this.digest({ rewardId });
    return this.database.transaction(async (client) => {
      const reward = await client.query<{ id: string; point_cost: number; is_demo: boolean }>(
        `select r.id, r.point_cost, r.is_demo from rewards r join merchants m on m.id = r.merchant_id join users u on u.id = $1
         where r.id = $2 and r.active and m.active and r.is_demo = u.is_demo and m.is_demo = u.is_demo for share`,
        [user.id, rewardId],
      );
      const rewardRow = reward.rows[0];
      if (!rewardRow) throw unavailable("ไม่พบรางวัลหรือรางวัลไม่พร้อมใช้งาน");
      const replay = await this.idempotency(client, `reward-issue:${user.id}`, idempotencyKey, digest);
      if (replay) return replay;

      // The balance row is locked before the immutable debit is written.
      const balance = await client.query<{ balance: number }>("select balance from point_balances where user_id = $1 for update", [user.id]);
      const balanceRow = balance.rows[0];
      if (!balanceRow || balanceRow.balance < rewardRow.point_cost) throw unavailable("คะแนนคงเหลือไม่เพียงพอ");

      const code = this.code();
      const tokenHash = this.digest(code);
      const voucher = await client.query<VoucherRow>(
        `insert into vouchers (user_id, reward_id, point_cost, token_hash, display_code, expires_at)
         values ($1, $2, $3, $4, $5, now() + interval '7 days')
         returning id, user_id, reward_id, point_cost, 'issued'::voucher_state as state, issued_at, expires_at, redeemed_at, cancelled_at,
                   (select title_th from rewards where id = $2) as title_th`,
        [user.id, rewardId, rewardRow.point_cost, tokenHash, code],
      );
      const voucherRow = voucher.rows[0];
      if (!voucherRow) throw new ConflictException({ code: "CONFLICT", message: "ไม่สามารถออกบัตรรางวัลได้" });
      await client.query("insert into point_ledger (user_id, voucher_id, kind, points) values ($1, $2, 'debit', $3)", [user.id, voucherRow.id, -rewardRow.point_cost]);
      await this.audit(client, user, "voucher.issued", voucherRow.id, rewardRow.is_demo, {
        reward_id: rewardRow.id,
        point_cost: rewardRow.point_cost,
        outcome: "issued",
      });
      const response = { voucher: this.voucher(voucherRow, code), message: "ออกบัตรรางวัลแล้ว", ...this.scope(rewardRow.is_demo) };
      await this.storeIdempotency(client, `reward-issue:${user.id}`, idempotencyKey, response);
      return response;
    });
  }

  async list(user: CurrentAuthUser, page = 1, pageSize = 20) {
    const offset = (page - 1) * pageSize;
    const rows = await this.database.query<VoucherRow & { display_code: string; is_demo: boolean }>(
      `select v.id, v.user_id, v.reward_id, r.title_th, v.point_cost, v.display_code, v.state, v.issued_at, v.expires_at, v.redeemed_at, v.cancelled_at, r.is_demo
       from vouchers v
       join users u on u.id = v.user_id
       join rewards r on r.id = v.reward_id
       join merchants m on m.id = r.merchant_id
       where v.user_id = $1 and u.is_demo = r.is_demo and r.is_demo = m.is_demo
       order by v.issued_at desc, v.id desc limit $2 offset $3`,
      [user.id, pageSize, offset],
    );
    return rows.rows.map((row) => ({
      ...this.voucher({
        ...row,
        state: row.state === "issued" && row.expires_at <= new Date() ? "expired" : row.state,
      }, row.display_code),
      ...this.scope(row.is_demo),
    }));
  }

  async cancelByOperator(operator: CurrentAuthUser, voucherId: string, idempotencyKey: string) {
    if (operator.role !== "merchant" && operator.role !== "admin") {
      throw new ForbiddenException({ code: "FORBIDDEN", message: "บัญชีนี้ไม่มีสิทธิ์ยกเลิกบัตรรางวัล" });
    }
    const digest = this.digest({ voucherId });
    return this.database.transaction(async (client) => {
      const voucher = await this.voucherById(client, voucherId, "for update");
      if (!voucher) throw unavailable("ไม่พบบัตรรางวัล");
      const scope = await this.assertVoucherScope(client, operator.id, voucher.id);
      const replay = await this.idempotency(client, `voucher-cancel:${operator.id}`, idempotencyKey, digest);
      if (replay) return replay;
      if (operator.role === "merchant") {
        const merchant = await client.query<{ id: string }>(
          `select merchant.id
           from merchants merchant
           join rewards reward on reward.merchant_id = merchant.id
           where merchant.user_id = $1 and reward.id = $2 and merchant.active`,
          [operator.id, voucher.reward_id],
        );
        if (!merchant.rows[0]) {
          throw new ForbiddenException({ code: "FORBIDDEN", message: "ร้านค้าไม่มีสิทธิ์ยกเลิกบัตรรางวัลนี้" });
        }
      }
      if (voucher.state !== "issued") throw unavailable("บัตรรางวัลไม่สามารถยกเลิกได้");
      if (voucher.expires_at <= new Date()) {
        throw unavailable("บัตรรางวัลหมดอายุแล้วและไม่คืนคะแนน");
      }
      await client.query("update vouchers set state = 'cancelled', cancelled_at = now() where id = $1", [voucher.id]);
      await client.query("insert into point_ledger (user_id, voucher_id, kind, points) values ($1, $2, 'refund', $3)", [voucher.user_id, voucher.id, voucher.point_cost]);
      await this.audit(client, operator, "voucher.cancelled", voucher.id, scope, {
        point_refund: voucher.point_cost,
        outcome: "cancelled",
      });
      const response = { voucher: { ...this.voucher(voucher), state: "cancelled", cancelledAt: new Date().toISOString() }, message: "ยกเลิกบัตรและคืนคะแนนแล้ว", ...this.scope(scope) };
      await this.storeIdempotency(client, `voucher-cancel:${operator.id}`, idempotencyKey, response);
      return response;
    });
  }

  async scan(merchantUser: CurrentAuthUser, code: string, idempotencyKey: string) {
    if (merchantUser.role !== "merchant") {
      throw new ForbiddenException({ code: "FORBIDDEN", message: "บัญชีนี้ไม่มีสิทธิ์ใช้บัตรรางวัลของร้านค้า" });
    }
    return this.database.transaction(async (client) => {
      const digest = this.digest({ code });
      const merchant = await client.query<{ id: string }>("select id from merchants where user_id = $1 and active for update", [merchantUser.id]);
      const merchantRow = merchant.rows[0];
      if (!merchantRow) throw new ForbiddenException({ code: "FORBIDDEN", message: "บัญชีนี้ไม่มีสิทธิ์ร้านค้า" });
      const voucher = await this.voucherByHash(client, code, "for update");
      if (!voucher) throw unavailable("ไม่พบบัตรรางวัล");
      const scope = await this.assertVoucherScope(client, merchantUser.id, voucher.id);
      const replay = await this.idempotency(client, `merchant-scan:${merchantUser.id}`, idempotencyKey, digest);
      if (replay) return replay;
      const rewardMerchant = await client.query<{ merchant_id: string }>("select merchant_id from rewards where id = $1", [voucher.reward_id]);
      const rewardMerchantRow = rewardMerchant.rows[0];
      if (!rewardMerchantRow || rewardMerchantRow.merchant_id !== merchantRow.id) throw new ForbiddenException({ code: "FORBIDDEN", message: "บัตรนี้ไม่ใช่รางวัลของร้านค้า" });
      const response = await this.redeemLocked(client, voucher, scope, idempotencyKey, merchantRow.id);
      await this.audit(client, merchantUser, "voucher.redeemed", voucher.id, scope, {
        merchant_id: merchantRow.id,
        outcome: "redeemed",
      });
      await this.storeIdempotency(client, `merchant-scan:${merchantUser.id}`, idempotencyKey, response);
      return response;
    });
  }

  private async redeemLocked(client: PoolClient, voucher: VoucherRow, isDemo: boolean, idempotencyKey?: string, merchantId?: string) {
    if (voucher.state === "redeemed") {
      throw new ConflictException({ code: "VOUCHER_ALREADY_REDEEMED", message: "บัตรรางวัลนี้ถูกใช้แล้ว" });
    }
    if (voucher.state !== "issued") throw unavailable("บัตรรางวัลไม่พร้อมใช้งาน");
    if (voucher.expires_at <= new Date()) {
      throw unavailable("บัตรรางวัลหมดอายุแล้ว");
    }
    await client.query("update vouchers set state = 'redeemed', redeemed_at = now() where id = $1", [voucher.id]);
    if (merchantId && idempotencyKey) await client.query("insert into redemptions (voucher_id, merchant_id, idempotency_key) values ($1, $2, $3) on conflict (voucher_id) do nothing", [voucher.id, merchantId, idempotencyKey]);
    return { status: "redeemed", labelThai: "ใช้สิทธิ์สำเร็จ", voucherId: voucher.id, ...this.scope(isDemo) };
  }

  private async voucherByHash(client: PoolClient, code: string, lock: string) {
    const result = await client.query<VoucherRow>(`select v.id, v.user_id, v.reward_id, r.title_th, v.point_cost, v.state, v.issued_at, v.expires_at, v.redeemed_at, v.cancelled_at from vouchers v join rewards r on r.id = v.reward_id where v.token_hash = $1 ${lock}`, [this.digest(code)]);
    return result.rows[0];
  }
  private async voucherById(client: PoolClient, id: string, lock: string) {
    const result = await client.query<VoucherRow>(`select v.id, v.user_id, v.reward_id, r.title_th, v.point_cost, v.state, v.issued_at, v.expires_at, v.redeemed_at, v.cancelled_at from vouchers v join rewards r on r.id = v.reward_id where v.id = $1 ${lock}`, [id]);
    return result.rows[0];
  }
  private async assertVoucherScope(client: PoolClient, operatorId: string, voucherId: string): Promise<boolean> {
    const result = await client.query<VoucherScopeRow>(
      `select operator.is_demo as operator_is_demo,
              owner.is_demo as owner_is_demo,
              reward.is_demo as reward_is_demo,
              merchant.is_demo as merchant_is_demo,
              merchant_owner.is_demo as merchant_owner_is_demo
       from vouchers voucher
       join users owner on owner.id = voucher.user_id
       join rewards reward on reward.id = voucher.reward_id
       join merchants merchant on merchant.id = reward.merchant_id
       left join users merchant_owner on merchant_owner.id = merchant.user_id
       join users operator on operator.id = $1
       where voucher.id = $2`,
      [operatorId, voucherId],
    );
    const row = result.rows[0];
    if (!row
      || row.merchant_owner_is_demo === null
      || row.operator_is_demo !== row.owner_is_demo
      || row.operator_is_demo !== row.reward_is_demo
      || row.operator_is_demo !== row.merchant_is_demo
      || row.operator_is_demo !== row.merchant_owner_is_demo) {
      throw new ForbiddenException({ code: "FORBIDDEN", message: "ข้อมูลสาธิตและข้อมูลจริงใช้ร่วมกันไม่ได้" });
    }
    return row.operator_is_demo;
  }
  private async idempotency(client: PoolClient, scope: string, key: string, hash: string): Promise<unknown | undefined> {
    const inserted = await client.query("insert into idempotency_records(scope, key, request_hash, expires_at) values($1,$2,$3,now()+interval '37 days') on conflict do nothing", [scope, key, hash]);
    if (inserted.rowCount) return undefined;
    const existing = await client.query<{ request_hash: string; response_body: unknown }>("select request_hash, response_body from idempotency_records where scope=$1 and key=$2 for update", [scope, key]);
    const existingRow = existing.rows[0];
    if (!existingRow) throw new ConflictException({ code: "CONFLICT", message: "ไม่สามารถตรวจสอบคีย์คำขอได้" });
    if (existingRow.request_hash !== hash) throw new ConflictException({ code: "CONFLICT", message: "คีย์คำขอถูกใช้กับข้อมูลอื่นแล้ว" });
    return existingRow.response_body;
  }
  private storeIdempotency(client: PoolClient, scope: string, key: string, response: unknown) { return client.query("update idempotency_records set response_status=201, response_body=$3::jsonb where scope=$1 and key=$2", [scope, key, JSON.stringify(response)]); }
  private digest(value: unknown) { return createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex"); }
  private code() { return randomBytes(10).toString("hex").toUpperCase(); }
  private scope(isDemo: boolean): ScopeLabels { return isDemo ? { dataScope: "mock_demo", isMock: true, demoOnly: true } : { dataScope: "production", isMock: false, demoOnly: false }; }
  private audit(
    client: PoolClient,
    actor: CurrentAuthUser,
    eventType: string,
    voucherId: string,
    isDemo: boolean,
    metadata: Record<string, unknown>,
  ) {
    return client.query(
      `insert into audit_events(actor_id,event_type,subject_type,subject_id,metadata)
       values($1,$2,'voucher',$3,$4)`,
      [actor.id, eventType, voucherId, JSON.stringify({
        ...metadata,
        correlation_id: isDemo ? "mock-demo:FIXTURE-BKK-20260812-01" : `${eventType}:${voucherId}`,
        actor_role: actor.role,
        data_scope: isDemo ? "mock_demo" : "production",
        is_mock: isDemo,
        demo_only: isDemo,
        fixture_id: isDemo ? "FIXTURE-BKK-20260812-01" : null,
      })],
    );
  }
  private voucher(row: VoucherRow, code?: string) {
    return {
      voucherId: row.id,
      rewardId: row.reward_id,
      state: row.state,
      ...(code === undefined ? {} : { code }),
      issuedAt: row.issued_at.toISOString(),
      expiresAt: row.expires_at.toISOString(),
      redeemedAt: row.redeemed_at?.toISOString() ?? null,
      cancelledAt: row.cancelled_at?.toISOString() ?? null,
      titleThai: row.title_th,
      labelThai: "บัตรรางวัล",
    };
  }
}

function unavailable(message: string) { return new ConflictException({ code: "VOUCHER_UNAVAILABLE", message }); }
