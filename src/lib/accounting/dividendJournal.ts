export interface DividendJournalLine {
  account_id: string;
  debit: number;
  credit: number;
  description: string;
}

export function buildDividendDisbursementJournalLines(input: {
  retainedEarningsAccountId: string;
  cashAccountId: string;
  amount: number;
  recipientName: string;
  cashAccountName: string;
}): DividendJournalLine[] {
  return [
    {
      account_id: input.retainedEarningsAccountId,
      debit: input.amount,
      credit: 0,
      description: `Distribusi dividen kepada ${input.recipientName}`,
    },
    {
      account_id: input.cashAccountId,
      debit: 0,
      credit: input.amount,
      description: `Pencairan dividen dari ${input.cashAccountName}`,
    },
  ];
}
