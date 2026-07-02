/**
 * Ghost hero-art. Renders at ~6% opacity behind the stat strip on the right
 * column of Dashboard + POS Overview. Purpose: give each page domain identity
 * without competing with the giant KES number.
 *
 * All colours flow from `currentColor` so both light + dark theme are covered
 * for free. Pure SVG — no image assets, no CDN, no cache.
 */
import type { CSSProperties } from "react";

const BASE: CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  color: "currentColor",
  opacity: 0.06,
  pointerEvents: "none",
};

/** Analytics feel: rising line chart + a few tiny bar sparks below. */
export function DashboardHeroArt() {
  return (
    <svg
      viewBox="0 0 480 320"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid slice"
      style={BASE}
      aria-hidden="true"
    >
      {/* Grid ticks */}
      <g stroke="currentColor" strokeWidth="0.5" opacity="0.5">
        {[40, 80, 120, 160, 200, 240, 280].map((y) => (
          <line key={`h${y}`} x1={30} x2={450} y1={y} y2={y} />
        ))}
        {[60, 120, 180, 240, 300, 360, 420].map((x) => (
          <line key={`v${x}`} x1={x} x2={x} y1={30} y2={280} />
        ))}
      </g>

      {/* Rising line */}
      <polyline
        points="30,240 90,220 150,235 210,190 270,170 330,140 390,120 450,80"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Dots on line vertices */}
      {[
        [30, 240], [90, 220], [150, 235], [210, 190],
        [270, 170], [330, 140], [390, 120], [450, 80],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="4" fill="currentColor" />
      ))}

      {/* Bar sparks at the bottom */}
      <g fill="currentColor">
        {[
          [60, 20], [120, 34], [180, 26], [240, 44],
          [300, 30], [360, 50], [420, 40],
        ].map(([x, h]) => (
          <rect key={`b${x}`} x={x - 8} y={300 - h} width="16" height={h} rx="1.5" />
        ))}
      </g>
    </svg>
  );
}

/** POS feel: receipt scroll with perforation dots + a hint of a cash drawer. */
export function PosHeroArt() {
  return (
    <svg
      viewBox="0 0 480 320"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid slice"
      style={BASE}
      aria-hidden="true"
    >
      {/* Receipt scroll (right half) */}
      <g stroke="currentColor" strokeWidth="1.5" fill="none">
        <path d="M 250 20 L 250 300 L 430 300 L 430 20 Z" strokeWidth="2" />
        {/* Torn top edge (zig-zag) */}
        <path d="M 250 20 L 260 12 L 270 20 L 280 12 L 290 20 L 300 12 L 310 20 L 320 12 L 330 20 L 340 12 L 350 20 L 360 12 L 370 20 L 380 12 L 390 20 L 400 12 L 410 20 L 420 12 L 430 20" strokeWidth="2" />
        {/* Body lines */}
        {[50, 70, 90, 110, 130, 150, 170, 190, 210, 230, 250, 270].map((y) => (
          <line key={`rl${y}`} x1={265} x2={415} y1={y} y2={y} strokeDasharray={y > 220 ? "4 4" : "none"} strokeWidth="1" />
        ))}
        {/* Total line (bold) */}
        <line x1={265} x2={415} y1={250} y2={250} strokeWidth="2" />
      </g>

      {/* Cash drawer (bottom-left) */}
      <g stroke="currentColor" strokeWidth="1.5" fill="none">
        {/* Body */}
        <rect x="30" y="200" width="180" height="90" rx="4" strokeWidth="2" />
        {/* Handle */}
        <rect x="90" y="215" width="60" height="12" rx="2" fill="currentColor" opacity="0.4" />
        {/* Coin compartments */}
        <line x1={45} y1={240} x2={195} y2={240} strokeWidth="1" />
        {[65, 100, 135, 170].map((x) => (
          <line key={`cs${x}`} x1={x} x2={x} y1={240} y2={285} strokeWidth="1" />
        ))}
        {/* Bill compartment lid line */}
        <line x1={45} y1={265} x2={195} y2={265} strokeWidth="0.5" strokeDasharray="3 3" />
      </g>

      {/* Perforation dots down the middle */}
      <g fill="currentColor">
        {Array.from({ length: 22 }).map((_, i) => (
          <circle key={`p${i}`} cx={240} cy={20 + i * 13} r="1.5" />
        ))}
      </g>
    </svg>
  );
}
