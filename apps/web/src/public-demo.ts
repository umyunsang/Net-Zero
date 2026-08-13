import type { Activity, Claim, DashboardData, LeaderboardData, Reward, Role, Voucher } from "./product-types";

export const IS_PUBLIC_PRESENTATION_DEMO = import.meta.env.VITE_PUBLIC_DEMO === "true";

const STORAGE_KEY = "net-zero-public-presentation-demo-v1";
const VIEWER_NAME = "ผู้ใช้-ใบไม้-1001";

type DemoVoucher = Voucher & { issuedAt: string };
type DemoState = {
  version: 1;
  points: number;
  weeklyPoints: number;
  claims: Claim[];
  vouchers: DemoVoucher[];
  leaderboardOptedIn: boolean;
  voucherSequence: number;
  evidenceSequence: number;
};

const rewards: Reward[] = [
  { rewardId: "product", titleThai: "ส่วนลดสินค้า 20 บาท", pointsCost: 20, active: true },
  { rewardId: "drink", titleThai: "ส่วนลดเครื่องดื่ม 40 บาท", pointsCost: 40, active: true },
];

const communityEntries = [
  { pseudonym_th: "ใบไม้ยามเช้า", weekly_points: 75 },
  { pseudonym_th: "สายลมเจ้าพระยา", weekly_points: 63 },
  { pseudonym_th: "สวนเล็กกลางเมือง", weekly_points: 48 },
  { pseudonym_th: "รถเมล์สีเขียว", weekly_points: 39 },
  { pseudonym_th: "เมล็ดพันธุ์วันใหม่", weekly_points: 30 },
  { pseudonym_th: "เพื่อนโลกหมายเลขเจ็ด", weekly_points: 24 },
  { pseudonym_th: "คลองใสใจดี", weekly_points: 18 },
  { pseudonym_th: "ต้นกล้าริมทาง", weekly_points: 12 },
];

function initialState(): DemoState {
  return {
    version: 1,
    points: 0,
    weeklyPoints: 0,
    claims: [],
    vouchers: [],
    leaderboardOptedIn: true,
    voucherSequence: 0,
    evidenceSequence: 0,
  };
}

function readState(): DemoState {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<DemoState> | null;
    if (parsed?.version === 1 && Number.isInteger(parsed.points) && Number.isInteger(parsed.weeklyPoints) && Array.isArray(parsed.claims) && Array.isArray(parsed.vouchers)) {
      return { ...initialState(), ...parsed } as DemoState;
    }
  } catch {
    // A corrupt local demo snapshot is reset instead of blocking the presentation.
  }
  return initialState();
}

function writeState(state: DemoState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export class PublicDemoApiError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "PublicDemoApiError";
  }
}

function createClaim(activity: Activity, awardedPoints: number, evidenceIds: string[]): Claim {
  const now = new Date().toISOString();
  const impactType = activity === "tree" ? "projected_sequestration" : "avoided";
  const impactValue = activity === "bus" ? "0.30" : activity === "tree" ? "3.00" : "2.50";
  return {
    claim: {
      id: crypto.randomUUID(),
      activity,
      status: "verified",
      impact_status: "credited",
      data_scope: "mock_demo",
      is_mock: true,
      is_synthetic: true,
      demo_only: true,
      fixture_id: "PUBLIC-PT-DEMO",
      reason_code: activity === "bus" ? "automated_bus_verified" : activity === "recycling" ? "recycling_auto_verified" : "tree_demo_verified",
      submitted_at: now,
      decided_at: now,
      awarded_points: awardedPoints,
      impacts: [{ kg_co2e: impactValue, impact_type: impactType }],
      evidence_ids: evidenceIds,
    },
  };
}

function dashboard(state: DemoState): DashboardData {
  const avoided = state.claims
    .flatMap((item) => item.claim.impacts)
    .filter((impact) => impact.impact_type === "avoided")
    .reduce((sum, impact) => sum + Number(impact.kg_co2e), 0);
  const projected = state.claims
    .flatMap((item) => item.claim.impacts)
    .filter((impact) => impact.impact_type === "projected_sequestration")
    .reduce((sum, impact) => sum + Number(impact.kg_co2e), 0);
  return {
    data_scope: "mock_demo",
    is_mock: true,
    demo_only: true,
    points: state.points,
    pending_count: 0,
    personal: {
      estimated_avoided_co2e: avoided.toFixed(2),
      projected_sequestration_co2e: projected.toFixed(2),
    },
    community: { estimated_avoided_co2e: "100.00", projected_sequestration_co2e: "20.00" },
    recent_claims: state.claims.slice(0, 5).map((item) => ({
      id: item.claim.id,
      activity: item.claim.activity,
      state: item.claim.status,
      submitted_at: item.claim.submitted_at,
    })),
    recent_vouchers: state.vouchers.slice(0, 5).map((item) => ({
      id: item.voucherId,
      title_th: item.titleThai,
      state: item.state,
      issued_at: item.issuedAt,
      expires_at: item.expiresAt,
    })),
  };
}

function weeklyLeaderboard(state: DemoState): LeaderboardData {
  const entries = [
    ...communityEntries,
    ...(state.leaderboardOptedIn ? [{ pseudonym_th: VIEWER_NAME, weekly_points: state.weeklyPoints }] : []),
  ]
    .sort((left, right) => right.weekly_points - left.weekly_points || left.pseudonym_th.localeCompare(right.pseudonym_th, "th"))
    .map((entry, index) => ({ rank: index + 1, ...entry }));
  const now = new Date();
  const weekStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - ((now.getUTCDay() + 6) % 7)));
  return {
    week_starts_at: weekStart.toISOString(),
    data_scope: "demo",
    is_mock: true,
    demo_only: true,
    viewer: { opted_in: state.leaderboardOptedIn, pseudonym_th: state.leaderboardOptedIn ? VIEWER_NAME : null },
    entries,
    community_totals: {
      estimated_avoided_co2e: "100.00",
      projected_sequestration_co2e: "20.00",
      verified_weekly_points: 309 + state.weeklyPoints,
    },
  };
}

function recyclingPoints(body: unknown): number {
  const count = Number((body as { itemCount?: unknown } | null)?.itemCount);
  if (!Number.isSafeInteger(count) || count < 1) throw new PublicDemoApiError("VALIDATION_ERROR");
  return Math.max(1, Math.min(100, Math.round((count * 20) / 46)));
}

export function publicDemoEvidenceId(kind: "photo" | "gps_trace"): string {
  const state = readState();
  state.evidenceSequence += 1;
  writeState(state);
  return `demo-${kind}-${String(state.evidenceSequence).padStart(4, "0")}`;
}

export async function publicDemoApi<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  await Promise.resolve();
  const endpoint = path.split("?")[0];
  const state = readState();

  if (endpoint === "/auth/demo-login" && method === "POST") {
    const role = (body as { role?: Role } | null)?.role ?? "user";
    return { accessToken: `public-demo-${role}` } as T;
  }
  if (endpoint === "/dashboard") return dashboard(state) as T;
  if (endpoint === "/claims") return { items: state.claims } as T;
  if (endpoint === "/rewards") return { items: rewards } as T;
  if (endpoint === "/rewards/vouchers" && method === "GET") return state.vouchers as T;
  if (endpoint === "/leaderboard/weekly") return weeklyLeaderboard(state) as T;
  if (endpoint === "/leaderboard/consent" && method === "PUT") {
    state.leaderboardOptedIn = Boolean((body as { optedIn?: unknown } | null)?.optedIn);
    writeState(state);
    return { opted_in: state.leaderboardOptedIn, pseudonym_th: state.leaderboardOptedIn ? VIEWER_NAME : null } as T;
  }

  if (endpoint?.startsWith("/actions/") && method === "POST") {
    const activity = endpoint.replace("/actions/", "") as Activity;
    if (!(["bus", "recycling", "tree"] as string[]).includes(activity)) throw new PublicDemoApiError("NOT_FOUND");
    const awardedPoints = activity === "bus" ? 3 : activity === "tree" ? 15 : recyclingPoints(body);
    const evidenceIds = Array.isArray((body as { evidenceIds?: unknown } | null)?.evidenceIds)
      ? (body as { evidenceIds: string[] }).evidenceIds
      : [];
    const item = createClaim(activity, awardedPoints, evidenceIds);
    state.points += awardedPoints;
    state.weeklyPoints += awardedPoints;
    state.claims.unshift(item);
    writeState(state);
    return item as T;
  }

  if (endpoint === "/rewards/vouchers" && method === "POST") {
    const reward = rewards.find((item) => item.rewardId === (body as { rewardId?: unknown } | null)?.rewardId);
    if (!reward || !reward.active || state.points < reward.pointsCost) throw new PublicDemoApiError("VOUCHER_UNAVAILABLE");
    state.points -= reward.pointsCost;
    state.voucherSequence += 1;
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt);
    expiresAt.setDate(expiresAt.getDate() + 30);
    const voucher: DemoVoucher = {
      voucherId: crypto.randomUUID(),
      code: `NZD0${String(state.voucherSequence).padStart(4, "0")}`,
      state: "issued",
      titleThai: reward.titleThai,
      issuedAt: issuedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };
    state.vouchers.unshift(voucher);
    writeState(state);
    return { voucher } as T;
  }

  if (endpoint === "/account" && method === "DELETE") {
    localStorage.removeItem(STORAGE_KEY);
    return undefined as T;
  }

  throw new PublicDemoApiError("NOT_FOUND");
}
