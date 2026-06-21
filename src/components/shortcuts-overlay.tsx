import { useEffect, useState } from "react";
import {
  Keyboard as Keyboard,
  X,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

interface Shortcut {
  keys: string[];
  description: string;
}

interface Section {
  title: string;
  shortcuts: Shortcut[];
}

const SECTIONS: Section[] = [
  {
    title: "Global",
    shortcuts: [
      { keys: ["⌘", "K"], description: "Open command palette / universal search" },
      { keys: ["?"], description: "Show this keyboard shortcuts overlay" },
      { keys: ["Esc"], description: "Close any open dialog" },
    ],
  },
  {
    title: "POS (Point of Sale)",
    shortcuts: [
      { keys: ["F1"], description: "Clear cart" },
      { keys: ["F2"], description: "Focus product search" },
      { keys: ["F4"], description: "Open payment dialog" },
      { keys: ["Enter"], description: "Add first matching product" },
      { keys: ["+", "-"], description: "Adjust quantity of last added item" },
    ],
  },
  {
    title: "Navigation",
    shortcuts: [
      { keys: ["⌘", "K"], description: "Jump to any page" },
      { keys: ["G", "D"], description: "Go to Dashboard" },
      { keys: ["G", "P"], description: "Go to POS" },
      { keys: ["G", "I"], description: "Go to Inventory" },
      { keys: ["G", "R"], description: "Go to Reports" },
    ],
  },
  {
    title: "Tables & Lists",
    shortcuts: [
      { keys: ["/"], description: "Focus the search input" },
      { keys: ["↑", "↓"], description: "Navigate rows" },
      { keys: ["Enter"], description: "Open selected item" },
    ],
  },
];

export function ShortcutsOverlay() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Shift + ? (which is just `?` on most layouts)
      if (e.key === "?" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const target = e.target as HTMLElement;
        // Don't trigger inside text inputs
        if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable) {
          return;
        }
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-background border border-border rounded-lg w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h2 className="font-semibold flex items-center gap-2">
            <Keyboard className="h-4 w-4 text-primary" /> Keyboard Shortcuts
          </h2>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-auto p-5 space-y-5">
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                {section.title}
              </h3>
              <div className="space-y-1.5">
                {section.shortcuts.map((s, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-sm py-1.5 px-2 rounded hover:bg-accent/30"
                  >
                    <span>{s.description}</span>
                    <div className="flex items-center gap-1">
                      {s.keys.map((k, i) => (
                        <span key={i} className="flex items-center gap-1">
                          {i > 0 && <span className="text-muted-foreground text-xs">+</span>}
                          <kbd className="px-1.5 py-0.5 text-xs font-mono bg-muted border border-border rounded">
                            {k}
                          </kbd>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-border px-5 py-3 text-xs text-muted-foreground text-center">
          Press <kbd className="px-1 py-0.5 bg-muted border border-border rounded">?</kbd> to toggle this overlay
        </div>
      </div>
    </div>
  );
}
