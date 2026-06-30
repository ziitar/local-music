/**
 * Media Session API integration for lock screen / notification controls.
 *
 * Works on web browsers that support the Media Session API
 * (Chrome, Edge, Firefox — system notification shade + lock screen controls).
 */

import { API_BASE } from '../config';
import type { Song } from '../types';

function isMediaSessionSupported(): boolean {
  return 'mediaSession' in navigator;
}

/** Update the media session metadata (title, artist, album, artwork). */
export function updateMediaSessionMetadata(song: Song): void {
  if (!isMediaSessionSupported()) return;

  const artwork: MediaImage[] = [];
  if (song.cover_image) {
    artwork.push({
      src: `${API_BASE}${song.cover_image}`,
      sizes: '512x512',
      type: 'image/jpeg',
    });
  }

  navigator.mediaSession.metadata = new MediaMetadata({
    title: song.title || 'Unknown Title',
    artist: song.artist || 'Unknown Artist',
    album: song.album || 'Unknown Album',
    artwork,
  });
}

/** Register media session action handlers (play, pause, next, previous, seek). */
export function setupMediaSessionHandlers(handlers: {
  onPlay: () => void;
  onPause: () => void;
  onPreviousTrack: () => void;
  onNextTrack: () => void;
  onSeekTo?: (time: number) => void;
}): void {
  if (!isMediaSessionSupported()) return;

  try {
    navigator.mediaSession.setActionHandler('play', handlers.onPlay);
    navigator.mediaSession.setActionHandler('pause', handlers.onPause);
    navigator.mediaSession.setActionHandler('previoustrack', handlers.onPreviousTrack);
    navigator.mediaSession.setActionHandler('nexttrack', handlers.onNextTrack);

    if (handlers.onSeekTo) {
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined) {
          handlers.onSeekTo!(details.seekTime);
        }
      });
    }

    // Seek backward/forward by 10 seconds
    navigator.mediaSession.setActionHandler('seekbackward', (details) => {
      const audio = document.querySelector('audio');
      if (audio) {
        audio.currentTime = Math.max(0, audio.currentTime - (details.seekOffset || 10));
      }
    });
    navigator.mediaSession.setActionHandler('seekforward', (details) => {
      const audio = document.querySelector('audio');
      if (audio) {
        audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + (details.seekOffset || 10));
      }
    });
  } catch {
    // Some action handlers may not be supported on all platforms
  }
}

/** Update the media session playback state and position. */
export function updateMediaSessionPlaybackState(state: {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
}): void {
  if (!isMediaSessionSupported()) return;

  navigator.mediaSession.playbackState = state.isPlaying ? 'playing' : 'paused';

  try {
    const duration = Math.max(0, state.duration);
    const position = Math.max(0, Math.min(state.currentTime, duration));
    if (duration > 0 && isFinite(duration)) {
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate: 1,
        position,
      });
    }
  } catch {
    // setPositionState can throw if duration is 0 or invalid
  }
}
