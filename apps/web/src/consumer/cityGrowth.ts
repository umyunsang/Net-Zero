export type CityGrowthMode = "ambient" | "earned";

export function structureBudget(points: number, growthMode: CityGrowthMode = "ambient"): { buildings: number; trees: number } {
  const earnedPoints = Math.max(0, Math.floor(points));
  if (growthMode === "earned") {
    return {
      buildings: Math.min(Math.floor(earnedPoints / 4), 20),
      trees: earnedPoints === 0 ? 0 : Math.min(Math.max(1, Math.floor(earnedPoints / 3)), 24),
    };
  }
  return {
    buildings: Math.min(5 + Math.floor(earnedPoints / 10), 22),
    trees: Math.min(4 + Math.floor(earnedPoints / 8), 26),
  };
}

/** Mock leaderboard proxy only: a readable visual estimate, not a carbon credit. */
export function estimateCarbonImpact(points: number): number {
  return Math.round(Math.max(0, Math.floor(points)) * 0.15 * 100) / 100;
}
