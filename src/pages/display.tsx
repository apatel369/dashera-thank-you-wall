import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { listSubmissions, type Submission, type SubmissionCursor, type WallState } from "@/lib/api";
import { QrScreen } from "@/components/qr-screen";
import { advanceWall, FILL_INTERVAL_MS, latestScrollNotes } from "@/lib/wall-flow";

// ── Grid geometry (responsive) ───────────────────────────────────────────────

const NOTE_TARGET = 200;
const LARGE_PROJECTOR_NOTE_TARGET = 280;
const GRID_GAP    = 14;
const POLL_INTERVAL_MS = 2500;
const BURN_DURATION_MS = 6200;
const SCROLL_SPEED_PX_PER_SECOND = 55;

function computeGridDims(w: number, h: number, padX: number, padY: number) {
  const target = w >= 2500 ? LARGE_PROJECTOR_NOTE_TARGET : NOTE_TARGET;
  const cols = Math.max(3, Math.floor((w - 2 * padX + GRID_GAP) / (target + GRID_GAP)));
  const rows = Math.max(2, Math.floor((h - 2 * padY + GRID_GAP) / (target + GRID_GAP)));
  return { cols, rows };
}

function middleColStart(cols: number) {
  return Math.floor((cols - 2) / 2);
}

function validColumns(cols: number): number[] {
  const cStart = middleColStart(cols);
  const out: number[] = [];
  for (let c = 0; c < cols; c++) {
    if (c >= cStart && c < cStart + 2) continue;
    out.push(c);
  }
  return out;
}

/** Stable per-slot aesthetic values — derived from slot index. */
function slotMeta(idx: number) {
  const h = Math.imul(idx + 1, 2654435761) >>> 0;
  return {
    r:  ((h & 0xFF) / 255) * 10 - 5,
    sc: 0.90 + ((h >> 8 & 0xFF) / 255) * 0.20,
    dy: ((h >> 16 & 0xFF) / 255) * 16 - 8,
  };
}

function useGridDims(padX: number, padY: number) {
  const [dims, setDims] = useState(() => ({ ...computeGridDims(window.innerWidth, window.innerHeight, padX, padY), height: window.innerHeight }));
  useEffect(() => {
    const handler = () => setDims({ ...computeGridDims(window.innerWidth, window.innerHeight, padX, padY), height: window.innerHeight });
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [padX, padY]);
  return dims;
}

const PAPER_COLORS: Record<string, { bg: string }> = {
  golden:      { bg: "#fef08a" },
  rose:        { bg: "#ffe4e6" },
  deepBlue:    { bg: "#dbeafe" },
  forestGreen: { bg: "#dcfce7" },
};

const FONT_COLOR_MAP: Record<string, string> = {
  warm:    "#5c2a0a",
  crimson: "#9b1b1b",
  indigo:  "#312075",
  forest:  "#1a4731",
  ink:     "#1a1a2e",
};

const SYMBOL_EMOJI: Record<string, string> = {
  none: "", namaste: "🙏", heart: "❤️", hug: "🤗",
  lotus: "🪷", om: "ॐ", star: "⭐",
};

function genWavyClip(cycles = 5, amp = 2): string {
  const p: string[] = [];
  const f = (n: number) => n.toFixed(2);
  const n = cycles * 16;
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = t * 100;
    const y = amp + amp * Math.sin(t * Math.PI * 2 * cycles);
    p.push(`${f(x)}% ${f(y)}%`);
  }
  for (let i = 1; i <= n; i++) {
    const t = i / n, y = t * 100;
    const x = 100 - amp - amp * Math.sin(t * Math.PI * 2 * cycles);
    p.push(`${f(x)}% ${f(y)}%`);
  }
  for (let i = n; i >= 0; i--) {
    const t = i / n, x = t * 100;
    const y = 100 - amp - amp * Math.sin(t * Math.PI * 2 * cycles);
    p.push(`${f(x)}% ${f(y)}%`);
  }
  for (let i = n; i >= 1; i--) {
    const t = i / n, y = t * 100;
    const x = amp + amp * Math.sin(t * Math.PI * 2 * cycles);
    p.push(`${f(x)}% ${f(y)}%`);
  }
  return `polygon(${p.join(", ")})`;
}

const WAVY_CLIP = genWavyClip();

function getBgStyle(texture: string | undefined, bgColor: string) {
  const layers: string[] = [];
  const sizes: string[]  = [];

  if (texture === "ruled") {
    layers.push("repeating-linear-gradient(transparent,transparent 22px,rgba(0,0,0,0.09) 22px,rgba(0,0,0,0.09) 23px)");
    sizes.push("auto auto");
  } else if (texture === "dotted") {
    layers.push("radial-gradient(circle,rgba(0,0,0,0.16) 1px,transparent 1px)");
    sizes.push("14px 14px");
  }

  return {
    backgroundColor: bgColor,
    ...(layers.length ? { backgroundImage: layers.join(", "), backgroundSize: sizes.join(", ") } : {}),
  };
}

interface ScrollNote {
  key: string;
  sub: Submission;
  edge: number;
  metaIdx: number;
}

let noteKeySeq = 0;

function randomEdge() { return Math.random() < 0.5 ? 0 : 2; }

function makeNote(sub: Submission, metaIdx: number): ScrollNote {
  return { key: `${sub.id}-${noteKeySeq++}`, sub, edge: randomEdge(), metaIdx };
}

const NoteCard = React.memo(function NoteCard({ note }: { note: ScrollNote }) {
  const paper     = PAPER_COLORS[note.sub.colorStyle] ?? PAPER_COLORS.golden;
  const fontColor = FONT_COLOR_MAP[note.sub.fontColor ?? "warm"] ?? "#5c2a0a";
  const symbol    = SYMBOL_EMOJI[note.sub.symbol ?? "none"] ?? "";
  const meta      = slotMeta(note.metaIdx);
  const bgStyle   = getBgStyle(note.sub.texture, paper.bg);
  const edgeClipPath = note.edge === 2 ? WAVY_CLIP : undefined;

  const symbolRot = ((String(note.sub.id).split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 31) - 15);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        transform: `rotate(${meta.r}deg) scale(${meta.sc})`,
      }}
      data-testid={`wall-card-${note.sub.id}`}
    >
      <div style={{
        position: "absolute", top: -10, left: "50%",
        transform: "translateX(-50%) rotate(-1.5deg)",
        width: 56, height: 16,
        background: "rgba(255,255,255,0.48)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        zIndex: 10,
      }} />
      <div style={{
        position: "absolute", inset: 0,
        filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.12)) drop-shadow(0 1px 3px rgba(0,0,0,0.07))",
      }}>
        <div style={{
          width: "100%", height: "100%",
          display: "flex", flexDirection: "column", position: "relative",
          ...(edgeClipPath ? { clipPath: edgeClipPath } : {}),
          ...bgStyle,
        }}>
          <div style={{
            flex: 1, display: "flex", flexDirection: "column",
            justifyContent: "center", alignItems: "center",
            textAlign: "center", padding: "clamp(0.6rem,0.6vw,1.35rem)",
            paddingTop: "clamp(0.9rem,0.8vw,1.8rem)",
          }}>
            <div style={{
              fontFamily: "Georgia, serif", fontStyle: "italic",
              color: fontColor, opacity: 0.6,
              fontSize: "clamp(0.5rem, 0.43vw, 1rem)",
              marginBottom: "0.25em", width: "100%", textAlign: "center",
            }}>
              Light a diya of gratitude...
            </div>
            <div style={{
              fontFamily: "'Caveat', cursive", fontWeight: 600,
              color: fontColor,
              fontSize: note.sub.message.length > 70
                ? "clamp(1rem, 0.75vw, 1.65rem)"
                : "clamp(1.15rem, 1vw, 2.15rem)",
              lineHeight: 1.2, wordBreak: "break-word", width: "100%",
            }}>
              {note.sub.message}
            </div>
          </div>
          {symbol && (
            <div style={{
              position: "absolute", bottom: "0.4em", right: "0.5em",
              fontSize: "clamp(1.4rem, 1.2vw, 2.75rem)", opacity: 0.5, lineHeight: 1,
              transform: `rotate(${symbolRot}deg)`,
            }}>
              {symbol}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

/** One note per grid position; a replacement uses a fresh key to replay its entrance. */
const WallSlot = React.memo(function WallSlot({
  col,
  row,
  slotIndex,
  note,
  burning,
  burnElapsedMs,
}: {
  col: number;
  row: number;
  slotIndex: number;
  note: ScrollNote;
  burning: boolean;
  burnElapsedMs: number;
}) {
  const meta = slotMeta(note.metaIdx);
  return (
    <div
      className={burning ? "burning-note" : "wall-note-arrive"}
      style={{
        gridColumn: col + 1,
        gridRow: row + 1,
        minWidth: 0,
        minHeight: 0,
        "--note-dy": `${meta.dy}px`,
        "--burn-delay": `${((slotIndex * 5) % 8) * 110 - burnElapsedMs}ms`,
        transform: `translateY(${meta.dy}px)`,
      } as React.CSSProperties}
    >
      <NoteCard note={note} />
    </div>
  );
});

type MovingCard = { key: string; lane: number; y: number; note: ScrollNote };

/** Each side column is a conveyor. Existing cards keep moving when the latest-100 list changes. */
function ScrollingNotes({ notes, columns, cols, rows, height, gridStyle }: {
  notes: Submission[];
  columns: number[];
  cols: number;
  rows: number;
  height: number;
  gridStyle: React.CSSProperties;
}) {
  const [cards, setCards] = useState<MovingCard[]>([]);
  const poolRef = useRef<Submission[][]>([]);
  const pendingRef = useRef<Submission[][]>([]);
  const knownIdsRef = useRef<Set<number>>(new Set());
  const assignedRef = useRef<Map<string, ScrollNote | null>>(new Map());
  const distanceRef = useRef(height);

  useEffect(() => {
    const laneCount = Math.max(1, columns.length);
    const nextPool = Array.from({ length: laneCount }, () => [] as Submission[]);
    notes.forEach(note => nextPool[note.id % laneCount].push(note));
    const nextIds = new Set(notes.map(note => note.id));
    if (knownIdsRef.current.size) {
      notes.forEach(note => {
        if (!knownIdsRef.current.has(note.id)) {
          (pendingRef.current[note.id % laneCount] ??= []).push(note);
        }
      });
    }
    pendingRef.current = Array.from({ length: laneCount }, (_, lane) =>
      (pendingRef.current[lane] ?? []).filter(note => nextIds.has(note.id)));
    poolRef.current = nextPool;
    knownIdsRef.current = nextIds;
  }, [notes, columns.length]);

  useEffect(() => {
    if (!columns.length) return;
    const step = Math.max(170, height / rows);
    const cardHeight = step - GRID_GAP;
    let frame = 0;
    let lastTime = 0;
    let lastRender = 0;
    const draw = (time: number) => {
      if (lastTime) distanceRef.current += Math.min(time - lastTime, 100) * SCROLL_SPEED_PX_PER_SECOND / 1000;
      lastTime = time;
      if (time - lastRender >= 50) {
        lastRender = time;
        const first = Math.max(0, Math.floor((distanceRef.current - height - cardHeight) / step));
        const last = Math.ceil(distanceRef.current / step) + 1;
        const moving: MovingCard[] = [];
        const activeKeys = new Set<string>();
        columns.forEach((_, lane) => {
          const pool = poolRef.current[lane] ?? [];
          const visibleIds = new Set<number>();
          for (let row = first; row <= last; row++) {
            const existing = assignedRef.current.get(`${lane}:${row}`);
            if (existing) visibleIds.add(existing.sub.id);
          }
          for (let row = first; row <= last; row++) {
            const y = height + row * step - distanceRef.current;
            if (y < -cardHeight || y > height) continue;
            const key = `${lane}:${row}`;
            activeKeys.add(key);
            let note = assignedRef.current.get(key);
            if (!assignedRef.current.has(key)) {
              const pending = pendingRef.current[lane] ?? [];
              const pendingIndex = pending.findIndex(item => !visibleIds.has(item.id));
              const next = pendingIndex >= 0 ? pending.splice(pendingIndex, 1)[0] :
                Array.from({ length: pool.length }, (_, index) => pool[(row + index) % pool.length])
                  .find(item => !visibleIds.has(item.id));
              note = next ? makeNote(next, lane + row * cols) : null;
              assignedRef.current.set(key, note);
              if (note) visibleIds.add(note.sub.id);
            }
            if (note) moving.push({ key, lane, y, note });
          }
        });
        for (const key of assignedRef.current.keys()) {
          if (!activeKeys.has(key)) assignedRef.current.delete(key);
        }
        setCards(moving);
      }
      frame = window.requestAnimationFrame(draw);
    };
    frame = window.requestAnimationFrame(draw);
    return () => window.cancelAnimationFrame(frame);
  }, [columns, cols, height, rows]);

  const cardHeight = Math.max(170, height / rows) - GRID_GAP;
  return <div style={{ ...gridStyle, zIndex: 1 }} data-testid="scrolling-wall">
    {columns.map((col, lane) => <div key={col} style={{ gridColumn: col + 1, gridRow: "1 / -1", position: "relative", overflow: "hidden" }}>
      {cards.filter(card => card.lane === lane).map(card =>
        <div key={card.key} style={{ position: "absolute", top: card.y, left: 0, right: 0, height: cardHeight }}>
          <NoteCard note={card.note} />
        </div>)}
    </div>)}
  </div>;
}

type ActiveSlot = { note: ScrollNote };
type SlotPosition = { col: number; row: number };

function slotPositions(cols: number, rows: number): SlotPosition[] {
  const columns = validColumns(cols);
  const positions: SlotPosition[] = [];
  for (let row = 0; row < rows; row++) {
    for (const col of columns) positions.push({ col, row });
  }
  return positions;
}

// ── Main display ─────────────────────────────────────────────────────────────

export default function Display() {
  const [wallState, setWallState] = useState<WallState>({ mode: "wall", session: "initial", changedAt: 0, testMode: false });
  const [burnVisible, setBurnVisible] = useState(false);
  const [burnElapsedMs, setBurnElapsedMs] = useState(0);
  const [slots, setSlots] = useState<(ActiveSlot | null)[]>([]);
  const [scrollNotes, setScrollNotes] = useState<Submission[]>([]);

  const { cols, rows, height } = useGridDims(0, 0);
  const columns = useMemo(() => validColumns(cols), [cols]);
  const positions = useMemo(() => slotPositions(cols, rows), [cols, rows]);
  const slotCountRef = useRef(positions.length);
  const slotsRef = useRef<(ActiveSlot | null)[]>([]);
  const queueRef = useRef<ActiveSlot[]>([]);
  const allNotesRef = useRef<Submission[]>([]);
  const cursorRef = useRef<SubmissionCursor | null>(null);
  const seenIdsRef = useRef<Set<number>>(new Set());
  const seenBySessionRef = useRef<Map<string, Set<number>>>(new Map());
  slotCountRef.current = positions.length;

  const advanceSlots = useCallback(() => {
    const result = advanceWall(slotsRef.current, queueRef.current);
    if (!result.changed) return;
    slotsRef.current = result.slots;
    queueRef.current = result.queue;
    setSlots(result.slots);
  }, []);

  // One feed request provides both wall state and only the notes added since
  // the last poll. The fixed wall consumes its queue at one note per two seconds.
  useEffect(() => {
    let active = true;
    let loading = false;
    let knownSession = "";
    let knownBurnAt = 0;
    let knownMode: WallState["mode"] | null = null;

    const refresh = async () => {
      if (loading) return;
      loading = true;
      try {
        const data = await listSubmissions(false, knownSession, cursorRef.current);
        if (!active) return;
        const state = data.state;
        const burnAge = state.mode === "burn" ? Math.max(0, Date.now() - state.changedAt) : 0;
        setBurnVisible(state.mode === "burn" && burnAge < BURN_DURATION_MS);
        setWallState(previous =>
          previous.mode === state.mode && previous.session === state.session &&
          previous.changedAt === state.changedAt && previous.testMode === state.testMode
            ? previous : state,
        );

        if (state.session !== knownSession) {
          if (knownSession) {
            const shown = new Set(seenIdsRef.current);
            // Real notes still queued when testing starts should remain
            // eligible when the live wall returns.
            for (const queued of queueRef.current) shown.delete(queued.note.sub.id);
            seenBySessionRef.current.set(knownSession, shown);
          }
          knownSession = state.session;
          queueRef.current = [];
          allNotesRef.current = [];
          cursorRef.current = null;
          seenIdsRef.current = new Set(seenBySessionRef.current.get(state.session) ?? []);
          const empty = Array.from({ length: slotCountRef.current }, () => null);
          slotsRef.current = empty;
          setSlots(empty);
          setScrollNotes([]);
        }

        cursorRef.current = data.cursor;
        allNotesRef.current = data.reset ? data.items : [...allNotesRef.current, ...data.items];
        if (data.items.length || data.reset) {
          setScrollNotes(latestScrollNotes(allNotesRef.current));
          for (const note of data.items) {
            if (note.hidden || seenIdsRef.current.has(note.id)) continue;
            seenIdsRef.current.add(note.id);
            queueRef.current.push({ note: makeNote(note, queueRef.current.length) });
          }
        }
        if (state.testMode && knownMode === "burn" && state.mode === "wall") {
          // Rehearsing another wall fill after a demo burn should show all
          // 100 demo notes again, including those already displayed before.
          const empty = Array.from({ length: slotCountRef.current }, () => null);
          slotsRef.current = empty;
          setSlots(empty);
          queueRef.current = allNotesRef.current.filter(note => !note.hidden)
            .map((note, index) => ({ note: makeNote(note, index) }));
        }
        if (state.mode === "burn" && state.changedAt !== knownBurnAt) {
          knownBurnAt = state.changedAt;
          setBurnElapsedMs(Math.min(burnAge, BURN_DURATION_MS));
          if (burnAge < BURN_DURATION_MS && slotsRef.current.every(slot => !slot)) {
            const recent = allNotesRef.current.slice(-slotCountRef.current);
            const next = Array.from({ length: slotCountRef.current }, (_, index) =>
              recent[index] ? { note: makeNote(recent[index], index) } : null);
            slotsRef.current = next;
            setSlots(next);
          }
        }
        knownMode = state.mode;
      } catch (error) { console.error("Wall refresh failed", error); }
      finally { loading = false; }
    };
    void refresh();
    const timer = window.setInterval(refresh, POLL_INTERVAL_MS);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    if (wallState.mode !== "wall") return;
    const timer = window.setInterval(advanceSlots, FILL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [wallState.mode, advanceSlots]);

  useEffect(() => {
    const capacity = positions.length;
    const current = slotsRef.current;
    if (current.length === capacity) return;
    const displaced = current.slice(capacity).filter((slot): slot is ActiveSlot => slot !== null);
    if (displaced.length) queueRef.current.unshift(...displaced);
    const next = Array.from({ length: capacity }, (_, index) => current[index] ?? null);
    slotsRef.current = next;
    setSlots(next);
  }, [positions.length]);

  useEffect(() => {
    if (wallState.mode !== "burn" || !burnVisible) return;
    const finishBurn = () => {
      setBurnVisible(false);
      const empty = Array.from({ length: slotCountRef.current }, () => null);
      slotsRef.current = empty;
      setSlots(empty);
    };
    const remaining = BURN_DURATION_MS - Math.max(0, Date.now() - wallState.changedAt);
    if (remaining <= 0) {
      finishBurn();
      return;
    }
    const timer = window.setTimeout(finishBurn, remaining);
    return () => window.clearTimeout(timer);
  }, [wallState.mode, wallState.changedAt, burnVisible]);

  const cStart = middleColStart(cols);
  const rStart = Math.ceil((rows - 2) / 2);
  const gridStyle: React.CSSProperties = {
    position: "absolute", inset: 0,
    display: "grid",
    gridTemplateColumns: `repeat(${cols}, 1fr)`,
    gridTemplateRows: `repeat(${rows}, 1fr)`,
    gap: `${GRID_GAP}px`,
  };
  const burning = wallState.mode === "burn";
  const showNotes = wallState.mode === "wall" || (burning && burnVisible);

  return (
    <div
      className="w-screen h-screen overflow-hidden relative select-none"
      style={{
        backgroundColor: "#160e29",
        backgroundImage: "linear-gradient(rgba(20, 10, 35, 0.25), rgba(20, 10, 35, 0.45)), url('/diwali-night-wall-bg.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="absolute inset-0">
        <div style={{ ...gridStyle, zIndex: 0 }}>
          <div style={{
            gridColumn: `${cStart + 1} / ${cStart + 3}`,
            gridRow: `${rStart + 1} / ${rStart + 3}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            pointerEvents: "none",
          }}>
            <img
              src="/diwali-sabha-artwork.png"
              alt="Diwali Sabha artwork showing festive diyas and rangoli"
              style={{
                maxWidth: "min(600px, 32vw)",
                maxHeight: "min(500px, 38vh)",
                width: "100%",
                height: "auto",
                aspectRatio: "32 / 27",
                objectFit: "contain",
                objectPosition: "center",
              }}
            />
          </div>
        </div>

        {showNotes && <div style={{ ...gridStyle, zIndex: 1 }}>
          {positions.map(({ col, row }, slotIndex) => {
            const active = slots[slotIndex];
            return active && <WallSlot
              key={active.note.key}
              col={col}
              row={row}
              slotIndex={slotIndex}
              note={active.note}
              burning={burning}
              burnElapsedMs={burnElapsedMs}
            />;
          })}
        </div>}
        {wallState.mode === "scroll" && <ScrollingNotes key={wallState.session} notes={scrollNotes} columns={columns}
          cols={cols} rows={rows} height={height} gridStyle={gridStyle} />}
      </div>
      {wallState.mode === "qr" && <QrScreen session={wallState.session} />}
      {wallState.testMode && <div role="status" className="pointer-events-none absolute left-1/2 top-4 z-30 -translate-x-1/2 rounded-xl border-2 border-white bg-violet-700 px-5 py-2 text-lg font-bold tracking-widest text-white shadow-xl">
        TEST MODE · DEMO NOTES
      </div>}
      {burning && showNotes && <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
        <div className="burn-atmosphere" aria-hidden="true" style={{ "--burn-elapsed": `${burnElapsedMs}ms` } as React.CSSProperties}>
          <div className="burn-flash" />
          <div className="burn-embers" />
          <div className="burn-smoke burn-smoke-left" />
          <div className="burn-smoke burn-smoke-center" />
          <div className="burn-smoke burn-smoke-right" />
        </div>
      </div>}
    </div>
  );
}
