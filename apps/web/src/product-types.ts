export type Role = "user" | "reviewer" | "merchant" | "admin";
export type RequestState = "idle" | "loading" | "success" | "error";
export type ClaimStatus = "submitted" | "pending" | "pending_review" | "verified" | "rejected";
export type Activity = "bus" | "recycling" | "tree";

export type GpsSample = {
  sampleId: string;
  recordedAt: string;
  latitude: string;
  longitude: string;
  accuracyMeters: string;
};

export type Impact = {
  kg_co2e: string;
  impact_type: "avoided" | "projected_sequestration";
};

export type Claim = {
  claim: {
    id: string;
    activity: Activity;
    status: ClaimStatus;
    impact_status: "pending" | "credited" | "blocked_factor_approval";
    data_scope: "mock_demo" | "production";
    is_mock: boolean;
    is_synthetic: boolean;
    demo_only: boolean;
    fixture_id: string | null;
    reason_code: string | null;
    submitted_at: string;
    decided_at: string | null;
    awarded_points: number;
    impacts: Impact[];
    evidence_ids?: string[];
  };
};

export type Reward = {
  rewardId: string;
  titleThai: string;
  pointsCost: number;
  active: boolean;
};

export type Voucher = {
  voucherId: string;
  code: string;
  state: "issued" | "redeemed" | "expired" | "cancelled";
  titleThai: string;
  expiresAt: string;
  redeemedAt?: string | null;
};

export type DashboardClaim = {
  id: string;
  activity: Activity;
  state: ClaimStatus;
  submitted_at: string;
};

export type DashboardVoucher = {
  id: string;
  title_th: string;
  state: Voucher["state"];
  issued_at: string;
  expires_at: string;
};

export type Factor = {
  id: string;
  activity: Activity;
  code: string;
  version: string;
  value: string;
  unit: string;
  source_url: string;
  methodology_code: string;
  disclaimer_th: string;
  proxy_copy_th: string;
  status: "draft" | "approved" | "rejected";
  mock_approval_scope?: string;
  mock_is_mock?: boolean;
  mock_demo_only?: boolean;
  mock_approved_by?: string;
  mock_approved_role?: string;
  mock_approved_at?: string;
  mock_reviewed_digest?: string;
};

export type DemoActivityReadiness = {
  ready: boolean;
  factorId?: string;
  approvalScope?: string;
  isMock?: boolean;
  demoOnly?: boolean;
};

export type DemoReadiness = {
  mockDemoReady: boolean;
  readinessKind?: "factor-prerequisites-only";
  databaseScope?: "mock_demo" | "production" | null;
  productionFactorsReady?: boolean;
  productionReady: boolean;
  tgoEndorsed: boolean;
  physicalEvidence: boolean;
  activities: Record<Activity, DemoActivityReadiness>;
};

export type DashboardData = {
  data_scope: "mock_demo" | "production";
  is_mock: boolean;
  demo_only: boolean;
  points: number;
  pending_count: number;
  personal: {
    estimated_avoided_co2e: string;
    projected_sequestration_co2e: string;
  };
  community: {
    estimated_avoided_co2e: string;
    projected_sequestration_co2e: string;
  };
  recent_claims: DashboardClaim[];
  recent_vouchers: DashboardVoucher[];
};

export type LeaderboardData = {
  week_starts_at: string;
  data_scope: "demo" | "real";
  is_mock: boolean;
  demo_only: boolean;
  viewer: { opted_in: boolean; pseudonym_th: string | null };
  entries: { rank: number; pseudonym_th: string; weekly_points: number }[];
  community_totals: {
    estimated_avoided_co2e: string;
    projected_sequestration_co2e: string;
    verified_weekly_points: number;
  };
};

export type LeaderboardConsent = {
  opted_in: boolean;
  pseudonym_th: string | null;
};

export type CapturedPhoto = {
  blob: Blob;
  capturedAt: string;
  trackLabel: string;
};
