// =============================================================================
// 01b-seed-librairies.js — Crée les entrées librairie_partners pour les 20
// users 'libraire' déjà seedés par 01-seed.js. Marque le 1er comme
// est_super_librairie=true (rôle YukpoLibrairie central).
//
// Préconditions : 01-seed.js exécuté → users.json présent.
// =============================================================================

import 'dotenv/config';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { tx, closePool } from './lib/db.js';
import { VILLES } from './lib/data.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const users = JSON.parse(fs.readFileSync(join(__dirname, 'users.json'), 'utf8'));
  const libraires = users.filter(u => u.partner_type === 'libraire');
  if (libraires.length === 0) throw new Error('Aucun user libraire dans users.json — relance 01-seed.js');

  const result = await tx(async (client) => {
    const inserted = [];
    for (let i = 0; i < libraires.length; i++) {
      const u = libraires[i];
      const isSuper = i === 0; // 1er libraire = super-librairie Yukpo officielle
      const villeKey = u.ville ?? 'douala';
      const ville = VILLES[villeKey] ?? VILLES.douala;

      const r = await client.query(`
        INSERT INTO librairie_partners (
          user_id, nom, email, telephone, gps, ville, quartier,
          rayon_service_km, statut, rating, temps_moyen_validation,
          commission_app, est_actif, est_super_librairie,
          delai_validation_super_librairie_s
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, 'actif', 4.2, 5,
          0.05, true, $9,
          900
        )
        ON CONFLICT DO NOTHING
        RETURNING id, user_id, est_super_librairie
      `, [
        u.id,
        isSuper ? 'YukpoLibrairie (sim)' : `Libraire Sim ${i}`,
        u.email,
        '+237600000000',
        u.gps,
        ville.quartiers ? villeKey : 'douala',
        ville.quartiers?.[0] ?? null,
        isSuper ? 50 : 10, // super-librairie : rayon 50 km ; libraires de quartier : 10 km
        isSuper,
      ]);
      if (r.rows[0]) inserted.push(r.rows[0]);
    }
    return inserted;
  });

  const supers = result.filter(r => r.est_super_librairie);
  console.log(`✅ ${result.length} librairie_partners créés (${supers.length} super-librairie)`);
  console.log('   Super-librairie ID :', supers[0]?.id);

  // ✅ FIX 2026-05-18 (sim chaînes livraison) — chaque libraire est aussi
  // membre 'manager' de sa propre équipe. Sans ça, POST /validation/valider
  // renvoie 403 "Validation réservée au gérant ou aux membres d'équipe".
  // Cette entrée team est créée automatiquement en prod quand un libraire
  // est inscrit ; on le simule explicitement ici.
  await tx(async (client) => {
    for (const r of result) {
      await client.query(`
        INSERT INTO libraire_team_members (librairie_id, user_id, role, is_active)
        VALUES ($1, $2, 'manager', true)
        ON CONFLICT (librairie_id, user_id) DO NOTHING
      `, [r.id, r.user_id]);
    }
  });
  console.log(`   ${result.length} libraire_team_members (manager) seedés`);

  // Persister la map user_id → librairie_id (UUID) pour l'orchestrateur
  const map = Object.fromEntries(result.map(r => [r.user_id, { librairie_id: r.id, est_super: r.est_super_librairie }]));
  fs.writeFileSync(join(__dirname, 'librairies.json'), JSON.stringify(map, null, 2));
  console.log('   librairies.json écrit');

  await closePool();
}

main().catch((e) => { console.error('❌', e); process.exit(1); });
