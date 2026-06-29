/**
 * 10-band parametric equalizer using Web Audio API BiquadFilterNode.
 *
 * Chain: source → [EQ filters if enabled] → analyser → loudness gain → destination
 * When disabled, filters are bypassed (source connects directly to next node).
 *
 * Presets are defined as dB gains per band.
 * Frequency bands: [32, 64, 125, 250, 500, 1K, 2K, 4K, 8K, 16K] Hz
 */

export interface EqPreset {
  name: string;
  label: string;
  gains: number[]; // 10 values in dB, range [-12, 12]
}

export const EQ_FREQUENCIES = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

export const EQ_PRESETS: EqPreset[] = [
  { name: "flat",       label: "平坦", gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { name: "pop",        label: "流行", gains: [5, 3, 1, 0, -1, 0, 1, 3, 4, 5] },
  { name: "rock",       label: "摇滚", gains: [5, 4, 3, 1, -1, 0, 1, 3, 4, 5] },
  { name: "classical",  label: "古典", gains: [4, 3, 2, 1, 0, 0, 1, 2, 3, 4] },
  { name: "jazz",       label: "爵士", gains: [3, 2, 1, 2, -1, -1, 0, 1, 2, 3] },
  { name: "electronic", label: "电子", gains: [5, 4, 2, 0, -1, 0, 2, 4, 5, 5] },
  { name: "bass",       label: "低音", gains: [6, 5, 4, 2, 0, 0, 0, 0, 0, 0] },
  { name: "vocal",      label: "人声", gains: [0, 0, 0, 2, 4, 4, 3, 1, 0, 0] },
];

const PRESET_MAP = Object.fromEntries(EQ_PRESETS.map(p => [p.name, p]));

class EqualizerService {
  private filters: BiquadFilterNode[] = [];
  private audioCtx: AudioContext | null = null;
  private _enabled = false;
  private _currentPreset = "flat";
  private _gains: number[] = new Array(10).fill(0);
  private _initialized = false;

  /**
   * Create 10 peaking BiquadFilterNodes in the given AudioContext.
   * Returns the filter chain: input → filter[0] → ... → filter[9] → output
   */
  init(ctx: AudioContext): void {
    if (this._initialized && this.audioCtx === ctx) return;
    this.audioCtx = ctx;

    // Clean up old filters
    for (const f of this.filters) {
      try { f.disconnect(); } catch { /* ignore */ }
    }
    this.filters = [];

    // Create 10 peaking filters
    for (let i = 0; i < 10; i++) {
      const filter = ctx.createBiquadFilter();
      filter.type = "peaking";
      filter.frequency.value = EQ_FREQUENCIES[i];
      filter.Q.value = 1.0;
      filter.gain.value = 0; // flat by default
      this.filters.push(filter);
    }

    // Chain filters together: filter[0] → filter[1] → ... → filter[9]
    for (let i = 0; i < this.filters.length - 1; i++) {
      this.filters[i].connect(this.filters[i + 1]);
    }

    this._initialized = true;

    // Apply any persisted preset
    this.applyPreset(this._currentPreset);
  }

  /** First filter in the chain (connect source here). */
  get inputNode(): BiquadFilterNode | null {
    return this.filters[0] ?? null;
  }

  /** Last filter in the chain (connect to analyser from here). */
  get outputNode(): BiquadFilterNode | null {
    return this.filters[this.filters.length - 1] ?? null;
  }

  get enabled(): boolean {
    return this._enabled;
  }

  get currentPreset(): string {
    return this._currentPreset;
  }

  get gains(): number[] {
    return [...this._gains];
  }

  /**
   * Enable or disable the equalizer.
   * When disabled, caller should bypass the filter chain.
   */
  setEnabled(enabled: boolean): void {
    this._enabled = enabled;
  }

  /**
   * Apply a named preset. Gains are set even if EQ is disabled,
   * so they're ready when re-enabled.
   */
  applyPreset(name: string): void {
    const preset = PRESET_MAP[name];
    if (!preset) return;
    this._currentPreset = name;
    this._gains = [...preset.gains];
    this._applyGains();
  }

  /**
   * Set gain for a single band (index 0-9, gain in dB [-12, 12]).
   */
  setBandGain(index: number, gain: number): void {
    if (index < 0 || index >= 10) return;
    this._gains[index] = Math.max(-12, Math.min(12, gain));
    this._applyGains();
  }

  private _applyGains(): void {
    if (!this._initialized) return;
    for (let i = 0; i < 10; i++) {
      this.filters[i].gain.value = this._gains[i];
    }
  }
}

/** Global singleton */
export const equalizerService = new EqualizerService();
