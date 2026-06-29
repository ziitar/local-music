// ── Types ──────────────────────────────────────────────────────────

export interface VisualizerState {
  frame: number;
}

// ── Factory ────────────────────────────────────────────────────────

export function createVisualizerState(): VisualizerState {
  return { frame: 0 };
}

// ── Wave Band Config ───────────────────────────────────────────────

interface WaveBand {
  startBin: number;
  endBin: number;
  color: string;
  baseY: number;        // 0..1 position from top
  maxAmplitude: number; // max wave height as fraction of canvas height
  speed1: number;
  speed2: number;
  speed3: number;
  freq1: number;
  freq2: number;
  freq3: number;
}

// With fftSize=512 → 256 bins, sampleRate≈44100 → ~172 Hz/bin
// Low:  20-250Hz   → bins 0-1
// Mid:  250-4kHz   → bins 2-23
// High: 4k-20kHz   → bins 24-116
const WAVE_BANDS: WaveBand[] = [
  {
    startBin: 0, endBin: 2,
    color: "#FF8C42",
    baseY: 0.70, maxAmplitude: 0.18,
    speed1: 0.012, speed2: 0.008, speed3: 0.005,
    freq1: 2.5, freq2: 4.0, freq3: 1.2,
  },
  {
    startBin: 2, endBin: 24,
    color: "#FFD166",
    baseY: 0.50, maxAmplitude: 0.12,
    speed1: 0.020, speed2: 0.014, speed3: 0.009,
    freq1: 3.5, freq2: 5.5, freq3: 1.8,
  },
  {
    startBin: 24, endBin: 117,
    color: "#E63946",
    baseY: 0.30, maxAmplitude: 0.08,
    speed1: 0.032, speed2: 0.022, speed3: 0.013,
    freq1: 5.0, freq2: 8.0, freq3: 2.5,
  },
];

// ── Helpers ────────────────────────────────────────────────────────

function bandEnergy(frequencyData: Uint8Array, startBin: number, endBin: number): number {
  const clampedEnd = Math.min(endBin, frequencyData.length);
  if (startBin >= clampedEnd) return 0;
  let sum = 0;
  for (let i = startBin; i < clampedEnd; i++) {
    sum += frequencyData[i];
  }
  return sum / ((clampedEnd - startBin) * 255);
}

function parseHexColor(hex: string): { r: number; g: number; b: number } {
  const m = hex.replace("#", "");
  return {
    r: parseInt(m.substring(0, 2), 16),
    g: parseInt(m.substring(2, 4), 16),
    b: parseInt(m.substring(4, 6), 16),
  };
}

// ── Draw Single Wave ───────────────────────────────────────────────

function drawWave(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  band: WaveBand,
  frequencyData: Uint8Array,
  frame: number,
): void {
  const energy = bandEnergy(frequencyData, band.startBin, band.endBin);
  const baseLineY = height * band.baseY;
  const maxAmp = height * band.maxAmplitude;
  const amplitude = maxAmp * (0.15 + energy * 0.85);
  const segments = Math.max(200, Math.floor(width / 2));

  // Build the wave path
  ctx.beginPath();
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const x = t * width;

    // Three sine harmonics for organic ocean movement
    const y =
      Math.sin(t * band.freq1 * Math.PI * 2 + frame * band.speed1) * amplitude * 0.50 +
      Math.sin(t * band.freq2 * Math.PI * 2 - frame * band.speed2) * amplitude * 0.30 +
      Math.cos(t * band.freq3 * Math.PI * 2 + frame * band.speed3) * amplitude * 0.20;

    if (i === 0) {
      ctx.moveTo(x, baseLineY + y);
    } else {
      ctx.lineTo(x, baseLineY + y);
    }
  }

  // Stroke the curve
  ctx.strokeStyle = band.color;
  ctx.lineWidth = 2.0;
  ctx.shadowBlur = 12 + energy * 20;
  ctx.shadowColor = band.color;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Gradient fill: curve edge (alpha ~0.7) → baseline (alpha 0.0)
  const { r, g, b } = parseHexColor(band.color);

  // Close path to baseline for fill
  ctx.lineTo(width, baseLineY);
  ctx.lineTo(0, baseLineY);
  ctx.closePath();

  const grad = ctx.createLinearGradient(0, baseLineY - amplitude, 0, baseLineY);
  grad.addColorStop(0, `rgba(${r},${g},${b},0.7)`);
  grad.addColorStop(0.6, `rgba(${r},${g},${b},0.25)`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0.0)`);
  ctx.fillStyle = grad;
  ctx.fill();
}

// ── Main Draw ──────────────────────────────────────────────────────

export function drawSciFiVisualizer(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  frequencyData: Uint8Array,
  _waveformData: Uint8Array,
  state: VisualizerState,
): void {
  const width = canvas.width;
  const height = canvas.height;

  ctx.clearRect(0, 0, width, height);

  // Additive blending for "light strip" overlap effect
  ctx.globalCompositeOperation = "lighter";

  // Draw all three waves (back to front: high → mid → low)
  for (let i = WAVE_BANDS.length - 1; i >= 0; i--) {
    drawWave(ctx, width, height, WAVE_BANDS[i], frequencyData, state.frame);
  }

  // Reset composite operation
  ctx.globalCompositeOperation = "source-over";

  state.frame++;
}
