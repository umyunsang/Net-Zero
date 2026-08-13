export const claimStatuses = ['submitted', 'pending', 'pending_review', 'verified', 'rejected'] as const;
export type ClaimStatus = (typeof claimStatuses)[number];

export const impactTypes = ['estimated_avoided_co2e', 'projected_sequestration_co2e'] as const;
export type ImpactType = (typeof impactTypes)[number];

export const auditReasons = [
  'bus_insufficient_coverage', 'bus_metric_unavailable', 'bus_speed_below_threshold',
  'bus_stop_pattern_below_threshold', 'bus_route_match_below_threshold', 'duplicate_evidence',
  'tree_wrong_type', 'tree_duplicate', 'tree_ambiguous', 'tree_provider_unavailable',
  'recycling_pending_review', 'recycling_rejected', 'reviewer_confirmed', 'reviewer_reduced',
  'factor_approval_required', 'voucher_expired', 'voucher_already_redeemed',
  'voucher_redeemed', 'voucher_cancelled', 'invalid_transition',
] as const;
export type AuditReason = (typeof auditReasons)[number];

export interface Clock { now(): Date; }
export interface GpsSample { id: string; timestamp: Date; latitude: number; longitude: number; accuracyMeters: number; }
export interface GeoPoint { latitude: number; longitude: number; }

export interface BusMetric { available: boolean; numerator?: number; denominator?: number; ratio?: number; }
export interface BusMetrics { coverage: BusMetric; speed: BusMetric; stops: BusMetric; route: BusMetric; }
export interface BusEvaluationResult { status: Extract<ClaimStatus, 'pending' | 'verified' | 'rejected'>; reason?: AuditReason; metrics: BusMetrics; representatives: readonly GpsSample[]; }

export interface TreeSignals { ai: 'pass' | 'wrong_type' | 'ambiguous' | 'unavailable'; locationDuplicate: boolean; visualDuplicate: boolean; }
export interface TreeOutcome { status: Extract<ClaimStatus, 'verified' | 'rejected' | 'pending_review'>; reason: AuditReason; }
export interface RecyclingValues { category: string; count: number; }
export type RecyclingReviewDecision = 'keep_pending' | 'reject' | 'approve';
export interface RecyclingReview { decision: RecyclingReviewDecision; approved?: RecyclingValues; reason?: AuditReason; }

export interface FactorSnapshot { id: string; approved: boolean; value: string; unit: string; sourceUrl: string; methodologyCode: string; methodologyVersion: string; effectiveDate: string; assumptions: string; disclaimer: string; }
export interface ImmutableCalculation { claimId: string; formulaId: string; formulaVersion: string; formulaText: string; inputs: string; factors: readonly FactorSnapshot[]; impactType: ImpactType; timeBasis: string; resultKgCo2e: string; disclaimer: string; }
export interface PointEntry { claimId?: string; voucherId?: string; kind: 'credit' | 'debit' | 'refund' | 'compensation'; points: number; impactType?: ImpactType; }

export type VoucherStatus = 'issued' | 'redeemed' | 'expired' | 'cancelled';
export interface Voucher { id: string; userId: string; pointsCost: number; status: VoucherStatus; issuedAt: Date; expiresAt: Date; redeemedAt?: Date; cancelledAt?: Date; }
export interface VoucherCommandResult { voucher: Voucher; duplicate: boolean; refundPoints: number; reason?: AuditReason; }
