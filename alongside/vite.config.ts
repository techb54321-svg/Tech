import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// VITE_STATIC_DEMO=1 builds the browser-only preview (no server; see
// scripts/build-static-demo.mjs), with everything inlined into one bundle.
const staticDemo = process.env.VITE_STATIC_DEMO === '1'

export default defineConfig({
  plugins: [react()],
  base: staticDemo ? './' : '/',
  build: staticDemo
    ? {
        outDir: 'dist-static',
        assetsInlineLimit: 1_000_000,
        cssCodeSplit: false,
        rollupOptions: { output: { inlineDynamicImports: true, entryFileNames: 'app.js', assetFileNames: '[name][extname]' } },
      }
    : {},
  server: {
    host: process.env.HOST || '127.0.0.1',
    port: 5173,
    proxy: { '/api': 'http://127.0.0.1:8787' },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
})
