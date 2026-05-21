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
 * 2026-05-20 — Insère N chaînes OUVERTES (acycliques) de 4 parents jouant
 * V → T1 → T2 → A. C'est la vraie sémantique du DAG troc :
 *   - V (vendeur) : livre classe[0] mode='vente'           → SOURCE (cash in)
 *   - T1 (trocer) : livre classe[1] mode='troc', cherche classe[0]
 *   - T2 (trocer) : livre classe[2] mode='troc', cherche classe[1]
 *   - A (acheteur) : demande_occasion classe[2]            → SINK (cash out)
 *
 * Edges :
 *   livre(V, c0) → besoin(T1, c0)
 *   livre(T1, c1) → besoin(T2, c1)
 *   livre(T2, c2) → demande_occasion(A, c2)
 *
 * Aucune arête ne reboucle sur V → chemin ouvert acyclique.
 *
 * Correction historique : ce seed produisait précédemment P0→P1→P2→P0 (cycle
 * fermé), interdit par la règle "DAG acyclique intra-chaîne" — le user a
 * corrigé : "on ne doit jamais revenir au noeud de départ".
 */
async function insertDagChainSeeds(client, parents, serviceIds, nChains) {
  // ✅ 2026-05-20 — Chemin OUVERT V→T1→T2→A (4 parents, 3 classes Math distinctes)
  const progR = await client.query(`
    SELECT id, classe, matiere, titre_livre, niveau,
           COALESCE(prix_officiel, 5000) AS prix_officiel
    FROM programmes_scolaires
    WHERE matiere IN ('Mathématiques', 'Mathematics', 'Math', 'Maths')
      AND is_active = true
      AND classe IN ('6ème','5ème','4ème','3ème','6e','5e','4e','3e','Form 1','Form 2','Form 3','Form 4')
    ORDER BY classe
    LIMIT 30
  `);
  const classes = [...new Set(progR.rows.map(r => r.classe))].slice(0, 3);
  if (classes.length < 3) {
    console.warn(`    ⚠ Pas assez de classes Math distinctes (${classes.length}) — DAG seed skipped.`);
    return;
  }
  const progByClasse = {};
  for (const c of classes) progByClasse[c] = progR.rows.find(r => r.classe === c);

  // Quatre parents par chaîne, même ville (contrainte MAX_EDGE_DISTANCE_KM=20)
  const eligibleParents = parents.filter(p => p.role === 'user');
  const byVille = {};
  for (const p of eligibleParents) (byVille[p.ville] = byVille[p.ville] || []).push(p);
  const villesAssezGrosses = Object.keys(byVille).filter(v => byVille[v].length >= 4);
  if (villesAssezGrosses.length === 0) {
    console.warn(`    ⚠ Aucune ville avec ≥4 parents — DAG open-path seed skipped.`);
    return;
  }

  // Vérif table demandes (sinon pas de sink)
  const tableEx = await client.query(
    `SELECT 1 FROM information_schema.tables WHERE table_name = 'livres_scolaires_demandes'`,
  );
  if (tableEx.rowCount === 0) {
    console.warn('    ⚠ Table livres_scolaires_demandes absente — DAG open-path seed skipped.');
    return;
  }

  let nLivres = 0;
  let nDemandes = 0;
  let usedChains = 0;
  for (const ville of villesAssezGrosses) {
    const pool = [...byVille[ville]].sort(() => Math.random() - 0.5);
    while (pool.length >= 4 && usedChains < nChains) {
      const [v, t1, t2, a] = pool.splice(0, 4);
      const cV = classes[0], cT1 = classes[1], cT2 = classes[2];
      const progV = progByClasse[cV], progT1 = progByClasse[cT1], progT2 = progByClasse[cT2];

      // V : livre vente classe cV (SOURCE)
      {
        const prix = parseFloat(progV.prix_officiel ?? 5000) || 5000;
        const valeur = Math.round(prix * 0.6);
        const { gps, quartier } = randomGpsForVille(v.ville);
        const imgR = `https://sim-bourse.local/livres/dag-${usedChains}-v-recto.jpg`;
        const imgV = `https://sim-bourse.local/livres/dag-${usedChains}-v-verso.jpg`;
        await client.query(
          `INSERT INTO livres_scolaires (
            service_id, user_id, titre, classe_actuelle, classe_souhaitee, matiere, niveau,
            etat_livre, etat_classification, mode_listing, prix_detecte, valeur_calculee, ratio_etat,
            programme_scolaire_id, est_au_programme, ia_analysis_status, ia_confidence,
            situation_troc, troc_status, gps, ville, quartier, is_available,
            images_urls, image_recto, image_verso
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,'bon','bon','vente',$8,$9,0.6,$10,true,'completed',0.95,'offre_demande','pending',$11,$12,$13,true,$14,$15,$16)`,
          [
            serviceIds.get(v.id), v.id,
            `[DAG-${usedChains}-V] ${progV.titre_livre}`,
            cV, cV, progV.matiere, progV.niveau,
            valeur, valeur, progV.id, gps, v.ville, quartier,
            [imgR, imgV], imgR, imgV,
          ],
        );
        nLivres++;
      }

      // T1 : livre troc classe cT1, cherche cV
      {
        const prix = parseFloat(progT1.prix_officiel ?? 5000) || 5000;
        const valeur = Math.round(prix * 0.6);
        const { gps, quartier } = randomGpsForVille(t1.ville);
        const imgR = `https://sim-bourse.local/livres/dag-${usedChains}-t1-recto.jpg`;
        const imgV = `https://sim-bourse.local/livres/dag-${usedChains}-t1-verso.jpg`;
        await client.query(
          `INSERT INTO livres_scolaires (
            service_id, user_id, titre, classe_actuelle, classe_souhaitee, matiere, niveau,
            etat_livre, etat_classification, mode_listing, prix_detecte, valeur_calculee, ratio_etat,
            programme_scolaire_id, est_au_programme, ia_analysis_status, ia_confidence,
            situation_troc, troc_status, gps, ville, quartier, is_available,
            images_urls, image_recto, image_verso
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,'bon','bon','troc',NULL,$8,0.6,$9,true,'completed',0.95,'offre_demande','pending',$10,$11,$12,true,$13,$14,$15)`,
          [
            serviceIds.get(t1.id), t1.id,
            `[DAG-${usedChains}-T1] ${progT1.titre_livre}`,
            cT1, cV /* cherche le livre de V */, progT1.matiere, progT1.niveau,
            valeur, progT1.id, gps, t1.ville, quartier,
            [imgR, imgV], imgR, imgV,
          ],
        );
        nLivres++;
      }

      // T2 : livre troc classe cT2, cherche cT1
      {
        const prix = parseFloat(progT2.prix_officiel ?? 5000) || 5000;
        const valeur = Math.round(prix * 0.6);
        const { gps, quartier } = randomGpsForVille(t2.ville);
        const imgR = `https://sim-bourse.local/livres/dag-${usedChains}-t2-recto.jpg`;
        const imgV = `https://sim-bourse.local/livres/dag-${usedChains}-t2-verso.jpg`;
        await client.query(
          `INSERT INTO livres_scolaires (
            service_id, user_id, titre, classe_actuelle, classe_souhaitee, matiere, niveau,
            etat_livre, etat_classification, mode_listing, prix_detecte, valeur_calculee, ratio_etat,
            programme_scolaire_id, est_au_programme, ia_analysis_status, ia_confidence,
            situation_troc, troc_status, gps, ville, quartier, is_available,
            images_urls, image_recto, image_verso
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,'bon','bon','troc',NULL,$8,0.6,$9,true,'completed',0.95,'offre_demande','pending',$10,$11,$12,true,$13,$14,$15)`,
          [
            serviceIds.get(t2.id), t2.id,
            `[DAG-${usedChains}-T2] ${progT2.titre_livre}`,
            cT2, cT1 /* cherche le livre de T1 */, progT2.matiere, progT2.niveau,
            valeur, progT2.id, gps, t2.ville, quartier,
            [imgR, imgV], imgR, imgV,
          ],
        );
        nLivres++;
      }

      // A : demande_occasion classe cT2 (SINK)
      {
        const prix = parseFloat(progT2.prix_officiel ?? 5000) || 5000;
        const { gps, quartier } = randomGpsForVille(a.ville);
        await client.query(
          `INSERT INTO livres_scolaires_demandes (
            user_id, titre, matiere, classe_souhaitee, niveau,
            budget_max_xaf, gps, ville, quartier, is_active, is_satisfied
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,false)`,
          [
            a.id,
            `[DAG-${usedChains}-A] ${progT2.titre_livre}`,
            progT2.matiere, cT2, progT2.niveau,
            Math.round(prix * 0.7),
            gps, a.ville, quartier,
          ],
        );
        nDemandes++;
      }

      usedChains++;
    }
    if (usedChains >= nChains) break;
  }
  console.log(
    `    → ${nLivres} livres + ${nDemandes} demandes (${usedChains}/${nChains} chaînes ouvertes V→T1→T2→A, same-city)`,
  );
}

/**
 * 2026-05-21 (wave 29) — Insère N chaînes troc où un trocer offre un livre
 * en état='bon' mais ne reçoit qu'un livre en état='acceptable'. Cette
 * chaîne DOIT être REJETÉE par la contrainte de réciprocité qualitative
 * (wave 29) : `find_matching_chaine` retire l'arête car le trocer
 * subirait une dégradation qualitative.
 *
 * Structure :
 *   V (vendeur) : livre 'acceptable' classe cV mode='vente'    → SOURCE
 *   T (trocer)  : livre 'bon' classe cT mode='troc',
 *                 cherche cV (mais cV n'est qu'acceptable)
 *
 * Attendu : la chaîne (V→T) est construite côté seed mais wave 29 retire
 * l'arête sender=V (car T offre 'bon' et ne recevrait que 'acceptable').
 *
 * Métrique observable dans le rapport :
 *   - nb_chaines_dégradation_rejetées doit être ≥ nChains
 *   - Aucun trocer 'bon' ne reçoit 'acceptable' dans les chaînes créées
 */
async function insertDegradedRejectionSeeds(client, parents, serviceIds, nChains) {
  if (nChains <= 0) return;
  const progR = await client.query(`
    SELECT id, classe, matiere, titre_livre, niveau,
           COALESCE(prix_officiel, 5000) AS prix_officiel
    FROM programmes_scolaires
    WHERE matiere IN ('Mathématiques', 'Mathematics', 'Math', 'Maths')
      AND is_active = true
      AND classe IN ('6ème','5ème','4ème','3ème','6e','5e','4e','3e')
    ORDER BY classe LIMIT 20
  `);
  const classes = [...new Set(progR.rows.map(r => r.classe))].slice(0, 2);
  if (classes.length < 2) {
    console.warn('    ⚠ Pas assez de classes — degraded seed skipped.');
    return;
  }
  const eligibleParents = parents.filter(p => p.role === 'user');
  const byVille = {};
  for (const p of eligibleParents) (byVille[p.ville] = byVille[p.ville] || []).push(p);
  const villesAssezGrosses = Object.keys(byVille).filter(v => byVille[v].length >= 2);
  if (villesAssezGrosses.length === 0) return;

  let nLivres = 0;
  let used = 0;
  for (const ville of villesAssezGrosses) {
    const pool = [...byVille[ville]].sort(() => Math.random() - 0.5);
    while (pool.length >= 2 && used < nChains) {
      const [v, t] = pool.splice(0, 2);
      const progV = progR.rows.find(r => r.classe === classes[0]);
      const progT = progR.rows.find(r => r.classe === classes[1]);
      const valeurV = Math.round(parseFloat(progV.prix_officiel) * 0.4); // état acceptable
      const valeurT = Math.round(parseFloat(progT.prix_officiel) * 0.6); // état bon
      const gpsV = randomGpsForVille(v.ville);
      const gpsT = randomGpsForVille(t.ville);

      // V : livre 'acceptable' mode='vente' classe cV
      await client.query(
        `INSERT INTO livres_scolaires (
          service_id, user_id, titre, classe_actuelle, classe_souhaitee, matiere, niveau,
          etat_livre, etat_classification, mode_listing, prix_detecte, valeur_calculee, ratio_etat,
          programme_scolaire_id, est_au_programme, ia_analysis_status, ia_confidence,
          situation_troc, troc_status, gps, ville, quartier, is_available,
          images_urls, image_recto, image_verso
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,'acceptable','acceptable','vente',$8,$9,0.4,$10,true,'completed',0.95,'offre_demande','pending',$11,$12,$13,true,$14,$15,$16)`,
        [serviceIds.get(v.id), v.id, `[DEGRADE-${used}-V-accept] ${progV.titre_livre}`,
          classes[0], classes[0], progV.matiere, progV.niveau, valeurV, valeurV, progV.id,
          gpsV.gps, v.ville, gpsV.quartier,
          [`https://sim-bourse.local/livres/degrade-${used}-v-r.jpg`, `https://sim-bourse.local/livres/degrade-${used}-v-v.jpg`],
          `https://sim-bourse.local/livres/degrade-${used}-v-r.jpg`,
          `https://sim-bourse.local/livres/degrade-${used}-v-v.jpg`]);
      nLivres++;
      // T : livre 'bon' mode='troc' classe cT, cherche cV
      await client.query(
        `INSERT INTO livres_scolaires (
          service_id, user_id, titre, classe_actuelle, classe_souhaitee, matiere, niveau,
          etat_livre, etat_classification, mode_listing, prix_detecte, valeur_calculee, ratio_etat,
          programme_scolaire_id, est_au_programme, ia_analysis_status, ia_confidence,
          situation_troc, troc_status, gps, ville, quartier, is_available,
          images_urls, image_recto, image_verso
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,'bon','bon','troc',NULL,$8,0.6,$9,true,'completed',0.95,'offre_demande','pending',$10,$11,$12,true,$13,$14,$15)`,
        [serviceIds.get(t.id), t.id, `[DEGRADE-${used}-T-bon] ${progT.titre_livre}`,
          classes[1], classes[0], progT.matiere, progT.niveau, valeurT, progT.id,
          gpsT.gps, t.ville, gpsT.quartier,
          [`https://sim-bourse.local/livres/degrade-${used}-t-r.jpg`, `https://sim-bourse.local/livres/degrade-${used}-t-v.jpg`],
          `https://sim-bourse.local/livres/degrade-${used}-t-r.jpg`,
          `https://sim-bourse.local/livres/degrade-${used}-t-v.jpg`]);
      nLivres++;
      used++;
    }
    if (used >= nChains) break;
  }
  console.log(`    → ${nLivres} livres dégradation insérés (${used} chaînes DOIVENT être rejetées par wave 29)`);
}

/**
 * 2026-05-21 (wave 29) — Insère N chaînes troc où un trocer offre un livre
 * en état='acceptable' et reçoit un livre en état='bon'. Cette chaîne
 * DOIT être ACCEPTÉE par la contrainte de réciprocité qualitative
 * (upgrade gratuit autorisé).
 *
 * Structure : symétrique de degraded mais inversée (V offre 'bon', T 'acceptable').
 *
 * Métrique observable :
 *   - Chaîne créée avec succès (upgrade légitime)
 *   - Le trocer 'acceptable' a reçu 'bon' = ratio favorable
 */
async function insertAcceptableUpgradeSeeds(client, parents, serviceIds, nChains) {
  if (nChains <= 0) return;
  const progR = await client.query(`
    SELECT id, classe, matiere, titre_livre, niveau,
           COALESCE(prix_officiel, 5000) AS prix_officiel
    FROM programmes_scolaires
    WHERE matiere IN ('Mathématiques', 'Mathematics', 'Math', 'Maths')
      AND is_active = true
      AND classe IN ('6ème','5ème','4ème','3ème','6e','5e','4e','3e')
    ORDER BY classe LIMIT 20
  `);
  const classes = [...new Set(progR.rows.map(r => r.classe))].slice(0, 2);
  if (classes.length < 2) return;
  const eligibleParents = parents.filter(p => p.role === 'user');
  const byVille = {};
  for (const p of eligibleParents) (byVille[p.ville] = byVille[p.ville] || []).push(p);
  const villesAssezGrosses = Object.keys(byVille).filter(v => byVille[v].length >= 2);
  if (villesAssezGrosses.length === 0) return;

  let nLivres = 0;
  let used = 0;
  for (const ville of villesAssezGrosses) {
    const pool = [...byVille[ville]].sort(() => Math.random() - 0.5);
    while (pool.length >= 2 && used < nChains) {
      const [v, t] = pool.splice(0, 2);
      const progV = progR.rows.find(r => r.classe === classes[0]);
      const progT = progR.rows.find(r => r.classe === classes[1]);
      const valeurV = Math.round(parseFloat(progV.prix_officiel) * 0.6); // état bon
      const valeurT = Math.round(parseFloat(progT.prix_officiel) * 0.4); // état acceptable
      const gpsV = randomGpsForVille(v.ville);
      const gpsT = randomGpsForVille(t.ville);

      // V : livre 'bon' mode='vente' classe cV
      await client.query(
        `INSERT INTO livres_scolaires (
          service_id, user_id, titre, classe_actuelle, classe_souhaitee, matiere, niveau,
          etat_livre, etat_classification, mode_listing, prix_detecte, valeur_calculee, ratio_etat,
          programme_scolaire_id, est_au_programme, ia_analysis_status, ia_confidence,
          situation_troc, troc_status, gps, ville, quartier, is_available,
          images_urls, image_recto, image_verso
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,'bon','bon','vente',$8,$9,0.6,$10,true,'completed',0.95,'offre_demande','pending',$11,$12,$13,true,$14,$15,$16)`,
        [serviceIds.get(v.id), v.id, `[UPGRADE-${used}-V-bon] ${progV.titre_livre}`,
          classes[0], classes[0], progV.matiere, progV.niveau, valeurV, valeurV, progV.id,
          gpsV.gps, v.ville, gpsV.quartier,
          [`https://sim-bourse.local/livres/upgrade-${used}-v-r.jpg`, `https://sim-bourse.local/livres/upgrade-${used}-v-v.jpg`],
          `https://sim-bourse.local/livres/upgrade-${used}-v-r.jpg`,
          `https://sim-bourse.local/livres/upgrade-${used}-v-v.jpg`]);
      nLivres++;
      // T : livre 'acceptable' mode='troc' classe cT, cherche cV (livre 'bon')
      await client.query(
        `INSERT INTO livres_scolaires (
          service_id, user_id, titre, classe_actuelle, classe_souhaitee, matiere, niveau,
          etat_livre, etat_classification, mode_listing, prix_detecte, valeur_calculee, ratio_etat,
          programme_scolaire_id, est_au_programme, ia_analysis_status, ia_confidence,
          situation_troc, troc_status, gps, ville, quartier, is_available,
          images_urls, image_recto, image_verso
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,'acceptable','acceptable','troc',NULL,$8,0.4,$9,true,'completed',0.95,'offre_demande','pending',$10,$11,$12,true,$13,$14,$15)`,
        [serviceIds.get(t.id), t.id, `[UPGRADE-${used}-T-accept] ${progT.titre_livre}`,
          classes[1], classes[0], progT.matiere, progT.niveau, valeurT, progT.id,
          gpsT.gps, t.ville, gpsT.quartier,
          [`https://sim-bourse.local/livres/upgrade-${used}-t-r.jpg`, `https://sim-bourse.local/livres/upgrade-${used}-t-v.jpg`],
          `https://sim-bourse.local/livres/upgrade-${used}-t-r.jpg`,
          `https://sim-bourse.local/livres/upgrade-${used}-t-v.jpg`]);
      nLivres++;
      used++;
    }
    if (used >= nChains) break;
  }
  console.log(`    → ${nLivres} livres upgrade insérés (${used} chaînes DOIVENT être acceptées par wave 29)`);
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

    // ✅ 2026-05-21 (wave 29) — Tests réciprocité qualitative par état.
    //   SIM_FORCE_DAG_DEGRADED=5 : chaînes où trocer 'bon' recevrait 'acceptable'
    //     → DOIT être rejetée par wave 29 (no dégradation autorisée)
    //   SIM_FORCE_DAG_UPGRADE=5  : chaînes où trocer 'acceptable' recevrait 'bon'
    //     → DOIT être acceptée (upgrade gratuit autorisé)
    const N_FORCE_DEGRADED = parseInt(process.env.SIM_FORCE_DAG_DEGRADED ?? '0', 10);
    if (N_FORCE_DEGRADED > 0) {
      console.log(`  • Insertion ${N_FORCE_DEGRADED} chaînes dégradation 'bon'→'acceptable' (DOIVENT être rejetées)…`);
      await insertDegradedRejectionSeeds(client, parents, serviceIds, N_FORCE_DEGRADED);
    }
    const N_FORCE_UPGRADE = parseInt(process.env.SIM_FORCE_DAG_UPGRADE ?? '0', 10);
    if (N_FORCE_UPGRADE > 0) {
      console.log(`  • Insertion ${N_FORCE_UPGRADE} chaînes upgrade 'acceptable'→'bon' (DOIVENT être acceptées)…`);
      await insertAcceptableUpgradeSeeds(client, parents, serviceIds, N_FORCE_UPGRADE);
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
