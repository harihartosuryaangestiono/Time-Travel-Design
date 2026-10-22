"use client";

import { useState, useEffect } from "react";
import { X, Building2, Calendar, DollarSign, FolderKanban, Tag, Loader2, Check } from "lucide-react";
import { createProject, updateProject } from "@/app/actions/projectActions";

export interface ProjectFormData {
  id?: string;
  code: string;
  name: string;
  client_name?: string;
  category: string;
  contract_value: number;
  status: "ACTIVE" | "PLANNING" | "COMPLETED" | "ON_HOLD";
  deadline: string;
  description?: string;
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
    category: "Architecture & Interior",
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
        category: projectToEdit.category || "Architecture & Interior",
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
        category: "Architecture & Interior",
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
          contract_value: Number(formData.contract_value) || 0,
          description: formData.description,
        });
      } else {
        savedRecord = await createProject({
          code: formData.code,
          name: formData.name,
          type: "ARCHITECTURE",
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
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                Project Code Ref *
              </label>
              <input
                type="text"
                required
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="e.g. PRJ-24-008"
                className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 font-mono text-xs font-semibold text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
              />
            </div>

            {/* Status */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                Project Status
              </label>
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value as any })
                }
                className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
              >
                <option value="ACTIVE">In Progress (Active)</option>
                <option value="PLANNING">Planning &amp; Concept</option>
                <option value="COMPLETED">Completed &amp; Handed Over</option>
                <option value="ON_HOLD">On Hold</option>
              </select>
            </div>
          </div>

          {/* Project Title */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
              Project Name / Title *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Modern Cliffside Residence Jimbaran"
              className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 text-xs font-medium text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Client Name */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                Client / Commissioning Entity
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  value={formData.client_name}
                  onChange={(e) =>
                    setFormData({ ...formData, client_name: e.target.value })
                  }
                  placeholder="e.g. PT Bali Resort Investama"
                  className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-9 pr-3 text-xs text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            {/* Scope / Category */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                Architectural Category
              </label>
              <select
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value })
                }
                className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
              >
                <option value="Architecture & Interior">Architecture &amp; Interior</option>
                <option value="Commercial F&B">Commercial F&amp;B</option>
                <option value="Masterplanning">Masterplanning</option>
                <option value="Luxury Residential">Luxury Residential</option>
                <option value="Hospitality & Landscape">Hospitality &amp; Landscape</option>
                <option value="Renovation & Fit-Out">Renovation &amp; Fit-Out</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Contract Value */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                Contract Value (IDR)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-xs font-bold text-zinc-400">
                  Rp
                </span>
                <input
                  type="number"
                  min="0"
                  step="1000000"
                  value={formData.contract_value || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      contract_value: Number(e.target.value) || 0,
                    })
                  }
                  placeholder="350000000"
                  className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-10 pr-3 font-mono text-xs font-bold text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            {/* Target Delivery */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                Target Handover Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  value={formData.deadline}
                  onChange={(e) =>
                    setFormData({ ...formData, deadline: e.target.value })
                  }
                  placeholder="e.g. December 2025"
                  className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-9 pr-3 text-xs text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Scope Description */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
              Project Description &amp; Scope Summary
            </label>
            <textarea
              rows={2}
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Outline structural design milestones, site logistics, and finish specifications..."
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
            />
          </div>

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
