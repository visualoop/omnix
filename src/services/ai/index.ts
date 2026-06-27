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
export { streamInvoke, type StreamProgress } from "./stream";
export { purgeExpired } from "./cache";

import { enrichProduct, type EnrichProductResult } from "./tasks/enrich-product";
import { normalizeImport, type ImportMapping, type OmnixField } from "./tasks/normalize-import";
import { explainEtims, type EtimsExplanation } from "./tasks/explain-etims";
import { docsQa, type DocsAnswer } from "./tasks/docs-qa";
import { setupAssist, type SetupSuggestion } from "./tasks/setup-assist";
import { summarizeZReport, type ZReportFacts } from "./tasks/zreport-summary";
import { enrichDrug, type DrugEnrichResult } from "./tasks/drug-enrich";

export type { EnrichProductResult, ImportMapping, OmnixField, EtimsExplanation, DocsAnswer, SetupSuggestion, ZReportFacts, DrugEnrichResult };

export const ai = {
  enrichProduct,
  normalizeImport,
  explainEtims,
  docsQa,
  setupAssist,
  summarizeZReport,
  enrichDrug,
};
