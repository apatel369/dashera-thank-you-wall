/** Submission bead colors — lighter shades for the blueprint wall. */
export const BEAD_COLORS: Record<string, string> = {
  golden:      "#e8c96a",
  rose:        "#e88a94",
  deepBlue:    "#7eb8e0",
  forestGreen: "#72c896",
};

function parseColor(color: string): [number, number, number] | null {
  const hex = color.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const rgb = color.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/);
  if (rgb) return [+rgb[1], +rgb[2], +rgb[3]];
  return null;
}

/** Darken a hex or rgb color — used for bead borders. */
export function beadBorderColor(color: string, amount = 0.28): string {
  const parsed = parseColor(color);
  if (!parsed) return "rgba(0,0,0,0.2)";
  const [r, g, b] = parsed.map((c) => Math.round(c * (1 - amount))) as [number, number, number];
  return `rgb(${r},${g},${b})`;
}

/** Scale bead border width to bead diameter, up to 10px. */
export function beadBorderWidth(diameter: number): number {
  return Math.min(10, Math.max(3, Math.round(diameter * 0.28)));
}

export function beadBorder(color: string, diameter: number): string {
  return `${beadBorderWidth(diameter)}px solid ${beadBorderColor(color)}`;
}

/** Fixed border for /beads physics beads — not scaled down with bead size. */
export const PHYSICS_BEAD_BORDER_WIDTH = 3;

export function physicsBeadBorder(color: string): string {
  return `${PHYSICS_BEAD_BORDER_WIDTH}px solid ${beadBorderColor(color)}`;
}
