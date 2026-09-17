import path from 'node:path';
import { fileURLToPath } from 'node:url';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    basicSsl(),
    VitePWA({
      registerType: 'autoUpdate',
      // Cap ships APK assets; auto-injected SW re-caches the previous UI after installDebug.
      injectRegister: false,
      includeAssets: [
        'icons/icon-192.png',
        'icons/icon-512.png',
        'models/ATTRIBUTION.md',
        'manifest.webmanifest',
      ],
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,glb,webmanifest}'],
        navigateFallback: 'index.html',
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      'native-ar': path.resolve(rootDir, '../plugins/native-ar/dist/esm/index.js'),
    },
  },
  server: {
    port: 5187,
    strictPort: true,
    host: true,
  },
  preview: {
    port: 5187,
    strictPort: true,
    host: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  optimizeDeps: {
    exclude: ['native-ar'],
  },
});
