import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

// Backend cible pour les rewrites Netlify (_redirects).
// ✅ ACTIF — Cloudflare → Fly (api.yukpomnang.com) — temporaire 2026-05-16
// 💤 Fly direct — fallback (yukpo-fly-backend.fly.dev)
// 💤 PRINCIPAL — GCP Cloud Run. Override sans redéployer le code :
//   YUKPO_BACKEND_URL=https://yukpo-backend-376093909298.europe-west1.run.app npm run build:bourse
const BACKEND_URL = process.env.YUKPO_BACKEND_URL || 'https://api.yukpomnang.com';

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
    resolve: {
      alias: { '@': path.resolve(__dirname, 'src') },
      // ✅ 2026-05-16 — dedupe React/react-dom : empêche que des dépendances
      // transitives (lucide-react, sonner, etc.) bundlent leur propre copie.
      // Sans cela, le manualChunks remontait React dans ui-vendor ET dans
      // react-vendor → crash "Cannot set properties of undefined (Children)"
      // quand ui-vendor s'exécutait avant que sa copie React soit initialisée.
      dedupe: ['react', 'react-dom'],
    },
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
          // ✅ Mode fonction : on garantit que react/react-dom/scheduler sont
          // TOUJOURS dans react-vendor, peu importe qui les importe. La forme
          // objet `{'react-vendor': ['react']}` ne suit pas les imports
          // transitifs, donc Vite duplique React dans les chunks qui en ont
          // besoin (lucide-react notamment). Forme fonction = pas de doublon.
          manualChunks(id) {
            if (!id.includes('node_modules')) return;
            if (
              /[\\/]node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom)[\\/]/.test(id)
            ) {
              return 'react-vendor';
            }
            if (
              /[\\/]node_modules[\\/](lucide-react|react-hot-toast|sonner)[\\/]/.test(id)
            ) {
              return 'ui-vendor';
            }
            if (
              /[\\/]node_modules[\\/](i18next|react-i18next|i18next-browser-languagedetector|i18next-http-backend)[\\/]/.test(id)
            ) {
              return 'i18n-vendor';
            }
            if (/[\\/]node_modules[\\/]axios[\\/]/.test(id)) {
              return 'http-vendor';
            }
          },
        },
      },
    },
    base: '/',
    server: { port: cfg.port, host: true },
  });
};
