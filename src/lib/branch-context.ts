export class StaleBranchContextError extends Error {
  readonly code = "STALE_BRANCH_CONTEXT";

  constructor() {
    super("The branch changed while this request was running");
    this.name = "StaleBranchContextError";
  }
}

export class ReadOnlyBranchContextError extends Error {
  readonly code = "READ_ONLY_BRANCH_CONTEXT";

  constructor() {
    super("All Branches is read-only. Select a branch before making changes.");
    this.name = "ReadOnlyBranchContextError";
  }
}

let contextGeneration = 0;
let readOnly = false;
const cacheInvalidators = new Set<() => void>();

/** Set before publishing a scope transition so writes fail closed immediately. */
export function setBranchContextReadOnly(value: boolean): void {
  readOnly = value;
}

export function assertBranchContextWritable(): void {
  if (readOnly) throw new ReadOnlyBranchContextError();
}

/** Register a module-level cache that must be emptied whenever branch context changes. */
export function registerBranchCacheInvalidator(invalidator: () => void): () => void {
  cacheInvalidators.add(invalidator);
  return () => cacheInvalidators.delete(invalidator);
}

/** Incremented before publishing a branch/scope transition. */
export function advanceBranchContext(): number {
  contextGeneration += 1;
  for (const invalidate of cacheInvalidators) invalidate();
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("omnix:branch-context-changed", {
        detail: { generation: contextGeneration, readOnly },
      }),
    );
  }
  return contextGeneration;
}

export function captureBranchContext(): number {
  return contextGeneration;
}

export function assertCurrentBranchContext(generation: number): void {
  if (generation !== contextGeneration) throw new StaleBranchContextError();
}
