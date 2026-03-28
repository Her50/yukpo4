#!/usr/bin/env node
/**
 * Analyse la contribution des fichiers src/i18n/locales/*.json au bundle Metro (JS minifié),
 * puis estime leur poids équivalent dans le bytecode Hermes (.hbc).
 *
 * Usage:
 *   node scripts/analyze-locale-hbc-contribution.cjs
 *   node scripts/analyze-locale-hbc-contribution.cjs --skip-metro
 *   node scripts/analyze-locale-hbc-contribution.cjs --hbc path/to/AppEntry-xxx.hbc
 *
 * --skip-metro : n'exécute pas Metro ; utilise metro-bundle.js + .map s'ils existent déjà
 *                dans .bundle-analysis/ (sinon : stats disque + message).
 *
 * Ne modifie aucun fichier applicatif hors création/mise à jour dans .bundle-analysis/
 *
 * Méthodologie :
 * - Contribution exacte au bytecode Hermes (.hbc) par fichier source : non disponible
 *   (Hermes ne fournit pas cette répartition).
 * - Contribution des fichiers JSON au bundle Metro minifié : somme des entrées
 *   `sourcesContent` correspondant à `locales/*.json` dans la source map Metro
 *   (quand `source-map-explorer` échoue sur les maps Metro — erreur colonne Infinity —
 *   ce fallback est fiable pour le volume de texte des traductions).
 * - Estimation dans le .hbc : taille_locale_dans_JS × (taille_hbc / taille_JS).
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const MOBILE_ROOT = path.resolve(__dirname, '..');
const LOCALES_GLOB = path.join(MOBILE_ROOT, 'src', 'i18n', 'locales');
const OUT_BASE = path.join(MOBILE_ROOT, '.bundle-analysis');
const METRO_OUT = path.join(OUT_BASE, 'metro-bundle');
const METRO_JS = `${METRO_OUT}.js`;
/** Metro écrit la map en `metro-bundle.map` (pas `.js.map`) quand `out` est sans extension. */
function resolveMetroMapPath() {
  const a = `${METRO_OUT}.map`;
  const b = `${METRO_OUT}.js.map`;
  if (fs.existsSync(a)) return a;
  if (fs.existsSync(b)) return b;
  return null;
}

function parseArgs() {
  const argv = process.argv.slice(2);
  return {
    skipMetro: argv.includes('--skip-metro'),
    hbcPath: (() => {
      const i = argv.indexOf('--hbc');
      return i >= 0 && argv[i + 1] ? path.resolve(argv[i + 1]) : null;
    })(),
  };
}

function formatBytes(n) {
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(2)} Ko`;
  return `${(n / (1024 * 1024)).toFixed(2)} Mo`;
}

function collectLocaleFilesOnDisk() {
  if (!fs.existsSync(LOCALES_GLOB)) {
    return { files: [], totalBytes: 0 };
  }
  const files = fs.readdirSync(LOCALES_GLOB).filter((f) => f.endsWith('.json'));
  const list = files
    .map((name) => {
      const p = path.join(LOCALES_GLOB, name);
      const st = fs.statSync(p);
      return { name, path: p, bytes: st.size };
    })
    .sort((a, b) => b.bytes - a.bytes);
  const totalBytes = list.reduce((s, x) => s + x.bytes, 0);
  return { files: list, totalBytes };
}

function findDefaultHbc() {
  if (args.hbcPath && fs.existsSync(args.hbcPath)) return args.hbcPath;
  const candidates = [
    path.join(MOBILE_ROOT, 'dist-bundle-analysis', '_expo', 'static', 'js', 'android'),
    path.join(MOBILE_ROOT, 'dist', '_expo', 'static', 'js', 'android'),
  ];
  for (const dir of candidates) {
    if (!fs.existsSync(dir)) continue;
    const hbcs = fs.readdirSync(dir).filter((f) => f.endsWith('.hbc'));
    if (hbcs.length) {
      const withStats = hbcs.map((f) => ({
        p: path.join(dir, f),
        m: fs.statSync(path.join(dir, f)).mtimeMs,
      }));
      withStats.sort((a, b) => b.m - a.m);
      return withStats[0].p;
    }
  }
  return null;
}

function analyzeMapSourcesContentFallback(mapPath) {
  const raw = fs.readFileSync(mapPath, 'utf8');
  const map = JSON.parse(raw);
  const sources = map.sources || [];
  const contents = map.sourcesContent || [];
  const perFile = [];
  let totalLocales = 0;
  for (let i = 0; i < sources.length; i++) {
    const src = String(sources[i]).replace(/\\/g, '/');
    if (!src.includes('/locales/') || !src.endsWith('.json')) continue;
    const c = contents[i];
    const bytes = typeof c === 'string' ? Buffer.byteLength(c, 'utf8') : 0;
    totalLocales += bytes;
    perFile.push({ path: src, bytes });
  }
  perFile.sort((a, b) => b.bytes - a.bytes);
  return { perFile, totalLocales, hasContent: contents.some(Boolean) };
}

function runSourceMapExplorerNpx(jsPath, mapPath) {
  const r = spawnSync(
    'npx',
    ['--yes', 'source-map-explorer', jsPath, mapPath, '--json'],
    {
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024,
      cwd: MOBILE_ROOT,
      shell: true,
      env: { ...process.env },
    }
  );
  if (r.status !== 0) {
    return { ok: false, stderr: r.stderr || r.stdout };
  }
  try {
    return { ok: true, data: JSON.parse(r.stdout) };
  } catch (e) {
    return { ok: false, stderr: String(e) };
  }
}

/**
 * source-map-explorer JSON: structure varies by version; collect file sizes for paths containing locales/*.json
 */
function extractLocaleBytesFromSmeJson(data) {
  const results = [];
  // v2.x often: { files: { "path": { gzipLength, bundled } } }
  if (data.files && typeof data.files === 'object') {
    for (const [p, v] of Object.entries(data.files)) {
      const norm = p.replace(/\\/g, '/');
      if (!norm.includes('/locales/') || !norm.endsWith('.json')) continue;
      const bytes =
        typeof v === 'number'
          ? v
          : v && (v.bundled ?? v.size ?? v.uncompressed ?? v.sourceSize);
      if (typeof bytes === 'number') results.push({ path: norm, bytes });
    }
  }
  // alternate: results array
  if (Array.isArray(data.results)) {
    for (const row of data.results) {
      const p = row?.file || row?.path || row?.name;
      if (!p) continue;
      const norm = String(p).replace(/\\/g, '/');
      if (!norm.includes('/locales/') || !norm.endsWith('.json')) continue;
      const bytes = row?.bundled ?? row?.size;
      if (typeof bytes === 'number') results.push({ path: norm, bytes });
    }
  }
  const total = results.reduce((s, x) => s + x.bytes, 0);
  results.sort((a, b) => b.bytes - a.bytes);
  return { results, total };
}

async function runMetroBuild() {
  const { loadConfig } = require('metro-config');
  const Metro = require('metro');
  fs.mkdirSync(OUT_BASE, { recursive: true });
  const config = await loadConfig({ cwd: MOBILE_ROOT });
  const entry = path.join(MOBILE_ROOT, 'node_modules', 'expo', 'AppEntry.js');
  console.log('[analyze] Génération Metro (android, prod, minify, source-map)…');
  console.log('[analyze] Entrée:', entry);
  const t0 = Date.now();
  await Metro.runBuild(config, {
    entry,
    platform: 'android',
    dev: false,
    minify: true,
    sourceMap: true,
    out: METRO_OUT,
  });
  console.log(`\n[analyze] Metro terminé en ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}

const args = parseArgs();

async function main() {
  console.log('=== Analyse locales ↔ bundle (Metro JS) ↔ estimation .hbc ===\n');
  console.log('Racine projet:', MOBILE_ROOT);
  console.log('Dossier locales:', LOCALES_GLOB);

  const disk = collectLocaleFilesOnDisk();
  console.log('\n--- 1) Fichiers sur disque (src/i18n/locales/*.json) ---');
  console.log(`Fichiers: ${disk.files.length}`);
  console.log(`Total brut (disque): ${formatBytes(disk.totalBytes)}`);
  console.log('Top 10 par taille:');
  disk.files.slice(0, 10).forEach((f, i) => {
    console.log(`  ${i + 1}. ${f.name}  ${formatBytes(f.bytes)}`);
  });

  if (!args.skipMetro) {
    try {
      await runMetroBuild();
    } catch (e) {
      console.error('[analyze] Erreur Metro:', e);
      process.exit(1);
    }
  } else {
    console.log('\n[analyze] --skip-metro : pas de build Metro.');
  }

  const METRO_MAP = resolveMetroMapPath();
  if (!fs.existsSync(METRO_JS) || !METRO_MAP) {
    console.log('\n--- Pas de metro-bundle.js + .map dans .bundle-analysis/ ---');
    console.log('Attendu:', METRO_JS, 'et', `${METRO_OUT}.map ou ${METRO_OUT}.js.map`);
    console.log('Relancez sans --skip-metro pour générer le bundle, ou copiez les fichiers manuellement.');
    console.log('\nÉtat de lieu partiel : contribution au .hbc non calculée (fichiers Hermes sans carte source par module).');
    process.exit(0);
  }

  const jsStat = fs.statSync(METRO_JS);
  const mapStat = fs.statSync(METRO_MAP);
  console.log('\n--- 2) Bundle Metro (JS minifié, avant Hermes) ---');
  console.log('Fichier:', METRO_JS);
  console.log(`Taille bundle JS: ${formatBytes(jsStat.size)}`);
  console.log(`Taille source map: ${formatBytes(mapStat.size)}`);

  let localeBytesInBundle = null;
  let method = '';
  let perFile = [];

  let sme = runSourceMapExplorerNpx(METRO_JS, METRO_MAP);
  if (sme.ok && sme.data) {
    const extracted = extractLocaleBytesFromSmeJson(sme.data);
    if (extracted.total > 0) {
      localeBytesInBundle = extracted.total;
      perFile = extracted.results;
      method = 'source-map-explorer (cartographie des octets du bundle)';
    }
  }

  if (localeBytesInBundle == null || localeBytesInBundle === 0) {
    const fb = analyzeMapSourcesContentFallback(METRO_MAP);
    if (fb.totalLocales > 0) {
      localeBytesInBundle = fb.totalLocales;
      perFile = fb.perFile.map((x) => ({ path: x.path, bytes: x.bytes }));
      method = fb.hasContent
        ? 'source map : somme des sourcesContent (locales/*.json)'
        : 'fallback incomplet';
    }
  }

  if (localeBytesInBundle == null || localeBytesInBundle === 0) {
    console.log('\n[analyze] Impossible d\'attribuer les locales au bundle (essayez: npm i -D source-map-explorer).');
    method = 'non disponible';
  } else {
    console.log('\n--- 3) Contribution des locales au bundle JS (minifié) ---');
    console.log(`Méthode: ${method}`);
    console.log(`Total attribué (locales): ${formatBytes(localeBytesInBundle)}`);
    const pct = (100 * localeBytesInBundle) / jsStat.size;
    console.log(`Part du bundle JS: ${pct.toFixed(2)} %`);
    console.log('Top 15 fichiers locale dans le bundle:');
    perFile.slice(0, 15).forEach((f, i) => {
      console.log(`  ${i + 1}. ${path.basename(f.path)}  ${formatBytes(f.bytes)}`);
    });
  }

  const hbcPath = findDefaultHbc();
  console.log('\n--- 4) Bytecode Hermes (.hbc) ---');
  if (!hbcPath) {
    console.log('Aucun .hbc trouvé (dist-bundle-analysis ou dist). Passez --hbc chemin/vers/AppEntry-xxx.hbc');
  } else {
    const hbcSize = fs.statSync(hbcPath).size;
    console.log('Fichier:', hbcPath);
    console.log(`Taille .hbc: ${formatBytes(hbcSize)}`);
    if (localeBytesInBundle && jsStat.size > 0) {
      const ratio = hbcSize / jsStat.size;
      const estimatedLocalesInHbc = Math.round(localeBytesInBundle * ratio);
      console.log('\n--- 5) Estimation contribution locales dans le .hbc ---');
      console.log('Note: Hermes ne fournit pas une répartition par fichier source.');
      console.log('Estimation linéaire: taille_locale_dans_JS × (taille_hbc / taille_JS).');
      console.log(`Ratio HBC/JS: ${ratio.toFixed(4)}`);
      console.log(`Estimation locales dans .hbc: ~${formatBytes(estimatedLocalesInHbc)} (~${((100 * estimatedLocalesInHbc) / hbcSize).toFixed(2)} % du .hbc)`);
    }
  }

  console.log('\n--- Synthèse ---');
  console.log(`- Disque locales (JSON brut): ${formatBytes(disk.totalBytes)} (${disk.files.length} fichiers)`);
  if (localeBytesInBundle) {
    console.log(`- Dans le bundle JS minifié: ${formatBytes(localeBytesInBundle)} (${method})`);
  }
  if (hbcPath && localeBytesInBundle && jsStat.size > 0) {
    const hbcSize = fs.statSync(hbcPath).size;
    const est = Math.round(localeBytesInBundle * (hbcSize / jsStat.size));
    console.log(`- Estimation équivalent Hermes .hbc: ~${formatBytes(est)}`);
  }
  console.log('\nFichiers générés:', OUT_BASE);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
