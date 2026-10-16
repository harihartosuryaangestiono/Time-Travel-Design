"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Calendar, Building2, MapPin, TrendingUp, Loader2, FileText } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate } from "@/lib/utils";

interface Project {
  id: string;
  code: string;
  name: string;
  client_id: string;
  type: string;
  status: string;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  completed_date: string | null;
  contract_value: string | null;
  description: string | null;
  client?: { name: string };
}

const statusConfig: Record<string, { label: string; color: string }> = {
  PLANNING: { label: "Planning & Feasibility", color: "bg-zinc-100 text-zinc-700 border border-zinc-200" },
  ACTIVE: { label: "Active Execution", color: "bg-emerald-50 text-emerald-800 border border-emerald-200" },
  ON_HOLD: { label: "On Hold", color: "bg-amber-50 text-amber-800 border border-amber-200" },
  COMPLETED: { label: "Completed", color: "bg-zinc-900 text-white" },
  CANCELLED: { label: "Terminated", color: "bg-rose-50 text-rose-700 border border-rose-200" },
};

export default function ProjectDetailPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchProject();
  }, [projectId]);

  const fetchProject = async () => {
    try {
      const supabase = createClient();
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
        .from("projects")
        .select(`
          *,
          client:clients(name)
        `)
        .eq("id", projectId)
        .eq("organization_id", membership.organization_id)
        .single();

      if (error) throw error;
      setProject(data);
    } catch (error) {
      console.error("Error fetching project:", error);
      router.push("/projects");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-950" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-500">Project record not found</p>
          <Link href="/projects" className="mt-4 text-zinc-900 font-semibold hover:underline">
            Back to Projects Portfolio
          </Link>
        </div>
      </div>
    );
  }

  const status = statusConfig[project.status] || statusConfig.PLANNING;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/projects"
            className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Projects Portfolio
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-zinc-900">{project.name}</h1>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${status.color}`}>
              {status.label}
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-400 font-mono">{project.code}</p>
        </div>
      </div>

      {/* Project Info Grid */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Main Info */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 md:col-span-2 shadow-sm">
          <h2 className="text-base font-bold text-zinc-900 mb-5 pb-3 border-b border-zinc-100">
            Project Master Specification
          </h2>
          <dl className="grid gap-5 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Client Organization</dt>
              <dd className="mt-1.5 flex items-center gap-2 text-sm font-semibold text-zinc-900">
                <Building2 className="h-4 w-4 text-zinc-400" />
                {project.client?.name || "-"}
              </dd>
            </div>

            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Engagement Scope</dt>
              <dd className="mt-1.5 text-sm font-semibold text-zinc-900 capitalize">
                {project.type.toLowerCase().replace("_", " ")}
              </dd>
            </div>

            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Site Location</dt>
              <dd className="mt-1.5 flex items-center gap-2 text-sm font-semibold text-zinc-900">
                <MapPin className="h-4 w-4 text-zinc-400" />
                {project.location || "-"}
              </dd>
            </div>

            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Contract Value</dt>
              <dd className="mt-1.5 text-sm font-mono font-bold text-zinc-900">
                {project.contract_value ? formatCurrency(parseFloat(project.contract_value)) : "-"}
              </dd>
            </div>

            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Commencement Date</dt>
              <dd className="mt-1.5 flex items-center gap-2 text-sm font-semibold text-zinc-900">
                <Calendar className="h-4 w-4 text-zinc-400" />
                {project.start_date ? formatDate(project.start_date) : "-"}
              </dd>
            </div>

            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Target Handover</dt>
              <dd className="mt-1.5 flex items-center gap-2 text-sm font-semibold text-zinc-900">
                <Calendar className="h-4 w-4 text-zinc-400" />
                {project.end_date ? formatDate(project.end_date) : "-"}
              </dd>
            </div>
          </dl>

          {project.description && (
            <div className="mt-6 pt-5 border-t border-zinc-100">
              <dt className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Project Brief & Concept</dt>
              <dd className="mt-2 text-sm text-zinc-600 leading-relaxed">{project.description}</dd>
            </div>
          )}
        </div>

        {/* Summary Card */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-zinc-800 bg-[#09090B] p-6 text-white shadow-sm">
            <div className="text-xs font-mono uppercase tracking-wider text-zinc-400">Total Contract Value</div>
            <div className="mt-2 text-2xl font-bold font-mono tracking-tight text-white">
              {project.contract_value
                ? formatCurrency(parseFloat(project.contract_value))
                : "Undetermined"}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-bold text-zinc-900 mb-4">
              <TrendingUp className="h-4 w-4 text-zinc-900" />
              Financial Health Summary
            </div>
            <div className="space-y-3">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Lifecycle Status</span>
                <span className={`font-medium ${status.color} px-2 py-0.5 rounded text-[11px]`}>
                  {status.label}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Authorized Budget</span>
                <span className="font-semibold text-zinc-900">-</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Incurred Expenditures</span>
                <span className="font-semibold text-zinc-900">-</span>
              </div>
              <div className="flex justify-between text-xs border-t border-zinc-100 pt-2">
                <span className="text-zinc-500 font-semibold">Remaining Variance</span>
                <span className="font-semibold text-zinc-900 font-mono">-</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Transactions Placeholder */}
      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <h2 className="text-sm font-bold text-zinc-900">Ledger & Cost Transactions</h2>
        </div>
        <div className="p-12 text-center">
          <FileText className="mx-auto h-10 w-10 text-zinc-300" />
          <h3 className="mt-3 text-sm font-semibold text-zinc-900">No transactions recorded yet</h3>
          <p className="mt-1 text-xs text-zinc-400">
            Disbursements, progress billing invoices, and vouchers allocated to this project will appear here
          </p>
        </div>
      </div>
    </div>
  );
}
