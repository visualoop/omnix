/**
 * POS Overview — landing screen at /pos.
 *
 * Design thesis (frontend-design + emil-design-eng + anti-slop-writing):
 * The till is the operator's stage. Every morning they unlock the
 * drawer; every evening they count the cash. Between those two moments
 * the till does one thing: turn customers into transactions.
 *
 * The page treats today's revenue as the headline and today's date as
 * the masthead, the way a newspaper does. Numbers are typeset in a
 * display serif (Fraunces) at 96–112pt with tabular figures. Labels
 * are mono-caps, 11px. Action shortcuts are presented as keyboard hints
 * the way a terminal would — letters in a kbd, action verb in caps.
 *
 * Restraint:
 *   - No gradient backgrounds, no drop shadows, no card containers.
 *   - One accent — the open-sale CTA fills with --primary on hover only.
 *   - One animation — revenue figure fades in once on mount; nothing
 *     pulses, nothing loops.
 *
 * What we explicitly avoided:
 *   - The "big number on coloured card with TrendingUp icon" template.
 *   - 4-column stat grid as the page's visual centre.
 *   - "Vibrant" color combinations (emerald + amber + rose + primary).
 *   - Generic CTAs labelled "Get started" or "Begin selling".
 *
 * Off-limits chrome — anything inside this file is in scope; the lock
 * screen at /lock and the activation screen at /activate keep their
 * Apple liquid-glass aesthetic.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { useAuthStore } from "@/stores/auth";
import { useActiveModule, MODULE_DEFINITIONS } from "@/stores/active-module";
import { getOpenShift, type CashShift } from "@/services/accounting";
import { getTodaySalesSummary, type TodaySalesSummary } from "@/services/pos-helpers";
import { countHeldSales } from "@/services/held-sales";
import { OpenShiftDialog, CloseShiftDialog } from "@/components/pos/cash-dialogs";
import { useCountry } from "@/stores/country";
import { pharmacyTerm } from "@/lib/locale";
import { money } from "@/lib/money";
import { StatStrip } from "@/components/dashboard/stat-strip";
import { PosHeroArt } from "@/components/dashboard/hero-art";

export function POSOverviewPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const activeModuleId = useActiveModule((s) => s.active);
  const activeModule = MODULE_DEFINITIONS[activeModuleId];
  const countryCode = useCountry((s) => s.code);

  const [shift, setShift] = useState<CashShift | null>(null);
  const [todayStats, setTodayStats] = useState<TodaySalesSummary | null>(null);
  const [heldCount, setHeldCount] = useState(0);
  const [openShiftDialog, setOpenShiftDialog] = useState(false);
  const [closeShiftDialog, setCloseShiftDialog] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const load = async () => {
      const [s, today, held] = await Promise.all([
        user?.id ? getOpenShift(user.id) : Promise.resolve(null),
        getTodaySalesSummary(),
        countHeldSales(),
      ]);
      setShift(s);
      setTodayStats(today);
      setHeldCount(held);
    };
    void load();
    const tick = setInterval(load, 30_000);
    return () => clearInterval(tick);
  }, [user?.id, openShiftDialog, closeShiftDialog]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Keyboard shortcuts. S = open sale, R = returns, Z = z-report,
  // O = open shift, C = close shift, P = petty cash. Letters are shown
  // visually next to each action so the operator learns them.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const k = e.key.toLowerCase();
      if (k === "s" && shift) navigate("/pos/sale");
      else if (k === "r" && shift) navigate("/returns");
      else if (k === "z") navigate("/reports/zreport");
      else if (k === "x" && shift) {
        // X-report is instant — no dialog, just print. Cashiers use it
        // constantly mid-shift to spot-check their drawer against system.
        import("@/services/x-report").then(({ printXReport }) => printXReport()).catch(() => {})
      }
      else if (k === "o" && !shift) setOpenShiftDialog(true);
      else if (k === "c" && shift) setCloseShiftDialog(true);
      else if (k === "p" && shift) navigate("/petty-cash");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shift, navigate]);

  const moduleLabel =
    activeModuleId === "dawa" ? pharmacyTerm(countryCode)
    : activeModule?.shortName ?? "Point of Sale";
  const dateMast = now.toLocaleDateString(undefined, {
    weekday: "long", day: "numeric", month: "long",
  }).toUpperCase();
  const yearMast = now.getFullYear();
  const timeMast = now.toLocaleTimeString(undefined, {
    hour: "2-digit", minute: "2-digit", hour12: false,
  });

  return (
    <div className="min-h-[calc(100vh-48px)] -m-6 bg-[#FBFAF6] dark:bg-[#0a0a0a]">
      {/* ─── Masthead ───────────────────────────────────── */}
      {/* Newspaper header. Title left, date + clock right. */}
      <header className="border-b border-foreground/15 px-8 md:px-14 py-3 flex items-baseline justify-between text-foreground/80">
        <div className="flex items-baseline gap-3 font-mono text-[10px] uppercase tracking-[0.22em]">
          <span className="font-semibold text-foreground">Omnix · {moduleLabel}</span>
          <span aria-hidden className="text-foreground/30">/</span>
          <span>Cashier · {user?.full_name ?? "—"}</span>
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] tabular-nums">
          {dateMast} · {yearMast} · {timeMast}
        </div>
      </header>

      {/* ─── Hero — today's revenue as the headline ───── */}
      <section className="relative px-8 md:px-14 pt-12 pb-8 md:pt-16 md:pb-10">
        <div className="max-w-[1240px] grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
          {/* Left — the untouched giant KES headline (or the italic empty state) */}
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-foreground/60">
              {shift ? "Today's take" : "Drawer closed"}
            </div>
            {shift ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                className="mt-3 flex items-start gap-3"
              >
                <span className="font-mono text-[18px] mt-4 text-foreground/55 tabular-nums">
                  {money(0).replace(/[\d.,\s]/g, "").trim() || "KSh"}
                </span>
                <span
                  style={{ fontFamily: "var(--font-display)" }}
                  className="text-[clamp(64px,11vw,140px)] leading-[0.95] tracking-[-0.02em] font-medium tabular-nums"
                >
                  {(todayStats?.revenue ?? 0).toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })}
                </span>
              </motion.div>
            ) : (
              <>
                <motion.h1
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  style={{ fontFamily: "var(--font-display)" }}
                  className="mt-3 text-[clamp(48px,8vw,100px)] leading-[0.95] tracking-[-0.02em] font-medium italic"
                >
                  Open the drawer.
                </motion.h1>
                <p className="mt-5 max-w-[42ch] text-[14px] leading-[1.55] text-foreground/70">
                  Punch in the opening float below. That&rsquo;s what you&rsquo;ll reconcile against at close.
                </p>
              </>
            )}
          </div>

          {/* Right — stat strip on top of receipt+drawer art */}
          <div className="relative min-h-[220px] lg:min-h-[280px]">
            <PosHeroArt />
            {shift && todayStats ? (
              <div className="relative">
                <StatStrip
                  cells={[
                    { label: "Sales", value: todayStats.count.toLocaleString() },
                    { label: "Cash", value: <Money v={todayStats.cash} /> },
                    { label: "M-Pesa", value: <Money v={todayStats.mpesa} /> },
                    ...(heldCount > 0
                      ? [{ label: "On hold", value: String(heldCount), tone: "critical" as const }]
                      : []),
                    {
                      label: "Opened at",
                      value: new Date(shift.opened_at).toLocaleTimeString(undefined, {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      }),
                      tone: "muted",
                    },
                    {
                      label: "Float",
                      value: <Money v={shift.opening_balance} />,
                      tone: "muted",
                    },
                  ]}
                />
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* ─── Action menu — keyboard-led ───────────────── */}
      <section className="px-8 md:px-14 pb-12">
        <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-foreground/60 pb-3 border-b border-foreground/15">
          Begin
        </div>
        <ul className="divide-y divide-foreground/10">
          {shift ? (
            <>
              <ActionRow k="S" label="Open sale" hint="Take money" onClick={() => navigate("/pos/sale")} primary />
              <ActionRow k="R" label="Returns" hint="Refund a sale" onClick={() => navigate("/returns")} />
              <ActionRow k="P" label="Petty cash" hint="In or out of the drawer" onClick={() => navigate("/petty-cash")} />
              <ActionRow k="Z" label="Z-Report" hint="End-of-day totals" onClick={() => navigate("/reports/zreport")} />
              <ActionRow
                k="X"
                label="X-Report"
                hint="Live shift snapshot (no reset)"
                onClick={async () => {
                  const { printXReport } = await import("@/services/x-report")
                  await printXReport()
                }}
              />
              {heldCount > 0 ? (
                <ActionRow
                  k="H"
                  label={`Resume held · ${heldCount}`}
                  hint="Pick up parked tickets"
                  onClick={() => navigate("/pos/sale?held=1")}
                />
              ) : null}
              <ActionRow k="C" label="Close day" hint="End shift" onClick={() => setCloseShiftDialog(true)} muted />
            </>
          ) : (
            <>
              <ActionRow k="O" label="Open shift" hint="Set the opening float" onClick={() => setOpenShiftDialog(true)} primary />
              <ActionRow k="Z" label="Z-Report (last)" hint="Read yesterday's close" onClick={() => navigate("/reports/zreport")} />
            </>
          )}
        </ul>
      </section>

      <OpenShiftDialog
        open={openShiftDialog}
        onClose={() => setOpenShiftDialog(false)}
        onOpened={async () => {
          setOpenShiftDialog(false);
          if (user?.id) setShift(await getOpenShift(user.id));
        }}
      />
      <CloseShiftDialog
        open={closeShiftDialog}
        onClose={() => setCloseShiftDialog(false)}
        onClosed={async () => {
          setCloseShiftDialog(false);
          if (user?.id) setShift(await getOpenShift(user.id));
        }}
      />
    </div>
  );
}

function Money({ v }: { v: number }) {
  return <span className="text-foreground font-medium tabular-nums">{money(v)}</span>;
}

interface ActionRowProps {
  k: string;
  label: string;
  hint: string;
  onClick: () => void;
  primary?: boolean;
  muted?: boolean;
}

function ActionRow({ k, label, hint, onClick, primary, muted }: ActionRowProps) {
  return (
    <li>
      <button
        onClick={onClick}
        className={`group flex w-full items-baseline gap-5 py-5 text-left transition-colors ${
          muted ? "text-foreground/60 hover:text-foreground" : "hover:bg-foreground/[0.02]"
        }`}
      >
        <kbd
          className={`font-mono text-[11px] tracking-[0.06em] inline-flex h-7 min-w-[28px] items-center justify-center rounded border px-1.5 ${
            primary
              ? "border-foreground bg-foreground text-background"
              : "border-foreground/30 bg-transparent text-foreground/70 group-hover:border-foreground group-hover:text-foreground"
          }`}
        >
          {k}
        </kbd>
        <span
          style={{ fontFamily: "var(--font-display)" }}
          className={`text-[28px] md:text-[32px] leading-none font-medium ${
            primary ? "text-foreground" : "text-foreground/85 group-hover:text-foreground"
          } transition-colors`}
        >
          {label}
        </span>
        <span className="ml-auto pl-6 font-mono text-[11px] uppercase tracking-[0.18em] text-foreground/50">
          {hint}
        </span>
      </button>
    </li>
  );
}
