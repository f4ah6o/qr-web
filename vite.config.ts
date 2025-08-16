import { defineConfig } from 'vite'

export default defineConfig({
  base: '/qr-web/',
  server: {
    https: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})