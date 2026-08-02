import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import * as matchers from "vitest-axe/matchers";
import { MobileHome } from "@/components/mobile/MobileHome";
import { MobileShell } from "@/components/mobile/MobileShell";
import { AccountDeviceCard } from "@/components/mobile/AccountDeviceCard";
import { MobileProfile } from "@/components/mobile/MobileProfile";
import { createMobileShellModel } from "@/mobile/shell";
import { createMobileHomeModel } from "@/mobile/models/home";
import { createMobileProfileModel } from "@/mobile/models/profile";
import type { AccountDeviceModel } from "@/mobile/models/account-device";
import { resolveAndroidNavigation, ANDROID_MOBILE_ROUTES } from "@/mobile/navigation";
import { createOperationalContext } from "@/platform/operational-context";

expect.extend(matchers);

const accountDevice: AccountDeviceModel = {
  account: {
    userId: "user-1",
    username: "a.kinoti",
    fullName: "Alice Kinoti",
    email: "alice@example.test",
    phone: "+256 700 123456",
    role: "manager",
  },
  device: {
    deviceId: "node-android-1",
    deviceName: "Alice's counter tablet",
    platform: "android",
    osVersion: "Android 15",
    appVersion: "0.73.0",
  },
  security: {
    secureStorage: { state: "available" },
    biometricStatus: { state: "available" },
    biometricPermission: "prompt",
    biometricKinds: ["fingerprint"],
    biometricEnrolled: false,
    notificationPermission: "prompt",
  },
  sync: {
    state: "pending",
    pendingCommands: 2,
    lastSuccessfulAt: "2026-07-31T08:00:00Z",
    hubName: "Nairobi hub",
  },
  mesh: {
    state: "connected",
    nodeId: "node-android-1",
    hubName: "Nairobi hub",
    lastHandshakeAt: "2026-07-31T08:30:00Z",
  },
  storage: {
    usedBytes: 384 * 1024 * 1024,
    totalBytes: 1024 * 1024 * 1024,
    cacheBytes: 24 * 1024 * 1024,
    lastCalculatedAt: "2026-07-31T08:45:00Z",
  },
  activity: [
    {
      id: "activity-1",
      label: "Branch sync completed",
      detail: "17 records received from Nairobi hub",
      occurredAt: "2026-07-31T08:00:00Z",
    },
  ],
};

const operationalContext = createOperationalContext({
  userId: "user-1",
  permissions: ["pos.use", "inventory.view", "customers.view", "approvals.manage"],
  assignedBranches: [
    { id: "branch-1", code: "NRB", name: "Nairobi CBD", isPrimary: true },
    { id: "branch-2", code: "WST", name: "Westlands", isPrimary: false },
  ],
  scope: { kind: "branch", branchId: "branch-1" },
  country: "UG",
});

function homeModel() {
  const routes = resolveAndroidNavigation(ANDROID_MOBILE_ROUTES, {
    context: operationalContext,
    activeModules: ["core"],
    hubAvailable: true,
  });
  return createMobileHomeModel({
    context: operationalContext,
    accountDevice,
    routes,
    kpis: [
      {
        id: "sales-today",
        label: "Sales today",
        value: "UGX 428,000",
        detail: "34 completed sales",
        tone: "positive",
        branchId: "branch-1",
        requiredPermissions: ["pos.use"],
      },
      {
        id: "other-branch-stock",
        label: "Westlands stock",
        value: "12",
        detail: "Must not leak into this branch",
        branchId: "branch-2",
      },
    ],
    workItems: [
      {
        id: "low-stock",
        kind: "alert",
        title: "6 products below reorder level",
        detail: "Review stock before the afternoon rush",
        path: "/inventory?filter=low-stock",
        priority: "critical",
        branchId: "branch-1",
        requiredPermissions: ["inventory.view"],
      },
      {
        id: "discount-approval",
        kind: "approval",
        title: "Discount approval waiting",
        detail: "Sale NRB-104 needs manager review",
        path: "/approvals",
        priority: "attention",
        branchId: "branch-1",
        requiredPermissions: ["approvals.manage"],
      },
      {
        id: "customer-follow-up",
        kind: "task",
        title: "Call two credit customers",
        detail: "Follow-ups are due today",
        path: "/customers?filter=follow-up",
        branchId: null,
        requiredPermissions: ["customers.view"],
      },
      {
        id: "bank-review",
        kind: "task",
        title: "Review bank balance",
        detail: "Hidden without banking access",
        path: "/banking",
        branchId: "branch-1",
        requiredPermissions: ["banking.view"],
      },
    ],
  });
}

afterEach(cleanup);

describe("MobileProfile", () => {
  it("covers account, access, security adapters, device health, enrollment, and sign-out", () => {
    const signOut = vi.fn();
    const selectBranch = vi.fn();
    const action = vi.fn();
    const model = createMobileProfileModel({
      context: operationalContext,
      accountDevice,
      activeModules: ["core", "dawa"],
    });

    render(
      <MobileProfile
        model={model}
        onSelectBranch={selectBranch}
        onAction={action}
        onSignOut={signOut}
      />,
    );

    expect(screen.getByText("Alice Kinoti")).toBeDefined();
    expect(screen.getByText("alice@example.test")).toBeDefined();
    expect(screen.getByText("+256 700 123456")).toBeDefined();
    expect(screen.getAllByText("manager").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Nairobi CBD").length).toBeGreaterThan(0);
    expect(screen.queryByText("Westlands")).toBeNull();
    expect(screen.getByText("UG · UGX")).toBeDefined();
    expect(screen.getByText("customers.view")).toBeDefined();
    expect(screen.getByText("Core")).toBeDefined();
    expect(screen.getByText("Dawa")).toBeDefined();
    expect(screen.getByText("Available, not enrolled")).toBeDefined();
    expect(screen.getAllByText("Not requested")).toHaveLength(2);
    expect(screen.getByText("Alice's counter tablet")).toBeDefined();
    expect(screen.getByText("0.73.0")).toBeDefined();
    expect(screen.getByText("Connected")).toBeDefined();
    expect(screen.getByText("24.0 MB cache")).toBeDefined();
    expect(screen.getByText("Branch sync completed")).toBeDefined();
    expect(screen.queryByText(/business settings/i)).toBeNull();
    expect(screen.queryByLabelText(/password|pin/i)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Nairobi CBD" }));
    fireEvent.click(screen.getByRole("button", { name: /Westlands/i }));
    expect(selectBranch).toHaveBeenCalledWith("branch-2");

    for (const [label, expectedAction] of [
      ["Change password", "change-password"],
      ["Change PIN", "change-pin"],
      ["Set up biometrics", "request-biometric"],
      ["Allow notifications", "request-notifications"],
      ["Disconnect Private Mesh", "disconnect-private-mesh"],
      ["Clear local cache", "clear-cache"],
      ["Re-enrol this device", "re-enrol-device"],
      ["Revoke this device", "revoke-device"],
    ] as const) {
      fireEvent.click(screen.getByRole("button", { name: label }));
      expect(action).toHaveBeenLastCalledWith(expectedAction);
    }

    fireEvent.click(screen.getByRole("button", { name: "Sign out on this device" }));
    expect(signOut).toHaveBeenCalledOnce();
  });


  it.each([
    { label: "Not configured", mesh: { ...accountDevice.mesh, state: "disabled" as const }, configured: false, availability: { state: "available" as const }, action: "Waiting for hub approval" },
    { label: "Connecting", mesh: { ...accountDevice.mesh, state: "starting" as const }, configured: true, availability: { state: "available" as const }, action: "Retrying…" },
    { label: "Connected", mesh: { ...accountDevice.mesh, state: "connected" as const }, configured: true, availability: { state: "available" as const }, action: "Disconnect Private Mesh" },
    { label: "Hub unreachable", mesh: { ...accountDevice.mesh, state: "offline" as const }, configured: true, availability: { state: "available" as const }, action: "Retry connection" },
    { label: "VPN permission denied", mesh: { ...accountDevice.mesh, state: "permission-denied" as const }, configured: true, availability: { state: "permission-required" as const, permission: "vpn" as const }, action: "Allow VPN and retry" },
    { label: "Mesh unavailable", mesh: { ...accountDevice.mesh, state: "disabled" as const }, configured: true, availability: { state: "unavailable" as const, reason: "WireGuard is unavailable" }, action: "Private Mesh unavailable" },
  ])("shows Private Mesh state: $label", ({ label, mesh, configured, availability, action }) => {
    render(
      <AccountDeviceCard
        model={{ ...accountDevice, mesh }}
        locale="en-KE"
        meshEnrollmentReady={configured}
        meshAvailability={availability}
        onMeshAction={vi.fn()}
      />,
    );

    expect(screen.getByText(label)).toBeDefined();
    expect(screen.getByRole("button", { name: action })).toBeDefined();
  });
  it("has no automated accessibility violations", async () => {
    const model = createMobileProfileModel({
      context: operationalContext,
      accountDevice,
      activeModules: ["core", "dawa"],
    });
    const { container } = render(
      <MobileProfile
        model={model}
        onSelectBranch={vi.fn()}
        onAction={vi.fn()}
        onSignOut={vi.fn()}
      />,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("MobileHome", () => {
  it("prioritizes branch KPIs, alerts, approvals, and tasks before permission-filtered shortcuts", () => {
    const navigate = vi.fn();
    const model = homeModel();

    render(<MobileHome model={model} onNavigate={navigate} />);

    expect(screen.getByText("Good day, Alice")).toBeDefined();
    expect(screen.getByText("NRB · Nairobi CBD")).toBeDefined();
    expect(screen.getByText("UGX 428,000")).toBeDefined();
    expect(screen.queryByText("Westlands stock")).toBeNull();
    expect(screen.getByText("6 products below reorder level")).toBeDefined();
    expect(screen.getByText("Discount approval waiting")).toBeDefined();
    expect(screen.getByText("Call two credit customers")).toBeDefined();
    expect(screen.queryByText("Review bank balance")).toBeNull();
    expect(screen.getByRole("button", { name: "Sell" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Inventory" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "Banking" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Settings/i })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Sell" }));
    expect(navigate).toHaveBeenCalledWith("/pos/sale");
    fireEvent.click(screen.getByText("Discount approval waiting"));
    expect(navigate).toHaveBeenCalledWith("/approvals");
  });

  it("announces offline queued work and has no automated accessibility violations", async () => {
    const model = homeModel();
    const offlineModel = {
      ...model,
      sync: { ...model.sync, state: "offline" as const },
    };
    const { container } = render(<MobileHome model={offlineModel} onNavigate={vi.fn()} />);

    expect(screen.getByText("Working offline")).toBeDefined();
    expect(screen.getByText("2 local changes waiting")).toBeDefined();
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("MobileShell", () => {
  it("renders only primary Android destinations and reports navigation", () => {
    const navigate = vi.fn();
    const routes = resolveAndroidNavigation(ANDROID_MOBILE_ROUTES, {
      context: operationalContext,
      activeModules: ["core"],
      hubAvailable: true,
    });
    const model = createMobileShellModel({
      formFactor: "phone",
      activePath: "/inventory",
      context: operationalContext,
      routes,
    });

    render(
      <MobileShell model={model} onNavigate={navigate}>
        <p>Current workspace</p>
      </MobileShell>,
    );

    expect(screen.getByText("Current workspace")).toBeDefined();
    expect(screen.getByRole("button", { name: "Inventory" }).getAttribute("aria-current"))
      .toBe("page");
    expect(screen.getByRole("button", { name: "Inventory" }).getAttribute("aria-controls"))
      .toBe("mobile-main-content");
    expect(screen.queryByRole("button", { name: "Customers" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Settings/i })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Profile" }));
    expect(navigate).toHaveBeenCalledWith("/mobile/profile");

    expect(() => createMobileShellModel({
      formFactor: "phone",
      activePath: "/Settings/security",
      context: operationalContext,
      routes,
    })).toThrow("cannot be mounted");
  });

  it("has no automated accessibility violations", async () => {
    const routes = resolveAndroidNavigation(ANDROID_MOBILE_ROUTES, {
      context: operationalContext,
      activeModules: ["core"],
      hubAvailable: true,
    });
    const model = createMobileShellModel({
      formFactor: "phone",
      activePath: "/mobile",
      context: operationalContext,
      routes,
    });
    const { container } = render(
      <MobileShell model={model} onNavigate={vi.fn()}>
        <h1>Home</h1>
      </MobileShell>,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
