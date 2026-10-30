import React from "react";
import { type CrackerType, type CrackerColor, CRACKER_PALETTE } from "../lib/crackers.ts";

export const IGNITION_POINTS: Record<CrackerType, { x: number; y: number }> = {
  anar: { x: 50, y: 14 },
  chakri: { x: 50, y: 65 },
  rocket: { x: 50, y: 16 },
  phuljhari: { x: 50, y: 15 },
  bomb: { x: 50, y: 22 },
};

export function CrackerArt({
  type,
  color,
  lit = false,
  className = "",
}: {
  type: CrackerType;
  color: CrackerColor;
  lit?: boolean;
  className?: string;
}): React.JSX.Element {
  const palette = CRACKER_PALETTE[color] ?? CRACKER_PALETTE.golden;
  const p = IGNITION_POINTS[type];
  const gid = `${type}-${color}`;

  const renderShape = () => {
    switch (type) {
      case "anar":
        return (
          <g>
            <defs>
              <linearGradient id={`grad-anar-${gid}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={palette.dark} />
                <stop offset="40%" stopColor={palette.body} />
                <stop offset="70%" stopColor={palette.tint} stopOpacity="0.8" />
                <stop offset="100%" stopColor={palette.dark} />
              </linearGradient>
            </defs>
            {/* Base stand */}
            <path d="M 28 128 L 72 128 L 68 133 L 32 133 Z" fill={palette.dark} />
            {/* Flowerpot Cone */}
            <path
              d="M 32 126 L 44 24 L 56 24 L 68 126 Z"
              fill={`url(#grad-anar-${gid})`}
              stroke={palette.dark}
              strokeWidth="1.5"
            />
            {/* Decorative Gold & Red Bands */}
            <path d="M 35 106 L 65 106" stroke="#fef08a" strokeWidth="4" strokeLinecap="round" />
            <path d="M 37 86 L 63 86" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />
            <path d="M 40 64 L 60 64" stroke="#fef08a" strokeWidth="4" strokeLinecap="round" />
            <path d="M 42 45 L 58 45" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
            {/* Nozzle Rim */}
            <ellipse cx="50" cy="24" rx="8" ry="3.5" fill="#f59e0b" stroke={palette.dark} strokeWidth="1.5" />
            {/* Wick */}
            <path d="M 50 22 Q 47 16 50 14" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" />
          </g>
        );

      case "chakri":
        return (
          <g>
            <defs>
              <radialGradient id={`rad-chakri-${gid}`} cx="45%" cy="45%" r="55%">
                <stop offset="0%" stopColor={palette.tint} />
                <stop offset="40%" stopColor={palette.body} />
                <stop offset="85%" stopColor={palette.dark} />
                <stop offset="100%" stopColor="#78350f" />
              </radialGradient>
            </defs>
            {/* Outer Disc Shadow */}
            <circle cx="50" cy="67" r="42" fill="rgba(0,0,0,0.2)" />
            {/* Disc Body */}
            <circle
              cx="50"
              cy="65"
              r="40"
              fill={`url(#rad-chakri-${gid})`}
              stroke={palette.dark}
              strokeWidth="2"
            />
            {/* Outer Decorative Tooth Rings */}
            <circle cx="50" cy="65" r="36" fill="none" stroke="#fef08a" strokeWidth="2" strokeDasharray="3 3" />
            <circle cx="50" cy="65" r="30" fill="none" stroke="#fef08a" strokeWidth="1.5" strokeDasharray="4 2" />
            {/* Spiral Grooves */}
            <path
              d="M 50 65 Q 56 65 57 59 Q 58 51 50 50 Q 38 49 37 63 Q 36 78 52 79 Q 71 80 72 61 Q 73 38 48 36"
              fill="none"
              stroke="#fff"
              strokeWidth="2.5"
              strokeLinecap="round"
              opacity="0.85"
            />
            {/* Center Core */}
            <circle cx="50" cy="65" r="7" fill="#fef08a" stroke={palette.dark} strokeWidth="1.5" />
            <circle cx="50" cy="65" r="2.5" fill="#451a03" />
            {/* Edge Wick */}
            <path d="M 50 25 Q 52 19 55 17" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" />
          </g>
        );

      case "rocket":
        return (
          <g>
            <defs>
              <linearGradient id={`grad-rocket-${gid}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={palette.dark} />
                <stop offset="45%" stopColor={palette.body} />
                <stop offset="70%" stopColor={palette.tint} />
                <stop offset="100%" stopColor={palette.dark} />
              </linearGradient>
            </defs>
            {/* Wooden Stick below */}
            <rect x="48.5" y="74" width="3" height="60" fill="#b45309" rx="1" />
            {/* Fins */}
            <polygon points="36,76 43,62 43,76" fill={palette.dark} />
            <polygon points="64,76 57,62 57,76" fill={palette.dark} />
            {/* Rocket Body Cylinder */}
            <rect
              x="42"
              y="38"
              width="16"
              height="38"
              fill={`url(#grad-rocket-${gid})`}
              stroke={palette.dark}
              strokeWidth="1.5"
              rx="1.5"
            />
            {/* Stripe wraps */}
            <rect x="42" y="46" width="16" height="4" fill="#fef08a" />
            <rect x="42" y="56" width="16" height="4" fill="#ef4444" />
            {/* Nose Cone */}
            <polygon points="39,38 61,38 50,16" fill="#ef4444" stroke={palette.dark} strokeWidth="1.5" />
            {/* Wick below cylinder */}
            <path d="M 50 76 Q 47 80 49 84" fill="none" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" />
          </g>
        );

      case "phuljhari":
        return (
          <g>
            {/* Metal wire handle */}
            <rect x="48.5" y="65" width="3" height="68" fill="#94a3b8" rx="1.2" />
            <rect x="49" y="100" width="2" height="30" fill="#cbd5e1" rx="0.8" />
            {/* Coated Sparkler Tip */}
            <path
              d="M 46 66 L 46 19 Q 46 15 50 15 Q 54 15 54 19 L 54 66 Z"
              fill="#64748b"
              stroke="#334155"
              strokeWidth="1"
            />
            {/* Coated chemical texture/flecks */}
            <path
              d="M 46 66 L 46 19 Q 46 15 50 15 Q 54 15 54 19 L 54 66 Z"
              fill={palette.body}
              opacity="0.65"
            />
            <circle cx="49" cy="22" r="1.5" fill="#fef08a" />
            <circle cx="51" cy="30" r="1.5" fill="#fef08a" />
            <circle cx="48" cy="40" r="1.5" fill="#fef08a" />
            <circle cx="52" cy="50" r="1.5" fill="#fef08a" />
            <circle cx="49" cy="58" r="1.5" fill="#fef08a" />
          </g>
        );

      case "bomb":
        return (
          <g>
            <defs>
              <linearGradient id={`grad-bomb-${gid}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={palette.dark} />
                <stop offset="35%" stopColor={palette.body} />
                <stop offset="70%" stopColor={palette.tint} />
                <stop offset="100%" stopColor={palette.dark} />
              </linearGradient>
            </defs>
            {/* Base shadow */}
            <ellipse cx="50" cy="120" rx="30" ry="7" fill="rgba(0,0,0,0.2)" />
            {/* Fat Cylinder Body */}
            <rect
              x="25"
              y="40"
              width="50"
              height="78"
              rx="9"
              fill={`url(#grad-bomb-${gid})`}
              stroke={palette.dark}
              strokeWidth="2"
            />
            {/* Top & Bottom Gold Bands */}
            <rect x="25" y="47" width="50" height="7" fill="#fef08a" />
            <rect x="25" y="102" width="50" height="7" fill="#fef08a" />
            {/* Red accent bands */}
            <rect x="25" y="58" width="50" height="3" fill="#ef4444" />
            <rect x="25" y="95" width="50" height="3" fill="#ef4444" />
            {/* Center Star Badge */}
            <circle cx="50" cy="79" r="15" fill="#ffffff" stroke={palette.dark} strokeWidth="1.5" />
            <polygon
              points="50,67 53,75 62,75 55,80 57,89 50,84 43,89 45,80 38,75 47,75"
              fill="#ef4444"
            />
            {/* Twisted Fuse Collar */}
            <ellipse cx="50" cy="40" rx="9" ry="3.5" fill="#b45309" stroke={palette.dark} strokeWidth="1" />
            {/* Twisted Fuse String */}
            <path
              d="M 50 39 Q 44 32 50 27 Q 54 24 50 22"
              fill="none"
              stroke="#d97706"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </g>
        );
    }
  };

  return (
    <svg
      viewBox="0 0 100 140"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      className={`relative select-none ${lit ? "cracker-lit" : ""} ${className}`}
    >
      {renderShape()}
      {lit && (
        <g className="cracker-fuse-spark">
          <circle cx={p.x} cy={p.y} r="4" fill="#ffffff" filter="drop-shadow(0 0 4px #fbbf24)" />
          <circle cx={p.x} cy={p.y} r="2" fill="#f59e0b" />
          <line x1={p.x - 5} y1={p.y} x2={p.x + 5} y2={p.y} stroke="#ffedd5" strokeWidth="1.5" />
          <line x1={p.x} y1={p.y - 5} x2={p.x} y2={p.y + 5} stroke="#ffedd5" strokeWidth="1.5" />
          <line x1={p.x - 3.5} y1={p.y - 3.5} x2={p.x + 3.5} y2={p.y + 3.5} stroke="#fbbf24" strokeWidth="1" />
          <line x1={p.x - 3.5} y1={p.y + 3.5} x2={p.x + 3.5} y2={p.y - 3.5} stroke="#fbbf24" strokeWidth="1" />
        </g>
      )}
    </svg>
  );
}
