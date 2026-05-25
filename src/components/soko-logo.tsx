/**
 * SokoOS brand mark — the same S design used as the app icon.
 * Renders inline SVG so it scales perfectly and matches the icon.
 */
export function SokoLogo({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="SokoOS"
    >
      <defs>
        <linearGradient id={`sokoBg-${size}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0F172A" />
          <stop offset="100%" stopColor="#1E3A8A" />
        </linearGradient>
        <linearGradient id={`sokoAccent-${size}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#60A5FA" />
          <stop offset="100%" stopColor="#06B6D4" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="512" height="512" rx="112" ry="112" fill={`url(#sokoBg-${size})`} />
      <path
        d="M 380 168
           C 380 116, 332 88, 256 88
           C 180 88, 132 124, 132 172
           C 132 220, 172 244, 256 252
           C 340 260, 380 288, 380 340
           C 380 392, 332 424, 256 424
           C 180 424, 132 392, 132 344"
        fill="none"
        stroke={`url(#sokoAccent-${size})`}
        strokeWidth="68"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
