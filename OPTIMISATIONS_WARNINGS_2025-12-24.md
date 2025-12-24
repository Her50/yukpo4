# 🔧 Optimisations des Warnings de Performance - 24 Décembre 2025

## 📊 Problèmes Identifiés dans les Logs

### 1. Requêtes SQL Lentes (>1s)

#### a) Requête pharmacies avec JOIN services: **1.68s**
```sql
SELECT p.id, p.nom, s.user_id 
FROM pharmacies p
INNER JOIN services s ON s.id = p.service_id
WHERE p.is_on_duty_now = true
  AND s.is_active = true
```

**Solution**: Index créés dans `20251224_optimize_slow_queries_critical.sql`
- `idx_pharmacies_service_id_active`
- `idx_services_id_active`
- `idx_pharmacies_on_duty_service_active`

**Résultat attendu**: <200ms

---

#### b) Requête delivery_matching_queue: **1.37s**
```sql
SELECT id, delivery_id, zone_id, status, priority, attempt_count, payload, next_attempt_at, enqueued_at, updated_at
FROM delivery_matching_queue
WHERE status IN ('queued', 'searching')
  AND next_attempt_at <= NOW()
ORDER BY priority ASC, next_attempt_at ASC
LIMIT $1
```

**Solution**: Index optimisé créé
- `idx_delivery_matching_queue_pending_optimized`
- `idx_delivery_matching_queue_delivery_id`

**Résultat attendu**: <100ms

---

#### c) Requête deliveries avec tous les champs: **1.4-2.3s**
```sql
SELECT id, status, creator_id, courier_id,
       ST_Y(pickup_location::geometry) AS pickup_lat,
       ST_X(pickup_location::geometry) AS pickup_lng,
       ...
FROM deliveries
WHERE id = $1
```

**Solution**: Index GIST sur les colonnes géographiques
- `idx_deliveries_pickup_location_gist`
- `idx_deliveries_dropoff_location_gist`
- `idx_deliveries_store_location_gist`
- `idx_deliveries_recipient_dropoff_gist`
- `idx_deliveries_id_status`

**Résultat attendu**: <150ms

---

#### d) Fonction find_nearby_couriers: **2.1s**
```sql
SELECT courier_id, user_id, distance_meters, load_factor, active_deliveries, max_capacity, engine_type, is_primary
FROM find_nearby_couriers($1, $2, $3, $4, $5)
```

**Solution**: Index GIST sur courier_profiles.location
- `idx_courier_profiles_location_gist`
- `idx_courier_profiles_active_primary`

**Résultat attendu**: <300ms

---

#### e) Refresh vues matérialisées: **8-15s**
```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY services_search_cache
SELECT refresh_services_search_optimized()
REFRESH MATERIALIZED VIEW CONCURRENTLY active_products_cache
```

**Statut**: ✅ **NORMAL** - Ces opérations sont longues par nature
- Utilisent déjà un pool séparé (ne bloquent pas le pool principal)
- Exécutées en arrière-plan toutes les 15 minutes
- Index ajoutés pour accélérer les refreshes futurs

**Améliorations possibles** (futures):
- Partitionner les tables sources
- Refresh incrémental (seulement les parties modifiées)
- pg_cron pour rafraîchir pendant les heures creuses

---

### 2. Problèmes de Connexion Database

#### a) Temps d'acquisition de connexion: **2-4s**
```
acquired connection, but time to acquire exceeded slow threshold
aquired_after_secs: 2.26s, 2.90s, 3.34s, 4.24s
```

**Cause**: Pool de connexions saturé ou connexions lentes à Render PostgreSQL

**Solutions appliquées** (déjà dans `main.rs`):
- ✅ Pool augmenté: `max_connections: 50` (était 30)
- ✅ Min connections: `min_connections: 10` (était 5)
- ✅ Acquire timeout: `30s`
- ✅ Idle timeout: `120s` (2 min)
- ✅ Max lifetime: `180s` (3 min)
- ✅ Test before acquire: `true`
- ✅ After release check: `true`

**Améliorations possibles**:
- Augmenter `DB_POOL_SIZE` à 60-70 si Render PostgreSQL le supporte
- Réduire `idle_timeout` à 60s pour libérer plus vite les connexions inactives
- Vérifier les paramètres Render PostgreSQL (max_connections, connection_limit)

---

#### b) Erreurs "terminating connection because of crash of another server process"
```
terminating connection because of crash of another server process
error communicating with database: peer closed connection without sending TLS close_notify
```

**Cause**: Render PostgreSQL ferme les connexions après ~5 minutes d'inactivité ou crashs temporaires

**Solutions appliquées** (déjà dans `main.rs`):
- ✅ `max_lifetime: 180s` (3 min) - Renouvelle avant fermeture Render
- ✅ `idle_timeout: 120s` (2 min) - Libère connexions inactives
- ✅ `test_before_acquire: true` - Teste connexion avant utilisation
- ✅ `after_release` check - Détecte connexions invalides après libération
- ✅ Retry logic avec backoff exponentiel

**Statut**: ✅ **GÉRÉ** - Les connexions invalides sont détectées et remplacées automatiquement

---

## 🚀 Migration Créée

**Fichier**: `backend/migrations/20251224_optimize_slow_queries_critical.sql`

**Contenu**:
1. Index pour pharmacies JOIN services
2. Index GIST pour deliveries (géolocalisation)
3. Index pour find_nearby_couriers
4. Index optimisés pour delivery_matching_queue
5. Index pour vues matérialisées
6. Index pour services (is_active, location)
7. ANALYZE des tables pour mettre à jour les statistiques

---

## 📋 Commandes d'Application

### 1. Appliquer la migration
```powershell
# Via script PowerShell
.\apply_migration_direct.ps1 -MigrationFile "backend/migrations/20251224_optimize_slow_queries_critical.sql"

# Ou directement via psql
psql $DATABASE_URL -f backend/migrations/20251224_optimize_slow_queries_critical.sql
```

### 2. Vérifier les index créés
```sql
-- Lister tous les index créés
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE indexname LIKE 'idx_%'
  AND tablename IN ('pharmacies', 'services', 'deliveries', 'courier_profiles', 'delivery_matching_queue')
ORDER BY tablename, indexname;
```

### 3. Analyser les performances après migration
```sql
-- Vérifier les statistiques des tables
SELECT 
    schemaname,
    tablename,
    n_live_tup,
    n_dead_tup,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze
FROM pg_stat_user_tables
WHERE tablename IN ('pharmacies', 'services', 'deliveries', 'courier_profiles', 'delivery_matching_queue');
```

### 4. VACUUM (à exécuter manuellement, pas dans transaction)
```sql
-- Nettoyer et optimiser les tables
VACUUM ANALYZE pharmacies;
VACUUM ANALYZE services;
VACUUM ANALYZE deliveries;
VACUUM ANALYZE courier_profiles;
VACUUM ANALYZE delivery_matching_queue;
```

---

## ⚙️ Configuration Recommandée Render PostgreSQL

Vérifier dans le dashboard Render PostgreSQL et ajuster si possible:

1. **work_mem**: 16MB (pour requêtes avec tri/joins)
2. **shared_buffers**: 25% de RAM disponible
3. **effective_cache_size**: 50-75% de RAM disponible
4. **maintenance_work_mem**: 256MB (pour VACUUM/ANALYZE)
5. **max_connections**: Vérifier la limite du plan (Standard: ~100)

---

## 📈 Résultats Attendus

### Avant optimisations:
- pharmacies JOIN: **1.68s** ⚠️
- delivery_matching_queue: **1.37s** ⚠️
- deliveries SELECT: **1.4-2.3s** ⚠️
- find_nearby_couriers: **2.1s** ⚠️
- Acquire connection: **2-4s** ⚠️

### Après optimisations (attendu):
- pharmacies JOIN: **<200ms** ✅
- delivery_matching_queue: **<100ms** ✅
- deliveries SELECT: **<150ms** ✅
- find_nearby_couriers: **<300ms** ✅
- Acquire connection: **<500ms** ✅ (si pool non saturé)

---

## 🔍 Monitoring Post-Migration

### 1. Surveiller les logs pour vérifier la réduction des warnings
```bash
# Filtrer les warnings de requêtes lentes
grep "slow statement" logs.txt | grep -v "REFRESH MATERIALIZED VIEW"
```

### 2. Vérifier les temps d'exécution avec EXPLAIN ANALYZE
```sql
-- Exemple pour la requête pharmacies
EXPLAIN ANALYZE
SELECT p.id, p.nom, s.user_id 
FROM pharmacies p
INNER JOIN services s ON s.id = p.service_id
WHERE p.is_on_duty_now = true
  AND s.is_active = true;
```

### 3. Surveiller le pool de connexions
- Vérifier que `acquire_timeout` warnings diminuent
- Surveiller les erreurs "terminating connection" (devraient rester rares)

---

## ✅ Checklist Post-Migration

- [ ] Migration appliquée avec succès
- [ ] Index créés vérifiés (requête pg_indexes)
- [ ] ANALYZE exécuté sur toutes les tables
- [ ] VACUUM exécuté (optionnel, mais recommandé)
- [ ] Logs surveillés pendant 24h pour vérifier réduction warnings
- [ ] Temps d'exécution vérifiés avec EXPLAIN ANALYZE
- [ ] Configuration Render PostgreSQL vérifiée

---

## 📝 Notes Importantes

1. **VACUUM ne peut pas être exécuté dans une transaction** - À faire manuellement ou via cron
2. **Les refreshes de vues matérialisées (8-15s) sont normaux** - Ne pas essayer de les optimiser davantage sans partitionnement
3. **Les erreurs "terminating connection" sont attendues** - Render PostgreSQL ferme les connexions idle, notre code les gère automatiquement
4. **Les index GIST prennent de l'espace** - Surveiller l'espace disque après création
5. **ANALYZE doit être exécuté régulièrement** - PostgreSQL le fait automatiquement, mais peut être forcé après migrations importantes

---

**Date**: 24 Décembre 2025  
**Auteur**: Auto (Cursor AI)  
**Migration**: `20251224_optimize_slow_queries_critical.sql`


