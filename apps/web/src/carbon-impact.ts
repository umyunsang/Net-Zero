import type { Activity, GpsSample, Impact } from "./product-types";

export const CARBON_METHODS = {
  bus: {
    id: "TH-BUS-CAR-COMP-v1",
    version: "T-VER-S-METH-03-02-v01",
    sourceUrl: "https://tver.tgo.or.th/database/Uploads/Methodology/b51b3bf6-a51a-4b7e-a394-8743f44ff2fc.pdf",
    carKgCo2PerPassengerKm: 0.1271,
    busKgCo2PerPassengerKm: 0.0112,
  },
  recycling: {
    id: "TH-PET-TVER-PROXY-v1",
    version: "T-VER-S-METH-09-06-v02",
    sourceUrl: "https://tver.tgo.or.th/database/Uploads/Methodology/f6dac6a7-c83e-4bff-85d5-785ff8252f1a.pdf",
    bottleMassKg: 4650 / 158748,
    qualifyingYield: 0.75,
    virginPetKgCo2ePerKg: 2.9389,
    qualityFactor: 0.75,
    recyclingElectricityKwhPerKg: 0.83,
    thaiGridKgCo2ePerKwh: 0.5562,
  },
  tree: {
    id: "TH-TREE-PROJ-v1",
    version: "T-VER-S-TOOL-01-01-v2-bangkok-survival-v1",
    sourceUrl: "https://ghgreduction.tgo.or.th/th/tver-method/tver-tool/for-agr/download/12026/3451/31.html",
    annualKgCo2ePerTree: 9.5,
    horizonYears: 5,
    survivalFactor: 0.63,
  },
} as const;

export function routeDistanceKm(samples: Pick<GpsSample, "latitude" | "longitude">[]): number {
  const earthRadiusMeters = 6_371_000;
  const radians = (degrees: number) => degrees * Math.PI / 180;
  let distanceMeters = 0;
  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1]!;
    const current = samples[index]!;
    const latitude1 = radians(Number(previous.latitude));
    const latitude2 = radians(Number(current.latitude));
    const latitudeDelta = latitude2 - latitude1;
    const longitudeDelta = radians(Number(current.longitude) - Number(previous.longitude));
    const haversine = Math.sin(latitudeDelta / 2) ** 2
      + Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(longitudeDelta / 2) ** 2;
    distanceMeters += 2 * earthRadiusMeters * Math.asin(Math.sqrt(haversine));
  }
  return Number((distanceMeters / 1000).toFixed(6));
}

function receipt(activity: Activity, rawKgCo2e: number): Impact {
  const method = CARBON_METHODS[activity];
  return {
    kg_co2e: rawKgCo2e.toFixed(6),
    impact_type: activity === "tree" ? "projected_sequestration" : "avoided",
    display_unit: activity === "bus" ? "kg_co2" : "kg_co2e",
    horizon_years: activity === "tree" ? CARBON_METHODS.tree.horizonYears : undefined,
    method_id: method.id,
    method_version: method.version,
    source_url: method.sourceUrl,
    disclosure_key: activity,
  };
}

export function calculateBusImpact(distanceKm: number): Impact | undefined {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return undefined;
  const delta = Math.max(0, CARBON_METHODS.bus.carKgCo2PerPassengerKm - CARBON_METHODS.bus.busKgCo2PerPassengerKm);
  if (delta === 0) return undefined;
  return receipt("bus", busAvoidedKg(distanceKm));
}

export function busAvoidedKg(distanceKm: number): number {
  return Math.max(0, distanceKm * Math.max(0, CARBON_METHODS.bus.carKgCo2PerPassengerKm - CARBON_METHODS.bus.busKgCo2PerPassengerKm));
}

export function calculatePetImpact(itemCount: number, material: string, verified: boolean): Impact | undefined {
  if (!verified || material !== "plastic" || !Number.isSafeInteger(itemCount) || itemCount <= 0) return undefined;
  const method = CARBON_METHODS.recycling;
  const netFactor = (method.virginPetKgCo2ePerKg * method.qualityFactor)
    - (method.recyclingElectricityKwhPerKg * method.thaiGridKgCo2ePerKwh);
  const raw = itemCount * method.bottleMassKg * method.qualifyingYield * netFactor;
  return raw > 0 ? receipt("recycling", raw) : undefined;
}

export function calculateTreeImpact(quantity: number, eligible: boolean, verified: boolean): Impact | undefined {
  if (!verified || !eligible || !Number.isSafeInteger(quantity) || quantity <= 0) return undefined;
  const method = CARBON_METHODS.tree;
  return receipt("tree", quantity * method.annualKgCo2ePerTree * method.horizonYears * method.survivalFactor);
}

export function formatCarbonValue(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0";
  if (value < 0.01) return "<0.01";
  if (value < 1) return value.toFixed(2);
  if (value < 10) return value.toFixed(1);
  return Math.round(value).toString();
}

export function formatCarbonTotal(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0";
  if (value < 0.01) return "<0.01";
  if (value < 10) return value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return Math.round(value).toString();
}

export function getPrimaryImpact(activity: Activity, impacts: Impact[] | undefined): Impact | undefined {
  return impacts?.find((impact) => activity === "tree"
    ? impact.impact_type === "projected_sequestration"
    : impact.impact_type === "avoided");
}
