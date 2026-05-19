// =============================================================================
// 04-cleanup.js — purge les données de simulation
//
// Usage :
//   node 04-cleanup.js
//
// Variante "nuclear" : détruit l'app + DB Fly (zéro résiduel facturé) :
//   fly apps destroy yukpo-bourse-sim --yes
//   fly apps destroy yukpo-bourse-sim-db --yes
// =============================================================================

import 'dotenv/config';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getPool, closePool } from './lib/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  const pool = getPool();
  const sql = fs.readFileSync(join(__dirname, 'sql/cleanup.sql'), 'utf8');

  console.log('▶️  Exécution cleanup.sql sur', process.env.DATABASE_URL?.replace(/:[^@/]+@/, ':***@'));
  const res = await pool.query(sql);

  // La dernière query du fichier est un SELECT de vérification ; pg renvoie un array de results
  const lastResult = Array.isArray(res) ? res[res.length - 1] : res;
  if (lastResult.rows) {
    console.table(lastResult.rows);
  }

  console.log('✅ Cleanup terminé.');
  await closePool();
}

main().catch((e) => { console.error('❌', e); process.exit(1); });
