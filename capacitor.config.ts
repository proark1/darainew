import type { CapacitorConfig } from '@capacitor/cli';

// IMPORTANT:
// - For TestFlight / production builds, do NOT set `server.url`.
//   Otherwise the app loads a remote website inside the native WebView, which can cause
//   auth popups and (if cached/stale) a white screen.
// - For local development hot-reload, set env var CAPACITOR_SERVER_URL.
const devServerUrl = process.env.CAPACITOR_SERVER_URL;

const config: CapacitorConfig = {
  appId: 'com.darai.app',
  appName: 'DarAI',
  webDir: 'dist',
  ios: {
    contentInset: 'automatic',
    allowsLinkPreview: true,
    preferredContentMode: 'mobile',
  },
  plugins: {
    Microphone: {
      NSMicrophoneUsageDescription: 'DarAI needs microphone access for voice commands and voice mode.',
    },
    Geolocation: {
      NSLocationWhenInUseUsageDescription: 'DarAI uses your location for local news and weather.',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#6366f1',
      sound: 'default',
    },
  },
  ...(devServerUrl
    ? {
        server: {
          url: devServerUrl,
          cleartext: true,
        },
      }
    : {}),
};

export default config;
