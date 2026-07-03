/**
 * Read-tier tools index — importing this file registers every tool it
 * contains into the singleton registry.
 *
 * Callers should import this once early in app boot (from src/App.tsx
 * or an ai-v2 bootstrap) so tools are available before any agent runs.
 */
export * as GetLowStock from "./get-low-stock";
export * as GetExpiring from "./get-expiring";
export * as RecentSales from "./recent-sales";
export * as FindCustomer from "./find-customer";
export * as FindProduct from "./find-product";
