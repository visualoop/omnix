import {
  activeBranchFromContext,
  type OperationalContext,
} from "@/platform/operational-context";
import {
  createAccountDeviceModel,
  type AccountDeviceModel,
} from "@/mobile/models/account-device";
import type { ResolvedMobileRoute } from "@/mobile/navigation";

export interface MobileHomeAction {
  readonly id: string;
  readonly label: string;
  readonly path: string;
  readonly access: "full" | "read";
}

export type MobileHomeKpiTone = "neutral" | "positive" | "attention" | "critical";

export interface MobileHomeKpiInput {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly detail: string;
  readonly tone?: MobileHomeKpiTone;
  readonly branchId: string | null;
  readonly requiredPermissions?: readonly string[];
}

export interface MobileHomeKpi {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly detail: string;
  readonly tone: MobileHomeKpiTone;
}

export type MobileHomeWorkKind = "alert" | "approval" | "task";
export type MobileHomeWorkPriority = "normal" | "attention" | "critical";

export interface MobileHomeWorkItemInput {
  readonly id: string;
  readonly kind: MobileHomeWorkKind;
  readonly title: string;
  readonly detail: string;
  readonly path: string;
  readonly priority?: MobileHomeWorkPriority;
  readonly branchId: string | null;
  readonly requiredPermissions?: readonly string[];
}

export interface MobileHomeWorkItem {
  readonly id: string;
  readonly kind: MobileHomeWorkKind;
  readonly title: string;
  readonly detail: string;
  readonly path: string;
  readonly priority: MobileHomeWorkPriority;
}

export interface MobileHomeModel {
  readonly greetingName: string;
  readonly branchLabel: string;
  readonly branchCode: string | null;
  readonly country: OperationalContext["country"];
  readonly currency: OperationalContext["currency"];
  readonly isAllBranches: boolean;
  readonly sync: AccountDeviceModel["sync"];
  readonly kpis: readonly MobileHomeKpi[];
  readonly workItems: readonly MobileHomeWorkItem[];
  readonly actions: readonly MobileHomeAction[];
}

export interface CreateMobileHomeInput {
  readonly context: OperationalContext;
  readonly accountDevice: AccountDeviceModel;
  readonly routes: readonly ResolvedMobileRoute[];
  readonly kpis?: readonly MobileHomeKpiInput[];
  readonly workItems?: readonly MobileHomeWorkItemInput[];
}

function canSee(
  branchId: string | null,
  requiredPermissions: readonly string[] | undefined,
  context: OperationalContext,
  activeBranchId: string | null,
): boolean {
  const inScope = branchId === null || branchId === activeBranchId;
  if (!inScope) return false;
  const granted = new Set(context.permissions);
  return (requiredPermissions ?? []).every((permission) => granted.has(permission));
}

function requiredText(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
}

const WORK_KIND_ORDER: Record<MobileHomeWorkKind, number> = {
  alert: 0,
  approval: 1,
  task: 2,
};

const WORK_PRIORITY_ORDER: Record<MobileHomeWorkPriority, number> = {
  critical: 0,
  attention: 1,
  normal: 2,
};

export function createMobileHomeModel(
  input: CreateMobileHomeInput,
): MobileHomeModel {
  const accountDevice = createAccountDeviceModel(input.accountDevice);
  if (input.context.userId !== accountDevice.account.userId) {
    throw new Error("Home account does not match the operational context");
  }

  const branch = activeBranchFromContext(input.context);
  const greetingName =
    accountDevice.account.fullName.trim().split(/\s+/)[0] ||
    accountDevice.account.username;
  const ids = new Set<string>();
  const assertUniqueId = (id: string): string => {
    const normalized = requiredText(id, "Home item id");
    if (ids.has(normalized)) throw new Error(`Home item id is duplicated: ${normalized}`);
    ids.add(normalized);
    return normalized;
  };

  const kpis = (input.kpis ?? [])
    .filter((kpi) => canSee(kpi.branchId, kpi.requiredPermissions, input.context, branch?.id ?? null))
    .map((kpi) => ({
      id: assertUniqueId(kpi.id),
      label: requiredText(kpi.label, "KPI label"),
      value: requiredText(kpi.value, "KPI value"),
      detail: requiredText(kpi.detail, "KPI detail"),
      tone: kpi.tone ?? "neutral",
    }));

  const workItems = (input.workItems ?? [])
    .filter((item) => canSee(item.branchId, item.requiredPermissions, input.context, branch?.id ?? null))
    .map((item) => ({
      id: assertUniqueId(item.id),
      kind: item.kind,
      title: requiredText(item.title, "Work item title"),
      detail: requiredText(item.detail, "Work item detail"),
      path: requiredText(item.path, "Work item path"),
      priority: item.priority ?? "normal",
    }))
    .sort((left, right) =>
      WORK_KIND_ORDER[left.kind] - WORK_KIND_ORDER[right.kind] ||
      WORK_PRIORITY_ORDER[left.priority] - WORK_PRIORITY_ORDER[right.priority],
    )
    .slice(0, 6);

  return {
    greetingName,
    branchLabel: branch?.name ?? "All branches",
    branchCode: branch?.code ?? null,
    country: input.context.country,
    currency: input.context.currency,
    isAllBranches: input.context.scope.kind === "all-branches",
    sync: accountDevice.sync,
    kpis,
    workItems,
    actions: input.routes
      .filter((route) => !["home", "profile", "notifications"].includes(route.id))
      .map((route) => ({
        id: route.id,
        label: route.label,
        path: route.path,
        access: route.access,
      })),
  };
}
