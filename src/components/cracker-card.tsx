import React from "react";
import { CrackerArt } from "./cracker-art.tsx";
import { type CrackerType, type CrackerColor, CRACKER_PALETTE } from "../lib/crackers.ts";

export interface CrackerCardProps {
  message: string;
  color: CrackerColor;
  type: CrackerType;
  lit?: boolean;
  id?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function CrackerCard({
  message,
  color,
  type,
  lit = false,
  id = 0,
  className = "",
  style,
}: CrackerCardProps): React.JSX.Element {
  const palette = CRACKER_PALETTE[color] ?? CRACKER_PALETTE.golden;

  // Stable random tilt of +/- 3 degrees from the id
  const rot = id ? (((Math.imul(id | 0, 1103515245) + 12345) >>> 16) % 600 - 300) / 100 : 0;

  const isLong = message.length > 50;

  return (
    <div
      className={`relative w-full h-full flex flex-col items-center justify-between p-2 select-none ${className}`}
      style={{
        transform: rot ? `rotate(${rot}deg)` : undefined,
        ...style,
      }}
      data-testid="preview-card"
    >
      {/* Top ~58%: CrackerArt */}
      <div className="w-full flex-1 min-h-0 flex items-center justify-center p-1 overflow-visible">
        <CrackerArt
          type={type}
          color={color}
          lit={lit}
          className="max-h-full max-w-full drop-shadow-md"
        />
      </div>

      {/* Bottom: Paper label */}
      <div
        className="w-full mt-1.5 px-2.5 py-1.5 rounded-lg shadow-sm flex flex-col items-center justify-center text-center overflow-hidden"
        style={{
          backgroundColor: palette.tint,
          border: `2px solid ${palette.dark}59`,
          color: palette.dark,
        }}
      >
        <span
          className="italic text-center leading-tight mb-0.5"
          style={{
            fontSize: "clamp(0.48rem, 0.43vw, 0.72rem)",
            opacity: 0.65,
          }}
        >
          I will light up...
        </span>
        <p
          className="font-caveat font-semibold leading-tight break-words text-center line-clamp-3 overflow-hidden w-full m-0"
          style={{
            fontSize: isLong
              ? "clamp(0.85rem, 0.72vw, 1.45rem)"
              : "clamp(1rem, 0.85vw, 1.9rem)",
            color: palette.dark,
          }}
        >
          {message}
        </p>
      </div>
    </div>
  );
}
