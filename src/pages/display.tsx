import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { listSubmissions, type Submission, type SubmissionCursor, type WallState } from "@/lib/api";
import { QrScreen } from "@/components/qr-screen";
import { advanceWall, FILL_INTERVAL_MS, latestScrollNotes } from "@/lib/wall-flow";
import { WALL_BG, CENTER_ART, AFTERMATH_TEXT } from "@/lib/theme";
import { CrackerCard } from "@/components/cracker-card";
import { type CrackerType, type CrackerColor, crackerForId } from "@/lib/crackers";
import { FireworksCanvas, type Anchor } from "@/components/fireworks-canvas";
import { enableSound, isSoundEnabled, toggleSound as toggleSoundAudio, playCue, type SoundCue } from "@/lib/sound";

// ── Grid geometry (responsive) ───────────────────────────────────────────────

const NOTE_TARGET = 200;
const LARGE_PROJECTOR_NOTE_TARGET = 280;
const GRID_GAP = 14;
const POLL_INTERVAL_MS = 2500;
const LEAD_IN_MS = 3000;
const SHOW_MS = 20000;
const BURN_DURATION_MS = LEAD_IN_MS + SHOW_MS;
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
    dy: ((h >> 16 & 0xFF) / 255) * 16 - 8,
  };
}

function useGridDims(padX: number, padY: number) {
  const [dims, setDims] = useState(() => ({
    ...computeGridDims(window.innerWidth, window.innerHeight, padX, padY),
    height: window.innerHeight,
  }));
  useEffect(() => {
    const handler = () =>
      setDims({
        ...computeGridDims(window.innerWidth, window.innerHeight, padX, padY),
        height: window.innerHeight,
      });
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [padX, padY]);
  return dims;
}

interface ScrollNote {
  key: string;
  sub: Submission;
  metaIdx: number;
}

let noteKeySeq = 0;

function makeNote(sub: Submission, metaIdx: number): ScrollNote {
  return { key: `${sub.id}-${noteKeySeq++}`, sub, metaIdx };
}

/** One cracker per grid position. */
const WallSlot = React.memo(function WallSlot({
  col,
  row,
  slotIndex,
  note,
  lit,
  spent,
}: {
  col: number;
  row: number;
  slotIndex: number;
  note: ScrollNote;
  lit: boolean;
  spent: boolean;
}) {
  const meta = slotMeta(note.metaIdx);
  const cracker = note.sub.cracker ?? crackerForId(note.sub.id);
  const color = (note.sub.colorStyle ?? "golden") as CrackerColor;

  return (
    <div
      data-cracker-slot={slotIndex}
      data-cracker-type={cracker}
      data-cracker-color={color}
      data-testid={`wall-card-${note.sub.id}`}
      className="wall-note-arrive"
      style={{
        gridColumn: col + 1,
        gridRow: row + 1,
        minWidth: 0,
        minHeight: 0,
        transform: `translateY(${meta.dy}px)`,
      }}
    >
      <CrackerCard
        message={note.sub.message}
        color={color}
        type={cracker}
        id={note.sub.id}
        lit={lit}
        spent={spent}
        largeFont={true}
      />
    </div>
  );
});

type MovingCard = { key: string; lane: number; y: number; note: ScrollNote };

/** Each side column is a conveyor of crackers. */
function ScrollingNotes({
  notes,
  columns,
  cols,
  rows,
  height,
  gridStyle,
}: {
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
      (pendingRef.current[lane] ?? []).filter(note => nextIds.has(note.id)),
    );
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
      if (lastTime)
        distanceRef.current +=
          (Math.min(time - lastTime, 100) * SCROLL_SPEED_PX_PER_SECOND) / 1000;
      lastTime = time;
      if (time - lastRender >= 50) {
        lastRender = time;
        const first = Math.max(
          0,
          Math.floor((distanceRef.current - height - cardHeight) / step),
        );
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
              const pendingIndex = pending.findIndex(
                item => !visibleIds.has(item.id),
              );
              const next =
                pendingIndex >= 0
                  ? pending.splice(pendingIndex, 1)[0]
                  : Array.from(
                      { length: pool.length },
                      (_, index) => pool[(row + index) % pool.length],
                    ).find(item => !visibleIds.has(item.id));
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
  return (
    <div style={{ ...gridStyle, zIndex: 1 }} data-testid="scrolling-wall">
      {columns.map((col, lane) => (
        <div
          key={col}
          style={{
            gridColumn: col + 1,
            gridRow: "1 / -1",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {cards
            .filter(card => card.lane === lane)
            .map(card => (
              <div
                key={card.key}
                style={{
                  position: "absolute",
                  top: card.y,
                  left: 0,
                  right: 0,
                  height: cardHeight,
                }}
              >
                <CrackerCard
                  message={card.note.sub.message}
                  color={(card.note.sub.colorStyle ?? "golden") as CrackerColor}
                  type={card.note.sub.cracker ?? crackerForId(card.note.sub.id)}
                  id={card.note.sub.id}
                  largeFont={true}
                />
              </div>
            ))}
        </div>
      ))}
    </div>
  );
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
  const [wallState, setWallState] = useState<WallState>({
    mode: "wall",
    session: "initial",
    changedAt: 0,
    testMode: false,
  });

  const [slots, setSlots] = useState<(ActiveSlot | null)[]>([]);
  const [scrollNotes, setScrollNotes] = useState<Submission[]>([]);

  // Sound state
  const isTopLevel = typeof window !== "undefined" && window.self === window.top;
  const [soundOn, setSoundOn] = useState(() => isSoundEnabled());

  const handleToggleSound = () => {
    const next = toggleSoundAudio();
    setSoundOn(next);
  };

  // Clock synchronization
  const clockOffsetRef = useRef(0);
  const serverNow = useCallback(() => Date.now() + clockOffsetRef.current, []);

  // Burn phase and fireworks state
  const [burnPhase, setBurnPhase] = useState<"idle" | "countdown" | "show" | "aftermath">("idle");
  const [countdownSec, setCountdownSec] = useState<number>(3);
  const [showT, setShowT] = useState<number>(0);
  const [screenShake, setScreenShake] = useState(false);
  const [litSlots, setLitSlots] = useState<Set<number>>(() => new Set());
  const [spentSlots, setSpentSlots] = useState<Set<number>>(() => new Set());
  const [anchors, setAnchors] = useState<Anchor[]>([]);

  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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

  // Poll submissions feed
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

        if (typeof data.serverTime === "number") {
          clockOffsetRef.current = data.serverTime - Date.now();
        }

        const state = data.state;
        setWallState(previous =>
          previous.mode === state.mode &&
          previous.session === state.session &&
          previous.changedAt === state.changedAt &&
          previous.testMode === state.testMode
            ? previous
            : state,
        );

        if (state.session !== knownSession) {
          if (knownSession) {
            const shown = new Set(seenIdsRef.current);
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
          const empty = Array.from({ length: slotCountRef.current }, () => null);
          slotsRef.current = empty;
          setSlots(empty);
          queueRef.current = allNotesRef.current
            .filter(note => !note.hidden)
            .map((note, index) => ({ note: makeNote(note, index) }));
        }
        if (state.mode === "burn" && state.changedAt !== knownBurnAt) {
          knownBurnAt = state.changedAt;
          const burnAge = Math.max(0, serverNow() - state.changedAt);
          if (burnAge < BURN_DURATION_MS) {
            const filledCount = slotsRef.current.filter(slot => slot !== null).length;
            if (filledCount < allNotesRef.current.length && allNotesRef.current.length > 0) {
              const recent = allNotesRef.current.slice(-slotCountRef.current);
              const next = Array.from({ length: slotCountRef.current }, (_, index) =>
                recent[index] ? { note: makeNote(recent[index], index) } : null,
              );
              slotsRef.current = next;
              setSlots(next);
            }
          }
        }
        knownMode = state.mode;
      } catch (error) {
        console.error("Wall refresh failed", error);
      } finally {
        loading = false;
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, POLL_INTERVAL_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [serverNow]);

  // Wall advance timer
  useEffect(() => {
    if (wallState.mode !== "wall") return;
    const timer = window.setInterval(advanceSlots, FILL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [wallState.mode, advanceSlots]);

  // Grid resize rebalance
  useEffect(() => {
    const capacity = positions.length;
    const current = slotsRef.current;
    if (current.length === capacity) return;
    const displaced = current
      .slice(capacity)
      .filter((slot): slot is ActiveSlot => slot !== null);
    if (displaced.length) queueRef.current.unshift(...displaced);
    const next = Array.from({ length: capacity }, (_, index) => current[index] ?? null);
    slotsRef.current = next;
    setSlots(next);
  }, [positions.length]);

  // Burn timeline loop
  useEffect(() => {
    if (wallState.mode !== "burn") {
      setBurnPhase("idle");
      setLitSlots(new Set());
      setSpentSlots(new Set());
      return;
    }

    const tick = () => {
      const burnAge = serverNow() - wallState.changedAt;
      const t = burnAge - LEAD_IN_MS;
      setShowT(t);

      if (t < 0) {
        setBurnPhase("countdown");
        setCountdownSec(Math.max(1, Math.min(3, Math.ceil(-t / 1000))));
      } else if (t < SHOW_MS) {
        setBurnPhase("show");
      } else {
        setBurnPhase("aftermath");
      }
    };

    tick();
    const interval = window.setInterval(tick, 100);
    return () => window.clearInterval(interval);
  }, [wallState.mode, wallState.changedAt, serverNow]);

  // Measure cracker anchors for fireworks
  useEffect(() => {
    if (burnPhase === "countdown" || burnPhase === "show") {
      const elements = document.querySelectorAll<HTMLElement>("[data-cracker-slot]");
      const measured: Anchor[] = [];
      elements.forEach(el => {
        const slot = parseInt(el.getAttribute("data-cracker-slot") || "-1", 10);
        const type = (el.getAttribute("data-cracker-type") || "anar") as CrackerType;
        const color = (el.getAttribute("data-cracker-color") || "golden") as CrackerColor;
        const rect = el.getBoundingClientRect();
        if (slot >= 0 && rect.width > 0 && rect.height > 0) {
          measured.push({
            slot,
            type,
            color,
            x: rect.left,
            y: rect.top,
            w: rect.width,
            h: rect.height,
          });
        }
      });
      if (measured.length > 0) {
        setAnchors(prev => {
          if (
            prev.length === measured.length &&
            prev.every(
              (p, i) =>
                p.slot === measured[i].slot &&
                Math.abs(p.x - measured[i].x) < 2 &&
                Math.abs(p.y - measured[i].y) < 2,
            )
          ) {
            return prev;
          }
          return measured;
        });
      }
    }
  }, [burnPhase, slots]);

  const handleCue = useCallback(
    (cue: SoundCue) => {
      if (soundOn) {
        playCue(cue);
      }
      if (cue === "boom") {
        setScreenShake(true);
        window.setTimeout(() => setScreenShake(false), 250);
      }
    },
    [soundOn],
  );

  const handleLitSlotChange = useCallback((slot: number, isLit: boolean) => {
    setLitSlots(prev => {
      const next = new Set(prev);
      if (isLit) next.add(slot);
      else next.delete(slot);
      return next;
    });
  }, []);

  const handleSpentSlot = useCallback((slot: number) => {
    setSpentSlots(prev => {
      const next = new Set(prev);
      next.add(slot);
      return next;
    });
  }, []);

  const cStart = middleColStart(cols);
  const rStart = Math.ceil((rows - 2) / 2);
  const gridStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    display: "grid",
    gridTemplateColumns: `repeat(${cols}, 1fr)`,
    gridTemplateRows: `repeat(${rows}, 1fr)`,
    gap: `${GRID_GAP}px`,
  };

  const isBurn = wallState.mode === "burn";
  const showCrackers = wallState.mode === "wall" || (isBurn && burnPhase !== "aftermath");

  return (
    <div
      className={`w-screen h-screen overflow-hidden relative select-none ${
        screenShake ? "screen-shake" : ""
      }`}
      style={{
        backgroundColor: "#070716",
        backgroundImage: `url('${WALL_BG}')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="absolute inset-0">
        {/* Center Artwork */}
        <div style={{ ...gridStyle, zIndex: 0 }}>
          <div
            style={{
              gridColumn: `${cStart + 1} / ${cStart + 3}`,
              gridRow: `${rStart + 1} / ${rStart + 3}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <img
              src={CENTER_ART}
              alt="A glowing Diwali diya"
              style={{
                maxWidth: "min(520px, 28vw)",
                maxHeight: "min(420px, 32vh)",
                width: "100%",
                height: "auto",
                objectFit: "contain",
                filter: "drop-shadow(0 0 25px rgba(245, 158, 11, 0.4))",
              }}
            />
          </div>
        </div>

        {/* Crackers Grid */}
        {showCrackers && (
          <div style={{ ...gridStyle, zIndex: 1 }}>
            {positions.map(({ col, row }, slotIndex) => {
              const active = slots[slotIndex];
              return (
                active && (
                  <WallSlot
                    key={active.note.key}
                    col={col}
                    row={row}
                    slotIndex={slotIndex}
                    note={active.note}
                    lit={litSlots.has(slotIndex)}
                    spent={spentSlots.has(slotIndex)}
                  />
                )
              );
            })}
          </div>
        )}

        {/* Scrolling Crackers */}
        {wallState.mode === "scroll" && (
          <ScrollingNotes
            key={wallState.session}
            notes={scrollNotes}
            columns={columns}
            cols={cols}
            rows={rows}
            height={height}
            gridStyle={gridStyle}
          />
        )}
      </div>

      {/* QR Screen */}
      {wallState.mode === "qr" && <QrScreen session={wallState.session} />}

      {/* Test Mode Banner */}
      {wallState.testMode && (
        <div
          role="status"
          className="pointer-events-none absolute left-1/2 top-4 z-30 -translate-x-1/2 rounded-xl border-2 border-white bg-violet-700 px-5 py-2 text-lg font-bold tracking-widest text-white shadow-xl"
        >
          TEST MODE · DEMO CRACKERS
        </div>
      )}

      {/* Countdown Overlay */}
      {isBurn && burnPhase === "countdown" && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-black/30 backdrop-blur-[2px]">
          <div
            key={countdownSec}
            className="burn-countdown text-8xl md:text-9xl font-black text-amber-300 drop-shadow-[0_0_40px_rgba(245,158,11,0.95)]"
          >
            {countdownSec}
          </div>
        </div>
      )}

      {/* Fireworks Canvas Engine */}
      {isBurn && burnPhase === "show" && (
        <FireworksCanvas
          showT={Math.max(0, showT)}
          running={true}
          seed={wallState.changedAt}
          anchors={anchors}
          reducedMotion={reducedMotion}
          onCue={handleCue}
          onLitSlotChange={handleLitSlotChange}
          onSpentSlot={handleSpentSlot}
        />
      )}

      {/* Aftermath Celebration */}
      {isBurn && burnPhase === "aftermath" && (
        <div className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-between p-8 md:p-12">
          {/* Top floating gold sparks */}
          <div className="relative w-full flex-1 flex items-center justify-center overflow-hidden">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="float-up absolute w-2.5 h-2.5 rounded-full bg-amber-300 shadow-[0_0_12px_#f59e0b]"
                style={{
                  left: `${8 + i * 9}%`,
                  bottom: `${15 + (i % 4) * 12}%`,
                  animationDelay: `${i * 0.55}s`,
                }}
              />
            ))}

            {/* Centered Glowing Aftermath Title */}
            <div className="flex flex-col items-center text-center px-4">
              <h1 className="aftermath-title text-6xl md:text-8xl lg:text-9xl font-serif font-black tracking-wider leading-tight">
                {AFTERMATH_TEXT}
              </h1>
              <p className="mt-4 text-amber-200/80 font-serif italic text-lg md:text-2xl tracking-wide max-w-xl">
                May the lights of Diwali bring happiness, peace, and prosperity to all.
              </p>
            </div>
          </div>

          {/* Bottom row of 7 flickering diyas */}
          <div className="w-full max-w-4xl flex items-center justify-around px-4 pb-4">
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                className="diya-flicker flex flex-col items-center"
                style={{ animationDelay: `${(i * 0.3) % 2}s` }}
              >
                <img
                  src={CENTER_ART}
                  alt="Diwali Diya"
                  className="w-14 h-14 md:w-20 md:h-20 object-contain drop-shadow-[0_0_15px_rgba(245,158,11,0.7)]"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sound Toggle Button (top-level only, silent if iframe preview) */}
      {isTopLevel && (
        <button
          onClick={handleToggleSound}
          className="absolute bottom-4 left-4 z-40 px-3.5 py-1.5 rounded-full bg-slate-900/80 hover:bg-slate-800 text-amber-200 text-sm font-medium border border-amber-500/30 shadow-lg backdrop-blur flex items-center gap-1.5 transition-colors cursor-pointer"
          title="Toggle fireworks sound"
        >
          <span>{soundOn ? "🔊" : "🔇"}</span>
          <span>{soundOn ? "Sound on" : "Enable sound"}</span>
        </button>
      )}
    </div>
  );
}
