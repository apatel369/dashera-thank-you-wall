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

  // Stable random tilt of +/- 2 degrees from the id
  const rot = id ? (((Math.imul(id | 0, 1103515245) + 12345) >>> 16) % 400 - 200) / 100 : 0;

  const isLong = message.length > 50;
  const statusClass = spent ? "cracker-spent" : lit ? "cracker-lit" : "";

  return (
    <div
      className={`relative w-full h-full flex flex-col items-center justify-center p-1 select-none ${statusClass} ${className}`}
      style={{
        transform: rot ? `rotate(${rot}deg)` : undefined,
        ...style,
      }}
      data-testid="preview-card"
    >
      {/* Top ~45%: CrackerArt */}
      <div className="w-full flex-1 min-h-[35px] max-h-[70px] flex items-center justify-center p-0.5 overflow-visible">
        <CrackerArt
          type={type}
          color={color}
          lit={lit}
          className="h-full w-auto max-w-full drop-shadow-md object-contain"
        />
      </div>

      {/* Bottom: Paper label with prominent message */}
      <div
        className="w-full mt-0.5 px-2 py-1 rounded-lg shadow-sm flex flex-col items-center justify-center text-center overflow-hidden flex-shrink-0"
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
              ? "clamp(0.58rem, 0.5vw, 0.88rem)"
              : "clamp(0.5rem, 0.45vw, 0.75rem)",
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
                ? "clamp(0.92rem, 0.8vw, 1.55rem)"
                : "clamp(1.08rem, 0.95vw, 1.85rem)"
              : isLong
                ? "clamp(0.85rem, 0.72vw, 1.45rem)"
                : "clamp(1rem, 0.85vw, 1.75rem)",
            color: palette.dark,
            lineHeight: 1.15,
          }}
        >
          {message}
        </p>
      </div>
    </div>
  );
}
