# TDD Evidence Report: Audio Analyser Global Refactor

## Source Plan

`docs/superpowers/plans/2026-06-25-audio-analyser-global.md`

## User Journeys

1. **As a user**, I want audio to continue playing when I navigate away from the song detail page, so that I can browse other pages while listening to music.
2. **As a user**, I want the audio visualizer to work on the song detail page, so that I can see visual representations of the music.
3. **As a user**, I want the audio visualizer to resume when I return to the song detail page, so that I don't lose the visualization experience.

## Task Report

### Task 1: Create `audioAnalyserService`

**Summary**: Created global singleton service for Web Audio API analyser with `init()`, `getAnalyser()`, and `isReady()` methods.

**Validation**: `npx vitest run src/services/audioAnalyser.test.ts`

**Result**: All 11 tests pass (GREEN)

**Guarantees**:
- Service creates AudioContext on first initialization
- Source node is created from audio element and connected to analyser
- Analyser node has correct FFT size (512) and smoothing (0.8)
- Connection chain: source → analyser → destination
- Suspended AudioContext is resumed
- Re-initialization with same element is skipped (idempotent)
- Old source is disconnected when element changes

### Task 2: Integrate service into PlayerBar

**Summary**: Added import and useEffect to initialize `audioAnalyserService` in PlayerBar on mount.

**Validation**: `npx tsc -b` (build passes)

**Result**: Build successful

**Guarantees**:
- PlayerBar initializes the analyser service once on mount
- Audio element ref is passed to service init

### Task 3: Migrate SongDetailPage to use the service

**Summary**: Replaced `useAudioAnalyser` hook with `audioAnalyserService` in SongDetailPage.

**Validation**: `npx tsc -b` (build passes)

**Result**: Build successful

**Guarantees**:
- SongDetailPage reads analyser from global service
- Polling mechanism waits for PlayerBar to initialize analyser
- No component-level AudioContext creation

### Task 4: Delete old `useAudioAnalyser` hook

**Summary**: Removed unused `src/lib/useAudioAnalyser.ts` file.

**Validation**: `grep -r "useAudioAnalyser" src/` returns no results, `npx tsc -b` passes

**Result**: Build successful, no remaining references

**Guarantees**:
- No dead code remains in codebase
- All imports migrated to service-based approach

## Test Specification

| # | What is guaranteed | Test file | Test type | Result | Evidence |
|---|--------------------|-----------|-----------|--------|----------|
| 1 | Service creates AudioContext on first call | `audioAnalyser.test.ts:init creates AudioContext on first call` | unit | PASS | `npx vitest run src/services/audioAnalyser.test.ts` |
| 2 | Service creates source node from audio element | `audioAnalyser.test.ts:init creates source node from audio element` | unit | PASS | `npx vitest run src/services/audioAnalyser.test.ts` |
| 3 | Service creates analyser with correct settings | `audioAnalyser.test.ts:init creates analyser node with correct settings` | unit | PASS | `npx vitest run src/services/audioAnalyser.test.ts` |
| 4 | Service connects source → analyser → destination | `audioAnalyser.test.ts:init connects source → analyser → destination` | unit | PASS | `npx vitest run src/services/audioAnalyser.test.ts` |
| 5 | Service resumes suspended AudioContext | `audioAnalyser.test.ts:init resumes AudioContext if suspended` | unit | PASS | `npx vitest run src/services/audioAnalyser.test.ts` |
| 6 | Service skips re-init with same element | `audioAnalyser.test.ts:init skips re-initialization with same element` | unit | PASS | `npx vitest run src/services/audioAnalyser.test.ts` |
| 7 | Service disconnects old source on element change | `audioAnalyser.test.ts:init disconnects old source when element changes` | unit | PASS | `npx vitest run src/services/audioAnalyser.test.ts` |
| 8 | getAnalyser returns null before init | `audioAnalyser.test.ts:getAnalyser returns null before init` | unit | PASS | `npx vitest run src/services/audioAnalyser.test.ts` |
| 9 | getAnalyser returns analyser after init | `audioAnalyser.test.ts:getAnalyser returns analyser node after init` | unit | PASS | `npx vitest run src/services/audioAnalyser.test.ts` |
| 10 | isReady returns false before init | `audioAnalyser.test.ts:isReady returns false before init` | unit | PASS | `npx vitest run src/services/audioAnalyser.test.ts` |
| 11 | isReady returns true after init | `audioAnalyser.test.ts:isReady returns true after init` | unit | PASS | `npx vitest run src/services/audioAnalyser.test.ts` |

## Coverage and Known Gaps

**Coverage**: 11/11 unit tests passing for `audioAnalyserService`

**Known Gaps**:
- Integration tests for PlayerBar → SongDetailPage flow not implemented (requires browser environment)
- E2E tests for manual verification scenarios not automated
- Manual verification required for Task 5 (audio continues playing when navigating away)

## Checkpoint Commits

| Commit | Stage | Message |
|--------|-------|---------|
| `0c3bcc6` | RED | `test: add failing tests for audioAnalyserService (RED)` |
| `a909945` | GREEN | `feat: implement audioAnalyserService singleton (GREEN)` |
| `da7ae84` | GREEN | `feat: initialize audioAnalyserService in PlayerBar` |
| `1492c33` | GREEN | `feat: migrate SongDetailPage to audioAnalyserService` |
| `d87b2d8` | REFACTOR | `chore: remove unused useAudioAnalyser hook`
