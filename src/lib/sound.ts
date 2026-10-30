export type SoundCue = "fizz" | "whistle" | "pop" | "boom" | "crackle" | "finale";

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let compressor: DynamicsCompressorNode | null = null;

let activeVoices = 0;
const MAX_VOICES = 24;
const MAX_CUES_PER_SEC = 12;
const cueTimestamps: number[] = [];

// Helper to generate a 1-second white noise buffer
let noiseBuffer: AudioBuffer | null = null;

function getNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) return noiseBuffer;
  const bufferSize = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  noiseBuffer = buffer;
  return buffer;
}

export function enableSound(): void {
  if (audioCtx) {
    if (audioCtx.state === "suspended") {
      void audioCtx.resume();
    }
    return;
  }

  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    audioCtx = new AudioContextClass();
    compressor = audioCtx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-18, audioCtx.currentTime);
    compressor.knee.setValueAtTime(12, audioCtx.currentTime);
    compressor.ratio.setValueAtTime(6, audioCtx.currentTime);
    compressor.attack.setValueAtTime(0.003, audioCtx.currentTime);
    compressor.release.setValueAtTime(0.2, audioCtx.currentTime);

    masterGain = audioCtx.createGain();
    masterGain.gain.setValueAtTime(0.5, audioCtx.currentTime);

    masterGain.connect(compressor);
    compressor.connect(audioCtx.destination);
  } catch {
    // AudioContext not supported
  }
}

export function disableSound(): void {
  if (audioCtx && audioCtx.state === "running") {
    void audioCtx.suspend();
  }
}

export function isSoundEnabled(): boolean {
  return audioCtx !== null && audioCtx.state === "running";
}

export function toggleSound(): boolean {
  if (isSoundEnabled()) {
    disableSound();
    return false;
  }
  enableSound();
  return isSoundEnabled();
}

function rateLimitCheck(): boolean {
  const now = performance.now();
  // Clean timestamps older than 1 second
  while (cueTimestamps.length && cueTimestamps[0] < now - 1000) {
    cueTimestamps.shift();
  }
  if (cueTimestamps.length >= MAX_CUES_PER_SEC) {
    return false;
  }
  cueTimestamps.push(now);
  return true;
}

export function playCue(cue: SoundCue, intensity = 1): void {
  if (!audioCtx || audioCtx.state !== "running" || !masterGain) return;
  if (activeVoices >= MAX_VOICES) return;
  if (!rateLimitCheck()) return;

  const ctx = audioCtx;
  const now = ctx.currentTime;
  const clampedIntensity = Math.max(0.2, Math.min(1.5, intensity));

  activeVoices++;
  const onVoiceEnd = () => {
    activeVoices = Math.max(0, activeVoices - 1);
  };

  try {
    switch (cue) {
      case "fizz": {
        // Filtered white noise, 0.3s, highpass at 3kHz, quiet
        const src = ctx.createBufferSource();
        src.buffer = getNoiseBuffer(ctx);
        const filter = ctx.createBiquadFilter();
        filter.type = "highpass";
        filter.frequency.setValueAtTime(3000, now);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.08 * clampedIntensity, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

        src.connect(filter);
        filter.connect(gain);
        gain.connect(masterGain);

        src.start(now);
        src.stop(now + 0.32);
        src.onended = onVoiceEnd;
        break;
      }

      case "whistle": {
        // Sine sweep 600Hz to 1800Hz over 1s, low gain
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(1800, now + 0.9);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.01, now);
        gain.gain.linearRampToValueAtTime(0.12 * clampedIntensity, now + 0.3);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.0);

        osc.connect(gain);
        gain.connect(masterGain);

        osc.start(now);
        osc.stop(now + 1.05);
        osc.onended = onVoiceEnd;
        break;
      }

      case "pop": {
        // Short noise burst (0.12s) with bandpass at 800Hz and fast decay
        const src = ctx.createBufferSource();
        src.buffer = getNoiseBuffer(ctx);
        const filter = ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.setValueAtTime(800, now);
        filter.Q.setValueAtTime(3, now);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.35 * clampedIntensity, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

        src.connect(filter);
        filter.connect(gain);
        gain.connect(masterGain);

        src.start(now);
        src.stop(now + 0.14);
        src.onended = onVoiceEnd;
        break;
      }

      case "boom": {
        // 0.6s lowpass noise plus 60Hz sine thump with exponential decay
        // Sine thump
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(75, now);
        osc.frequency.exponentialRampToValueAtTime(35, now + 0.55);

        const oscGain = ctx.createGain();
        oscGain.gain.setValueAtTime(0.5 * clampedIntensity, now);
        oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

        osc.connect(oscGain);
        oscGain.connect(masterGain);

        osc.start(now);
        osc.stop(now + 0.62);

        // Lowpass noise thump
        const src = ctx.createBufferSource();
        src.buffer = getNoiseBuffer(ctx);
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(350, now);

        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.4 * clampedIntensity, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

        src.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(masterGain);

        src.start(now);
        src.stop(now + 0.58);
        src.onended = onVoiceEnd;
        break;
      }

      case "crackle": {
        // 8 to 15 very short clicks randomly spaced over 0.5s
        const count = 10;
        for (let i = 0; i < count; i++) {
          const delay = Math.random() * 0.45;
          const clickOsc = ctx.createOscillator();
          clickOsc.type = "square";
          clickOsc.frequency.setValueAtTime(1200 + Math.random() * 800, now + delay);

          const clickGain = ctx.createGain();
          clickGain.gain.setValueAtTime(0.08 * clampedIntensity, now + delay);
          clickGain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.02);

          clickOsc.connect(clickGain);
          clickGain.connect(masterGain);

          clickOsc.start(now + delay);
          clickOsc.stop(now + delay + 0.025);
        }
        setTimeout(onVoiceEnd, 500);
        break;
      }

      case "finale": {
        playCue("pop", 1.2);
        setTimeout(() => playCue("boom", 1.2), 60);
        setTimeout(onVoiceEnd, 200);
        break;
      }
    }
  } catch {
    onVoiceEnd();
  }
}
