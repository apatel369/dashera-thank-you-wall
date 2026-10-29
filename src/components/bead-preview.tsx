import type { Submission } from "@/lib/api";
import { BEAD_COLORS, beadBorder } from "@/lib/bead-colors";

function beadRadius(id: number) {
  const h = Math.imul(id, 2654435761) >>> 0;
  return 14 + (h % 9);
}

const CLUSTER_OFFSETS = [
  { x: -30, y: 10, scale: 0.62 },
  { x: 34, y: -6, scale: 0.54 },
  { x: -16, y: -24, scale: 0.48 },
  { x: 22, y: 20, scale: 0.58 },
] as const;

interface BeadPreviewProps {
  submission: Pick<Submission, "id" | "colorStyle">;
  className?: string;
}

export function BeadPreview({ submission, className = "" }: BeadPreviewProps) {
  const radius = beadRadius(submission.id);
  const color = BEAD_COLORS[submission.colorStyle] ?? BEAD_COLORS.golden;
  const mainSize = radius * 2 * 2.6;
  const others = Object.entries(BEAD_COLORS).filter(([key]) => key !== submission.colorStyle);

  return (
    <div
      className={`relative mx-auto mb-6 h-28 w-44 ${className}`}
      data-testid="bead-preview"
      aria-hidden="true"
    >
      {others.map(([key, beadColor], i) => {
        const offset = CLUSTER_OFFSETS[i];
        const size = mainSize * offset.scale;
        return (
          <div
            key={key}
            className="absolute rounded-full"
            style={{
              width: size,
              height: size,
              left: `calc(50% + ${offset.x}px)`,
              top: `calc(50% + ${offset.y}px)`,
              transform: "translate(-50%, -50%)",
              backgroundColor: beadColor,
              opacity: 0.42,
              border: beadBorder(beadColor, size),
            }}
          />
        );
      })}
      <div
        className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          width: mainSize,
          height: mainSize,
          backgroundColor: color,
          border: beadBorder(color, mainSize),
          boxShadow: "0 4px 18px rgba(0,0,0,0.22)",
        }}
      />
    </div>
  );
}
