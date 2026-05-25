import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

// ✅ 2026-05-25 — Backend actif : Cloudflare proxy → Fly
// (cf. project_cloudflare_setup + project_backend_fly_vs_gcp).
// GCP Cloud Run renvoie 503 depuis hier — instance arrêtée. Fly est seule
// cible utilisable. Convention swap-commentaires conservée pour permettre
// un retour rapide à GCP sans modifier le code, juste décommenter.
const BACKEND = 'https://api.yukpomnang.com';
// const BACKEND = 'https://yukpo-fly-backend.fly.dev';  // 💤 Fly direct (sans CF)
// const BACKEND = 'https://yukpo-backend-376093909298.europe-west1.run.app';  // 💤 GCP (503 actuellement)

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
        `/api/*  ${BACKEND}/api/:splat  200`,
        `/auth/*  ${BACKEND}/api/auth/:splat  200`,
        `/ai/*  ${BACKEND}/ai/:splat  200`,
        `/ws/*  ${BACKEND}/ws/:splat  200`,
        `/healthz  ${BACKEND}/healthz  200`,
        `/*  /index.html  200`,
      ].join('\n');
      fs.writeFileSync(path.resolve(distDir, '_redirects'), redirects);
      console.log(`[${cfg.app}] _redirects → ${BACKEND}`);
    },
  });

  return defineConfig({
    plugins: [react(), buildPlugin()],
    resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
    build: {
      outDir: cfg.outDir,
      sourcemap: false,
      minify: true,
      rollupOptions: {
        input: path.resolve(__dirname, cfg.entryHtml),
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'ui-vendor': ['lucide-react'],
          },
        },
      },
    },
    base: '/',
    server: { port: cfg.port, host: true },
  });
};
