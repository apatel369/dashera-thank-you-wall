import React from "react";
import { CrackerArt } from "./cracker-art.tsx";
import { type CrackerType, type CrackerColor, CRACKER_PALETTE } from "../lib/crackers.ts";

export interface CrackerCardProps {
  message: string;
  color: CrackerColor;
  type: CrackerType;
  lit?: boolean;
  spent?: boolean;
  id?: number;
  className?: string;
  style?: React.CSSProperties;
  largeFont?: boolean;
}

export function CrackerCard({
  message,
  color,
  type,
  lit = false,
  spent = false,
  id = 0,
  className = "",
  style,
  largeFont = false,
}: CrackerCardProps): React.JSX.Element {
  const palette = CRACKER_PALETTE[color] ?? CRACKER_PALETTE.golden;

  // Stable random tilt of +/- 3 degrees from the id
  const rot = id ? (((Math.imul(id | 0, 1103515245) + 12345) >>> 16) % 600 - 300) / 100 : 0;

  const isLong = message.length > 50;
  const statusClass = spent ? "cracker-spent" : lit ? "cracker-lit" : "";

  return (
    <div
      className={`relative w-full h-full flex flex-col items-center justify-between p-2 select-none ${statusClass} ${className}`}
      style={{
        transform: rot ? `rotate(${rot}deg)` : undefined,
        ...style,
      }}
      data-testid="preview-card"
    >
      {/* Top ~55%: CrackerArt */}
      <div className="w-full flex-1 min-h-0 flex items-center justify-center p-1 overflow-visible">
        <CrackerArt
          type={type}
          color={color}
          lit={lit}
          className="max-h-full max-w-full drop-shadow-md"
        />
      </div>

      {/* Bottom: Paper label with prominent message */}
      <div
        className="w-full mt-1.5 px-3 py-2 rounded-xl shadow-sm flex flex-col items-center justify-center text-center overflow-hidden"
        style={{
          backgroundColor: palette.tint,
          border: `2px solid ${palette.dark}59`,
          color: palette.dark,
        }}
      >
        <span
          className="italic text-center font-medium leading-tight mb-0.5 tracking-wide"
          style={{
            fontSize: largeFont
              ? "clamp(0.72rem, 0.65vw, 1.15rem)"
              : "clamp(0.55rem, 0.48vw, 0.85rem)",
            opacity: 0.8,
          }}
        >
          I will light up...
        </span>
        <p
          className="font-caveat font-bold leading-tight break-words text-center line-clamp-3 overflow-hidden w-full m-0"
          style={{
            fontSize: largeFont
              ? isLong
                ? "clamp(1.2rem, 1.05vw, 2.25rem)"
                : "clamp(1.45rem, 1.3vw, 2.75rem)"
              : isLong
                ? "clamp(0.95rem, 0.8vw, 1.65rem)"
                : "clamp(1.15rem, 0.95vw, 2.15rem)",
            color: palette.dark,
            lineHeight: 1.16,
          }}
        >
          {message}
        </p>
      </div>
    </div>
  );
}
