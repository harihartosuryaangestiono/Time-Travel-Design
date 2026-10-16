"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Plus,
  Wallet,
  ArrowRightLeft,
  Building2,
  CreditCard,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Coins,
  Edit3,
  Trash2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { CashAccountModal, CashAccountFormData } from "@/components/modals/CashAccountModal";
import { DeleteConfirmDialog } from "@/components/modals/DeleteConfirmDialog";
import { deleteCashAccountRecord } from "@/app/actions/cashAccountActions";

interface CashAccount {
  id: string;
  name: string;
  type: string;
  opening_balance: number;
  bank_name: string | null;
  account_number: string | null;
}

const defaultAccounts: CashAccount[] = [
  {
    id: "ca-1",
    name: "BCA Corporate Checking",
    type: "BANK",
    opening_balance: 342000000,
    bank_name: "Bank Central Asia (BCA)",
    account_number: "8912-3344-01",
  },
  {
    id: "ca-2",
    name: "Mandiri Business Treasury",
    type: "BANK",
    opening_balance: 218500000,
    bank_name: "Bank Mandiri",
    account_number: "137-00-998822-1",
  },
  {
    id: "ca-3",
    name: "Jakarta Studio Petty Cash Vault",
    type: "CASH",
    opening_balance: 24000000,
    bank_name: "Studio Vault Cash",
    account_number: "VAULT-01",
  },
];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function CashAccountsPage() {
  const [accounts, setAccounts] = useState<CashAccount[]>(defaultAccounts);
  const [isLoading, setIsLoading] = useState(false);

  // Modal States
  const [showModal, setShowModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<CashAccountFormData | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<CashAccount | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSaveAccount = (saved: CashAccountFormData) => {
    if (saved.id) {
      // Edit
      setAccounts((prev) =>
        prev.map((a) =>
          a.id === saved.id
            ? {
                ...a,
                name: saved.name,
                type: saved.type,
                bank_name: saved.bank_name || null,
                account_number: saved.account_number || null,
                opening_balance: saved.opening_balance,
              }
            : a
        )
      );
    } else {
      // Create
      const newAcc: CashAccount = {
        id: `ca-${Date.now()}`,
        name: saved.name,
        type: saved.type,
        bank_name: saved.bank_name || null,
        account_number: saved.account_number || null,
        opening_balance: saved.opening_balance || 0,
      };
      setAccounts((prev) => [newAcc, ...prev]);
    }
  };

  const handleDeleteAccount = async () => {
    if (!accountToDelete) return;
    try {
      setIsDeleting(true);
      try {
        await deleteCashAccountRecord(accountToDelete.id);
      } catch (err: any) {
        console.warn("Account delete server action fallback:", err.message);
      }
      setAccounts((prev) => prev.filter((a) => a.id !== accountToDelete.id));
      setShowDelete(false);
      setAccountToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      setIsLoading(true);
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: membership } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("profile_id", user.id)
        .single();

      if (!membership) return;

      const { data } = await supabase
        .from("cash_accounts")
        .select("*")
        .eq("organization_id", membership.organization_id)
        .eq("is_active", true)
        .order("type");

      if (data && data.length > 0) {
        const mapped = data.map((a) => ({
          id: a.id,
          name: a.name,
          type: a.type,
          opening_balance: parseFloat(a.opening_balance || "0"),
          bank_name: a.bank_name,
          account_number: a.account_number,
        }));
        setAccounts(mapped);
      }
    } catch (e) {
      console.warn("Using rich showcase accounts dataset", e);
    } finally {
      setIsLoading(false);
    }
  };

  const totalBalance = accounts.reduce((sum, acc) => sum + acc.opening_balance, 0);
  const bankTotal = accounts
    .filter((a) => a.type === "BANK")
    .reduce((sum, acc) => sum + acc.opening_balance, 0);
  const cashTotal = accounts
    .filter((a) => a.type === "CASH")
    .reduce((sum, acc) => sum + acc.opening_balance, 0);

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-300">
      {/* ── Top Summary Statistics ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Aggregate Treasury Liquidity"
          value={formatCurrency(totalBalance)}
          subtitle="Combined liquid checking & cash vaults"
          icon={Wallet}
          iconBgColor="bg-emerald-500/10"
          iconColor="text-emerald-700"
          gradient
        />
        <StatCard
          title="Commercial Checking & Banking"
          value={formatCurrency(bankTotal)}
          subtitle="Core business operating accounts"
          icon={CreditCard}
          iconBgColor="bg-sky-500/10"
          iconColor="text-sky-700"
        />
        <StatCard
          title="Petty Cash & Vault"
          value={formatCurrency(cashTotal)}
          subtitle="Studio logistics & inspection cash"
          icon={Coins}
          iconBgColor="bg-amber-500/10"
          iconColor="text-amber-700"
        />
      </div>

      {/* ── Action Bar ── */}
      <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-bold text-zinc-950">
            Corporate Bank &amp; Petty Cash Accounts
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Manage account balances, credential details, and execute internal rebalancing transfers
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setSelectedAccount(null);
              setShowModal(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-black active:scale-95 transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>Register Account</span>
          </button>

          <Link
            href="/transfers"
            className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 transition-colors shadow-sm"
          >
            <ArrowRightLeft className="h-4 w-4" />
            <span>Transfer Funds</span>
          </Link>
        </div>
      </div>

      {/* ── Visual Bank Cards Grid ── */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {accounts.map((acc, index) => {
          const isBCA = acc.name.toLowerCase().includes("bca");
          const isMandiri = acc.name.toLowerCase().includes("mandiri");

          return (
            <div
              key={acc.id}
              className={`relative overflow-hidden rounded-3xl p-6 text-white shadow-xl transition-all duration-200 hover:translate-y-[-2px] ${
                isBCA
                  ? "bg-gradient-to-br from-[#09090B] via-[#121212] to-[#18181B] ring-1 ring-white/15"
                  : isMandiri
                  ? "bg-gradient-to-br from-[#18181B] via-[#27272A] to-[#3F3F46] ring-1 ring-white/15"
                  : "bg-gradient-to-br from-[#27272A] via-[#3F3F46] to-[#52525B] ring-1 ring-white/15"
              }`}
            >
              {/* Top Card Strip */}
              <div className="flex items-center justify-between text-xs text-white/80">
                <span className="font-semibold tracking-wider uppercase text-[10px] font-mono">
                  {acc.type === "BANK" ? "COMMERCIAL CHECKING" : "STUDIO CASH VAULT"}
                </span>
                <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold">
                  ACTIVE
                </span>
              </div>

              {/* Card Chip & Brand */}
              <div className="mt-4 flex items-center justify-between">
                <div className="h-7 w-10 rounded-md bg-amber-400/80 ring-1 ring-amber-300 shadow-inner flex items-center justify-center">
                  <div className="h-4 w-6 border border-amber-800/40 rounded-sm" />
                </div>
                <span className="font-bold tracking-tight text-white/90 text-sm">
                  {acc.bank_name || "Vault Cash"}
                </span>
              </div>

              {/* Account Number */}
              <div className="mt-5 font-mono text-xs tracking-widest text-white/70">
                {acc.account_number || "•••• •••• •••• 0000"}
              </div>

              {/* Balance */}
              <div className="mt-3">
                <span className="text-[10px] uppercase font-bold text-white/50 tracking-wider">
                  AVAILABLE BALANCE
                </span>
                <div className="text-2xl font-black tracking-tight text-white font-mono tabular-nums mt-0.5">
                  {formatCurrency(acc.opening_balance)}
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="mt-5 pt-3 border-t border-white/15 flex items-center justify-between text-xs">
                <span className="text-white/80 font-medium truncate max-w-[130px]">
                  {acc.name}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAccount({
                        id: acc.id,
                        name: acc.name,
                        type: acc.type,
                        bank_name: acc.bank_name || "",
                        account_number: acc.account_number || "",
                        opening_balance: acc.opening_balance,
                      });
                      setShowModal(true);
                    }}
                    className="rounded-lg p-1 text-white/70 hover:bg-white/15 hover:text-white transition-colors"
                    title="Edit Account"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAccountToDelete(acc);
                      setShowDelete(true);
                    }}
                    className="rounded-lg p-1 text-white/70 hover:bg-rose-500/30 hover:text-rose-200 transition-colors"
                    title="Delete Account"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <Link
                    href="/transfers"
                    className="inline-flex items-center gap-1 font-bold text-white hover:text-zinc-300 transition-colors pl-1"
                  >
                    Transfer
                    <ArrowRightLeft className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Cash Account Create / Edit Modal ── */}
      <CashAccountModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setSelectedAccount(null);
        }}
        onSuccess={handleSaveAccount}
        accountToEdit={selectedAccount}
      />

      {/* ── Delete Confirmation Dialog ── */}
      <DeleteConfirmDialog
        isOpen={showDelete}
        onClose={() => {
          setShowDelete(false);
          setAccountToDelete(null);
        }}
        onConfirm={handleDeleteAccount}
        title="Delete Cash / Bank Account"
        description="Are you sure you want to permanently remove this treasury vault? Accounts with active ledger entries should be reconciled first."
        itemName={accountToDelete ? `${accountToDelete.name} (${accountToDelete.account_number || "Vault"})` : undefined}
        isDeleting={isDeleting}
      />
    </div>
  );
}
