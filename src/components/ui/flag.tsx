/**
 * Real country flags — SVG, not emoji.
 *
 * Why: Windows can't render flag emojis (they show as 'KE', 'TZ' text).
 * Linux + macOS can but renderings are inconsistent.
 * Browser emoji support is patchy on older webviews. The setup wizard
 * is the first impression — emoji flags that fail to render look
 * unprofessional.
 *
 * Implementation: country-flag-icons ships every ISO 3166-1 alpha-2 flag
 * as a React SVG component. We import-all once and look up by code.
 * Bundle hit: ~120KB minified for all 250 flags. Acceptable since the
 * wizard is shown once per device.
 */
import * as Flags from "country-flag-icons/react/3x2";
import type { ComponentType, SVGProps } from "react";

type FlagComponent = ComponentType<SVGProps<SVGSVGElement> & { title?: string }>;

interface Props {
  /** ISO 3166-1 alpha-2 country code, e.g. 'KE'. */
  code: string;
  /** Tailwind class for sizing — typically a width like 'w-6'. */
  className?: string;
  title?: string;
}

export function Flag({ code, className, title }: Props) {
  const upper = code.toUpperCase();
  const C = (Flags as unknown as Record<string, FlagComponent>)[upper];
  if (!C) {
    // Fallback: code in a bordered chip. Should never trigger for ISO
    // codes the country picker sends, but kept for safety.
    return (
      <span
        aria-label={title}
        className={`inline-flex items-center justify-center rounded-sm border border-foreground/20 bg-foreground/5 px-1 font-mono text-[9px] tracking-tight text-foreground/70 ${className ?? ""}`}
        style={{ minWidth: "1.25rem" }}
      >
        {upper}
      </span>
    );
  }
  return (
    <C
      title={title}
      className={`inline-block rounded-[2px] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.08)] ${className ?? ""}`}
      style={{ aspectRatio: "3/2" }}
    />
  );
}
