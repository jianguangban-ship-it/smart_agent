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
    open: true
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
          if (id.includes('/src/config/')) {
            return 'config'  // fallback defaults only — runtime data loaded from /config/*.json
          }
        }
      }
    }
  }
})
