"use client";

import { useState } from "react";
import { Download, Printer, Filter, BookOpen } from "lucide-react";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

interface LedgerLine {
  id: string;
  entry_number: string;
  date: string;
  description: string;
  reference?: string;
  debit: number;
  credit: number;
  balance: number;
}

interface AccountLedger {
  account_id: string;
  account_code: string;
  account_name: string;
  opening_balance: number;
  closing_balance: number;
  total_debit: number;
  total_credit: number;
  lines: LedgerLine[];
}

const defaultLedgerData: AccountLedger[] = [
  {
    account_id: "1",
    account_code: "1120",
    account_name: "BCA Operating & Treasury Account",
    opening_balance: 280000000,
    closing_balance: 342000000,
    total_debit: 220000000,
    total_credit: 158000000,
    lines: [
      {
        id: "l1",
        entry_number: "JE-2024-0089",
        date: "2024-10-02",
        description: "Client Retainer Milestone 1 - PRJ-24-002 Cafe Senopati",
        reference: "INV-2024-0012",
        debit: 84000000,
        credit: 0,
        balance: 364000000,
      },
      {
        id: "l2",
        entry_number: "JE-2024-0091",
        date: "2024-10-05",
        description: "Direct Disbursement: MEP Engineering Subcontractor",
        reference: "EXP-2024-0045",
        debit: 0,
        credit: 22000000,
        balance: 342000000,
      },
      {
        id: "l3",
        entry_number: "JE-2024-0095",
        date: "2024-10-10",
        description: "Progress Billing Payment - PRJ-24-003 BSD Masterplan",
        reference: "INV-2024-0015",
        debit: 136000000,
        credit: 0,
        balance: 478000000,
      },
      {
        id: "l4",
        entry_number: "JE-2024-0099",
        date: "2024-10-12",
        description: "Natural Stone Procurement - PRJ-24-001 Villa Canggu",
        reference: "EXP-2024-0052",
        debit: 0,
        credit: 136000000,
        balance: 342000000,
      },
    ],
  },
  {
    account_id: "2",
    account_code: "1210",
    account_name: "Accounts Receivable & Unbilled Client WIP",
    opening_balance: 65000000,
    closing_balance: 98000000,
    total_debit: 185000000,
    total_credit: 152000000,
    lines: [
      {
        id: "l5",
        entry_number: "JE-2024-0088",
        date: "2024-10-01",
        description: "Progress Invoice Issued - PRJ-24-003 BSD Masterplan",
        reference: "INV-2024-0015",
        debit: 156000000,
        credit: 0,
        balance: 221000000,
      },
      {
        id: "l6",
        entry_number: "JE-2024-0094",
        date: "2024-10-10",
        description: "Settlement Received - PRJ-24-003 BSD Masterplan",
        reference: "PAY-2024-0021",
        debit: 0,
        credit: 152000000,
        balance: 69000000,
      },
      {
        id: "l7",
        entry_number: "JE-2024-0098",
        date: "2024-10-14",
        description: "Initial Design Retainer Billed - PRJ-24-005 Ubud Resort",
        reference: "INV-2024-0018",
        debit: 29000000,
        credit: 0,
        balance: 98000000,
      },
    ],
  },
];

export default function GeneralLedgerPage() {
  const [startDate, setStartDate] = useState(() => `${new Date().getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [selectedAccount, setSelectedAccount] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<AccountLedger[]>(defaultLedgerData);

  const handleGenerate = () => {
    setIsLoading(true);
    setTimeout(() => {
      setData(defaultLedgerData);
      setIsLoading(false);
    }, 400);
  };

  const filteredData =
    selectedAccount === "all"
      ? data
      : data.filter((d) => d.account_code === selectedAccount);

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Filter and Action Header */}
      <div className="flex flex-col gap-4 rounded-3xl border border-zinc-200/90 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-zinc-500 uppercase">Period:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-9 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs text-zinc-800 focus:border-zinc-900 focus:bg-white focus:outline-none"
            />
            <span className="text-xs text-zinc-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-9 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs text-zinc-800 focus:border-zinc-900 focus:bg-white focus:outline-none"
            />
          </div>

          <select
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
            className="h-9 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs text-zinc-800 focus:border-zinc-900 focus:bg-white focus:outline-none"
          >
            <option value="all">All General Ledger Accounts</option>
            <option value="1120">1120 - BCA Operating &amp; Treasury</option>
            <option value="1210">1210 - Accounts Receivable &amp; WIP</option>
          </select>

          <button
            onClick={handleGenerate}
            disabled={isLoading}
            className="flex items-center gap-1.5 rounded-xl bg-zinc-950 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-zinc-800 active:scale-95 transition-all disabled:opacity-50"
          >
            <Filter className="h-3.5 w-3.5" />
            {isLoading ? "Generating..." : "Apply Filter"}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors shadow-sm"
          >
            <Printer className="h-3.5 w-3.5 text-zinc-500" />
            Print PDF
          </button>
          <button className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors shadow-sm">
            <Download className="h-3.5 w-3.5 text-zinc-900" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Ledgers per Account */}
      <div className="space-y-6">
        {filteredData.map((ledger) => (
          <div
            key={ledger.account_id}
            className="rounded-3xl border border-zinc-200/90 bg-white shadow-sm overflow-hidden"
          >
            {/* Account Title Strip */}
            <div className="border-b border-zinc-100 bg-[#09090B] p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-white">
              <div>
                <span className="font-mono text-xs font-bold text-zinc-300 mr-2 bg-zinc-800 border border-zinc-700 px-2.5 py-0.5 rounded">
                  {ledger.account_code}
                </span>
                <h3 className="inline text-base font-bold text-white tracking-tight">
                  {ledger.account_name}
                </h3>
              </div>
              <div className="flex items-center gap-4 text-xs font-mono">
                <div>
                  <span className="text-zinc-400 block text-[10px] uppercase font-sans font-semibold">
                    Opening Balance
                  </span>
                  <span className="font-bold text-zinc-300">{formatCurrency(ledger.opening_balance)}</span>
                </div>
                <div>
                  <span className="text-zinc-400 block text-[10px] uppercase font-sans font-semibold">
                    Closing Balance
                  </span>
                  <span className="font-bold text-white">{formatCurrency(ledger.closing_balance)}</span>
                </div>
              </div>
            </div>

            {/* Account Transactions Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 uppercase tracking-wider text-[10px] font-mono">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-bold">Posting Date</th>
                    <th className="px-4 py-2.5 text-left font-bold">Journal Ref</th>
                    <th className="px-4 py-2.5 text-left font-bold">Transaction Narration</th>
                    <th className="px-4 py-2.5 text-left font-bold">Source Ref</th>
                    <th className="px-4 py-2.5 text-right font-bold">Debit (+)</th>
                    <th className="px-4 py-2.5 text-right font-bold">Credit (-)</th>
                    <th className="px-4 py-2.5 text-right font-bold">Running Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {ledger.lines.map((line) => (
                    <tr key={line.id} className="hover:bg-zinc-50/70 transition-colors">
                      <td className="px-4 py-2.5 font-mono text-zinc-500 whitespace-nowrap">
                        {line.date}
                      </td>
                      <td className="px-4 py-2.5 font-mono font-semibold text-zinc-800 whitespace-nowrap">
                        {line.entry_number}
                      </td>
                      <td className="px-4 py-2.5 text-zinc-900 font-medium">
                        {line.description}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-zinc-400 whitespace-nowrap">
                        {line.reference || "-"}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-zinc-950 font-semibold whitespace-nowrap">
                        {line.debit > 0 ? formatCurrency(line.debit) : "-"}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-rose-600 font-semibold whitespace-nowrap">
                        {line.credit > 0 ? formatCurrency(line.credit) : "-"}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums font-bold text-zinc-900 whitespace-nowrap">
                        {formatCurrency(line.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t bg-zinc-50/80 font-bold text-xs">
                  <tr>
                    <td colSpan={4} className="px-4 py-2.5 text-right text-zinc-500 uppercase font-mono tracking-wider">
                      Account Total Postings
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-zinc-950">
                      {formatCurrency(ledger.total_debit)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-rose-600">
                      {formatCurrency(ledger.total_credit)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-zinc-900">
                      {formatCurrency(ledger.closing_balance)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
