# Monitoring Postgres + Backend Yukpo Bourse

Commandes essentielles pour observer la santé de la stack en charge.

## pg_stat_statements — queries les + lentes

Installé sur staging 2026-05-21. Collecte toutes les requêtes exécutées
avec stats agrégées.

```sql
-- TOP 20 queries par temps total (charge cumulée)
SELECT
  substring(query, 1, 80) AS query_short,
  calls,
  round(total_exec_time::numeric, 2) AS total_ms,
  round(mean_exec_time::numeric, 2) AS avg_ms,
  round((100 * total_exec_time / NULLIF(sum(total_exec_time) OVER (), 0))::numeric, 2) AS pct_total
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat_statements%'
ORDER BY total_exec_time DESC
LIMIT 20;

-- TOP 10 queries par latence moyenne (queries qui prennent du temps unitaire)
SELECT
  substring(query, 1, 100) AS query_short,
  calls,
  round(mean_exec_time::numeric, 2) AS avg_ms,
  round(stddev_exec_time::numeric, 2) AS stddev_ms,
  round(min_exec_time::numeric, 2) AS min_ms,
  round(max_exec_time::numeric, 2) AS max_ms
FROM pg_stat_statements
WHERE calls > 10  -- ignore les one-off
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Reset stats (avant un benchmark)
SELECT pg_stat_statements_reset();
```

## Activity en temps réel

```sql
-- Connexions actives / en attente / idle
SELECT state, count(*) FROM pg_stat_activity GROUP BY state;

-- Queries en cours depuis > 5s (potentiel deadlock ou query lente)
SELECT pid, now() - query_start AS duration, state, substring(query, 1, 120)
FROM pg_stat_activity
WHERE state != 'idle'
  AND query_start < now() - interval '5 seconds'
ORDER BY duration DESC;

-- Locks en attente
SELECT
  blocked_locks.pid AS blocked_pid,
  blocking_locks.pid AS blocking_pid,
  blocked_activity.query AS blocked_query,
  blocking_activity.query AS blocking_query
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype
  AND blocking_locks.DATABASE IS NOT DISTINCT FROM blocked_locks.DATABASE
  AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
  AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;
```

## Indexes — utilisation

```sql
-- Tables avec seqscans fréquents (= index manquant probable)
SELECT
  schemaname, relname,
  seq_scan, seq_tup_read,
  idx_scan, idx_tup_fetch,
  round(100.0 * seq_scan / NULLIF(seq_scan + idx_scan, 0), 2) AS pct_seq
FROM pg_stat_user_tables
WHERE seq_scan + idx_scan > 100
ORDER BY pct_seq DESC, seq_scan DESC
LIMIT 20;

-- Indexes inutilisés (à dropper pour économiser)
SELECT
  schemaname, relname, indexrelname,
  idx_scan, pg_size_pretty(pg_relation_size(indexrelid)) AS size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND indexrelname NOT LIKE '%_pkey'
ORDER BY pg_relation_size(indexrelid) DESC;

-- Indexes les plus utilisés
SELECT
  schemaname, relname, indexrelname,
  idx_scan, idx_tup_fetch,
  pg_size_pretty(pg_relation_size(indexrelid)) AS size
FROM pg_stat_user_indexes
WHERE idx_scan > 0
ORDER BY idx_scan DESC
LIMIT 20;
```

## Métriques Fly Backend

```bash
# Métriques mémoire/CPU des machines
fly status -a yukpo-bourse-sim
fly machine list -a yukpo-bourse-sim
fly machine show <id> -a yukpo-bourse-sim

# Logs en live (filtrer par niveau)
fly logs -a yukpo-bourse-sim | grep -E "ERROR|WARN"

# Métriques Postgres Fly
fly status -a yukpo-bourse-sim-db
fly logs -a yukpo-bourse-sim-db | grep -E "ERROR|max_connections"
```

## Dashboard Grafana Cloud (optionnel)

Pour visualiser en continu :
1. Créer un compte gratuit Grafana Cloud
2. Connecter source Prometheus Fly (config Fly Metrics)
3. Importer dashboard Postgres ID 9628 + Fly machine ID 14114

Coût : gratuit jusqu'à 10k séries.

## Alerting (Slack/Discord webhook)

À configurer post-deploy :
- max_connections > 80% capacity → alerte
- query mean > 5s → alerte
- requests 5xx > 1% des 5xx → alerte
- pool acquire timeout > 100/min → alerte

Tooling possible : `fly_alerts` (sur fly metrics) ou Grafana Alerting.
