export const CRACKER_TYPES = ["anar", "chakri", "rocket", "phuljhari", "bomb"] as const;
export type CrackerType = (typeof CRACKER_TYPES)[number];
export const CRACKER_LABELS: Record<CrackerType, string> = {
  anar: "Anar",
  chakri: "Chakri",
  rocket: "Rocket",
  phuljhari: "Sparkler",
  bomb: "Bomb",
};
export const CRACKER_EMOJI: Record<CrackerType, string> = {
  anar: "⛲",
  chakri: "🌀",
  rocket: "🚀",
  phuljhari: "✨",
  bomb: "💥",
};
export type CrackerColor = "golden" | "rose" | "deepBlue" | "forestGreen";

/** Fallback for notes saved before this change (they have no `cracker`). Stable per id. */
export function crackerForId(id: number): CrackerType {
  const h = Math.imul(id | 0, 2654435761) >>> 0;
  return CRACKER_TYPES[h % CRACKER_TYPES.length];
}

/** Colors used for the body and the sparks. Each has a body color, a light tint for the label, and spark colors. */
export const CRACKER_PALETTE: Record<CrackerColor, { body: string; dark: string; tint: string; sparks: string[] }> = {
  golden:      { body: "#f59e0b", dark: "#b45309", tint: "#fef3c7", sparks: ["#fff3b0", "#ffd166", "#ffb703", "#ffffff"] },
  rose:        { body: "#e11d48", dark: "#9f1239", tint: "#ffe4e6", sparks: ["#ffd1dc", "#ff7a9c", "#ff3d6e", "#ffffff"] },
  deepBlue:    { body: "#2563eb", dark: "#1e3a8a", tint: "#dbeafe", sparks: ["#d6e8ff", "#7cc0ff", "#3b82f6", "#ffffff"] },
  forestGreen: { body: "#16a34a", dark: "#14532d", tint: "#dcfce7", sparks: ["#dcffe5", "#86efac", "#22c55e", "#ffffff"] },
};
