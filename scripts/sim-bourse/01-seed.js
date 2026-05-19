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
//   - 500 livres_scolaires_demandes (cherche occasion secondaire)
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

    // ✅ 2026-05-19 — Contrainte production : scan recto/verso OBLIGATOIRE pour
    // troc/vente_occasion. La simulation s'aligne et fournit toujours les URLs
    // placeholder pour respecter la contrainte modèle (Vec<String> non-nullable).
    const livreIdx = i + 1;
    const imgRecto = `https://sim-bourse.local/livres/${owner.id}/${livreIdx}-recto.jpg`;
    const imgVerso = `https://sim-bourse.local/livres/${owner.id}/${livreIdx}-verso.jpg`;
    const imagesUrls = [imgRecto, imgVerso];

    livres.push({
      service_id: serviceIds.get(owner.id), user_id: owner.id,
      titre: prog.titre_livre, classe_actuelle: prog.classe, classe_souhaitee: classeSouhaitee,
      matiere: prog.matiere, niveau: prog.niveau,
      etat_livre: etat, etat_classification: etat,
      mode_listing: modeFinal, prix_detecte: prixDetecte,
      valeur_calculee: valeurCalculee, ratio_etat: ratioEtat,
      programme_scolaire_id: prog.id, est_au_programme: true,
      ia_analysis_status: 'completed', ia_confidence: 0.95,
      situation_troc: 'offre_demande', troc_status: 'pending',
      gps, ville: owner.ville, quartier,
      is_available: true,
      images_urls: imagesUrls,
      image_recto: imgRecto,
      image_verso: imgVerso,
    });
  }

  const BATCH = 100;
  for (let i = 0; i < livres.length; i += BATCH) {
    const chunk = livres.slice(i, i + BATCH);
    const values = []; const params = []; let p = 1;
    for (const l of chunk) {
      values.push(`(${Array.from({ length: 26 }, () => `$${p++}`).join(',')})`);
      params.push(
        l.service_id, l.user_id, l.titre, l.classe_actuelle, l.classe_souhaitee, l.matiere, l.niveau,
        l.etat_livre, l.etat_classification, l.mode_listing, l.prix_detecte, l.valeur_calculee, l.ratio_etat,
        l.programme_scolaire_id, l.est_au_programme, l.ia_analysis_status, l.ia_confidence,
        l.situation_troc, l.troc_status, l.gps, l.ville, l.quartier, l.is_available,
        l.images_urls, l.image_recto, l.image_verso,
      );
    }
    await client.query(`
      INSERT INTO livres_scolaires (
        service_id, user_id, titre, classe_actuelle, classe_souhaitee, matiere, niveau,
        etat_livre, etat_classification, mode_listing, prix_detecte, valeur_calculee, ratio_etat,
        programme_scolaire_id, est_au_programme, ia_analysis_status, ia_confidence,
        situation_troc, troc_status, gps, ville, quartier, is_available,
        images_urls, image_recto, image_verso
      ) VALUES ${values.join(',')}
    `, params);
  }
  return livres.length;
}

/**
 * 2026-05-19 — Insère N triplets de parents avec connectivité 3-hop forcée
 * en troc. Garantit que find_matching_chaine peut construire ≥ N chaînes
 * valides (cycles équilibrés A→B→C→A multi-parents — l'essence du troc DAG).
 *
 * Pour chaque triplet (P0, P1, P2) on choisit :
 *   - Matière commune (Mathématiques)
 *   - 3 classes différentes (ex: 6e, 5e, 4e)
 *   - P0 : livre classe[0], cherche classe[1]
 *   - P1 : livre classe[1], cherche classe[2]
 *   - P2 : livre classe[2], cherche classe[0]
 *
 * Résultat matching : livre(P0) ↦ besoin(P1), livre(P1) ↦ besoin(P2),
 * livre(P2) ↦ besoin(P0). Cycle 3-hop équilibré valide.
 */
async function insertDagChainSeeds(client, parents, serviceIds, nChains) {
  // Récupère 3 programmes Math distincts (3 classes différentes) actifs
  const progR = await client.query(`
    SELECT id, classe, matiere, titre_livre, niveau,
           COALESCE(prix_officiel, 5000) AS prix_officiel
    FROM programmes_scolaires
    WHERE matiere IN ('Mathématiques', 'Mathematics', 'Math', 'Maths')
      AND is_active = true
      AND classe IN ('6ème','5ème','4ème','6e','5e','4e','Form 1','Form 2','Form 3')
    ORDER BY classe
    LIMIT 30
  `);
  if (progR.rows.length < 3) {
    console.warn(`    ⚠ Pas assez de programmes Math distincts (${progR.rows.length}) — DAG seed skipped.`);
    return;
  }
  // On garde 3 classes les + différentes
  const classes = [...new Set(progR.rows.map(r => r.classe))].slice(0, 3);
  if (classes.length < 3) {
    console.warn(`    ⚠ Pas assez de classes Math distinctes (${classes.length}) — DAG seed skipped.`);
    return;
  }
  const progByClasse = {};
  for (const c of classes) {
    progByClasse[c] = progR.rows.find(r => r.classe === c);
  }

  // Sélectionne 3 × nChains parents distincts (skip ceux qui ne sont pas 'user')
  // ✅ FIX 2026-05-19 — Pour que find_matching_chaine accepte la chaîne,
  // les 3 parents d'un triplet doivent être à ≤ 20 km l'un de l'autre
  // (MAX_EDGE_DISTANCE_KM). Solution : grouper par ville et constituer
  // les triplets parmi des parents de LA MÊME VILLE.
  const eligibleParents = parents.filter(p => p.role === 'user');
  const byVille = {};
  for (const p of eligibleParents) {
    (byVille[p.ville] = byVille[p.ville] || []).push(p);
  }
  // On préfère les grosses villes qui ont assez de parents pour former 10 triplets
  const villesAssezGrosses = Object.keys(byVille).filter(v => byVille[v].length >= 3);
  if (villesAssezGrosses.length === 0) {
    console.warn(`    ⚠ Aucune ville avec ≥3 parents — DAG seed skipped.`);
    return;
  }

  let inserted = 0;
  let usedChains = 0;
  outer: for (const ville of villesAssezGrosses) {
    const pool = [...byVille[ville]].sort(() => Math.random() - 0.5);
    while (pool.length >= 3 && usedChains < nChains) {
      const triplet = pool.splice(0, 3);
      for (let k = 0; k < 3; k++) {
        const p = triplet[k];
        const classeActuelle = classes[k];
        const classeSouhaitee = classes[(k + 1) % 3];
        const prog = progByClasse[classeActuelle];
        const prixOfficiel = parseFloat(prog.prix_officiel ?? 5000) || 5000;
        const valeurCalculee = Math.round(prixOfficiel * 0.6);
        const { gps, quartier } = randomGpsForVille(p.ville);
      const imgR = `https://sim-bourse.local/livres/dag-${usedChains}-${k}-recto.jpg`;
      const imgV = `https://sim-bourse.local/livres/dag-${usedChains}-${k}-verso.jpg`;
      await client.query(
        `INSERT INTO livres_scolaires (
          service_id, user_id, titre, classe_actuelle, classe_souhaitee, matiere, niveau,
          etat_livre, etat_classification, mode_listing, prix_detecte, valeur_calculee, ratio_etat,
          programme_scolaire_id, est_au_programme, ia_analysis_status, ia_confidence,
          situation_troc, troc_status, gps, ville, quartier, is_available,
          images_urls, image_recto, image_verso
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,'bon','bon','troc',NULL,$8,0.6,$9,true,'completed',0.95,
          'offre_demande','pending',$10,$11,$12,true,
          $13,$14,$15
        )`,
        [
          serviceIds.get(p.id),
          p.id,
          `[DAG-${usedChains}] ${prog.titre_livre}`,
          classeActuelle,
          classeSouhaitee,
          prog.matiere,
          prog.niveau,
          valeurCalculee,
          prog.id,
          gps,
          p.ville,
          quartier,
          [imgR, imgV], imgR, imgV,
        ],
      );
      inserted++;
      }
      usedChains++;
    }
    if (usedChains >= nChains) break;
  }
  console.log(
    `    → ${inserted} livres DAG-friendly insérés (${usedChains}/${nChains} chaînes 3-hop, same-city)`,
  );
}

/**
 * 2026-05-19 — Insère N chaînes MIXTES de 3 parents distincts jouant chacun
 * un rôle différent dans la même chaîne. Validation que le DAG peut composer
 * vendeur (source) + trocer (milieu) + acheteur (sink).
 *
 * Structure d'une chaîne mixte :
 *   V (parent vendeur)  : livre Math 6e en mode='vente'           → SOURCE
 *   T (parent trocer)   : livre Math 5e en mode='troc',
 *                         cherche Math 6e (matche V)               → MILIEU
 *   A (parent acheteur) : demande_occasion Math 5e via
 *                         livre_scolaires_demandes (sink, cash)    → SINK
 *
 * Flux :
 *   V → T : V donne son livre 6e à T (T paie V cash). V reçoit cash.
 *   T → A : T donne son livre 5e à A (A paie T cash). T a maintenant
 *           le livre 6e (qu'il a reçu de V) qui satisfait son besoin.
 *           A reçoit le livre 5e qu'elle cherchait.
 *
 * 3 parents distincts, 3 rôles, 1 chaîne DAG ouverte (pas de cycle).
 */
async function insertMixedChainSeeds(client, parents, serviceIds, nChains) {
  // Vérif que la table demandes existe (créée par bourse_prod_fixes wave 6)
  const tableEx = await client.query(
    `SELECT 1 FROM information_schema.tables WHERE table_name = 'livres_scolaires_demandes'`,
  );
  if (tableEx.rowCount === 0) {
    console.warn('    ⚠ Table livres_scolaires_demandes absente — mixed seed skipped.');
    return;
  }

  // 2 programmes Math distincts (classes différentes pour V et T)
  const progR = await client.query(`
    SELECT id, classe, matiere, titre_livre, niveau,
           COALESCE(prix_officiel, 5000) AS prix_officiel
    FROM programmes_scolaires
    WHERE matiere IN ('Mathématiques', 'Mathematics', 'Math', 'Maths')
      AND is_active = true
      AND classe IN ('6ème','5ème','4ème','6e','5e','4e','Form 1','Form 2','Form 3')
    ORDER BY classe
    LIMIT 20
  `);
  if (progR.rows.length < 2) {
    console.warn(`    ⚠ Pas assez de programmes Math distincts pour seed mixte — skipped.`);
    return;
  }
  const classes = [...new Set(progR.rows.map(r => r.classe))].slice(0, 2);
  if (classes.length < 2) {
    console.warn(`    ⚠ Pas assez de classes Math distinctes — skipped.`);
    return;
  }
  const progByClasse = {
    [classes[0]]: progR.rows.find(r => r.classe === classes[0]),
    [classes[1]]: progR.rows.find(r => r.classe === classes[1]),
  };

  // ✅ FIX 2026-05-19 — Triplets V/T/A groupés par MÊME VILLE (contrainte
  // MAX_EDGE_DISTANCE_KM=20km du DAG).
  const eligibleParents = parents.filter(p => p.role === 'user');
  const byVille = {};
  for (const p of eligibleParents) {
    (byVille[p.ville] = byVille[p.ville] || []).push(p);
  }
  const triplets = [];
  for (const ville of Object.keys(byVille)) {
    const pool = [...byVille[ville]].sort(() => Math.random() - 0.5);
    while (pool.length >= 3 && triplets.length < nChains) {
      triplets.push(pool.splice(0, 3));
    }
    if (triplets.length >= nChains) break;
  }
  nChains = triplets.length;
  if (nChains === 0) {
    console.warn(`    ⚠ Aucune ville avec ≥3 parents — mixed seed skipped.`);
    return;
  }

  let nLivres = 0;
  let nDemandes = 0;
  for (let i = 0; i < nChains; i++) {
    const [vendeur, trocer, acheteur] = triplets[i];
    if (!vendeur || !trocer || !acheteur) break;

    const cV = classes[0]; // classe du livre du vendeur (= cherché par trocer)
    const cT = classes[1]; // classe du livre du trocer (= cherché par acheteur)
    const progV = progByClasse[cV];
    const progT = progByClasse[cT];

    // V : insère livre mode='vente' classe cV (SOURCE)
    {
      const prix = parseFloat(progV.prix_officiel ?? 5000) || 5000;
      const valeur = Math.round(prix * 0.6);
      const { gps, quartier } = randomGpsForVille(vendeur.ville);
      const imgR = `https://sim-bourse.local/livres/mix-${i}-v-recto.jpg`;
      const imgV = `https://sim-bourse.local/livres/mix-${i}-v-verso.jpg`;
      await client.query(
        `INSERT INTO livres_scolaires (
          service_id, user_id, titre, classe_actuelle, classe_souhaitee, matiere, niveau,
          etat_livre, etat_classification, mode_listing, prix_detecte, valeur_calculee, ratio_etat,
          programme_scolaire_id, est_au_programme, ia_analysis_status, ia_confidence,
          situation_troc, troc_status, gps, ville, quartier, is_available,
          images_urls, image_recto, image_verso
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,'bon','bon','vente',$8,$9,0.6,$10,true,'completed',0.95,'offre_demande','pending',$11,$12,$13,true,$14,$15,$16)`,
        [
          serviceIds.get(vendeur.id), vendeur.id,
          `[MIX-${i}-V] ${progV.titre_livre}`,
          cV, cV /* vendeur ne cherche rien */, progV.matiere, progV.niveau,
          valeur, valeur, progV.id, gps, vendeur.ville, quartier,
          [imgR, imgV], imgR, imgV,
        ],
      );
      nLivres++;
    }

    // T : insère livre mode='troc' classe cT (MILIEU — donne cT, cherche cV)
    {
      const prix = parseFloat(progT.prix_officiel ?? 5000) || 5000;
      const valeur = Math.round(prix * 0.6);
      const { gps, quartier } = randomGpsForVille(trocer.ville);
      const imgR = `https://sim-bourse.local/livres/mix-${i}-t-recto.jpg`;
      const imgV = `https://sim-bourse.local/livres/mix-${i}-t-verso.jpg`;
      await client.query(
        `INSERT INTO livres_scolaires (
          service_id, user_id, titre, classe_actuelle, classe_souhaitee, matiere, niveau,
          etat_livre, etat_classification, mode_listing, prix_detecte, valeur_calculee, ratio_etat,
          programme_scolaire_id, est_au_programme, ia_analysis_status, ia_confidence,
          situation_troc, troc_status, gps, ville, quartier, is_available,
          images_urls, image_recto, image_verso
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,'bon','bon','troc',NULL,$8,0.6,$9,true,'completed',0.95,'offre_demande','pending',$10,$11,$12,true,$13,$14,$15)`,
        [
          serviceIds.get(trocer.id), trocer.id,
          `[MIX-${i}-T] ${progT.titre_livre}`,
          cT, cV /* trocer cherche le livre du vendeur */, progT.matiere, progT.niveau,
          valeur, progT.id, gps, trocer.ville, quartier,
          [imgR, imgV], imgR, imgV,
        ],
      );
      nLivres++;
    }

    // A : insère demande_occasion classe cT (SINK — cherche le livre du trocer)
    {
      const prix = parseFloat(progT.prix_officiel ?? 5000) || 5000;
      const { gps, quartier } = randomGpsForVille(acheteur.ville);
      await client.query(
        `INSERT INTO livres_scolaires_demandes (
          user_id, titre, matiere, classe_souhaitee, niveau,
          budget_max_xaf, gps, ville, quartier, is_active, is_satisfied
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,false)`,
        [
          acheteur.id,
          `[MIX-${i}-A] ${progT.titre_livre}`,
          progT.matiere,
          cT,
          progT.niveau,
          Math.round(prix * 0.7),
          gps, acheteur.ville, quartier,
        ],
      );
      nDemandes++;
    }
  }
  console.log(
    `    → ${nLivres} livres + ${nDemandes} demandes (mixed seed : ${nChains} chaînes V→T→A)`,
  );
}

async function insertDemandes(client, parents, programmes) {
  const exists = await client.query(`SELECT 1 FROM information_schema.tables WHERE table_name='livres_scolaires_demandes'`);
  if (exists.rowCount === 0) {
    console.warn('⚠️  Table livres_scolaires_demandes absente — saut. Relancer après auto-migrate.');
    return 0;
  }
  for (let i = 0; i < N_DEMANDES; i++) {
    const user = pick(parents);
    const prog = pick(programmes);
    const budget = randInt(1000, 5000);
    const { gps, quartier } = randomGpsForVille(user.ville);
    await client.query(`
      INSERT INTO livres_scolaires_demandes (user_id, titre, matiere, classe_souhaitee, niveau, budget_max_xaf, gps, ville, quartier, is_active, is_satisfied)
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

    // ✅ 2026-05-19 — Seed DAG-friendly OPTIONNEL pour tester find_matching_chaine.
    // Sans connectivité forcée, le seed aléatoire produit ~0 chaînes valides
    // (probabilité ≈ 0 de matcher classe + matière à 3 hops). Cette phase
    // crée N triplets de parents avec connectivité 3-hop garantie en troc.
    //
    // Activable via env SIM_FORCE_DAG_CHAINS=10 (default 0 = pas de seed forcé).
    const N_FORCE_DAG = parseInt(process.env.SIM_FORCE_DAG_CHAINS ?? '0', 10);
    if (N_FORCE_DAG > 0) {
      console.log(`  • Insertion ${N_FORCE_DAG} chaînes DAG forcées (3 parents × ${N_FORCE_DAG})…`);
      await insertDagChainSeeds(client, parents, serviceIds, N_FORCE_DAG);
    }

    // ✅ 2026-05-19 — Seed chaînes MIXTES Vendeur→Trocer→Acheteur (3 parents
    // distincts, 3 rôles dans 1 même chaîne) pour exercer la richesse complète
    // du DAG. Activable via SIM_FORCE_MIXED_CHAINS=N.
    const N_FORCE_MIXED = parseInt(process.env.SIM_FORCE_MIXED_CHAINS ?? '0', 10);
    if (N_FORCE_MIXED > 0) {
      console.log(`  • Insertion ${N_FORCE_MIXED} chaînes mixtes V→T→A forcées…`);
      await insertMixedChainSeeds(client, parents, serviceIds, N_FORCE_MIXED);
    }

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
