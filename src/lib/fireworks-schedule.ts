import { type CrackerType, type CrackerColor, CRACKER_TYPES } from "./crackers.ts";

export const SHOW_MS = 20000;
export const FINALE_START_MS = 16500;

export function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type ShowItem = { slot: number; type: CrackerType };
export type Ignition = { slot: number; type: CrackerType; igniteAt: number; endAt: number };

const WINDOWS: Record<CrackerType, { start: number; end: number; duration: number }> = {
  phuljhari: { start: 0, end: 3000, duration: 4000 },
  chakri:    { start: 2500, end: 8000, duration: 5000 },
  anar:      { start: 5000, end: 12000, duration: 5500 },
  rocket:    { start: 8000, end: 14500, duration: 2600 },
  bomb:      { start: 11000, end: 16000, duration: 1200 },
};

/**
 * Returns one ignition per item. Times are ms from the start of the show (0 to SHOW_MS).
 * Deterministic for a given seed.
 */
export function buildIgnitions(seed: number, items: ShowItem[]): Ignition[] {
  const rand = mulberry32(seed);

  // Group items by cracker type
  const byType: Record<CrackerType, ShowItem[]> = {
    phuljhari: [],
    chakri: [],
    anar: [],
    rocket: [],
    bomb: [],
  };

  for (const item of items) {
    if (byType[item.type]) {
      byType[item.type].push(item);
    }
  }

  const ignitions: Ignition[] = [];

  for (const type of CRACKER_TYPES) {
    const list = byType[type];
    if (list.length === 0) continue;

    // Shuffle group with PRNG
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const temp = list[i];
      list[i] = list[j];
      list[j] = temp;
    }

    const win = WINDOWS[type];
    const n = list.length;
    const windowSpan = win.end - win.start;
    const step = n > 1 ? windowSpan / (n - 1) : 0;

    for (let i = 0; i < n; i++) {
      let base = n === 1 ? win.start + (win.end - win.start) * 0.5 : win.start + i * step;
      // Add jitter of +/- 15% of the spacing
      const jitterMax = step > 0 ? step * 0.15 : 100;
      const jitter = (rand() * 2 - 1) * jitterMax;
      let igniteAt = Math.round(base + jitter);

      // Clamp within window
      if (igniteAt < win.start) igniteAt = win.start;
      if (igniteAt > win.end) igniteAt = win.end;

      const duration = win.duration;
      let endAt = igniteAt + duration;

      // Constraint: endAt must be <= SHOW_MS - 500
      const maxEnd = SHOW_MS - 500;
      if (endAt > maxEnd) {
        endAt = maxEnd;
        igniteAt = Math.max(win.start, endAt - duration);
      }

      ignitions.push({
        slot: list[i].slot,
        type,
        igniteAt,
        endAt,
      });
    }
  }

  // Sort by igniteAt
  ignitions.sort((a, b) => a.igniteAt - b.igniteAt);

  // Ensure overall rate is smoothed so peak starts per second <= 8
  // Sliding window check: for each 1000ms window, if count > 7, shift later ones slightly
  for (let i = 0; i < ignitions.length; i++) {
    const current = ignitions[i];
    let startsInWindow = 0;
    for (let j = 0; j < i; j++) {
      if (ignitions[j].igniteAt >= current.igniteAt - 900 && ignitions[j].igniteAt <= current.igniteAt) {
        startsInWindow++;
      }
    }
    if (startsInWindow >= 7) {
      current.igniteAt = Math.min(SHOW_MS - current.endAt + current.igniteAt - 500, current.igniteAt + 140);
      current.endAt = Math.min(SHOW_MS - 500, current.igniteAt + WINDOWS[current.type].duration);
    }
  }

  // Re-sort after smoothing
  ignitions.sort((a, b) => a.igniteAt - b.igniteAt);

  return ignitions;
}

export type FinaleEvent = {
  at: number;
  x: number;
  y: number;
  color: CrackerColor;
  kind: "peony" | "ring" | "willow";
};

const FINALE_COLORS: CrackerColor[] = ["golden", "rose", "deepBlue", "forestGreen"];
const FINALE_KINDS: FinaleEvent["kind"][] = ["peony", "ring", "willow"];

/**
 * Returns ~40 finale events between FINALE_START_MS and SHOW_MS - 300.
 * Ramps rate up from ~4/s to 12/s.
 * x in [0.08, 0.92] * width, y in [0.12, 0.5] * height.
 * Sorted by `at`.
 */
export function buildFinale(
  seed: number,
  width: number,
  height: number,
): FinaleEvent[] {
  const rand = mulberry32(seed ^ 0x9e3779b9);
  const events: FinaleEvent[] = [];

  const startMs = FINALE_START_MS;
  const endMs = SHOW_MS - 300; // 19700 ms
  const totalDuration = endMs - startMs; // 3200 ms
  const count = 40;

  for (let i = 0; i < count; i++) {
    // Non-linear progression to ramp rate up: fraction in [0, 1]
    const p = i / (count - 1);
    // Quadratic ease-in: p * p * 0.4 + p * 0.6
    const tNorm = 0.5 * (p * p) + 0.5 * p;
    const baseAt = startMs + tNorm * totalDuration;
    // Small jitter
    const jitter = (rand() - 0.5) * 60;
    const at = Math.round(Math.min(endMs, Math.max(startMs, baseAt + jitter)));

    const x = Math.round((0.08 + rand() * 0.84) * width);
    const y = Math.round((0.12 + rand() * 0.38) * height);
    const color = FINALE_COLORS[Math.floor(rand() * FINALE_COLORS.length)];
    const kind = FINALE_KINDS[Math.floor(rand() * FINALE_KINDS.length)];

    events.push({ at, x, y, color, kind });
  }

  events.sort((a, b) => a.at - b.at);
  return events;
}
