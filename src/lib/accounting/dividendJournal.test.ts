import { describe, expect, it } from "vitest";
import { buildDividendDisbursementJournalLines } from "./dividendJournal";

describe("buildDividendDisbursementJournalLines", () => {
  it("debits retained earnings and credits the selected cash account", () => {
    expect(
      buildDividendDisbursementJournalLines({
        retainedEarningsAccountId: "retained-earnings",
        cashAccountId: "company-bank",
        amount: 200_000_000,
        recipientName: "Pemegang Saham",
        cashAccountName: "Rekening PT",
      })
    ).toEqual([
      {
        account_id: "retained-earnings",
        debit: 200_000_000,
        credit: 0,
        description: "Distribusi dividen kepada Pemegang Saham",
      },
      {
        account_id: "company-bank",
        debit: 0,
        credit: 200_000_000,
        description: "Pencairan dividen dari Rekening PT",
      },
    ]);
  });
});
