/**
 * Background audio service for Capacitor native platforms.
 *
 * On Android, starts a Foreground Service with a persistent notification
 * to prevent the system from killing the app during background audio playback.
 */

import { registerPlugin } from '@capacitor/core';

interface AudioBackgroundPlugin {
  start(): Promise<void>;
  stop(): Promise<void>;
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
