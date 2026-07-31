import type { FormFactor } from "@/platform/runtime";
import {
  activeBranchFromContext,
  type OperationalContext,
} from "@/platform/operational-context";
import {
  primaryAndroidNavigation,
  type ResolvedMobileRoute,
} from "@/mobile/navigation";

export interface MobileShellModel {
  readonly formFactor: Exclude<FormFactor, "desktop">;
  readonly activePath: string;
  readonly branchLabel: string;
  readonly country: OperationalContext["country"];
  readonly currency: OperationalContext["currency"];
  readonly isReadOnlyContext: boolean;
  readonly primaryNavigation: readonly ResolvedMobileRoute[];
}

export interface CreateMobileShellInput {
  readonly formFactor: Exclude<FormFactor, "desktop">;
  readonly activePath: string;
  readonly context: OperationalContext;
  readonly routes: readonly ResolvedMobileRoute[];
}

export function createMobileShellModel(
  input: CreateMobileShellInput,
): MobileShellModel {
  const activePath = input.activePath.split(/[?#]/, 1)[0].toLowerCase();
  if (activePath === "/settings" || activePath.startsWith("/settings/")) {
    throw new Error("Business Settings cannot be mounted in the Android shell");
  }

  const activeBranch = activeBranchFromContext(input.context);

  const primaryNavigation = primaryAndroidNavigation(input.routes).filter(
    (route) => !route.path.startsWith("/settings"),
  );

  return {
    formFactor: input.formFactor,
    activePath: input.activePath,
    branchLabel: activeBranch?.name ?? "All branches",
    country: input.context.country,
    currency: input.context.currency,
    isReadOnlyContext: input.context.scope.kind === "all-branches",
    primaryNavigation,
  };
}
