import { describe, expect, it } from "vitest";
import { CreateDividendDisbursementSchema } from "./dividendDisbursement";

describe("CreateDividendDisbursementSchema", () => {
  const validInput = {
    cash_account_id: "company-bank",
    recipient_name: "Pemegang Saham",
    date: "2026-11-26",
    amount: 25_000_000,
  };

  it("accepts a valid dividend payout", () => {
    expect(CreateDividendDisbursementSchema.safeParse(validInput).success).toBe(true);
  });

  it("rejects nonpositive amounts and impossible dates", () => {
    expect(
      CreateDividendDisbursementSchema.safeParse({ ...validInput, amount: 0 }).success
    ).toBe(false);
    expect(
      CreateDividendDisbursementSchema.safeParse({ ...validInput, date: "2026-02-31" }).success
    ).toBe(false);
  });
});
