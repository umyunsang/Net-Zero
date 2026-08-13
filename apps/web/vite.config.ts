import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'ก้าวลดคาร์บอน',
        short_name: 'ก้าวลด',
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
});
