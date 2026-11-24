import { describe, expect, it } from "vitest";
import { summarizeMaterialPrices } from "./materialPrices";

describe("material price summary", () => {
  it("uses the midpoint between the lowest and highest store prices", () => {
    expect(summarizeMaterialPrices([560000, 600000, 620000])).toEqual({
      minPrice: 560000,
      maxPrice: 620000,
      averagePrice: 590000,
    });
  });

  it("returns the only available price as the midpoint", () => {
    expect(summarizeMaterialPrices([620000])).toEqual({
      minPrice: 620000,
      maxPrice: 620000,
      averagePrice: 620000,
    });
  });

  it("returns an empty summary when there are no valid prices", () => {
    expect(summarizeMaterialPrices([0, Number.NaN, Number.POSITIVE_INFINITY])).toEqual({
      minPrice: 0,
      maxPrice: 0,
      averagePrice: 0,
    });
  });
});
