// ── Types ──────────────────────────────────────────────────────────

export interface VisualizerState {
  particles: Particle[];
  ripples: Ripple[];
  beat: BeatDetector;
  beamAngle: number;
  frame: number;
}

interface Particle {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  hue: number;
  size: number;
}

interface Ripple {
  radius: number;
  life: number;
  maxLife: number;
  hue: number;
  intensity: number;
}

interface BeatDetector {
  history: number[];
  index: number;
  lastBeat: number;
  cooldown: number;
}

// ── Constants ──────────────────────────────────────────────────────

const BEAT_HISTORY_SIZE = 50;
const BEAT_THRESHOLD = 1.4;
const BEAT_COOLDOWN = 10;
const BASS_BINS = 10;
const BAR_COUNT = 128;
const BASE_RADIUS_RATIO = 0.20;
const MAX_BAR_LENGTH_RATIO = 0.35;
const MAX_PARTICLES = 800;
const MAX_RIPPLES = 12;

// ── Factory ────────────────────────────────────────────────────────

export function createVisualizerState(): VisualizerState {
  return {
    particles: [],
    ripples: [],
    beat: {
      history: new Array(BEAT_HISTORY_SIZE).fill(0),
      index: 0,
      lastBeat: -BEAT_COOLDOWN,
      cooldown: BEAT_COOLDOWN,
    },
    beamAngle: 0,
    frame: 0,
  };
}

// ── Beat Detection ─────────────────────────────────────────────────

function detectBeat(
  state: VisualizerState,
  frequencyData: Uint8Array,
): { isBeat: boolean; energy: number } {
  let sum = 0;
  const binCount = Math.min(BASS_BINS, frequencyData.length);
  for (let i = 0; i < binCount; i++) {
    sum += frequencyData[i];
  }
  const energy = sum / (binCount * 255);

  state.beat.history[state.beat.index % BEAT_HISTORY_SIZE] = energy;
  state.beat.index++;

  let total = 0;
  for (let i = 0; i < BEAT_HISTORY_SIZE; i++) {
    total += state.beat.history[i];
  }
  const average = total / BEAT_HISTORY_SIZE;

  const isBeat =
    energy > average * BEAT_THRESHOLD &&
    energy > 0.15 &&
    state.frame - state.beat.lastBeat >= BEAT_COOLDOWN;

  if (isBeat) {
    state.beat.lastBeat = state.frame;
  }

  return { isBeat, energy };
}

// ── Particle Beams ─────────────────────────────────────────────────

function emitBeam(
  state: VisualizerState,
  width: number,
  height: number,
  energy: number,
): void {
  const cx = width / 2;
  const cy = height / 2;

  // Rotate beam angle with each beat for visual variety
  state.beamAngle += 0.7 + Math.random() * 0.5;

  // Primary beam + opposite beam (creates a through-line effect)
  emitCone(state, cx, cy, state.beamAngle, energy);
  emitCone(state, cx, cy, state.beamAngle + Math.PI, energy);

  // Side beams on strong beats for cross/star patterns
  if (energy > 0.45) {
    emitCone(state, cx, cy, state.beamAngle + Math.PI / 2, energy * 0.6);
    emitCone(state, cx, cy, state.beamAngle - Math.PI / 2, energy * 0.6);
  }
}

function emitCone(
  state: VisualizerState,
  cx: number,
  cy: number,
  direction: number,
  energy: number,
): void {
  const count = 8 + Math.floor(energy * 14);
  const spread = 0.10 + energy * 0.06;

  for (let i = 0; i < count; i++) {
    if (state.particles.length >= MAX_PARTICLES) break;

    const angle = direction + (Math.random() - 0.5) * spread * 2;
    const speed = 3 + energy * 5 + Math.random() * 2;

    const startX = cx + Math.cos(direction) * 5;
    const startY = cy + Math.sin(direction) * 5;

    state.particles.push({
      x: startX,
      y: startY,
      prevX: startX,
      prevY: startY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0,
      maxLife: 30 + Math.random() * 30,
      hue: 180 + Math.random() * 60,
      size: 1 + Math.random() * 2 + energy * 1.5,
    });
  }
}

function emitAmbientParticles(
  state: VisualizerState,
  width: number,
  height: number,
  energy: number,
): void {
  if (Math.random() > 0.3) return;
  if (state.particles.length >= MAX_PARTICLES) return;

  const cx = width / 2;
  const cy = height / 2;
  const minDim = Math.min(width, height);
  const angle = Math.random() * Math.PI * 2;
  const distance = minDim * (0.18 + Math.random() * 0.08);
  const speed = 0.3 + energy * 0.5;

  const startX = cx + Math.cos(angle) * distance;
  const startY = cy + Math.sin(angle) * distance;

  state.particles.push({
    x: startX,
    y: startY,
    prevX: startX,
    prevY: startY,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    life: 0,
    maxLife: 60 + Math.random() * 40,
    hue: 180 + Math.random() * 80,
    size: 0.5 + Math.random() * 1,
  });
}

function updateParticles(particles: Particle[]): void {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.prevX = p.x;
    p.prevY = p.y;
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.98;
    p.vy *= 0.98;
    p.life++;

    if (p.life > p.maxLife) {
      particles.splice(i, 1);
    }
  }
}

function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]): void {
  for (const p of particles) {
    const progress = p.life / p.maxLife;
    const alpha = (1 - progress) * 0.9;
    const hue = p.hue + progress * 30;

    // Motion trail as a short line from prev to current position
    ctx.strokeStyle = `hsla(${hue}, 100%, 75%, ${alpha})`;
    ctx.lineWidth = p.size * (1 - progress * 0.5);
    ctx.shadowBlur = 8;
    ctx.shadowColor = `hsla(${hue}, 100%, 60%, ${alpha * 0.8})`;
    ctx.beginPath();
    ctx.moveTo(p.prevX, p.prevY);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();

    // Bright head dot
    ctx.fillStyle = `hsla(${hue}, 80%, 90%, ${alpha})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * 0.5 * (1 - progress * 0.3), 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Ripples ────────────────────────────────────────────────────────

function spawnRipple(state: VisualizerState, energy: number): void {
  if (state.ripples.length >= MAX_RIPPLES) return;

  state.ripples.push({
    radius: 0,
    life: 0,
    maxLife: 90,
    hue: 180 + Math.random() * 80,
    intensity: 0.4 + energy * 0.6,
  });
}

function updateRipples(ripples: Ripple[], minDim: number): void {
  const maxRadius = minDim * 0.55;
  const speed = minDim * 0.005;

  for (let i = ripples.length - 1; i >= 0; i--) {
    const r = ripples[i];
    r.radius += speed;
    r.life++;

    if (r.life > r.maxLife || r.radius > maxRadius) {
      ripples.splice(i, 1);
    }
  }
}

function drawRipples(
  ctx: CanvasRenderingContext2D,
  ripples: Ripple[],
  width: number,
  height: number,
): void {
  const cx = width / 2;
  const cy = height / 2;

  for (const r of ripples) {
    const progress = r.life / r.maxLife;
    const alpha = r.intensity * (1 - progress) * 0.7;
    const lineWidth = 1 + (1 - progress) * 3;

    ctx.strokeStyle = `hsla(${r.hue}, 100%, 65%, ${alpha})`;
    ctx.lineWidth = lineWidth;
    ctx.shadowBlur = 15 + (1 - progress) * 10;
    ctx.shadowColor = `hsla(${r.hue}, 100%, 60%, ${alpha * 0.6})`;
    ctx.beginPath();
    ctx.arc(cx, cy, r.radius, 0, Math.PI * 2);
    ctx.stroke();
  }
}

// ── Multiple Wave Rings ────────────────────────────────────────────

interface WaveBand {
  startBin: number;
  endBin: number;
  baseRadius: number;
  hue: number;
  waveCount: number;
}

const WAVE_BANDS: WaveBand[] = [
  { startBin: 0, endBin: 10, baseRadius: 0.14, hue: 190, waveCount: 4 },   // Bass
  { startBin: 10, endBin: 40, baseRadius: 0.24, hue: 260, waveCount: 6 },  // Mid-low
  { startBin: 40, endBin: 128, baseRadius: 0.34, hue: 330, waveCount: 8 }, // Treble
];

function drawWaveRings(
  ctx: CanvasRenderingContext2D,
  frequencyData: Uint8Array,
  width: number,
  height: number,
  frame: number,
): void {
  const cx = width / 2;
  const cy = height / 2;
  const minDim = Math.min(width, height);

  for (const band of WAVE_BANDS) {
    const endBin = Math.min(band.endBin, frequencyData.length);
    let sum = 0;
    for (let i = band.startBin; i < endBin; i++) {
      sum += frequencyData[i];
    }
    const bandEnergy = sum / ((endBin - band.startBin) * 255);

    const baseRadius = minDim * band.baseRadius;
    const amplitude = minDim * 0.04 * (0.3 + bandEnergy * 0.7);
    const segments = 180;

    ctx.strokeStyle = `hsla(${band.hue}, 90%, 60%, ${0.25 + bandEnergy * 0.4})`;
    ctx.lineWidth = 1.5 + bandEnergy;
    ctx.shadowBlur = 10 + bandEnergy * 10;
    ctx.shadowColor = `hsla(${band.hue}, 90%, 60%, ${0.2 + bandEnergy * 0.3})`;
    ctx.beginPath();

    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const dataIndex =
        Math.floor((i / segments) * (endBin - band.startBin)) + band.startBin;
      const value = frequencyData[dataIndex] / 255;

      // Superpose multiple sine harmonics for organic wave look
      const wave1 =
        Math.sin(angle * band.waveCount + frame * 0.025 + band.startBin) *
        amplitude * 0.5;
      const wave2 =
        Math.sin(angle * (band.waveCount * 1.7) - frame * 0.035) *
        amplitude * 0.3;
      const wave3 =
        Math.cos(angle * (band.waveCount * 0.5) + frame * 0.018) *
        amplitude * 0.2;

      const displacement = wave1 + wave2 + wave3 + value * amplitude;
      const r = baseRadius + displacement;

      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.closePath();
    ctx.stroke();
  }
}

// ── Circular Frequency Bars ───────────────────────────────────────

function drawCircularBars(
  ctx: CanvasRenderingContext2D,
  data: Uint8Array,
  width: number,
  height: number,
): void {
  const cx = width / 2;
  const cy = height / 2;
  const minDim = Math.min(width, height);
  const radius = minDim * BASE_RADIUS_RATIO;
  const maxLen = minDim * MAX_BAR_LENGTH_RATIO;
  const count = Math.min(BAR_COUNT, data.length);

  for (let i = 0; i < count; i++) {
    const dataIndex = Math.floor((i / count) * data.length);
    const value = data[dataIndex] / 255;
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
    const barLen = value * maxLen;

    const x1 = cx + Math.cos(angle) * radius;
    const y1 = cy + Math.sin(angle) * radius;
    const x2 = cx + Math.cos(angle) * (radius + barLen);
    const y2 = cy + Math.sin(angle) * (radius + barLen);

    const hue = 180 + (i / count) * 160;
    const alpha = 0.25 + value * 0.35;

    ctx.strokeStyle = `hsla(${hue}, 80%, 55%, ${alpha})`;
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 4;
    ctx.shadowColor = `hsla(${hue}, 80%, 55%, ${alpha * 0.4})`;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
}

// ── Center Orb ─────────────────────────────────────────────────────

function drawCenterOrb(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  energy: number,
  isBeat: boolean,
): void {
  const cx = width / 2;
  const cy = height / 2;
  const minDim = Math.min(width, height);

  const beatPulse = isBeat ? 1.3 : 1;
  const radius = minDim * (0.06 + energy * 0.05) * beatPulse;

  // Outer glow
  const outerGradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 2.5);
  outerGradient.addColorStop(0, `hsla(200, 100%, 85%, ${0.5 + energy * 0.4})`);
  outerGradient.addColorStop(0.3, `hsla(240, 100%, 70%, ${0.3 + energy * 0.3})`);
  outerGradient.addColorStop(0.7, `hsla(280, 80%, 50%, ${0.1 + energy * 0.15})`);
  outerGradient.addColorStop(1, 'transparent');

  ctx.fillStyle = outerGradient;
  ctx.shadowBlur = 30 + energy * 30;
  ctx.shadowColor = `hsla(220, 100%, 60%, ${0.5 + energy * 0.4})`;
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Bright core
  const coreGradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  coreGradient.addColorStop(0, `hsla(200, 100%, 95%, ${0.8 + energy * 0.2})`);
  coreGradient.addColorStop(0.5, `hsla(220, 100%, 80%, ${0.4 + energy * 0.3})`);
  coreGradient.addColorStop(1, 'transparent');

  ctx.fillStyle = coreGradient;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
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
  const minDim = Math.min(width, height);

  ctx.clearRect(0, 0, width, height);

  // Beat detection
  const { isBeat, energy } = detectBeat(state, frequencyData);

  // Spawn effects on beat
  if (isBeat) {
    emitBeam(state, width, height, energy);
    spawnRipple(state, energy);
  }

  // Ambient particles keep the scene alive during quiet parts
  emitAmbientParticles(state, width, height, energy);

  // Draw layers back-to-front
  drawCircularBars(ctx, frequencyData, width, height);
  drawWaveRings(ctx, frequencyData, width, height, state.frame);
  drawRipples(ctx, state.ripples, width, height);
  drawCenterOrb(ctx, width, height, energy, isBeat);

  // Update & draw particles (on top of everything)
  updateParticles(state.particles);
  drawParticles(ctx, state.particles);

  // Update ripples
  updateRipples(state.ripples, minDim);

  // Reset shadow to avoid leaking into next frame
  ctx.shadowBlur = 0;

  state.frame++;
}
