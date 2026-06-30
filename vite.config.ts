/// <reference types="vitest" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  server: {
    port: 5173,
    open: true,
    proxy: {
      // Forward View-mode API calls to the local Fastify server (npm run server).
      // In production, both SPA and API are served from the same Node process,
      // so this proxy only applies during `npm run dev` / `dev:all`.
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: false
      }
    }
  },
  test: {
    environment: 'jsdom',
    globals: true
  },
  esbuild: {
    drop: ['console', 'debugger']
  },
  build: {
    sourcemap: 'hidden',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/vue') || id.includes('node_modules/@vue')) {
            return 'vendor'
          }
          if (id.includes('node_modules/katex')) {
            return 'katex'
          }
          if (id.includes('node_modules/echarts') || id.includes('node_modules/zrender')) {
            return 'echarts'  // View-mode only — kept out of the main bundle
          }
          if (id.includes('/src/config/')) {
            return 'config'  // fallback defaults only — runtime data loaded from /config/*.json
          }
        }
      }
    }
  }
})
