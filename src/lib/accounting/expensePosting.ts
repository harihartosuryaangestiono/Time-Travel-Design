/**
 * TimeTravelDesign Finance - Expense Posting Service
 *
 * Handles the accounting entries for approved expenses.
 */

import { createClient } from "@/lib/supabase/server";
import { requireAuthUser } from "@/lib/auth/auth";
import { createJournal } from "./journalService";
import { revalidatePath } from "next/cache";
import { Decimal } from "decimal.js";

// Map payment method to cash account type
const PAYMENT_ACCOUNT_MAP: Record<string, string> = {
  CASH: "1100",      // Kas
  BANK_TRANSFER: "1110", // Bank BCA
  DEBIT: "1110",       // Bank
  CREDIT: "2100",      // Hutang (if tracked as credit)
};

// Get expense account mapping
const getExpenseAccountCode = (category?: string | null): string => {
  // Default to expense account based on category
  const categoryMap: Record<string, string> = {
    MATERIAL: "5100",      // Biaya Material
    LABOR: "5200",         // Biaya Tenaga Kerja
    TRANSPORT: "6400",      // Beban Transportasi
    OTHER: "6800",          // Beban Lainnya
  };

  const upperCategory = category?.toUpperCase();
  return (upperCategory && categoryMap[upperCategory]) ? categoryMap[upperCategory] : "6800";
};

// Post an approved expense to journal
export async function postExpenseToJournal(expenseId: string): Promise<{ journalId: string; journalNumber: string }> {
  const user = await requireAuthUser();
  const supabase = await createClient();

  // Get the expense with all details
  const { data: expense } = await supabase
    .from("expenses")
    .select(`
      *,
      cash_account:cash_accounts(id, code),
      allocations:expense_allocations(
        *,
        project:projects(id, code, name)
      )
    `)
    .eq("id", expenseId)
    .eq("organization_id", user.organizationId)
    .single();

  if (!expense) {
    throw new Error("Expense voucher not found");
  }

  if (expense.status !== "APPROVED") {
    throw new Error("Only authorized expenses can be posted to the general ledger");
  }

  if (expense.journal_entry_id) {
    throw new Error("Expense voucher already has an associated journal entry");
  }

  // Get accounts by code for the organization
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, code, name, type")
    .eq("organization_id", user.organizationId)
    .eq("is_active", true);

  if (!accounts || accounts.length === 0) {
    throw new Error("General ledger accounts are not configured. Contact your administrator");
  }

  // Create account lookup map
  const accountMap: Record<string, string> = {};
  for (const acc of accounts) {
    accountMap[acc.code] = acc.id;
  }

  // Build journal lines based on payment method and expense type
  const journalLines: Array<{
    account_id: string;
    debit: string;
    credit: string;
    description: string;
    project_id?: string;
  }> = [];

  const expenseAccountCode = getExpenseAccountCode(expense.category);
  const expenseAccountId = accountMap[expenseAccountCode];

  if (!expenseAccountId) {
    throw new Error(`Expense account (${expenseAccountCode}) not found`);
  }

  // Get tax account if there's tax
  const taxAccountId = accountMap["2200"]; // PPN/Hutang PPN

  // Total amounts
  const totalAmount = new Decimal(expense.total_amount);
  const taxAmount = new Decimal(expense.tax_amount || 0);
  const baseAmount = totalAmount.minus(taxAmount);

  // 1. DEBIT: Expense account (or project allocation)
  if (expense.allocations && expense.allocations.length > 0) {
    // Split by project allocation
    for (const alloc of expense.allocations) {
      journalLines.push({
        account_id: expenseAccountId,
        debit: baseAmount.toFixed(2),
        credit: "0.00",
        description: `${expense.description} - ${alloc.project?.name || "Project"}`,
        project_id: alloc.project_id,
      });
    }
  } else {
    // Single expense entry
    journalLines.push({
      account_id: expenseAccountId,
      debit: baseAmount.toFixed(2),
      credit: "0.00",
      description: expense.description,
    });
  }

  // 2. Add tax if applicable
  if (taxAmount.greaterThan(0) && taxAccountId) {
    journalLines.push({
      account_id: taxAccountId,
      debit: taxAmount.toFixed(2),
      credit: "0.00",
      description: `PPN ${expense.description}`,
    });
  }

  // 3. CREDIT: Cash/Bank account
  let creditAccountId = accountMap["1100"]; // Default to Kas
  let creditAccountCode = "1100";

  if (expense.cash_account_id) {
    // Use the specific cash account
    creditAccountId = expense.cash_account_id;
    creditAccountCode = expense.cash_account?.code || "1100";
  } else if (expense.payment_method) {
    // Try to find account by payment method
    const mappedCode = PAYMENT_ACCOUNT_MAP[expense.payment_method.toUpperCase()];
    if (mappedCode && accountMap[mappedCode]) {
      creditAccountId = accountMap[mappedCode];
      creditAccountCode = mappedCode;
    }
  }

  if (!creditAccountId) {
    throw new Error("Treasury cash or bank account not found");
  }

  journalLines.push({
    account_id: creditAccountId,
    debit: "0.00",
    credit: totalAmount.toFixed(2),
    description: `${expense.description} - ${expense.merchant || ""}`,
  });

  // Create the journal entry
  const journal = await createJournal({
    date: expense.date,
    description: `Expense ${expense.number}: ${expense.description}`,
    source_type: "EXPENSE",
    source_id: expense.id,
    lines: journalLines,
  });

  // Update expense with journal reference and status
  await supabase
    .from("expenses")
    .update({
      journal_entry_id: journal.id,
      status: "POSTED",
    })
    .eq("id", expenseId);

  // Log the posting
  await supabase.from("audit_logs").insert({
    organization_id: user.organizationId,
    actor_id: user.id,
    actor_email: user.email,
    action: "POST_EXPENSE_JOURNAL",
    entity_type: "Expense",
    entity_id: expenseId,
    metadata: {
      expense_number: expense.number,
      journal_number: journal.number,
      total_amount: expense.total_amount,
    },
  });

  revalidatePath("/expenses");
  revalidatePath(`/expenses/${expenseId}`);
  revalidatePath("/reports/general-ledger");

  return { journalId: journal.id, journalNumber: journal.number };
}

// Reverse a posted expense (creates reversing entry)
export async function reverseExpenseJournal(expenseId: string, reason: string) {
  const user = await requireAuthUser();
  const supabase = await createClient();

  // Get expense
  const { data: expense } = await supabase
    .from("expenses")
    .select("*, journal_entry_id")
    .eq("id", expenseId)
    .eq("organization_id", user.organizationId)
    .single();

  if (!expense) {
    throw new Error("Expense voucher not found");
  }

  if (expense.status !== "POSTED") {
    throw new Error("Only posted expense vouchers can be reversed");
  }

  if (!expense.journal_entry_id) {
    throw new Error("Expense voucher has no linked journal entry");
  }

  // Get the journal entry
  const { reverseJournal } = await import("./journalService");

  const result = await reverseJournal(expense.journal_entry_id, reason);

  // Update expense status
  await supabase
    .from("expenses")
    .update({ status: "REVERSED" })
    .eq("id", expenseId);

  revalidatePath("/expenses");
  revalidatePath(`/expenses/${expenseId}`);

  return result;
}
