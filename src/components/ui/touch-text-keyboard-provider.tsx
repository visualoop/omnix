/**
 * TouchTextKeyboardProvider — mounts a single QWERTY keyboard app-wide
 * and opens it when a text input/textarea gains focus in touch density.
 *
 * Mounted once near the app root. Does nothing on desktop (non-touch).
 *
 * Inputs opt OUT with data-no-osk (e.g. the numeric amount fields that
 * already use TouchKeypad). Numeric/amount inputs (inputMode="decimal"|
 * "numeric", type="number") are skipped automatically so they keep
 * using the numeric TouchKeypad instead.
 */
import { useEffect, useRef, useState } from "react";
import { useIsTouch } from "@/stores/density";
import { TouchTextKeyboard } from "@/components/ui/touch-text-keyboard";

function isTextField(el: Element | null): el is HTMLInputElement | HTMLTextAreaElement {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement) return !el.dataset.noOsk;
  if (el instanceof HTMLInputElement) {
    if (el.dataset.noOsk) return false;
    const t = (el.type || "text").toLowerCase();
    if (["number", "tel", "range", "checkbox", "radio", "date", "time", "file", "color"].includes(t)) return false;
    const im = (el.inputMode || "").toLowerCase();
    if (im === "numeric" || im === "decimal") return false;
    return true;
  }
  return false;
}

export function TouchTextKeyboardProvider() {
  const touch = useIsTouch();
  const [open, setOpen] = useState(false);
  const targetRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!touch) return;
    const onFocusIn = (e: FocusEvent) => {
      const el = e.target as Element | null;
      if (isTextField(el)) {
        targetRef.current = el;
        setOpen(true);
      }
    };
    document.addEventListener("focusin", onFocusIn);
    return () => document.removeEventListener("focusin", onFocusIn);
  }, [touch]);

  if (!touch) return null;

  return (
    <TouchTextKeyboard
      inputRef={targetRef}
      open={open}
      onDismiss={() => setOpen(false)}
      onEnter={() => setOpen(false)}
    />
  );
}
