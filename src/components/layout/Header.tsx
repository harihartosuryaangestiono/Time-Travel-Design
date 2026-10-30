"use client";

import Image from "next/image";
import {
  Bell,
  LogOut,
  ChevronDown,
  Search,
  Plus,
  Receipt,
  FileText,
  Coins,
  Sparkles,
  Menu,
  UserRound,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { signOut } from "@/lib/auth/actions";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface HeaderProps {
  title?: string;
  description?: string;
  user?: {
    email?: string;
    name?: string;
    role?: string;
  };
  onOpenMobileMenu?: () => void;
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
  "/cash-advances": {
    title: "Disbursements & Cash Advances",
    description: "Site petty cash advances, team disbursements, and settlement tracking",
  },
  "/subcontractor-recap": {
    title: "Rekapitulasi Subkontraktor",
    description: "Nilai borongan, pembayaran, dan sisa per proyek dan subkontraktor",
  },
  "/subcontractors": {
    title: "Data Subkontraktor",
    description: "Direktori khusus subkontraktor untuk data borongan proyek",
  },
  "/reports/project-recap": {
    title: "Rekapitulasi per Proyek",
    description: "Pendapatan dan biaya keuangan untuk setiap proyek",
  },
  "/reimbursements": {
    title: "Expense Claims & Reimbursements",
    description: "Employee operational expense claims, approvals, and payout records",
  },
  "/cash-accounts": {
    title: "Treasury & Bank Accounts",
    description: "Corporate bank balances, checking accounts, and petty cash vaults",
  },
  "/invoices": {
    title: "Client Billing & Invoices",
    description: "Milestone progress invoices, accounts receivable, and payment aging",
  },
  "/vendors": {
    title: "Vendors & Suppliers",
    description: "Material suppliers and procurement partner directory",
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
    title: "My Profile",
    description: "Update your name, profile picture, and account password",
  },
};

export default function Header({
  title: propTitle,
  description: propDescription,
  user: propUser,
  onOpenMobileMenu,
}: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const reducedMotion = useReducedMotion();

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showQuickAction, setShowQuickAction] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [userInfo, setUserInfo] = useState<{
    name: string;
    email: string;
    role: string;
    avatarUrl?: string;
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
            .select("role")
            .eq("profile_id", user.id)
            .maybeSingle();
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, avatar_url")
            .eq("id", user.id)
            .maybeSingle();

          const fullName =
            profile?.full_name ||
            user.user_metadata?.full_name ||
            user.email?.split("@")[0] ||
            "User";

          setUserInfo({
            name: fullName,
            email: user.email || "",
            role: member?.role || "Administrator",
            avatarUrl: profile?.avatar_url || undefined,
          });
        }
      } catch {
        // fallback to default
      }
    };
    void fetchUser();
    window.addEventListener("profile-updated", fetchUser);
    return () => window.removeEventListener("profile-updated", fetchUser);
  }, []);

  const handleLogout = async () => {
    await signOut();
    router.push("/login");
  };

  // Resolve Title and Description
  const currentRouteMeta = pageTitles[pathname] ||
    (pathname.startsWith("/reports/project-recap/") ? pageTitles["/reports/project-recap"] : null) || {
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
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-zinc-200/70 bg-white/75 px-4 shadow-[0_8px_24px_-24px_rgba(9,9,11,0.5)] backdrop-blur-xl transition-all sm:px-6">
      {/* Left: Hamburger Button (Mobile/Tablet) + Dynamic Title */}
      <div className="flex items-center gap-3">
        {onOpenMobileMenu && (
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="flex lg:hidden h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 transition-colors focus:outline-none"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}

        <div className="flex flex-col justify-center min-w-0">
          <h1 className="text-sm font-bold tracking-tight text-zinc-950 sm:text-base md:text-lg truncate max-w-[200px] sm:max-w-xs md:max-w-md">
            {pageTitle}
          </h1>
          <p className="hidden text-xs text-zinc-500 sm:block truncate max-w-md">
            {pageDesc}
          </p>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {/* Global Search Bar */}
        <div className="relative hidden w-64 transition-[width] duration-300 ease-premium focus-within:w-80 md:block">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Search transactions, projects, invoices... (⌘K)"
            className="h-9 w-full rounded-dashboard-control border border-zinc-200/80 bg-zinc-50/70 pl-9 pr-3 text-xs text-zinc-800 placeholder-zinc-400 transition-all focus:border-emerald-500/50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/10"
          />
        </div>

        {/* Quick Action Button */}
        <div ref={quickActionRef} className="relative">
          <motion.button
            type="button"
            onClick={() => setShowQuickAction(!showQuickAction)}
            whileHover={reducedMotion ? undefined : { y: -2, scale: 1.025 }}
            whileTap={reducedMotion ? undefined : { scale: 0.97 }}
            transition={{ type: "spring", stiffness: 420, damping: 24 }}
            className="dashboard-action-button relative flex items-center gap-1.5 overflow-hidden rounded-dashboard-control bg-zinc-950 px-3.5 py-2 text-xs font-semibold text-white shadow-[0_8px_20px_-12px_rgba(9,9,11,0.8)] transition-colors hover:bg-black"
          >
            <Plus className="relative z-10 h-4 w-4" />
            <span className="relative z-10 hidden sm:inline">New Action</span>
            <ChevronDown className="relative z-10 h-3 w-3 opacity-80" />
          </motion.button>

          {showQuickAction && (
            <div className="absolute right-0 top-full mt-2 w-60 rounded-2xl border border-zinc-200/90 bg-white p-2 shadow-xl ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-100 z-50">
              <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Quick Actions
              </div>
              <Link
                href="/cash-book"
                onClick={() => setShowQuickAction(false)}
                className="mb-1.5 flex items-center gap-2.5 rounded-xl bg-zinc-950 px-3 py-2 text-xs font-semibold text-white hover:bg-black transition-colors"
              >
                <Receipt className="h-4 w-4 text-emerald-400" />
                Catat Transaksi Kas
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
            aria-label="Notifikasi"
          >
            <Bell className="h-4 w-4" />
          </button>

          {showNotifications && (
            <div className="absolute right-0 top-full mt-2 w-80 rounded-2xl border border-zinc-200/90 bg-white shadow-2xl ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-100 z-50">
              <div className="border-b border-zinc-100 px-4 py-3">
                <span className="text-xs font-bold text-zinc-900">Notifikasi</span>
              </div>
              <div className="px-4 py-8 text-center text-xs text-zinc-500">
                Belum ada notifikasi.
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
            <div className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-zinc-950 text-xs font-bold text-white shadow-sm ring-1 ring-black/10">
              {userInfo.avatarUrl ? (
                <Image
                  src={userInfo.avatarUrl}
                  alt=""
                  fill
                  unoptimized
                  className="object-cover"
                  sizes="36px"
                />
              ) : (
                initials || <UserRound className="h-4 w-4" />
              )}
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
                  <UserRound className="h-3.5 w-3.5" />
                  My Profile
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

    </header>
  );
}
