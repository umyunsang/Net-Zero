import type {
  AuditReason,
  ClaimStatus,
  RecyclingValues,
  TreeSignals,
} from './types.js';

const ALLOWED: Readonly<Record<ClaimStatus, readonly ClaimStatus[]>> = {
  submitted: ['pending', 'pending_review'],
  pending: ['verified', 'rejected'],
  pending_review: ['verified', 'rejected'],
  verified: [],
  rejected: [],
};

export function canTransitionClaim(from: ClaimStatus, to: ClaimStatus): boolean {
  return ALLOWED[from].includes(to);
}

export function assertClaimTransition(from: ClaimStatus, to: ClaimStatus): void {
  if (!canTransitionClaim(from, to)) throw new Error(`Invalid claim transition: ${from} -> ${to}`);
}

export function decideTreeOutcome(signals: TreeSignals): { status: Extract<ClaimStatus, 'verified' | 'rejected' | 'pending_review'>; reason: AuditReason } {
  if (signals.ai === 'wrong_type') return { status: 'rejected', reason: 'tree_wrong_type' };
  if (signals.locationDuplicate && signals.visualDuplicate) return { status: 'rejected', reason: 'duplicate_evidence' };
  if (signals.ai === 'unavailable') return { status: 'pending_review', reason: 'tree_provider_unavailable' };
  if (signals.ai === 'ambiguous' || signals.locationDuplicate || signals.visualDuplicate) return { status: 'pending_review', reason: 'tree_ambiguous' };
  return { status: 'verified', reason: 'reviewer_confirmed' };
}

export type RecyclingDecision = 'keep_pending' | 'reject' | 'approve';
export function applyRecyclingReview(declared: RecyclingValues, decision: RecyclingDecision, approved?: RecyclingValues): { status: ClaimStatus; approved?: RecyclingValues; reason: AuditReason } {
  if (!Number.isSafeInteger(declared.count) || declared.count < 0) throw new RangeError('Declared count must be a non-negative integer');
  if (decision === 'keep_pending') return { status: 'pending_review', reason: 'recycling_pending_review' };
  if (decision === 'reject') return { status: 'rejected', reason: 'recycling_rejected' };
  if (!approved || !Number.isSafeInteger(approved.count) || approved.count < 0 || approved.count > declared.count) {
    throw new RangeError('Approved count must be a non-negative integer not greater than declared count');
  }
  return { status: 'verified', approved, reason: approved.count === declared.count && approved.category === declared.category ? 'reviewer_confirmed' : 'reviewer_reduced' };
}
