import { createClient } from "@/lib/supabase/server";
import { requireAuthUser } from "@/lib/auth/auth";
import { EXCEL_CATEGORY_TO_ACCOUNT_CODE } from "@/lib/accounting/defaultCoa";
import { createJournal, postJournal } from "@/lib/accounting/journalService";

export interface CashBookJournalInput {
  sourceType:
    | "CASH_BOOK_EXPENSE"
    | "PROJECT_REVENUE"
    | "CASH_RECEIPT"
    | "INVOICE_PAYMENT"
    | "CASH_OPENING_BALANCE";
  sourceId: string;
  date: string;
  description: string;
  amount: number;
  category?: string | null;
  transactionType: "INCOME" | "EXPENSE" | "INVOICE_PAYMENT" | "OPENING_BALANCE";
  cashAccountId: string;
  cashAccountType: "CASH" | "BANK" | "E_WALLET" | "OTHER";
  cashAccountName?: string;
  bankName?: string | null;
  projectId?: string | null;
}

function getAccountCodes(input: CashBookJournalInput) {
  const accountLabel = `${input.bankName || ""} ${input.cashAccountName || ""}`.toLowerCase();
  let cashCode: string;
  if (input.cashAccountType === "CASH") {
    cashCode = "1100";
  } else if (input.cashAccountType === "BANK" && accountLabel.includes("mandiri")) {
    cashCode = "1120";
  } else if (input.cashAccountType === "BANK" && accountLabel.includes("bca")) {
    cashCode = "1110";
  } else {
    cashCode = "1100";
  }

  if (input.transactionType === "EXPENSE") {
    return {
      cashCode,
      offsetCode: (input.category && EXCEL_CATEGORY_TO_ACCOUNT_CODE[input.category]) || "6800",
    };
  }

  if (input.transactionType === "INVOICE_PAYMENT") {
    return { cashCode, offsetCode: "1200" };
  }
  if (input.transactionType === "OPENING_BALANCE") {
    return { cashCode, offsetCode: "3100" };
  }

  const categoryCode: Record<string, string> = {
    "Setoran Modal": "3100",
    "Bunga Bank": "4400",
    "Pendapatan Proyek": "4100",
    "Pemasukan Lainnya": "4300",
  };
  return {
    cashCode,
    offsetCode: input.sourceType === "PROJECT_REVENUE"
      ? "4100"
      : categoryCode[input.category || ""] || "4300",
  };
}

export async function postCashBookEntryToJournal(input: CashBookJournalInput) {
  const user = await requireAuthUser();
  const supabase = await createClient();
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Nominal transaksi harus lebih dari nol untuk diposting ke buku besar.");
  }

  const { data: existing, error: existingError } = await supabase
    .from("journal_entries")
    .select("id, number, status")
    .eq("organization_id", user.organizationId)
    .eq("source_type", input.sourceType)
    .eq("source_id", input.sourceId)
    .in("status", ["DRAFT", "POSTED"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingError) throw new Error(`Gagal memeriksa jurnal transaksi: ${existingError.message}`);
  if (existing?.status === "POSTED") return { id: existing.id, number: existing.number };
  if (existing) {
    const posted = await postJournal(existing.id);
    return { id: existing.id, number: posted.number };
  }

  const { cashCode, offsetCode } = getAccountCodes(input);
  const { data: accounts, error: accountsError } = await supabase
    .from("accounts")
    .select("id, code")
    .eq("organization_id", user.organizationId)
    .eq("is_active", true)
    .in("code", [cashCode, offsetCode]);
  if (accountsError) throw new Error(`Gagal memuat akun buku besar: ${accountsError.message}`);

  const accountIds = new Map((accounts || []).map((account) => [account.code, account.id]));
  const cashAccountId = accountIds.get(cashCode);
  const offsetAccountId = accountIds.get(offsetCode);
  if (!cashAccountId || !offsetAccountId) {
    const missing = [
      !cashAccountId ? `${cashCode} (kas/bank)` : null,
      !offsetAccountId ? `${offsetCode} (kategori transaksi)` : null,
    ].filter(Boolean);
    throw new Error(`Akun buku besar ${missing.join(" dan ")} belum tersedia atau tidak aktif.`);
  }

  const cashIsDebit = input.transactionType !== "EXPENSE";
  const lines = [
    {
      account_id: cashIsDebit ? cashAccountId : offsetAccountId,
      debit: cashIsDebit ? amount : 0,
      credit: cashIsDebit ? 0 : amount,
      description: input.description,
      project_id: cashIsDebit ? undefined : input.projectId || undefined,
    },
    {
      account_id: cashIsDebit ? offsetAccountId : cashAccountId,
      debit: cashIsDebit ? 0 : amount,
      credit: cashIsDebit ? amount : 0,
      description: input.description,
      project_id: cashIsDebit ? input.projectId || undefined : undefined,
    },
  ];

  const journal = await createJournal({
    date: input.date,
    description: input.description,
    source_type: input.sourceType,
    source_id: input.sourceId,
    lines,
  });

  try {
    await postJournal(journal.id);
  } catch (error) {
    const { error: linesDeleteError } = await supabase
      .from("journal_lines")
      .delete()
      .eq("journal_id", journal.id);
    const { error: journalDeleteError } = await supabase
      .from("journal_entries")
      .delete()
      .eq("id", journal.id)
      .eq("organization_id", user.organizationId)
      .eq("status", "DRAFT");
    if (linesDeleteError || journalDeleteError) {
      throw new Error(
        `Gagal memposting jurnal: ${error instanceof Error ? error.message : "kesalahan tidak diketahui"}. Pembersihan jurnal Draft juga gagal: ${linesDeleteError?.message || journalDeleteError?.message}`
      );
    }
    throw error;
  }

  return journal;
}
