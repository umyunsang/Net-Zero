import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import type { PoolClient } from "pg";

import { DatabaseService } from "../database/database.service.js";
import type {
  DashboardResponse,
  ImpactTotals,
  LeaderboardConsentResponse,
  WeeklyLeaderboardResponse,
} from "./community.types.js";

type UserScope = { is_demo: boolean };
type TotalsRow = {
  estimated_avoided_co2e: string;
  projected_sequestration_co2e: string;
};

const EMPTY_TOTALS: ImpactTotals = {
  estimated_avoided_co2e: "0",
  projected_sequestration_co2e: "0",
};

const MOCK_LEADERBOARD = [
  { pseudonym_th: "ใบไม้ยามเช้า", weekly_points: 75 },
  { pseudonym_th: "สายลมเจ้าพระยา", weekly_points: 63 },
  { pseudonym_th: "สวนเล็กกลางเมือง", weekly_points: 48 },
  { pseudonym_th: "รถเมล์สีเขียว", weekly_points: 39 },
  { pseudonym_th: "เมล็ดพันธุ์วันใหม่", weekly_points: 30 },
  { pseudonym_th: "เพื่อนโลกหมายเลขเจ็ด", weekly_points: 24 },
  { pseudonym_th: "คลองใสใจดี", weekly_points: 18 },
  { pseudonym_th: "ต้นกล้าริมทาง", weekly_points: 12 },
];

@Injectable()
export class CommunityService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async getDashboard(userId: string): Promise<DashboardResponse> {
    return this.database.transaction(async (client) => {
      const user = await this.getUserScope(client, userId);
      const points = await client.query<{ balance: number }>(
        "select balance from point_balances where user_id = $1",
        [userId],
      );
      const pending = await client.query<{ count: string }>(
        "select count(*)::text as count from claims where user_id = $1 and state in ('submitted','pending','pending_review')",
        [userId],
      );
      const personal = await this.getImpactTotals(client, "c.user_id = $1", [userId]);
      const community = await this.getImpactTotals(client, "u.is_demo = $1", [user.is_demo]);
      const claims = await client.query<{ id: string; activity: "bus" | "recycling" | "tree"; state: "submitted" | "pending" | "pending_review" | "verified" | "rejected"; submitted_at: Date }>(
        `select id, activity, state, submitted_at
         from claims
         where user_id = $1
         order by submitted_at desc, id desc
         limit 10`,
        [userId],
      );
      const vouchers = await client.query<{ id: string; title_th: string; state: "issued" | "redeemed" | "expired" | "cancelled"; issued_at: Date; expires_at: Date }>(
        `select v.id, r.title_th, v.state, v.issued_at, v.expires_at
         from vouchers v
         join rewards r on r.id = v.reward_id
         where v.user_id = $1
         order by v.issued_at desc, v.id desc
         limit 10`,
        [userId],
      );
      await this.auditReadModel(client, userId, user.is_demo, "read_model.dashboard_read");

      return {
        data_scope: user.is_demo ? "mock_demo" : "production",
        is_mock: user.is_demo,
        demo_only: user.is_demo,
        points: points.rows[0]?.balance ?? 0,
        pending_count: Number(pending.rows[0]?.count ?? 0),
        personal: personal.rows[0] ?? EMPTY_TOTALS,
        community: community.rows[0] ?? EMPTY_TOTALS,
        recent_claims: claims.rows.map((claim) => ({
          ...claim,
          submitted_at: claim.submitted_at.toISOString(),
        })),
        recent_vouchers: vouchers.rows.map((voucher) => ({
          ...voucher,
          issued_at: voucher.issued_at.toISOString(),
          expires_at: voucher.expires_at.toISOString(),
        })),
      };
    });
  }

  async getWeeklyLeaderboard(userId: string): Promise<WeeklyLeaderboardResponse> {
    return this.database.transaction(async (client) => {
      const user = await this.getUserScope(client, userId);
      const week = await client.query<{ week_start: Date; week_end: Date }>(
        `select
           date_trunc('week', now() at time zone 'Asia/Bangkok') at time zone 'Asia/Bangkok' as week_start,
           (date_trunc('week', now() at time zone 'Asia/Bangkok') + interval '7 days') at time zone 'Asia/Bangkok' as week_end`,
      );
      const boundary = week.rows[0];
      if (!boundary) throw new Error("ไม่สามารถกำหนดช่วงอันดับรายสัปดาห์ได้");

      const entries = await client.query<{ pseudonym_th: string; weekly_points: string }>(
        `with weekly_points as (
           select pl.user_id, sum(pl.points)::text as weekly_points
           from point_ledger pl
           join claims c on c.id = pl.claim_id
           join users u on u.id = pl.user_id
           join user_preferences preference on preference.user_id = u.id
           where pl.kind in ('credit', 'compensation')
             and c.state = 'verified'
             and u.is_demo = $3
             and preference.leaderboard_opt_in = true
             and exists (
               select 1
               from calculation_snapshots calculation
               join factor_catalog factor on factor.id = calculation.factor_id
               where calculation.claim_id = c.id
                 and factor.is_synthetic = false
                 and (
                   (u.is_demo and calculation.approval_scope='mock_demo' and calculation.is_mock and calculation.demo_only and calculation.reviewed_digest is not null)
                   or
                   (not u.is_demo and calculation.approval_scope='production' and not calculation.is_mock and not calculation.demo_only and factor.status='approved')
                 )
             )
             and pl.created_at >= $1 and pl.created_at < $2
           group by pl.user_id
         )
         select preference.leaderboard_pseudonym as pseudonym_th, weekly_points
         from weekly_points
         join user_preferences preference on preference.user_id = weekly_points.user_id
         order by weekly_points::integer desc, pseudonym_th asc
         limit 100`,
        [boundary.week_start, boundary.week_end, user.is_demo],
      );
      const totals = await this.getWeeklyTotals(client, boundary.week_start, boundary.week_end, user.is_demo);
      const preference = await client.query<{ leaderboard_opt_in: boolean; leaderboard_pseudonym: string | null }>(
        `select leaderboard_opt_in,leaderboard_pseudonym
         from user_preferences
         where user_id=$1`,
        [userId],
      );
      const viewer = preference.rows[0];
      await this.auditReadModel(client, userId, user.is_demo, "read_model.leaderboard_read");

      const verifiedEntries = entries.rows.map((entry) => ({
        pseudonym_th: entry.pseudonym_th,
        weekly_points: Number(entry.weekly_points),
      }));
      const demoViewerWithoutPoints = user.is_demo
        && viewer?.leaderboard_opt_in
        && viewer.leaderboard_pseudonym
        && !verifiedEntries.some((entry) => entry.pseudonym_th === viewer.leaderboard_pseudonym)
        ? [{ pseudonym_th: viewer.leaderboard_pseudonym, weekly_points: 0 }]
        : [];
      const rankedEntries = [
        ...verifiedEntries,
        ...(user.is_demo ? MOCK_LEADERBOARD : []),
        ...demoViewerWithoutPoints,
      ]
        .sort((left, right) => right.weekly_points - left.weekly_points || left.pseudonym_th.localeCompare(right.pseudonym_th))
        .slice(0, 100);

      return {
        week_starts_at: boundary.week_start.toISOString(),
        data_scope: user.is_demo ? "demo" : "real",
        is_mock: user.is_demo,
        demo_only: user.is_demo,
        viewer: {
          opted_in: viewer?.leaderboard_opt_in ?? false,
          pseudonym_th: viewer?.leaderboard_pseudonym ?? null,
        },
        entries: rankedEntries.map((entry, index) => ({
          rank: index + 1,
          pseudonym_th: entry.pseudonym_th,
          weekly_points: Number(entry.weekly_points),
        })),
        community_totals: totals.rows[0] ?? { ...EMPTY_TOTALS, verified_weekly_points: 0 },
      };
    });
  }

  async setLeaderboardConsent(userId: string, optedIn: boolean): Promise<LeaderboardConsentResponse> {
    return this.database.transaction(async (client) => {
      await this.getUserScope(client, userId);

      const result = await client.query<{ leaderboard_opt_in: boolean; leaderboard_pseudonym: string | null }>(
        `insert into user_preferences (user_id, leaderboard_opt_in, leaderboard_pseudonym, updated_at)
         values (
           $1::uuid,
           $2,
           case when $2 then 'ผู้ใช้-ใบไม้-' || (1000 + ((('x' || substr(md5($1::uuid::text), 1, 7))::bit(28)::bigint) % 9000))::text else null end,
           now()
         )
         on conflict (user_id) do update set
           leaderboard_opt_in = excluded.leaderboard_opt_in,
           leaderboard_pseudonym = case
             when excluded.leaderboard_opt_in then coalesce(user_preferences.leaderboard_pseudonym, excluded.leaderboard_pseudonym)
             else null
           end,
           updated_at = now()
         returning leaderboard_opt_in, leaderboard_pseudonym`,
        [userId, optedIn],
      );
      const preference = result.rows[0];
      if (!preference) throw new Error("ไม่สามารถบันทึกความยินยอมได้");
      return { opted_in: preference.leaderboard_opt_in, pseudonym_th: preference.leaderboard_pseudonym };
    });
  }

  private getImpactTotals(client: PoolClient, filter: string, values: readonly unknown[]) {
    return client.query<TotalsRow>(
      `select
         coalesce(sum(cl.kg_co2e) filter (where cl.impact_type = 'avoided'), 0)::text as estimated_avoided_co2e,
         coalesce(sum(cl.kg_co2e) filter (where cl.impact_type = 'projected_sequestration'), 0)::text as projected_sequestration_co2e
       from carbon_ledger cl
       join claims c on c.id = cl.claim_id
       join users u on u.id = c.user_id
       join calculation_snapshots calculation on calculation.id = cl.calculation_id
       join factor_catalog factor on factor.id = calculation.factor_id
       where c.state = 'verified'
         and c.impact_status = 'credited'
         and factor.is_synthetic = false
         and (
           (u.is_demo and calculation.approval_scope='mock_demo' and calculation.is_mock and calculation.demo_only and calculation.reviewed_digest is not null)
           or
           (not u.is_demo and calculation.approval_scope='production' and not calculation.is_mock and not calculation.demo_only and factor.status='approved')
         )
         and ${filter}`,
      [...values],
    );
  }

  private getWeeklyTotals(client: PoolClient, weekStart: Date, weekEnd: Date, isDemo: boolean) {
    return client.query<TotalsRow & { verified_weekly_points: number }>(
      `select
         coalesce(sum(weekly_points.points), 0)::int as verified_weekly_points,
         coalesce(sum(weekly_impacts.avoided_kg_co2e), 0)::text as estimated_avoided_co2e,
         coalesce(sum(weekly_impacts.projected_sequestration_kg_co2e), 0)::text as projected_sequestration_co2e
       from (
         select pl.user_id, sum(pl.points)::int as points
         from point_ledger pl
         join claims c on c.id = pl.claim_id
         join users u on u.id = pl.user_id
         where pl.kind in ('credit', 'compensation')
           and c.state = 'verified'
           and u.is_demo = $3
           and exists (
             select 1
             from calculation_snapshots calculation
             join factor_catalog factor on factor.id = calculation.factor_id
             where calculation.claim_id = c.id
               and factor.is_synthetic = false
               and (
                 (u.is_demo and calculation.approval_scope='mock_demo' and calculation.is_mock and calculation.demo_only and calculation.reviewed_digest is not null)
                 or
                 (not u.is_demo and calculation.approval_scope='production' and not calculation.is_mock and not calculation.demo_only and factor.status='approved')
               )
           )
           and pl.created_at >= $1 and pl.created_at < $2
         group by pl.user_id
       ) weekly_points
       full join (
         select c.user_id,
           sum(cl.kg_co2e) filter (where cl.impact_type = 'avoided') as avoided_kg_co2e,
           sum(cl.kg_co2e) filter (where cl.impact_type = 'projected_sequestration') as projected_sequestration_kg_co2e
         from carbon_ledger cl
         join claims c on c.id = cl.claim_id
         join users u on u.id = c.user_id
         join calculation_snapshots calculation on calculation.id = cl.calculation_id
         join factor_catalog factor on factor.id = calculation.factor_id
         where c.state = 'verified'
           and c.impact_status = 'credited'
           and factor.is_synthetic = false
           and (
             (u.is_demo and calculation.approval_scope='mock_demo' and calculation.is_mock and calculation.demo_only and calculation.reviewed_digest is not null)
             or
             (not u.is_demo and calculation.approval_scope='production' and not calculation.is_mock and not calculation.demo_only and factor.status='approved')
           )
           and cl.created_at >= $1 and cl.created_at < $2
           and u.is_demo = $3
         group by c.user_id
       ) weekly_impacts on weekly_impacts.user_id = weekly_points.user_id`,
      [weekStart, weekEnd, isDemo],
    );
  }

  private async getUserScope(client: PoolClient, userId: string): Promise<UserScope> {
    const result = await client.query<UserScope>("select is_demo from users where id = $1 and deleted_at is null", [userId]);
    const user = result.rows[0];
    if (!user) {
      throw new ForbiddenException({ code: "FORBIDDEN", message: "ไม่พบบัญชีผู้ใช้งาน" });
    }
    return user;
  }

  private auditReadModel(client: PoolClient, userId: string, isDemo: boolean, eventType: string) {
    return client.query(
      `insert into audit_events(actor_id,event_type,subject_type,subject_id,metadata)
       values($1,$2,'user',$1,$3)`,
      [userId, eventType, JSON.stringify({
        correlation_id: isDemo ? "mock-demo:FIXTURE-BKK-20260812-01" : `${eventType}:${userId}`,
        actor_role: "user",
        data_scope: isDemo ? "mock_demo" : "production",
        is_mock: isDemo,
        demo_only: isDemo,
        fixture_id: isDemo ? "FIXTURE-BKK-20260812-01" : null,
        outcome: "read",
      })],
    );
  }
}
