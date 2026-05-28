/**
 * Deterministic color assignment for categories. Same category id always maps to
 * the same hue. Picks from a curated 12-color palette tuned for retail/pharmacy:
 * warm oranges, sage greens, terracotta, ochre, plum, indigo, emerald, etc.
 *
 * The palette deliberately avoids the AI-default blue/purple gradient territory
 * and the stale tech "indigo on cream" reflex. Hues are chosen to feel like
 * a Kenyan market: warm earth tones with occasional vivid accents.
 */

const PALETTE = [
  { fg: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200", dot: "bg-amber-500" },
  { fg: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", dot: "bg-emerald-500" },
  { fg: "text-rose-700", bg: "bg-rose-50", border: "border-rose-200", dot: "bg-rose-500" },
  { fg: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200", dot: "bg-orange-500" },
  { fg: "text-teal-700", bg: "bg-teal-50", border: "border-teal-200", dot: "bg-teal-500" },
  { fg: "text-violet-700", bg: "bg-violet-50", border: "border-violet-200", dot: "bg-violet-500" },
  { fg: "text-sky-700", bg: "bg-sky-50", border: "border-sky-200", dot: "bg-sky-500" },
  { fg: "text-lime-700", bg: "bg-lime-50", border: "border-lime-200", dot: "bg-lime-500" },
  { fg: "text-pink-700", bg: "bg-pink-50", border: "border-pink-200", dot: "bg-pink-500" },
  { fg: "text-cyan-700", bg: "bg-cyan-50", border: "border-cyan-200", dot: "bg-cyan-500" },
  { fg: "text-yellow-700", bg: "bg-yellow-50", border: "border-yellow-200", dot: "bg-yellow-500" },
  { fg: "text-fuchsia-700", bg: "bg-fuchsia-50", border: "border-fuchsia-200", dot: "bg-fuchsia-500" },
];

export interface CategoryColor {
  fg: string;
  bg: string;
  border: string;
  dot: string;
}

/** Stable hash → palette index. */
export function categoryColor(id: string | null | undefined): CategoryColor {
  if (!id) return { fg: "text-stone-600", bg: "bg-stone-50", border: "border-stone-200", dot: "bg-stone-400" };
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash = hash & hash;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

/** Stock-state color signaling. */
export function stockColor(stock: number, reorder: number) {
  if (stock <= 0) return { ring: "ring-rose-300", text: "text-rose-700", bg: "bg-rose-50", label: "Out" };
  if (reorder > 0 && stock <= reorder) return { ring: "ring-amber-300", text: "text-amber-700", bg: "bg-amber-50", label: "Low" };
  return { ring: "ring-emerald-200", text: "text-emerald-700", bg: "bg-emerald-50", label: "OK" };
}
