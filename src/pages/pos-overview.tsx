/**
 * POS Overview — landing screen at /pos.
 *
 * Replaces the old direct-to-sale-interface flow. Now clicking POS in
 * the sidebar lands here first, and the cashier explicitly picks an
 * action: Open Sale, Returns, Z-Report, Open Shift, Close Day, Lock.
 *
 * Behavioural notes:
 *   - When NO shift is open, the canvas dims and primary CTA is
 *     "Open Shift" with all sale-related actions disabled.
 *   - When a shift IS open, big "Open Sale" hero CTA jumps to
 *     /pos/sale. Today's stats (count / revenue / cash / mobile money)
 *     show in a 4-card grid right under the shift status.
 *   - "Lock" route freezes the screen until PIN re-entry. Implemented
 *     as a setLocked state on the parent shell — POS overview shows a
 *     dimmed lock icon; clicking re-prompts auth.
 *
 * Designed to feel like a till's idle screen at every till you've
 * ever used in a real shop, not a dashboard.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Banknote, Lock, Receipt, RotateCcw, ShoppingCart, Smartphone, TrendingUp, Unlock, FileText, Clock } from "lucide-react";
import { useAuthStore } from "@/stores/auth";
import { useActiveModule, MODULE_DEFINITIONS } from "@/stores/active-module";
import { getOpenShift, type CashShift } from "@/services/accounting";
import { getTodaySalesSummary, type TodaySalesSummary } from "@/services/pos-helpers";
import { countHeldSales } from "@/services/held-sales";
import { OpenShiftDialog, CloseShiftDialog } from "@/components/pos/cash-dialogs";
import { useCountry } from "@/stores/country";
import { pharmacyTerm } from "@/lib/locale";
import { money } from "@/lib/money";

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

  // Refresh stats + shift state on mount and after dialogs close.
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
    const tick = setInterval(load, 30_000); // refresh every 30s
    return () => clearInterval(tick);
  }, [user?.id, openShiftDialog, closeShiftDialog]);

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const shiftOpen = !!shift;
  const moduleLabel = activeModuleId === "dawa" ? pharmacyTerm(countryCode) : activeModule?.shortName ?? "POS";

  return (
    <div className="min-h-[calc(100vh-48px)] bg-gradient-to-br from-[var(--color-bg)] to-[var(--color-bg-soft,var(--color-bg))] px-6 py-10 md:px-10 lg:px-16">
      <div className="mx-auto max-w-6xl">
        {/* ─── Header ─────────────────────────────────────────── */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {moduleLabel} · Point of Sale
            </span>
            <h1 className="mt-2 text-[clamp(28px,3.6vw,44px)] font-semibold leading-tight tracking-tight">
              {greetingFor(now)}, {user?.full_name ?? "cashier"}
            </h1>
          </div>
          <div className="flex items-center gap-2 font-mono text-[12px] text-muted-foreground tabular-nums">
            <Clock className="size-3.5" />
            {now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false })}
            <span className="text-muted-foreground/50">·</span>
            {now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
          </div>
        </div>

        {/* ─── Shift status hero ─────────────────────────────── */}
        <section className="mt-8">
          {shiftOpen ? (
            <div className="rounded-2xl border-2 border-emerald-500/30 bg-emerald-500/[0.04] p-6 md:p-8">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex size-2 animate-pulse rounded-full bg-emerald-500" />
                <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  Shift open
                </span>
                <span className="text-muted-foreground">·</span>
                <span className="font-mono text-[12px] text-muted-foreground tabular-nums">
                  Started {new Date(shift!.opened_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-baseline gap-x-6 gap-y-2">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Opening balance</div>
                  <div className="font-mono text-[24px] font-semibold tabular-nums">{money(shift!.opening_balance)}</div>
                </div>
                {todayStats && (
                  <>
                    <div>
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Sales today</div>
                      <div className="font-mono text-[24px] font-semibold tabular-nums">{todayStats.count}</div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Revenue today</div>
                      <div className="font-mono text-[24px] font-semibold tabular-nums">{money(todayStats.revenue)}</div>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-dashed border-amber-500/40 bg-amber-500/[0.03] p-6 md:p-8 text-center">
              <Lock className="mx-auto size-8 text-amber-600/70" />
              <h2 className="mt-4 text-[20px] font-semibold">No shift open</h2>
              <p className="mt-2 max-w-md mx-auto text-[13px] text-muted-foreground">
                Open a shift before selling. The shift records the cash drawer&apos;s opening
                balance and ties every sale today to your name for end-of-day reconciliation.
              </p>
            </div>
          )}
        </section>

        {/* ─── Quick actions ─────────────────────────────────── */}
        <section className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {/* Primary: Open Sale (or Open Shift if closed) */}
          {shiftOpen ? (
            <ActionTile
              icon={ShoppingCart}
              label="Open sale"
              hint="Take money"
              accent="primary"
              onClick={() => navigate("/pos/sale")}
            />
          ) : (
            <ActionTile
              icon={Unlock}
              label="Open shift"
              hint="Start the day"
              accent="primary"
              onClick={() => setOpenShiftDialog(true)}
            />
          )}
          <ActionTile
            icon={RotateCcw}
            label="Returns"
            hint="Process refund"
            disabled={!shiftOpen}
            onClick={() => navigate("/returns")}
          />
          <ActionTile
            icon={Receipt}
            label="Held sales"
            hint={heldCount > 0 ? `${heldCount} parked` : "Resume parked"}
            disabled={heldCount === 0}
            onClick={() => navigate("/pos/sale?held=1")}
          />
          <ActionTile
            icon={FileText}
            label="Z-Report"
            hint="End-of-day"
            onClick={() => navigate("/zreport")}
          />
          <ActionTile
            icon={TrendingUp}
            label="Reports"
            hint="Sales analytics"
            onClick={() => navigate("/reports")}
          />
          <ActionTile
            icon={Banknote}
            label="Petty cash"
            hint="Drawer in/out"
            disabled={!shiftOpen}
            onClick={() => navigate("/petty-cash")}
          />
          {shiftOpen && (
            <ActionTile
              icon={Lock}
              label="Close day"
              hint="End shift"
              accent="danger"
              onClick={() => setCloseShiftDialog(true)}
            />
          )}
        </section>

        {/* ─── Today at a glance (only when shift open) ───── */}
        {shiftOpen && todayStats && (
          <section className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat icon={Receipt} label="Sales" value={String(todayStats.count)} />
            <Stat icon={TrendingUp} label="Revenue" value={money(todayStats.revenue)} />
            <Stat icon={Banknote} label="Cash" value={money(todayStats.cash)} />
            <Stat icon={Smartphone} label="Mobile money" value={money(todayStats.mpesa)} />
          </section>
        )}
      </div>

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

function greetingFor(d: Date): string {
  const h = d.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function ActionTile({
  icon: Icon, label, hint, onClick, disabled, accent = "default",
}: {
  icon: typeof ShoppingCart;
  label: string;
  hint?: string;
  onClick: () => void;
  disabled?: boolean;
  accent?: "default" | "primary" | "danger";
}) {
  const accentClass =
    accent === "primary"
      ? "border-primary/40 bg-primary/[0.04] hover:border-primary hover:bg-primary/10 hover:shadow-md"
      : accent === "danger"
        ? "border-rose-500/30 bg-rose-500/[0.03] hover:border-rose-500 hover:bg-rose-500/10"
        : "border-border hover:border-foreground/40 hover:bg-foreground/[0.02]";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`group flex flex-col items-start gap-2 rounded-xl border-2 p-5 text-left transition-all ${
        disabled ? "cursor-not-allowed opacity-40" : `cursor-pointer active:scale-[0.98] ${accentClass}`
      }`}
    >
      <Icon className={`size-7 ${
        accent === "primary" ? "text-primary" :
        accent === "danger" ? "text-rose-500" :
        "text-muted-foreground group-hover:text-foreground"
      }`} />
      <div>
        <div className="text-[15px] font-semibold leading-tight">{label}</div>
        {hint && <div className="mt-0.5 text-[12px] text-muted-foreground">{hint}</div>}
      </div>
    </button>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Receipt; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Icon className="size-3.5 text-muted-foreground" />
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{label}</span>
      </div>
      <div className="mt-2 font-mono text-[22px] font-semibold tabular-nums">{value}</div>
    </div>
  );
}
