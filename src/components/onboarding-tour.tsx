/**
 * First-Run Onboarding Tour
 *
 * Self-contained tour that highlights key UI areas after first login.
 * No external library — uses a portal'd dim layer + tooltip pointing
 * to a target element selector. State persisted in localStorage so it
 * runs once per user.
 */
import { useEffect, useState } from "react";
import { X, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

const TOUR_KEY = "omnix-onboarding-completed-v1";

interface TourStep {
  selector: string;
  title: string;
  body: string;
  placement: "right" | "bottom" | "left" | "top";
}

const STEPS: TourStep[] = [
  {
    selector: 'aside[class*="bg-sidebar"]',
    title: "Navigation",
    body: "All major sections of your business — Dashboard, POS, Inventory, Pharmacy, Reports — are here. Click any item or the toggle at the bottom to collapse for more screen space.",
    placement: "right",
  },
  {
    selector: '[data-tour="cmd-k"]',
    title: "Universal Search",
    body: "Press Cmd+K (or Ctrl+K) anywhere to jump to a page or find a product, customer, sale, or prescription instantly.",
    placement: "right",
  },
  {
    selector: 'a[href="/pos"]',
    title: "Start a Sale at POS",
    body: "The Point of Sale is the heart of your day. Press F2 to open it, F4 to take payment. Park a sale to come back later.",
    placement: "right",
  },
  {
    selector: 'a[href="/reports"]',
    title: "End-of-Day Reports",
    body: "Run the Z-Report at end of shift for cash reconciliation. Also includes P&L, sales analytics, and inventory valuation.",
    placement: "right",
  },
  {
    selector: 'a[href="/settings"]',
    title: "Settings",
    body: "Configure your business info, eTIMS credentials, backup, users, and licensing here. The Modules page lists which verticals are active.",
    placement: "right",
  },
];

export function OnboardingTour() {
  const [step, setStep] = useState(0);
  const [running, setRunning] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const completed = localStorage.getItem(TOUR_KEY);
    if (!completed) {
      // Wait for layout to settle
      const t = setTimeout(() => setRunning(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  useEffect(() => {
    if (!running) return;
    const update = () => {
      const sel = STEPS[step]?.selector;
      if (!sel) return;
      const el = document.querySelector(sel);
      if (el) {
        setTargetRect(el.getBoundingClientRect());
      } else {
        setTargetRect(null);
      }
    };
    update();
    const id = setInterval(update, 200);
    window.addEventListener("resize", update);
    return () => {
      clearInterval(id);
      window.removeEventListener("resize", update);
    };
  }, [step, running]);

  if (!running) return null;

  const finish = () => {
    localStorage.setItem(TOUR_KEY, new Date().toISOString());
    setRunning(false);
  };

  const next = () => {
    if (step >= STEPS.length - 1) finish();
    else setStep(step + 1);
  };

  const cur = STEPS[step];

  // Tooltip positioning
  let tipStyle: React.CSSProperties = { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
  if (targetRect) {
    if (cur.placement === "right") {
      tipStyle = {
        top: targetRect.top + targetRect.height / 2,
        left: targetRect.right + 16,
        transform: "translateY(-50%)",
      };
    } else if (cur.placement === "bottom") {
      tipStyle = {
        top: targetRect.bottom + 16,
        left: targetRect.left + targetRect.width / 2,
        transform: "translateX(-50%)",
      };
    } else if (cur.placement === "left") {
      tipStyle = {
        top: targetRect.top + targetRect.height / 2,
        left: targetRect.left - 16,
        transform: "translate(-100%, -50%)",
      };
    } else if (cur.placement === "top") {
      tipStyle = {
        top: targetRect.top - 16,
        left: targetRect.left + targetRect.width / 2,
        transform: "translate(-50%, -100%)",
      };
    }
  }

  // Highlight cutout
  const highlight = targetRect ? {
    top: targetRect.top - 4,
    left: targetRect.left - 4,
    width: targetRect.width + 8,
    height: targetRect.height + 8,
  } : null;

  return (
    <div className="fixed inset-0 z-[100] pointer-events-auto">
      {/* Dim overlay (with cutout if target found) */}
      <div className="absolute inset-0 bg-black/60" onClick={finish} />
      {highlight && (
        <div
          className="absolute rounded-lg ring-2 ring-primary pointer-events-none animate-pulse"
          style={{
            top: highlight.top,
            left: highlight.left,
            width: highlight.width,
            height: highlight.height,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.6)",
          }}
        />
      )}

      {/* Tooltip card */}
      <div
        className="absolute bg-popover border border-border rounded-lg shadow-2xl w-[320px] p-4 z-[101]"
        style={tipStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground">
            Step {step + 1} of {STEPS.length}
          </span>
          <button
            onClick={finish}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Skip tour"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <h3 className="font-semibold text-base">{cur.title}</h3>
        <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{cur.body}</p>

        <div className="flex items-center gap-1 mt-4">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-muted"}`}
            />
          ))}
        </div>

        <div className="flex justify-between items-center mt-4">
          <button
            onClick={finish}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Skip
          </button>
          <Button size="sm" onClick={next}>
            {step >= STEPS.length - 1 ? (
              <>Finish <Check className="h-3.5 w-3.5 ml-1.5" /></>
            ) : (
              <>Next <ArrowRight className="h-3.5 w-3.5 ml-1.5" /></>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Manually re-trigger the tour (for Settings → Help → Show tour). */
export function resetOnboardingTour() {
  localStorage.removeItem(TOUR_KEY);
  window.location.reload();
}
