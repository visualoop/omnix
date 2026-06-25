"use client";

/**
 * EntityCombobox — searchable picker for the common business entities.
 *
 * Wraps the generic <Combobox> with an entity-specific data source.
 * For SMB scale (≤500 customers / suppliers / patients on a typical
 * install) we pre-fetch the top 500 rows on mount and let Combobox
 * do client-side filtering — same UX as Linear's command palette.
 *
 * For larger installs we'd need to thread onSearchChange through the
 * Combobox so the picker can refetch on keystroke; that's a follow-up.
 *
 * Usage:
 *
 *   <EntityCombobox
 *     kind="patient"
 *     value={patientId}
 *     onChange={setPatientId}
 *     onCreate={async (name) => {
 *       const id = await createCustomer({ name });
 *       return { value: id, label: name };
 *     }}
 *   />
 */
import { useEffect, useMemo, useState } from "react";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { listCustomers, listSuppliers } from "@/services/erp";
import { listDoctors } from "@/services/doctors";

export type EntityKind =
  | "customer"
  | "patient"      // Same physical row as customer; pharmacy surfaces a different label
  | "contractor"   // Same physical row as customer; hardware surfaces a different label
  | "supplier"
  | "doctor";

interface Props {
  kind: EntityKind;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /**
   * Inline "+ Add new …" affordance. Returning null means the create
   * was aborted (user cancelled the dialog) — the picker stays open.
   */
  onCreate?: (query: string) => Promise<ComboboxOption | null>;
  disabled?: boolean;
  className?: string;
  /**
   * When the picker mounts with a value but no matching option in the
   * pre-fetched list, we synthesise an entry so the trigger renders
   * something. Pass an initialLabel to skip the "Loading…" placeholder.
   */
  initialLabel?: string;
}

const PLACEHOLDERS: Record<EntityKind, string> = {
  customer:   "Pick a customer",
  patient:    "Pick a patient",
  contractor: "Pick a contractor",
  supplier:   "Pick a supplier",
  doctor:     "Pick a doctor",
};

const SEARCH_PLACEHOLDERS: Record<EntityKind, string> = {
  customer:   "Search by name or phone…",
  patient:    "Search by name or phone…",
  contractor: "Search by name or phone…",
  supplier:   "Search supplier…",
  doctor:     "Search by name or licence…",
};

async function fetchAll(kind: EntityKind): Promise<ComboboxOption[]> {
  switch (kind) {
    case "customer":
    case "patient":
    case "contractor": {
      const rows = await listCustomers();
      return rows.slice(0, 500).map((c) => ({
        value: c.id,
        label: c.name,
        hint: c.phone ?? undefined,
      }));
    }
    case "supplier": {
      const rows = await listSuppliers(true);
      return rows.slice(0, 500).map((s) => ({
        value: s.id,
        label: s.name,
        hint: s.phone ?? undefined,
      }));
    }
    case "doctor": {
      const rows = await listDoctors();
      return rows.slice(0, 500).map((d) => ({
        value: d.id,
        label: d.full_name,
        hint: d.specialty ?? d.license_number ?? undefined,
      }));
    }
  }
}

export function EntityCombobox({
  kind, value, onChange, placeholder, onCreate, disabled, className, initialLabel,
}: Props) {
  const [options, setOptions] = useState<ComboboxOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchAll(kind)
      .then((opts) => {
        if (!cancelled) setOptions(opts);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [kind]);

  // Synthesise a "Loading…" / initialLabel option so the trigger
  // doesn't render blank for a value not in the current options list.
  const merged = useMemo<ComboboxOption[]>(() => {
    if (!value) return options;
    if (options.some((o) => o.value === value)) return options;
    return [{ value, label: initialLabel ?? "Loading…" }, ...options];
  }, [options, value, initialLabel]);

  return (
    <Combobox
      value={value}
      onChange={onChange}
      options={merged}
      placeholder={placeholder ?? PLACEHOLDERS[kind]}
      searchPlaceholder={SEARCH_PLACEHOLDERS[kind]}
      emptyText={`No ${kind}s match.${onCreate ? "" : " Add one from the dedicated page."}`}
      onCreate={onCreate ? async (label) => {
        const result = await onCreate(label);
        if (result) {
          setOptions((prev) => [result, ...prev.filter((o) => o.value !== result.value)]);
        }
        return result;
      } : undefined}
      disabled={disabled}
      className={className}
    />
  );
}
