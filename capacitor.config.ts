import type { CapacitorConfig } from '@capacitor/cli';

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
  server: {
    // Enable hot-reload for development
    url: 'https://d44ace30-8829-4d84-9769-44f09f4b4e36.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
};

export default config;
