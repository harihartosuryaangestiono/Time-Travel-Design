import { describe, expect, it } from "vitest";
import { isSalesMarketingCategory } from "./expenseCategories";

describe("isSalesMarketingCategory", () => {
  it.each([
    "Marketing & Sales",
    "marketing and sales",
    "Marketing N Sales",
    "biaya marketing",
  ])("recognizes %s as a general-ledger category", (category) => {
    expect(isSalesMarketingCategory(category)).toBe(true);
  });

  it("does not classify project expenses as sales marketing", () => {
    expect(isSalesMarketingCategory("Project Material Procurement")).toBe(false);
  });
});
