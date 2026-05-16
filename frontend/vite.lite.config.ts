import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

// Backend cible pour les rewrites Netlify (_redirects).
// ✅ ACTIF — Cloudflare → Fly (api.yukpomnang.com) — temporaire 2026-05-16
// 💤 Fly direct — fallback (yukpo-fly-backend.fly.dev)
// 💤 PRINCIPAL — GCP Cloud Run. Override sans redéployer le code :
//   YUKPO_BACKEND_URL=https://yukpo-backend-376093909298.europe-west1.run.app npm run build:lite
const BACKEND_URL = process.env.YUKPO_BACKEND_URL || 'https://api.yukpomnang.com';

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
      `/api/*  ${BACKEND_URL}/api/:splat  200`,
      `/auth/*  ${BACKEND_URL}/api/auth/:splat  200`,
      `/ai/*  ${BACKEND_URL}/ai/:splat  200`,
      `/ws/*  ${BACKEND_URL}/ws/:splat  200`,
      `/healthz  ${BACKEND_URL}/healthz  200`,
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
