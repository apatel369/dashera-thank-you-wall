export const FILL_INTERVAL_MS = 2000;
export const SCROLL_NOTE_LIMIT = 100;

export function latestScrollNotes<T>(notes: T[]): T[] {
  return notes.slice(-SCROLL_NOTE_LIMIT);
}

/** Consume at most one waiting note. Empty slots fill first; a full wall replaces one random slot. */
export function advanceWall<T>(
  slots: (T | null)[],
  queue: T[],
  random: () => number = Math.random,
): { slots: (T | null)[]; queue: T[]; changed: boolean } {
  if (!queue.length || !slots.length) return { slots, queue, changed: false };
  const free = slots.flatMap((slot, index) => slot === null ? [index] : []);
  const candidates = free.length ? free : slots.map((_, index) => index);
  const pick = Math.min(candidates.length - 1, Math.floor(random() * candidates.length));
  const next = slots.slice();
  next[candidates[pick]] = queue[0];
  return { slots: next, queue: queue.slice(1), changed: true };
}
