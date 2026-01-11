# 🔧 Optimisations de Performance - 11 Janvier 2026

## 📊 Problèmes Identifiés

D'après les logs de warnings, plusieurs requêtes SQL dépassent le seuil d'alerte (>1 seconde):

1. **SELECT deliveries (get_delivery_summary)**: 1.1-1.5 secondes
   - Requête avec de nombreux calculs PostGIS (ST_Y, ST_X) sur 6 colonnes géométriques
   - Manque d'index sur `return_pickup_location` et `return_dropoff_location`

2. **find_nearby_couriers**: 1.14 secondes
   - Fonction SQL de recherche de coursiers à proximité
   - Manque d'index sur `captured_at` récent

3. **UPDATE delivery_matching_queue**: 1.09 secondes
   - Mise à jour des items de matching
   - Manque d'index optimisés pour WHERE clauses

4. **SELECT 1 (healthcheck)**: 1+ seconde
   - Indique une latence réseau élevée ou charge de la base de données
   - Peut être dû à une surcharge du serveur PostgreSQL (Render.com)

## ✅ Solutions Implémentées

### Migration: `20260111_optimize_delivery_queries_additional.sql`

#### 1. Index GIST pour colonnes géométriques manquantes
- `idx_deliveries_return_pickup_location_gist`
- `idx_deliveries_return_dropoff_location_gist`
- `idx_deliveries_round_trip` (pour is_round_trip)

#### 2. Index pour find_nearby_couriers
- `idx_courier_availability_snapshots_recent` (captured_at récent)
- `idx_courier_availability_snapshots_user_courier` (jointure optimisée)

#### 3. Index pour delivery_matching_queue
- `idx_delivery_matching_queue_delivery_id_status`
- `idx_delivery_matching_queue_next_attempt`

#### 4. Index pour requêtes fréquentes deliveries
- `idx_deliveries_creator_id`
- `idx_deliveries_courier_id`
- `idx_deliveries_recipient_user_id`
- `idx_deliveries_tracking_token`
- `idx_deliveries_recipient_tracking_token`

## 📈 Performances Attendues

Après application de la migration:
- **get_delivery_summary**: 1.1-1.5s → **<150ms** (réduction de ~90%)
- **find_nearby_couriers**: 1.14s → **<300ms** (réduction de ~75%)
- **UPDATE delivery_matching_queue**: 1.09s → **<50ms** (réduction de ~95%)

## 🚀 Application de la Migration

```bash
# Via SQLx (recommandé)
cd backend
sqlx migrate run

# Ou directement via psql
psql $DATABASE_URL -f migrations/20260111_optimize_delivery_queries_additional.sql
```

## 🔍 Vérification

### 1. Vérifier que les index sont créés
```sql
SELECT indexname, tablename 
FROM pg_indexes 
WHERE indexname LIKE 'idx_deliveries%' 
   OR indexname LIKE 'idx_courier_availability%'
   OR indexname LIKE 'idx_delivery_matching_queue%'
ORDER BY tablename, indexname;
```

### 2. Vérifier l'utilisation des index
```sql
-- Pour deliveries
EXPLAIN ANALYZE
SELECT
    id, status, creator_id, courier_id,
    ST_Y(pickup_location::geometry) AS pickup_lat,
    ST_X(pickup_location::geometry) AS pickup_lng,
    -- ... autres champs
FROM deliveries
WHERE id = 'some-uuid';
```

### 3. Monitorer les requêtes lentes
```sql
-- Activer pg_stat_statements (si disponible)
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE mean_exec_time > 1000  -- >1 seconde
ORDER BY mean_exec_time DESC
LIMIT 20;
```

## ⚠️ Problème SELECT 1 (healthcheck)

Les `SELECT 1` qui prennent 1+ seconde indiquent:
1. **Latence réseau élevée** vers Render.com
2. **Surcharge de la base de données** (CPU/RAM)
3. **Trop de connexions actives**

### Solutions recommandées:

1. **Vérifier la charge de la base de données**
```sql
SELECT count(*) FROM pg_stat_activity;
SELECT * FROM pg_stat_database WHERE datname = 'yukpo_db';
```

2. **Optimiser le pool de connexions**
   - Limiter le nombre de connexions simultanées
   - Utiliser un pool avec timeout approprié
   - Considérer la lecture depuis une réplica

3. **Mise en cache**
   - Utiliser Redis pour les requêtes fréquentes
   - Cache TTL adapté selon le type de données

## 📝 Notes Additionnelles

- Les index GIST peuvent prendre du temps à créer sur de grandes tables
- Exécuter `ANALYZE` après création des index pour mettre à jour les statistiques
- Monitorer la taille des index (ils prennent de l'espace disque)
- Considérer la maintenance périodique (VACUUM ANALYZE)

## 🔗 Migrations Précédentes

Cette migration complète:
- `20251224_optimize_slow_queries_critical.sql` (optimisations générales)
- `20250127_phase1_delivery_optimizations.sql` (optimisations Phase 1)

