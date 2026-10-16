"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  Receipt,
  CheckSquare,
  Wallet,
  ArrowRightLeft,
  Coins,
  FileCheck,
  Building2,
  FileText,
  BarChart3,
  TrendingUp,
  Scale,
  BookOpen,
  ChevronRight,
  ChevronDown,
  ShieldCheck,
  Building,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandIconSvg } from "@/components/ui/BrandLogo";

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
  badgeVariant?: "white" | "amber" | "rose" | "neutral";
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navigationGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { name: "Executive Dashboard", href: "/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Projects & Clients",
    items: [
      { name: "Project Portfolio", href: "/projects", icon: FolderKanban },
      { name: "Client Directory", href: "/projects/clients", icon: Users },
    ],
  },
  {
    label: "Financial Operations",
    items: [
      { name: "Expenses & Bills", href: "/expenses", icon: Receipt },
      { name: "Cash Advances", href: "/cash-advances", icon: Coins },
      { name: "Reimbursements", href: "/reimbursements", icon: FileCheck },
      {
        name: "Approvals",
        href: "/approvals",
        icon: CheckSquare,
        badge: "3",
        badgeVariant: "white",
      },
      { name: "Treasury & Bank Accounts", href: "/cash-accounts", icon: Wallet },
      { name: "Fund Transfers", href: "/transfers", icon: ArrowRightLeft },
    ],
  },
  {
    label: "Billing & Vendors",
    items: [
      { name: "Client Invoices", href: "/invoices", icon: FileText },
      { name: "Vendors & Partners", href: "/vendors", icon: Building2 },
    ],
  },
  {
    label: "Financial Reports",
    items: [
      { name: "Income Statement (P&L)", href: "/reports/income-statement", icon: TrendingUp },
      { name: "Cash Flow Statement", href: "/reports/cash-flow", icon: BarChart3 },
      { name: "Balance Sheet", href: "/reports/balance-sheet", icon: Scale },
      { name: "Trial Balance", href: "/reports/trial-balance", icon: BarChart3 },
      { name: "General Ledger", href: "/reports/general-ledger", icon: BookOpen },
    ],
  },
  {
    label: "Administration",
    items: [
      { name: "Organization Profile", href: "/settings/organization", icon: Building },
      { name: "Chart of Accounts (COA)", href: "/settings/accounts", icon: BarChart3 },
      { name: "Users & Permissions", href: "/settings/users", icon: ShieldCheck },
    ],
  },
];

interface SidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function Sidebar({
  collapsed: propCollapsed,
  onToggleCollapse,
}: SidebarProps) {
  const pathname = usePathname();
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({
    Overview: true,
    "Projects & Clients": true,
    "Financial Operations": true,
    "Billing & Vendors": true,
    "Financial Reports": true,
    Administration: false,
  });

  const isCollapsed = propCollapsed !== undefined ? propCollapsed : internalCollapsed;

  const handleToggle = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      setInternalCollapsed((prev) => !prev);
    }
  };

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  const isGroupOpen = (label: string) => open[label] !== false;

  const toggleGroup = (label: string) => {
    setOpen((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 flex h-full flex-col border-r border-zinc-800/80 bg-[#09090B] text-zinc-300 transition-all duration-300 shadow-2xl",
        isCollapsed ? "w-20" : "w-64"
      )}
    >
      {/* Brand Header with Clean Horizontal Lockup */}
      <div
        className={cn(
          "flex h-20 items-center border-b border-zinc-800/80 px-4",
          isCollapsed ? "justify-center" : "justify-between"
        )}
      >
        <Link
          href="/dashboard"
          className="group flex items-center gap-3 transition-opacity hover:opacity-95 overflow-hidden focus:outline-none"
        >
          {isCollapsed ? (
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 shadow-sm transition-all group-hover:border-zinc-700">
              <BrandIconSvg fill="#FFFFFF" className="h-5 w-auto" />
            </div>
          ) : (
            <div className="flex items-center gap-3.5">
              {/* Geometric TT Vector Mark in Dark Ceramic Tile */}
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800/90 shadow-sm transition-all group-hover:border-zinc-700">
                <BrandIconSvg fill="#FFFFFF" className="h-5 w-auto" />
              </div>

              {/* Typographic Identity */}
              <div className="flex flex-col justify-center">
                <span className="text-[13px] font-semibold tracking-[0.18em] text-white uppercase font-sans leading-tight">
                  Time Travel
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-normal tracking-[0.28em] text-zinc-400 uppercase leading-none">
                    Design
                  </span>
                  <span className="rounded bg-zinc-800/80 px-1.5 py-0.5 text-[8px] font-mono tracking-wider text-zinc-300 border border-zinc-700/60 leading-none">
                    Finance
                  </span>
                </div>
              </div>
            </div>
          )}
        </Link>
      </div>

      {/* Nav List */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5 scrollbar-thin scrollbar-thumb-zinc-800">
        {navigationGroups.map((group) => {
          const groupOpenState = isGroupOpen(group.label);

          return (
            <div key={group.label} className="space-y-1">
              {!isCollapsed ? (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.label)}
                  className="flex w-full items-center justify-between px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <span>{group.label}</span>
                  {groupOpenState ? (
                    <ChevronDown className="h-3 w-3 text-zinc-500" />
                  ) : (
                    <ChevronRight className="h-3 w-3 text-zinc-500" />
                  )}
                </button>
              ) : (
                <div className="h-px bg-zinc-800/80 my-2" />
              )}

              {(isCollapsed || groupOpenState) && (
                <ul className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);

                    return (
                      <li key={item.name}>
                        <Link
                          href={item.href}
                          title={isCollapsed ? item.name : undefined}
                          className={cn(
                            "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium transition-all duration-150",
                            active
                              ? "bg-white text-zinc-950 font-bold shadow-lg shadow-black/40 ring-1 ring-white/80"
                              : "text-zinc-400 hover:bg-zinc-900/90 hover:text-zinc-100",
                            isCollapsed && "justify-center px-2 py-2.5"
                          )}
                        >
                          <Icon
                            className={cn(
                              "h-[18px] w-[18px] flex-shrink-0 transition-transform duration-200 group-hover:scale-105",
                              active
                                ? "text-zinc-950"
                                : "text-zinc-400 group-hover:text-zinc-200"
                            )}
                          />

                          {!isCollapsed && (
                            <>
                              <span className="flex-1 truncate">{item.name}</span>
                              {item.badge && (
                                <span
                                  className={cn(
                                    "rounded-full px-1.5 py-0.2 text-[9px] font-black tabular-nums shadow-sm",
                                    active
                                      ? "bg-zinc-950 text-white"
                                      : "bg-zinc-800 text-zinc-200 border border-zinc-700"
                                  )}
                                >
                                  {item.badge}
                                </span>
                              )}
                            </>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </nav>

      {/* Sidebar Collapse Toggle & Minimal System Status */}
      <div className="border-t border-zinc-800/80 p-3">
        <button
          onClick={handleToggle}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-medium text-zinc-400 hover:bg-zinc-900 hover:text-white transition-colors",
            isCollapsed && "justify-center px-0"
          )}
          title={isCollapsed ? "Expand Menu" : "Collapse Menu"}
        >
          <ChevronRight
            className={cn(
              "h-4 w-4 transition-transform duration-200",
              !isCollapsed && "rotate-180"
            )}
          />
          {!isCollapsed && (
            <div className="flex flex-1 items-center justify-between">
              <span>Collapse Sidebar</span>
              <span className="text-[10px] font-mono text-zinc-600">v2.4</span>
            </div>
          )}
        </button>
      </div>
    </aside>
  );
}
