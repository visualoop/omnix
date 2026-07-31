import {
  activeBranchFromContext,
  type OperationalContext,
} from "@/platform/operational-context";
import {
  createAccountDeviceModel,
  type AccountDeviceModel,
} from "@/mobile/models/account-device";

export type MobileProfileSectionId =
  | "identity"
  | "access"
  | "security"
  | "device"
  | "sync"
  | "mesh"
  | "storage"
  | "activity"
  | "enrollment"
  | "sign-out";

export type MobileProfileAction =
  | "change-password"
  | "change-pin"
  | "request-biometric"
  | "request-notifications"
  | "clear-cache"
  | "re-enrol-device"
  | "revoke-device";

export const MOBILE_PROFILE_SECTIONS: readonly MobileProfileSectionId[] = [
  "identity",
  "access",
  "security",
  "device",
  "sync",
  "mesh",
  "storage",
  "activity",
  "enrollment",
  "sign-out",
] as const;

export interface MobileProfileBranch {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly isPrimary: boolean;
  readonly isActive: boolean;
}

export interface MobileProfileModel {
  readonly accountDevice: AccountDeviceModel;
  readonly permissions: readonly string[];
  readonly modules: readonly string[];
  readonly branches: readonly MobileProfileBranch[];
  readonly scopeLabel: string;
  readonly country: OperationalContext["country"];
  readonly currency: OperationalContext["currency"];
  readonly locale: string;
  readonly sections: readonly MobileProfileSectionId[];
}

export interface CreateMobileProfileInput {
  readonly context: OperationalContext;
  readonly accountDevice: AccountDeviceModel;
  readonly activeModules: readonly string[];
}

export function createMobileProfileModel(
  input: CreateMobileProfileInput,
): MobileProfileModel {
  const accountDevice = createAccountDeviceModel(input.accountDevice);
  if (input.context.userId !== accountDevice.account.userId) {
    throw new Error("Profile account does not match the operational context");
  }

  const activeBranch = activeBranchFromContext(input.context);
  const branches = input.context.assignedBranches.map((branch) => ({
    ...branch,
    isActive: activeBranch?.id === branch.id,
  }));
  const modules = [...new Set(
    input.activeModules.map((module) => module.trim()).filter(Boolean),
  )].sort();

  return {
    accountDevice,
    permissions: [...input.context.permissions].sort(),
    modules,
    branches,
    scopeLabel: activeBranch?.name ?? "All branches — analytics only",
    country: input.context.country,
    currency: input.context.currency,
    locale: input.context.locale,
    sections: MOBILE_PROFILE_SECTIONS,
  };
}
