// =============================================================================
// 01-seed.js — Génère les données de simulation directement en SQL.
//
// Préconditions :
//   - fly proxy 15432:5432 -a yukpo-bourse-sim-db (lance le tunnel)
//   - 00-pre-truncate.js déjà exécuté (clone purgé)
//   - .env (ou export) avec DATABASE_URL + JWT_SECRET
//
// Output :
//   - 200 users (160 parents + 20 libraires + 10 coursiers + 10 admins)
//     emails : sim+1@yukpo-sim.local … sim+200@yukpo-sim.local
//     password : "sim-test-pass" (bcrypt — non utilisé, JWT forgés directement)
//   - 1 service "bourse-livre" par user vendeur
//   - 1000 livres_scolaires (70% troc / 25% vente / 5% don, état 60% bon / 40% acceptable)
//     uniquement classes secondaire général + technique
//   - 500 livre_scolaire_demandes (cherche occasion secondaire)
//   - ~60 relations referrals
//   - jwts.json   (ids → JWT pour 02-orchestrate.js)
//   - users.json  (snapshot pour 02-orchestrate.js)
// =============================================================================

import 'dotenv/config';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { getPool, tx, closePool } from './lib/db.js';
import { forgeJwt } from './lib/jwt.js';
import {
  pickVille, randomGpsForVille, pick, pickEtatLivre,
  pickModeListing, genReferralCode, randInt,
  classeSuivante, isPrimaire,
} from './lib/data.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const N_USERS = parseInt(process.env.SIM_USERS ?? '200', 10);
const N_LIVRES = parseInt(process.env.SIM_LIVRES ?? '1000', 10);
const N_DEMANDES = parseInt(process.env.SIM_DEMANDES ?? '500', 10);
const TAUX_PARRAINAGE = parseFloat(process.env.TAUX_PARRAINAGE ?? '0.30');
const PASSWORD_HASH = bcrypt.hashSync('sim-test-pass', 10);

async function loadProgrammesSecondaire(client) {
  const r = await client.query(`
    SELECT id, classe, matiere, titre_livre, prix_officiel, niveau
    FROM programmes_scolaires
    WHERE is_active = true
      AND (niveau ILIKE '%secondaire%' OR niveau ILIKE '%lycée%' OR niveau ILIKE '%technical%'
           OR niveau ILIKE '%high school%' OR niveau ILIKE '%secondary%' OR niveau ILIKE '%a level%' OR niveau ILIKE '%o level%')
      AND COALESCE(type_article, 'livre') = 'livre'
  `);
  if (r.rows.length === 0) throw new Error('Aucun programme scolaire secondaire trouvé');
  return r.rows;
}

function buildUserRows() {
  const rows = [];
  for (let i = 1; i <= N_USERS; i++) {
    let role, partnerType = null;
    if (i <= 160)        { role = 'user';        partnerType = null; }
    else if (i <= 180)   { role = 'partenaire';  partnerType = 'libraire'; }
    else if (i <= 190)   { role = 'partenaire';  partnerType = 'coursier'; }
    else                 { role = 'admin';       partnerType = null; }

    const ville = pickVille();
    const { gps, quartier } = randomGpsForVille(ville);

    rows.push({
      idx: i,
      email: `sim+${i}@yukpo-sim.local`,
      role, partner_type: partnerType,
      nom: `Sim${i}`, prenom: 'Test',
      gps, ville, quartier,
      referral_code: genReferralCode(),
    });
  }
  return rows;
}

async function insertUsers(client, userRows) {
  const values = []; const params = []; let p = 1;
  for (const u of userRows) {
    values.push(`($${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++})`);
    params.push(u.email, PASSWORD_HASH, u.role, u.nom, u.prenom, `${u.prenom} ${u.nom}`, u.gps, 'fr', 1.0, 1.0, 0.0);
  }
  const r = await client.query(`
    INSERT INTO users (email, password_hash, role, nom, prenom, nom_complet, gps, preferred_lang, token_price_user, token_price_provider, commission_pct)
    VALUES ${values.join(', ')}
    RETURNING id, email
  `, params);

  const byEmail = new Map(r.rows.map((row) => [row.email, row.id]));
  for (const u of userRows) u.id = byEmail.get(u.email);

  for (const u of userRows) {
    await client.query(`UPDATE users SET referral_code = $1 WHERE id = $2 AND referral_code IS NULL`, [u.referral_code, u.id]);
    if (u.partner_type) await client.query(`UPDATE users SET partner_type = $1 WHERE id = $2`, [u.partner_type, u.id]);
  }
  return userRows;
}

async function applyReferrals(client, users) {
  const parents = users.filter((u) => u.role === 'user');
  const sample = parents.filter(() => Math.random() < TAUX_PARRAINAGE);
  for (const filleul of sample) {
    const parrain = pick(parents.filter((u) => u.id !== filleul.id));
    await client.query(`UPDATE users SET referred_by = $1 WHERE id = $2`, [parrain.id, filleul.id]);
    await client.query(`
      INSERT INTO referrals (parrain_id, filleul_id, status, bonus_amount_xaf)
      VALUES ($1, $2, 'pending', 500)
      ON CONFLICT (filleul_id) DO NOTHING
    `, [parrain.id, filleul.id]);
  }
  return sample.length;
}

async function createServicesForVendeurs(client, parents) {
  const map = new Map();
  for (const p of parents) {
    const r = await client.query(`
      INSERT INTO services (user_id, data, category, gps, is_active)
      VALUES ($1, $2::jsonb, 'bourse-livre', $3, true)
      RETURNING id
    `, [
      p.id,
      JSON.stringify({ titre: { type_donnee: 'string', valeur: 'Bourse du Livre (sim)' }, sim_tag: 'SIM-BOURSE' }),
      p.gps,
    ]);
    map.set(p.id, r.rows[0].id);
  }
  return map;
}

async function insertLivres(client, parents, serviceIds, programmes) {
  const livres = [];
  for (let i = 0; i < N_LIVRES; i++) {
    const owner = pick(parents);
    const prog = pick(programmes);
    const etat = pickEtatLivre();
    const mode = pickModeListing();
    const prixOfficiel = parseFloat(prog.prix_officiel ?? 5000) || 5000;
    const ratioEtat = etat === 'bon' ? 0.60 : 0.40;
    const valeurCalculee = Math.round(prixOfficiel * ratioEtat);
    const prixDetecte = mode === 'vente' ? valeurCalculee : null;
    const { gps, quartier } = randomGpsForVille(owner.ville);

    // ✅ FIX 2026-05-18 — classe_souhaitee = la classe SUIVANTE (réciprocité
    // de troc : un parent dont l'enfant passe N→N+1 offre un livre de N et
    // cherche celui de N+1, l'autre parent inverse). Avant : souhaitee=actuelle
    // → 0 matchings possibles (cf. RAPPORT_SIMULATION_BOURSE.md faille F).
    // Si classeSuivante() retourne null (classe non reconnue/primaire), on
    // bascule en `don` (pas de réciprocité requise) et garde souhaitee=actuelle.
    const cSuivante = classeSuivante(prog.classe);
    const classeSouhaitee = cSuivante ?? prog.classe;
    // Verrou métier (validé user 2026-05-18) : primaire JAMAIS en troc/vente.
    // Comme le seed charge déjà niveau ILIKE '%secondaire%', cette branche
    // ne devrait pas se déclencher, mais on garde l'invariant pour robustesse.
    const modeFinal = (isPrimaire(prog.classe) || !cSuivante) ? 'don' : mode;

    livres.push({
      service_id: serviceIds.get(owner.id), user_id: owner.id,
      titre: prog.titre_livre, classe_actuelle: prog.classe, classe_souhaitee: classeSouhaitee,
      matiere: prog.matiere, niveau: prog.niveau,
      etat_livre: etat, etat_classification: etat,
      mode_listing: mode, prix_detecte: prixDetecte,
      valeur_calculee: valeurCalculee, ratio_etat: ratioEtat,
      programme_scolaire_id: prog.id, est_au_programme: true,
      ia_analysis_status: 'completed', ia_confidence: 0.95,
      situation_troc: 'offre_demande', troc_status: 'pending',
      gps, ville: owner.ville, quartier,
      is_available: true,
    });
  }

  const BATCH = 100;
  for (let i = 0; i < livres.length; i += BATCH) {
    const chunk = livres.slice(i, i + BATCH);
    const values = []; const params = []; let p = 1;
    for (const l of chunk) {
      values.push(`(${Array.from({ length: 23 }, () => `$${p++}`).join(',')})`);
      params.push(
        l.service_id, l.user_id, l.titre, l.classe_actuelle, l.classe_souhaitee, l.matiere, l.niveau,
        l.etat_livre, l.etat_classification, l.mode_listing, l.prix_detecte, l.valeur_calculee, l.ratio_etat,
        l.programme_scolaire_id, l.est_au_programme, l.ia_analysis_status, l.ia_confidence,
        l.situation_troc, l.troc_status, l.gps, l.ville, l.quartier, l.is_available,
      );
    }
    await client.query(`
      INSERT INTO livres_scolaires (
        service_id, user_id, titre, classe_actuelle, classe_souhaitee, matiere, niveau,
        etat_livre, etat_classification, mode_listing, prix_detecte, valeur_calculee, ratio_etat,
        programme_scolaire_id, est_au_programme, ia_analysis_status, ia_confidence,
        situation_troc, troc_status, gps, ville, quartier, is_available
      ) VALUES ${values.join(',')}
    `, params);
  }
  return livres.length;
}

async function insertDemandes(client, parents, programmes) {
  const exists = await client.query(`SELECT 1 FROM information_schema.tables WHERE table_name='livre_scolaire_demandes'`);
  if (exists.rowCount === 0) {
    console.warn('⚠️  Table livre_scolaire_demandes absente — saut. Relancer après auto-migrate.');
    return 0;
  }
  for (let i = 0; i < N_DEMANDES; i++) {
    const user = pick(parents);
    const prog = pick(programmes);
    const budget = randInt(1000, 5000);
    const { gps, quartier } = randomGpsForVille(user.ville);
    await client.query(`
      INSERT INTO livre_scolaire_demandes (user_id, titre, matiere, classe_souhaitee, niveau, budget_max_xaf, gps, ville, quartier, is_active, is_satisfied)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, false)
    `, [user.id, prog.titre_livre, prog.matiere, prog.classe, prog.niveau, budget, gps, user.ville, quartier]);
  }
  return N_DEMANDES;
}

async function main() {
  console.log('▶️  Seed bourse — DB =', process.env.DATABASE_URL?.replace(/:[^@/]+@/, ':***@'));
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET manquant (env)');

  const stats = await tx(async (client) => {
    console.log('  • Chargement programmes scolaires secondaire…');
    const programmes = await loadProgrammesSecondaire(client);
    console.log(`    → ${programmes.length} programmes trouvés`);

    console.log(`  • Insertion ${N_USERS} users…`);
    const userRows = buildUserRows();
    await insertUsers(client, userRows);

    console.log(`  • Application referrals (${Math.round(TAUX_PARRAINAGE * 100)}% des parents)…`);
    const nReferrals = await applyReferrals(client, userRows);
    console.log(`    → ${nReferrals} relations parrain→filleul`);

    const parents = userRows.filter((u) => u.role === 'user');
    console.log(`  • Création ${parents.length} services bourse-livre (1 par parent)…`);
    const serviceIds = await createServicesForVendeurs(client, parents);

    console.log(`  • Insertion ${N_LIVRES} livres_scolaires…`);
    const nLivres = await insertLivres(client, parents, serviceIds, programmes);

    console.log(`  • Insertion ${N_DEMANDES} demandes occasion…`);
    const nDemandes = await insertDemandes(client, parents, programmes);

    // ✅ 2026-05-19 — Seed couriers.status='active' pour les 10 partenaires
    // coursiers. Sans ça, l'endpoint assign-courier refuse (filter status='active'
    // → 0 rows). Idempotent via ON CONFLICT (user_id) DO UPDATE.
    const coursiers = userRows.filter(u => u.role === 'partenaire' && u.partner_type === 'coursier');
    let nCouriersActive = 0;
    for (const c of coursiers) {
      try {
        await client.query(
          `INSERT INTO couriers (user_id, status, rating_average, rating_count, hired_at)
           VALUES ($1, 'active'::delivery_courier_status, 4.5, 10, NOW())
           ON CONFLICT (user_id) DO UPDATE SET status = 'active'::delivery_courier_status`,
          [c.id],
        );
        nCouriersActive++;
      } catch (e) {
        console.warn(`    ⚠ courier ${c.id} INSERT failed: ${e.message.slice(0,80)}`);
      }
    }
    console.log(`  • Coursiers actifs : ${nCouriersActive}/${coursiers.length}`);

    return { users: userRows, nReferrals, nLivres, nDemandes, nCouriersActive };
  });

  console.log('  • Forgeage JWTs…');
  const jwts = {};
  const usersSnapshot = stats.users.map((u) => {
    jwts[u.id] = forgeJwt({
      userId: u.id, role: u.role, email: u.email,
      name: `${u.prenom} ${u.nom}`, tokensBalance: 1000000, partnerType: u.partner_type,
    });
    return { id: u.id, email: u.email, role: u.role, partner_type: u.partner_type, gps: u.gps, ville: u.ville };
  });

  fs.writeFileSync(join(__dirname, 'jwts.json'), JSON.stringify(jwts, null, 2));
  fs.writeFileSync(join(__dirname, 'users.json'), JSON.stringify(usersSnapshot, null, 2));

  console.log('\n✅ Seed terminé');
  console.log(`   - ${stats.users.length} users insérés (jwts.json + users.json écrits)`);
  console.log(`   - ${stats.nReferrals} referrals`);
  console.log(`   - ${stats.nLivres} livres scolaires (troc/vente/don)`);
  console.log(`   - ${stats.nDemandes} demandes occasion`);
  console.log(`   - ${stats.nCouriersActive ?? 0} coursiers active`);

  await closePool();
}

main().catch((e) => { console.error('❌', e); process.exit(1); });
