export function getCashAdvanceDisbursedAmount(
  disbursedAmount: number | string | null | undefined,
  originalAmount: number | string | null | undefined,
): number {
  const disbursed = Number(disbursedAmount ?? 0);
  if (Number.isFinite(disbursed) && disbursed > 0) return disbursed;

  const original = Number(originalAmount ?? 0);
  return Number.isFinite(original) ? original : 0;
}
