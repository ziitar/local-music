/**
 * Global singleton service for Web Audio API analyser.
 *
 * Manages the AudioContext and analyser node for audio visualization.
 * Initialized once by PlayerBar; consumed by SongDetailPage.
 *
 * Key invariant: sourceNode → destination connection is NEVER broken.
 * This ensures audio keeps playing when visualization components unmount.
 */

let audioCtx: AudioContext | null = null;
let sourceNode: MediaElementAudioSourceNode | null = null;
let connectedElement: HTMLAudioElement | null = null;
let analyserNode: AnalyserNode | null = null;

function init(audioElement: HTMLAudioElement): void {
  // Skip if already initialized with the same element
  if (connectedElement === audioElement && analyserNode) {
    // Just resume if suspended (e.g. after browser autoplay policy)
    if (audioCtx?.state === 'suspended') {
      audioCtx.resume();
    }
    return;
  }

  // Create AudioContext if needed
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }

  // Resume if suspended
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
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

  // Connect: source → analyser → destination
  // sourceNode is NEVER disconnected from the graph
  sourceNode.connect(analyserNode);
  analyserNode.connect(audioCtx.destination);
}

function getAnalyser(): AnalyserNode | null {
  return analyserNode;
}

function isReady(): boolean {
  return analyserNode !== null;
}

export const audioAnalyserService = { init, getAnalyser, isReady };
