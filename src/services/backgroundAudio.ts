/**
 * Background audio service for Capacitor native platforms.
 *
 * On Android, starts a Foreground Service with a persistent notification
 * to prevent the system from killing the app during background audio playback.
 *
 * Also manages the native media notification (song info, album art, controls).
 */

import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { API_BASE } from '../config';
import type { Song } from '../types';

interface AudioBackgroundPlugin {
  start(): Promise<void>;
  stop(): Promise<void>;
  updateMetadata(options: {
    title: string;
    artist: string;
    album: string;
    artworkUrl?: string;
  }): Promise<void>;
  updatePlaybackState(options: {
    isPlaying: boolean;
    position: number;
    duration: number;
  }): Promise<void>;
  addListener(
    eventName: 'mediaAction',
    listener: (data: { action: string }) => void,
  ): Promise<PluginListenerHandle>;
}

const AudioBackground = registerPlugin<AudioBackgroundPlugin>('AudioBackground');

/** Start the background audio foreground service (Android only). */
export async function startBackgroundAudio(): Promise<void> {
  try {
    await AudioBackground.start();
  } catch {
    // Plugin not available on web or other platforms
  }
}

/** Stop the background audio foreground service (Android only). */
export async function stopBackgroundAudio(): Promise<void> {
  try {
    await AudioBackground.stop();
  } catch {
    // Plugin not available on web or other platforms
  }
}

/**
 * Update the native media notification with song metadata.
 * Passes title, artist, album, and artwork URL to the Android service.
 */
export async function updateNativeMediaMetadata(song: Song): Promise<void> {
  try {
    const artworkUrl = song.cover_image
      ? `${API_BASE}${song.cover_image}`
      : undefined;

    await AudioBackground.updateMetadata({
      title: song.title || 'Unknown Title',
      artist: song.artist || 'Unknown Artist',
      album: song.album || '',
      artworkUrl,
    });
  } catch {
    // Plugin not available on web
  }
}

/**
 * Update the native media session playback state.
 * Used for notification controls and lock screen display.
 */
export async function updateNativePlaybackState(options: {
  isPlaying: boolean;
  position: number;
  duration: number;
}): Promise<void> {
  try {
    await AudioBackground.updatePlaybackState({
      isPlaying: options.isPlaying,
      position: Math.floor(options.position * 1000), // Convert seconds to ms
      duration: Math.floor(options.duration * 1000),
    });
  } catch {
    // Plugin not available on web
  }
}

/**
 * Listen for media action events from the native notification controls.
 * Returns a handle to remove the listener.
 */
export async function onNativeMediaAction(
  callback: (action: string) => void,
): Promise<PluginListenerHandle | null> {
  try {
    return await AudioBackground.addListener('mediaAction', (data) => {
      callback(data.action);
    });
  } catch {
    // Plugin not available on web
    return null;
  }
}
