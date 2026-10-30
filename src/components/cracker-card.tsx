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
      className={`relative w-full h-full flex flex-col items-center justify-center p-1.5 select-none ${statusClass} ${className}`}
      style={{
        transform: rot ? `rotate(${rot}deg)` : undefined,
        ...style,
      }}
      data-testid="preview-card"
    >
      {/* Top ~52%: CrackerArt */}
      <div className="w-full flex-1 min-h-[50px] max-h-[110px] flex items-center justify-center p-0.5 overflow-visible">
        <CrackerArt
          type={type}
          color={color}
          lit={lit}
          className="h-full w-auto max-w-full drop-shadow-md object-contain"
        />
      </div>

      {/* Bottom: Paper label with prominent message */}
      <div
        className="w-full mt-1 px-2.5 py-1.5 rounded-xl shadow-sm flex flex-col items-center justify-center text-center overflow-hidden flex-shrink-0"
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
              ? "clamp(0.68rem, 0.6vw, 1.05rem)"
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
                ? "clamp(1.1rem, 0.95vw, 1.95rem)"
                : "clamp(1.3rem, 1.15vw, 2.35rem)"
              : isLong
                ? "clamp(0.95rem, 0.8vw, 1.65rem)"
                : "clamp(1.15rem, 0.95vw, 2.15rem)",
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
