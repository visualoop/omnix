import { useNavigate } from "react-router-dom";
import {
  Package,
  Pill,
  CheckCircle2,
  Clock,
  Cpu,
  Wrench,
  UtensilsCrossed,
  ShoppingBag,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { APP_NAME, BRAND } from "@/lib/brand";
import { isModuleEntitled } from "@/stores/entitlements";
import { IS_PRO, MODULES_ALLOWED, VARIANT_NAME } from "@/lib/variant";

interface Module {
  id: string;
  name: string;
  description: string;
  icon: typeof Package;
  status: "core" | "installed" | "planned";
  features: string[];
  routes?: string[];
}

const MODULES: Module[] = [
  {
    id: "core",
    name: "Core",
    description: `Foundation every ${APP_NAME} install includes — inventory, POS, customers, suppliers, accounting.`,
    icon: Cpu,
    status: "core",
    features: [
      "Inventory with batches & expiry",
      "Point of Sale (POS) with M-Pesa, cash, bank, credit",
      "Sales returns & refunds",
      "Customers with credit limits",
      "Suppliers with payable balances",
      "Purchase orders & goods received notes",
      "Stock take with variance adjustment",
      "Expenses, P&L, cash register",
      "KRA eTIMS auto-signing",
      "Per-machine licensing",
      "Auto-backup, audit log, LAN sync",
    ],
    routes: ["/", "/pos", "/sales", "/inventory", "/suppliers", "/customers", "/purchase-orders", "/stock-take", "/returns"],
  },
  {
    id: "dawa",
    name: "Dawa (Pharmacy)",
    description: "Pharmacy-specific extensions: prescriptions, expiry alerts, drug safety, patient profiles.",
    icon: Pill,
    status: "installed",
    features: [
      "Prescriptions with prescriber tracking",
      "Expiry alerts (30/60/90 day windows)",
      "Controlled substances log + statutory daily register",
      "Drug-drug + drug-allergy warnings",
      "Patient profiles: allergies, conditions, medications",
      "Pharmacist on duty (PPB-licensed) tracking",
      "SHA + private insurance claims",
      "VAT exemption for medicaments",
      "Pharmacy-specific HS codes for KRA",
    ],
    routes: ["/pharmacy", "/pharmacy/expiry", "/pharmacy/controlled-register", "/claims", "/patients/:id"],
  },
  {
    id: "retail",
    name: "Omnix Retail",
    description: "General retail: cosmetics, mini-marts, dukas, gift shops. Variants, brands, laybys.",
    icon: ShoppingBag,
    status: "installed",
    features: [
      "Brands with country of origin",
      "Product variants (color, size, shade)",
      "Tiered pricing (retail/wholesale/staff/VIP)",
      "Layby (pay-in-installments) with deposit + balance tracking",
      "Special orders / pre-orders",
      "Shrinkage tracking with cost analysis",
      "Per-customer price-list assignment",
    ],
    routes: ["/retail/brands", "/retail/laybys", "/retail/special-orders", "/retail/shrinkage"],
  },
  {
    id: "hardware",
    name: "Hardware Store",
    description: "Bulk pricing tiers, parts catalog, contractor accounts, project-based sales.",
    icon: Wrench,
    status: "installed",
    features: [
      "Quotations → convert to sale",
      "Delivery notes with dispatch tracking",
      "Contractor accounts with credit & aging",
      "Tiered / contractor pricing",
      "Sales commissions",
    ],
    routes: ["/hardware/dashboard", "/hardware/quotations", "/hardware/delivery-notes", "/hardware/accounts", "/hardware/commissions", "/hardware/reports"],
  },
  {
    id: "hospitality",
    name: "Omnix Hospitality",
    description: "Restaurant POS, kitchen display, rooms, bookings, folios, recipe costing.",
    icon: UtensilsCrossed,
    status: "installed",
    features: [
      "Table floor plan & order lifecycle",
      "Kitchen display with bump",
      "Service charge, tips & split bills",
      "Rooms, bookings, check-in/out & folios",
      "Recipes, food-cost % & reports",
    ],
    routes: ["/hospitality/dashboard", "/hospitality/tables", "/hospitality/orders", "/hospitality/kitchen", "/hospitality/rooms", "/hospitality/bookings", "/hospitality/folios", "/hospitality/reports"],
  },
];

export function ModulesPage() {
  const navigate = useNavigate();
  // Trade variants only ship one module; filter to it + core.
  const visibleModules = IS_PRO
    ? MODULES
    : MODULES.filter((m) => MODULES_ALLOWED.includes(m.id));

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/settings")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Modules</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {IS_PRO
              ? `${VARIANT_NAME} is a modular platform. Core ships in every install; verticals plug in on top.`
              : `This is ${VARIANT_NAME} — built specifically for one trade. To run multiple trades from one app, install Omnix Pro.`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {visibleModules.map((m) => (
          <ModuleCard key={m.id} module={m} />
        ))}
      </div>

      {!IS_PRO && (
        <div className="border border-border rounded-lg p-4 bg-primary/5">
          <h3 className="text-sm font-semibold mb-2">Need another trade?</h3>
          <p className="text-xs text-muted-foreground">
            Omnix Pro is the multi-trade variant — it bundles Dawa (Pharmacy), Retail, Hospitality and Hardware in
            one binary. If your business spans more than one of those, switch to Pro from{" "}
            <a href={`https://${BRAND.company.domain}/pro`} className="text-primary underline">{BRAND.company.domain}/pro</a>.
          </p>
        </div>
      )}

      {IS_PRO && (
        <div className="border border-border rounded-lg p-4 bg-muted/20">
          <h3 className="text-sm font-semibold mb-2">Want a different vertical?</h3>
          <p className="text-xs text-muted-foreground">
            Modules are added by {APP_NAME} releases — they don't require reinstalling. If you need a
            vertical that's not yet built, contact us at{" "}
            <a href={`mailto:hello@${BRAND.company.domain}`} className="text-primary underline">hello@{BRAND.company.domain}</a>.
          </p>
        </div>
      )}
    </div>
  );
}

function ModuleCard({ module }: { module: Module }) {
  const licensed = isModuleEntitled(module.id);
  return (
    <div className={`border rounded-lg p-4 ${
      module.status === "core" ? "border-primary/50 bg-primary/5" :
      module.status === "installed" ? "border-green-500/30 bg-green-500/5" :
      "border-border"
    }`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-3">
          <div className={`h-10 w-10 rounded-md flex items-center justify-center shrink-0 ${
            module.status === "core" ? "bg-primary/20 text-primary" :
            module.status === "installed" ? "bg-green-500/20 text-green-700" :
            "bg-muted/30 text-muted-foreground"
          }`}>
            <module.icon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">{module.name}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{module.description}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <ModuleBadge status={module.status} />
          {module.id !== "core" && (
            <Badge
              variant="outline"
              className={licensed ? "border-emerald-500/50 text-emerald-700" : "text-muted-foreground"}
            >
              {licensed ? "Licensed" : "Not on licence"}
            </Badge>
          )}
        </div>
      </div>

      <ul className="space-y-1 mt-3">
        {module.features.map((f) => (
          <li key={f} className="text-xs flex items-start gap-1.5">
            <span className={`mt-1 h-1 w-1 rounded-full shrink-0 ${
              module.status === "planned" ? "bg-muted-foreground" : "bg-primary"
            }`} />
            <span className={module.status === "planned" ? "text-muted-foreground" : ""}>{f}</span>
          </li>
        ))}
      </ul>

      {module.status === "planned" && (
        <p className="text-xs text-muted-foreground italic mt-3 border-t border-border pt-2">
          Roadmap — not yet shipping
        </p>
      )}
    </div>
  );
}

function ModuleBadge({ status }: { status: Module["status"] }) {
  if (status === "core") {
    return (
      <Badge variant="outline" className="border-primary/50 text-primary">
        <CheckCircle2 className="h-3 w-3 mr-1" /> Core
      </Badge>
    );
  }
  if (status === "installed") {
    return (
      <Badge className="bg-green-600 hover:bg-green-600">
        <CheckCircle2 className="h-3 w-3 mr-1" /> Installed
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground">
      <Clock className="h-3 w-3 mr-1" /> Planned
    </Badge>
  );
}
