# Tuning Postgres PROD — à exécuter en off-peak avant pic rentrée

## État actuel (audit 2026-05-21)

| Paramètre | Prod actuel | Cible 10k req/s |
|---|---|---|
| max_connections | 300 | 1000 |
| shared_buffers | 256MB | 512MB ou plus selon RAM |
| work_mem | default ~4MB | 16MB |
| effective_cache_size | default | 2GB (selon RAM machine) |

**Risque** : backend prod `DB_POOL_SIZE=20` × `max_machines=25` = 500 conn potentielles vs 300 max_connections. Sature à ~60% capacité.

## Commande de tuning (à lancer par le user)

```bash
# 1. Connexion psql interactive prod
fly postgres connect -a yukpo-fly-postgres -d postgres

# 2. Une fois dans psql, lancer ces commandes une par une
ALTER SYSTEM SET max_connections = 1000;
ALTER SYSTEM SET shared_buffers = '512MB';
ALTER SYSTEM SET work_mem = '16MB';
ALTER SYSTEM SET effective_cache_size = '2GB';

# 3. (optionnel) pg_stat_statements pour monitoring
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
\q

# 4. Restart Postgres prod (downtime ~30s)
fly postgres restart -a yukpo-fly-postgres

# 5. Vérification post-restart
fly postgres connect -a yukpo-fly-postgres -d postgres -c "SHOW max_connections;"
# Doit afficher : 1000

# 6. (optionnel) installer pg_stat_statements extension
fly postgres connect -a yukpo-fly-postgres -d yukpo_db -c "CREATE EXTENSION IF NOT EXISTS pg_stat_statements;"
```

## Timing recommandé

- **OFF-PEAK** : 02h-05h du matin (heure locale Cameroun = UTC+1)
- Pas pendant un pic d'inscription ou commande
- Annoncer aux utilisateurs si possible

## Rollback si problème

```bash
fly postgres connect -a yukpo-fly-postgres -d postgres -c "ALTER SYSTEM SET max_connections = 300;"
fly postgres restart -a yukpo-fly-postgres
```

## Effet attendu

- Capacité DB ×3.3 (300 → 1000)
- Backend prod 25 VMs × 20 pool = 500 conn = bien sous le plafond
- Headroom pour scale jusqu'à 50 VMs si besoin (`fly scale count 50 -a yukpo-fly-backend`)

## Monitoring post-tuning

```sql
-- TOP queries lentes (besoin pg_stat_statements activé)
SELECT substring(query, 1, 80) AS q, calls, round(mean_exec_time::numeric, 2) AS avg_ms
FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;

-- Connexions actuelles vs limite
SELECT state, count(*) FROM pg_stat_activity GROUP BY state;

-- Locks en attente (sentinelle deadlock)
SELECT pid, now() - query_start AS dur, substring(query, 1, 80)
FROM pg_stat_activity WHERE state = 'active' AND query_start < now() - interval '5s'
ORDER BY dur DESC;
```
