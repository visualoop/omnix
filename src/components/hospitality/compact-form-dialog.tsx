/**
 * Compact dialog form for hospitality CRUD: dining area, table, room type, room.
 * Pass `fields` config; the dialog renders + collects + submits.
 *
 * Replaces the old prompt() chains in hospitality.tsx.
 */
import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CircleNotch as Loader2,
} from "@phosphor-icons/react";
import { toast } from "sonner";

export interface FormFieldDef {
  name: string;
  label: string;
  type?: "text" | "number" | "select";
  placeholder?: string;
  required?: boolean;
  defaultValue?: string | number;
  options?: Array<{ value: string; label: string }>;
  step?: string;
  min?: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  fields: FormFieldDef[];
  onSubmit: (values: Record<string, string>) => Promise<void> | void;
  submitLabel?: string;
}

export function CompactFormDialog({ open, onClose, title, description, fields, onSubmit, submitLabel = "Save" }: Props) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      const init: Record<string, string> = {};
      for (const f of fields) {
        init[f.name] = f.defaultValue !== undefined ? String(f.defaultValue) : "";
      }
      setValues(init);
    }
  }, [open, fields]);

  const submit = async () => {
    for (const f of fields) {
      if (f.required && !values[f.name]?.trim()) {
        toast.error(`${f.label} is required.`);
        return;
      }
    }
    setSubmitting(true);
    try {
      await onSubmit(values);
      onClose();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="space-y-3">
          {fields.map((f, i) => (
            <label key={f.name} className="block">
              <span className="block text-[11px] font-medium text-muted-foreground mb-1">
                {f.label}
                {f.required && <span className="text-primary"> *</span>}
              </span>
              {f.type === "select" ? (
                <Select value={values[f.name] ?? ""} onValueChange={(next) => setValues((prev) => ({ ...prev, [f.name]: String(next) }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                  {f.options?.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                </SelectContent></Select>
              ) : (
                <Input
                  type={f.type === "number" ? "number" : "text"}
                  inputMode={f.type === "number" ? "decimal" : undefined}
                  value={values[f.name] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                  placeholder={f.placeholder}
                  autoFocus={i === 0}
                  step={f.step}
                  min={f.min}
                  className={f.type === "number" ? "font-mono" : ""}
                />
              )}
            </label>
          ))}
        </div>

        <div className="flex justify-end gap-2 pt-2 -mb-1">
          <Button variant="outline" size="sm" onClick={onClose} className="rounded-lg cursor-pointer">
            Cancel
          </Button>
          <Button size="sm" onClick={submit} disabled={submitting} className="rounded-lg cursor-pointer shadow-native">
            {submitting ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Saving…</> : submitLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
