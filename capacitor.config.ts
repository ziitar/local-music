import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.localmusic.app',
  appName: 'Local Music',
  webDir: 'dist',
  server: {
    // Use https scheme for compatibility with APIs that require secure origins
    androidScheme: 'https',
  },
  android: {
    // Allow mixed content (HTTP backend URLs on LAN)
    allowMixedContent: true,
  },
};

export default config;
