"use client";

import {
  Bell,
  LogOut,
  ChevronDown,
  Search,
  Plus,
  Receipt,
  FileText,
  Coins,
  ArrowRightLeft,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Camera,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { signOut } from "@/lib/auth/actions";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ReceiptCaptureModal } from "@/components/expenses/ReceiptCaptureModal";

interface HeaderProps {
  title?: string;
  description?: string;
  user?: {
    email?: string;
    name?: string;
    role?: string;
  };
}

const pageTitles: Record<string, { title: string; description: string }> = {
  "/dashboard": {
    title: "Executive Financial Dashboard",
    description: "Real-time liquidity, cash flow velocity, and project portfolio metrics",
  },
  "/projects": {
    title: "Project Portfolio",
    description: "Track architectural budgets, cost commitments, and gross project margins",
  },
  "/projects/clients": {
    title: "Client Directory",
    description: "Corporate client accounts, contract contacts, and project history",
  },
  "/expenses": {
    title: "Expenses & Bills",
    description: "Direct project costs, operational expenditures, and receipt records",
  },
  "/cash-advances": {
    title: "Disbursements & Cash Advances",
    description: "Site petty cash advances, team disbursements, and settlement tracking",
  },
  "/reimbursements": {
    title: "Expense Claims & Reimbursements",
    description: "Employee operational expense claims, approvals, and payout records",
  },
  "/approvals": {
    title: "Approval Center",
    description: "Multi-tier verification and authorization for expenditures and advances",
  },
  "/cash-accounts": {
    title: "Treasury & Bank Accounts",
    description: "Corporate bank balances, checking accounts, and petty cash vaults",
  },
  "/transfers": {
    title: "Internal Fund Transfers",
    description: "Multi-account liquidity rebalancing and zero-discrepancy reconciliation",
  },
  "/invoices": {
    title: "Client Billing & Invoices",
    description: "Milestone progress invoices, accounts receivable, and payment aging",
  },
  "/vendors": {
    title: "Vendors & Contractors",
    description: "Subcontractors, material suppliers, and procurement partner directory",
  },
  "/reports/income-statement": {
    title: "Income Statement (Profit & Loss)",
    description: "Revenue recognition, cost of goods sold, and net income performance",
  },
  "/reports/cash-flow": {
    title: "Statement of Cash Flows",
    description: "Operating, investing, and financing cash flow analysis",
  },
  "/reports/balance-sheet": {
    title: "Balance Sheet",
    description: "Asset position, outstanding liabilities, and total shareholder equity",
  },
  "/reports/trial-balance": {
    title: "Trial Balance",
    description: "Double-entry debit and credit verification across all ledger accounts",
  },
  "/reports/general-ledger": {
    title: "General Ledger",
    description: "Complete chronological audit trail and journal entry records",
  },
  "/settings/organization": {
    title: "Organization Profile",
    description: "Corporate entity details, legal registration, and studio branding",
  },
  "/settings/accounts": {
    title: "Chart of Accounts (COA)",
    description: "Hierarchical accounting classification and ledger account definitions",
  },
  "/settings/users": {
    title: "Team & Access Control",
    description: "Staff directory, role permissions, and financial authorization limits",
  },
};

export default function Header({
  title: propTitle,
  description: propDescription,
  user: propUser,
}: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showQuickAction, setShowQuickAction] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [userInfo, setUserInfo] = useState<{
    name: string;
    email: string;
    role: string;
  }>({
    name: propUser?.name || "Finance Director",
    email: propUser?.email || "finance@timetraveldesign.com",
    role: propUser?.role || "Owner / CFO",
  });

  const userMenuRef = useRef<HTMLDivElement>(null);
  const quickActionRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(e.target as Node)
      ) {
        setShowUserMenu(false);
      }
      if (
        quickActionRef.current &&
        !quickActionRef.current.contains(e.target as Node)
      ) {
        setShowQuickAction(false);
      }
      if (
        notificationRef.current &&
        !notificationRef.current.contains(e.target as Node)
      ) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch real user if available
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const { data: member } = await supabase
            .from("organization_members")
            .select("role, profiles(full_name)")
            .eq("profile_id", user.id)
            .single();

          const fullName =
            (member?.profiles as any)?.full_name ||
            user.user_metadata?.full_name ||
            user.email?.split("@")[0] ||
            "User";

          setUserInfo({
            name: fullName,
            email: user.email || "",
            role: member?.role || "Administrator",
          });
        }
      } catch {
        // fallback to default
      }
    };
    fetchUser();
  }, []);

  const handleLogout = async () => {
    await signOut();
    router.push("/login");
  };

  // Resolve Title and Description
  const currentRouteMeta = pageTitles[pathname] || {
    title: propTitle || "Time Travel Design Finance",
    description: propDescription || "Enterprise Accounting & Financial Management",
  };

  const pageTitle = propTitle || currentRouteMeta.title;
  const pageDesc = propDescription || currentRouteMeta.description;

  const initials = userInfo.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-zinc-200/80 bg-white/85 px-6 backdrop-blur-md transition-all">
      {/* Left: Dynamic Title */}
      <div className="flex flex-col justify-center">
        <h1 className="text-base font-bold tracking-tight text-zinc-950 md:text-lg">
          {pageTitle}
        </h1>
        <p className="hidden text-xs text-zinc-500 sm:block">
          {pageDesc}
        </p>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {/* Global Search Bar */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Search transactions, projects, invoices... (⌘K)"
            className="h-9 w-64 rounded-xl border border-zinc-200 bg-zinc-50/70 pl-9 pr-3 text-xs text-zinc-800 placeholder-zinc-400 focus:border-zinc-950 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-950/10 transition-all"
          />
        </div>

        {/* Quick Action Button */}
        <div ref={quickActionRef} className="relative">
          <button
            type="button"
            onClick={() => setShowQuickAction(!showQuickAction)}
            className="flex items-center gap-1.5 rounded-xl bg-zinc-950 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-black active:scale-95 transition-all"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Action</span>
            <ChevronDown className="h-3 w-3 opacity-80" />
          </button>

          {showQuickAction && (
            <div className="absolute right-0 top-full mt-2 w-60 rounded-2xl border border-zinc-200/90 bg-white p-2 shadow-xl ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-100 z-50">
              <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Quick Actions
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowQuickAction(false);
                  setShowScanModal(true);
                }}
                className="mb-1.5 flex w-full items-center gap-2.5 rounded-xl bg-zinc-950 px-3 py-2 text-xs font-semibold text-white hover:bg-black transition-colors"
              >
                <Camera className="h-4 w-4 text-emerald-400" />
                <span>Scan Receipt &amp; Allocate</span>
              </button>
              <Link
                href="/expenses"
                onClick={() => setShowQuickAction(false)}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 transition-colors"
              >
                <Receipt className="h-4 w-4 text-zinc-900" />
                Record New Expense
              </Link>
              <Link
                href="/invoices"
                onClick={() => setShowQuickAction(false)}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 transition-colors"
              >
                <FileText className="h-4 w-4 text-zinc-900" />
                Issue Client Invoice
              </Link>
              <Link
                href="/cash-advances"
                onClick={() => setShowQuickAction(false)}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 transition-colors"
              >
                <Coins className="h-4 w-4 text-zinc-900" />
                Request Cash Advance
              </Link>
              <Link
                href="/transfers"
                onClick={() => setShowQuickAction(false)}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 transition-colors"
              >
                <ArrowRightLeft className="h-4 w-4 text-zinc-900" />
                Transfer Funds
              </Link>
            </div>
          )}
        </div>

        {/* Notifications Popover */}
        <div ref={notificationRef} className="relative">
          <button
            type="button"
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 transition-colors"
            title="Notifications"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white ring-2 ring-white">
              3
            </span>
          </button>

          {showNotifications && (
            <div className="absolute right-0 top-full mt-2 w-80 rounded-2xl border border-zinc-200/90 bg-white shadow-2xl ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-100 z-50">
              <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
                <span className="text-xs font-bold text-zinc-900">
                  Financial Notifications
                </span>
                <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-800">
                  3 Pending
                </span>
              </div>
              <div className="divide-y divide-zinc-100 max-h-80 overflow-y-auto">
                <Link
                  href="/approvals"
                  onClick={() => setShowNotifications(false)}
                  className="flex items-start gap-3 p-3.5 hover:bg-zinc-50 transition-colors"
                >
                  <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-zinc-900">
                      Expenditure Awaiting Approval
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      Marble procurement for Villa Canggu project IDR 12,500,000
                    </p>
                    <span className="text-[10px] text-zinc-400">10 mins ago</span>
                  </div>
                </Link>

                <Link
                  href="/invoices"
                  onClick={() => setShowNotifications(false)}
                  className="flex items-start gap-3 p-3.5 hover:bg-zinc-50 transition-colors"
                >
                  <Clock className="h-4 w-4 text-rose-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-zinc-900">
                      Invoice Overdue Alert
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      INV-2024-009 PT Mega Realty (IDR 45,000,000)
                    </p>
                    <span className="text-[10px] text-zinc-400">1 day ago</span>
                  </div>
                </Link>

                <Link
                  href="/cash-advances"
                  onClick={() => setShowNotifications(false)}
                  className="flex items-start gap-3 p-3.5 hover:bg-zinc-50 transition-colors"
                >
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-zinc-900">
                      Cash Advance Settlement Ready
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      Bandung site visit operational cash advance verified
                    </p>
                    <span className="text-[10px] text-zinc-400">3 hours ago</span>
                  </div>
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Dropdown */}
        <div ref={userMenuRef} className="relative">
          <button
            type="button"
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 rounded-xl p-1 hover:bg-zinc-100 transition-colors"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-950 text-xs font-bold text-white shadow-sm ring-1 ring-black/10">
              {initials}
            </div>
            <div className="hidden text-left xl:block pr-1">
              <div className="text-xs font-bold text-zinc-900 truncate max-w-[120px]">
                {userInfo.name}
              </div>
              <div className="text-[10px] text-zinc-500 font-medium truncate">
                {userInfo.role}
              </div>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 top-full mt-2 w-60 overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-xl ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-100 z-50">
              <div className="border-b border-zinc-100 p-3.5 bg-zinc-50/50">
                <p className="text-xs font-bold text-zinc-900 truncate">
                  {userInfo.name}
                </p>
                <p className="text-[11px] text-zinc-500 truncate mt-0.5">
                  {userInfo.email}
                </p>
                <div className="mt-2 inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-900 border border-zinc-200">
                  <Sparkles className="h-3 w-3" />
                  {userInfo.role}
                </div>
              </div>

              <div className="p-1.5 space-y-0.5">
                <Link
                  href="/settings/organization"
                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 transition-colors"
                  onClick={() => setShowUserMenu(false)}
                >
                  Organization Profile
                </Link>
                <Link
                  href="/settings/users"
                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 transition-colors"
                  onClick={() => setShowUserMenu(false)}
                >
                  Team & Permissions
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Global Receipt Photo Scanner & Project Allocator ── */}
      <ReceiptCaptureModal
        isOpen={showScanModal}
        onClose={() => setShowScanModal(false)}
        onSuccess={() => {
          if (pathname === "/expenses" || pathname === "/reimbursements") {
            window.location.reload();
          }
        }}
      />
    </header>
  );
}
