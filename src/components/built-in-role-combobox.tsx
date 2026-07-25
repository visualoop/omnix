import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import {
  BUILT_IN_ROLES,
  builtInRoleById,
  isBuiltInRoleId,
  type BuiltInRoleId,
  type BuiltInRoleModule,
} from "@/lib/built-in-roles";
import { cn } from "@/lib/utils";

const ROLE_OPTIONS: ComboboxOption[] = BUILT_IN_ROLES.map((role) => ({
  value: role.id,
  label: role.name,
  hint: role.moduleLabel,
  description: role.description,
  keywords: [role.module, ...role.searchTerms],
}));

const MODULE_TONES: Record<BuiltInRoleModule, string> = {
  core: "border-sky-500 text-sky-700 dark:text-sky-300",
  dawa: "border-teal-500 text-teal-700 dark:text-teal-300",
  retail: "border-amber-500 text-amber-700 dark:text-amber-300",
  hardware: "border-yellow-600 text-yellow-700 dark:text-yellow-300",
  hospitality: "border-orange-500 text-orange-700 dark:text-orange-300",
  salon: "border-rose-500 text-rose-700 dark:text-rose-300",
};

interface BuiltInRoleComboboxProps {
  value: BuiltInRoleId;
  onChange: (value: BuiltInRoleId) => void;
  disabled?: boolean;
  showSummary?: boolean;
}

export function BuiltInRoleCombobox({
  value,
  onChange,
  disabled,
  showSummary = true,
}: BuiltInRoleComboboxProps) {
  const selected = builtInRoleById(value);

  return (
    <div className="space-y-2.5">
      <Combobox
        value={value}
        onChange={(nextValue) => {
          if (isBuiltInRoleId(nextValue)) onChange(nextValue);
        }}
        options={ROLE_OPTIONS}
        placeholder="Choose a staff role"
        searchPlaceholder="Search by role, module, or responsibility…"
        emptyText="No built-in role matches that search"
        disabled={disabled}
      />
      {showSummary && selected && (
        <div className={cn("border-l-2 pl-3", MODULE_TONES[selected.module])}>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-xs font-medium text-foreground">{selected.name}</p>
            <span className="text-[10px] font-semibold uppercase tracking-wide">
              {selected.moduleLabel}
            </span>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {selected.description}
          </p>
        </div>
      )}
    </div>
  );
}
