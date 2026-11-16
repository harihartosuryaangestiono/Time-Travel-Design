import { describe, expect, it } from "vitest";
import {
  convertMaterialQuantityToUsageUnit,
  getUsageUnitPrice,
} from "./materialUnits";

describe("material unit conversion", () => {
  it("converts purchase quantities into the usage unit", () => {
    expect(convertMaterialQuantityToUsageUnit(10, "sak", {
      purchaseUnit: "sak",
      usageUnit: "kg",
      conversionFactor: 25,
    })).toBe(250);
  });

  it("keeps quantities already in the usage unit", () => {
    expect(convertMaterialQuantityToUsageUnit(2.5, "M²", {
      purchaseUnit: "dus",
      usageUnit: "m²",
      conversionFactor: 1.44,
    })).toBe(2.5);
  });

  it("normalizes unit price and supports conversion factors below one", () => {
    expect(getUsageUnitPrice(195000, 1.44)).toBeCloseTo(135416.6667, 3);
    expect(getUsageUnitPrice(100, 0.5)).toBe(200);
  });

  it("rejects unknown units and invalid factors", () => {
    expect(() => convertMaterialQuantityToUsageUnit(1, "pail", {
      purchaseUnit: "sak",
      usageUnit: "kg",
      conversionFactor: 25,
    })).toThrow("tidak dapat dikonversi");
    expect(() => getUsageUnitPrice(100, 0)).toThrow("Faktor konversi");
  });
});
