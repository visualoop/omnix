import { fetch } from "@tauri-apps/plugin-http";
import {
  getActiveAndroidHubTransport,
  requestActiveAndroidHub,
} from "@/mobile/android-hub";
import {
  getPairedClientIdentity,
  getTypedClientTransport,
  saveTypedClientSession,
} from "@/lib/db";

interface ApiFailure {
  code?: string;
}

async function responseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as ApiFailure;
    throw new Error(body.code ? `Command rejected: ${body.code}` : `Command failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export async function establishTypedLanSession(input: {
  username: string;
  password: string;
  userId: string;
  branchId: string;
}): Promise<boolean> {
  const paired = getPairedClientIdentity();
  if (!paired) return false;
  const response = await fetch(`${paired.url}/api/v1/auth/branch-local-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      schemaVersion: 1,
      requestId: crypto.randomUUID(),
      loginType: "auth.branchLocalLogin.v1",
      nodeId: paired.nodeId,
      branchId: input.branchId,
      username: input.username,
      password: input.password,
      requestedAccess: /\bAndroid\b/i.test(navigator.userAgent) ? "android" : "desktop",
    }),
  });
  const result = await responseJson<{
    accessToken: string;
    userId: string;
  }>(response);
  if (result.userId !== input.userId) throw new Error("Typed LAN session identity mismatch");
  await saveTypedClientSession(result.accessToken, result.userId);
  return true;
}

async function typedPost<T>(path: string, body: object): Promise<T> {
  const androidTransport = getActiveAndroidHubTransport();
  if (androidTransport) return requestActiveAndroidHub<T>(path, body);
  const transport = getActiveAndroidHubTransport() ?? getTypedClientTransport();
  if (!transport) throw new Error("An authenticated typed LAN session is required");
  const response = await fetch(`${transport.url}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${transport.accessToken}`,
    },
    body: JSON.stringify(body),
  });
  return responseJson<T>(response);
}

function commandEnvelope<T>(input: {
  commandType: string;
  branchId: string;
  expectedRevision: number;
  payload: T;
}) {
  const transport = getActiveAndroidHubTransport() ?? getTypedClientTransport();
  if (!transport) throw new Error("An authenticated typed LAN session is required");
  return {
    schemaVersion: 1,
    commandId: crypto.randomUUID(),
    commandType: input.commandType,
    nodeId: transport.nodeId,
    userId: transport.userId,
    branchId: input.branchId,
    expectedRevision: input.expectedRevision,
    issuedAt: new Date().toISOString(),
    payload: input.payload,
  };
}

interface CommandOutcome<T> {
  disposition: "applied" | "replayed";
  receipt: { resultingRevision: number; response: T };
}

export async function createBranchCustomer(input: {
  branchId: string;
  customerId: string;
  name: string;
  phone: string | null;
  email: string | null;
  creditLimitMinor: number;
  active: boolean;
}): Promise<string> {
  const outcome = await typedPost<CommandOutcome<{ customerId: string }>>(
    "/api/v1/commands/customers/branch-customer",
    commandEnvelope({ commandType: "customers.upsertBranchCustomer.v1", branchId: input.branchId, expectedRevision: 0, payload: {
      customerId: input.customerId,
      name: input.name,
      phone: input.phone,
      email: input.email,
      creditLimitMinor: input.creditLimitMinor,
      active: input.active,
    } }),
  );
  return outcome.receipt.response.customerId;
}

export async function createTypedPurchaseOrder(input: {
  branchId: string;
  purchaseOrderId: string;
  supplierId: string;
  expectedDate: string | null;
  currency: string;
  notes: string | null;
  lines: Array<{ lineId: string; productId: string; quantityMilli: number; unitCostMinor: number }>;
}): Promise<string> {
  const outcome = await typedPost<CommandOutcome<{ purchaseOrderId: string }>>(
    "/api/v1/commands/purchasing/purchase-order",
    commandEnvelope({ commandType: "purchasing.createPurchaseOrder.v1", branchId: input.branchId, expectedRevision: 0, payload: {
      purchaseOrderId: input.purchaseOrderId,
      supplierId: input.supplierId,
      expectedDate: input.expectedDate,
      currency: input.currency,
      lines: input.lines.map((line) => ({ ...line, taxBasisPoints: 0 })),
      notes: input.notes,
    } }),
  );
  return outcome.receipt.response.purchaseOrderId;
}

export interface AndroidInventoryItem {
  branchId: string;
  productId: string;
  sku: string;
  name: string;
  quantityMilli: number;
  sellingPriceMinor: number;
  active: boolean;
  revision: number;
}

export async function readAndroidInventory(branchId: string, search?: string): Promise<AndroidInventoryItem[]> {
  const transport = getTypedClientTransport();
  if (!transport) return [];
  const result = await typedPost<{ items: AndroidInventoryItem[] }>(
    "/api/v1/reads/android/inventory",
    {
      schemaVersion: 1,
      requestId: crypto.randomUUID(),
      projection: "android.inventory.v1",
      nodeId: transport.nodeId,
      userId: transport.userId,
      branchScope: { kind: "branch", branchId },
      page: { limit: 50 },
      filter: { search: search?.trim() || null, includeInactive: false },
    },
  );
  return result.items;
}
