# Simulation end-to-end — Système Bourse du Livre Yukpo

Pipeline complet de test du système Bourse du Livre (troc + vente occasion + commandes neufs + matching + chaînes + paquets coursier + parrainage + wallet) via les **endpoints HTTP réels** du backend Axum déployé sur l'app Fly de staging dédiée `yukpo-bourse-sim`.

## Architecture

```
yukpo-bourse-sim-db (Fly Postgres, fork point-in-time de yukpo-fly-postgres)
   └── DB "yukpo_db" (clone schéma + référentiel programmes_scolaires)

yukpo-bourse-sim (Fly app Axum)
   └── pointe sur yukpo_db via DATABASE_URL surchargé
   └── JWT_SECRET dédié (différent prod)
   └── SMS_PROVIDER=stub (aucun appel Twilio)
```

## Court-circuit assumé

**Seule étape non testée via endpoint réel** : le scan recto-verso `/api/bourse-livre/v2/analyse-recto-verso` (coûteux IA × dizaines de milliers). Remplacé par INSERT SQL direct dans `livres_scolaires` avec titres tirés du référentiel officiel `programmes_scolaires`.

Toutes les autres étapes (matching, chaînes, paquets, commandes, parrainage, wallet, treasury) passent par **les vraies routes HTTP**.

## Échelle par défaut (pilote V1)

| Métrique | Valeur |
| --- | --- |
| Users | 200 (160 parents + 20 libraires + 10 coursiers + 10 admins) |
| Livres troc/vente/don | 1 000 (70/25/5%) |
| Demandes occasion | 500 |
| Commandes neufs/fournitures | 1 000 |
| Parrainages | 30 % des parents |
| Distribution villes | Douala 40% / Yaoundé 35% / Bafoussam 15% / autres 10% |

Modifiable via `.env` (cf. `.env.example`).

## Pré-requis

- Node.js 20+
- `npm install` dans ce dossier
- `flyctl` authentifié (`fly auth whoami`)
- Accès en lecture à `yukpo-bourse-sim-db` via tunnel : `fly proxy 15432:5432 -a yukpo-bourse-sim-db`
- `.env` créé à partir de `.env.example`

## Pipeline

```
0. Setup staging (Phase 0)             [hors scripts — voir runbook]
1. Purge données réelles du clone       sql/purge-prod-data.sql
2. Seed users + livres + demandes       node 01-seed.js  → sim-users.json
3. Orchestrate endpoints réels          node 02-orchestrate.js → sim-run.json
4. Rapport bilan                        node 03-report.js → RAPPORT_SIMULATION_BOURSE.md
5. Cleanup (sim → 0)                    node 04-cleanup.js
6. Destroy staging Fly (optionnel)      voir runbook
```

## Runbook complet

### Phase 0 — Setup staging (déjà fait si tu lis ce README)

```bash
# Fork de la DB prod (clone point-in-time)
fly postgres create --name yukpo-bourse-sim-db --region cdg \
    --fork-from yukpo-fly-postgres --vm-size shared-cpu-1x \
    --vm-memory 1024 --initial-cluster-size 1 --volume-size 3 --org personal

# Création app staging
fly apps create yukpo-bourse-sim --org personal
fly postgres attach yukpo-bourse-sim-db --app yukpo-bourse-sim --yes

# Owner / GRANT sur la DB clonée yukpo_db (le user d'attach n'y a pas accès par défaut)
fly ssh console -a yukpo-bourse-sim-db -C \
  "env PGPASSWORD=$OPERATOR_PASSWORD psql -h localhost -p 5432 -U postgres -d yukpo_db -c \
     \"ALTER DATABASE yukpo_db OWNER TO yukpo_bourse_sim; \
       GRANT ALL ON SCHEMA public TO yukpo_bourse_sim; \
       GRANT ALL ON ALL TABLES IN SCHEMA public TO yukpo_bourse_sim; \
       GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO yukpo_bourse_sim;\""

# Override DATABASE_URL pour pointer sur yukpo_db (DB clonée, pas yukpo_bourse_sim vide)
JWT=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
fly secrets set --app yukpo-bourse-sim \
    DATABASE_URL="postgres://yukpo_bourse_sim:$(...)@yukpo-bourse-sim-db.flycast:5432/yukpo_db?sslmode=disable" \
    JWT_SECRET="$JWT" SMS_PROVIDER="stub" ENABLE_AUTO_MIGRATIONS="false" APP_ENV="staging-sim"

# Deploy
fly deploy --config backend/fly.staging.toml -a yukpo-bourse-sim --no-cache
```

### Phase 1 — Purge des données réelles du clone

```bash
# Tunnel local
fly proxy 15432:5432 -a yukpo-bourse-sim-db &

# Récupérer le password DB
fly secrets list -a yukpo-bourse-sim    # voir DATABASE_URL → password

# Exporter dans .env (sim-bourse/.env)
DATABASE_URL=postgres://yukpo_bourse_sim:PASS@localhost:15432/yukpo_db

# Purge (garde uniquement programmes_scolaires)
psql "$DATABASE_URL" -f sql/purge-prod-data.sql
```

### Phase 2 — Seed

```bash
npm install
node 01-seed.js
# → sim-users.json (avec JWT forgés HS256)
```

### Phase 3 — Orchestration

```bash
# Vérifier que l'API staging répond
curl https://yukpo-bourse-sim.fly.dev/health

# Exécuter
node 02-orchestrate.js
# → sim-run.json
```

### Phase 4 — Rapport

```bash
node 03-report.js
# → RAPPORT_SIMULATION_BOURSE.md
```

### Phase 5 — Cleanup

```bash
# Cleanup soft : juste les données SIM
node 04-cleanup.js

# OU cleanup hard : destroy app + DB (zéro résiduel facturé)
fly apps destroy yukpo-bourse-sim --yes
fly apps destroy yukpo-bourse-sim-db --yes
```

## Coûts Fly estimés

- Postgres staging : 1 GB RAM, 3 GB disque, 1 machine → ~0.30 $/jour idle, ~0.50 $/jour pendant la sim
- App staging : 1 VM 2 GB idle (auto_stop), pic 3 VM pendant ~30 min → < 0.50 $ par run complet
- **Total estimé pour 1 simulation complète + 24h de garde : ~2 USD**

Détruire la staging dès que terminé pour éviter d'accumuler.

## Limitations connues

1. **Endpoint grossiste/approvisionnement non implémenté** dans le backend actuel — la cartographie initiale §7 a confirmé son absence. Le rapport flaggera ce trou.
2. **Scan IA court-circuité** — décision validée par l'utilisateur (impossible à faire physiquement à 1 k échelle).
3. **Pas de cycle de paiement MoMo réel** — les `book_purchases` sont créés avec `paiement_statut='en_attente'`. Le bilan financier est donc théorique, basé sur les montants déclarés (pas confirmés par flux réel).
4. **Migrations cassées sur DB vierge** — c'est pourquoi on utilise un fork (clone du schéma déjà migré en prod). Ne pas tenter une approche `DB vierge + sqlx::migrate!()` sans avoir fixé d'abord le seed MINESEC Technique (cf. note `feedback_migrations_yukpo`).
