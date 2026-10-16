"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Loader2, ChevronRight, Pencil, Building2, Wallet, TrendingUp, TrendingDown, CreditCard, Briefcase } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";

interface Account {
  id: string;
  code: string;
  name: string;
  type: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "COST_OF_SALES" | "EXPENSE" | "OTHER_INCOME" | "OTHER_EXPENSE";
  normal_balance: "DEBIT" | "CREDIT";
  is_active: boolean;
  is_system: boolean;
  parent_id: string | null;
}

const accountTypeConfig = {
  ASSET: { label: "Assets", icon: Building2, color: "text-zinc-900 bg-zinc-100" },
  LIABILITY: { label: "Liabilities", icon: CreditCard, color: "text-zinc-900 bg-zinc-100" },
  EQUITY: { label: "Equity & Capital", icon: Briefcase, color: "text-zinc-900 bg-zinc-100" },
  REVENUE: { label: "Operating Revenue", icon: TrendingUp, color: "text-zinc-900 bg-zinc-100" },
  COST_OF_SALES: { label: "Cost of Goods Sold (COGS)", icon: TrendingDown, color: "text-zinc-900 bg-zinc-100" },
  EXPENSE: { label: "Operating Expenses (OPEX)", icon: TrendingDown, color: "text-zinc-900 bg-zinc-100" },
  OTHER_INCOME: { label: "Non-Operating Income", icon: TrendingUp, color: "text-zinc-900 bg-zinc-100" },
  OTHER_EXPENSE: { label: "Non-Operating Expenses", icon: TrendingDown, color: "text-zinc-900 bg-zinc-100" },
};

export default function AccountsSettingsPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [filteredAccounts, setFilteredAccounts] = useState<Account[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    type: "ASSET" as Account["type"],
    normal_balance: "DEBIT" as Account["normal_balance"],
  });
  const [isSaving, setIsSaving] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    fetchAccounts();
  }, []);

  useEffect(() => {
    let filtered = accounts;

    if (searchQuery) {
      filtered = filtered.filter(
        (acc) =>
          acc.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
          acc.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (typeFilter !== "all") {
      filtered = filtered.filter((acc) => acc.type === typeFilter);
    }

    setFilteredAccounts(filtered);
  }, [searchQuery, typeFilter, accounts]);

  const fetchAccounts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: membership } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("profile_id", user.id)
        .single();

      if (!membership) {
        router.push("/setup-organization");
        return;
      }

      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .eq("organization_id", membership.organization_id)
        .order("code");

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error("Error fetching accounts:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: membership } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("profile_id", user.id)
        .single();

      if (!membership) return;

      if (editingAccount) {
        const { error } = await supabase
          .from("accounts")
          .update({
            name: formData.name,
          })
          .eq("id", editingAccount.id)
          .eq("is_system", false);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("accounts").insert({
          organization_id: membership.organization_id,
          code: formData.code,
          name: formData.name,
          type: formData.type,
          normal_balance: formData.normal_balance,
          is_active: true,
          is_system: false,
        });

        if (error) throw error;
      }

      setShowModal(false);
      setEditingAccount(null);
      setFormData({ code: "", name: "", type: "ASSET", normal_balance: "DEBIT" });
      fetchAccounts();
    } catch (error) {
      console.error("Error saving account:", error);
      alert("Failed to save account specification");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (account: Account) => {
    if (account.is_system) {
      alert("System core accounts cannot be modified");
      return;
    }
    setEditingAccount(account);
    setFormData({
      code: account.code,
      name: account.name,
      type: account.type,
      normal_balance: account.normal_balance,
    });
    setShowModal(true);
  };

  const groupedAccounts = filteredAccounts.reduce((groups, account) => {
    const type = account.type;
    if (!groups[type]) {
      groups[type] = [];
    }
    groups[type].push(account);
    return groups;
  }, {} as Record<string, Account[]>);

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-950" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950">Chart of Accounts (COA)</h1>
          <p className="mt-1 text-xs text-zinc-500">
            Define and manage the double-entry general ledger chart of accounts for Time Travel Design
          </p>
        </div>
        <button
          onClick={() => {
            setEditingAccount(null);
            setFormData({ code: "", name: "", type: "ASSET", normal_balance: "DEBIT" });
            setShowModal(true);
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-black transition-all active:scale-95"
        >
          <Plus className="h-4 w-4" />
          Create Account
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Search by code or account title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-white py-2.5 pl-10 pr-4 text-xs focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950 transition-all"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-xs focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950"
        >
          <option value="all">All Account Classes</option>
          {Object.entries(accountTypeConfig).map(([key, config]) => (
            <option key={key} value={key}>{config.label}</option>
          ))}
        </select>
      </div>

      {/* Account Groups */}
      {Object.keys(groupedAccounts).length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center shadow-sm">
          <Wallet className="mx-auto h-12 w-12 text-zinc-300" />
          <h3 className="mt-4 text-sm font-semibold text-zinc-900">
            {searchQuery || typeFilter !== "all"
              ? "No matching accounts found"
              : "No accounts configured"}
          </h3>
          <p className="mt-1 text-xs text-zinc-400">
            {searchQuery || typeFilter !== "all"
              ? "Try adjusting your search query or filter"
              : "Add your first general ledger account to initialize the COA"}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedAccounts).map(([type, accounts]) => {
            const config = accountTypeConfig[type as keyof typeof accountTypeConfig];
            const Icon = config.icon;

            return (
              <div key={type} className="rounded-2xl border border-zinc-200 bg-white overflow-hidden shadow-sm">
                <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-100 bg-[#09090B] text-white">
                  <Icon className="h-4 w-4 text-zinc-400" />
                  <h3 className="font-bold text-sm tracking-tight text-white">{config.label}</h3>
                  <span className="text-xs text-zinc-400 font-mono">({accounts.length} accounts)</span>
                </div>
                <table className="min-w-full divide-y divide-zinc-100">
                  <thead className="bg-zinc-50/50">
                    <tr>
                      <th className="px-5 py-3 text-left text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">
                        Code
                      </th>
                      <th className="px-5 py-3 text-left text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">
                        Account Title
                      </th>
                      <th className="px-5 py-3 text-left text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">
                        Normal Balance
                      </th>
                      <th className="px-5 py-3 text-right text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {accounts.map((account) => (
                      <tr key={account.id} className="hover:bg-zinc-50/70 transition-colors">
                        <td className="px-5 py-3">
                          <span className="font-mono text-xs font-bold text-zinc-950">
                            {account.code}
                          </span>
                          {account.is_system && (
                            <span className="ml-2 rounded-md bg-zinc-100 border border-zinc-200 px-1.5 py-0.5 text-[10px] font-mono font-bold uppercase text-zinc-600">
                              System
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-xs font-semibold text-zinc-900">
                          {account.name}
                        </td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-mono font-bold ${
                            account.normal_balance === "DEBIT"
                              ? "bg-zinc-100 text-zinc-800"
                              : "bg-zinc-200 text-zinc-900"
                          }`}>
                            {account.normal_balance === "DEBIT" ? "Debit" : "Credit"}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          {!account.is_system && (
                            <button
                              onClick={() => handleEdit(account)}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-950 hover:underline"
                            >
                              <Pencil className="h-3 w-3" />
                              Edit
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-zinc-200">
            <h2 className="text-base font-bold text-zinc-950">
              {editingAccount ? "Edit Account Record" : "Create New General Ledger Account"}
            </h2>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              {!editingAccount && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500">
                    Account Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="mt-1.5 block w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-xs focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950 font-mono"
                    placeholder="e.g. 1150"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Account Title *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1.5 block w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-xs focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950"
                  placeholder="e.g. Architectural Engineering Equipment"
                />
              </div>

              {!editingAccount && (
                <>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500">
                      Account Type Classification *
                    </label>
                    <select
                      required
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as Account["type"] })}
                      className="mt-1.5 block w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-xs focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950"
                    >
                      {Object.entries(accountTypeConfig).map(([key, config]) => (
                        <option key={key} value={key}>{config.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500">
                      Normal Balance *
                    </label>
                    <select
                      required
                      value={formData.normal_balance}
                      onChange={(e) => setFormData({ ...formData, normal_balance: e.target.value as Account["normal_balance"] })}
                      className="mt-1.5 block w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-xs focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950"
                    >
                      <option value="DEBIT">Debit</option>
                      <option value="CREDIT">Credit</option>
                    </select>
                  </div>
                </>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingAccount(null);
                  }}
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2 text-xs font-semibold text-white hover:bg-black disabled:opacity-50 transition-all shadow-sm"
                >
                  {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
