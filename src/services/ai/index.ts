/**
 * Public surface of the AI service.
 *
 *   import { ai } from "@/services/ai";
 *   const result = await ai.enrichProduct("Panadol 500mg");
 */
export * from "./types";
export { listProviders, getProvider, updateProvider, listFeatures, updateFeature, loadSettings, saveSetting } from "./config";
export { listCalls, callStats } from "./audit";
export { invoke, pingProvider } from "./router";
export { purgeExpired } from "./cache";

import { enrichProduct } from "./tasks/enrich-product";
import { normalizeImport } from "./tasks/normalize-import";
import { explainEtims } from "./tasks/explain-etims";
import { docsQa } from "./tasks/docs-qa";
import { setupAssist } from "./tasks/setup-assist";

export const ai = {
  enrichProduct,
  normalizeImport,
  explainEtims,
  docsQa,
  setupAssist,
};
