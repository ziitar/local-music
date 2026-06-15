import { useEffect, useRef, useState } from "react";

// Module-level singleton to prevent createMediaElementSource from being called twice
let globalAudioContext: AudioContext | null = null;
let globalSourceNode: MediaElementAudioSourceNode | null = null;
let globalAudioElementRef: HTMLAudioElement | null = null;

// Web Audio API analyser hook for audio visualization
// Called by: src/pages/SongDetail.tsx
// Connects to the shared <audio> element from playerStore
// User instruction: "音乐可视化就是将音频节奏进行可视化出来"

export function useAudioAnalyser(audioElement: HTMLAudioElement | null) {
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  useEffect(() => {
    if (!audioElement) {
      setAnalyser(null);
      return;
    }

    if (!globalAudioContext) {
      globalAudioContext = new AudioContext();
    }
    const ctx = globalAudioContext;

    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    if (!globalSourceNode || globalAudioElementRef !== audioElement) {
      if (globalSourceNode) {
        try {
          globalSourceNode.disconnect();
        } catch {
          // ignore
        }
      }
      globalSourceNode = ctx.createMediaElementSource(audioElement);
      globalAudioElementRef = audioElement;
    }

    const analyserNode = ctx.createAnalyser();
    analyserNode.fftSize = 256;
    analyserNode.smoothingTimeConstant = 0.8;

    globalSourceNode.connect(analyserNode);
    analyserNode.connect(ctx.destination);

    analyserRef.current = analyserNode;
    setAnalyser(analyserNode);

    return () => {
      try {
        analyserNode.disconnect();
        if (globalSourceNode) {
          globalSourceNode.disconnect(analyserNode);
          globalSourceNode.connect(ctx.destination);
        }
      } catch {
        // ignore cleanup errors
      }
    };
  }, [audioElement]);

  return analyser;
}
