// 00-pre-truncate.js — purge initiale du clone Postgres staging.
// À lancer AVANT 01-seed.js. Nécessite : fly proxy 15432:5432 -a yukpo-bourse-sim-db
import 'dotenv/config';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getPool, closePool } from './lib/db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const pool = getPool();
  const sql = fs.readFileSync(join(__dirname, 'sql/pre-truncate.sql'), 'utf8');
  console.log('▶️  Pre-truncate sur', process.env.DATABASE_URL?.replace(/:[^@/]+@/, ':***@'));
  const res = await pool.query(sql);
  const lastResult = Array.isArray(res) ? res[res.length - 1] : res;
  if (lastResult.rows) console.table(lastResult.rows);
  // ✅ FIX 2026-05-18 — invalider jwts.json / users.json locaux : les ids ont
  // changé après la purge des users sim, l'orchestrate ne doit pas réutiliser
  // les anciens JWTs (ils référencent des sub= ids qui n'existent plus).
  for (const f of ['jwts.json', 'users.json', 'librairies.json', 'sim-run.json']) {
    const p = join(__dirname, f);
    if (fs.existsSync(p)) { fs.unlinkSync(p); console.log(`  • supprimé ${f}`); }
  }
  console.log('✅ Pre-truncate OK. Clone prêt pour la simulation.');
  await closePool();
}
main().catch((e) => { console.error('❌', e); process.exit(1); });
