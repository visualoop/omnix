/**
 * Shared status → colour maps for hardware quotations + delivery
 * notes. Extracted so hardware.tsx and quotation-detail.tsx can't
 * drift out of sync when new statuses land (HW-20).
 */
export const QUOTE_STATUS_STYLE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  accepted: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  converted: "bg-emerald-600 text-white",
  expired: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  cancelled: "bg-red-500/10 text-red-600 dark:text-red-400",
};

export const DELIVERY_STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  dispatched: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  delivered: "bg-emerald-600 text-white",
  cancelled: "bg-red-500/10 text-red-600 dark:text-red-400",
};

/** Combined dictionary — hardware.tsx uses both maps interchangeably.
 *  Keys don't collide today; a future overlap should be caught by an
 *  audit test. */
export const HARDWARE_STATUS_STYLE: Record<string, string> = {
  ...QUOTE_STATUS_STYLE,
  ...DELIVERY_STATUS_STYLE,
};
