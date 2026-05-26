/**
 * Lightweight form helpers for consistent validation UX.
 *
 * - <FormField> wraps label + input + error message
 * - <FieldError> renders inline error text
 * - useFormErrors() returns an errors map + setError/clearError
 */
import { useState, useCallback } from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface FormFieldProps {
  label?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}

export function FormField({ label, required, error, hint, className, children }: FormFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
          {label}
          {required && <span className="text-red-600">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <FieldError message={error} />
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function FieldError({ message }: { message: string }) {
  return (
    <p className="text-xs text-red-600 flex items-center gap-1">
      <AlertCircle className="h-3 w-3 shrink-0" />
      {message}
    </p>
  );
}

export function useFormErrors<T extends Record<string, any>>() {
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});

  const setError = useCallback((key: keyof T, message: string) => {
    setErrors((e) => ({ ...e, [key]: message }));
  }, []);

  const clearError = useCallback((key: keyof T) => {
    setErrors((e) => {
      const next = { ...e };
      delete next[key];
      return next;
    });
  }, []);

  const clearAll = useCallback(() => setErrors({}), []);

  const hasErrors = Object.keys(errors).length > 0;

  return { errors, setError, clearError, clearAll, hasErrors };
}

// ─── Common validators ──────────────────────────────────────────────
export const validators = {
  required: (v: any, label = "Field"): string | null =>
    !v || (typeof v === "string" && !v.trim()) ? `${label} is required` : null,

  minLength: (n: number) => (v: string, label = "Field"): string | null =>
    v.length < n ? `${label} must be at least ${n} characters` : null,

  email: (v: string): string | null =>
    v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? "Invalid email address" : null,

  phone: (v: string): string | null => {
    if (!v) return null;
    const digits = v.replace(/\D/g, "");
    if (digits.length < 9 || digits.length > 13) return "Invalid phone number";
    return null;
  },

  positive: (v: number, label = "Value"): string | null =>
    v <= 0 ? `${label} must be greater than zero` : null,

  nonNegative: (v: number, label = "Value"): string | null =>
    v < 0 ? `${label} cannot be negative` : null,
};
