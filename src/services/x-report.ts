/**
 * X-Report (Mid-Shift Snapshot)
 *
 * In retail, the X-report is the "read-only" snapshot the cashier prints
 * mid-shift to see running totals without closing anything.
 *
 * Key differences vs Z-report:
 *   - X = read-only snapshot (never changes state, no reset)
 *   - Z = end-of-shift, marks the day final, resets counters
 *
 * Practical use:
 *   - Manager wants to check "how are we doing today at 3pm?" → X
 *   - Cashier ends shift, tallies drawer → Z
 *
 * Implementation: X and Z share the same aggregate SQL (they compute
 * identical numbers — the difference is intent + printout title).
 * X uses the CURRENT time as the upper bound instead of end-of-day.
 * So an X at 3pm shows total from 00:00 to 15:00 today.
 */
import { getZReport, renderZReportHtml, type ZReport } from "./z-report";
import { printHtml } from "./print-html";

/** Alias — X and Z use the same shape. Different intent. */
export type XReport = ZReport;

/**
 * Compute the mid-shift snapshot. Same data as Z but with:
 *   - date_to = right now (not end of day)
 *   - the printout title says X-REPORT (labelled "SNAPSHOT")
 *
 * We reuse `getZReport()` for today's date. The aggregate SQL is
 * `BETWEEN today 00:00 AND today 23:59` — so it already includes every
 * sale up to the current moment. The distinction is UI + labelling.
 */
export async function getXReport(date?: string): Promise<XReport> {
  const r = await getZReport(date);
  // Stamp the generated_at as "now" (it's already now) and return same shape.
  return r;
}

/**
 * Print an X-report. Same layout as Z but labelled "SNAPSHOT" so the
 * cashier + owner + auditor can tell them apart.
 */
export async function printXReport(date?: string): Promise<void> {
  const r = await getXReport(date);
  const html = renderZReportHtml(r)
    // Swap the top-strip labels so it's obvious this is not a shift-close.
    .replace("Z-REPORT — END OF DAY", "X-REPORT — SNAPSHOT")
    .replace(/<title>Z-Report<\/title>/, "<title>X-Report</title>");
  printHtml(html);
}

/**
 * Render the X-report HTML directly (for preview in the browser, or to
 * download as PDF). Same shape as Z-report render, different label.
 */
export function renderXReportHtml(r: XReport): string {
  return renderZReportHtml(r)
    .replace("Z-REPORT — END OF DAY", "X-REPORT — SNAPSHOT")
    .replace(/<title>Z-Report<\/title>/, "<title>X-Report</title>");
}
