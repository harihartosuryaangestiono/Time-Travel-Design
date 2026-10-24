"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Plus,
  Users,
  Search,
  Phone,
  Mail,
  FolderKanban,
  DollarSign,
  ChevronRight,
  ShieldCheck,
  Edit3,
  Trash2,
  MapPin,
  AlertCircle,
  Briefcase,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { StatCard } from "@/components/ui/StatCard";
import { ClientModal, ClientFormData } from "@/components/modals/ClientModal";
import { DeleteConfirmDialog } from "@/components/modals/DeleteConfirmDialog";
import { deleteClientRecord } from "@/app/actions/clientActions";

interface ClientItem {
  id: string;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  tax_id: string | null;
  total_projects: number;
  total_billing: number;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal States
  const [showModal, setShowModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientFormData | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<ClientItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchClients = async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
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

      const [{ data, error }, { data: projects, error: projectsError }] =
        await Promise.all([
          supabase
            .from("clients")
            .select("*")
            .eq("organization_id", membership.organization_id)
            .order("name"),
          supabase
            .from("projects")
            .select("client_id, contract_value")
            .eq("organization_id", membership.organization_id),
        ]);

      if (error) {
        throw new Error(error.message);
      }
      if (projectsError) {
        throw new Error(projectsError.message);
      }

      if (data) {
        const projectsByClient = new Map<string, { contract_value: number | string | null }[]>();
        (projects || []).forEach((project) => {
          if (!project.client_id) return;
          const clientProjects = projectsByClient.get(project.client_id) || [];
          clientProjects.push(project);
          projectsByClient.set(project.client_id, clientProjects);
        });

        const mapped: ClientItem[] = data.map((c) => {
          const projectList = projectsByClient.get(c.id) || [];
          const totalBilling = projectList.reduce((sum: number, p: any) => {
            const val = parseFloat(p.contract_value || "0");
            return sum + (isNaN(val) ? 0 : val);
          }, 0);

          return {
            id: c.id,
            name: c.name,
            contact_person: c.contact_person || null,
            email: c.email || null,
            phone: c.phone || null,
            address: c.address || null,
            tax_id: c.tax_id || null,
            total_projects: projectList.length,
            total_billing: totalBilling,
          };
        });
        setClients(mapped);
      }
    } catch (e: any) {
      console.error("Gagal memuat daftar klien:", e);
      setErrorMessage(e.message || "Gagal memuat data klien dari server.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const handleSaveClient = () => {
    fetchClients();
  };

  const handleDeleteClient = async () => {
    if (!clientToDelete) return;
    try {
      setIsDeleting(true);
      await deleteClientRecord(clientToDelete.id);
      setShowDelete(false);
      setClientToDelete(null);
      await fetchClients();
    } catch (err: any) {
      alert(`Gagal menghapus klien: ${err.message || "Terjadi kesalahan"}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const totalContractAll = clients.reduce((s, c) => s + (c.total_billing || 0), 0);
  const totalProjectsAll = clients.reduce((s, c) => s + (c.total_projects || 0), 0);
  const activeClientsCount = clients.filter((c) => c.total_projects > 0).length;

  const filteredClients = clients.filter((c) => {
    const s = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(s) ||
      (c.contact_person && c.contact_person.toLowerCase().includes(s)) ||
      (c.address && c.address.toLowerCase().includes(s)) ||
      (c.email && c.email.toLowerCase().includes(s))
    );
  });

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* ── Top Summary KPIs ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Akun Klien"
          value={isLoading ? "..." : `${clients.length} Klien`}
          subtitle="Entitas bisnis & perorangan"
          icon={Users}
          iconBgColor="bg-emerald-500/10"
          iconColor="text-emerald-700"
          gradient
        />
        <StatCard
          title="Total Nilai Kontrak"
          value={isLoading ? "..." : formatCurrency(totalContractAll)}
          subtitle="Akumulasi portofolio proyek klien"
          icon={DollarSign}
          iconBgColor="bg-sky-500/10"
          iconColor="text-sky-700"
        />
        <StatCard
          title="Klien dengan Proyek"
          value={isLoading ? "..." : `${activeClientsCount} Klien`}
          subtitle={
            clients.length > 0
              ? `${Math.round((activeClientsCount / clients.length) * 100)}% dari seluruh klien`
              : "Belum ada klien"
          }
          icon={ShieldCheck}
          iconBgColor="bg-amber-500/10"
          iconColor="text-amber-700"
        />
        <StatCard
          title="Total Proyek Tertaut"
          value={isLoading ? "..." : `${totalProjectsAll} Proyek`}
          subtitle="Seluruh penugasan arsitektur"
          icon={FolderKanban}
          iconBgColor="bg-purple-500/10"
          iconColor="text-purple-700"
        />
      </div>

      {/* ── Error Banner ── */}
      {errorMessage && (
        <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-800">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{errorMessage}</span>
          <button
            onClick={() => fetchClients()}
            className="ml-auto underline hover:text-rose-950 font-semibold"
          >
            Coba lagi
          </button>
        </div>
      )}

      {/* ── Control Bar ── */}
      <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Cari nama klien, contact person, email, atau alamat..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-10 pr-4 text-xs text-zinc-800 placeholder-zinc-400 focus:border-zinc-950 focus:bg-white focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/projects"
            className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 transition-colors shadow-sm"
          >
            <span>Daftar Proyek</span>
            <ChevronRight className="h-4 w-4" />
          </Link>

          <button
            type="button"
            onClick={() => {
              setSelectedClient(null);
              setShowModal(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-black active:scale-95 transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>Tambah Klien</span>
          </button>
        </div>
      </div>

      {/* ── Clients Content / Skeletons / Empty ── */}
      {isLoading ? (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-56 animate-pulse rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm"
            >
              <div className="h-4 w-28 bg-zinc-100 rounded mb-4" />
              <div className="h-6 w-3/4 bg-zinc-100 rounded mb-4" />
              <div className="space-y-2 mb-4">
                <div className="h-3 w-1/2 bg-zinc-100 rounded" />
                <div className="h-3 w-2/3 bg-zinc-100 rounded" />
              </div>
              <div className="h-8 w-full bg-zinc-50 rounded mt-auto" />
            </div>
          ))}
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-white p-12 text-center shadow-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400 mb-4">
            <Users className="h-7 w-7" />
          </div>
          <h3 className="text-sm font-bold text-zinc-900 mb-1">
            {search ? "Klien Tidak Ditemukan" : "Belum Ada Data Klien"}
          </h3>
          <p className="text-xs text-zinc-500 max-w-sm mb-6">
            {search
              ? `Tidak ada data klien yang cocok dengan kata kunci "${search}".`
              : "Daftarkan klien pertama Anda untuk mulai menautkan proyek arsitektur dan penagihan invoice."}
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedClient(null);
              setShowModal(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-black transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>Tambah Klien Pertama</span>
          </button>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filteredClients.map((client) => (
            <div
              key={client.id}
              className="group flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm hover:border-zinc-300 hover:shadow-md transition-all duration-200"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-700">
                    <Briefcase className="h-3 w-3 text-zinc-500" />
                    <span>{client.total_projects} Proyek</span>
                  </span>
                  {client.tax_id && (
                    <span className="font-mono text-[10px] text-zinc-400">
                      NPWP: {client.tax_id}
                    </span>
                  )}
                </div>

                <div>
                  <h3 className="text-base font-bold text-zinc-950 group-hover:text-black transition-colors">
                    {client.name}
                  </h3>
                  {client.contact_person && (
                    <p className="text-xs text-zinc-500 mt-0.5">
                      PIC: {client.contact_person}
                    </p>
                  )}
                </div>

                {/* Contact Info */}
                <div className="space-y-1.5 pt-2 border-t border-zinc-100 text-xs text-zinc-600">
                  {client.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 text-zinc-400" />
                      <span>{client.phone}</span>
                    </div>
                  )}
                  {client.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 text-zinc-400" />
                      <span className="truncate">{client.email}</span>
                    </div>
                  )}
                  {client.address && (
                    <div className="flex items-start gap-2">
                      <MapPin className="h-3.5 w-3.5 text-zinc-400 shrink-0 mt-0.5" />
                      <span className="line-clamp-2 text-zinc-500">{client.address}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Card Footer */}
              <div className="mt-5 pt-3 border-t border-zinc-100 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] uppercase text-zinc-400 font-bold block">
                    Nilai Portofolio
                  </span>
                  <span className="font-mono font-bold text-zinc-950">
                    {formatCurrency(client.total_billing)}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedClient({
                        id: client.id,
                        name: client.name,
                        contact_person: client.contact_person || "",
                        email: client.email || "",
                        phone: client.phone || "",
                        address: client.address || "",
                        tax_id: client.tax_id || "",
                      });
                      setShowModal(true);
                    }}
                    className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800 transition-colors"
                    title="Edit Profil Klien"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setClientToDelete(client);
                      setShowDelete(true);
                    }}
                    className="rounded-lg p-1.5 text-zinc-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                    title="Hapus Klien"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Edit / Create Modal ── */}
      <ClientModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={handleSaveClient}
        clientToEdit={selectedClient}
      />

      {/* ── Delete Confirmation Dialog ── */}
      <DeleteConfirmDialog
        isOpen={showDelete}
        onClose={() => {
          setShowDelete(false);
          setClientToDelete(null);
        }}
        onConfirm={handleDeleteClient}
        title="Hapus Klien"
        description={`Apakah Anda yakin ingin menghapus data "${clientToDelete?.name}"? Tindakan ini tidak dapat dibatalkan.`}
        isDeleting={isDeleting}
      />
    </div>
  );
}
