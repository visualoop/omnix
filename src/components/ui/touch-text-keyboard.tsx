/**
 * TouchTextKeyboard — slide-up QWERTY for touch / POS terminals.
 *
 * Built from scratch in React + Tailwind. Replaces the previous
 * `simple-keyboard` implementation which caused:
 *   - blank screens when an input was focused (a stray portal overlay
 *     covered the page even when the keyboard was supposed to be hidden)
 *   - the keyboard lingering after a modal closed (no focusout / outside-
 *     click / unmount cleanup)
 *   - CSS leaking across the app (the library's default styles shipped
 *     globally regardless of theme).
 *
 * This component is the SURFACE — purely presentational. The lifecycle
 * (open / dismiss / which input to type into) is owned by
 * `TouchTextKeyboardProvider`, which mounts ONE instance app-wide.
 *
 * Behaviour contract:
 *   - Pure DOM. No portals. No external CSS. No lingering overlays.
 *   - Tap-outside dismiss is handled by the provider's window listener,
 *     not by an absolutely-positioned scrim here.
 *   - Writes into the bound input via the native value setter so React
 *     controlled inputs (`onChange={(e) => setX(e.target.value)}`) update.
 *   - Three layouts: lowercase, uppercase (shift), symbols/numbers.
 *   - Editorial chrome: hairline borders, single accent on Enter, no
 *     candy gradients, JetBrains Mono on numeric/symbol rows.
 */
import { useCallback, useMemo, useState } from "react";
import { Backspace, ArrowElbowDownLeft } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface Props {
  /** The text input/textarea the keyboard types into. */
  inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  open: boolean;
  onDismiss?: () => void;
  /** Called on Enter; defaults to blurring the input (which the provider
   *  then sees as focusout and dismisses the keyboard). */
  onEnter?: () => void;
}

/* Layouts. Each is a list of rows; each row is a list of keys. A key is
 * either a string (the literal character) or a function key { kind, label }.
 * No hidden state — pressing a key sends one explicit intent. */
type FnKey =
  | { kind: "shift" }
  | { kind: "backspace" }
  | { kind: "space" }
  | { kind: "enter" }
  | { kind: "symbols" }
  | { kind: "abc" };
type Key = string | FnKey;

const LOWER: Key[][] = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  [{ kind: "shift" }, "z", "x", "c", "v", "b", "n", "m", { kind: "backspace" }],
  [{ kind: "symbols" }, ",", { kind: "space" }, ".", { kind: "enter" }],
];
const UPPER: Key[][] = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  [{ kind: "shift" }, "Z", "X", "C", "V", "B", "N", "M", { kind: "backspace" }],
  [{ kind: "symbols" }, ",", { kind: "space" }, ".", { kind: "enter" }],
];
const SYMBOLS: Key[][] = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["-", "/", ":", ";", "(", ")", "$", "&", "@", "\""],
  [{ kind: "shift" }, ".", ",", "?", "!", "'", "+", "*", { kind: "backspace" }],
  [{ kind: "abc" }, "#", { kind: "space" }, "_", { kind: "enter" }],
];

/** Write a value into a React-controlled input and fire the input event
 *  so onChange handlers run. */
function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement
    ? window.HTMLTextAreaElement.prototype
    : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

export function TouchTextKeyboard({ inputRef, open, onDismiss, onEnter }: Props) {
  const [layout, setLayout] = useState<"lower" | "upper" | "symbols">("lower");
  const rows = useMemo(
    () => (layout === "lower" ? LOWER : layout === "upper" ? UPPER : SYMBOLS),
    [layout],
  );

  /** Type a literal character into the bound input. Keep the cursor at
   *  the end after the insertion so subsequent keys append correctly. */
  const typeChar = useCallback((c: string) => {
    const el = inputRef.current;
    if (!el) return;
    const value = el.value ?? "";
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = value.slice(0, start) + c + value.slice(end);
    setNativeValue(el, next);
    // Move caret just after the inserted char.
    const caret = start + c.length;
    requestAnimationFrame(() => {
      try { el.setSelectionRange(caret, caret); } catch { /* range types that don't support selection */ }
    });
  }, [inputRef]);

  const backspace = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const value = el.value ?? "";
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    if (start === 0 && end === 0) return;
    const cutFrom = start === end ? Math.max(0, start - 1) : start;
    const next = value.slice(0, cutFrom) + value.slice(end);
    setNativeValue(el, next);
    requestAnimationFrame(() => {
      try { el.setSelectionRange(cutFrom, cutFrom); } catch { /* */ }
    });
  }, [inputRef]);

  const handleFn = useCallback((fn: FnKey) => {
    switch (fn.kind) {
      case "shift":
        setLayout((l) => (l === "upper" ? "lower" : "upper"));
        break;
      case "backspace":
        backspace();
        break;
      case "space":
        typeChar(" ");
        break;
      case "enter":
        if (onEnter) onEnter();
        else inputRef.current?.blur();
        break;
      case "symbols":
        setLayout("symbols");
        break;
      case "abc":
        setLayout("lower");
        break;
    }
  }, [backspace, typeChar, onEnter, inputRef]);

  if (!open) return null;

  return (
    <div
      // mousedown.preventDefault keeps the bound input focused while the
      // user taps a key — without this, every tap blurs the input which
      // would cause the provider to immediately dismiss the keyboard.
      onMouseDown={(e) => e.preventDefault()}
      onTouchStart={(e) => {
        // same anti-blur defence on real touch hardware
        if (e.target !== e.currentTarget) e.preventDefault();
      }}
      role="region"
      aria-label="On-screen keyboard"
      className={cn(
        "fixed inset-x-0 bottom-0 z-[80]",
        "border-t border-border bg-background/95 backdrop-blur-md",
        "px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]",
        // Subtle slide-up
        "animate-in slide-in-from-bottom-2 duration-150",
      )}
    >
      {/* Grab handle — visual affordance + dismiss target */}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Hide keyboard"
        className="mx-auto mb-1 block h-1 w-10 rounded-full bg-foreground/20 hover:bg-foreground/40"
      />

      <div className="mx-auto max-w-[820px] space-y-1.5">
        {rows.map((row, ri) => (
          <div key={ri} className="flex gap-1.5">
            {row.map((k, ki) => <Key key={ki} k={k} layout={layout} onChar={typeChar} onFn={handleFn} />)}
          </div>
        ))}
      </div>
    </div>
  );
}

interface KeyProps {
  k: Key;
  layout: "lower" | "upper" | "symbols";
  onChar: (c: string) => void;
  onFn: (fn: FnKey) => void;
}

function Key({ k, layout, onChar, onFn }: KeyProps) {
  if (typeof k === "string") {
    const isNumOrSym = layout === "symbols";
    return (
      <button
        type="button"
        onClick={() => onChar(k)}
        className={cn(
          "flex-1 h-12 sm:h-13 rounded-md border border-border bg-card text-foreground",
          "text-[17px] sm:text-[18px] font-medium leading-none",
          "active:bg-accent active:translate-y-px transition-colors",
          // Mono on numeric/symbol layer for legibility
          isNumOrSym && "font-mono font-semibold tracking-tight",
        )}
      >
        {k}
      </button>
    );
  }

  // Function keys — wider, muted by default, accent on Enter.
  const baseFn =
    "h-12 sm:h-13 rounded-md border border-border bg-muted text-foreground text-[13px] font-medium " +
    "leading-none active:bg-accent active:translate-y-px transition-colors flex items-center justify-center";

  switch (k.kind) {
    case "shift": {
      const active = layout === "upper";
      return (
        <button
          type="button"
          onClick={() => onFn({ kind: "shift" })}
          aria-label="Shift"
          className={cn(
            baseFn, "w-[12%] min-w-[44px]",
            active && "bg-foreground/[0.10] ring-1 ring-foreground/30",
          )}
        >
          ⇧
        </button>
      );
    }
    case "backspace":
      return (
        <button type="button" onClick={() => onFn({ kind: "backspace" })} aria-label="Backspace" className={cn(baseFn, "w-[12%] min-w-[44px]")}>
          <Backspace className="h-5 w-5" />
        </button>
      );
    case "space":
      return (
        <button type="button" onClick={() => onFn({ kind: "space" })} aria-label="Space" className={cn(baseFn, "flex-1 bg-card")}>
          {/* deliberately blank — the space bar reads as a long key */}
        </button>
      );
    case "enter":
      return (
        <button
          type="button"
          onClick={() => onFn({ kind: "enter" })}
          aria-label="Enter"
          className={cn(
            "h-12 sm:h-13 rounded-md border border-transparent text-[13px] font-semibold leading-none",
            "bg-primary text-primary-foreground hover:bg-primary/90",
            "active:translate-y-px transition-colors flex items-center justify-center gap-1.5",
            "w-[18%] min-w-[64px]",
          )}
        >
          <ArrowElbowDownLeft className="h-4 w-4" />
          Enter
        </button>
      );
    case "symbols":
      return (
        <button type="button" onClick={() => onFn({ kind: "symbols" })} className={cn(baseFn, "w-[14%] min-w-[52px] font-mono")}>
          123
        </button>
      );
    case "abc":
      return (
        <button type="button" onClick={() => onFn({ kind: "abc" })} className={cn(baseFn, "w-[14%] min-w-[52px]")}>
          ABC
        </button>
      );
  }
}
