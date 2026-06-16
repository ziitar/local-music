export interface VisualizerState {
  particles: Particle[];
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  hue: number;
  size: number;
}

const BAR_COUNT = 120;
const BASE_RADIUS_RATIO = 0.22;
const MAX_BAR_LENGTH_RATIO = 0.38;
const BASS_BIN_COUNT = 8;

export function createVisualizerState(): VisualizerState {
  return {
    particles: [],
  };
}

function createParticle(width: number, height: number, energy: number): Particle {
  const cx = width / 2;
  const cy = height / 2;
  const angle = Math.random() * Math.PI * 2;
  const distance = Math.min(width, height) * (0.22 + Math.random() * 0.08);

  return {
    x: cx + Math.cos(angle) * distance,
    y: cy + Math.sin(angle) * distance,
    vx: Math.cos(angle) * (0.5 + energy * 4),
    vy: Math.sin(angle) * (0.5 + energy * 4),
    life: 0,
    maxLife: 50 + Math.random() * 60,
    hue: 180 + Math.random() * 160,
    size: 1 + Math.random() * 2,
  };
}

function updateParticles(
  particles: Particle[],
  energy: number,
  width: number,
  height: number,
): void {
  const spawnCount = Math.floor(energy * 5);
  for (let i = 0; i < spawnCount; i++) {
    particles.push(createParticle(width, height, energy));
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life++;

    if (p.life > p.maxLife) {
      particles.splice(i, 1);
    }
  }
}

function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]): void {
  for (const p of particles) {
    const progress = p.life / p.maxLife;
    const alpha = 1 - progress;

    ctx.shadowBlur = 6;
    ctx.shadowColor = `hsla(${p.hue}, 100%, 60%, ${alpha})`;
    ctx.fillStyle = `hsla(${p.hue}, 100%, 70%, ${alpha})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (1 + progress * 0.5), 0, Math.PI * 2);
    ctx.fill();
  }
}

function getBassEnergy(data: Uint8Array): number {
  const binCount = Math.min(BASS_BIN_COUNT, data.length);
  let sum = 0;
  for (let i = 0; i < binCount; i++) {
    sum += data[i];
  }
  return sum / (binCount * 255);
}

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
    const alpha = 0.5 + value * 0.5;

    ctx.strokeStyle = `hsla(${hue}, 90%, 60%, ${alpha})`;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 10;
    ctx.shadowColor = `hsla(${hue}, 90%, 60%, 0.6)`;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
}

function drawWaveformRing(
  ctx: CanvasRenderingContext2D,
  data: Uint8Array,
  width: number,
  height: number,
): void {
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.18;

  ctx.strokeStyle = 'rgba(0, 255, 255, 0.6)';
  ctx.lineWidth = 2;
  ctx.shadowBlur = 15;
  ctx.shadowColor = 'rgba(0, 255, 255, 0.8)';
  ctx.beginPath();

  for (let i = 0; i <= data.length; i++) {
    const idx = i % data.length;
    const angle = (idx / data.length) * Math.PI * 2 - Math.PI / 2;
    const value = data[idx] / 255;
    const r = radius + (value - 0.5) * radius * 0.8;
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

function drawCenterOrb(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  energy: number,
): void {
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * (0.08 + energy * 0.06);

  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 2);
  gradient.addColorStop(0, `hsla(200, 100%, 80%, ${0.6 + energy * 0.4})`);
  gradient.addColorStop(0.5, `hsla(260, 100%, 60%, ${0.3 + energy * 0.3})`);
  gradient.addColorStop(1, 'transparent');

  ctx.fillStyle = gradient;
  ctx.shadowBlur = 30 + energy * 20;
  ctx.shadowColor = 'rgba(100, 200, 255, 0.8)';
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 2, 0, Math.PI * 2);
  ctx.fill();
}

export function drawSciFiVisualizer(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  frequencyData: Uint8Array,
  waveformData: Uint8Array,
  state: VisualizerState,
): void {
  const width = canvas.width;
  const height = canvas.height;

  // Trail effect: fade the previous frame instead of fully clearing
  ctx.fillStyle = 'rgba(255, 255, 255, 0)';
  ctx.fillRect(0, 0, width, height);

  const energy = getBassEnergy(frequencyData);

  drawCircularBars(ctx, frequencyData, width, height);
  drawWaveformRing(ctx, waveformData, width, height);
  drawCenterOrb(ctx, width, height, energy);

  updateParticles(state.particles, energy, width, height);
  drawParticles(ctx, state.particles);

  // Reset shadow so it does not leak into the next frame's clear/fill
  ctx.shadowBlur = 0;
}
