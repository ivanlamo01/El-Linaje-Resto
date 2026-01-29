import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.almacenmgd.app',
  appName: 'Almacen MGD',
  webDir: 'out',
  server: {
    url: 'https://lodemarta--almacen-mgd.us-central1.hosted.app',
    cleartext: true
  },
  plugins: {
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: '89554017780-dsejb9g4uc2bbot1advdbq52cht6eu70.apps.googleusercontent.com', // ⚠️ REEMPLAZAR CON CLIENT ID DE FIREBASE
      forceCodeForRefreshToken: true,
    },
  },
};

export default config;
