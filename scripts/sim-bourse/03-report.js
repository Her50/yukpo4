// =============================================================================
// 03-report.js V2 — Exécute report-queries.sql + croise avec sim-run.json
// pour générer RAPPORT_SIMULATION_BOURSE.md
// =============================================================================

import 'dotenv/config';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getPool, closePool } from './lib/db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const LABELS = [
  'matching_coverage',         // Q1
  'mode_listing',              // Q2
  'concentration_villes',      // Q3
  'trocs_chaines',             // Q4
  'packages_par_statut',       // Q5
  'achats_simples',            // Q6
  'parrainage',                // Q7
  'wallet_credit_outstanding', // Q8
  'commandes_mixtes',          // Q9
  'wholesale_top20',           // Q10
  'validation_libraire',       // Q11
  'paiements_agreges',         // Q12
  'top_vendeurs_occasion',     // Q13
  'performance_libraires',     // Q14
  'chaines_livraison',         // Q15
];

function splitQueries(raw) {
  // Découpe sur "-- Query N : <titre>\n" et consomme toute la ligne du commentaire-titre.
  const blocks = raw.split(/-- Query \d+\s*:[^\n]*\n/g).slice(1);
  // Chaque block contient la query jusqu'au prochain ";" + éventuels commentaires de fin.
  return blocks.map(b => b.trim().replace(/;\s*$/, '').trim());
}

async function runAll() {
  const pool = getPool();
  const sql = fs.readFileSync(join(__dirname, 'sql/report-queries.sql'), 'utf8');
  const queries = splitQueries(sql);
  const out = {};
  for (let i = 0; i < queries.length; i++) {
    try { const r = await pool.query(queries[i]); out[LABELS[i]] = r.rows; }
    catch (e) { out[LABELS[i]] = { error: e.message }; }
  }
  return out;
}

function fmtTable(rows) {
  if (!rows) return '_(aucune donnée)_';
  if (rows.error) return `\`\`\`\nERREUR : ${rows.error}\n\`\`\``;
  if (rows.length === 0) return '_(aucune ligne)_';
  const cols = Object.keys(rows[0]);
  const sep = cols.map(() => '---').join(' | ');
  const body = rows.map(r => `| ${cols.map(c => {
    const v = r[c];
    if (v === null || v === undefined) return '';
    if (typeof v === 'number') return v.toLocaleString();
    return String(v).replace(/\|/g, '\\|');
  }).join(' | ')} |`).join('\n');
  return `| ${cols.join(' | ')} |\n| ${sep} |\n${body}`;
}

function build(stats, run) {
  const cov = stats.matching_coverage?.[0] ?? {};
  const trocs = stats.trocs_chaines?.[0] ?? {};
  const achats = stats.achats_simples?.[0] ?? {};
  const par = stats.parrainage?.[0] ?? {};
  const wallet = stats.wallet_credit_outstanding?.[0] ?? {};
  const validation = stats.validation_libraire?.[0] ?? {};
  const ph = run?.phases ?? {};
  const wo = ph.wholesale_order ?? {};

  const orph = (cov.total_livres ?? 0) - (cov.matched ?? 0) - (cov.chained ?? 0) - (cov.delivered ?? 0);
  const tauxMatch = cov.total_livres ? (((cov.matched ?? 0) + (cov.chained ?? 0)) / cov.total_livres * 100).toFixed(1) : 'N/A';

  // Bilan financier — protège contre les query errors (objet {error} au lieu d'array)
  const arr = (v) => Array.isArray(v) ? v : [];
  const caAchats = parseFloat(achats.ca_brut_xaf ?? 0);
  const commAchats = parseFloat(achats.commissions_xaf ?? 0);
  const caMixtes = arr(stats.commandes_mixtes).reduce((s, r) => s + parseFloat(r.budget_total_xaf ?? 0), 0);
  const commMixtes = arr(stats.commandes_mixtes).reduce((s, r) => s + parseFloat(r.commission_app_xaf ?? 0), 0);
  const walletOut = parseFloat(wallet.total_credit_outstanding_xaf ?? 0);
  const totalCA = caAchats + caMixtes;
  const totalComm = commAchats + commMixtes;
  const revenuNet = totalComm - walletOut;

  return `# Rapport de simulation — Bourse du Livre Yukpo (V2)

**Date** : ${new Date().toISOString()}
**Endpoint** : ${run?.api ?? 'N/A'}
**Échelle** : ${cov.total_livres ?? 0} livres scolaires troc/vente, ${ph.matching?.ok ?? 0} parents au matching, ${ph.commandes_mixtes?.ok ?? 0} commandes mixtes créées

---

## 1. TROC LIVRES — Matching & Chaînes

- Livres simulés : **${cov.total_livres ?? 0}**
- État final livres : pending **${cov.pending ?? 0}**, matched ${cov.matched ?? 0}, chained ${cov.chained ?? 0}, delivered ${cov.delivered ?? 0}
- Livres orphelins : **${orph}** (${cov.total_livres ? (orph / cov.total_livres * 100).toFixed(1) : 'N/A'} %)
- Taux matching effectif : **${tauxMatch} %**
- **Chaînes IA proposées** (matching) : ${ph.matching?.chaines_proposed ?? 0}
- **Chaînes uniques créées** (/troc-livres/chaine) : ${ph.create_chaines?.created_ok ?? 0} OK / ${ph.create_chaines?.errors ?? 0} err sur ${ph.create_chaines?.unique ?? 0} uniques
- Trocs total en base : **${trocs.trocs_total ?? 0}**
- Chaînes total en base : **${trocs.chaines_total ?? 0}** (taille moyenne ${parseFloat(trocs.taille_moyenne_chaine ?? 0).toFixed(2)})
- Chaînes complétées : ${trocs.chaines_completees ?? 0}

### Répartition mode listing
${fmtTable(stats.mode_listing)}

### Concentration géographique
${fmtTable(stats.concentration_villes)}

---

## 2. PAQUETS COURSIER & LIVRAISON

- Endpoint /packages/build-all : status **${ph.build_packages?.status ?? 'N/A'}**
- Endpoint /packages/optimized-route : status **${ph.optimized_routes?.status ?? 'N/A'}** sur ${ph.optimized_routes?.n_packages ?? 0} paquets
- Cycle livraison (constitue→en_route→livre→confirme) : **${ph.package_delivery?.transitions_ok ?? 0}** transitions OK / ${ph.package_delivery?.errors ?? 0} err sur ${ph.package_delivery?.n_packages ?? 0} paquets

### Paquets par statut
${fmtTable(stats.packages_par_statut)}

### Chaînes livraison unifiées (librairie_network)
${fmtTable(stats.chaines_livraison)}

---

## 3. COMMANDES MIXTES (librairie_network) — Le vrai flux production

- Commandes mixtes créées via API : **${ph.commandes_mixtes?.ok ?? 0}** OK / ${ph.commandes_mixtes?.err ?? 0} err
- Broadcast aux libraires : **${ph.broadcast?.ok ?? 0}** OK / ${ph.broadcast?.err ?? 0} err
- Validation compétitive libraires : **${ph.validation?.ok ?? 0}** verrous obtenus / ${ph.validation?.simultane_winners_anomalies ?? 0} anomalies de verrou simultané

### Commandes mixtes par statut
${fmtTable(stats.commandes_mixtes)}

### Stats validation libraire
${fmtTable([stats.validation_libraire?.[0]].filter(Boolean))}

### Performance libraires (TOP 15)
${fmtTable(stats.performance_libraires)}

---

## 4. BON DE COMMANDE GROSSISTE (super-librairie)

- Endpoint **GET /super-librairie/wholesale-order** : status **${wo.status ?? 'N/A'}**, latence ${wo.latency_ms ?? 'N/A'} ms
- Total articles agrégés : **${wo.total_articles ?? 'N/A'}**
- Valeur totale estimée : **${wo.total_valeur ?? 'N/A'} XAF**
- Sections : **${wo.sections?.manuels ?? 0}** manuels / **${wo.sections?.cahiers ?? 0}** cahiers / **${wo.sections?.fournitures ?? 0}** fournitures

### Top 20 articles à commander (vue SQL)
${fmtTable(stats.wholesale_top20)}

---

## 5. ROUTES COURSIER & CONTACTS PARENTS (super-librairie)

- /super-librairie/delivery-routes : status **${ph.delivery_routes?.status ?? 'N/A'}**, ${ph.delivery_routes?.n_routes ?? 0} routes clusterisées (bucket 2 km)
- /super-librairie/parents-contacts : status **${ph.parents_contacts?.status ?? 'N/A'}**, ${ph.parents_contacts?.n_contacts ?? 0} contacts agrégés

---

## 6. PAIEMENTS AGRÉGÉS

${fmtTable(stats.paiements_agreges)}

---

## 7. PARRAINAGE

- Referrals total : **${par.referrals_total ?? 0}**
- Convertis : ${par.referrals_convertis ?? 0}
- Bonus crédités : ${parseFloat(par.bonus_credites_xaf ?? 0).toLocaleString()} XAF
- Parrains observés via GET /api/referral/me : ${ph.parrainage?.observed_parrains ?? 0} (total visible ${ph.parrainage?.total_bonus_xaf ?? 0} XAF)

---

## 8. BILAN FINANCIER

| Ligne | XAF |
|---|---|
| CA brut achats simples (/api/bourse-livre/v2/purchases) | ${caAchats.toLocaleString()} |
| CA brut commandes mixtes (/api/librairie-network/commandes) | ${caMixtes.toLocaleString()} |
| **CA total** | **${totalCA.toLocaleString()}** |
| Commissions Yukpo achats simples | ${commAchats.toLocaleString()} |
| Commissions Yukpo commandes mixtes | ${commMixtes.toLocaleString()} |
| **Commissions totales** | **${totalComm.toLocaleString()}** |
| Wallet outstanding (dette utilisateurs) | ${walletOut.toLocaleString()} |
| **Revenu net estimé** | **${revenuNet.toLocaleString()}** |

### Top 10 vendeurs occasion
${fmtTable(stats.top_vendeurs_occasion)}

---

## 9. AUDIT ENDPOINTS & ANOMALIES

${[
  ph.health?.status >= 400               && `- 🔴 /health = ${ph.health.status}`,
  ph.matching?.err > 0                   && `- ⚠️ ${ph.matching.err} échecs /troc-livres/match-all-pending sur ${ph.matching.ok + ph.matching.err}`,
  ph.create_chaines?.errors > 0          && `- ⚠️ ${ph.create_chaines.errors} échecs /troc-livres/chaine sur ${ph.create_chaines.unique}`,
  ph.build_packages?.status >= 400       && `- ⚠️ /packages/build-all = ${ph.build_packages.status}`,
  ph.optimized_routes?.status >= 400     && `- ⚠️ /packages/optimized-route = ${ph.optimized_routes.status}`,
  ph.package_delivery?.errors > 0        && `- ⚠️ ${ph.package_delivery.errors} transitions paquet refusées`,
  ph.commandes_mixtes?.err > 0           && `- ⚠️ ${ph.commandes_mixtes.err} échecs création commande mixte`,
  ph.broadcast?.err > 0                  && `- ⚠️ ${ph.broadcast.err} échecs broadcast`,
  ph.validation?.simultane_winners_anomalies > 0 && `- 🔴 ${ph.validation.simultane_winners_anomalies} anomalies de verrou exclusif (multiple winners sur même commande)`,
  ph.wholesale_order?.status >= 400      && `- ⚠️ /wholesale-order = ${ph.wholesale_order.status}`,
  ph.delivery_routes?.status >= 400      && `- ⚠️ /delivery-routes = ${ph.delivery_routes.status}`,
  ph.admin_stats?.status >= 400          && `- ⚠️ /admin/statistiques = ${ph.admin_stats.status}`,
  ph.demandes?.skipped                   && `- ℹ️ Demandes occasion : ${typeof ph.demandes.skipped === 'string' ? ph.demandes.skipped : 'skip'}`,
  '- ℹ️ Scan IA recto-verso court-circuité par INSERT SQL (étape unique simulée hors endpoint réel)',
].filter(Boolean).join('\n')}

---

## 10. ANNEXE — Latences endpoints clés

| Endpoint | Latence (ms) | Status |
|---|---|---|
| GET /health | ${ph.health?.latency_ms ?? 'N/A'} | ${ph.health?.status ?? 'N/A'} |
| POST /troc-livres/match-all-pending (total) | ${ph.matching?.latency_total_ms ?? 'N/A'} | ${ph.matching?.ok ?? 0} OK |
| GET /wholesale-order | ${ph.wholesale_order?.latency_ms ?? 'N/A'} | ${ph.wholesale_order?.status ?? 'N/A'} |
| POST /packages/build-all | ${ph.build_packages?.latency_ms ?? 'N/A'} | ${ph.build_packages?.status ?? 'N/A'} |
`;
}

async function main() {
  console.log('▶️  Rapport — exécution agrégats…');
  const stats = await runAll();
  let run = {};
  try { run = JSON.parse(fs.readFileSync(join(__dirname, 'sim-run.json'), 'utf8')); }
  catch { console.warn('  ⚠️  sim-run.json absent — rapport partiel'); }

  const md = build(stats, run);
  const outPath = join(__dirname, '..', '..', 'RAPPORT_SIMULATION_BOURSE.md');
  fs.writeFileSync(outPath, md);
  console.log(`✅ Rapport écrit : ${outPath}`);
  await closePool();
}

main().catch((e) => { console.error('❌', e); process.exit(1); });
