#!/usr/bin/env node
// Wrapper de déploiement Netlify multi-sites pour le repo Yukpo.
//
// netlify-cli (v23+) ignore --site et NETLIFY_SITE_ID dès qu'un fichier
// .netlify/state.json existe dans le cwd → ce script swap temporairement
// le state.json pour cibler le bon site, puis restaure.
//
// Usage : node scripts/deploy-site.mjs <pharmacie|restaurant|bourse|lite> [--draft]

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, copyFileSync, unlinkSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = resolve(__dirname, '..');

const SITES = {
  pharmacie:  { id: 'db01dd8e-4458-4c6b-8b71-8e47911ed6b6', dir: 'dist-pharmacie',  buildConfig: 'vite.pharmacie.config.ts',  url: 'https://pharmacie.yukpomnang.com'  },
  restaurant: { id: '61771bc0-f761-4967-bb65-a20351b5d008', dir: 'dist-restaurant', buildConfig: 'vite.restaurant.config.ts', url: 'https://restaurant.yukpomnang.com' },
  bourse:     { id: '53a9ae8d-0509-475d-990b-1196201da80d', dir: 'dist-bourse',     buildConfig: 'vite.bourse.config.ts',     url: 'https://bourse.yukpomnang.com'     },
  lite:       { id: '7013d1a6-208e-4e76-aa2c-2c20ff07b858', dir: 'dist-lite',       buildConfig: 'vite.lite.config.ts',       url: 'https://yukpo-lite-app.netlify.app' },
};

const target = process.argv[2];
const isDraft = process.argv.includes('--draft');
const skipBuild = process.argv.includes('--no-build');

if (!target || !SITES[target]) {
  console.error(`Usage : node scripts/deploy-site.mjs <pharmacie|restaurant|bourse|lite> [--draft] [--no-build]`);
  console.error(`Cibles disponibles : ${Object.keys(SITES).join(', ')}`);
  process.exit(1);
}

const { id, dir, buildConfig, url } = SITES[target];
const STATE_PATH = resolve(FRONTEND_DIR, '.netlify', 'state.json');
const BACKUP_PATH = STATE_PATH + '.bak';

const run = (cmd, args, opts = {}) => {
  console.log(`\n$ ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, { cwd: FRONTEND_DIR, stdio: 'inherit', shell: process.platform === 'win32', ...opts });
  if (r.status !== 0) throw new Error(`${cmd} a échoué (code ${r.status})`);
};

const swapState = (newSiteId) => {
  if (existsSync(STATE_PATH)) copyFileSync(STATE_PATH, BACKUP_PATH);
  writeFileSync(STATE_PATH, JSON.stringify({ siteId: newSiteId }));
};

const restoreState = () => {
  if (existsSync(BACKUP_PATH)) {
    copyFileSync(BACKUP_PATH, STATE_PATH);
    unlinkSync(BACKUP_PATH);
  }
};

console.log(`\n────────────────────────────────────────────────────────────`);
console.log(`  Déploiement Netlify : ${target}`);
console.log(`  Site ID : ${id}`);
console.log(`  Dir     : ${dir}`);
console.log(`  URL     : ${url}`);
console.log(`────────────────────────────────────────────────────────────`);

try {
  if (!skipBuild) {
    run('npx', ['vite', 'build', '--config', buildConfig]);
  } else {
    console.log('\n[skip] build (--no-build)');
  }

  if (!existsSync(resolve(FRONTEND_DIR, dir))) {
    throw new Error(`Le dossier ${dir} n'existe pas. Lance le build d'abord.`);
  }

  swapState(id);
  const args = ['deploy', '--dir', dir];
  if (!isDraft) args.push('--prod');
  run('netlify', args);
  console.log(`\n✅ ${target} déployé sur ${url}`);
} catch (e) {
  console.error(`\n❌ Échec du déploiement : ${e.message}`);
  process.exitCode = 1;
} finally {
  restoreState();
  console.log(`[state.json restauré]`);
}
