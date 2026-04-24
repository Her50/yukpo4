import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

const GCP_BACKEND = 'https://yukpo-backend-376093909298.europe-west1.run.app';

const copyIndexPlugin = () => ({
  name: 'copy-index-lite',
  closeBundle() {
    const src = path.resolve(__dirname, 'dist-lite/index-lite.html');
    const dest = path.resolve(__dirname, 'dist-lite/index.html');
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      console.log('[lite] index-lite.html → index.html');
    }

    // Netlify proxy redirects — proxies /api/* etc. to GCP backend
    const redirects = [
      `/api/*  ${GCP_BACKEND}/api/:splat  200`,
      `/auth/*  ${GCP_BACKEND}/api/auth/:splat  200`,
      `/ai/*  ${GCP_BACKEND}/ai/:splat  200`,
      `/ws/*  ${GCP_BACKEND}/ws/:splat  200`,
      `/healthz  ${GCP_BACKEND}/healthz  200`,
      `/*  /index.html  200`,
    ].join('\n');
    fs.writeFileSync(path.resolve(__dirname, 'dist-lite/_redirects'), redirects);
    console.log('[lite] _redirects créé');
  },
});

export default defineConfig({
  plugins: [react(), copyIndexPlugin()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  build: {
    outDir: 'dist-lite',
    sourcemap: false,
    minify: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'index-lite.html'),
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['lucide-react'],
        },
      },
    },
  },
  base: '/',
  server: {
    port: 3001,
    host: true,
  },
});
