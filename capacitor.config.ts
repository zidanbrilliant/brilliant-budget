import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lucyta.brilliantbudget',
  appName: 'Brilliant Budget',
  webDir: 'dist',
  server: {
    iosScheme: 'capacitor',
  },
};

export default config;
