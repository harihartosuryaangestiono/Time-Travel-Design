export function calculateSalesCommission(contractValue: number, commissionRate: number) {
  return Math.round(contractValue * commissionRate / 100);
}
