// =============================================================================
// 02-orchestrate.js V2 — Simulation end-to-end contre les ENDPOINTS RÉELS
//
// Couvre :
//  TROC LIVRES (bourse_livre_v2)
//   • /troc-livres/match-all-pending → génération chaînes par IA matching
//   • /troc-livres/chaine            → CRÉATION explicite des chaînes
//   • /troc-livres/direct            → trocs directs 2 personnes
//   • /packages/build-all            → construction paquets coursier (admin)
//   • /packages/optimized-route      → TSP coursier
//   • /packages/{id}/status          → cycle livraison constitue→en_route→livre→confirme
//
//  LIBRAIRIE NETWORK (commandes mixtes + super-librairie + paiements)
//   • POST /librairie-network/commandes                       → commande mixte (neuf + occasion)
//   • POST /librairie-network/commandes/{id}/valider-budget    → valider budget
//   • POST /librairie-network/commandes/{id}/broadcast         → envoyer aux libraires
//   • POST /librairie-network/validation/valider               → validation compétitive
//   • GET  /librairie-network/super-librairie/wholesale-order  → bon de commande grossiste
//   • GET  /librairie-network/super-librairie/delivery-routes  → TSP/clustering coursier
//   • GET  /librairie-network/super-librairie/parents-contacts → agrégat parents
//   • POST /librairie-network/paiements/demander               → paiement agrégé
//   • GET  /librairie-network/admin/statistiques               → KPIs admin
//
//  PARRAINAGE  • GET /api/referral/me
//
// Output : sim-run.json
// =============================================================================

import 'dotenv/config';
import axios from 'axios';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getPool, closePool } from './lib/db.js';
import { pick, randInt, randomGpsForVille } from './lib/data.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const API = process.env.API_BASE_URL ?? 'https://yukpo-bourse-sim.fly.dev';
const N_COMMANDES_MIXTES = parseInt(process.env.SIM_COMMANDES_NEUFS ?? '300', 10);

const log = { startedAt: new Date().toISOString(), api: API, phases: {} };

// Helper : ajoute un échantillon d'erreur (jusqu'à 5 par bucket de status)
function trackErr(bucket, status, body) {
  bucket.by_status = bucket.by_status ?? {};
  bucket.by_status[status] = (bucket.by_status[status] ?? 0) + 1;
  bucket.samples = bucket.samples ?? [];
  if ((bucket.samples.filter(s => s.status === status).length) < 3) {
    const snippet = typeof body === 'string' ? body.slice(0, 200)
      : body == null ? null
      : JSON.stringify(body).slice(0, 300);
    bucket.samples.push({ status, body: snippet });
  }
}

function loadJson(name) { return JSON.parse(fs.readFileSync(join(__dirname, name), 'utf8')); }
function client(jwt) {
  return axios.create({
    baseURL: API, timeout: 30_000,
    headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    validateStatus: () => true,
  });
}

// ===========================================================================
// PHASE 0 — Health
// ===========================================================================
async function phaseHealth() {
  const t0 = Date.now();
  const r = await axios.get(`${API}/health`, { validateStatus: () => true, timeout: 60_000 });
  log.phases.health = { status: r.status, latency_ms: Date.now() - t0 };
  if (r.status >= 500) throw new Error(`Backend non-healthy : ${r.status}`);
  console.log(`  health=${r.status} (${Date.now() - t0} ms)`);
}

// ===========================================================================
// PHASE 1 — Seed demandes (si auto-migrate vient de créer la table)
// ===========================================================================
async function phaseSeedDemandes(users) {
  const pool = getPool();
  const ex = await pool.query(`SELECT 1 FROM information_schema.tables WHERE table_name='livre_scolaire_demandes'`);
  if (ex.rowCount === 0) { log.phases.demandes = { skipped: 'table absente' }; console.log('  livre_scolaire_demandes absente'); return; }
  const have = await pool.query(`SELECT COUNT(*)::int AS n FROM livre_scolaire_demandes`);
  if (have.rows[0].n > 0) { log.phases.demandes = { skipped: 'déjà présent', n: have.rows[0].n }; console.log(`  demandes déjà : ${have.rows[0].n}`); return; }

  const progRes = await pool.query(`
    SELECT id, classe, matiere, titre_livre, niveau FROM programmes_scolaires
    WHERE is_active=true AND (niveau ILIKE '%secondaire%' OR niveau ILIKE '%secondary%' OR niveau ILIKE '%technical%' OR niveau ILIKE '%lycée%' OR niveau ILIKE '%level%')
      AND COALESCE(type_article,'livre')='livre'
  `);
  const programmes = progRes.rows;
  const parents = users.filter(u => u.role === 'user');
  const N = parseInt(process.env.SIM_DEMANDES ?? '500', 10);

  for (let i = 0; i < N; i++) {
    const u = pick(parents); const p = pick(programmes);
    const { gps, quartier } = randomGpsForVille(u.ville);
    await pool.query(`
      INSERT INTO livre_scolaire_demandes (user_id, titre, matiere, classe_souhaitee, niveau, budget_max_xaf, gps, ville, quartier, is_active, is_satisfied)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, true, false)
    `, [u.id, p.titre_livre, p.matiere, p.classe, p.niveau, randInt(1000, 5000), gps, u.ville, quartier]);
  }
  log.phases.demandes = { inserted: N };
  console.log(`  ${N} demandes seedées`);
}

// ===========================================================================
// PHASE 2 — Matching (IA DAG) pour chaque parent + collecte chaînes proposées
// ===========================================================================
async function phaseMatching(users, jwts) {
  const parents = users.filter(u => u.role === 'user');
  let ok = 0, err = 0, totalMatches = 0;
  const allChainsProposed = [];
  const t0 = Date.now();
  const errDetails = {};
  // ✅ 2026-05-19 (anomalie sim 16 #4) — Paralléliser par batch pour réduire
  // la latence totale. 160 séquentiel × 456ms = 73s; 160 / batch 20 × 456ms
  // = 3.6s théorique. Batch 20 = compromis pression réseau / latence.
  const BATCH = parseInt(process.env.SIM_MATCHING_BATCH ?? '20', 10);
  for (let i = 0; i < parents.length; i += BATCH) {
    const slice = parents.slice(i, i + BATCH);
    const results = await Promise.all(
      slice.map(async (u) => {
        try {
          const r = await client(jwts[u.id]).post(
            '/api/troc-livres/match-all-pending',
            { target_amount: 10000 },
          );
          if (r.status === 200) {
            const data = r.data || {};
            const matches = data.livres_pending ?? data.matches ?? [];
            // ✅ FIX 2026-05-19 — La réponse de /match-all-pending ne contient
            // PAS de clé `chaines` directe. Le compte de chaînes potentielles
            // est dans matches[i].n_matchings_chaines. On appelle séparément
            // /troc-livres/matchings pour les détails des livres avec
            // n_matchings_chaines > 0.
            const chains = [];
            for (const m of matches) {
              // ✅ FIX 2026-05-19 — Route exacte est /api/troc-livres/match
              // (singulier), pas /matchings (pluriel). Wave 17 avait le mauvais
              // path → 405 Method Not Allowed → chaînes jamais récupérées.
              if ((m.n_matchings_chaines ?? 0) > 0) {
                try {
                  const r2 = await client(jwts[u.id]).post(
                    '/api/troc-livres/match',
                    { livre_id: m.id, max_participants: 10 },
                  );
                  if (r2.status === 200) {
                    const c = r2.data?.chaines ?? r2.data?.chains ?? r2.data?.matchings ?? [];
                    for (const chain of c) {
                      chains.push({ proposed_by_user: u.id, livre_id: m.id, chain });
                    }
                  }
                } catch (_) { /* swallow */ }
              }
            }
            const totalMatchCount = data.match_count ?? 0;
            return { ok: true, matches: matches.length, match_count: totalMatchCount, chains };
          }
          return { ok: false, status: r.status, body: r.data };
        } catch (e) {
          return { ok: false, status: e.code || 'NETWORK_ERR', body: e.message };
        }
      }),
    );
    for (const r of results) {
      if (r.ok) {
        ok++;
        totalMatches += r.matches;
        allChainsProposed.push(...r.chains);
      } else {
        err++;
        trackErr(errDetails, r.status, r.body);
      }
    }
    if ((i + BATCH) % 40 < BATCH) {
      console.log(`    matching ${Math.min(i + BATCH, parents.length)}/${parents.length} (${allChainsProposed.length} chaînes vues, batch=${BATCH})`);
    }
  }
  log.phases.matching = { ok, err, total_matches: totalMatches, chaines_proposed: allChainsProposed.length, latency_total_ms: Date.now() - t0, errors: errDetails, batch_size: BATCH };
  console.log(`  Matching: ${ok} OK / ${err} err / ${allChainsProposed.length} chaînes proposées (latence ${Date.now() - t0}ms)`);
  return allChainsProposed;
}

// ===========================================================================
// PHASE 3 — CRÉATION explicite des chaînes (POST /troc-livres/chaine)
// ===========================================================================
async function phaseCreateChaines(chainsProposed, jwts) {
  let ok = 0, err = 0;
  const samples = [];
  // Dédoublonner : une chaîne par set unique de participants
  const seen = new Set();
  const uniqueChains = chainsProposed.filter(({ chain }) => {
    const key = (chain.participants ?? []).map(p => `${p.user_id}:${p.livre_offert_id}->${p.livre_souhaite_id}`).sort().join('|');
    if (!key || seen.has(key)) return false;
    seen.add(key); return true;
  });

  for (let i = 0; i < uniqueChains.length; i++) {
    const { proposed_by_user, chain } = uniqueChains[i];
    const participants = chain.participants ?? [];
    if (participants.length < 2) continue;
    const r = await client(jwts[proposed_by_user]).post('/api/troc-livres/chaine', { participants });
    if (r.status >= 200 && r.status < 300) ok++; else err++;
    if (samples.length < 5) samples.push({ status: r.status, n_participants: participants.length, body: r.data });
  }
  log.phases.create_chaines = { unique: uniqueChains.length, created_ok: ok, errors: err, samples };
  console.log(`  Création chaînes: ${ok} OK / ${err} err sur ${uniqueChains.length} uniques`);
}

// ===========================================================================
// PHASE 4 — Construction paquets coursier (admin sim)
// ===========================================================================
async function phaseBuildPackages(users, jwts) {
  const admin = users.find(u => u.role === 'admin');
  if (!admin) { console.warn('  Aucun admin sim'); return; }
  const t0 = Date.now();
  const r = await client(jwts[admin.id]).post('/api/bourse-livre/v2/packages/build-all', {});
  log.phases.build_packages = { status: r.status, latency_ms: Date.now() - t0, body: r.data };
  console.log(`  build-all: status=${r.status}`);
}

// ===========================================================================
// PHASE 5 — Optimized route TSP pour chaque coursier
// ===========================================================================
async function phaseOptimizedRoutes(users, jwts) {
  const coursiers = users.filter(u => u.partner_type === 'coursier');
  const pool = getPool();
  const pkgs = await pool.query(`SELECT id FROM book_delivery_packages ORDER BY created_at DESC LIMIT 50`);
  if (pkgs.rowCount === 0) { log.phases.optimized_routes = { skipped: 'aucun paquet' }; return; }
  const ids = pkgs.rows.map(r => r.id);
  // 1 coursier appelle l'optimisation pour son lot
  const cou = coursiers[0] ?? users.find(u => u.role === 'admin');
  const r = await client(jwts[cou.id]).post('/api/bourse-livre/v2/packages/optimized-route', { package_ids: ids });
  log.phases.optimized_routes = { status: r.status, n_packages: ids.length };
  console.log(`  optimized-route: status=${r.status} sur ${ids.length} paquets`);
}

// ===========================================================================
// PHASE 6 — Cycle livraison statut
// ===========================================================================
async function phasePackageDelivery(users, jwts) {
  const pool = getPool();
  const r = await pool.query(`SELECT id FROM book_delivery_packages WHERE statut IN ('a_constituer','constitue') LIMIT 30`);
  if (r.rowCount === 0) { log.phases.package_delivery = { skipped: 'aucun paquet' }; return; }
  const coursier = users.find(u => u.partner_type === 'coursier') ?? users.find(u => u.role === 'admin');
  const transitions = ['constitue', 'en_route', 'livre', 'confirme'];
  let ok = 0, err = 0;
  for (const pkg of r.rows) {
    for (const s of transitions) {
      const resp = await client(jwts[coursier.id]).patch(`/api/bourse-livre/v2/packages/${pkg.id}/status`, { statut: s });
      if (resp.status >= 400) err++; else ok++;
    }
  }
  log.phases.package_delivery = { n_packages: r.rowCount, transitions_ok: ok, errors: err };
  console.log(`  Livraison: ${ok} transitions OK / ${err} err sur ${r.rowCount} paquets`);
}

// ===========================================================================
// PHASE 7 — COMMANDES MIXTES (parent crée une commande mixte neuf+occasion)
// ===========================================================================
async function phaseCommandesMixtes(users, jwts) {
  const pool = getPool();
  const parents = users.filter(u => u.role === 'user');

  // Récupère 100 livres en vente disponibles + 100 programmes pour neufs
  const livresR = await pool.query(`
    SELECT id, titre, classe_actuelle AS classe, matiere, etat_livre, COALESCE(prix_detecte, valeur_calculee, 3000) AS prix, user_id AS vendeur_id
    FROM livres_scolaires WHERE mode_listing = 'vente' AND is_available = true LIMIT 200
  `);
  const livresOccasion = livresR.rows;

  const progR = await pool.query(`
    SELECT id, classe, matiere, titre_livre, COALESCE(prix_officiel, 5000) AS prix_officiel
    FROM programmes_scolaires WHERE is_active=true AND COALESCE(type_article,'livre')='livre' LIMIT 200
  `);
  const programmes = progR.rows;

  let ok = 0, err = 0; const commandes = [];
  const errDetails = {};
  for (let i = 0; i < N_COMMANDES_MIXTES; i++) {
    const u = pick(parents);
    const nNeufs = randInt(1, 4);
    const nOccasion = Math.random() < 0.5 && livresOccasion.length > 0 ? randInt(1, 3) : 0;
    const livres_neufs = [];
    let totalNeuf = 0;
    for (let k = 0; k < nNeufs; k++) {
      const p = pick(programmes);
      const px = parseFloat(p.prix_officiel) || 5000;
      totalNeuf += px;
      livres_neufs.push({
        programme_scolaire_id: p.id, titre: p.titre_livre, classe: p.classe, matiere: p.matiere,
        prix_officiel: px, prix_final: px, quantite: 1, est_au_programme: true,
      });
    }
    const livres_occasion_payload = [];
    let totalOcc = 0;
    for (let k = 0; k < nOccasion; k++) {
      const l = pick(livresOccasion);
      const px = parseFloat(l.prix) || 2000;
      totalOcc += px;
      livres_occasion_payload.push({
        livre_scolaire_id: l.id, titre: l.titre, classe: l.classe, matiere: l.matiere,
        etat_livre: l.etat_livre, prix: px, vendeur_id: l.vendeur_id, quantite: 1,
      });
    }
    const { gps } = randomGpsForVille(u.ville);
    try {
      const r = await client(jwts[u.id]).post('/api/librairie-network/commandes', {
        budget_total: totalNeuf + totalOcc + 1500,
        frais_livraison_xaf: 1500,
        devise: 'XAF',
        mode_livraison: 'coursier',
        adresse_livraison: `${u.ville} sim ${i}`,
        gps_livraison: gps,
        notes_client: 'commande sim',
        livres_neufs,
        livres_occasion: livres_occasion_payload,
      });
      if (r.status >= 200 && r.status < 300) {
        ok++;
        const cid = r.data?.id ?? r.data?.commande?.id ?? r.data?.commande_id;
        if (cid) commandes.push({ id: cid, user_id: u.id });
      } else {
        err++;
        trackErr(errDetails, r.status, r.data);
      }
    } catch (e) {
      err++;
      trackErr(errDetails, e.code || 'NETWORK_ERR', e.message);
    }
    if ((i + 1) % 50 === 0) console.log(`    commande ${i + 1}/${N_COMMANDES_MIXTES}…  (ok=${ok} err=${err})`);
  }
  log.phases.commandes_mixtes = { ok, err, total: N_COMMANDES_MIXTES, samples: commandes.slice(0, 5), errors: errDetails };
  console.log(`  Commandes mixtes: ${ok} OK / ${err} err`);
  return commandes;
}

// ===========================================================================
// PHASE 8 — Valider-budget + Broadcast → libraires
// ===========================================================================
async function phaseBroadcastCommandes(commandes, jwts) {
  let ok = 0, err = 0;
  let validerOk = 0, validerErr = 0;
  const errDetailsValider = {};
  const errDetailsBroadcast = {};
  for (const c of commandes) {
    const cli = client(jwts[c.user_id]);
    try {
      const rv = await cli.post(`/api/librairie-network/commandes/${c.id}/valider-budget`, { commande_id: c.id, methode_paiement: 'MobileMoney' });
      if (rv.status >= 200 && rv.status < 300) validerOk++;
      else { validerErr++; trackErr(errDetailsValider, rv.status, rv.data); }
    } catch (e) {
      validerErr++;
      trackErr(errDetailsValider, e.code || 'NETWORK_ERR', e.message);
    }
    try {
      const r = await cli.post(`/api/librairie-network/commandes/${c.id}/broadcast`, { commande_id: c.id, rayon_recherche_km: 20 });
      if (r.status >= 200 && r.status < 300) ok++;
      else { err++; trackErr(errDetailsBroadcast, r.status, r.data); }
    } catch (e) {
      err++;
      trackErr(errDetailsBroadcast, e.code || 'NETWORK_ERR', e.message);
    }
  }
  log.phases.broadcast = { ok, err, total: commandes.length, valider_ok: validerOk, valider_err: validerErr, errors: errDetailsBroadcast, errors_valider_budget: errDetailsValider };
  console.log(`  Valider-budget: ${validerOk} OK / ${validerErr} err`);
  console.log(`  Broadcast: ${ok} OK / ${err} err`);
}

// ===========================================================================
// PHASE 9 — Validation compétitive par libraires (premier qui répond gagne)
// ===========================================================================
// ✅ 2026-05-19 (sim chaînes livraison) — exerce le flux validation libraire
// bout-en-bout : récupère les vrais commande_livres_neufs.id depuis la DB
// et les passe en `livres_valides`. Le libraire utilise son JWT manager
// (seedé dans libraire_team_members par 01b-seed).
async function phaseValidationLibraires(commandes, users, jwts) {
  const pool = getPool();
  const libraires = users.filter(u => u.partner_type === 'libraire');
  if (libraires.length === 0) { log.phases.validation = { skipped: 'aucun libraire' }; return; }
  let ok = 0, err = 0, locked = 0;
  let livres_total_valides = 0;
  const errDetails = {};
  const N = Math.min(commandes.length, 200);
  for (let i = 0; i < N; i++) {
    const c = commandes[i];
    const livresR = await pool.query(`SELECT id FROM commande_livres_neufs WHERE commande_id = $1`, [c.id]);
    const livre_ids = livresR.rows.map(r => r.id);
    if (livre_ids.length === 0) continue;
    const shuffled = [...libraires].sort(() => Math.random() - 0.5).slice(0, 3);
    const tries = await Promise.all(shuffled.map(l =>
      client(jwts[l.id]).post('/api/librairie-network/validation/valider', {
        commande_id: c.id,
        livres_valides: livre_ids,
        livres_indisponibles: [],
        notes_validation: `sim-validate-all-${l.id}`,
      }).catch(e => ({ status: 599, error: e.message }))
    ));
    const winners = tries.filter(r => r.status >= 200 && r.status < 300);
    if (winners.length >= 1) { ok++; livres_total_valides += livre_ids.length; }
    if (winners.length > 1) locked++;
    for (const t of tries) {
      if (t.status >= 400 && t.status !== 409) {
        err++;
        trackErr(errDetails, t.status, t.data ?? t.error);
      }
    }
    if ((i + 1) % 50 === 0) console.log(`    validation ${i + 1}/${N}  (ok=${ok} err=${err} verrous_simultanés=${locked})`);
  }
  log.phases.validation = { ok, err, simultane_winners_anomalies: locked, total: N, livres_total_valides, errors: errDetails };
  console.log(`  Validation compétitive: ${ok} OK / ${err} err / ${locked} anomalies / ${livres_total_valides} livres validés`);
}

// ===========================================================================
// PHASE 9a-bis — Super-librairie (YukpoLibrairie) valide les commandes
// ===========================================================================
// Critique : depuis 2026-05-09 (commit 936698d950), TOUS les broadcasts
// routent vers super_librairie (priorité permanente Yukpo). Les libraires
// de zone ne reçoivent JAMAIS de validation. Pour que la cascade
// validation→paquet→chaîne se déclenche, c'est le super-libraire qui doit
// valider chaque commande en `envoyee_super_librairie`.
async function phaseSuperLibrairieValide(commandes, jwts, users) {
  const pool = getPool();
  const librairies = loadJson('librairies.json');
  const superLibUserIdStr = Object.keys(librairies).find(uid => librairies[uid].est_super);
  if (!superLibUserIdStr) {
    log.phases.super_librairie_valide = { skipped: 'aucune super-librairie' };
    console.log('  Pas de super-librairie sim → skip');
    return;
  }
  const superLibUserId = parseInt(superLibUserIdStr, 10);
  const jwt = jwts[superLibUserId];
  if (!jwt) {
    log.phases.super_librairie_valide = { skipped: 'JWT super-lib absent' };
    return;
  }

  const cmdR = await pool.query(`
    SELECT id FROM commandes_mixtes WHERE statut = 'envoyee_super_librairie' LIMIT 300
  `);
  const cmdIds = cmdR.rows.map(r => r.id);
  if (cmdIds.length === 0) {
    log.phases.super_librairie_valide = { skipped: 'aucune commande envoyee_super_librairie' };
    console.log('  Aucune commande à valider côté super-librairie');
    return;
  }

  let ok = 0, err = 0;
  let livres_total_valides = 0;
  const errDetails = {};
  const t0 = Date.now();

  for (let i = 0; i < cmdIds.length; i++) {
    const commande_id = cmdIds[i];
    const livresR = await pool.query(`SELECT id FROM commande_livres_neufs WHERE commande_id = $1`, [commande_id]);
    const livre_ids = livresR.rows.map(r => r.id);

    try {
      const r = await client(jwt).post('/api/librairie-network/validation/valider', {
        commande_id,
        livres_valides: livre_ids,
        livres_indisponibles: [],
        notes_validation: 'super-librairie-sim-valide-tout',
      });
      if (r.status >= 200 && r.status < 300) { ok++; livres_total_valides += livre_ids.length; }
      else { err++; trackErr(errDetails, r.status, r.data); }
    } catch (e) {
      err++;
      trackErr(errDetails, e.code || 'NETWORK_ERR', e.message);
    }
    if ((i + 1) % 50 === 0) console.log(`    super-lib valide ${i + 1}/${cmdIds.length}  (ok=${ok} err=${err})`);
  }
  log.phases.super_librairie_valide = {
    ok, err, total: cmdIds.length,
    livres_total_valides,
    latency_total_ms: Date.now() - t0,
    errors: errDetails,
  };
  console.log(`  Super-librairie valide: ${ok} OK / ${err} err / ${livres_total_valides} livres validés`);
}

// ===========================================================================
// PHASE 9b — Admin déclenche /packages/build-all après validations
// ===========================================================================
async function phaseBuildPaquetsPostValidation(users, jwts) {
  const admin = users.find(u => u.role === 'admin');
  if (!admin) { log.phases.build_paquets_post = { skipped: 'aucun admin' }; return; }
  const t0 = Date.now();
  const r = await client(jwts[admin.id]).post('/api/bourse-livre/v2/packages/build-all', {});
  log.phases.build_paquets_post = {
    status: r.status,
    latency_ms: Date.now() - t0,
    packages_crees: r.data?.packages_crees ?? 0,
    sample: Array.isArray(r.data?.packages) ? r.data.packages.slice(0, 3) : null,
  };
  console.log(`  /packages/build-all (admin) : status=${r.status}, packages créés=${r.data?.packages_crees ?? 0}`);
}

// ===========================================================================
// PHASE 9c — Observation des chaînes de livraison (cœur du test)
// ===========================================================================
async function phaseObserveDeliveryChains(users, jwts) {
  const pool = getPool();
  const chainesR = await pool.query(`SELECT COUNT(*)::int AS n FROM chaines_livraison_unifiees`);
  const paquetsR = await pool.query(`SELECT COUNT(*)::int AS n FROM book_delivery_packages`);
  const commandesValidR = await pool.query(`SELECT statut, COUNT(*)::int AS n FROM commandes_mixtes GROUP BY statut ORDER BY 2 DESC`);
  const livresValidR = await pool.query(`SELECT statut_validation, COUNT(*)::int AS n FROM commande_livres_neufs GROUP BY statut_validation`);
  const librairies = loadJson('librairies.json');
  const superLibUserId = Object.keys(librairies).find(uid => librairies[uid].est_super);
  let routes = null;
  if (superLibUserId) {
    const r = await client(jwts[superLibUserId]).get('/api/librairie-network/super-librairie/delivery-routes');
    routes = { status: r.status, n_routes: r.data?.routes?.length ?? 0, sample: (r.data?.routes ?? []).slice(0, 2) };
  }
  log.phases.observe_delivery_chains = {
    chaines_livraison_db: chainesR.rows[0].n,
    book_delivery_packages_db: paquetsR.rows[0].n,
    commandes_par_statut: commandesValidR.rows,
    livres_neufs_par_statut: livresValidR.rows,
    delivery_routes: routes,
  };
  console.log(`  Chaînes livraison DB : ${chainesR.rows[0].n}`);
  console.log(`  Paquets DB : ${paquetsR.rows[0].n}`);
  console.log(`  Statuts commandes : ${commandesValidR.rows.map(r => `${r.statut}=${r.n}`).join(', ')}`);
  console.log(`  Statuts livres neufs : ${livresValidR.rows.map(r => `${r.statut_validation}=${r.n}`).join(', ')}`);
  if (routes) console.log(`  /delivery-routes : status=${routes.status}, ${routes.n_routes} routes`);
}

// ===========================================================================
// PHASE 10 — Wholesale Order (super-librairie sim)
// ===========================================================================
// ===========================================================================
// PHASE 11a — Sim 15 : ensure courier rows active (le seed crée
// partnerType='coursier' mais pas les rows dans la table `couriers`).
// Sans `couriers.status='active'`, mon endpoint assign-courier refusera tout.
// Idempotent (ON CONFLICT DO NOTHING).
// ===========================================================================
async function phaseEnsureCouriersActive(users) {
  const pool = getPool();
  const coursierUsers = users.filter(u => u.role === 'partenaire' && (u.partner_type === 'coursier' || u.partnerType === 'coursier'));
  if (coursierUsers.length === 0) {
    log.phases.couriers_active = { skipped: 'aucun coursier seed' };
    return;
  }
  let ok = 0;
  for (const u of coursierUsers) {
    try {
      await pool.query(
        `INSERT INTO couriers (user_id, status, rating_average, rating_count, hired_at)
         VALUES ($1, 'active', 4.5, 10, NOW())
         ON CONFLICT (user_id) DO UPDATE SET status = 'active'`,
        [u.id],
      );
      ok++;
    } catch (_) { /* swallow */ }
  }
  log.phases.couriers_active = { total: coursierUsers.length, activated: ok };
  console.log(`  Coursiers actifs seed : ${ok}/${coursierUsers.length}`);
}

// ===========================================================================
// PHASE 11b — Sim 15 : Yukpo Lib marque rupture grossiste sur sample
// (5 commandes × 2 livres chacune). Test POST /super-librairie/marquer-rupture-articles.
// ===========================================================================
async function phaseRuptureGrossiste(jwts) {
  const pool = getPool();
  const librairies = loadJson('librairies.json');
  const superLibUserIdStr = Object.keys(librairies).find(uid => librairies[uid].est_super);
  if (!superLibUserIdStr) {
    log.phases.rupture_grossiste = { skipped: 'pas de super-lib' };
    return;
  }
  const jwt = jwts[parseInt(superLibUserIdStr, 10)];
  if (!jwt) {
    log.phases.rupture_grossiste = { skipped: 'pas de JWT super-lib' };
    return;
  }

  // Sample : 5 commandes validee_complete + leurs 2 premiers livres valide chacune.
  const r = await pool.query(`
    SELECT cln.id AS livre_id, cln.commande_id
    FROM commande_livres_neufs cln
    JOIN commandes_mixtes cm ON cm.id = cln.commande_id
    WHERE cln.statut_validation = 'valide'
      AND cm.statut IN ('validee_complete', 'validee_partielle')
    ORDER BY cm.created_at ASC, cln.created_at ASC
    LIMIT 10
  `);
  if (r.rows.length === 0) {
    log.phases.rupture_grossiste = { skipped: 'aucun livre valide a marquer' };
    return;
  }
  const ruptures = r.rows.map(row => ({
    commande_id: row.commande_id,
    livre_neuf_id: row.livre_id,
    motif: 'rupture_grossiste',
  }));

  try {
    const resp = await client(jwt).post(
      '/api/librairie-network/super-librairie/marquer-rupture-articles',
      { ruptures },
    );
    log.phases.rupture_grossiste = {
      status: resp.status, marked: resp.data?.marked, skipped: resp.data?.skipped,
      total_attempted: ruptures.length,
    };
    console.log(`  Rupture grossiste : ${resp.data?.marked} marqués / ${ruptures.length} tentés`);
  } catch (e) {
    log.phases.rupture_grossiste = { error: e.message, status: e.response?.status };
    console.log(`  ❌ Rupture grossiste : ${e.message}`);
  }
}

// ===========================================================================
// PHASE 11c — Sim 15 : libérer les articles rupture_grossiste aux
// libraires_proches (POST /super-librairie/liberer-articles).
// ===========================================================================
async function phaseLibererArticles(jwts) {
  const pool = getPool();
  const librairies = loadJson('librairies.json');
  const superLibUserIdStr = Object.keys(librairies).find(uid => librairies[uid].est_super);
  if (!superLibUserIdStr) { log.phases.liberer_articles = { skipped: 'no super-lib' }; return; }
  const jwt = jwts[parseInt(superLibUserIdStr, 10)];
  if (!jwt) { log.phases.liberer_articles = { skipped: 'no jwt' }; return; }

  const r = await pool.query(`
    SELECT id FROM commande_livres_neufs
    WHERE statut_validation = 'rupture_grossiste'
    LIMIT 20
  `);
  if (r.rows.length === 0) {
    log.phases.liberer_articles = { skipped: 'aucun livre rupture' };
    return;
  }
  const livre_neuf_ids = r.rows.map(x => x.id);
  try {
    const resp = await client(jwt).post(
      '/api/librairie-network/super-librairie/liberer-articles',
      { livre_neuf_ids, rayon_km: 50, duree_heures: 48 },
    );
    log.phases.liberer_articles = {
      status: resp.status,
      libere_count: resp.data?.libere_count,
      skipped: resp.data?.skipped,
      libraires_notifies: resp.data?.libraires_notifies,
      total_attempted: livre_neuf_ids.length,
    };
    console.log(`  Libération : ${resp.data?.libere_count} libérés, ${resp.data?.libraires_notifies} libraires notifiés`);
  } catch (e) {
    log.phases.liberer_articles = { error: e.message, status: e.response?.status };
    console.log(`  ❌ Libération : ${e.message}`);
  }
}

// ===========================================================================
// PHASE 11d — Sim 15 : test GET /packages/unassigned + assign-courier sur 10
// ===========================================================================
async function phaseAssignCourier(users, jwts) {
  const pool = getPool();
  const admin = users.find(u => u.role === 'admin');
  if (!admin) { log.phases.assign_courier = { skipped: 'no admin' }; return; }
  const jwt = jwts[admin.id];
  if (!jwt) { log.phases.assign_courier = { skipped: 'no admin jwt' }; return; }

  // 1. GET liste unassigned
  let unassigned = [];
  try {
    const r = await client(jwt).get('/api/bourse-livre/v2/packages/unassigned?limit=20');
    unassigned = r.data?.packages ?? [];
  } catch (e) {
    log.phases.assign_courier = { error_list: e.message };
    console.log(`  ❌ GET unassigned : ${e.message}`);
    return;
  }
  if (unassigned.length === 0) {
    log.phases.assign_courier = { skipped: 'aucun paquet unassigned' };
    return;
  }

  // 2. Sélectionner coursiers actifs
  const coursiers = users.filter(u => u.role === 'partenaire' && (u.partner_type === 'coursier' || u.partnerType === 'coursier'));
  if (coursiers.length === 0) {
    log.phases.assign_courier = { skipped: 'aucun coursier' };
    return;
  }

  // 3. Assigner 10 paquets (round-robin coursiers)
  let ok = 0, err = 0;
  const errDetails = {};
  const sample = unassigned.slice(0, 10);
  for (let i = 0; i < sample.length; i++) {
    const pkg = sample[i];
    const c = coursiers[i % coursiers.length];
    try {
      const r = await client(jwt).post(
        `/api/bourse-livre/v2/packages/${pkg.id}/assign-courier`,
        { coursier_user_id: c.id },
      );
      if (r.status >= 200 && r.status < 300) ok++;
      else { err++; trackErr(errDetails, r.status, r.data); }
    } catch (e) {
      err++;
      trackErr(errDetails, e.response?.status || e.code, e.response?.data || e.message);
    }
  }
  log.phases.assign_courier = {
    unassigned_listed: unassigned.length,
    attempted: sample.length,
    ok, err,
    errors: errDetails,
  };
  console.log(`  Assignation coursier : ${ok} OK / ${err} err (sur ${sample.length}, ${unassigned.length} unassigned au total)`);
}

// ===========================================================================
// PHASE 11e — Sim 15 : un parent refuse 1 livre à la réception
// ===========================================================================
async function phaseParentRefuse(jwts) {
  const pool = getPool();
  // Trouver un paquet `constitue` avec coursier assigné et son destinataire
  const r = await pool.query(`
    SELECT bdp.id AS pkg_id, bdp.destinataire_id, bdp.livres
    FROM book_delivery_packages bdp
    WHERE bdp.statut = 'constitue'
      AND bdp.coursier_id IS NOT NULL
      AND bdp.nombre_livres >= 2  -- au moins 2 livres pour pouvoir refuser un sans vider le paquet
    LIMIT 3
  `);
  if (r.rows.length === 0) {
    log.phases.parent_refuse = { skipped: 'aucun paquet avec coursier' };
    return;
  }

  let ok = 0, err = 0;
  for (const row of r.rows) {
    const parentJwt = jwts[row.destinataire_id];
    if (!parentJwt) { err++; continue; }
    const livres = row.livres ?? [];
    const livre = livres.find(l => l.commande_livre_neuf_id);
    if (!livre) { err++; continue; }
    try {
      const resp = await client(parentJwt).post(
        `/api/bourse-livre/v2/packages/${row.pkg_id}/parent-refuse-article`,
        { commande_livre_neuf_id: livre.commande_livre_neuf_id, motif: 'mauvaise_edition' },
      );
      if (resp.status >= 200 && resp.status < 300) ok++;
      else err++;
    } catch (_) { err++; }
  }
  log.phases.parent_refuse = { attempted: r.rows.length, ok, err };
  console.log(`  Refus parent : ${ok} OK / ${err} err (sur ${r.rows.length} paquets)`);
}

// ===========================================================================
// PHASE 11f — Sim 15 : snapshot final DB
// ===========================================================================
async function phaseSim15Snapshot() {
  const pool = getPool();
  const queries = {
    livres_par_statut: `SELECT statut_validation::text AS s, COUNT(*) FROM commande_livres_neufs GROUP BY s ORDER BY s`,
    paquets_par_statut: `SELECT statut::text AS s, COUNT(*) AS c, SUM(nombre_livres) AS n_livres FROM book_delivery_packages GROUP BY s`,
    paquets_assignes: `SELECT COUNT(*) AS assigned, COUNT(*) FILTER (WHERE coursier_id IS NULL) AS unassigned FROM book_delivery_packages WHERE statut = 'constitue'`,
    validations_actives: `SELECT statut::text AS s, COUNT(*) AS c, COUNT(*) FILTER (WHERE expire_at IS NOT NULL) AS avec_expire FROM commande_validations GROUP BY s`,
  };
  const snap = {};
  for (const [name, sql] of Object.entries(queries)) {
    try {
      const r = await pool.query(sql);
      snap[name] = r.rows;
    } catch (e) { snap[name] = { error: e.message }; }
  }
  log.phases.sim15_snapshot = snap;
  console.log('  Snapshot sim15 :');
  console.log('    livres_par_statut :', JSON.stringify(snap.livres_par_statut));
  console.log('    paquets_par_statut :', JSON.stringify(snap.paquets_par_statut));
  console.log('    paquets_assignes  :', JSON.stringify(snap.paquets_assignes));
}

async function phaseWholesaleOrder(users, jwts) {
  const librairies = loadJson('librairies.json');
  const superLibUserId = Object.keys(librairies).find(uid => librairies[uid].est_super);
  if (!superLibUserId) { console.warn('  Aucune super-librairie sim'); return; }
  const jwt = jwts[superLibUserId];
  const t0 = Date.now();
  const r = await client(jwt).get('/api/librairie-network/super-librairie/wholesale-order');
  // Backend peut renvoyer {sections:{manuels:[...]}} OU {sections:{manuels:{nombre:N,...}}}, ou erreur — défensif.
  const arr = (v) => Array.isArray(v) ? v : [];
  const len = (v) => Array.isArray(v) ? v.length : (typeof v === 'number' ? v : (v?.nombre ?? v?.length ?? 0));
  log.phases.wholesale_order = {
    status: r.status,
    latency_ms: Date.now() - t0,
    total_articles: r.data?.total_articles,
    total_valeur: r.data?.total_valeur_estimee,
    sections: {
      manuels:     len(r.data?.sections?.manuels),
      cahiers:     len(r.data?.sections?.cahiers),
      fournitures: len(r.data?.sections?.fournitures),
    },
    sample_manuels: arr(r.data?.sections?.manuels).slice(0, 5),
    error_body: (r.status >= 400) ? (typeof r.data === 'string' ? r.data.slice(0, 400) : JSON.stringify(r.data).slice(0, 400)) : undefined,
  };
  console.log(`  WHOLESALE-ORDER: status=${r.status}, ${log.phases.wholesale_order.sections.manuels} manuels / ${log.phases.wholesale_order.sections.cahiers} cahiers / ${log.phases.wholesale_order.sections.fournitures} fournitures`);
}

// ===========================================================================
// PHASE 11 — Delivery Routes (super-librairie)
// ===========================================================================
async function phaseDeliveryRoutes(jwts) {
  const librairies = loadJson('librairies.json');
  const superUid = Object.keys(librairies).find(uid => librairies[uid].est_super);
  if (!superUid) return;
  const r = await client(jwts[superUid]).get('/api/librairie-network/super-librairie/delivery-routes?bucket_km=2.0');
  log.phases.delivery_routes = {
    status: r.status,
    n_routes: Array.isArray(r.data) ? r.data.length : (r.data?.routes?.length ?? 0),
    sample: Array.isArray(r.data) ? r.data.slice(0, 3) : r.data,
  };
  console.log(`  Delivery routes: status=${r.status}, ${log.phases.delivery_routes.n_routes} routes`);
}

// ===========================================================================
// PHASE 12 — Parents Contacts
// ===========================================================================
async function phaseParentsContacts(jwts) {
  const librairies = loadJson('librairies.json');
  const superUid = Object.keys(librairies).find(uid => librairies[uid].est_super);
  if (!superUid) return;
  const r = await client(jwts[superUid]).get('/api/librairie-network/super-librairie/parents-contacts?limit=500');
  log.phases.parents_contacts = {
    status: r.status,
    n_contacts: Array.isArray(r.data) ? r.data.length : (r.data?.contacts?.length ?? 0),
  };
  console.log(`  Parents contacts: status=${r.status}, ${log.phases.parents_contacts.n_contacts} contacts`);
}

// ===========================================================================
// PHASE 13 — Admin Statistiques
// ===========================================================================
async function phaseAdminStats(users, jwts) {
  const admin = users.find(u => u.role === 'admin');
  if (!admin) return;
  const r = await client(jwts[admin.id]).get('/api/librairie-network/admin/statistiques?periode=mois');
  log.phases.admin_stats = { status: r.status, body: r.data };
  console.log(`  Admin stats: status=${r.status}`);
}

// ===========================================================================
// PHASE 14 — Parrainage
// ===========================================================================
async function phaseParrainage(users, jwts) {
  const pool = getPool();
  const r0 = await pool.query(`SELECT DISTINCT parrain_id FROM referrals WHERE status = 'pending' LIMIT 40`);
  let observed = 0, totalBonus = 0;
  for (const row of r0.rows) {
    const u = users.find(u => u.id === row.parrain_id);
    if (!u) continue;
    const r = await client(jwts[u.id]).get('/api/referral/me');
    if (r.status === 200) { observed++; totalBonus += (r.data?.total_bonus_xaf ?? 0); }
  }
  log.phases.parrainage = { observed_parrains: observed, total_bonus_xaf: totalBonus };
  console.log(`  Parrainage: ${observed} parrains, bonus total ${totalBonus} XAF`);
}

// ===========================================================================
// MAIN
// ===========================================================================
async function safe(name, fn) {
  try { return await fn(); }
  catch (e) {
    const msg = e?.code || e?.message || String(e);
    console.error(`  ❌ phase "${name}" crashée : ${msg}`);
    log.phases[name] = { ...(log.phases[name] ?? {}), crashed: msg };
    return undefined;
  }
}

async function main() {
  const users = loadJson('users.json');
  const jwts = loadJson('jwts.json');
  console.log(`▶️  Orchestrate V2 sur ${API} — ${users.length} users`);
  let commandes = [];
  let chains = [];

  try {
    await phaseHealth();
    console.log('— Phase Demandes —');               await safe('demandes',        () => phaseSeedDemandes(users));
    console.log('— Phase Matching —');               chains = await safe('matching', () => phaseMatching(users, jwts)) ?? [];
    console.log('— Phase Création chaînes —');       await safe('create_chaines',  () => phaseCreateChaines(chains, jwts));
    console.log('— Phase Build Packages —');         await safe('build_packages',  () => phaseBuildPackages(users, jwts));
    console.log('— Phase Optimized Routes —');       await safe('optimized_routes',() => phaseOptimizedRoutes(users, jwts));
    console.log('— Phase Cycle Livraison —');        await safe('package_delivery',() => phasePackageDelivery(users, jwts));
    console.log('— Phase Commandes Mixtes —');       commandes = await safe('commandes_mixtes', () => phaseCommandesMixtes(users, jwts)) ?? [];
    console.log('— Phase Broadcast —');              await safe('broadcast',       () => phaseBroadcastCommandes(commandes, jwts));
    console.log('— Phase Validation compétitive —'); await safe('validation',      () => phaseValidationLibraires(commandes, users, jwts));
    console.log('— Phase Super-Librairie valide —'); await safe('super_librairie_valide', () => phaseSuperLibrairieValide(commandes, jwts, users));
    console.log('— Phase Build Paquets (post-validation) —'); await safe('build_paquets_post', () => phaseBuildPaquetsPostValidation(users, jwts));
    console.log('— Phase Observe Delivery Chains —'); await safe('observe_delivery_chains', () => phaseObserveDeliveryChains(users, jwts));
    // ✅ Sim 15 — phases MVP1/MVP2/MVP3
    console.log('— Phase Coursiers Active (seed couriers row) —'); await safe('couriers_active', () => phaseEnsureCouriersActive(users));
    console.log('— Phase Rupture Grossiste (YL marque batch) —'); await safe('rupture_grossiste', () => phaseRuptureGrossiste(jwts));
    console.log('— Phase Liberer Articles (YL → libraires_proches 48h) —'); await safe('liberer_articles', () => phaseLibererArticles(jwts));
    console.log('— Phase Assign Courier (YL/admin → coursier) —'); await safe('assign_courier', () => phaseAssignCourier(users, jwts));
    console.log('— Phase Parent Refuse Article (refus livraison) —'); await safe('parent_refuse', () => phaseParentRefuse(jwts));
    console.log('— Phase Sim15 Snapshot final —'); await safe('sim15_snapshot', () => phaseSim15Snapshot());
    console.log('— Phase Wholesale Order —');        await safe('wholesale_order', () => phaseWholesaleOrder(users, jwts));
    console.log('— Phase Delivery Routes —');        await safe('delivery_routes', () => phaseDeliveryRoutes(jwts));
    console.log('— Phase Parents Contacts —');       await safe('parents_contacts',() => phaseParentsContacts(jwts));
    console.log('— Phase Admin Stats —');            await safe('admin_stats',     () => phaseAdminStats(users, jwts));
    console.log('— Phase Parrainage —');             await safe('parrainage',      () => phaseParrainage(users, jwts));
  } finally {
    log.endedAt = new Date().toISOString();
    fs.writeFileSync(join(__dirname, 'sim-run.json'), JSON.stringify(log, null, 2));
    console.log('\n✅ Orchestrate V2 terminé — sim-run.json écrit');
    await closePool();
  }
}

main().catch(async (e) => { console.error('❌', e); await closePool(); process.exit(1); });
