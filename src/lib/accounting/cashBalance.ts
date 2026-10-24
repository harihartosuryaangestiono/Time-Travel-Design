import { createClient } from "@/lib/supabase/server";

export interface AccountBalanceResult {
  accountId: string;
  name: string;
  openingBalance: number;
  totalIn: number;
  totalOut: number;
  currentBalance: number;
}

/**
 * Menghitung saldo kas riil berdasarkan:
 * Saldo = opening_balance + seluruh pemasukan (termin proyek, transfer masuk, pelunasan kasbon)
 *         - seluruh pengeluaran (biaya operasional, pengeluaran proyek, kasbon keluar, transfer keluar, reimbursement).
 * Tidak pernah menimpa opening_balance.
 */
export async function getAccountsWithCalculatedBalance(
  organizationId: string
): Promise<AccountBalanceResult[]> {
  const supabase = await createClient();

  // 1. Ambil akun kas aktif
  const { data: accounts, error } = await supabase
    .from("cash_accounts")
    .select("id, name, opening_balance, account_number, type")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("name");

  if (error || !accounts) return [];

  // 2. Ambil pemasukan termin proyek (project_revenues)
  const { data: projectRevenues } = await supabase
    .from("project_revenues")
    .select("cash_account_id, amount")
    .eq("organization_id", organizationId);

  // 3. Ambil pembayaran invoice (invoice_payments)
  const { data: invoicePayments } = await supabase
    .from("invoice_payments")
    .select("cash_account_id, amount");

  // 4. Ambil pemasukan non-proyek yang dicatat langsung di Buku Kas
  const { data: cashReceipts } = await supabase
    .from("cash_receipts")
    .select("cash_account_id, amount")
    .eq("organization_id", organizationId);

  // 5. Ambil transfer masuk & keluar
  const { data: transfers } = await supabase
    .from("cash_transfers")
    .select("from_account_id, to_account_id, amount")
    .eq("organization_id", organizationId);

  // 6. Ambil pengeluaran yang terbayar dari akun kas (expenses)
  const { data: expenses } = await supabase
    .from("expenses")
    .select("cash_account_id, total_amount, status")
    .eq("organization_id", organizationId)
    .in("status", ["APPROVED", "POSTED"]);

  // 7. Ambil kasbon dicairkan & pengembalian (cash_advances)
  // Aturan Fase 2B: Kasbon owner yang bertanda is_opening_balance tidak mengurangi kas riil
  const { data: advances } = await supabase
    .from("cash_advances")
    .select("cash_account_id, disbursed_amount, returned_amount, status, is_opening_balance")
    .eq("organization_id", organizationId)
    .in("status", ["DISBURSED", "PARTIALLY_SETTLED", "SETTLED"]);

  // 8. Ambil reimbursement terbayar
  const { data: reimbursements } = await supabase
    .from("reimbursements")
    .select("cash_account_id, paid_amount, status")
    .eq("organization_id", organizationId)
    .eq("status", "PAID");

  const results: AccountBalanceResult[] = accounts.map((acc: any) => {
    const opening = parseFloat(acc.opening_balance || "0") || 0;
    let totalIn = 0;
    let totalOut = 0;

    // Mutasi termin proyek
    (projectRevenues || []).forEach((pr: any) => {
      if (pr.cash_account_id === acc.id) {
        totalIn += parseFloat(pr.amount || "0") || 0;
      }
    });

    // Mutasi invoice payment
    (invoicePayments || []).forEach((ip: any) => {
      if (ip.cash_account_id === acc.id) {
        totalIn += parseFloat(ip.amount || "0") || 0;
      }
    });

    (cashReceipts || []).forEach((receipt: any) => {
      if (receipt.cash_account_id === acc.id) {
        totalIn += parseFloat(receipt.amount || "0") || 0;
      }
    });

    // Mutasi transfer antar kas
    (transfers || []).forEach((t: any) => {
      const amt = parseFloat(t.amount || "0") || 0;
      if (t.to_account_id === acc.id) totalIn += amt;
      if (t.from_account_id === acc.id) totalOut += amt;
    });

    // Mutasi pengeluaran
    (expenses || []).forEach((e: any) => {
      if (e.cash_account_id === acc.id) {
        totalOut += parseFloat(e.total_amount || "0") || 0;
      }
    });

    // Mutasi kasbon operasional
    (advances || []).forEach((ca: any) => {
      if (ca.cash_account_id === acc.id) {
        if (!ca.is_opening_balance) {
          totalOut += parseFloat(ca.disbursed_amount || "0") || 0;
        }
        totalIn += parseFloat(ca.returned_amount || "0") || 0;
      }
    });

    // Mutasi reimbursement
    (reimbursements || []).forEach((r: any) => {
      if (r.cash_account_id === acc.id) {
        totalOut += parseFloat(r.paid_amount || "0") || 0;
      }
    });

    const currentBalance = opening + totalIn - totalOut;

    return {
      accountId: acc.id,
      name: acc.name,
      openingBalance: opening,
      totalIn,
      totalOut,
      currentBalance,
    };
  });

  return results;
}
