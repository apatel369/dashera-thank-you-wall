import React, { useEffect, useRef } from "react";
import { type CrackerType, type CrackerColor, CRACKER_PALETTE } from "@/lib/crackers";
import { playCue, enableSound } from "@/lib/sound";

export interface SingleCrackerBurstProps {
  type: CrackerType;
  color: CrackerColor;
  stage: "ready" | "lit" | "bursting" | "aftermath";
}

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

export function SingleCrackerBurst({
  type,
  color,
  stage,
}: SingleCrackerBurstProps): React.JSX.Element | null {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);

  if (particlesRef.current.length === 0) {
    particlesRef.current = Array.from({ length: 600 }, () => ({
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
      drag: 0.98,
    }));
  }

  // Audio & Haptics trigger on stage change
  useEffect(() => {
    enableSound();
    if (stage === "lit") {
      playCue("fizz", 0.8);
      if ("vibrate" in navigator) navigator.vibrate?.(60);
    } else if (stage === "bursting") {
      if ("vibrate" in navigator) navigator.vibrate?.([80, 40, 150]);
      if (type === "bomb") {
        playCue("boom", 1.0);
      } else if (type === "rocket") {
        playCue("whistle", 0.9);
        window.setTimeout(() => playCue("boom", 0.9), 900);
      } else if (type === "anar") {
        playCue("fizz", 1.0);
        window.setTimeout(() => playCue("crackle", 0.8), 600);
        window.setTimeout(() => playCue("crackle", 0.9), 1800);
      } else if (type === "chakri") {
        playCue("whistle", 0.7);
        window.setTimeout(() => playCue("crackle", 0.8), 800);
      } else if (type === "phuljhari") {
        playCue("crackle", 0.9);
        window.setTimeout(() => playCue("crackle", 0.8), 1200);
      }
    }
  }, [stage, type]);

  // Particle simulation loop
  useEffect(() => {
    if (stage !== "bursting") return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let lastTime = performance.now();
    const startTime = lastTime;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
    };
    resize();
    window.addEventListener("resize", resize);

    const spawn = (
      x: number,
      y: number,
      vx: number,
      vy: number,
      pColor: string,
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
          p.color = pColor;
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

    const palette = CRACKER_PALETTE[color] ?? CRACKER_PALETTE.golden;
    const sparks = palette.sparks;

    // Rocket specific state
    let rocketY = 0;
    let rocketExploded = false;

    const loop = (now: number) => {
      const dt = Math.min(0.04, Math.max(0.005, (now - lastTime) / 1000));
      lastTime = now;
      const elapsed = (now - startTime) / 1000;

      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;

      // Soft fade
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
      ctx.fillRect(0, 0, w, h);

      // --- Emitting per cracker type ---
      if (type === "anar") {
        // High upward fountain for 4 seconds
        if (elapsed < 4.5) {
          const intensity = Math.min(1.0, elapsed * 1.5) * Math.max(0, 1 - (elapsed - 3.5));
          const spawnCount = Math.floor(12 * intensity);
          const topX = cx;
          const topY = cy - 20;
          for (let i = 0; i < spawnCount; i++) {
            const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.55;
            const spd = (240 + Math.random() * 260) * (h / 600);
            const pCol = sparks[Math.floor(Math.random() * sparks.length)];
            spawn(
              topX + (Math.random() - 0.5) * 16,
              topY,
              Math.cos(angle) * spd,
              Math.sin(angle) * spd,
              pCol,
              2.5 + Math.random() * 2,
              0.8 + Math.random() * 0.6,
              280,
              0.97,
            );
          }
        }
      } else if (type === "chakri") {
        // Spinning radial spray
        if (elapsed < 4.0) {
          const spawnCount = 8;
          const rotSpeed = now * 0.015;
          for (let i = 0; i < spawnCount; i++) {
            const angle = rotSpeed + (i * Math.PI * 2) / spawnCount;
            const spd = (160 + Math.random() * 140) * (w / 400);
            const pCol = sparks[Math.floor(Math.random() * sparks.length)];
            spawn(
              cx + Math.cos(angle) * 35,
              cy + Math.sin(angle) * 35,
              Math.cos(angle) * spd,
              Math.sin(angle) * spd,
              pCol,
              2.5 + Math.random() * 2,
              0.7 + Math.random() * 0.4,
              80,
              0.96,
            );
          }
        }
      } else if (type === "rocket") {
        // Rocket flies up and bursts
        if (elapsed < 0.9) {
          rocketY = cy - elapsed * (h * 0.55);
          // Tail sparks
          for (let i = 0; i < 4; i++) {
            spawn(
              cx + (Math.random() - 0.5) * 8,
              rocketY + 15,
              (Math.random() - 0.5) * 40,
              120 + Math.random() * 80,
              "#fef08a",
              2.5,
              0.35,
              60,
              0.95,
            );
          }
        } else if (!rocketExploded) {
          rocketExploded = true;
          const burstY = Math.max(h * 0.15, rocketY);
          // Giant explosion
          for (let i = 0; i < 160; i++) {
            const angle = Math.random() * Math.PI * 2;
            const spd = (100 + Math.random() * 320) * (w / 400);
            const pCol = sparks[i % sparks.length];
            spawn(
              cx,
              burstY,
              Math.cos(angle) * spd,
              Math.sin(angle) * spd,
              pCol,
              3 + Math.random() * 2,
              1.2 + Math.random() * 0.7,
              180,
              0.95,
            );
          }
        }
      } else if (type === "phuljhari") {
        // Sparkler sparkling all over for 4.5s
        if (elapsed < 4.5) {
          for (let i = 0; i < 9; i++) {
            const angle = Math.random() * Math.PI * 2;
            const spd = 60 + Math.random() * 160;
            const pCol = sparks[Math.floor(Math.random() * sparks.length)];
            spawn(
              cx + (Math.random() - 0.5) * 20,
              cy - 40 + (Math.random() - 0.5) * 30,
              Math.cos(angle) * spd,
              Math.sin(angle) * spd,
              pCol,
              2 + Math.random() * 2.5,
              0.4 + Math.random() * 0.4,
              120,
              0.96,
            );
          }
        }
      } else if (type === "bomb") {
        // Single explosive burst in the first frame
        if (elapsed < 0.2 && !rocketExploded) {
          rocketExploded = true;
          for (let i = 0; i < 200; i++) {
            const angle = Math.random() * Math.PI * 2;
            const spd = (120 + Math.random() * 360) * (w / 400);
            const pCol = sparks[i % sparks.length];
            spawn(
              cx,
              cy,
              Math.cos(angle) * spd,
              Math.sin(angle) * spd,
              pCol,
              3.5 + Math.random() * 2.5,
              1.0 + Math.random() * 0.8,
              240,
              0.94,
            );
          }
        }
      }

      // --- Draw particles ---
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

        p.prevX = p.x;
        p.prevY = p.y;
        p.vx *= Math.pow(p.drag, dt * 60);
        p.vy *= Math.pow(p.drag, dt * 60);
        p.vy += p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;

        p.alpha = Math.max(0, 1 - p.life / p.maxLife);
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1.0;
      ctx.globalCompositeOperation = "source-over";

      if (elapsed < 5.5) {
        animId = requestAnimationFrame(loop);
      }
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
      for (const p of particlesRef.current) p.active = false;
    };
  }, [stage, type, color]);

  if (stage !== "bursting") return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-30"
      aria-hidden="true"
    />
  );
}
