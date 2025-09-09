// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  appType: 'spa',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  optimizeDeps: {
    include: ['leaflet', 'react-leaflet'],
  },
  server: {
    port: 5173,
    host: true,
    fs: {
      strict: false
    },
    proxy: {
      '/auth': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        timeout: 30000,
      },
      '/api/ia': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        timeout: 60000,
      },
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        timeout: 30000,
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Sending Request to the Target:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
          });
          proxy.on('error', (err, _req, _res) => {
            console.log('proxy error', err);
          });
        },
      },
    },
  },
});
