import type { Clock, Voucher, VoucherCommandResult } from './types.js';

const EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

export function issueVoucher(input: Omit<Voucher, 'status' | 'issuedAt' | 'expiresAt'>, clock: Clock): Voucher {
  if (!Number.isSafeInteger(input.pointsCost) || input.pointsCost <= 0) throw new RangeError('Voucher cost must be a positive integer');
  const issuedAt = clock.now();
  return { ...input, status: 'issued', issuedAt, expiresAt: new Date(issuedAt.getTime() + EXPIRY_MS) };
}

export function redeemVoucher(voucher: Voucher, clock: Clock): VoucherCommandResult {
  const now = clock.now();
  if (voucher.status === 'redeemed') return { voucher, duplicate: true, refundPoints: 0, reason: 'voucher_already_redeemed' };
  if (voucher.status !== 'issued') return { voucher, duplicate: true, refundPoints: 0, reason: voucher.status === 'expired' ? 'voucher_expired' : 'voucher_cancelled' };
  if (now.getTime() >= voucher.expiresAt.getTime()) return { voucher: { ...voucher, status: 'expired' }, duplicate: false, refundPoints: 0, reason: 'voucher_expired' };
  return { voucher: { ...voucher, status: 'redeemed', redeemedAt: now }, duplicate: false, refundPoints: 0, reason: 'voucher_redeemed' };
}

export function expireVoucher(voucher: Voucher, clock: Clock): VoucherCommandResult {
  if (voucher.status !== 'issued' || clock.now().getTime() < voucher.expiresAt.getTime()) return { voucher, duplicate: true, refundPoints: 0 };
  return { voucher: { ...voucher, status: 'expired' }, duplicate: false, refundPoints: 0, reason: 'voucher_expired' };
}

export function cancelVoucher(voucher: Voucher, clock: Clock): VoucherCommandResult {
  if (voucher.status !== 'issued') return { voucher, duplicate: true, refundPoints: 0, reason: voucher.status === 'expired' ? 'voucher_expired' : voucher.status === 'redeemed' ? 'voucher_already_redeemed' : 'voucher_cancelled' };
  if (clock.now().getTime() >= voucher.expiresAt.getTime()) return { voucher: { ...voucher, status: 'expired' }, duplicate: false, refundPoints: 0, reason: 'voucher_expired' };
  return { voucher: { ...voucher, status: 'cancelled', cancelledAt: clock.now() }, duplicate: false, refundPoints: voucher.pointsCost, reason: 'voucher_cancelled' };
}

export function isVoucherExpired(voucher: Voucher, clock: Clock): boolean {
  return voucher.status === 'issued' && clock.now().getTime() >= voucher.expiresAt.getTime();
}
