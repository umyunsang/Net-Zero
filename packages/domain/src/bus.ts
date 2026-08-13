import type { BusEvaluationResult, BusMetric, GeoPoint, GpsSample } from './types.js';

const TICK_MS = 30_000;
const THRESHOLD = 0.8;

export interface BusOracleConfig {
  readonly start: Date;
  readonly end: Date;
  readonly maxAccuracyMeters: number;
  readonly routeAvailable?: boolean;
  readonly isInsideStop: (point: GeoPoint) => string | null;
  readonly isInsideRoute: (point: GeoPoint) => boolean;
  readonly distanceMeters: (from: GeoPoint, to: GeoPoint) => number;
  readonly stopPairDistanceMeters: (fromStopId: string, toStopId: string) => number | null;
}

export interface SlotAssignment { readonly slot: number; readonly sample: GpsSample; }

export function expectedSlotCount(start: Date, end: Date): number {
  const elapsed = end.getTime() - start.getTime();
  if (!Number.isFinite(elapsed) || elapsed < 0) throw new RangeError('end must not precede start');
  return Math.floor(elapsed / TICK_MS) + 1;
}

export function slotForTimestamp(timestamp: Date, start: Date, end: Date): number | null {
  const value = timestamp.getTime();
  const first = start.getTime();
  const last = end.getTime();
  if (value < first || value > last) return null;
  const count = expectedSlotCount(start, end);
  if (count === 1) return 0;
  // Interior boundaries are midpoint-inclusive on the later slot.
  const slot = Math.floor((value - first + TICK_MS / 2) / TICK_MS);
  return Math.min(slot, count - 1);
}

export function isValidGpsSample(sample: GpsSample, config: Pick<BusOracleConfig, 'start' | 'end' | 'maxAccuracyMeters'>): boolean {
  const timestamp = sample.timestamp.getTime();
  return Number.isFinite(timestamp) && Number.isFinite(sample.latitude) && Number.isFinite(sample.longitude) &&
    Number.isFinite(sample.accuracyMeters) && sample.latitude >= -90 && sample.latitude <= 90 &&
    sample.longitude >= -180 && sample.longitude <= 180 && sample.accuracyMeters >= 0 &&
    sample.accuracyMeters <= config.maxAccuracyMeters && timestamp >= config.start.getTime() && timestamp <= config.end.getTime();
}

function compareNormalization(a: GpsSample, b: GpsSample): number {
  return a.accuracyMeters - b.accuracyMeters || a.id.localeCompare(b.id);
}

export function normalizeGpsSamples(samples: readonly GpsSample[], config: Pick<BusOracleConfig, 'start' | 'end' | 'maxAccuracyMeters'>): GpsSample[] {
  const valid = samples
    .filter((sample) => isValidGpsSample(sample, config))
    .sort((a, b) =>
      a.timestamp.getTime() - b.timestamp.getTime() ||
      a.id.localeCompare(b.id) ||
      a.accuracyMeters - b.accuracyMeters ||
      a.latitude - b.latitude ||
      a.longitude - b.longitude);
  const byIdentity = new Map<string, GpsSample>();
  for (const sample of valid) {
    const existing = byIdentity.get(sample.id);
    if (!existing || compareNormalization(sample, existing) < 0) byIdentity.set(sample.id, sample);
  }
  const byTimestamp = new Map<number, GpsSample>();
  for (const sample of byIdentity.values()) {
    const key = sample.timestamp.getTime();
    const existing = byTimestamp.get(key);
    if (!existing || compareNormalization(sample, existing) < 0) byTimestamp.set(key, sample);
  }
  return [...byTimestamp.values()].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime() || a.id.localeCompare(b.id));
}

export function assignSamplesToSlots(samples: readonly GpsSample[], config: Pick<BusOracleConfig, 'start' | 'end'>): SlotAssignment[] {
  const start = config.start.getTime();
  const slots = new Map<number, GpsSample>();
  for (const sample of samples) {
    const slot = slotForTimestamp(sample.timestamp, config.start, config.end);
    if (slot === null) continue;
    const tick = start + slot * TICK_MS;
    const existing = slots.get(slot);
    if (!existing || Math.abs(sample.timestamp.getTime() - tick) < Math.abs(existing.timestamp.getTime() - tick) ||
      (Math.abs(sample.timestamp.getTime() - tick) === Math.abs(existing.timestamp.getTime() - tick) &&
        (sample.timestamp.getTime() < existing.timestamp.getTime() ||
          (sample.timestamp.getTime() === existing.timestamp.getTime() && sample.id.localeCompare(existing.id) < 0)))) {
      slots.set(slot, sample);
    }
  }
  return [...slots.entries()].sort(([a], [b]) => a - b).map(([slot, sample]) => ({ slot, sample }));
}

export function metric(numerator: number, denominator: number): BusMetric {
  if (denominator <= 0) return { available: false };
  return { available: true, numerator, denominator, ratio: numerator / denominator };
}

function ratioPasses(value: BusMetric): boolean { return value.available && (value.ratio ?? 0) >= THRESHOLD; }

export function evaluateBus(samples: readonly GpsSample[], config: BusOracleConfig, physicalDuplicate = false): BusEvaluationResult {
  const expected = expectedSlotCount(config.start, config.end);
  const representatives = assignSamplesToSlots(normalizeGpsSamples(samples, config), config).map(({ sample }) => sample);
  const coverage = metric(representatives.length, expected);
  const unavailable: BusMetric = { available: false };
  if (physicalDuplicate) return { status: 'rejected', reason: 'duplicate_evidence', metrics: { coverage, speed: unavailable, stops: unavailable, route: unavailable }, representatives };
  if (!ratioPasses(coverage)) return { status: 'pending', reason: 'bus_insufficient_coverage', metrics: { coverage, speed: unavailable, stops: unavailable, route: unavailable }, representatives };

  let speedTotal = 0; let speedPass = 0;
  for (let i = 1; i < representatives.length; i += 1) {
    const previous = representatives[i - 1]!; const current = representatives[i]!;
    if (config.isInsideStop(previous) || config.isInsideStop(current)) continue;
    const seconds = (current.timestamp.getTime() - previous.timestamp.getTime()) / 1000;
    if (seconds <= 0) continue;
    speedTotal += 1;
    const kmh = config.distanceMeters(previous, current) / seconds * 3.6;
    if (kmh >= 20 && kmh <= 40) speedPass += 1;
  }
  const speed = metric(speedPass, speedTotal);

  const visits: string[] = [];
  for (const sample of representatives) {
    const stop = config.isInsideStop(sample);
    if (stop && visits.at(-1) !== stop) visits.push(stop);
  }
  let stopTotal = 0; let stopPass = 0;
  for (let i = 1; i < visits.length; i += 1) {
    const distance = config.stopPairDistanceMeters(visits[i - 1]!, visits[i]!);
    if (distance === null) continue;
    stopTotal += 1;
    if (distance >= 300 && distance <= 500) stopPass += 1;
  }
  const stops = metric(stopPass, stopTotal);
  const route = config.routeAvailable === false
    ? unavailable
    : metric(representatives.filter((sample) => config.isInsideRoute(sample)).length, representatives.length);
  const metrics = { coverage, speed, stops, route };
  const failures: Array<[BusMetric, BusEvaluationResult['reason']]> = [[speed, 'bus_speed_below_threshold'], [stops, 'bus_stop_pattern_below_threshold'], [route, 'bus_route_match_below_threshold']];
  for (const [value, reason] of failures) if (value.available && !ratioPasses(value)) return { status: 'rejected', reason, metrics, representatives };
  if (!speed.available) return { status: 'pending', reason: 'bus_metric_unavailable', metrics, representatives };
  if (!stops.available) return { status: 'pending', reason: 'bus_metric_unavailable', metrics, representatives };
  if (!route.available) return { status: 'pending', reason: 'bus_metric_unavailable', metrics, representatives };
  return { status: 'verified', reason: 'reviewer_confirmed', metrics, representatives };
}
