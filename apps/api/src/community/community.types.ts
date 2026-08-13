export type ImpactTotals = {
  estimated_avoided_co2e: string;
  projected_sequestration_co2e: string;
};

export type DashboardClaim = {
  id: string;
  activity: "bus" | "recycling" | "tree";
  state: "submitted" | "pending" | "pending_review" | "verified" | "rejected";
  submitted_at: string;
};

export type DashboardVoucher = {
  id: string;
  title_th: string;
  state: "issued" | "redeemed" | "expired" | "cancelled";
  issued_at: string;
  expires_at: string;
};

export type DashboardResponse = {
  data_scope: "mock_demo" | "production";
  is_mock: boolean;
  demo_only: boolean;
  points: number;
  pending_count: number;
  personal: ImpactTotals;
  community: ImpactTotals;
  recent_claims: DashboardClaim[];
  recent_vouchers: DashboardVoucher[];
};

export type WeeklyLeaderboardEntry = {
  rank: number;
  pseudonym_th: string;
  weekly_points: number;
};

export type WeeklyLeaderboardResponse = {
  week_starts_at: string;
  data_scope: "demo" | "real";
  is_mock: boolean;
  demo_only: boolean;
  viewer: {
    opted_in: boolean;
    pseudonym_th: string | null;
  };
  entries: WeeklyLeaderboardEntry[];
  community_totals: ImpactTotals & { verified_weekly_points: number };
};

export type LeaderboardConsentResponse = {
  opted_in: boolean;
  pseudonym_th: string | null;
};
