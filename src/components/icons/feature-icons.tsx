/**
 * Custom feature icons for the activation page.
 * 32×32 viewport, single-colour `currentColor`. Inherits the gradient tint
 * from the parent tile (emerald, blue, amber, rose, violet, cyan).
 */
import * as React from "react";

type IconProps = React.SVGProps<SVGSVGElement> & { className?: string };

const base = (children: React.ReactNode, props: IconProps) => (
  <svg
    viewBox="0 0 32 32"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    {children}
  </svg>
);

/** Receipt with perforated bottom + KES tag corner */
export const POSIcon = (props: IconProps) =>
  base(
    <>
      <path d="M9 5h11a2 2 0 0 1 2 2v18.5l-2.6-1.4-2.6 1.4-2.6-1.4-2.6 1.4-2.6-1.4-2.6 1.4V7a2 2 0 0 1 2-2Z" />
      <path d="M12 11h7M12 14h7M12 17h5" strokeWidth={1.5} />
      <circle cx="22" cy="9" r="3.5" fill="currentColor" stroke="none" opacity="0.18" />
      <text
        x="22"
        y="10.4"
        fontFamily="ui-monospace, monospace"
        fontSize="3.2"
        fontWeight={700}
        fill="currentColor"
        stroke="none"
        textAnchor="middle"
      >
        KES
      </text>
    </>,
    props,
  );

/** Isometric package with a tape strip + corner highlight */
export const InventoryIcon = (props: IconProps) =>
  base(
    <>
      <path d="M16 4 L26 9 V21 L16 26 L6 21 V9 Z" />
      <path d="M6 9 L16 14 L26 9" />
      <path d="M16 14 V26" />
      <path d="M11 6.5 L21 11.5" strokeDasharray="1 1.5" />
    </>,
    props,
  );

/** KRA-style stamped document */
export const ETIMSIcon = (props: IconProps) =>
  base(
    <>
      <path d="M8 3.5h11l5 5V27a1.5 1.5 0 0 1-1.5 1.5h-14.5A1.5 1.5 0 0 1 6.5 27V5a1.5 1.5 0 0 1 1.5-1.5Z" />
      <path d="M19 3.5V8.5h5" />
      <circle cx="20" cy="20.5" r="4.5" strokeWidth={1.4} />
      <path d="M18 20.7l1.5 1.5 3-3" strokeWidth={1.4} />
      <path d="M9.5 13.5h7M9.5 17h5" strokeWidth={1.4} />
    </>,
    props,
  );

/** Shield with medical cross */
export const InsuranceIcon = (props: IconProps) =>
  base(
    <>
      <path d="M16 3 L26 7 V15.5C26 21.5 22.2 26 16 28.5C9.8 26 6 21.5 6 15.5V7 Z" />
      <path d="M16 11.5V19.5M12 15.5H20" strokeWidth={2.4} />
    </>,
    props,
  );

/** Three connected nodes with signal arcs */
export const LANIcon = (props: IconProps) =>
  base(
    <>
      <circle cx="16" cy="6" r="2.5" />
      <circle cx="6" cy="22" r="2.5" />
      <circle cx="26" cy="22" r="2.5" />
      <path d="M14.5 8 L7.5 20" />
      <path d="M17.5 8 L24.5 20" />
      <path d="M8.5 22 L23.5 22" />
      <path d="M16 11.5 V13.5" strokeDasharray="0.8 1.2" />
    </>,
    props,
  );

/** Ascending bars with trend line */
export const ReportsIcon = (props: IconProps) =>
  base(
    <>
      <rect x="5" y="20" width="4" height="7" rx="0.6" />
      <rect x="11" y="16" width="4" height="11" rx="0.6" />
      <rect x="17" y="12" width="4" height="15" rx="0.6" />
      <rect x="23" y="7" width="4" height="20" rx="0.6" />
      <path d="M5 16 L11 12 L17 8 L25 4" strokeWidth={1.3} />
      <circle cx="25" cy="4" r="1.4" fill="currentColor" stroke="none" />
    </>,
    props,
  );
