"use client";

import { useState } from "react";
import {
  ArrowRightLeft,
  ArrowRight,
  Wallet,
  CheckCircle2,
  Calendar,
  FileText,
  AlertCircle,
  Building2,
  Plus,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { StatCard } from "@/components/ui/StatCard";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

interface TransferItem {
  id: string;
  reference: string;
  date: string;
  fromAccount: string;
  toAccount: string;
  amount: number;
  fee: number;
  notes: string;
  processedBy: string;
  status: "SUCCESS" | "PENDING";
}

const defaultTransfers: TransferItem[] = [
  {
    id: "tr-1",
    reference: "TRF-2024-0021",
    date: "2024-10-14",
    fromAccount: "BCA Corporate Checking",
    toAccount: "Studio Petty Cash Vault",
    amount: 15000000,
    fee: 0,
    notes: "Petty cash vault replenishment for field inspections and studio operations",
    processedBy: "Siti Rahma (Finance)",
    status: "SUCCESS",
  },
  {
    id: "tr-2",
    reference: "TRF-2024-0020",
    date: "2024-10-10",
    fromAccount: "Mandiri Business Treasury",
    toAccount: "BCA Corporate Checking",
    amount: 50000000,
    fee: 2500,
    notes: "Liquidity transfer from BSD project milestone billing receipt",
    processedBy: "Budi Santoso (Treasury)",
    status: "SUCCESS",
  },
  {
    id: "tr-3",
    reference: "TRF-2024-0019",
    date: "2024-10-04",
    fromAccount: "BCA Corporate Checking",
    toAccount: "Studio Petty Cash Vault",
    amount: 10000000,
    fee: 0,
    notes: "Monthly operational cash buffer top-up",
    processedBy: "Siti Rahma (Finance)",
    status: "SUCCESS",
  },
  {
    id: "tr-4",
    reference: "TRF-2024-0018",
    date: "2024-09-28",
    fromAccount: "BCA Corporate Checking",
    toAccount: "Mandiri Business Treasury",
    amount: 35000000,
    fee: 2500,
    notes: "Subcontractor escrow reserve allocation",
    processedBy: "Budi Santoso (Treasury)",
    status: "SUCCESS",
  },
];

export default function TransfersPage() {
  const [transfers, setTransfers] = useState<TransferItem[]>(defaultTransfers);
  const [showModal, setShowModal] = useState(false);
  const [fromAccount, setFromAccount] = useState("BCA Corporate Checking");
  const [toAccount, setToAccount] = useState("Studio Petty Cash Vault");
  const [amount, setAmount] = useState<string>("10000000");
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [successNotice, setSuccessNotice] = useState(false);

  const handleTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount) || 0;
    if (numAmount <= 0) return;

    const newTransfer: TransferItem = {
      id: `tr-${Date.now()}`,
      reference: `TRF-2024-00${transfers.length + 22}`,
      date: new Date().toISOString().split("T")[0],
      fromAccount,
      toAccount,
      amount: numAmount,
      fee: fromAccount !== toAccount && fromAccount.includes("Bank") && toAccount.includes("Bank") ? 2500 : 0,
      notes: notes || "Internal liquidity transfer",
      processedBy: "Finance Director",
      status: "SUCCESS",
    };

    setTransfers([newTransfer, ...transfers]);
    setShowModal(false);
    setAmount("10000000");
    setNotes("");
    setSuccessNotice(true);
    setTimeout(() => setSuccessNotice(false), 4000);
  };

  const totalTransferred = transfers.reduce((sum, t) => sum + t.amount, 0);

  const filteredTransfers = transfers.filter(
    (t) =>
      t.reference.toLowerCase().includes(search.toLowerCase()) ||
      t.notes.toLowerCase().includes(search.toLowerCase()) ||
      t.fromAccount.toLowerCase().includes(search.toLowerCase()) ||
      t.toAccount.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Success Notice */}
      {successNotice && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800 flex items-center gap-2 animate-in slide-in-from-top-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          Internal fund transfer successfully executed and account balances have been synchronized.
        </div>
      )}

      {/* Top Action & KPI */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Total Rebalanced Liquidity"
          value={formatCurrency(totalTransferred)}
          subtitle={`${transfers.length} executed transfers`}
          icon={ArrowRightLeft}
          iconBgColor="bg-emerald-500/10"
          iconColor="text-emerald-700"
        />
        <StatCard
          title="Primary Source Account"
          value="BCA Corporate"
          subtitle="Core operating liquidity pool"
          icon={Wallet}
          iconBgColor="bg-sky-500/10"
          iconColor="text-sky-700"
        />
        <div className="flex flex-col justify-between rounded-2xl border border-zinc-800 bg-[#09090B] p-5 text-white shadow-lg">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 font-mono">
              Treasury Operations
            </span>
            <h3 className="text-base font-bold mt-1">Initiate Fund Transfer</h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Replenish petty cash or rebalance funds between corporate banks
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-white py-2 px-4 text-xs font-bold text-zinc-950 hover:bg-zinc-100 active:scale-95 transition-all shadow-md"
          >
            <Plus className="h-4 w-4" />
            Execute Transfer
          </button>
        </div>
      </div>

      {/* Transfer History Table */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-100 pb-4">
          <div>
            <h3 className="text-base font-bold text-zinc-950 flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-zinc-950" />
              Internal Fund Transfers &amp; Rebalancing Audit Log
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Authorized records of liquidity transfers between company accounts
            </p>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Search reference, account, notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-64 rounded-xl border border-zinc-200 bg-zinc-50 pl-9 pr-3 text-xs text-zinc-800 placeholder-zinc-400 focus:border-zinc-950 focus:bg-white focus:outline-none"
            />
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-100 text-zinc-400 font-semibold uppercase tracking-wider text-[10px]">
                <th className="pb-3 pl-2">Transfer Ref</th>
                <th className="pb-3">Date</th>
                <th className="pb-3">Source &amp; Destination</th>
                <th className="pb-3">Purpose / Notes</th>
                <th className="pb-3">Processed By</th>
                <th className="pb-3">Status</th>
                <th className="pb-3 pr-2 text-right">Transfer Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredTransfers.map((item) => (
                <tr key={item.id} className="hover:bg-zinc-50/70 transition-colors">
                  <td className="py-3.5 pl-2 font-mono font-bold text-zinc-950 whitespace-nowrap">
                    {item.reference}
                  </td>
                  <td className="py-3.5 font-mono text-zinc-500 whitespace-nowrap">
                    {item.date}
                  </td>
                  <td className="py-3.5 whitespace-nowrap">
                    <div className="flex items-center gap-1.5 font-medium">
                      <span className="text-zinc-800">{item.fromAccount}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-zinc-400" />
                      <span className="text-zinc-950 font-bold">{item.toAccount}</span>
                    </div>
                  </td>
                  <td className="py-3.5 text-zinc-600 max-w-xs truncate">
                    {item.notes}
                  </td>
                  <td className="py-3.5 text-zinc-500 whitespace-nowrap">
                    {item.processedBy}
                  </td>
                  <td className="py-3.5 whitespace-nowrap">
                    <Badge variant="success" dot size="sm">
                      {item.status}
                    </Badge>
                  </td>
                  <td className="py-3.5 pr-2 text-right font-mono font-bold text-zinc-950 tabular-nums whitespace-nowrap">
                    {formatCurrency(item.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transfer Modal Dialog */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-100 text-zinc-950">
                  <ArrowRightLeft className="h-4 w-4" />
                </div>
                <h3 className="text-base font-bold text-zinc-950">
                  Execute Internal Fund Transfer
                </h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleTransfer} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-zinc-700 mb-1">
                  Source Account (Debit)
                </label>
                <select
                  value={fromAccount}
                  onChange={(e) => setFromAccount(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 p-2.5 text-xs text-zinc-800 focus:border-zinc-950 focus:bg-white focus:outline-none"
                >
                  <option value="BCA Corporate Checking">BCA Corporate Checking - Balance: Rp 342,000,000</option>
                  <option value="Mandiri Business Treasury">Mandiri Business Treasury - Balance: Rp 218,500,000</option>
                  <option value="Studio Petty Cash Vault">Studio Petty Cash Vault - Balance: Rp 24,000,000</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 mb-1">
                  Destination Account (Credit)
                </label>
                <select
                  value={toAccount}
                  onChange={(e) => setToAccount(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 p-2.5 text-xs text-zinc-800 focus:border-zinc-950 focus:bg-white focus:outline-none"
                >
                  <option value="Studio Petty Cash Vault">Studio Petty Cash Vault</option>
                  <option value="BCA Corporate Checking">BCA Corporate Checking</option>
                  <option value="Mandiri Business Treasury">Mandiri Business Treasury</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 mb-1">
                  Transfer Amount (IDR)
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 15000000"
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 p-2.5 font-mono text-sm font-bold text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
                  required
                />
                <div className="flex gap-2 mt-2">
                  {["5000000", "10000000", "25000000", "50000000"].map((preset) => (
                    <button
                      type="button"
                      key={preset}
                      onClick={() => setAmount(preset)}
                      className="rounded-lg bg-zinc-100 px-2 py-1 text-[10px] font-semibold text-zinc-700 hover:bg-zinc-200"
                    >
                      {formatCurrency(Number(preset))}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 mb-1">
                  Purpose &amp; Audit Reference
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Petty cash vault replenishment for studio inspections..."
                  rows={2}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 p-2.5 text-xs text-zinc-800 focus:border-zinc-950 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-zinc-950 px-4 py-2 text-xs font-bold text-white hover:bg-black active:scale-95 transition-all shadow-md"
                >
                  Confirm Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
