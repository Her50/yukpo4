# Analyse Utilisation Service Delivery - 2025-12-21

## Vue d'ensemble

Ce document analyse les problèmes d'utilisation et de performance du service delivery identifiés dans le code et les logs.

## Problèmes identifiés

### 1. Requêtes SQL lentes dans `delivery_repository.rs`

#### 1.1 `list_delivery_ids_for_user` (ligne 413-440)

**Problème**: LEFT JOIN avec `couriers` sans index approprié, requête avec plusieurs conditions OR

```sql
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

**Impact**: 
- Requête lente pour les utilisateurs avec beaucoup de livraisons
- Scan complet de la table `deliveries` si les index manquent

**Solution**: 
- ✅ Index créés sur `deliveries(creator_id, status, requested_at)`
- ✅ Index créés sur `deliveries(recipient_user_id, status, requested_at)`
- ✅ Index créé sur `couriers(user_id)`

#### 1.2 `list_matching_candidates` (ligne 2729-2836)

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

**Impact**:
- Requête très lente pour trouver des coursiers disponibles
- Calculs géospatiaux coûteux sans index GIST
- LEFT JOIN LATERAL peut être lent si beaucoup de coursiers

**Solution**:
- ✅ Index créé sur `courier_availability_snapshots(captured_at, is_online, active_deliveries, max_capacity)`
- ✅ Index GIST créé sur `courier_availability_snapshots.location`
- ✅ Index créé sur `courier_zone_assignments(courier_id, is_active, is_primary, updated_at)`
- ✅ Fonction optimisée `find_nearby_couriers_optimized` utilisée en priorité

#### 1.3 `get_delivery_summary` (ligne 1756-1897)

**Problème**: Calculs géospatiaux multiples avec `ST_Y` et `ST_X` sur chaque ligne

```sql
SELECT
    ...
    ST_Y(pickup_location::geometry) AS pickup_lat,
    ST_X(pickup_location::geometry) AS pickup_lng,
    ST_Y(dropoff_location::geometry) AS dropoff_lat,
    ST_X(dropoff_location::geometry) AS dropoff_lng,
    ...
FROM deliveries
WHERE id = $1
```

**Impact**:
- Calculs `ST_Y` et `ST_X` coûteux si la table est grande
- Requête appelée fréquemment pour afficher les détails d'une livraison

**Solution**:
- ✅ Index PRIMARY KEY sur `deliveries(id)` (déjà présent)
- ⚠️ Les calculs géospatiaux sont nécessaires mais peuvent être optimisés en stockant les coordonnées dénormalisées si nécessaire

#### 1.4 `fetch_matching_queue_batch` (ligne 2992-3048)

**Problème**: Requête sur `delivery_matching_queue` sans index approprié

```sql
SELECT ...
FROM delivery_matching_queue
WHERE status IN ('queued', 'searching')
  AND next_attempt_at <= NOW()
ORDER BY priority ASC, next_attempt_at ASC
LIMIT $1
```

**Impact**:
- Requête appelée fréquemment par le worker de matching
- Peut être lente si beaucoup d'éléments en file d'attente

**Solution**:
- ✅ Index créé sur `delivery_matching_queue(retry_at, status)`
- ✅ Index créé sur `delivery_matching_queue(delivery_id)`

### 2. Endpoints à surveiller

#### 2.1 `GET /api/delivery/{id}`
- **Fonction**: `get_delivery_summary`
- **Problème**: Calculs géospatiaux multiples
- **Impact**: Temps de réponse potentiellement élevé
- **Solution**: Index GIST sur les colonnes géospatiales

#### 2.2 `POST /api/delivery`
- **Fonction**: Création de livraison
- **Problème**: Peut déclencher le matching automatique qui appelle `list_matching_candidates`
- **Impact**: Temps de réponse élevé si matching lent
- **Solution**: Index optimisés pour `list_matching_candidates`

#### 2.3 `GET /api/delivery/{id}/navigation`
- **Fonction**: Calculs géospatiaux pour navigation
- **Problème**: Calculs de distance et routing
- **Impact**: Temps de réponse potentiellement élevé
- **Solution**: Cache des résultats de routing si possible

#### 2.4 Matching automatique
- **Fonction**: `list_matching_candidates` appelé fréquemment
- **Problème**: Requête complexe avec JOIN LATERAL
- **Impact**: Performance critique pour le système de matching
- **Solution**: Index optimisés + fonction SQL `find_nearby_couriers_optimized`

### 3. Index créés

Tous les index recommandés ont été créés dans la migration `20251221_optimize_delivery_indexes.sql`:

1. ✅ `idx_deliveries_creator_status_requested` - Pour `list_delivery_ids_for_user` (creator)
2. ✅ `idx_deliveries_recipient_status_requested` - Pour `list_delivery_ids_for_user` (recipient)
3. ✅ `idx_deliveries_courier_id` - Pour JOIN avec couriers
4. ✅ `idx_deliveries_pickup_location` - Index GIST pour recherches géospatiales
5. ✅ `idx_deliveries_dropoff_location` - Index GIST pour recherches géospatiales
6. ✅ `idx_couriers_user_id` - Pour JOIN dans `list_delivery_ids_for_user`
7. ✅ `idx_courier_availability_snapshots_active` - Pour `list_matching_candidates`
8. ✅ `idx_courier_availability_snapshots_location` - Index GIST pour géospatial
9. ✅ `idx_courier_availability_snapshots_courier` - Pour recherches par coursier
10. ✅ `idx_courier_zone_assignments_active` - Pour LEFT JOIN LATERAL
11. ✅ `idx_delivery_matching_queue_retry` - Pour `fetch_matching_queue_batch`
12. ✅ `idx_delivery_matching_queue_delivery` - Pour recherches par livraison

### 4. Optimisations déjà en place

1. ✅ **Fonction optimisée `find_nearby_couriers_optimized`**: Utilise une fonction SQL optimisée au lieu de QueryBuilder
2. ✅ **Retry logic**: `fetch_matching_queue_batch` utilise `db_retry::retry_query` pour gérer les erreurs TLS
3. ✅ **LIMIT appropriés**: Toutes les requêtes ont des LIMIT pour éviter de récupérer trop de données

### 5. Recommandations futures

1. **Dénormalisation des coordonnées**: Si les performances restent lentes, considérer stocker `pickup_lat`, `pickup_lng`, `dropoff_lat`, `dropoff_lng` comme colonnes séparées en plus des colonnes géospatiales
2. **Cache des résultats de matching**: Mettre en cache les résultats de `list_matching_candidates` pour les mêmes paramètres (pickup, zone) pendant quelques secondes
3. **Monitoring**: Ajouter des métriques pour surveiller les temps de réponse des endpoints delivery
4. **Partitioning**: Si la table `deliveries` devient très grande, considérer le partitioning par date

## Migration

La migration `20251221_optimize_delivery_indexes.sql` a été créée et intégrée dans `auto_migrate.rs`. Elle sera exécutée automatiquement au démarrage de l'application.

## Tests

Pour vérifier les performances après les optimisations:

```sql
-- Test 1: list_delivery_ids_for_user
EXPLAIN ANALYZE
SELECT d.id
FROM deliveries d
LEFT JOIN couriers c ON d.courier_id = c.id
WHERE (d.creator_id = 1 OR d.recipient_user_id = 1 OR c.user_id = 1)
  AND d.status <> 'completed'::delivery_status
ORDER BY d.requested_at DESC
LIMIT 20;

-- Test 2: list_matching_candidates
EXPLAIN ANALYZE
SELECT ...
FROM courier_availability_snapshots cas
LEFT JOIN LATERAL (...)
WHERE cas.captured_at >= NOW() - INTERVAL '30 minutes'
  AND cas.is_online = TRUE
  AND cas.active_deliveries < cas.max_capacity
LIMIT 10;
```

## Conclusion

Les optimisations suivantes ont été appliquées:
- ✅ 12 index créés pour optimiser les requêtes critiques
- ✅ Migration intégrée dans `auto_migrate.rs`
- ✅ Documentation complète des problèmes et solutions

Les performances devraient être significativement améliorées, notamment pour:
- La liste des livraisons d'un utilisateur
- Le matching de coursiers
- La récupération des détails d'une livraison
- Le traitement de la file d'attente de matching

