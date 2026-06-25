# Audio Analyser Global Refactor Design

## Problem

When navigating to `SongDetailPage` (`/song/:id`), the `useAudioAnalyser` hook calls `audioCtx.createMediaElementSource(audioElement)` to connect the `<audio>` element to the Web Audio API for visualization. This **permanently** redirects the audio output from the browser's default pipeline to the Web Audio API node graph.

When the user leaves `SongDetailPage`, the component unmounts and the cleanup function disconnects `sourceNode` from all downstream nodes (`gainNode`, `analyserNode`). Since `sourceNode` is now disconnected from `destination`, **no sound comes out** even though the `<audio>` element is still playing (currentTime advances, `isPlaying` is true).

Re-entering `SongDetailPage` reconnects the nodes, restoring audio.

## Solution

Move the Web Audio API pipeline from `useAudioAnalyser` (a component-scoped hook) to a **global singleton service** (`audioAnalyserService`). PlayerBar initializes it once; the `sourceNode → destination` connection is never disconnected.

## Architecture

```
PlayerBar (always mounted)
  └─ useEffect: audioAnalyserService.init(audioElement)
       └─ AudioContext → sourceNode → gainNode → analyserNode → destination
       └─ sourceNode is NEVER disconnected; audio pipeline persists for app lifetime

SongDetailPage (mounted on demand)
  └─ audioAnalyserService.getAnalyser()
       └─ Receives the existing analyser for canvas visualization
       └─ Never touches the audio pipeline
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/services/audioAnalyser.ts` | **Create** | Global singleton service managing AudioContext and analyser |
| `src/components/Player/PlayerBar.tsx` | **Modify** | Call `audioAnalyserService.init(audioElement)` on mount |
| `src/lib/useAudioAnalyser.ts` | **Delete** | Replaced by the new service |
| `src/pages/SongDetail.tsx` | **Modify** | Use `audioAnalyserService.getAnalyser()` instead of the old hook |

## Detailed Design

### 1. `src/services/audioAnalyser.ts` (New)

Global singleton service. Module-level state:

- `audioCtx: AudioContext | null`
- `sourceNode: MediaElementAudioSourceNode | null`
- `connectedElement: HTMLAudioElement | null` (prevents duplicate `createMediaElementSource` calls)
- `analyserNode: AnalyserNode | null`

API:

| Method | Description |
|--------|-------------|
| `init(audioElement: HTMLAudioElement): void` | Called by PlayerBar. Creates AudioContext, sourceNode, gainNode, analyserNode, connects to destination. Skips if already initialized with the same element. Resumes suspended AudioContext. |
| `getAnalyser(): AnalyserNode \| null` | Returns the analyser node (null if init hasn't been called yet). |
| `isReady(): boolean` | Returns `analyserNode !== null`. |

Key design points:

- **sourceNode never disconnected** — This is the core fix. Once connected, the audio pipeline persists for the app's lifetime.
- **AudioContext suspended handling** — Browser policy requires user interaction before audio can play. `init()` checks for `suspended` state and calls `resume()`.
- **Idempotent** — Same `audioElement` only triggers `createMediaElementSource` once. Subsequent calls are no-ops.
- **No cleanup needed** — Service lifetime = app lifetime.

### 2. `src/components/Player/PlayerBar.tsx` (Modify)

Add one `useEffect` to initialize the analyser service:

```typescript
import { audioAnalyserService } from "../../services/audioAnalyser.ts";

// Inside PlayerBar component, after existing effects:
useEffect(() => {
  if (audioRef.current) {
    audioAnalyserService.init(audioRef.current);
  }
}, []);
```

PlayerBar doesn't need to know about the analyser's consumers. It just ensures the pipeline exists.

### 3. `src/lib/useAudioAnalyser.ts` (Delete)

Fully replaced by `audioAnalyserService`. No longer needed.

### 4. `src/pages/SongDetail.tsx` (Modify)

Replace the old hook usage:

```typescript
// Before:
import { useAudioAnalyser } from "../lib/useAudioAnalyser.ts";
const analyser = useAudioAnalyser(audioElement);

// After:
import { audioAnalyserService } from "../services/audioAnalyser.ts";

const [analyser, setAnalyser] = useState<AnalyserNode | null>(
  audioAnalyserService.getAnalyser()
);

useEffect(() => {
  if (!analyser) {
    const id = setInterval(() => {
      const a = audioAnalyserService.getAnalyser();
      if (a) { setAnalyser(a); clearInterval(id); }
    }, 100);
    return () => clearInterval(id);
  }
}, [analyser]);
```

The canvas drawing loop, lyrics scrolling, and all other code remains unchanged.

## Why This Fixes the Bug

1. `sourceNode → destination` connection is **never broken** — audio always has a path to the speakers
2. `SongDetailPage` only reads the analyser for visualization; it doesn't own the audio pipeline
3. Navigating away from `SongDetailPage` only affects the canvas animation loop, not the audio output
4. The `analyserNode` stays connected in the node graph even when no component is reading from it (zero overhead)

## Testing

- Play a song, navigate to SongDetailPage → visualization should work
- Navigate away from SongDetailPage → audio continues playing
- Navigate back to SongDetailPage → visualization resumes
- Verify no audio glitches or duplication during rapid page navigation
