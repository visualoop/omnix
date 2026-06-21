/**
 * Dashboard — newspaper-masthead editorial redesign.
 *
 * Design language (frontend-design + emil-design-eng + anti-slop-writing):
 *   - Cream paper background (#FBFAF6) — same as POS overview, P&L
 *   - Top strip: 'OMNIX · {MODULE} · {USER}' left, 'DATE · YEAR · TIME'
 *     right. Mono uppercase, tracking-[0.22em].
 *   - Hero: today's revenue in Fraunces serif at clamp(64 px, 11 vw, 140 px).
 *     Currency symbol set 18 px to its left, baseline-aligned. Italic
 *     'Open the day.' headline when revenue is zero.
 *   - Sub-deck: single editorial paragraph reading like a newspaper deck
 *     ('23 transactions, KSh 5 200 in mobile money, 3 low-stock items')
 *     instead of a 4-column KPI grid.
 *   - Action menu: keyboard rows ([S] new sale, [I] inventory, [C] customers,
 *     [R] reports, [Z] z-report). Each row has the kbd badge + Fraunces verb
 *     at 28 px + mono hint right-aligned.
 *   - Charts at the bottom — simpler treatment, hairline rules instead of
 *     card containers.
 *   - Phosphor icons throughout (Lucide gone).
 *   - motion/react: revenue figure fades in + slides up 8 px once on mount.
 *     useMotionValue count-up over 600 ms.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useMotionValue, useTransform, animate } from "motion/react";
import {
  ShoppingCart, Package, Users, ChartBar, Receipt,
} from "@phosphor-icons/react";
import {
  getDashboardKPIs, getSalesByDay, getTopProducts, getSalesByPaymentMethod,
  type DashboardKPIs, type SalesByDay, type TopProduct, type SalesByPaymentMethod,
} from "@/services/reports";
import { AreaChart, PieChart } from "@/components/charts";
import { useActiveBranch } from "@/stores/active-branch";
import { useActiveModule, MODULE_DEFINITIONS } from "@/stores/active-module";
import { useAuthStore } from "@/stores/auth";
import { useCountry } from "@/stores/country";
import { pharmacyTerm } from "@/lib/locale";
import { money } from "@/lib/money";

export function DashboardPage() {
  const navigate = useNavigate();
  const moduleId = useActiveModule((s) => s.active);
  const activeModule = MODULE_DEFINITIONS[moduleId];
  const user = useAuthStore((s) => s.user);
  const countryCode = useCountry((s) => s.code);
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [salesByDay, setSalesByDay] = useState<SalesByDay[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [paymentMix, setPaymentMix] = useState<SalesByPaymentMethod[]>([]);
  const [now, setNow] = useState(() => new Date());
  const activeBranchId = useActiveBranch((s) => s.active?.id);

  useEffect(() => {
    Promise.all([
      getDashboardKPIs(),
      getSalesByDay(7),
      getTopProducts(30, 5),
      getSalesByPaymentMethod(30),
    ]).then(([k, s, t, p]) => {
      setKpis(k);
      setSalesByDay(s);
      setTopProducts(t);
      setPaymentMix(p);
    }).catch(() => { /* DB not ready — silent */ });
  }, [activeBranchId]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Animated count-up for the hero figure.
  const mv = useMotionValue(0);
  const display = useTransform(mv, (n) => Math.round(n).toLocaleString());
  const target = kpis?.today_sales_total ?? 0;
  useEffect(() => {
    const c = animate(mv, target, { duration: 0.6, ease: [0.22, 1, 0.36, 1] });
    return () => c.stop();
  }, [target, mv]);

  // Keyboard shortcuts. S = new sale, I = inventory, C = customers, R = reports, Z = z-report.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const k = e.key.toLowerCase();
      if (k === "s") navigate("/pos/sale");
      else if (k === "i") navigate("/inventory");
      else if (k === "c") navigate("/customers");
      else if (k === "r") navigate("/analytics?tab=sales");
      else if (k === "z") navigate("/reports/zreport");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  const moduleLabel =
    moduleId === "dawa" ? pharmacyTerm(countryCode)
    : activeModule?.shortName ?? "Omnix";
  const dateMast = now.toLocaleDateString(undefined, {
    weekday: "long", day: "numeric", month: "long",
  }).toUpperCase();
  const yearMast = now.getFullYear();
  const timeMast = now.toLocaleTimeString(undefined, {
    hour: "2-digit", minute: "2-digit", hour12: false,
  });

  const todayCount = kpis?.today_sales_count ?? 0;
  const lowStock = kpis?.low_stock_count ?? 0;
  const expiringSoon = kpis?.expiring_count ?? 0;
  const cashOnHand = kpis?.cash_position ?? 0;

  return (
    <div className="min-h-[calc(100vh-48px)] -m-6 bg-[#FBFAF6] dark:bg-[#0a0a0a]">
      {/* ─── Masthead ────────────────────────────────── */}
      <header className="border-b border-foreground/15 px-8 md:px-14 py-3 flex items-baseline justify-between text-foreground/80">
        <div className="flex items-baseline gap-3 font-mono text-[10px] uppercase tracking-[0.22em]">
          <span className="font-semibold text-foreground">Omnix · {moduleLabel}</span>
          <span aria-hidden className="text-foreground/30">/</span>
          <span>{user?.full_name ?? "—"}</span>
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] tabular-nums">
          {dateMast} · {yearMast} · {timeMast}
        </div>
      </header>

      {/* ─── Hero — today's revenue ───────────────── */}
      <section className="px-8 md:px-14 pt-10 pb-12 md:pt-14 md:pb-16">
        <div className="max-w-[1100px]">
          <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-foreground/60">
            {todayCount > 0 ? "Today's take" : "Open the day"}
          </div>
          {todayCount > 0 ? (
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
                style={{ fontFamily: "var(--font-display, serif)" }}
                className="text-[clamp(64px,11vw,140px)] leading-[0.95] tracking-[-0.02em] font-medium tabular-nums"
              >
                <motion.span>{display}</motion.span>
              </span>
            </motion.div>
          ) : (
            <motion.h1
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              style={{ fontFamily: "var(--font-display, serif)" }}
              className="mt-3 text-[clamp(48px,8vw,100px)] leading-[0.95] tracking-[-0.02em] font-medium italic"
            >
              No sales yet today.
            </motion.h1>
          )}

          {/* Sub-deck — newspaper paragraph */}
          {kpis ? (
            <p className="mt-6 max-w-[60ch] text-[14px] leading-[1.6] text-foreground/75">
              {todayCount > 0 ? (
                <>
                  <Num n={todayCount} unit={todayCount === 1 ? "sale" : "sales"} /> rung,{" "}
                  <Money v={kpis.today_profit} /> in profit.{" "}
                  <Money v={cashOnHand} /> cash in the drawer.
                  {lowStock > 0 ? (
                    <> <Num n={lowStock} unit="items" /> low on stock.</>
                  ) : null}
                  {expiringSoon > 0 ? (
                    <> <Num n={expiringSoon} unit="lots" /> expiring soon.</>
                  ) : null}
                </>
              ) : (
                <>
                  Drawer holds <Money v={cashOnHand} />.{" "}
                  <Num n={kpis.total_products ?? 0} unit="products" /> on shelf,{" "}
                  <Num n={kpis.total_customers ?? 0} unit="customers" /> on file.
                  {lowStock > 0 ? <> <Num n={lowStock} unit="low" /> on stock.</> : null}
                </>
              )}
            </p>
          ) : null}
        </div>
      </section>

      {/* ─── Action menu — keyboard-led ────────────── */}
      <section className="px-8 md:px-14 pb-12">
        <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-foreground/60 pb-3 border-b border-foreground/15">
          Begin
        </div>
        <ul className="divide-y divide-foreground/10">
          <ActionRow k="S" label="New sale" hint="Open POS" icon={ShoppingCart} onClick={() => navigate("/pos/sale")} primary />
          <ActionRow k="I" label="Inventory" hint="Stock + categories" icon={Package} onClick={() => navigate("/inventory")} />
          <ActionRow k="C" label="Customers" hint="Member directory" icon={Users} onClick={() => navigate("/customers")} />
          <ActionRow k="R" label="Sales reports" hint="Last 30 days" icon={ChartBar} onClick={() => navigate("/analytics?tab=sales")} />
          <ActionRow k="Z" label="Z-Report" hint="End of day totals" icon={Receipt} onClick={() => navigate("/reports/zreport")} muted />
        </ul>
      </section>

      {/* ─── Charts — hairline rules, no cards ─────── */}
      {salesByDay.length > 0 || paymentMix.length > 0 || topProducts.length > 0 ? (
        <section className="px-8 md:px-14 pb-16 grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-10">
          {salesByDay.length > 0 ? (
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-foreground/60 pb-3 border-b border-foreground/15">
                Last 7 days
              </div>
              <div className="pt-4">
                <AreaChart data={salesByDay} xKey="date" yKey="total" height={200} />
              </div>
            </div>
          ) : null}

          {paymentMix.length > 0 ? (
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-foreground/60 pb-3 border-b border-foreground/15">
                Payment methods · 30 days
              </div>
              <div className="pt-4">
                <PieChart
                  data={paymentMix.map((p) => ({ name: p.method_name, value: p.total }))}
                  height={200}
                />
              </div>
            </div>
          ) : null}

          {topProducts.length > 0 ? (
            <div className="lg:col-span-2">
              <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-foreground/60 pb-3 border-b border-foreground/15">
                Top products · 30 days
              </div>
              <ul className="pt-2 divide-y divide-foreground/[0.06]">
                {topProducts.map((p, i) => (
                  <li key={p.product_id} className="flex items-baseline gap-3 py-2.5 text-[13px]">
                    <span className="font-mono text-[10px] tabular-nums text-foreground/40 w-6">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="flex-1 truncate text-foreground/85">{p.product_name}</span>
                    <span className="font-mono text-[11px] tabular-nums text-foreground/55">
                      ×{p.qty_sold}
                    </span>
                    <span className="font-mono tabular-nums w-24 text-right text-foreground">
                      {money(p.total_revenue)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function Num({ n, unit }: { n: number; unit: string }) {
  return (
    <span className="text-foreground font-medium tabular-nums">
      {n.toLocaleString()} {unit}
    </span>
  );
}
function Money({ v }: { v: number }) {
  return <span className="text-foreground font-medium tabular-nums">{money(v)}</span>;
}

interface ActionRowProps {
  k: string;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  primary?: boolean;
  muted?: boolean;
}
function ActionRow({ k, label, hint, icon: Icon, onClick, primary, muted }: ActionRowProps) {
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
        <Icon className={`size-5 ${primary ? "text-foreground" : "text-foreground/55"}`} />
        <span
          style={{ fontFamily: "var(--font-display, serif)" }}
          className={`text-[24px] md:text-[28px] leading-none font-medium ${
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
