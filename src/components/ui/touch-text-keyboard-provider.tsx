/**
 * TouchTextKeyboardProvider — mounts ONE on-screen QWERTY app-wide and
 * manages its full lifecycle.
 *
 * Open triggers:
 *   - focusin on a text input / textarea (excluding numeric / opt-out)
 *
 * Dismiss triggers (this is the part the simple-keyboard version missed):
 *   - focusout from the bound input (waiting one tick to let focus
 *     transfer to another field, which would re-open the keyboard)
 *   - the bound input is removed from the DOM (modal closes mid-type)
 *   - Escape key
 *   - explicit user dismiss (grab handle / scrim)
 *
 * The provider tracks ONE bound input at a time. Numeric inputs and
 * anything with `data-no-osk` opt out — those use the existing
 * TouchKeypad instead.
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
    // numeric/date/file etc. either use the TouchKeypad or have no business
    // with a software QWERTY at all.
    if (["number", "tel", "range", "checkbox", "radio", "date", "datetime-local", "time", "month", "week", "file", "color", "submit", "reset", "button", "image"].includes(t)) return false;
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
  // Debounce focusout → close so that focus moving from one input to the
  // next doesn't blink the keyboard.
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!touch) return;

    const cancelClose = () => {
      if (closeTimerRef.current !== null) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };

    const scheduleClose = () => {
      cancelClose();
      // 120ms is enough to let document.activeElement transition to the
      // next field on Tab/click between inputs; if we still don't have a
      // text input focused at the tick, close.
      closeTimerRef.current = window.setTimeout(() => {
        const active = document.activeElement;
        if (!isTextField(active)) {
          targetRef.current = null;
          setOpen(false);
        }
        closeTimerRef.current = null;
      }, 120);
    };

    const onFocusIn = (e: FocusEvent) => {
      const el = e.target as Element | null;
      if (isTextField(el)) {
        cancelClose();
        targetRef.current = el;
        setOpen(true);
      } else {
        // focus moved to a non-text element — close
        scheduleClose();
      }
    };

    const onFocusOut = (e: FocusEvent) => {
      // Only react when the OUTGOING element is the one we're bound to.
      // The mousedown.preventDefault in the keyboard itself stops key-taps
      // from firing focusout at all.
      if (e.target === targetRef.current) scheduleClose();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        cancelClose();
        targetRef.current?.blur();
        targetRef.current = null;
        setOpen(false);
      }
    };

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("keydown", onKeyDown);
      cancelClose();
    };
  }, [touch, open]);

  // Auto-dismiss if the bound input gets removed from the DOM (e.g. a
  // dialog closes while the user was typing). Without this the keyboard
  // stays on screen with a dangling targetRef and the next interaction
  // re-opens it over an unrelated input.
  useEffect(() => {
    if (!open) return;
    const tick = window.setInterval(() => {
      const el = targetRef.current;
      if (el && !document.body.contains(el)) {
        targetRef.current = null;
        setOpen(false);
      }
    }, 250);
    return () => clearInterval(tick);
  }, [open]);

  if (!touch) return null;

  return (
    <TouchTextKeyboard
      inputRef={targetRef}
      open={open}
      onDismiss={() => {
        targetRef.current?.blur();
        targetRef.current = null;
        setOpen(false);
      }}
      onEnter={() => {
        targetRef.current?.blur();
        targetRef.current = null;
        setOpen(false);
      }}
    />
  );
}
