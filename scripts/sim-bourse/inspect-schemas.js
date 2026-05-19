import 'dotenv/config';
import { getPool, closePool } from './lib/db.js';

const tables = [
  'librairie_partners', 'commandes_mixtes', 'commande_livres_neufs',
  'commande_livres_occasion', 'commande_validations', 'transactions_agregees',
  'chaines_livraison_unifiees', 'qr_codes_coursier', 'wallets_bourse',
];

(async () => {
  const pool = getPool();
  for (const t of tables) {
    const r = await pool.query(
      `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns WHERE table_name=$1 ORDER BY ordinal_position`,
      [t],
    );
    if (r.rows.length === 0) { console.log(`\n[MANQUE] ${t}`); continue; }
    console.log(`\n=== ${t} (${r.rows.length} cols) ===`);
    for (const c of r.rows) {
      const nn = c.is_nullable === 'NO' ? 'NOT NULL' : '';
      const def = c.column_default ? `DEFAULT ${c.column_default}` : '';
      console.log(`  ${c.column_name.padEnd(35)} ${c.data_type.padEnd(20)} ${nn} ${def}`);
    }
  }
  await closePool();
})();
