"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAuthUser } from "@/lib/auth/auth";
import { PROJECT_EXPENSE_CATEGORIES } from "@/lib/accounting/expenseCategories";

export interface ProjectTransactionLine {
  id: string;
  date: string;
  description: string;
  category: string;
  debit: number; // Termin Klien
  kredit: number; // Biaya HPP
  runningBalance: number;
  worker_advance_to?: string | null;
}

export interface ProjectDetailData {
  project: {
    id: string;
    name: string;
    code: string;
    status: string;
    clientName: string;
    laborAdvanceLimit: number;
    contractValue: number;
  };
  totalReceived: number;
  totalSpent: number;
  netProfit: number;
  profitMargin: number;
  isDeficit: boolean; // Jika biaya > penerimaan
  hppBreakdown: Array<{ name: string; amount: number }>;
  uncategorizedExpenseAmount: number;
  mandorAdvances: Array<{
    id: string;
    mandorName: string;
    disbursed: number;
    settled: number;
    openBalance: number;
    status: string;
  }>;
  transactions: ProjectTransactionLine[];
}

export async function getProjectDetailData(projectId: string): Promise<ProjectDetailData> {
  const user = await requireAuthUser();
  const supabase = await createClient();

  // 1. Ambil Data Proyek
  const { data: project, error: projErr } = await supabase
    .from("projects")
    .select("id, name, code, status, contract_value, labor_advance_limit, client_id")
    .eq("id", projectId)
    .eq("organization_id", user.organizationId)
    .single();

  if (projErr || !project) {
    throw new Error("Proyek tidak ditemukan.");
  }

  const { data: client, error: clientError } = project.client_id
    ? await supabase
        .from("clients")
        .select("name")
        .eq("id", project.client_id)
        .eq("organization_id", user.organizationId)
        .maybeSingle()
    : { data: null, error: null };

  if (clientError) {
    throw new Error(`Gagal memuat data klien proyek: ${clientError.message}`);
  }

  // 2. Ambil Termin Klien (project_revenues)
  const { data: revenues } = await supabase
    .from("project_revenues")
    .select("id, date, amount, description")
    .eq("project_id", projectId)
    .eq("organization_id", user.organizationId);

  // 3. Ambil Pengeluaran Proyek (expenses langsung atau via allocation)
  const { data: directExpenses } = await supabase
    .from("expenses")
    .select("id, date, number, description, total_amount, category, needs_category")
    .eq("project_id", projectId)
    .eq("organization_id", user.organizationId)
    .in("status", ["APPROVED", "POSTED"]);

  const { data: allocatedExpenses } = await supabase
    .from("expense_allocations")
    .select("id, amount, description, expense_id")
    .eq("project_id", projectId);

  const allocatedExpenseIds = Array.from(
    new Set((allocatedExpenses || []).map((allocation) => allocation.expense_id))
  );
  const { data: allocatedExpenseDetails, error: allocatedExpenseError } = allocatedExpenseIds.length
    ? await supabase
        .from("expenses")
        .select("id, date, number, description, category, needs_category, status")
        .in("id", allocatedExpenseIds)
        .eq("organization_id", user.organizationId)
    : { data: [], error: null };

  if (allocatedExpenseError) {
    throw new Error(`Gagal memuat pengeluaran alokasi proyek: ${allocatedExpenseError.message}`);
  }
  const allocatedExpensesById = new Map(
    (allocatedExpenseDetails || []).map((expense) => [expense.id, expense])
  );

  // 4. Ambil Kasbon Mandor pada Proyek Ini
  const { data: advances } = await supabase
    .from("cash_advances")
    .select("id, mandor_name, employee_id, disbursed_amount, settled_amount, returned_amount, status")
    .eq("project_id", projectId)
    .eq("organization_id", user.organizationId);

  // Gabungkan semua pengeluaran
  const expenseMap = new Map<string, {
    id: string;
    date: string;
    description: string;
    amount: number;
    category: string;
    needs_category: boolean;
  }>();

  (directExpenses || []).forEach((e: any) => {
    expenseMap.set(e.id, {
      id: e.id,
      date: e.date,
      description: e.description,
      amount: parseFloat(e.total_amount || "0") || 0,
      category: e.category || "Perlu dikategorikan",
      needs_category: e.needs_category || !e.category,
    });
  });

  (allocatedExpenses || []).forEach((a: any) => {
    const expense = allocatedExpensesById.get(a.expense_id);
    if (expense && (expense.status === "APPROVED" || expense.status === "POSTED")) {
      expenseMap.set(a.id, {
        id: a.id,
        date: expense.date,
        description: a.description || expense.description,
        amount: parseFloat(a.amount || "0") || 0,
        category: expense.category || "Perlu dikategorikan",
        needs_category: expense.needs_category || !expense.category,
      });
    }
  });

  const categoryTotals = new Map<string, number>();
  let uncategorized = 0;

  expenseMap.forEach((e) => {
    if (e.needs_category || e.category === "Perlu dikategorikan") {
      uncategorized += e.amount;
    } else if ((PROJECT_EXPENSE_CATEGORIES as readonly string[]).includes(e.category)) {
      categoryTotals.set(e.category, (categoryTotals.get(e.category) || 0) + e.amount);
    } else if (e.category === "Bahan Baku Utama / Material") {
      categoryTotals.set("Project Material Procurement", (categoryTotals.get("Project Material Procurement") || 0) + e.amount);
    } else if (e.category === "Upah Tukang") {
      categoryTotals.set("Worker Salary", (categoryTotals.get("Worker Salary") || 0) + e.amount);
    } else if (e.category === "Sewa Alat Proyek") {
      categoryTotals.set("Rent & Utilities", (categoryTotals.get("Rent & Utilities") || 0) + e.amount);
    } else if (e.category === "Transportasi Lapangan") {
      categoryTotals.set("Project Transportation", (categoryTotals.get("Project Transportation") || 0) + e.amount);
    } else {
      uncategorized += e.amount;
    }
  });

  // Susun seluruh transaksi dalam urutan kronologis (Tanggal Naik)
  interface RawTx {
    id: string;
    date: string;
    desc: string;
    debit: number;
    kredit: number;
    category: string;
  }

  const allRaw: RawTx[] = [];

  (revenues || []).forEach((r: any) => {
    allRaw.push({
      id: r.id,
      date: r.date,
      desc: r.description,
      debit: parseFloat(r.amount || "0") || 0,
      kredit: 0,
      category: "Termin Klien",
    });
  });

  expenseMap.forEach((e) => {
    allRaw.push({
      id: e.id,
      date: e.date,
      desc: e.description,
      debit: 0,
      kredit: e.amount,
      category: e.category,
    });
  });

  allRaw.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let runningBalance = 0;
  const transactionLines: ProjectTransactionLine[] = allRaw.map((tx) => {
    runningBalance += tx.debit - tx.kredit;
    return {
      id: tx.id,
      date: tx.date ? new Date(tx.date).toISOString().split("T")[0] : "",
      description: tx.desc,
      category: tx.category,
      debit: tx.debit,
      kredit: tx.kredit,
      runningBalance,
    };
  });

  const totalReceived = (revenues || []).reduce((sum: number, r: any) => sum + (parseFloat(r.amount) || 0), 0);
  const totalSpent = Array.from(expenseMap.values()).reduce((sum, e) => sum + e.amount, 0);
  const netProfit = totalReceived - totalSpent;
  const profitMargin = totalReceived > 0 ? (netProfit / totalReceived) * 100 : 0;
  const isDeficit = totalSpent > totalReceived;

  // Kasbon Mandor
  const mandorAdvances = (advances || []).map((ca: any) => {
    const disb = parseFloat(ca.disbursed_amount || "0") || 0;
    const setl = parseFloat(ca.settled_amount || "0") || 0;
    const retn = parseFloat(ca.returned_amount || "0") || 0;
    return {
      id: ca.id,
      mandorName: ca.mandor_name || "Mandor Proyek",
      disbursed: disb,
      settled: setl + retn,
      openBalance: Math.max(0, disb - setl - retn),
      status: ca.status,
    };
  });

  return {
    project: {
      id: project.id,
      name: project.name,
      code: project.code,
      status: project.status,
      clientName: client?.name || "-",
      laborAdvanceLimit: parseFloat(project.labor_advance_limit || "0") || 0,
      contractValue: parseFloat(project.contract_value || "0") || totalReceived,
    },
    totalReceived,
    totalSpent,
    netProfit,
    profitMargin,
    isDeficit,
    hppBreakdown: PROJECT_EXPENSE_CATEGORIES.map((name) => ({
      name,
      amount: categoryTotals.get(name) || 0,
    })),
    uncategorizedExpenseAmount: uncategorized,
    mandorAdvances,
    transactions: transactionLines.reverse(), // Tampilkan transaksi terbaru di atas
  };
}
