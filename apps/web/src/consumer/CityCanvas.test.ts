import { describe, expect, it } from "vitest";
import { structureBudget } from "./CityCanvas";

describe("earned Fable city progression", () => {
  it("starts as a flat plot and adds nature before a denser city", () => {
    expect(structureBudget(0, "earned")).toEqual({ buildings: 0, trees: 0 });
    expect(structureBudget(3, "earned")).toEqual({ buildings: 0, trees: 1 });
    expect(structureBudget(15, "earned")).toEqual({ buildings: 3, trees: 5 });
    expect(structureBudget(38, "earned")).toEqual({ buildings: 9, trees: 12 });
    expect(structureBudget(500, "earned")).toEqual({ buildings: 20, trees: 24 });
  });

  it("keeps the ambient cover city populated at zero points", () => {
    expect(structureBudget(0)).toEqual({ buildings: 5, trees: 4 });
  });
});
