"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAuthUser } from "@/lib/auth/auth";

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
  hppBreakdown: {
    material: number;
    upahTukang: number;
    sewaAlat: number;
    transportasi: number;
    uncategorized: number;
  };
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
    .select(`
      id, name, code, status, contract_value, labor_advance_limit,
      client:clients!client_id(name)
    `)
    .eq("id", projectId)
    .eq("organization_id", user.organizationId)
    .single();

  if (projErr || !project) {
    throw new Error("Proyek tidak ditemukan.");
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
    .select(`
      id, amount, description,
      expense:expenses!expense_id(id, date, number, description, category, needs_category, status)
    `)
    .eq("project_id", projectId);

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
    if (a.expense && (a.expense.status === "APPROVED" || a.expense.status === "POSTED")) {
      expenseMap.set(a.id, {
        id: a.id,
        date: a.expense.date,
        description: a.description || a.expense.description,
        amount: parseFloat(a.amount || "0") || 0,
        category: a.expense.category || "Perlu dikategorikan",
        needs_category: a.expense.needs_category || !a.expense.category,
      });
    }
  });

  // HPP Breakdown
  let material = 0;
  let upahTukang = 0;
  let sewaAlat = 0;
  let transportasi = 0;
  let uncategorized = 0;

  expenseMap.forEach((e) => {
    if (e.needs_category || e.category === "Perlu dikategorikan") {
      uncategorized += e.amount;
    } else if (e.category === "Bahan Baku Utama / Material") {
      material += e.amount;
    } else if (e.category === "Upah Tukang") {
      upahTukang += e.amount;
    } else if (e.category === "Sewa Alat Proyek") {
      sewaAlat += e.amount;
    } else if (e.category === "Transportasi Lapangan") {
      transportasi += e.amount;
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

  const clientObj = project.client as unknown as { name?: string } | Array<{ name?: string }> | null;
  const clientName = (Array.isArray(clientObj) ? clientObj[0]?.name : clientObj?.name) || "-";

  return {
    project: {
      id: project.id,
      name: project.name,
      code: project.code,
      status: project.status,
      clientName,
      laborAdvanceLimit: parseFloat(project.labor_advance_limit || "0") || 0,
      contractValue: parseFloat(project.contract_value || "0") || totalReceived,
    },
    totalReceived,
    totalSpent,
    netProfit,
    profitMargin,
    isDeficit,
    hppBreakdown: {
      material,
      upahTukang,
      sewaAlat,
      transportasi,
      uncategorized,
    },
    mandorAdvances,
    transactions: transactionLines.reverse(), // Tampilkan transaksi terbaru di atas
  };
}
