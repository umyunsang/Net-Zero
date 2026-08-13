import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // The public presentation must always load the current lazy 3D chunk.
      // Replace any older offline worker with the plugin's self-removing worker.
      selfDestroying: mode === 'presentation',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Net Zero',
        short_name: 'Net Zero',
        description: 'บันทึกกิจกรรมสีเขียวและดูค่าประมาณผลกระทบอย่างโปร่งใส',
        lang: 'th',
        start_url: '/',
        display: 'standalone',
        theme_color: '#146447',
        background_color: '#ffffff',
        icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
      workbox: {
        navigateFallback: '/index.html',
        runtimeCaching: [],
      },
    }),
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
}));
