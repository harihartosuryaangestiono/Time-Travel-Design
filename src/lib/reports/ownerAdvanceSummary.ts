import { getCashAdvanceDisbursedAmount } from "@/lib/accounting/cashAdvanceAmount";

export interface OwnerAdvanceRecipient {
  id: string;
  name: string;
}

export interface OwnerAdvanceEntry {
  recipient_id: string | null;
  amount?: number | string | null;
  disbursed_amount: number | string | null;
  settled_amount: number | string | null;
  returned_amount: number | string | null;
}

export interface OwnerAdvanceSummary {
  ownerAdvances: Array<{ id: string; name: string; amount: number }>;
  totalOwnerAdvances: number;
  cashAndOwnerAdvanceReceivable: number;
}

function amountValue(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function calculateOwnerAdvanceSummary(
  currentCash: number,
  recipients: OwnerAdvanceRecipient[],
  advances: OwnerAdvanceEntry[],
): OwnerAdvanceSummary {
  const balanceByRecipient = new Map<string, number>();

  advances.forEach((advance) => {
    if (!advance.recipient_id) return;

    const principal = getCashAdvanceDisbursedAmount(
      advance.disbursed_amount,
      advance.amount,
    );
    const outstanding = Math.max(
      0,
      principal - amountValue(advance.settled_amount) - amountValue(advance.returned_amount),
    );

    balanceByRecipient.set(
      advance.recipient_id,
      (balanceByRecipient.get(advance.recipient_id) || 0) + outstanding,
    );
  });

  const ownerAdvances = recipients
    .map((recipient) => ({
      id: recipient.id,
      name: recipient.name,
      amount: balanceByRecipient.get(recipient.id) || 0,
    }))
    .filter((recipient) => recipient.amount > 0);
  const totalOwnerAdvances = ownerAdvances.reduce((total, recipient) => total + recipient.amount, 0);

  return {
    ownerAdvances,
    totalOwnerAdvances,
    cashAndOwnerAdvanceReceivable: currentCash + totalOwnerAdvances,
  };
}
