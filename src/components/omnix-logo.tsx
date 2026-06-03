/**
 * Omnix brand mark.
 *
 * Design intent: Omnix is a modular platform (Core + Dawa + Retail + Hardware + Hospitality).
 * The mark is a hexagonal ring composed of 6 evenly-spaced trapezoidal segments around a
 * filled centre — visually saying "modules orbiting a core engine". Geometric, flat,
 * favicon-readable at 16px, premium at 512px.
 *
 * Renders as inline SVG so it inherits currentColor where appropriate and scales perfectly.
 */
import { APP_NAME } from "@/lib/brand";

interface Props {
  size?: number;
  className?: string;
  /** Render the mark inverted (white bg, dark glyph). Use on dark hero panels. */
  inverted?: boolean;
}

export function OmnixLogo({ size = 32, className = "", inverted = false }: Props) {
  const id = `omnix-${size}-${inverted ? "i" : "n"}`;
  // Hexagonal ring geometry: 6 segments at 60° each, slight 6° gap between segments.
  // Inner radius 130, outer radius 200, centre 256 in a 512x512 viewBox.
  const center = 256;
  const innerR = 130;
  const outerR = 200;
  const gapDeg = 6;
  const segDeg = 60;

  // Build a single segment path (annular sector) from start to end angle.
  const polar = (r: number, deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return [center + r * Math.cos(rad), center + r * Math.sin(rad)] as const;
  };
  const arc = (r: number, fromDeg: number, toDeg: number, sweep: 0 | 1) => {
    const [x2, y2] = polar(r, toDeg);
    const large = toDeg - fromDeg > 180 ? 1 : 0;
    return `A ${r} ${r} 0 ${large} ${sweep} ${x2} ${y2}`;
  };
  const segmentPath = (i: number) => {
    const start = i * segDeg + gapDeg / 2;
    const end = (i + 1) * segDeg - gapDeg / 2;
    const [ox1, oy1] = polar(outerR, start);
    const [ix2, iy2] = polar(innerR, end);
    return [
      `M ${ox1} ${oy1}`,
      arc(outerR, start, end, 1),
      `L ${ix2} ${iy2}`,
      arc(innerR, end, start, 0),
      "Z",
    ].join(" ");
  };

  const bg = inverted ? "#FFFFFF" : `url(#${id}-bg)`;
  const fg = inverted ? "#0F172A" : "#FFFFFF";
  const coreFg = inverted ? "#0F172A" : "#FFFFFF";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label={APP_NAME}
      role="img"
    >
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0F172A" />
          <stop offset="55%" stopColor="#1E3A8A" />
          <stop offset="100%" stopColor="#1E40AF" />
        </linearGradient>
        <radialGradient id={`${id}-shine`} cx="0.3" cy="0.25" r="0.7">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.18" />
          <stop offset="60%" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* App-icon shaped tile (continuous 22% squircle radius) */}
      <rect x="0" y="0" width="512" height="512" rx="112" ry="112" fill={bg} />
      {!inverted && <rect x="0" y="0" width="512" height="512" rx="112" ry="112" fill={`url(#${id}-shine)`} />}

      {/* 6 module-segments around the core */}
      <g fill={fg}>
        {Array.from({ length: 6 }).map((_, i) => (
          <path key={i} d={segmentPath(i)} />
        ))}
      </g>

      {/* Core dot — the platform engine that all modules attach to */}
      <circle cx={center} cy={center} r={42} fill={coreFg} />
    </svg>
  );
}
