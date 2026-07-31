import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getCountry } from "@/lib/countries";
import { formatMoney, phonePlaceholder } from "@/lib/locale";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const pages = {
  pharmacy: read("src/pages/pharmacy.tsx"),
  patients: read("src/pages/patients.tsx"),
  patient: read("src/pages/patient-profile.tsx"),
  prescription: read("src/pages/prescription-detail.tsx"),
  expiry: read("src/pages/expiry.tsx"),
  claims: read("src/pages/claims.tsx"),
  recalls: read("src/pages/recalls.tsx"),
  controlled: read("src/pages/controlled-register.tsx"),
  retail: read("src/pages/retail-dashboard.tsx"),
  laybys: read("src/pages/retail-laybys.tsx"),
  specialOrders: read("src/pages/retail-special-orders.tsx"),
  promotions: read("src/pages/promotions.tsx"),
  shrinkage: read("src/pages/retail-shrinkage.tsx"),
  hardware: read("src/pages/hardware.tsx"),
  quote: read("src/pages/quotation-detail.tsx"),
  contractor: read("src/pages/contractor-detail.tsx"),
  hospitality: read("src/pages/hospitality.tsx"),
  kitchen: read("src/pages/kitchen-display.tsx"),
  reservations: read("src/pages/reservations.tsx"),
  roomStatus: read("src/pages/room-status.tsx"),
  table: read("src/pages/table-detail.tsx"),
  room: read("src/pages/room-detail.tsx"),
  salon: read("src/pages/salon.tsx"),
  hubModules: read("src/pages/hub-modules.tsx"),
};
const moduleKit = read("src/components/shared/module-kit.tsx");
const pagination = read("src/components/pagination-bar.tsx");
const paged = read("src/services/paged.ts");
const ownership = read("docs/MOBILE_VERTICAL_ROUTE_OWNERSHIP.md");
const hardwarePayment = read("src/components/hardware/record-payment-dialog.tsx");
const hospitalityGuest = read("src/components/hospitality/guest-picker.tsx");

const cardAndTablePages = [
  pages.pharmacy, pages.expiry, pages.claims, pages.controlled, pages.laybys,
  pages.specialOrders, pages.promotions, pages.shrinkage, pages.hardware,
  pages.hospitality, pages.salon, pages.quote, pages.contractor, pages.prescription,
];

describe("task 18 ownership", () => {
  it("names all five verticals and every direct route implementation", () => {
    for (const vertical of ["Dawa", "Retail", "Hardware", "Hospitality", "Salon"]) {
      expect(ownership).toContain(vertical);
    }
    for (const file of [
      "pharmacy.tsx", "patients.tsx", "patient-profile.tsx", "prescription-detail.tsx",
      "expiry.tsx", "claims.tsx", "recalls.tsx", "controlled-register.tsx",
      "retail-dashboard.tsx", "retail-laybys.tsx", "retail-special-orders.tsx",
      "promotions.tsx", "retail-shrinkage.tsx", "hardware.tsx", "quotation-detail.tsx",
      "contractor-detail.tsx", "hospitality.tsx", "kitchen-display.tsx", "reservations.tsx",
      "room-status.tsx", "table-detail.tsx", "room-detail.tsx", "room-type-detail.tsx",
      "area-detail.tsx", "menu-item-detail.tsx", "hub-modules.tsx", "salon.tsx",
    ]) expect(ownership).toContain(file);
  });

  it("explicitly excludes shell, App, POS, package, Rust/Tauri, and CI ownership", () => {
    for (const excluded of ["src/App.tsx", "src/components/layout/**", "all POS pages/components", "package-manager files", "Cargo/Rust/Tauri", "CI workflows"]) {
      expect(ownership).toContain(excluded);
    }
  });
});

describe("responsive operational views", () => {
  it("provides phone cards/agendas and retains wide desktop views", () => {
    for (const source of cardAndTablePages) expect(source).toContain("lg:hidden");
    for (const source of cardAndTablePages) expect(source).toMatch(/hidden[^\"]*lg:block|hidden[^\"]*lg:table/);
    expect(pages.hospitality).toContain('<div className="hidden lg:block"><BookingsCalendar');
    expect(pages.hospitality).toContain('className="space-y-2 lg:hidden"');
    expect(pages.salon).toContain('aria-label="Appointment agenda"');
  });

  it("makes shared and route-level phone controls at least 44px", () => {
    expect(pagination).toContain('className="h-11 lg:h-7"');
    for (const source of [
      pages.pharmacy, pages.patients, pages.patient, pages.prescription, pages.expiry,
      pages.claims, pages.recalls, pages.controlled, pages.retail, pages.laybys,
      pages.specialOrders, pages.promotions, pages.shrinkage, pages.hardware, pages.quote,
      pages.contractor, pages.hospitality, pages.kitchen, pages.reservations, pages.roomStatus,
      pages.table, pages.room, pages.salon,
    ]) expect(source).toMatch(/h-11|min-h-11|ModuleMasthead/);
  });

  it("keeps KDS tickets single-column on phones and adaptive on larger screens", () => {
    expect(pages.kitchen).toContain('cn("grid grid-cols-1 gap-4", gridClass)');
    expect(pages.kitchen).toContain("sm:grid-cols-2");
    expect(pages.kitchen).toContain("min-h-11 w-full");
  });
});

describe("growth-list search and pagination", () => {
  it("uses typed server paging for Dawa and Retail lists", () => {
    for (const fn of ["pagePrescriptions", "pagePatients", "pageExpiryItems", "pageClaims", "pageLaybys", "pagePromotions", "pageShrinkage"]) {
      expect(paged).toContain(`function ${fn}`);
    }
    for (const source of [pages.pharmacy, pages.patients, pages.expiry, pages.claims, pages.laybys, pages.promotions, pages.shrinkage]) {
      expect(source).toContain("useListData");
      expect(source).toContain("PaginationBar");
    }
  });

  it("bounds loaded Hardware, Hospitality, Salon, recall, special-order, and detail lists", () => {
    for (const source of [pages.hardware, pages.hospitality, pages.salon, pages.recalls, pages.contractor, pages.roomStatus, pages.reservations]) {
      expect(source).toContain("useClientPagination");
      expect(source).toContain("PaginationBar");
    }
    expect(pages.specialOrders).toContain("useListData");
    expect(pages.specialOrders).toContain("PaginationBar");
    expect(pages.controlled).toContain("const pageSize = 20");
  });
});

describe("branch, permission, country, and compliance context", () => {
  it("shows operational context in module mastheads and standalone routes", () => {
    expect(moduleKit).toContain("<OperationalContext />");
    for (const source of [pages.patients, pages.patient, pages.expiry, pages.claims, pages.recalls, pages.controlled, pages.laybys, pages.specialOrders, pages.promotions, pages.shrinkage, pages.kitchen, pages.reservations, pages.roomStatus, pages.table, pages.room]) {
      expect(source).toContain("OperationalContext");
    }
  });

  it("keeps regulated and money-changing controls permission-aware", () => {
    expect(pages.controlled).toContain('hasPermission(user, "pharmacy.controlled")');
    expect(pages.expiry).toContain('hasPermission(user, "inventory.edit")');
    expect(pages.claims).toContain('hasPermission(user, "claims.submit")');
    expect(pages.promotions).toContain('hasPermission(user, "promotions.manage")');
    expect(pages.salon).toContain('hasPermission(user, "salon.staff.manage")');
    expect(pages.hardware).toContain('hasPermission(user, "hardware.equipment.manage")');
  });

  it("gates SHA/PPB and derives contacts, money, and payment methods from country profiles", () => {
    expect(pages.pharmacy).toContain('useFeatureEnabled("sha")');
    expect(pages.controlled).toContain('useFeatureEnabled("ppb_register")');
    expect(pages.claims).toContain('useFeatureEnabled("sha")');
    expect(pages.patients).toContain("phonePlaceholder(code)");
    expect(pages.specialOrders).toContain("phonePlaceholder(code)");
    expect(pages.hospitality).toContain("profile?.paymentMethods");
    expect(pages.laybys).toContain("profile?.paymentMethods");
    expect(hardwarePayment).toContain("profile?.paymentMethods");
    expect(hospitalityGuest).toContain("phonePlaceholder(code)");
    expect(hospitalityGuest).not.toContain("+254 700 000 000");
  });

  it("keeps Kenya-only compliance absent outside Kenya and formats East African locales", () => {
    for (const code of ["UG", "TZ", "RW"] as const) {
      const profile = getCountry(code);
      expect(profile?.complianceFeatures).not.toContain("sha");
      expect(profile?.complianceFeatures).not.toContain("ppb_register");
      expect(profile?.complianceFeatures).not.toContain("etims");
    }
    expect(phonePlaceholder("KE")).toContain("+254");
    expect(phonePlaceholder("UG")).toContain("+256");
    expect(phonePlaceholder("TZ")).toContain("+255");
    expect(phonePlaceholder("RW")).toContain("+250");
    expect(formatMoney(1250, "KE")).toContain("KSh");
    expect(formatMoney(1250, "UG")).toContain("USh");
    expect(formatMoney(1250, "TZ")).toContain("TSh");
    expect(formatMoney(1250, "RW")).toContain("FRw");
  });
});

describe("authoritative service and hub handoffs", () => {
  it("keeps every regulated/payment preparation in its typed domain service", () => {
    const handoffs: Array<[string, string]> = [
      [pages.pharmacy + pages.prescription, "preparePrescriptionForPosCheckout"],
      [pages.laybys, "prepareLaybyForPosCheckout"],
      [pages.specialOrders, "prepareSpecialOrderForPosCheckout"],
      [pages.hardware + pages.quote, "prepareQuoteForPosCheckout"],
      [pages.hospitality, "prepareOrderForPosCheckout"],
      [pages.salon, "prepareAppointmentForPos"],
      [pages.salon, "preparePackageForPos"],
    ];
    for (const [source, handoff] of handoffs) expect(source).toContain(handoff);
    expect(pages.specialOrders).not.toContain("Quick fulfill");
  });

  it("routes Hospitality housekeeping to its dedicated operational page", () => {
    expect(pages.hubModules).toContain("HospitalityHousekeepingPage");
    expect(pages.hubModules).toContain('label: "Housekeeping", icon: Bed, component: HospitalityHousekeepingPage');
  });
});
