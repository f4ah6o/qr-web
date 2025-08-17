import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/qr-web/',
  server: {
    host: 'localhost',
    port: 5176,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['qr-icon.svg', 'vite.svg'],
      manifest: {
        name: 'QRコードスキャナー',
        short_name: 'QRスキャナー',
        description: 'カメラでQRコードを読み取るWebアプリケーション',
        theme_color: '#3b82f6',
        background_color: '#f3f4f6',
        display: 'standalone',
        orientation: 'any',
        scope: '/qr-web/',
        start_url: '/qr-web/',
        icons: [
          {
            src: 'qr-icon.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          },
          {
            src: 'qr-icon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ],
        categories: ['utilities', 'productivity'],
        lang: 'ja'
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/cdn\.tailwindcss\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'tailwind-css-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              }
            }
          }
        ]
      },
      devOptions: {
        enabled: true
      }
    })
  ]
})
