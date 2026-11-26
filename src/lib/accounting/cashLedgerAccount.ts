export function getCashLedgerAccountCode(
  type: string,
  bankName?: string | null,
  accountName?: string | null
) {
  const label = `${bankName || ""} ${accountName || ""}`.toLowerCase();
  if (type === "BANK" && label.includes("mandiri")) return "1120";
  if (type === "BANK" && label.includes("bca")) return "1110";
  return "1100";
}
