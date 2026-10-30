import React, { useEffect, useRef } from "react";
import { type CrackerType, type CrackerColor, CRACKER_PALETTE } from "../lib/crackers.ts";
import { IGNITION_POINTS } from "./cracker-art.tsx";
import {
  buildIgnitions,
  buildFinale,
  SHOW_MS,
  FINALE_START_MS,
  type Ignition,
  type FinaleEvent,
} from "../lib/fireworks-schedule.ts";
import { type SoundCue } from "../lib/sound.ts";

export interface Anchor {
  slot: number;
  type: CrackerType;
  color: CrackerColor;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FireworksCanvasProps {
  showT: number;
  running: boolean;
  seed: number;
  anchors: Anchor[];
  reducedMotion: boolean;
  onCue?: (cue: SoundCue) => void;
  onLitSlotChange?: (slot: number, isLit: boolean) => void;
  onSpentSlot?: (slot: number) => void;
}

const MAX_PARTICLES = 3500;

interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  prevX: number;
  prevY: number;
  color: string;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
  gravity: number;
  drag: number;
}

export function FireworksCanvas({
  showT,
  running,
  seed,
  anchors,
  reducedMotion,
  onCue,
  onLitSlotChange,
  onSpentSlot,
}: FireworksCanvasProps): React.JSX.Element | null {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Preallocated particle pool
  const particlesRef = useRef<Particle[]>([]);
  if (particlesRef.current.length === 0) {
    particlesRef.current = Array.from({ length: MAX_PARTICLES }, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      prevX: 0,
      prevY: 0,
      color: "#ffffff",
      size: 2,
      alpha: 1,
      life: 0,
      maxLife: 1,
      gravity: 0,
      drag: 1,
    }));
  }

  const ignitionsRef = useRef<Ignition[]>([]);
  const finaleRef = useRef<FinaleEvent[]>([]);
  const anchorsMapRef = useRef<Map<number, Anchor>>(new Map());

  // Keep references to latest callbacks
  const onCueRef = useRef(onCue);
  onCueRef.current = onCue;
  const onLitRef = useRef(onLitSlotChange);
  onLitRef.current = onLitSlotChange;
  const onSpentRef = useRef(onSpentSlot);
  onSpentRef.current = onSpentSlot;

  // Active state trackers
  const startedIgnitionsRef = useRef<Set<number>>(new Set());
  const finishedIgnitionsRef = useRef<Set<number>>(new Set());
  const startedFinaleRef = useRef<Set<number>>(new Set());

  // Active active entities (like flying rockets, bombs)
  const activeRocketsRef = useRef<
    Array<{
      id: number;
      startX: number;
      startY: number;
      targetY: number;
      startTime: number;
      duration: number;
      color: CrackerColor;
    }>
  >([]);

  const activeBombsRef = useRef<
    Array<{
      id: number;
      x: number;
      y: number;
      startTime: number;
      color: CrackerColor;
    }>
  >([]);

  // Chakri angles
  const chakriAnglesRef = useRef<Map<number, number>>(new Map());

  // Build schedule when anchors or seed changes
  useEffect(() => {
    anchorsMapRef.current = new Map(anchors.map(a => [a.slot, a]));
    const items = anchors.map(a => ({ slot: a.slot, type: a.type }));
    ignitionsRef.current = buildIgnitions(seed, items);
    finaleRef.current = buildFinale(seed, window.innerWidth, window.innerHeight);
    startedIgnitionsRef.current.clear();
    finishedIgnitionsRef.current.clear();
    startedFinaleRef.current.clear();
  }, [seed, anchors]);

  useEffect(() => {
    if (reducedMotion || !running) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const mountPerf = performance.now();
    let lastTime = mountPerf;
    let localShowT = showT;

    // Canvas sizing with 4.2MP cap
    const resizeCanvas = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      let w = window.innerWidth * dpr;
      let h = window.innerHeight * dpr;
      const totalPixels = w * h;
      if (totalPixels > 4200000) {
        const scale = Math.sqrt(4200000 / totalPixels);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }
      canvas.width = w;
      canvas.height = h;
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Particle allocator helper
    const spawnParticle = (
      x: number,
      y: number,
      vx: number,
      vy: number,
      color: string,
      size: number,
      maxLife: number,
      gravity = 0,
      drag = 0.98,
    ) => {
      const pool = particlesRef.current;
      for (let i = 0; i < pool.length; i++) {
        if (!pool[i].active) {
          const p = pool[i];
          p.active = true;
          p.x = x;
          p.y = y;
          p.prevX = x;
          p.prevY = y;
          p.vx = vx;
          p.vy = vy;
          p.color = color;
          p.size = size;
          p.alpha = 1;
          p.life = 0;
          p.maxLife = maxLife;
          p.gravity = gravity;
          p.drag = drag;
          return;
        }
      }
    };

    // Rolling frame time for adaptive emission quality
    let frameTimes: number[] = [];
    let emissionScale = 1.0;

    const loop = (now: number) => {
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(0.05, Math.max(0.001, rawDt));

      // Adaptive quality monitoring
      frameTimes.push(dt * 1000);
      if (frameTimes.length > 120) frameTimes.shift();
      if (frameTimes.length >= 30) {
        const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
        if (avg > 24) emissionScale = Math.max(0.35, emissionScale * 0.95);
        else if (avg < 14) emissionScale = Math.min(1.0, emissionScale + 0.02);
      }

      // Time progression from mount time
      const elapsedSinceMount = now - mountPerf;
      localShowT = showT + elapsedSinceMount;

      const scale = canvas.height / 1080;
      const w = canvas.width;
      const h = canvas.height;

      // Fade canvas previous frame
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
      ctx.fillRect(0, 0, w, h);

      // --- Process Ignitions ---
      const ignitions = ignitionsRef.current;
      const anchorsMap = anchorsMapRef.current;

      for (let i = 0; i < ignitions.length; i++) {
        const ig = ignitions[i];
        if (localShowT < ig.igniteAt) continue;

        const anchor = anchorsMap.get(ig.slot);
        if (!anchor) continue;

        // Origin in canvas coordinates
        const pt = IGNITION_POINTS[ig.type];
        const originX = (anchor.x + (pt.x / 100) * anchor.w) * (w / window.innerWidth);
        const originY = (anchor.y + (pt.y / 140) * anchor.h) * (h / window.innerHeight);
        const palette = CRACKER_PALETTE[anchor.color] ?? CRACKER_PALETTE.golden;

        // Start ignition: notify DOM
        if (!startedIgnitionsRef.current.has(ig.slot)) {
          startedIgnitionsRef.current.add(ig.slot);
          onLitRef.current?.(ig.slot, true);
        }

        // Active duration
        const activeT = localShowT - ig.igniteAt;

        // Fuse stage (first 600ms)
        if (activeT < 600) {
          if (Math.random() < 0.6 * emissionScale) {
            spawnParticle(
              originX + (Math.random() - 0.5) * 6,
              originY + (Math.random() - 0.5) * 6,
              (Math.random() - 0.5) * 60 * scale,
              (Math.random() - 0.5) * 60 * scale,
              "#ffedd5",
              2.5 * scale,
              0.25,
            );
          }
          if (activeT < 50) onCueRef.current?.("fizz");
          continue;
        }

        // Main effect (after 600ms) while before endAt
        if (localShowT < ig.endAt) {
          const effectT = activeT - 600;

          switch (ig.type) {
            case "phuljhari": {
              // 4 sparks per frame, 360 deg
              const count = Math.round(4 * emissionScale);
              for (let c = 0; c < count; c++) {
                const angle = Math.random() * Math.PI * 2;
                const spd = (60 + Math.random() * 160) * scale;
                const col = Math.random() < 0.3 ? "#ffffff" : palette.sparks[Math.floor(Math.random() * palette.sparks.length)];
                spawnParticle(
                  originX,
                  originY,
                  Math.cos(angle) * spd,
                  Math.sin(angle) * spd,
                  col,
                  (1.5 + Math.random() * 1.5) * scale,
                  0.3 + Math.random() * 0.4,
                  80 * scale,
                  0.94,
                );
              }
              if (Math.random() < 0.05) onCueRef.current?.("crackle");
              break;
            }

            case "chakri": {
              // Rotation angle ~14 rad/s
              const curAngle = (chakriAnglesRef.current.get(ig.slot) || 0) + 14 * dt;
              chakriAnglesRef.current.set(ig.slot, curAngle);

              const count = Math.round(4 * emissionScale);
              for (let c = 0; c < count; c++) {
                const tangent = curAngle + Math.PI / 2 + (Math.random() - 0.5) * 0.4;
                const spd = (220 + Math.random() * 160) * scale;
                const col = Math.random() < 0.3 ? "#ffffff" : palette.sparks[Math.floor(Math.random() * palette.sparks.length)];
                spawnParticle(
                  originX,
                  originY,
                  Math.cos(tangent) * spd,
                  Math.sin(tangent) * spd,
                  col,
                  2 * scale,
                  0.5 + Math.random() * 0.3,
                  100 * scale,
                  0.96,
                );
              }
              if (effectT < 60) onCueRef.current?.("fizz");
              break;
            }

            case "anar": {
              // 5.5s fountain: upward cone +/- 18 deg
              const duration = ig.endAt - (ig.igniteAt + 600);
              let intensity = 1.0;
              if (effectT < 1000) intensity = effectT / 1000;
              else if (effectT > duration - 1500) intensity = Math.max(0.1, (duration - effectT) / 1500);

              const count = Math.round((6 + Math.random() * 4) * intensity * emissionScale);
              for (let c = 0; c < count; c++) {
                const coneAngle = -Math.PI / 2 + (Math.random() - 0.5) * (36 * (Math.PI / 180));
                const spd = (420 + Math.random() * 280) * intensity * scale;
                const isTopWhite = Math.random() < 0.45;
                const col = isTopWhite ? "#ffffff" : palette.sparks[Math.floor(Math.random() * palette.sparks.length)];
                spawnParticle(
                  originX + (Math.random() - 0.5) * 8 * scale,
                  originY,
                  Math.cos(coneAngle) * spd,
                  Math.sin(coneAngle) * spd,
                  col,
                  (2 + Math.random() * 2) * scale,
                  0.9 + Math.random() * 0.7,
                  520 * scale,
                  0.98,
                );
              }
              if (effectT < 60) onCueRef.current?.("pop");
              break;
            }

            case "rocket": {
              // Trigger rocket launch once
              if (!activeRocketsRef.current.some(r => r.id === ig.slot)) {
                const targetH = (0.12 + Math.random() * 0.28) * h;
                activeRocketsRef.current.push({
                  id: ig.slot,
                  startX: originX,
                  startY: originY,
                  targetY: targetH,
                  startTime: localShowT,
                  duration: 1300,
                  color: anchor.color,
                });
                onCueRef.current?.("whistle");
              }
              break;
            }

            case "bomb": {
              // Trigger bomb burst once
              if (!activeBombsRef.current.some(b => b.id === ig.slot)) {
                activeBombsRef.current.push({
                  id: ig.slot,
                  x: originX,
                  y: originY,
                  startTime: localShowT,
                  color: anchor.color,
                });

                // Screen flash (white transparent rect)
                ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
                ctx.fillRect(0, 0, w, h);

                // Screen shake
                document.body.classList.add("screen-shake");
                setTimeout(() => document.body.classList.remove("screen-shake"), 260);

                // 80 chunky sparks
                for (let c = 0; c < 80; c++) {
                  const angle = Math.random() * Math.PI * 2;
                  const spd = (300 + Math.random() * 500) * scale;
                  spawnParticle(
                    originX,
                    originY,
                    Math.cos(angle) * spd,
                    Math.sin(angle) * spd,
                    palette.sparks[c % palette.sparks.length],
                    (3 + Math.random() * 2) * scale,
                    0.5 + Math.random() * 0.4,
                    350 * scale,
                    0.94,
                  );
                }
                onCueRef.current?.("boom");
              }
              break;
            }
          }
        } else {
          // Finished: set spent
          if (!finishedIgnitionsRef.current.has(ig.slot)) {
            finishedIgnitionsRef.current.add(ig.slot);
            onLitRef.current?.(ig.slot, false);
            onSpentRef.current?.(ig.slot);
          }
        }
      }

      // --- Process Active Rockets ---
      const rockets = activeRocketsRef.current;
      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i];
        const rT = (localShowT - r.startTime) / r.duration;

        if (rT < 1.0) {
          // Flying up
          const curY = r.startY + (r.targetY - r.startY) * rT;
          const curX = r.startX;

          // Tail
          for (let p = 0; p < 3; p++) {
            spawnParticle(
              curX + (Math.random() - 0.5) * 4,
              curY + (Math.random() - 0.5) * 4,
              (Math.random() - 0.5) * 30 * scale,
              (40 + Math.random() * 60) * scale,
              "#ffedd5",
              2 * scale,
              0.4,
              40 * scale,
            );
          }
        } else {
          // Burst at top!
          const palette = CRACKER_PALETTE[r.color] ?? CRACKER_PALETTE.golden;
          const burstX = r.startX;
          const burstY = r.targetY;

          // 120 sphere particles
          for (let c = 0; c < 120; c++) {
            const angle = Math.random() * Math.PI * 2;
            const spd = (180 + Math.random() * 240) * scale;
            spawnParticle(
              burstX,
              burstY,
              Math.cos(angle) * spd,
              Math.sin(angle) * spd,
              palette.sparks[c % palette.sparks.length],
              2.5 * scale,
              1.2 + Math.random() * 0.6,
              160 * scale,
              0.96,
            );
          }

          // Delayed crackles
          for (let c = 0; c < 35; c++) {
            const offsetX = (Math.random() - 0.5) * 140 * scale;
            const offsetY = (Math.random() - 0.5) * 140 * scale;
            setTimeout(() => {
              spawnParticle(burstX + offsetX, burstY + offsetY, 0, 0, "#ffffff", 3 * scale, 0.12);
            }, 300 + Math.random() * 500);
          }

          onCueRef.current?.("pop");
          setTimeout(() => onCueRef.current?.("crackle"), 400);

          rockets.splice(i, 1);
        }
      }

      // --- Process Finale Events ---
      if (localShowT >= FINALE_START_MS) {
        const finale = finaleRef.current;
        for (let i = 0; i < finale.length; i++) {
          const ev = finale[i];
          if (localShowT >= ev.at && !startedFinaleRef.current.has(i)) {
            startedFinaleRef.current.add(i);

            const palette = CRACKER_PALETTE[ev.color] ?? CRACKER_PALETTE.golden;
            const fx = ev.x * (w / 1920);
            const fy = ev.y * (h / 1080);

            if (ev.kind === "peony") {
              for (let c = 0; c < 110; c++) {
                const angle = Math.random() * Math.PI * 2;
                const spd = (200 + Math.random() * 250) * scale;
                spawnParticle(
                  fx,
                  fy,
                  Math.cos(angle) * spd,
                  Math.sin(angle) * spd,
                  palette.sparks[c % palette.sparks.length],
                  2.5 * scale,
                  1.3 + Math.random() * 0.5,
                  180 * scale,
                  0.95,
                );
              }
            } else if (ev.kind === "ring") {
              const count = 75;
              for (let c = 0; c < count; c++) {
                const angle = (c / count) * Math.PI * 2;
                const spd = 280 * scale;
                spawnParticle(
                  fx,
                  fy,
                  Math.cos(angle) * spd,
                  Math.sin(angle) * spd,
                  palette.sparks[c % palette.sparks.length],
                  3 * scale,
                  1.0,
                  120 * scale,
                  0.97,
                );
              }
            } else if (ev.kind === "willow") {
              for (let c = 0; c < 90; c++) {
                const angle = Math.random() * Math.PI * 2;
                const spd = (140 + Math.random() * 200) * scale;
                spawnParticle(
                  fx,
                  fy,
                  Math.cos(angle) * spd,
                  Math.sin(angle) * spd,
                  "#fef08a",
                  2 * scale,
                  2.2 + Math.random() * 0.4,
                  220 * scale,
                  0.96,
                );
              }
            }
            onCueRef.current?.("finale");
          }
        }
      }

      // --- Draw & Update Particles ---
      ctx.globalCompositeOperation = "lighter";
      const pool = particlesRef.current;

      for (let i = 0; i < pool.length; i++) {
        const p = pool[i];
        if (!p.active) continue;

        p.life += dt;
        if (p.life >= p.maxLife) {
          p.active = false;
          continue;
        }

        // Physics step
        p.prevX = p.x;
        p.prevY = p.y;
        p.vx *= Math.pow(p.drag, dt * 60);
        p.vy *= Math.pow(p.drag, dt * 60);
        p.vy += p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;

        const progress = p.life / p.maxLife;
        p.alpha = Math.max(0, 1 - progress);

        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;

        // Draw streak for fast particle, dot otherwise
        const dx = p.x - p.prevX;
        const dy = p.y - p.prevY;
        const speedSq = dx * dx + dy * dy;

        if (speedSq > 9) {
          ctx.beginPath();
          ctx.moveTo(p.prevX, p.prevY);
          ctx.lineTo(p.x, p.y);
          ctx.lineWidth = p.size;
          ctx.strokeStyle = p.color;
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.globalAlpha = 1.0;
      ctx.globalCompositeOperation = "source-over";

      if (localShowT < SHOW_MS + 1000) {
        animId = requestAnimationFrame(loop);
      }
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resizeCanvas);
      // Clear pool
      for (const p of particlesRef.current) p.active = false;
    };
  }, [running, showT, reducedMotion]);

  if (reducedMotion || !running) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-10 pointer-events-none"
      aria-hidden="true"
    />
  );
}
