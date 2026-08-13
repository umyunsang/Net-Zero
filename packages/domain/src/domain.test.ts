import { describe, expect, it } from "vitest";

import {
  applyRecyclingReview,
  assignSamplesToSlots,
  calculateBusKgCo2e,
  calculatePoints,
  calculateRecyclingKgCo2e,
  calculateTreeKgCo2e,
  cancelVoucher,
  decideTreeOutcome,
  expectedSlotCount,
  evaluateBus,
  issueVoucher,
  normalizeGpsSamples,
  redeemVoucher,
  slotForTimestamp,
  type BusOracleConfig,
  type Clock,
  type GpsSample,
} from "./index.js";

const start = new Date("2026-01-01T00:00:00.000Z");
const clock = (value: string): Clock => ({ now: () => new Date(value) });
const sample = (id: string, seconds: number, longitude = 0): GpsSample => ({
  id,
  timestamp: new Date(start.getTime() + seconds * 1_000),
  latitude: 0,
  longitude,
  accuracyMeters: 5,
});

function config(endSeconds: number): BusOracleConfig {
  return {
    start,
    end: new Date(start.getTime() + endSeconds * 1_000),
    maxAccuracyMeters: 25,
    isInsideStop: (point) =>
      point.longitude === 0 ? "S1" : point.longitude === 1 ? "S2" : null,
    isInsideRoute: () => true,
    distanceMeters: () => 300,
    stopPairDistanceMeters: () => 400,
  };
}

describe("bus oracle", () => {
  it("counts a zero-duration trip as one slot and rejects reversed intervals", () => {
    expect(expectedSlotCount(start, start)).toBe(1);
    expect(() => expectedSlotCount(new Date(start.getTime() + 1), start)).toThrow(
      "end must not precede start",
    );
  });

  it("counts elapsed ticks and assigns an exact midpoint to the later slot and endpoint to the last slot", () => {
    const end = new Date(start.getTime() + 60_000);
    expect(expectedSlotCount(start, end)).toBe(3);
    expect(slotForTimestamp(new Date(start.getTime() + 15_000), start, end)).toBe(1);
    expect(slotForTimestamp(end, start, end)).toBe(2);
    expect(slotForTimestamp(new Date(start.getTime() - 1), start, end)).toBeNull();
  });

  it("collapses duplicate IDs and timestamps using accuracy then stable ID", () => {
    const normalized = normalizeGpsSamples(
      [
        { ...sample("same", 0), accuracyMeters: 20 },
        { ...sample("same", 30), accuracyMeters: 5 },
        { ...sample("z", 60), accuracyMeters: 5 },
        { ...sample("a", 60), accuracyMeters: 5 },
      ],
      config(60),
    );
    expect(
      normalized.map(({ id, timestamp, accuracyMeters }) => [
        id,
        timestamp.toISOString(),
        accuracyMeters,
      ]),
    ).toEqual([
      ["same", "2026-01-01T00:00:30.000Z", 5],
      ["a", "2026-01-01T00:01:00.000Z", 5],
    ]);
  });

  it("normalizes equal-accuracy duplicate IDs independently of input order", () => {
    const duplicateId = [
      { ...sample("same", 30), accuracyMeters: 5, longitude: 1 },
      { ...sample("same", 0), accuracyMeters: 5, longitude: 0 },
    ];
    const forward = normalizeGpsSamples(duplicateId, config(60));
    const reversed = normalizeGpsSamples([...duplicateId].reverse(), config(60));
    expect(forward).toEqual(reversed);
    expect(forward[0]?.timestamp.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });

  it("chooses one representative by distance, timestamp, then stable id", () => {
    const result = assignSamplesToSlots(
      [sample("z", 29), sample("a", 31), sample("b", 31)],
      config(60),
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.sample.id).toBe("z");
  });

  it("keeps 79.999% coverage pending but evaluates at exactly 80.000%", () => {
    const almostEnough = Array.from({ length: 79_999 }, (_, slot) => sample(`a${slot}`, slot * 30));
    const below = evaluateBus(almostEnough, config(2_999_970));
    expect(below.status).toBe("pending");
    expect(below.reason).toBe("bus_insufficient_coverage");
    expect(below.metrics.coverage).toMatchObject({
      numerator: 79_999,
      denominator: 100_000,
      ratio: 0.79999,
    });

    const atThreshold = evaluateBus(
      [sample("a", 0), sample("b", 30), sample("c", 60), sample("d", 90)],
      config(120),
    );
    expect(atThreshold.metrics.coverage).toMatchObject({ numerator: 4, denominator: 5, ratio: 0.8 });
    expect(atThreshold.reason).toBe("bus_metric_unavailable");
  });

  it("uses inclusive 20 and 40 km/h speed bounds and rejects out-of-range speed", () => {
    const noStops = { ...config(120), isInsideStop: () => null };
    const samples = [
      sample("a", 0, 0),
      sample("b", 30, 1),
      sample("c", 60, 2),
      sample("d", 90, 3),
      sample("e", 120, 4),
    ];
    const inclusive = evaluateBus(samples, {
      ...noStops,
      distanceMeters: (from) => from.longitude % 2 === 0 ? 500 / 3 : 1_000 / 3,
    });
    expect(inclusive.metrics.speed).toMatchObject({ numerator: 4, denominator: 4, ratio: 1 });

    const outOfRange = evaluateBus(samples, { ...noStops, distanceMeters: () => 100 });
    expect(outOfRange.status).toBe("rejected");
    expect(outOfRange.reason).toBe("bus_speed_below_threshold");
  });

  it("uses inclusive 300 and 500 meter stop-pair bounds", () => {
    const stops = [
      sample("a", 0, 0),
      sample("b", 30, 1),
      sample("c", 60, 0),
      sample("d", 90, 1),
      sample("e", 120, 0),
    ];
    const inclusive = evaluateBus(stops, {
      ...config(120),
      stopPairDistanceMeters: (from) => from === "S1" ? 300 : 500,
    });
    expect(inclusive.metrics.stops).toMatchObject({ numerator: 4, denominator: 4, ratio: 1 });

    const outside = evaluateBus(stops, {
      ...config(120),
      stopPairDistanceMeters: (from) => from === "S1" ? 299 : 501,
    });
    expect(outside.status).toBe("rejected");
    expect(outside.reason).toBe("bus_stop_pattern_below_threshold");
  });

  it("accepts exactly 80% route matching before unavailable metrics", () => {
    const result = evaluateBus(
      [
        sample("a", 0, 2),
        sample("b", 30, 2),
        sample("c", 60, 2),
        sample("d", 90, 2),
        sample("e", 120, 3),
      ],
      {
        ...config(120),
        isInsideStop: () => null,
        isInsideRoute: (point) => point.longitude === 2,
      },
    );
    expect(result.metrics.route).toMatchObject({ numerator: 4, denominator: 5, ratio: 0.8 });
    expect(result.reason).toBe("bus_metric_unavailable");
  });

  it("returns pending before downstream metrics when coverage is below 80%", () => {
    const result = evaluateBus([sample("a", 0), sample("b", 30)], config(120));
    expect(result.status).toBe("pending");
    expect(result.reason).toBe("bus_insufficient_coverage");
  });

  it("lets an evaluable failed metric dominate an unavailable metric after sufficient coverage", () => {
    const cfg = { ...config(60), isInsideRoute: () => false, isInsideStop: () => null };
    const result = evaluateBus(
      [sample("a", 0), sample("b", 30, 0.003), sample("c", 60, 0.006)],
      cfg,
    );
    expect(result.status).toBe("rejected");
    expect(result.reason).toBe("bus_route_match_below_threshold");
  });

  it("keeps route unavailable while an evaluable speed failure still rejects", () => {
    const result = evaluateBus(
      [sample("a", 0, 0.2), sample("b", 30, 0.4), sample("c", 60, 0.6)],
      {
        ...config(60),
        routeAvailable: false,
        isInsideStop: () => null,
        distanceMeters: () => 100,
      },
    );
    expect(result.metrics.route).toEqual({ available: false });
    expect(result.metrics.speed).toMatchObject({ available: true, ratio: 0 });
    expect(result.status).toBe("rejected");
    expect(result.reason).toBe("bus_speed_below_threshold");
  });

  it("rejects a physical duplicate before awarding value", () => {
    const result = evaluateBus([sample("a", 0)], config(120), true);
    expect(result.status).toBe("rejected");
    expect(result.reason).toBe("duplicate_evidence");
  });

  it("produces identical results when replaying equivalent evidence in another order", () => {
    const evidence = [
      sample("b", 30, 2),
      sample("a", 0, 2),
      sample("d", 90, 2),
      sample("c", 60, 2),
      sample("e", 120, 2),
    ];
    const cfg = { ...config(120), isInsideStop: () => null };
    expect(evaluateBus(evidence, cfg)).toEqual(evaluateBus([...evidence].reverse(), cfg));
  });
});

describe("claim reviews", () => {
  it("maps tree AI and duplicate signals to approved outcomes", () => {
    expect(
      decideTreeOutcome({ ai: "pass", locationDuplicate: false, visualDuplicate: false }),
    ).toMatchObject({ status: "verified" });
    expect(
      decideTreeOutcome({ ai: "wrong_type", locationDuplicate: false, visualDuplicate: false }),
    ).toMatchObject({ status: "rejected", reason: "tree_wrong_type" });
    expect(
      decideTreeOutcome({ ai: "unavailable", locationDuplicate: false, visualDuplicate: false }),
    ).toMatchObject({ status: "pending_review", reason: "tree_provider_unavailable" });
    expect(
      decideTreeOutcome({ ai: "ambiguous", locationDuplicate: false, visualDuplicate: false }),
    ).toMatchObject({ status: "pending_review", reason: "tree_ambiguous" });
    expect(
      decideTreeOutcome({ ai: "pass", locationDuplicate: true, visualDuplicate: false }),
    ).toMatchObject({ status: "pending_review" });
    expect(
      decideTreeOutcome({ ai: "pass", locationDuplicate: false, visualDuplicate: true }),
    ).toMatchObject({ status: "pending_review" });
    expect(
      decideTreeOutcome({ ai: "pass", locationDuplicate: true, visualDuplicate: true }),
    ).toMatchObject({ status: "rejected", reason: "duplicate_evidence" });
  });

  it("approves unchanged recycling, permits reduction, rejects, and forbids increases", () => {
    expect(
      applyRecyclingReview(
        { category: "plastic", count: 5 },
        "approve",
        { category: "plastic", count: 5 },
      ),
    ).toMatchObject({ status: "verified", reason: "reviewer_confirmed" });
    expect(
      applyRecyclingReview(
        { category: "plastic", count: 5 },
        "approve",
        { category: "plastic", count: 3 },
      ),
    ).toMatchObject({ status: "verified", reason: "reviewer_reduced" });
    expect(applyRecyclingReview({ category: "plastic", count: 5 }, "reject")).toMatchObject({
      status: "rejected",
      reason: "recycling_rejected",
    });
    expect(() =>
      applyRecyclingReview(
        { category: "plastic", count: 5 },
        "approve",
        { category: "plastic", count: 6 },
      ),
    ).toThrow();
  });
});

describe("carbon and points", () => {
  it("fails closed when any required factor is unapproved", () => {
    expect(() =>
      calculateBusKgCo2e("10.000000", "0.200000000", "0.080000000", false),
    ).toThrow("factor_approval_required");
    expect(() => calculateRecyclingKgCo2e(1, "0.250000000", false)).toThrow(
      "factor_approval_required",
    );
    expect(() => calculateTreeKgCo2e("9.500000000", false)).toThrow("factor_approval_required");
  });

  it("enforces decimal scales, half-even rounding, non-negative bus value, and approved values", () => {
    expect(() =>
      calculateBusKgCo2e("1.0000001", "0.200000000", "0.080000000", true),
    ).toThrow("Decimal exceeds scale 6");
    expect(() => calculateTreeKgCo2e("9.5000000001", true)).toThrow(
      "Decimal exceeds scale 9",
    );
    expect(calculateBusKgCo2e("1.000000", "0.1000005", "0.0000000", true)).toBe("0.100000");
    expect(calculateBusKgCo2e("1.000000", "0.1000015", "0.0000000", true)).toBe("0.100002");
    expect(calculateBusKgCo2e("10.000000", "0.080000000", "0.200000000", true)).toBe("0.000000");
    expect(calculateBusKgCo2e("10.000000", "0.200000000", "0.080000000", true)).toBe("1.200000");
    expect(calculateRecyclingKgCo2e(3, "0.250000000", true)).toBe("0.750000");
    expect(calculateTreeKgCo2e("9.500000000", true)).toBe("9.500000");
  });

  it("floors points, applies the tree 25% multiplier, and caps awards", () => {
    expect(calculatePoints("estimated_avoided_co2e", "1.200000")).toBe(12);
    expect(calculatePoints("estimated_avoided_co2e", "0.750000")).toBe(7);
    expect(calculatePoints("projected_sequestration_co2e", "9.500000")).toBe(23);
    expect(calculatePoints("estimated_avoided_co2e", "999.000000")).toBe(100);
  });
});

describe("voucher lifecycle", () => {
  const issued = issueVoucher(
    { id: "v1", userId: "u1", pointsCost: 25 },
    clock("2026-01-01T00:00:00Z"),
  );

  it("expires exactly seven days after issuance without a refund", () => {
    expect(issued.expiresAt.toISOString()).toBe("2026-01-08T00:00:00.000Z");
    expect(redeemVoucher(issued, clock("2026-01-08T00:00:00Z"))).toMatchObject({
      duplicate: false,
      refundPoints: 0,
      reason: "voucher_expired",
    });
  });

  it("returns a stable duplicate result after redemption", () => {
    const first = redeemVoucher(issued, clock("2026-01-02T00:00:00Z"));
    expect(first.voucher.status).toBe("redeemed");
    expect(redeemVoucher(first.voucher, clock("2026-01-03T00:00:00Z"))).toMatchObject({
      duplicate: true,
      refundPoints: 0,
      reason: "voucher_already_redeemed",
    });
  });

  it("refunds only a cancellation before use", () => {
    expect(cancelVoucher(issued, clock("2026-01-02T00:00:00Z"))).toMatchObject({
      duplicate: false,
      refundPoints: 25,
      reason: "voucher_cancelled",
    });
  });

  it("does not refund or transition terminal vouchers", () => {
    const cancelled = cancelVoucher(issued, clock("2026-01-02T00:00:00Z")).voucher;
    expect(redeemVoucher(cancelled, clock("2026-01-03T00:00:00Z"))).toMatchObject({
      duplicate: true,
      refundPoints: 0,
      reason: "voucher_cancelled",
    });

    const redeemed = redeemVoucher(issued, clock("2026-01-02T00:00:00Z")).voucher;
    expect(cancelVoucher(redeemed, clock("2026-01-03T00:00:00Z"))).toMatchObject({
      duplicate: true,
      refundPoints: 0,
      reason: "voucher_already_redeemed",
    });
  });
});
