import { describe, expect, it } from "vitest";
import { calculateOwnerAdvanceSummary } from "./ownerAdvanceSummary";

describe("owner advance financial summary", () => {
  it("adds open owner advances to current cash as receivables and omits zero-balance recipients", () => {
    const summary = calculateOwnerAdvanceSummary(
      232_045_202.94,
      [
        { id: "emir-current", name: "Emir Maulana" },
        { id: "emir-duplicate", name: "Emir Maulana" },
        { id: "dodi", name: "Om Dodi" },
      ],
      [
        {
          recipient_id: "emir-current",
          disbursed_amount: 120_000_000,
          settled_amount: 6_888_900,
          returned_amount: 0,
        },
        {
          recipient_id: "emir-current",
          disbursed_amount: 0,
          amount: 0,
          settled_amount: 0,
          returned_amount: 0,
        },
        {
          recipient_id: "emir-duplicate",
          disbursed_amount: 0,
          settled_amount: 0,
          returned_amount: 0,
        },
        {
          recipient_id: "missing-recipient",
          disbursed_amount: 5_000,
          settled_amount: 0,
          returned_amount: 0,
        },
      ],
    );

    expect(summary.ownerAdvances).toEqual([
      { id: "emir-current", name: "Emir Maulana", amount: 113_111_100 },
    ]);
    expect(summary.totalOwnerAdvances).toBe(113_111_100);
    expect(summary.cashAndOwnerAdvanceReceivable).toBe(345_156_302.94);
  });

  it("uses the legacy amount when a disbursed amount is not recorded", () => {
    const summary = calculateOwnerAdvanceSummary(
      100,
      [{ id: "owner", name: "Owner" }],
      [{
        recipient_id: "owner",
        amount: 1_000,
        disbursed_amount: 0,
        settled_amount: 200,
        returned_amount: 100,
      }],
    );

    expect(summary.ownerAdvances[0]?.amount).toBe(700);
  });
});
