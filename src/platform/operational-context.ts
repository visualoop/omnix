export type LaunchCountry = "KE" | "UG" | "TZ" | "RW";
export type LaunchCurrency = "KES" | "UGX" | "TZS" | "RWF";

export type BranchScope =
  | { readonly kind: "branch"; readonly branchId: string }
  | { readonly kind: "all-branches" };

export interface AssignedBranchContext {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly isPrimary: boolean;
}

export interface OperationalContext {
  readonly userId: string;
  readonly permissions: readonly string[];
  readonly assignedBranches: readonly AssignedBranchContext[];
  readonly scope: BranchScope;
  readonly country: LaunchCountry;
  readonly currency: LaunchCurrency;
  readonly locale: string;
}

const CURRENCY_BY_COUNTRY: Record<LaunchCountry, LaunchCurrency> = {
  KE: "KES",
  UG: "UGX",
  TZ: "TZS",
  RW: "RWF",
};

const LOCALE_BY_COUNTRY: Record<LaunchCountry, string> = {
  KE: "en-KE",
  UG: "en-UG",
  TZ: "sw-TZ",
  RW: "rw-RW",
};

export function launchCurrencyFor(country: LaunchCountry): LaunchCurrency {
  return CURRENCY_BY_COUNTRY[country];
}

export function launchLocaleFor(country: LaunchCountry): string {
  return LOCALE_BY_COUNTRY[country];
}

export interface CreateOperationalContextInput {
  readonly userId: string;
  readonly permissions: readonly string[];
  readonly assignedBranches: readonly AssignedBranchContext[];
  readonly scope: BranchScope;
  readonly country: LaunchCountry;
}

export function createOperationalContext(
  input: CreateOperationalContextInput,
): OperationalContext {
  const userId = input.userId.trim();
  if (!userId) {
    throw new Error("Mobile operations require an authenticated account");
  }
  if (input.assignedBranches.length === 0) {
    throw new Error("Mobile operations require at least one assigned branch");
  }

  const branchIds = new Set<string>();
  const assignedBranches = input.assignedBranches.map((branch) => {
    const id = branch.id.trim();
    const code = branch.code.trim();
    const name = branch.name.trim();
    if (!id || !code || !name) {
      throw new Error("Assigned branches require an id, code, and name");
    }
    if (branchIds.has(id)) {
      throw new Error(`Assigned branch id is duplicated: ${id}`);
    }
    branchIds.add(id);
    return { ...branch, id, code, name };
  });

  if (input.scope.kind === "branch" && !branchIds.has(input.scope.branchId)) {
    throw new Error("The active branch is not assigned to this account");
  }

  return {
    userId,
    permissions: [...new Set(input.permissions.map((permission) => permission.trim()).filter(Boolean))],
    assignedBranches,
    scope: input.scope.kind === "branch"
      ? { kind: "branch", branchId: input.scope.branchId }
      : { kind: "all-branches" },
    country: input.country,
    currency: launchCurrencyFor(input.country),
    locale: launchLocaleFor(input.country),
  };
}

export function activeBranchFromContext(
  context: OperationalContext,
): AssignedBranchContext | null {
  const scope = context.scope;
  if (scope.kind === "all-branches") return null;

  return (
    context.assignedBranches.find(
      (branch) => branch.id === scope.branchId,
    ) ?? null
  );
}

export function requireOperationalBranchFromContext(
  context: OperationalContext,
): AssignedBranchContext {
  const branch = activeBranchFromContext(context);
  if (!branch) {
    throw new Error(
      "Operational Android commands require one explicit assigned branch",
    );
  }
  return branch;
}
