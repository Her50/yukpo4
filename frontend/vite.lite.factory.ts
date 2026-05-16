import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

// Backend cible pour les rewrites Netlify (_redirects).
// ✅ ACTIF — Fly.io (yukpo-fly-backend.fly.dev) — temporaire 2026-05-16
// 💤 PRINCIPAL — GCP Cloud Run. Pour rebasculer sans redéployer le code :
//   YUKPO_BACKEND_URL=https://yukpo-backend-376093909298.europe-west1.run.app npm run build:bourse
const BACKEND_URL = process.env.YUKPO_BACKEND_URL || 'https://yukpo-fly-backend.fly.dev';

interface LiteAppConfig {
  app: 'bourse' | 'pharmacie' | 'restaurant';
  outDir: string;
  entryHtml: string;
  manifestSrc: string;
  port: number;
}

export const makeLiteConfig = (cfg: LiteAppConfig) => {
  const buildPlugin = () => ({
    name: `copy-assets-${cfg.app}`,
    closeBundle() {
      const distDir = path.resolve(__dirname, cfg.outDir);

      // index-{app}.html → index.html
      const srcHtml = path.resolve(distDir, cfg.entryHtml);
      const dstHtml = path.resolve(distDir, 'index.html');
      if (fs.existsSync(srcHtml)) {
        fs.copyFileSync(srcHtml, dstHtml);
        fs.unlinkSync(srcHtml);
        console.log(`[${cfg.app}] ${cfg.entryHtml} → index.html`);
      }

      // Manifest PWA (public/manifests/{app}.json → dist/manifest.json)
      const srcManifest = path.resolve(__dirname, 'public/manifests', `${cfg.app}.json`);
      const dstManifest = path.resolve(distDir, 'manifest.json');
      if (fs.existsSync(srcManifest)) {
        fs.copyFileSync(srcManifest, dstManifest);
        console.log(`[${cfg.app}] manifest.json OK`);
      }

      // Netlify _redirects
      const redirects = [
        `/api/*  ${BACKEND_URL}/api/:splat  200`,
        `/auth/*  ${BACKEND_URL}/api/auth/:splat  200`,
        `/ai/*  ${BACKEND_URL}/ai/:splat  200`,
        `/ws/*  ${BACKEND_URL}/ws/:splat  200`,
        `/healthz  ${BACKEND_URL}/healthz  200`,
        `/*  /index.html  200`,
      ].join('\n');
      fs.writeFileSync(path.resolve(distDir, '_redirects'), redirects);
      console.log(`[${cfg.app}] _redirects OK`);
    },
  });

  return defineConfig({
    plugins: [react(), buildPlugin()],
    resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
    build: {
      outDir: cfg.outDir,
      sourcemap: false,
      minify: true,
      // Seuil légèrement élevé : 524 KB raw ≈ 165 KB gzip, ce qui reste sain
      // pour une PWA. On split agressivement les libs partagées pour bénéficier
      // du cache HTTP entre les apps (bourse / pharmacie / restaurant).
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        input: path.resolve(__dirname, cfg.entryHtml),
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'ui-vendor': ['lucide-react', 'react-hot-toast', 'sonner'],
            'i18n-vendor': ['i18next', 'react-i18next', 'i18next-browser-languagedetector'],
            'http-vendor': ['axios'],
            // date-fns retiré : utilisé seulement par composants delivery non
            // inclus dans pharmacie → chunk vide. Laissé au bundle qui l'importe.
          },
        },
      },
    },
    base: '/',
    server: { port: cfg.port, host: true },
  });
};
