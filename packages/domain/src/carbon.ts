import { Decimal } from 'decimal.js';
import type { ImpactType } from './types.js';

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_EVEN });
export { Decimal };

const KG_SCALE = 6;
const FACTOR_SCALE = 9;
const DISTANCE_SCALE = 6;
const INTERMEDIATE_SCALE = 12;
export type DecimalInput = Decimal.Value;

function parse(value: DecimalInput, scale: number): Decimal {
  const text = String(value);
  if (typeof value === 'number' && !Number.isFinite(value)) throw new RangeError('Decimal must be finite');
  if (!/^-?\d+(?:\.\d+)?$/.test(text) || (text.split('.')[1]?.length ?? 0) > scale) throw new RangeError(`Decimal exceeds scale ${scale}`);
  return new Decimal(text);
}
function fixed(value: Decimal, scale: number): string { return value.toDecimalPlaces(scale, Decimal.ROUND_HALF_EVEN).toFixed(scale); }

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (value instanceof Decimal) return JSON.stringify(value.toFixed(KG_SCALE));
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new RangeError('Canonical JSON cannot contain non-finite numbers');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
  }
  throw new TypeError('Canonical JSON only supports JSON values');
}

function requireApproved(approved: boolean): void { if (!approved) throw new Error('factor_approval_required'); }

export function calculateBusKgCo2e(distanceKm: DecimalInput, carFactor: DecimalInput, busFactor: DecimalInput, factorsApproved: boolean): string {
  requireApproved(factorsApproved);
  const distance = parse(distanceKm, DISTANCE_SCALE);
  const car = parse(carFactor, FACTOR_SCALE);
  const bus = parse(busFactor, FACTOR_SCALE);
  return fixed(Decimal.max(0, distance.times(car.minus(bus)).toDecimalPlaces(INTERMEDIATE_SCALE, Decimal.ROUND_HALF_EVEN)), KG_SCALE);
}

export function calculateRecyclingKgCo2e(approvedCount: number, factor: DecimalInput, factorApproved: boolean): string {
  requireApproved(factorApproved);
  if (!Number.isSafeInteger(approvedCount) || approvedCount < 0) throw new RangeError('Approved count must be a non-negative integer');
  return fixed(new Decimal(approvedCount).times(parse(factor, FACTOR_SCALE)).toDecimalPlaces(INTERMEDIATE_SCALE, Decimal.ROUND_HALF_EVEN), KG_SCALE);
}

/** Factor value is the approved annual projected proxy; it is not a survival or removal claim. */
export function calculateTreeKgCo2e(factor: DecimalInput, factorApproved: boolean): string {
  requireApproved(factorApproved);
  return fixed(parse(factor, FACTOR_SCALE).toDecimalPlaces(INTERMEDIATE_SCALE, Decimal.ROUND_HALF_EVEN), KG_SCALE);
}

export function calculatePoints(impactType: ImpactType, finalKgCo2e: DecimalInput): number {
  const kg = parse(finalKgCo2e, KG_SCALE);
  if (kg.isNegative()) throw new RangeError('Impact cannot be negative');
  const points = impactType === 'projected_sequestration_co2e' ? kg.div('0.1').times('0.25') : kg.div('0.1');
  return Math.min(100, points.floor().toNumber());
}

export function canonicalDecimal(value: DecimalInput, scale = KG_SCALE): string { return fixed(parse(value, scale), scale); }
