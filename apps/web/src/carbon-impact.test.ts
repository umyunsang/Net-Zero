import { describe, expect, it } from "vitest";
import syntheticFixtures from "./synthetic-fixtures.json";
import {
  calculateBusImpact,
  calculatePetImpact,
  calculateTreeImpact,
  busAvoidedKg,
  formatCarbonTotal,
  formatCarbonValue,
  routeDistanceKm,
} from "./carbon-impact";
import { translate } from "./localization";

describe("Thailand carbon-impact presentation calculations", () => {
  it("calculates the fixed bus route against the same-distance car baseline", () => {
    const distance = routeDistanceKm(syntheticFixtures.busRoute);
    expect(distance).toBe(0.799211);
    expect(busAvoidedKg(distance)).toBeCloseTo(0.0926285549, 10);
    expect(calculateBusImpact(distance)?.kg_co2e).toBe("0.092629");
    expect(calculateBusImpact(0)).toBeUndefined();
  });

  it("calculates only verified PET items with the complete mass/yield/process proxy", () => {
    expect(Number(calculatePetImpact(46, "plastic", true)?.kg_co2e)).toBeCloseTo(1.760937, 6);
    expect(calculatePetImpact(46, "paper", true)).toBeUndefined();
    expect(calculatePetImpact(46, "plastic", false)).toBeUndefined();
    expect(calculatePetImpact(0, "plastic", true)).toBeUndefined();
  });

  it("keeps eligible tree projections separate and survival-adjusted", () => {
    const impact = calculateTreeImpact(1, true, true);
    expect(impact?.impact_type).toBe("projected_sequestration");
    expect(Number(impact?.kg_co2e)).toBe(29.925);
    expect(impact?.horizon_years).toBe(5);
    expect(calculateTreeImpact(1, false, true)).toBeUndefined();
  });

  it("formats after raw aggregation", () => {
    expect(formatCarbonValue(0.0926286)).toBe("0.09");
    expect(formatCarbonValue(1.7609)).toBe("1.8");
    expect(formatCarbonValue(29.925)).toBe("30");
    expect(formatCarbonValue(0.0926286 + 1.7609)).toBe("1.9");
    expect(formatCarbonTotal(0.0926286 + 1.7609)).toBe("1.85");
    expect(formatCarbonTotal((0.0926286 * 2) + 1.7609)).toBe("1.95");
  });

  it("keeps carbon copy complete in Thai, English, and Korean", () => {
    expect(translate("en", "ผลกระทบคาร์บอนของฉัน")).toBe("My carbon impact");
    expect(translate("ko", "ผลกระทบคาร์บอนของฉัน")).toBe("나의 탄소 영향");
    expect(translate("en", "น้อยกว่ารถยนต์ประมาณ {count} กก. CO₂", { count: "0.09" })).toBe("≈0.09 kg CO₂ less than a car");
    expect(translate("ko", "คาดว่าจะดูดซับประมาณ {count} กก. CO₂e ใน {years} ปี", { count: 30, years: 5 })).toBe("5년간 약 30 kg CO₂e 흡수 예상");
  });
});
