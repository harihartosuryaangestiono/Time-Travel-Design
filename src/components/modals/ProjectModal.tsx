"use client";

import { useState, useEffect } from "react";
import { X, Building2, Calendar, DollarSign, FolderKanban, Tag, Loader2, Check } from "lucide-react";
import { createProject, updateProject } from "@/app/actions/projectActions";
import { FormField, FormInput, FormSelect, FormTextarea } from "@/components/ui/FormField";

export interface ProjectFormData {
  id?: string;
  code: string;
  name: string;
  client_name?: string;
  building_function: string;
  work_category: string;
  contract_value: number;
  status: "ACTIVE" | "PLANNING" | "COMPLETED" | "ON_HOLD";
  deadline: string;
  description?: string;
}

function legacyProjectType(workCategory: string) {
  if (workCategory === "Interior & Furniture") return "INTERIOR_DESIGN";
  if (workCategory === "Renovation") return "RENOVATION";
  if (workCategory === "Build From Scratch") return "CONSTRUCTION";
  return "ARCHITECTURE";
}

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (project: ProjectFormData) => void;
  projectToEdit?: ProjectFormData | null;
}

export function ProjectModal({
  isOpen,
  onClose,
  onSuccess,
  projectToEdit,
}: ProjectModalProps) {
  const isEditing = Boolean(projectToEdit && projectToEdit.id);

  const [formData, setFormData] = useState<ProjectFormData>({
    code: "",
    name: "",
    client_name: "",
    building_function: "",
    work_category: "",
    contract_value: 0,
    status: "ACTIVE",
    deadline: "",
    description: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (projectToEdit) {
      setFormData({
        id: projectToEdit.id,
        code: projectToEdit.code || "",
        name: projectToEdit.name || "",
        client_name: projectToEdit.client_name || "",
        building_function: projectToEdit.building_function || "",
        work_category: projectToEdit.work_category || "",
        contract_value: projectToEdit.contract_value || 0,
        status: projectToEdit.status || "ACTIVE",
        deadline: projectToEdit.deadline || "",
        description: projectToEdit.description || "",
      });
    } else {
      const year = new Date().getFullYear().toString().slice(-2);
      const randNum = String(Math.floor(Math.random() * 900) + 100);
      setFormData({
        code: `PRJ-${year}-${randNum}`,
        name: "",
        client_name: "",
        building_function: "",
        work_category: "",
        contract_value: 0,
        status: "ACTIVE",
        deadline: "",
        description: "",
      });
    }
    setErrorMsg(null);
  }, [projectToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.code.trim()) {
      setErrorMsg("Kode dan Nama Proyek wajib diisi.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      let savedRecord: any = null;
      if (isEditing && formData.id) {
        savedRecord = await updateProject(formData.id, {
          code: formData.code,
          name: formData.name,
          type: legacyProjectType(formData.work_category),
          building_function: formData.building_function,
          work_category: formData.work_category,
          contract_value: Number(formData.contract_value) || 0,
          description: formData.description,
        });
      } else {
        savedRecord = await createProject({
          code: formData.code,
          name: formData.name,
          type: legacyProjectType(formData.work_category),
          building_function: formData.building_function,
          work_category: formData.work_category,
          contract_value: Number(formData.contract_value) || 0,
          description: formData.description,
        });
      }

      onSuccess(savedRecord || formData);
      onClose();
    } catch (err: any) {
      console.error("Save project error:", err);
      setErrorMsg(err?.message || "Gagal menyimpan proyek.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-xl rounded-3xl border border-zinc-200/90 bg-white p-7 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-3 border-b border-zinc-100 pb-4 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-950 text-white">
            <FolderKanban className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-zinc-950">
              {isEditing ? "Edit Architectural Project" : "Create New Project"}
            </h3>
            <p className="text-xs text-zinc-500">
              {isEditing
                ? "Update project specifications, timeline, and budget allocations"
                : "Register a new architectural contract and portfolio entry"}
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Project Code */}
            <FormField id="project-code" label="Kode proyek" required hint="Kode unik untuk pencarian dan laporan.">
              <FormInput
                id="project-code"
                type="text"
                required
                maxLength={30}
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="Contoh: PRJ-26-008"
                className="font-mono"
              />
            </FormField>

            {/* Status */}
            <FormField id="project-status" label="Status proyek">
              <FormSelect
                id="project-status"
                value={formData.status}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value as any })
                }
              >
                <option value="ACTIVE">Berjalan</option>
                <option value="PLANNING">Perencanaan</option>
                <option value="COMPLETED">Selesai</option>
                <option value="ON_HOLD">Ditunda</option>
              </FormSelect>
            </FormField>
          </div>

          {/* Project Title */}
          <FormField id="project-name" label="Nama proyek" required>
            <FormInput
              id="project-name"
              type="text"
              required
              maxLength={150}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Contoh: Hunian Modern Jimbaran"
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Client Name */}
            <FormField id="project-client" label="Klien / pemberi kerja">
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                <FormInput
                  id="project-client"
                  type="text"
                  maxLength={150}
                  value={formData.client_name}
                  onChange={(e) =>
                    setFormData({ ...formData, client_name: e.target.value })
                  }
                  placeholder="Contoh: PT Bali Resort Investama"
                  className="pl-9"
                />
              </div>
            </FormField>

            {/* Scope / Category */}
            <FormField id="project-building-function" label="Kategori fungsi bangunan" required>
              <FormSelect
                id="project-building-function"
                required
                value={formData.building_function}
                onChange={(e) =>
                  setFormData({ ...formData, building_function: e.target.value })
                }
              >
                <option value="" disabled>Pilih fungsi bangunan</option>
                <option value="Commercial">Commercial</option>
                <option value="Premium Residential">Premium Residential</option>
                <option value="Luxury Residential">Luxury Residential</option>
                <option value="High End Residential">High End Residential</option>
                <option value="Office">Office</option>
              </FormSelect>
            </FormField>

            <FormField id="project-work-category" label="Kategori pekerjaan" required>
              <FormSelect
                id="project-work-category"
                required
                value={formData.work_category}
                onChange={(e) =>
                  setFormData({ ...formData, work_category: e.target.value })
                }
              >
                <option value="" disabled>Pilih kategori pekerjaan</option>
                <option value="Design Development">Design Development</option>
                <option value="Interior & Furniture">Interior &amp; Furniture</option>
                <option value="Renovation">Renovation</option>
                <option value="Build From Scratch">Build From Scratch</option>
              </FormSelect>
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Contract Value */}
            <FormField id="project-contract-value" label="Nilai kontrak (IDR)" hint="Isi 0 jika nilai belum ditentukan.">
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-xs font-bold text-zinc-400">
                  Rp
                </span>
                <FormInput
                  id="project-contract-value"
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  value={formData.contract_value || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      contract_value: Number(e.target.value) || 0,
                    })
                  }
                  placeholder="350000000"
                  className="pl-10 font-mono"
                />
              </div>
            </FormField>

            {/* Target Delivery */}
            <FormField id="project-deadline" label="Target serah terima" hint="Contoh: Desember 2026.">
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                <FormInput
                  id="project-deadline"
                  type="text"
                  maxLength={80}
                  value={formData.deadline}
                  onChange={(e) =>
                    setFormData({ ...formData, deadline: e.target.value })
                  }
                  placeholder="Contoh: Desember 2026"
                  className="pl-9"
                />
              </div>
            </FormField>
          </div>

          {/* Scope Description */}
          <FormField id="project-description" label="Deskripsi dan ruang lingkup" hint="Ringkas pekerjaan, target, atau catatan penting proyek.">
            <FormTextarea
              id="project-description"
              rows={3}
              maxLength={2000}
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Tuliskan ruang lingkup pekerjaan, target, dan catatan penting..."
            />
          </FormField>

          {/* Footer Controls */}
          <div className="mt-6 flex items-center justify-end gap-2.5 border-t border-zinc-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-xl bg-zinc-950 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-black disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  <span>{isEditing ? "Save Changes" : "Create Project"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
