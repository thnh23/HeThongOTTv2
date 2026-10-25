import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://127.0.0.1:8000',
        ws: true,
        changeOrigin: true,
        rewriteWsOrigin: true,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            if (['ECONNABORTED', 'ECONNRESET', 'EPIPE'].includes(err.code)) {
              return;
            }
            console.error('[vite ws proxy error]', err);
          });
          proxy.on('proxyReqWs', (_proxyReq, _req, socket, _options) => {
            socket.on('error', (err) => {
              if (['ECONNABORTED', 'ECONNRESET', 'EPIPE'].includes(err.code)) {
                return;
              }
              console.warn('[vite ws socket error]', err.message);
            });
          });
        },
      },
      '/health': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
