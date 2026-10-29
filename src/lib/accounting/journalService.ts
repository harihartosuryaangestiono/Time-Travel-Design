/**
 * TimeTravelDesign Finance - Accounting Service
 *
 * Core accounting logic including journal validation, posting, and reversal.
 * All monetary calculations use safe number handling with proper rounding.
 */

import { createClient } from "@/lib/supabase/server";
import { requireAuthUser } from "@/lib/auth/auth";
import { revalidatePath } from "next/cache";

// Types
export interface JournalLineInput {
  account_id: string;
  debit?: number | string;
  credit?: number | string;
  description?: string;
  project_id?: string;
}

export interface JournalInput {
  date: string;
  description: string;
  source_type: string;
  source_id: string;
  lines: JournalLineInput[];
}

interface ReversalJournal {
  id: string;
  organization_id: string;
  number: string;
  date: string;
  description: string;
  status: string;
  lines: Array<{
    account_id: string;
    debit: number | string | null;
    credit: number | string | null;
    description: string | null;
    project_id: string | null;
  }>;
}

// Helper to safely convert to number with 2 decimal precision
function toMoney(value: number | string | undefined): number {
  if (value === undefined || value === null) return 0;
  const num = typeof value === "string" ? parseFloat(value) : value;
  return Math.round(num * 100) / 100;
}

// Validate journal balance (debit = credit)
export function validateJournalBalance(lines: JournalLineInput[]): {
  valid: boolean;
  totalDebit: number;
  totalCredit: number;
  difference: number;
} {
  let totalDebit = 0;
  let totalCredit = 0;

  for (const line of lines) {
    if (toMoney(line.debit) > 0) {
      totalDebit += toMoney(line.debit);
    }
    if (toMoney(line.credit) > 0) {
      totalCredit += toMoney(line.credit);
    }
  }

  const difference = Math.abs(totalDebit - totalCredit);
  const valid = difference < 0.01;

  return { valid, totalDebit, totalCredit, difference };
}

// Validate no negative amounts
export function validateNoNegativeAmounts(lines: JournalLineInput[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (toMoney(lines[i].debit) < 0) {
      errors.push(`Line ${i + 1}: Debit cannot be negative`);
    }
    if (toMoney(lines[i].credit) < 0) {
      errors.push(`Line ${i + 1}: Credit cannot be negative`);
    }
    if (toMoney(lines[i].debit) > 0 && toMoney(lines[i].credit) > 0) {
      errors.push(`Line ${i + 1}: Cannot specify both debit and credit on the same line`);
    }
  }
  return { valid: errors.length === 0, errors };
}

// Validate minimum 2 lines
export function validateMinimumLines(lines: JournalLineInput[]): { valid: boolean; error?: string } {
  if (lines.length < 2) {
    return { valid: false, error: "Journal entry must contain at least 2 lines" };
  }
  return { valid: true };
}

// Generate journal number
async function generateJournalNumber(supabase: any, organizationId: string): Promise<string> {
  const year = new Date().getFullYear();
  const month = (new Date().getMonth() + 1).toString().padStart(2, "0");
  const prefix = `JNL-${year}${month}-`;

  const { data: lastJournal } = await supabase
    .from("journal_entries")
    .select("number")
    .eq("organization_id", organizationId)
    .like("number", `${prefix}%`)
    .order("number", { ascending: false })
    .limit(1);

  const nextNumber = lastJournal && lastJournal.length > 0
    ? parseInt(lastJournal[0].number.split("-")[2]) + 1
    : 1;

  return `${prefix}${nextNumber.toString().padStart(4, "0")}`;
}

// Check if period is open
async function isPeriodOpen(supabase: any, organizationId: string, date: string): Promise<boolean> {
  const { data: period } = await supabase
    .from("accounting_periods")
    .select("is_closed")
    .eq("organization_id", organizationId)
    .lte("start_date", date)
    .gte("end_date", date)
    .single();

  if (!period) return true;
  return !period.is_closed;
}

// Create draft journal entry
export async function createJournal(input: JournalInput): Promise<{ id: string; number: string }> {
  const user = await requireAuthUser();
  const supabase = await createClient();

  const balanceCheck = validateJournalBalance(input.lines);
  if (!balanceCheck.valid) {
    throw new Error(
      `Journal entry is out of balance. Debit: ${balanceCheck.totalDebit}, Credit: ${balanceCheck.totalCredit}, Difference: ${balanceCheck.difference}`
    );
  }

  const negCheck = validateNoNegativeAmounts(input.lines);
  if (!negCheck.valid) {
    throw new Error(negCheck.errors.join("; "));
  }

  const linesCheck = validateMinimumLines(input.lines);
  if (!linesCheck.valid) {
    throw new Error(linesCheck.error!);
  }

  const number = await generateJournalNumber(supabase, user.organizationId);

  const { data: journal, error: journalError } = await supabase
    .from("journal_entries")
    .insert({
      organization_id: user.organizationId,
      number,
      date: input.date,
      description: input.description,
      source_type: input.source_type,
      source_id: input.source_id,
      status: "DRAFT",
      creator_id: user.profileId,
    })
    .select()
    .single();

  if (journalError) throw new Error(`Failed to create journal entry: ${journalError.message}`);

  const linesToInsert = input.lines.map((line) => ({
    journal_id: journal.id,
    account_id: line.account_id,
    debit: toMoney(line.debit).toFixed(2),
    credit: toMoney(line.credit).toFixed(2),
    description: line.description || input.description,
    project_id: line.project_id || null,
    source_type: input.source_type,
    source_id: input.source_id,
  }));

  const { error: linesError } = await supabase
    .from("journal_lines")
    .insert(linesToInsert);

  if (linesError) {
    await supabase.from("journal_entries").delete().eq("id", journal.id);
    throw new Error(`Failed to insert journal lines: ${linesError.message}`);
  }

  revalidatePath("/reports/general-ledger");
  return { id: journal.id, number };
}

// Post draft journal
export async function postJournal(journalId: string): Promise<{ success: boolean; number: string }> {
  const user = await requireAuthUser();
  const supabase = await createClient();

  const { data: journal, error: journalError } = await supabase
    .from("journal_entries")
    .select("id, number, date, status")
    .eq("id", journalId)
    .eq("organization_id", user.organizationId)
    .maybeSingle();

  if (journalError) throw new Error(`Failed to load journal entry: ${journalError.message}`);
  if (!journal) throw new Error("Journal entry not found in your organization");
  if (journal.status !== "DRAFT") throw new Error("Only draft journal entries can be posted");

  const periodOpen = await isPeriodOpen(supabase, user.organizationId, journal.date);
  if (!periodOpen) throw new Error("Accounting period is closed");

  const { data: journalLines, error: linesError } = await supabase
    .from("journal_lines")
    .select("account_id, debit, credit")
    .eq("journal_id", journalId);

  if (linesError) throw new Error(`Failed to load journal lines: ${linesError.message}`);
  if (!journalLines?.length) throw new Error("Journal entry has no lines");

  const lines = journalLines.map((line) => ({
    account_id: line.account_id,
    debit: line.debit,
    credit: line.credit,
  }));

  const balanceCheck = validateJournalBalance(lines);
  if (!balanceCheck.valid) {
    throw new Error(
      `Journal entry is out of balance. Debit: ${balanceCheck.totalDebit}, Credit: ${balanceCheck.totalCredit}`
    );
  }

  const { data: postedJournal, error: postError } = await supabase
    .from("journal_entries")
    .update({
      status: "POSTED",
      posting_date: new Date().toISOString(),
      poster_id: user.id,
      posted_at: new Date().toISOString(),
    })
    .eq("id", journalId)
    .eq("organization_id", user.organizationId)
    .eq("status", "DRAFT")
    .select("id, number")
    .maybeSingle();

  if (postError) throw new Error(`Failed to post journal entry: ${postError.message}`);
  if (!postedJournal) throw new Error("Journal entry status changed before posting. Refresh and try again.");

  await supabase.from("audit_logs").insert({
    organization_id: user.organizationId,
    actor_id: user.id,
    actor_email: user.email,
    action: "POST_JOURNAL",
    entity_type: "JournalEntry",
    entity_id: journalId,
    metadata: { journal_number: postedJournal.number },
  });

  revalidatePath("/reports/general-ledger");
  revalidatePath("/reports/trial-balance");
  revalidatePath("/reports/income-statement");
  revalidatePath("/reports/balance-sheet");
  revalidatePath("/reports/cash-flow");

  return { success: true, number: postedJournal.number };
}

// Reverse posted journal
export async function reverseJournal(
  journalId: string,
  reason: string,
  reversalDate = new Date().toISOString().split("T")[0],
  preloadedOriginal?: ReversalJournal
): Promise<{ success: boolean; reversingNumber: string }> {
  const user = await requireAuthUser();
  const supabase = await createClient();

  let original = preloadedOriginal;
  if (original) {
    if (original.id !== journalId || original.organization_id !== user.organizationId) {
      throw new Error("Jurnal transaksi tidak cocok dengan organisasi aktif.");
    }
  } else {
    const { data, error } = await supabase
      .from("journal_entries")
      .select("id, organization_id, number, date, description, status, lines:journal_lines(account_id, debit, credit, description, project_id)")
      .eq("id", journalId)
      .eq("organization_id", user.organizationId)
      .maybeSingle();

    if (error) throw new Error(`Gagal memuat jurnal untuk dibalik: ${error.message}`);
    if (!data) throw new Error("Journal entry not found");
    original = data as ReversalJournal;
  }
  if (original.status !== "POSTED") throw new Error("Only posted journal entries can be reversed");
  if (!original.lines.length) throw new Error("Jurnal tidak memiliki baris untuk dibalik.");

  const reversingLines = original.lines.map((line: any) => ({
    account_id: line.account_id,
    debit: line.credit,
    credit: line.debit,
    description: line.description,
    project_id: line.project_id,
  }));

  const reversingEntry = await createJournal({
    date: reversalDate,
    description: `Reversal: ${original.description}. Reason: ${reason}`,
    source_type: "REVERSAL",
    source_id: original.id,
    lines: reversingLines,
  });

  await supabase
    .from("journal_entries")
    .update({ status: "REVERSED", reversed_by_id: reversingEntry.id })
    .eq("id", journalId);

  await supabase
    .from("journal_entries")
    .update({ reverses_id: journalId })
    .eq("id", reversingEntry.id);

  await postJournal(reversingEntry.id);

  await supabase.from("audit_logs").insert({
    organization_id: user.organizationId,
    actor_id: user.id,
    actor_email: user.email,
    action: "REVERSE_JOURNAL",
    entity_type: "JournalEntry",
    entity_id: journalId,
    metadata: {
      original_number: original.number,
      reversing_number: reversingEntry.number,
      reason,
    },
  });

  revalidatePath("/reports/general-ledger");
  return { success: true, reversingNumber: reversingEntry.number };
}

// Get journals
export async function getJournals(filters?: {
  status?: string;
  start_date?: string;
  end_date?: string;
  source_type?: string;
}): Promise<any[]> {
  const user = await requireAuthUser();
  const supabase = await createClient();

  let query = supabase
    .from("journal_entries")
    .select(`
      *,
      lines:journal_lines(*),
      creator:profiles!creator_id(full_name, email)
    `)
    .eq("organization_id", user.organizationId)
    .order("date", { ascending: false });

  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.start_date) query = query.gte("date", filters.start_date);
  if (filters?.end_date) query = query.lte("date", filters.end_date);
  if (filters?.source_type) query = query.eq("source_type", filters.source_type);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}

// Get single journal
export async function getJournal(journalId: string): Promise<any> {
  const user = await requireAuthUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("journal_entries")
    .select(`
      *,
      lines:journal_lines(*, account:accounts(code, name),
      creator:profiles!creator_id(full_name, email),
      poster:profiles!poster_id(full_name, email)
    `)
    .eq("id", journalId)
    .eq("organization_id", user.organizationId)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

// Delete draft journal
export async function deleteJournal(journalId: string): Promise<void> {
  const user = await requireAuthUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("journal_entries")
    .delete()
    .eq("id", journalId)
    .eq("organization_id", user.organizationId)
    .eq("status", "DRAFT");

  if (error) throw new Error(`Failed to delete journal entry: ${error.message}`);
  revalidatePath("/reports/general-ledger");
}
