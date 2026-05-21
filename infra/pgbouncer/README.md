# PgBouncer Sidecar pour Yukpo Bourse Sim

PgBouncer en mode **transaction pooling** pour amortir 10k+ requêtes
concurrentes côté backend en ≤ 50 connexions Postgres effectives.

## Architecture

```
Backend (10 VMs × 28 pool = 280 conn vers PgBouncer)
  ↓
PgBouncer (MAX_CLIENT_CONN=10000, DEFAULT_POOL_SIZE=50)
  ↓
Postgres (max_connections=1000, mais ~50 utilisées grâce au pooling)
```

## Déploiement initial (1ère fois)

```bash
# 1. Créer l'app Fly (sans deploy)
fly apps create yukpo-bourse-sim-pgbouncer --org personal

# 2. Allouer une IP privée Fly (pour communication interne backend ↔ pgbouncer)
fly ips allocate-v6 -a yukpo-bourse-sim-pgbouncer --private

# 3. Set secrets (vérifier les bonnes valeurs avant)
fly secrets set -a yukpo-bourse-sim-pgbouncer \
  DB_HOST=yukpo-bourse-sim-db.internal \
  DB_PORT=5432 \
  DB_NAME=yukpo_db \
  DB_USER=yukpo_bourse_sim \
  DB_PASSWORD='<VRAI_MOT_DE_PASSE>'

# 4. Deploy
cd infra/pgbouncer
fly deploy -a yukpo-bourse-sim-pgbouncer --remote-only

# 5. Vérifier health
fly status -a yukpo-bourse-sim-pgbouncer
fly logs -a yukpo-bourse-sim-pgbouncer | head -50
```

## Configurer le backend pour utiliser PgBouncer

Update `backend/fly.staging.toml` :

```toml
[env]
  # Avant : DATABASE_URL pointait directement vers Postgres
  # Maintenant : pointer vers PgBouncer (port 6432, hôte .internal Fly)
  # ATTENTION : il faut aussi mettre DATABASE_URL en secret pour mot de passe
```

Ou via fly secrets (remplacer `MOT_DE_PASSE_FLY_SECRET` par le vrai secret stocké dans Fly secrets) :
```bash
# Format DSN : protocole + utilisateur + secret + hôte + port + base
fly secrets set -a yukpo-bourse-sim \
  DATABASE_URL='postgres+pgbouncer/yukpo_bourse_sim+MOT_DE_PASSE_FLY_SECRET+yukpo-bourse-sim-pgbouncer.internal+6432+yukpo_db'
# (ATTENTION : reformatter selon syntaxe DSN officielle postgres avec : et @)
```

Puis : `fly deploy -a yukpo-bourse-sim`

## Monitoring PgBouncer

PgBouncer expose une **base virtuelle** `pgbouncer` accessible depuis
n'importe quel client Postgres :

```bash
# Tunnel local vers pgbouncer
fly proxy 16432:6432 -a yukpo-bourse-sim-pgbouncer

# Connexion à la base d'administration
PGPASSWORD=<PASS> psql -h localhost -p 16432 -U yukpo_bourse_sim pgbouncer

# Commandes utiles
pgbouncer=# SHOW POOLS;       -- Pool stats (cl_active, cl_waiting, sv_active)
pgbouncer=# SHOW STATS;       -- Stats globales req/s
pgbouncer=# SHOW CLIENTS;     -- Clients connectés
pgbouncer=# SHOW SERVERS;     -- Connexions vers Postgres
pgbouncer=# SHOW DATABASES;   -- DB configurées
```

## Limitations transaction pooling

⚠️ **Incompatibilités à connaître :**
- Pas de `SET LOCAL` persistant entre requêtes (réinitialisé)
- Pas de `LISTEN/NOTIFY` (channels asynchrones perdus)
- Pas de prepared statements named (utiliser PREPARE inline ou désactiver)
- Pas de `WITH HOLD` cursors

Le code Yukpo backend n'utilise PAS ces features (vérifié grep) →
transaction pooling est safe.

## Coût

PgBouncer 256MB RAM + 1 CPU partagé Fly ≈ ~5 $/mois pour 1 VM.
Économies indirectes : pas besoin d'upgrader Postgres tier au prochain palier.

## Fallback (rollback)

Si PgBouncer pose problème, repasser DATABASE_URL au direct sur le Postgres
en remplaçant l'hôte `yukpo-bourse-sim-pgbouncer.internal` par
`yukpo-bourse-sim-db.internal` et le port `6432` par `5432` dans la commande
`fly secrets set` ci-dessus.
