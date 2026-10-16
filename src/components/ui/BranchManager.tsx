// src/components/ui/BranchManager.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import {
  createBranch,
  updateBranch,
  deleteBranch,
  getBranches,
} from "@/app/actions/branch";
import { BRANCH_STATUS_TONES } from "@/lib/status-tones";
import type {
  CreateBranchValues,
  UpdateBranchValues,
} from "@/lib/validations/branch";
import Swal from "sweetalert2";

interface Branch {
  id: number;
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  isActive: boolean;
  isPublic: boolean;
  code?: string | null;
}

interface BranchForm {
  name: string;
  address: string;
  phone: string;
  email: string;
  isActive: boolean;
  isPublic: boolean;
  code: string;
}

type Mode = "list" | "create" | "edit";

const EMPTY_FORM: BranchForm = {
  name: "",
  address: "",
  phone: "",
  email: "",
  isActive: true,
  isPublic: false,
  code: "",
};

// 16px (`text-base`) es obligatorio: por debajo, iOS hace zoom al enfocar.
const INPUT_CLASS =
  "w-full min-h-[44px] px-4 py-3 bg-[#f8f8f8] rounded-xl text-base text-[#222222] focus:outline-none focus:ring-2 focus:ring-[#ec4899]/30";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function BranchManager({ branches }: { branches: Branch[] }) {
  const [mode, setMode] = useState<Mode>("list");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Local optimistic copy so the UI can refresh without a full reload.
  const [list, setList] = useState<Branch[]>(branches);
  const [prevBranches, setPrevBranches] = useState<Branch[]>(branches);
  if (prevBranches !== branches) {
    setPrevBranches(branches);
    setList(branches);
  }

  function openCreate() {
    setForm(EMPTY_FORM);
    setMode("create");
    setError(null);
  }

  function openEdit(branch: Branch) {
    setForm({
      name: branch.name,
      address: branch.address ?? "",
      phone: branch.phone ?? "",
      email: branch.email ?? "",
      isActive: branch.isActive,
      isPublic: branch.isPublic,
      code: branch.code ?? "",
    });
    setEditingId(branch.id);
    setMode("edit");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload: Partial<CreateBranchValues> = {
      name: form.name.trim(),
      address: form.address?.trim() || null,
      phone: form.phone?.trim() || null,
      email: form.email?.trim() || null,
      isActive: form.isActive,
      isPublic: form.isPublic,
      ...(mode === "create" && { code: form.code.trim() }),
    };

    let result;
    if (mode === "create") {
      result = await createBranch(payload as unknown as CreateBranchValues);
    } else if (mode === "edit" && editingId !== null) {
      result = await updateBranch({ ...payload, id: editingId } as unknown as UpdateBranchValues);
    } else {
      setSubmitting(false);
      return;
    }

    if (result.success) {
      if (mode === "create" && result.data && "credentials" in result.data) {
        const { branch, credentials } = result.data;
        await Swal.fire({
          title: "Sucursal creada",
          html: `
            <div style="text-align:left;font-size:15px;line-height:1.5;color:#222222;">
              <p style="margin:0 0 12px;">
                La sucursal <strong>${escapeHtml(branch.name)}</strong> se creó correctamente.
              </p>
              <div style="background:#f8f8f8;border-radius:12px;padding:14px;margin-bottom:12px;">
                <p style="margin:0 0 4px;font-size:13px;color:#6a6a6a;">Email de acceso</p>
                <p style="margin:0 0 12px;font-weight:600;color:#222222;word-break:break-all;">${escapeHtml(credentials.email)}</p>
                <p style="margin:0 0 4px;font-size:13px;color:#6a6a6a;">Contraseña temporal</p>
                <p style="margin:0;font-weight:700;color:#222222;word-break:break-all;">${escapeHtml(credentials.password)}</p>
              </div>
              <p style="margin:0;font-size:13px;color:#c13515;">
                Esta contraseña se muestra una sola vez. Cópiala y guárdala antes de cerrar.
              </p>
            </div>
          `,
          icon: "success",
          confirmButtonColor: "#be185d",
          background: "#ffffff",
          color: "#222222",
          confirmButtonText: "Entendido",
        });
        const refreshed = await getBranches();
        if (refreshed.success && refreshed.data) {
          setList(refreshed.data);
        }
        setMode("list");
        setSubmitting(false);
        return;
      }
      window.location.reload();
      return;
    }

    if (mode === "create" && result.error === "DUPLICATE_CODE") {
      setError("Ya existe una sucursal con ese código");
    } else {
      setError(result.error ?? "Error al guardar la sucursal");
    }
    setSubmitting(false);
  }

  async function handleDelete(id: number) {
    setSubmitting(true);
    setError(null);
    const result = await deleteBranch({ id });
    if (result.success) {
      const next = list.filter((b) => b.id !== id);
      setList(next);
    } else {
      setError(result.error ?? "Error al eliminar la sucursal");
    }
    setSubmitting(false);
  }

  // ---- Create/Edit Form ----
  if (mode === "create" || mode === "edit") {
    return (
      <div className="max-w-lg">
        <div className="min-w-0">
          <div className="mb-5">
            <h2 className="text-xl font-semibold text-[#222222]">
              {mode === "create" ? "Nueva sucursal" : "Editar sucursal"}
            </h2>
          </div>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#222222] mb-1">
                Nombre
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                maxLength={255}
                className={INPUT_CLASS}
                placeholder="Nombre de la sucursal"
              />
            </div>

            {mode === "create" && (
              <div>
                <label className="block text-sm font-medium text-[#222222] mb-1">
                  Código
                </label>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  required
                  maxLength={10}
                  className={INPUT_CLASS}
                  placeholder="Ej. CEN"
                />
                <p className="mt-1 text-xs text-[#6a6a6a]">
                  2-10 letras o números. Se usa para el portal de la sucursal.
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-[#222222] mb-1">
                Dirección
              </label>
              <input
                type="text"
                value={form.address ?? ""}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                maxLength={500}
                className={INPUT_CLASS}
                placeholder="Dirección (opcional)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#222222] mb-1">
                Teléfono
              </label>
              <input
                type="text"
                value={form.phone ?? ""}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                maxLength={50}
                className={INPUT_CLASS}
                placeholder="Teléfono (opcional)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#222222] mb-1">
                Email
              </label>
              <input
                type="email"
                value={form.email ?? ""}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                maxLength={255}
                className={INPUT_CLASS}
                placeholder="email@ejemplo.com (opcional)"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                className="w-5 h-5 rounded"
              />
              <span className="text-sm text-[#222222]">Sucursal activa</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isPublic}
                onChange={(e) => setForm({ ...form, isPublic: e.target.checked })}
                className="w-5 h-5 rounded"
              />
              <span className="text-sm text-[#222222]">Sucursal pública</span>
            </label>

            {/* En celular los botones van apilados: uno al lado del otro no entran. */}
            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 min-h-[44px] px-4 py-3 rounded-xl brand-action font-medium disabled:opacity-50 touch-manipulation"
              >
                {submitting ? "Guardando..." : "Guardar"}
              </button>
              <button
                type="button"
                onClick={() => setMode("list")}
                disabled={submitting}
                className="min-h-[44px] px-4 py-3 bg-[#f2f2f2] text-[#222222] rounded-xl font-medium hover:bg-[#ebebeb] disabled:opacity-50 transition-colors touch-manipulation"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ---- List View ----
  return (
    <div>
      {/* El título de la página lo pone `PageHeader`: acá va solo la acción. */}
      <div className="mb-4 flex justify-end">
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-xl brand-action text-sm font-medium touch-manipulation"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nueva sucursal
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
          {error}
        </div>
      )}

      {list.length === 0 ? (
        <div className="text-center py-12 text-[#6a6a6a]">
          <p>No hay sucursales registradas</p>
          <p className="mt-2 text-sm">Crea tu primera sucursal para empezar</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {list.map((branch) => (
            <li
              key={branch.id}
              className="glass rounded-2xl border border-black/5 p-4"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-semibold text-[#222222] break-words">
                      {branch.name}
                    </h3>
                    {branch.id === 1 && (
                      <span
                        className="px-2 py-0.5 rounded text-xs font-medium"
                        style={{
                          backgroundColor: BRANCH_STATUS_TONES.principal.background,
                          color: BRANCH_STATUS_TONES.principal.color,
                        }}
                      >
                        Principal
                      </span>
                    )}
                    {!branch.isActive && (
                      <span
                        className="px-2 py-0.5 rounded text-xs"
                        style={{
                          backgroundColor: BRANCH_STATUS_TONES.inactive.background,
                          color: BRANCH_STATUS_TONES.inactive.color,
                        }}
                      >
                        Inactiva
                      </span>
                    )}
                    {branch.isPublic === true && (
                      <span
                        className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                        style={{
                          backgroundColor: BRANCH_STATUS_TONES.public.background,
                          color: BRANCH_STATUS_TONES.public.color,
                        }}
                      >
                        Pública
                      </span>
                    )}
                  </div>
                  {branch.address && (
                    <p className="text-sm text-[#6a6a6a] mt-1 break-words">{branch.address}</p>
                  )}
                  <div className="flex gap-x-3 gap-y-1 mt-1 text-xs text-[#6a6a6a] flex-wrap">
                    {branch.phone && <span className="break-words">{branch.phone}</span>}
                    {branch.email && <span className="break-words">{branch.email}</span>}
                  </div>
                </div>

                {/* Estado y acciones: envuelven en celular chico, sin scroll horizontal.
                    Desde desktop van alineadas al centro de la tarjeta y a la derecha. */}
                <div className="flex flex-wrap items-center justify-start gap-2 md:shrink-0 md:justify-end">
                  <Link
                    href={`/sucursal/${branch.id}/inventory`}
                    aria-label={`Ver portal de ${branch.name}`}
                    className="inline-flex items-center gap-1.5 px-3 min-h-[44px] rounded-xl bg-[#f2f2f2] text-[#222222] text-sm font-medium hover:bg-[#ebebeb] transition-colors touch-manipulation"
                  >
                    Portal
                  </Link>

                  <button
                    onClick={() => openEdit(branch)}
                    aria-label={`Editar ${branch.name}`}
                    className="inline-flex w-11 h-11 min-w-[44px] min-h-[44px] items-center justify-center rounded-xl bg-[#f2f2f2] text-[#6a6a6a] hover:bg-[#ebebeb] transition-colors touch-manipulation"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>

                  {branch.id !== 1 && (
                    <button
                      onClick={() => {
                        Swal.fire({
                          title: "Eliminar sucursal",
                          text: "¿Estás seguro de que deseas eliminar esta sucursal? Esta acción no se puede deshacer.",
                          icon: "warning",
                          showCancelButton: true,
                          confirmButtonColor: "#be185d",
                          cancelButtonColor: "#6a6a6a",
                          confirmButtonText: "Sí, eliminar",
                          cancelButtonText: "Cancelar",
                        }).then((result) => {
                          if (result.isConfirmed) {
                            handleDelete(branch.id);
                          }
                        });
                      }}
                      aria-label={`Eliminar ${branch.name}`}
                      className="inline-flex w-11 h-11 min-w-[44px] min-h-[44px] items-center justify-center rounded-xl bg-red-600 text-white hover:bg-red-700 transition-colors touch-manipulation"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}