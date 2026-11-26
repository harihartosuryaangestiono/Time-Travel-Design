import { describe, expect, it } from "vitest";
import { resolveLaborRatePrice } from "./laborRatePricing";

describe("resolveLaborRatePrice", () => {
  const rate = {
    standard_rate: 70000,
    mandor_rates: [
      { mandor_name: "Rian Purnama", rate: 65000 },
      { mandor_name: "Rian Purnama", rate: 67000 },
      { mandor_name: "Rosidin", rate: 75000 },
    ],
  };

  it("uses the selected mandor's average rate", () => {
    expect(resolveLaborRatePrice(rate, "rian purnama")).toEqual({
      unitRate: 66000,
      source: "MANDOR",
    });
  });

  it("uses the database mandor-rate average when no mandor matches", () => {
    expect(resolveLaborRatePrice(rate, "Mandor Baru")).toEqual({
      unitRate: 69000,
      source: "STANDARD",
    });
  });

  it("falls back to the stored standard rate without mandor-specific rates", () => {
    expect(resolveLaborRatePrice({ standard_rate: 52000 }, "")).toEqual({
      unitRate: 52000,
      source: "STANDARD",
    });
  });
});
