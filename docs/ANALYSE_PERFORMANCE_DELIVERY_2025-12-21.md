# Analyse Performance Service Delivery - 2025-12-21

## Problèmes identifiés

### 1. Requête `list_delivery_ids_for_user` (ligne 413-440)

**Problème potentiel**: LEFT JOIN avec `couriers` sans index sur `courier_id`

```rust
SELECT d.id
FROM deliveries d
LEFT JOIN couriers c ON d.courier_id = c.id
WHERE
    (
        d.creator_id = $1
        OR d.recipient_user_id = $1
        OR c.user_id = $1
    )
    AND d.status <> 'completed'::delivery_status
ORDER BY d.requested_at DESC
LIMIT $2
```

**Optimisations nécessaires**:
- ✅ Index sur `deliveries(creator_id, status, requested_at)`
- ✅ Index sur `deliveries(recipient_user_id, status, requested_at)`
- ✅ Index sur `couriers(user_id)`
- ✅ Index sur `deliveries(courier_id)` pour le JOIN

### 2. Requête `list_matching_candidates` (ligne 2729-2836)

**Problème**: Requête complexe avec `LEFT JOIN LATERAL` et calculs géospatiaux

```sql
SELECT ...
FROM courier_availability_snapshots cas
LEFT JOIN LATERAL (
    SELECT cza.*
    FROM courier_zone_assignments cza
    WHERE cza.courier_id = cas.courier_id
      AND cza.is_active = TRUE
    ORDER BY cza.is_primary DESC, cza.updated_at DESC
    LIMIT 1
) cza ON TRUE
WHERE cas.captured_at >= NOW() - INTERVAL '30 minutes'
  AND cas.is_online = TRUE
  AND cas.active_deliveries < cas.max_capacity
```

**Optimisations nécessaires**:
- ✅ Index sur `courier_availability_snapshots(captured_at, is_online, active_deliveries, max_capacity)`
- ✅ Index sur `courier_zone_assignments(courier_id, is_active, is_primary, updated_at)`
- ✅ Index spatial sur `courier_availability_snapshots.location` (GIST)
- ✅ La fonction `find_nearby_couriers_optimized` utilise déjà une fonction SQL optimisée (bonne pratique)

### 3. Requête `get_delivery_summary` (ligne 1756-1897)

**Problème**: Calculs géospatiaux multiples avec `ST_Y` et `ST_X` sur chaque ligne

```sql
SELECT
    ...
    ST_Y(pickup_location::geometry) AS pickup_lat,
    ST_X(pickup_location::geometry) AS pickup_lng,
    ST_Y(dropoff_location::geometry) AS dropoff_lat,
    ST_X(dropoff_location::geometry) AS dropoff_lng,
    ...
    ST_Y(recipient_dropoff_override::geometry) AS recipient_dropoff_lat,
    ST_X(recipient_dropoff_override::geometry) AS recipient_dropoff_lng,
    ...
    ST_Y(store_location::geometry) AS store_lat,
    ST_X(store_location::geometry) AS store_lng,
    ...
FROM deliveries
WHERE id = $1
```

**Optimisations nécessaires**:
- ✅ Index sur `deliveries(id)` (déjà présent normalement - PRIMARY KEY)
- ⚠️ Les calculs `ST_Y` et `ST_X` sont nécessaires mais peuvent être coûteux si la table est grande
- 💡 Solution: Stocker les coordonnées dénormalisées dans des colonnes séparées si les performances sont critiques

### 4. Requête `fetch_matching_queue_batch` (ligne 2992+)

**Problème potentiel**: Requête sur `delivery_matching_queue` sans index approprié

**Optimisations nécessaires**:
- ✅ Index sur `delivery_matching_queue(retry_at, status)` pour les requêtes de batch
- ✅ Index sur `delivery_matching_queue(delivery_id)` pour les recherches par livraison

## Index recommandés

### Index sur `deliveries`

```sql
-- Pour list_delivery_ids_for_user
CREATE INDEX IF NOT EXISTS idx_deliveries_creator_status_requested 
ON deliveries(creator_id, status, requested_at DESC)
WHERE status <> 'completed'::delivery_status;

CREATE INDEX IF NOT EXISTS idx_deliveries_recipient_status_requested 
ON deliveries(recipient_user_id, status, requested_at DESC)
WHERE status <> 'completed'::delivery_status AND recipient_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_deliveries_courier_id 
ON deliveries(courier_id)
WHERE courier_id IS NOT NULL;

-- Pour les recherches géospatiales
CREATE INDEX IF NOT EXISTS idx_deliveries_pickup_location 
ON deliveries USING GIST(pickup_location)
WHERE pickup_location IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_deliveries_dropoff_location 
ON deliveries USING GIST(dropoff_location)
WHERE dropoff_location IS NOT NULL;
```

### Index sur `couriers`

```sql
CREATE INDEX IF NOT EXISTS idx_couriers_user_id 
ON couriers(user_id)
WHERE user_id IS NOT NULL;
```

### Index sur `courier_availability_snapshots`

```sql
-- Pour list_matching_candidates
CREATE INDEX IF NOT EXISTS idx_courier_availability_snapshots_active 
ON courier_availability_snapshots(captured_at DESC, is_online, active_deliveries, max_capacity)
WHERE is_online = TRUE AND captured_at >= NOW() - INTERVAL '30 minutes';

CREATE INDEX IF NOT EXISTS idx_courier_availability_snapshots_location 
ON courier_availability_snapshots USING GIST(location)
WHERE location IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_courier_availability_snapshots_courier 
ON courier_availability_snapshots(courier_id, captured_at DESC);
```

### Index sur `courier_zone_assignments`

```sql
CREATE INDEX IF NOT EXISTS idx_courier_zone_assignments_active 
ON courier_zone_assignments(courier_id, is_active, is_primary DESC, updated_at DESC)
WHERE is_active = TRUE;
```

### Index sur `delivery_matching_queue`

```sql
CREATE INDEX IF NOT EXISTS idx_delivery_matching_queue_retry 
ON delivery_matching_queue(retry_at, status)
WHERE status IN ('pending', 'retrying');

CREATE INDEX IF NOT EXISTS idx_delivery_matching_queue_delivery 
ON delivery_matching_queue(delivery_id);
```

## Endpoints à surveiller

1. **`GET /api/delivery/{id}`** - Utilise `get_delivery_summary` (calculs géospatiaux)
2. **`POST /api/delivery`** - Création de livraison (peut déclencher matching)
3. **`GET /api/delivery/{id}/navigation`** - Calculs géospatiaux pour navigation
4. **Matching automatique** - `list_matching_candidates` appelé fréquemment

## Actions à prendre

1. ✅ Créer les index recommandés ci-dessus
2. ✅ Vérifier les performances avec `EXPLAIN ANALYZE` sur les requêtes critiques
3. ✅ Monitorer les temps de réponse des endpoints delivery dans les logs
4. ⚠️ Considérer la dénormalisation des coordonnées géospatiales si les performances restent lentes

## Migration SQL

Créer un fichier de migration `backend/migrations/20251221_optimize_delivery_indexes.sql` avec tous les index recommandés.

