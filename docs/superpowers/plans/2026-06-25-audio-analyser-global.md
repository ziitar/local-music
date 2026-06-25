# Audio Analyser Global Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix audio stopping when leaving SongDetailPage by moving the Web Audio API pipeline to a global singleton service.

**Architecture:** Replace the component-scoped `useAudioAnalyser` hook with a module-level singleton `audioAnalyserService`. PlayerBar initializes it once; `sourceNode → destination` is never disconnected. SongDetailPage only reads the analyser for visualization.

**Tech Stack:** TypeScript, Web Audio API, React 19, Zustand

## Global Constraints

- 2-space indentation, single quotes, trailing commas, semicolons
- Imports: external libs → internal modules → CSS/assets; relative imports (no path aliases)
- Naming: camelCase functions/variables, PascalCase components/types
- Follow existing patterns in `src/services/` directory

---

### Task 1: Create `audioAnalyserService`

**Files:**
- Create: `src/services/audioAnalyser.ts`

**Interfaces:**
- Produces:
  - `audioAnalyserService.init(audioElement: HTMLAudioElement): void`
  - `audioAnalyserService.getAnalyser(): AnalyserNode | null`
  - `audioAnalyserService.isReady(): boolean`

- [ ] **Step 1: Create the service file**

Create `src/services/audioAnalyser.ts`:

```typescript
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
```

- [ ] **Step 2: Verify the file compiles**

Run: `npx tsc --noEmit src/services/audioAnalyser.ts`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/services/audioAnalyser.ts
git commit -m "feat: add global audioAnalyserService singleton"
```

---

### Task 2: Integrate service into PlayerBar

**Files:**
- Modify: `src/components/Player/PlayerBar.tsx`

**Interfaces:**
- Consumes: `audioAnalyserService.init(audioElement)` from Task 1

- [ ] **Step 1: Add import**

Add to the imports in `src/components/Player/PlayerBar.tsx`:

```typescript
import { audioAnalyserService } from "../../services/audioAnalyser.ts";
```

- [ ] **Step 2: Add useEffect to initialize the service**

Add this effect inside the `PlayerBar` component, after the existing `useEffect` blocks (after line 105):

```typescript
// Initialize global audio analyser pipeline
useEffect(() => {
  if (audioRef.current) {
    audioAnalyserService.init(audioRef.current);
  }
}, []);
```

- [ ] **Step 3: Verify the file compiles**

Run: `npx tsc --noEmit src/components/Player/PlayerBar.tsx`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/components/Player/PlayerBar.tsx
git commit -m "feat: initialize audioAnalyserService in PlayerBar"
```

---

### Task 3: Migrate SongDetailPage to use the service

**Files:**
- Modify: `src/pages/SongDetail.tsx`

**Interfaces:**
- Consumes: `audioAnalyserService.getAnalyser()` from Task 1

- [ ] **Step 1: Update imports**

In `src/pages/SongDetail.tsx`, replace:

```typescript
import { useAudioAnalyser } from "../lib/useAudioAnalyser.ts";
```

With:

```typescript
import { audioAnalyserService } from "../services/audioAnalyser.ts";
```

- [ ] **Step 2: Replace analyser hook usage**

Replace:

```typescript
const analyser = useAudioAnalyser(audioElement);
```

With:

```typescript
const [analyser, setAnalyser] = useState<AnalyserNode | null>(
  audioAnalyserService.getAnalyser(),
);
```

- [ ] **Step 3: Add useEffect to wait for analyser**

Add this effect after the `useState` declaration:

```typescript
// Wait for PlayerBar to initialize the analyser
useEffect(() => {
  if (!analyser) {
    const id = setInterval(() => {
      const a = audioAnalyserService.getAnalyser();
      if (a) {
        setAnalyser(a);
        clearInterval(id);
      }
    }, 100);
    return () => clearInterval(id);
  }
}, [analyser]);
```

- [ ] **Step 4: Verify the file compiles**

Run: `npx tsc --noEmit src/pages/SongDetail.tsx`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/pages/SongDetail.tsx
git commit -m "feat: migrate SongDetailPage to audioAnalyserService"
```

---

### Task 4: Delete old `useAudioAnalyser` hook

**Files:**
- Delete: `src/lib/useAudioAnalyser.ts`

**Interfaces:**
- None (no consumers remain after Task 3)

- [ ] **Step 1: Verify no remaining references**

Run: `grep -r "useAudioAnalyser" src/`
Expected: No results (Task 3 removed the only import)

- [ ] **Step 2: Delete the file**

Run: `rm src/lib/useAudioAnalyser.ts`

- [ ] **Step 3: Verify the project builds**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add -u src/lib/useAudioAnalyser.ts
git commit -m "chore: remove unused useAudioAnalyser hook"
```

---

### Task 5: Manual verification

- [ ] **Step 1: Start dev server**

Run: `npm run dev`

- [ ] **Step 2: Test the fix**

1. Play a song from any page
2. Click the song title in PlayerBar to navigate to SongDetailPage
3. Switch to the "可视化" (visualizer) tab — visualization should render
4. Click back to leave SongDetailPage — audio should **continue playing**
5. Navigate back to SongDetailPage — visualization should resume
6. Rapidly navigate in/out of SongDetailPage — no audio glitches or duplication

- [ ] **Step 3: Verify no regressions**

1. Play/pause controls work correctly
2. Next/previous track works
3. Volume control works
4. Lyrics display and scrolling works on SongDetailPage
