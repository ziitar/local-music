/**
 * Global singleton service for Web Audio API analyser.
 *
 * Audio chain: source → [EQ filters] → analyser → loudness GainNode → destination
 *
 * When EQ is disabled: source → analyser → loudness gain → destination
 * When loudness norm is off: loudness gain = 1.0 (passthrough)
 *
 * Initialized once by PlayerBar; consumed by SongDetailPage.
 */

import { equalizerService } from "./equalizer.ts";

let audioCtx: AudioContext | null = null;
let sourceNode: MediaElementAudioSourceNode | null = null;
let connectedElement: HTMLAudioElement | null = null;
let analyserNode: AnalyserNode | null = null;
let loudnessGainNode: GainNode | null = null;

/**
 * Reconnect the audio graph based on current EQ enabled state.
 *
 * Always disconnects everything first, then reconnects:
 * - EQ on:  source → eq.input → eq.output → analyser → loudnessGain → destination
 * - EQ off: source → analyser → loudnessGain → destination
 */
function reconnect(): void {
  if (!sourceNode || !analyserNode || !loudnessGainNode || !audioCtx) return;

  // Disconnect everything
  try { sourceNode.disconnect(); } catch { /* ignore */ }
  try { equalizerService.outputNode?.disconnect(); } catch { /* ignore */ }
  try { analyserNode.disconnect(); } catch { /* ignore */ }
  try { loudnessGainNode.disconnect(); } catch { /* ignore */ }

  if (equalizerService.enabled && equalizerService.inputNode && equalizerService.outputNode) {
    // source → EQ input → EQ output → analyser → loudnessGain → destination
    sourceNode.connect(equalizerService.inputNode);
    equalizerService.outputNode.connect(analyserNode);
  } else {
    // source → analyser → loudnessGain → destination
    sourceNode.connect(analyserNode);
  }

  analyserNode.connect(loudnessGainNode);
  loudnessGainNode.connect(audioCtx.destination);
}

function init(audioElement: HTMLAudioElement): void {
  // Skip if already initialized with the same element
  if (connectedElement === audioElement && analyserNode) {
    if (audioCtx?.state === 'suspended') {
      audioCtx.resume();
    }
    return;
  }

  // Create AudioContext if needed
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }

  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  // Clean up old nodes
  if (analyserNode) {
    try { analyserNode.disconnect(); } catch { /* ignore */ }
    analyserNode = null;
  }
  if (loudnessGainNode) {
    try { loudnessGainNode.disconnect(); } catch { /* ignore */ }
    loudnessGainNode = null;
  }

  // Create source node from the audio element (one-time operation)
  if (!sourceNode || connectedElement !== audioElement) {
    if (sourceNode) {
      try { sourceNode.disconnect(); } catch { /* ignore */ }
    }
    sourceNode = audioCtx.createMediaElementSource(audioElement);
    connectedElement = audioElement;
  }

  // Create analyser node
  analyserNode = audioCtx.createAnalyser();
  analyserNode.fftSize = 512;
  analyserNode.smoothingTimeConstant = 0.8;

  // Create loudness gain node (default 1.0 = no adjustment)
  loudnessGainNode = audioCtx.createGain();
  loudnessGainNode.gain.value = 1.0;

  // Initialize EQ filters in this AudioContext
  equalizerService.init(audioCtx);

  // Connect everything
  reconnect();
}

function getAnalyser(): AnalyserNode | null {
  return analyserNode;
}

function isReady(): boolean {
  return analyserNode !== null;
}

function getAudioContext(): AudioContext | null {
  return audioCtx;
}

/**
 * Set the loudness normalization gain multiplier.
 * Call this when the song changes or the toggle switches.
 */
function setLoudnessGain(multiplier: number): void {
  if (loudnessGainNode) {
    loudnessGainNode.gain.value = multiplier;
  }
}

/**
 * Toggle EQ on/off and reconnect the audio graph.
 */
function setEqEnabled(enabled: boolean): void {
  equalizerService.setEnabled(enabled);
  reconnect();
}

export const audioAnalyserService = {
  init,
  getAnalyser,
  isReady,
  getAudioContext,
  setLoudnessGain,
  setEqEnabled,
};
