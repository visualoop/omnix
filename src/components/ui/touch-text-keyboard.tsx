/**
 * TouchTextKeyboard — slide-up QWERTY keyboard for touch/POS terminals.
 *
 * The numeric TouchKeypad already covers amount/qty inputs. This is its
 * text counterpart: when a TEXT input/textarea is focused in touch
 * density, a QWERTY panel slides up so the cashier can type names,
 * references, notes etc. without a physical keyboard.
 *
 * Built on `simple-keyboard` but skinned to match Omnix's editorial
 * chrome (hairline borders, flat keys, no candy gradients) via the
 * `omnix-kbd` theme in the inline <style> below — simple-keyboard's
 * default CSS would clash with the rest of the app.
 *
 * Behaviour:
 *   - Renders only when useIsTouch() is true AND `open`.
 *   - Writes directly into the bound input via native value setter +
 *     dispatched input event, so React controlled inputs update.
 *   - Shift / caps, a 123?# numeric-symbols layer, space, ⌫, and Enter
 *     (Enter calls onEnter, default blurs the field to dismiss).
 *   - Tapping outside dismisses.
 */
import { useEffect, useRef, useState } from "react";
import Keyboard from "simple-keyboard";
import "simple-keyboard/build/css/index.css";
import { useIsTouch } from "@/stores/density";

interface Props {
  /** The text input/textarea the keyboard types into. */
  inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  open: boolean;
  onDismiss?: () => void;
  onEnter?: () => void;
}

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
  const touch = useIsTouch();
  const containerRef = useRef<HTMLDivElement>(null);
  const kbdRef = useRef<Keyboard | null>(null);
  const [layoutName, setLayoutName] = useState<"default" | "shift" | "symbols">("default");

  useEffect(() => {
    if (!touch || !open) return;
    if (!containerRef.current) return;

    const kbd = new Keyboard(containerRef.current, {
      onChange: (input: string) => {
        if (inputRef.current) setNativeValue(inputRef.current, input);
      },
      onKeyPress: (button: string) => {
        if (button === "{shift}" || button === "{lock}") {
          setLayoutName((l) => (l === "default" ? "shift" : "default"));
        } else if (button === "{numbers}") {
          setLayoutName("symbols");
        } else if (button === "{abc}") {
          setLayoutName("default");
        } else if (button === "{enter}") {
          onEnter ? onEnter() : inputRef.current?.blur();
        }
      },
      layoutName,
      mergeDisplay: true,
      display: {
        "{bksp}": "⌫",
        "{enter}": "return",
        "{shift}": "⇧",
        "{lock}": "⇪",
        "{space}": "space",
        "{numbers}": "123",
        "{abc}": "ABC",
      },
      layout: {
        default: [
          "q w e r t y u i o p",
          "a s d f g h j k l",
          "{shift} z x c v b n m {bksp}",
          "{numbers} {space} {enter}",
        ],
        shift: [
          "Q W E R T Y U I O P",
          "A S D F G H J K L",
          "{shift} Z X C V B N M {bksp}",
          "{numbers} {space} {enter}",
        ],
        symbols: [
          "1 2 3 4 5 6 7 8 9 0",
          "- / : ; ( ) & @ \"",
          ". , ? ! ' {bksp}",
          "{abc} {space} {enter}",
        ],
      },
    });
    kbdRef.current = kbd;

    // Seed the keyboard with the input's current value so editing
    // continues rather than wiping the field.
    if (inputRef.current) kbd.setInput(inputRef.current.value);

    return () => {
      kbd.destroy();
      kbdRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [touch, open]);

  // Keep simple-keyboard's internal layout in sync with our state.
  useEffect(() => {
    kbdRef.current?.setOptions({ layoutName });
  }, [layoutName]);

  if (!touch || !open) return null;

  return (
    <>
      {/* dismiss scrim */}
      <div className="fixed inset-0 z-[90]" onMouseDown={onDismiss} aria-hidden />
      <div className="fixed bottom-0 left-0 right-0 z-[91] border-t border-border bg-background/95 backdrop-blur-md p-2 omnix-kbd">
        <div ref={containerRef} />
      </div>
      <style>{`
        .omnix-kbd .simple-keyboard {
          background: transparent;
          font-family: inherit;
          padding: 0;
        }
        .omnix-kbd .simple-keyboard .hg-row { gap: 6px; margin-bottom: 6px; }
        .omnix-kbd .simple-keyboard .hg-button {
          height: 52px;
          border-radius: 8px;
          border: 1px solid hsl(var(--border));
          background: hsl(var(--card));
          color: hsl(var(--foreground));
          box-shadow: none;
          font-size: 18px;
          font-weight: 500;
        }
        .omnix-kbd .simple-keyboard .hg-button:active {
          background: hsl(var(--accent));
          transform: translateY(1px);
        }
        .omnix-kbd .simple-keyboard .hg-button.hg-functionBtn {
          background: hsl(var(--muted));
          font-size: 14px;
        }
        .omnix-kbd .simple-keyboard .hg-button[data-skbtn="{space}"] { max-width: none; flex-grow: 4; }
        .omnix-kbd .simple-keyboard .hg-button[data-skbtn="{enter}"] {
          background: hsl(var(--primary));
          color: hsl(var(--primary-foreground));
        }
      `}</style>
    </>
  );
}
