import { describe, expect, it } from "vitest";
import { calculateRab } from "./rabCalculations";

const oneItem = {
  volume: 1,
  materialUnitCost: 60,
  laborUnitCost: 40,
  equipmentUnitCost: 0,
};

describe("RAB calculations", () => {
  it("calculates markup on cost including overhead and contingency", () => {
    const result = calculateRab({
      items: [oneItem],
      profitType: "MARKUP",
      profitPercentage: 20,
      overheadPercentage: 10,
      contingencyPercentage: 5,
      taxPercentage: 10,
    });

    expect(result.totalHpp).toBe(100);
    expect(result.overheadAmount).toBe(10);
    expect(result.contingencyAmount).toBe(5);
    expect(result.profitAmount).toBe(23);
    expect(result.subtotalBeforeTax).toBe(138);
    expect(result.taxAmount).toBe(13.8);
    expect(result.grandTotal).toBe(151.8);
  });

  it("calculates the requested gross margin against total cost", () => {
    const result = calculateRab({
      items: [oneItem],
      profitType: "GROSS_MARGIN",
      profitPercentage: 20,
      overheadPercentage: 10,
      contingencyPercentage: 5,
      taxPercentage: 0,
    });

    expect(result.profitAmount).toBe(28.75);
    expect(result.subtotalBeforeTax).toBe(143.75);
    expect(result.profitAmount / result.subtotalBeforeTax).toBeCloseTo(0.2);
  });

  it("allocates rounded line totals so they reconcile exactly to the RAB grand total", () => {
    const result = calculateRab({
      items: [
        { volume: 3, materialUnitCost: 100.01, laborUnitCost: 25.25, equipmentUnitCost: 0 },
        { volume: 2, materialUnitCost: 80.03, laborUnitCost: 10.02, equipmentUnitCost: 5.01 },
      ],
      profitType: "MARKUP",
      profitPercentage: 17,
      overheadPercentage: 7.5,
      contingencyPercentage: 2.25,
      taxPercentage: 11,
    });

    expect(result.itemPrices.reduce((sum, item) => sum + item.totalPrice, 0)).toBe(result.grandTotal);
  });

  it("rejects a gross-margin rate at 100 percent", () => {
    expect(() => calculateRab({
      items: [oneItem],
      profitType: "GROSS_MARGIN",
      profitPercentage: 100,
      overheadPercentage: 0,
      contingencyPercentage: 0,
      taxPercentage: 0,
    })).toThrow("Persentase profit");
  });
});
