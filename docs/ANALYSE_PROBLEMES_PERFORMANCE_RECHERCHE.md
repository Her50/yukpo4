# 🔍 Analyse des Problèmes de Performance - Logs de Recherche

**Date**: 2026-01-14  
**Contexte**: Analyse des logs de recherche pour identifier les problèmes de performance

## 📊 Problèmes Identifiés

### 1. ⚠️ Requêtes SQL Lentes (>1 seconde)

#### 1.1 `SELECT 1` - Problème de Pool de Connexions
```
"slow statement: execution time exceeded alert threshold"
"summary":"SELECT 1"
"elapsed":"1.056971194s"
```

**Problème**: Les requêtes `SELECT 1` (health checks) prennent plus de 1 seconde, indiquant :
- Pool de connexions saturé
- Latence réseau élevée vers Render PostgreSQL
- Connexions idle fermées par Render

**Impact**: 
- Acquisition de connexions bloquante
- Timeouts fréquents
- Dégradation générale des performances

**Solutions**:
1. ✅ Pool déjà configuré à 100 max, 20 min (bon)
2. ⚠️ Vérifier `idle_timeout` et `max_lifetime` (actuellement 120s et 180s)
3. ⚠️ Implémenter un circuit breaker pour éviter les cascades d'erreurs
4. ⚠️ Ajouter des métriques de monitoring du pool

#### 1.2 Requête `publicites` - Manque d'Index
```
"summary":"SELECT id, produits_indexes, zone_geographique, pub_lng, pub_lat, rayon_km FROM publicites WHERE status = 'active' AND date_fin > NOW() AND date_debut <= NOW() ORDER BY date_debut DESC LIMIT 1000"
"elapsed":"1.136617154s"
```

**Fichier**: `backend/src/services/publicite_search_service.rs:58-76`

**Problème**: La requête scanne probablement toute la table `publicites` sans index approprié sur :
- `status`
- `date_fin`
- `date_debut`

**Solution**:
```sql
-- Créer un index composite pour cette requête spécifique
CREATE INDEX IF NOT EXISTS idx_publicites_active_dates 
ON publicites(status, date_fin, date_debut DESC) 
WHERE status = 'active';

-- Index partiel pour les publicités actives uniquement
CREATE INDEX IF NOT EXISTS idx_publicites_active_filter 
ON publicites(date_fin, date_debut DESC) 
WHERE status = 'active' AND date_fin > NOW();
```

#### 1.3 `UPDATE delivery_matching_queue` - Manque d'Index
```
"summary":"UPDATE delivery_matching_queue SET status = $2, next_attempt_at = COALESCE($3, next_attempt_at), payload = COALESCE($4, payload), attempt_count = attempt_count + CASE WHEN $5 THEN 1 ELSE 0 END, updated_at = NOW() WHERE delivery_id = $1"
"elapsed":"1.288235815s"
```

**Fichier**: `backend/src/services/delivery_repository.rs:2913-2923`

**Problème**: L'UPDATE est lent car :
- Pas d'index sur `delivery_id` (ou index non utilisé)
- Lock contention sur la table

**Solution**:
```sql
-- Vérifier si l'index existe
CREATE INDEX IF NOT EXISTS idx_delivery_matching_queue_delivery_id 
ON delivery_matching_queue(delivery_id);

-- Analyser la requête
EXPLAIN ANALYZE UPDATE delivery_matching_queue SET ... WHERE delivery_id = $1;
```

#### 1.4 `SELECT constraints FROM delivery_parcels` - Sous-requête Non Optimisée
```
"summary":"SELECT constraints FROM delivery_parcels WHERE id = (SELECT parcel_id FROM deliveries WHERE id = $1)"
"elapsed":"436.331143ms" à "765.090768ms"
```

**Fichier**: `backend/src/services/delivery_service.rs:4049-4056`

**Problème**: Sous-requête corrélée au lieu d'un JOIN

**Solution**:
```rust
// Remplacer la sous-requête par un JOIN
let parcel_constraints: Option<Value> = sqlx::query_scalar::<_, Value>(
    r#"
    SELECT dp.constraints 
    FROM delivery_parcels dp
    INNER JOIN deliveries d ON d.parcel_id = dp.id
    WHERE d.id = $1
    "#,
)
.bind(summary.id)
.fetch_optional(self.repository.pool())
.await
.ok()
.flatten();
```

**Index requis**:
```sql
CREATE INDEX IF NOT EXISTS idx_deliveries_parcel_id ON deliveries(parcel_id);
CREATE INDEX IF NOT EXISTS idx_delivery_parcels_id ON delivery_parcels(id);
```

### 2. 🐌 Requêtes HTTP Lentes

#### 2.1 `POST /api/search/direct` - 3.3 secondes
```
"🐌 [SlowRequest] POST /api/search/direct -> 200 (3335 ms) - Requête lente détectée"
```

**Problèmes**:
- Requête `publicites` lente (1.136s) - voir 1.2
- Requêtes multiples séquentielles
- Pas de cache efficace

**Solutions**:
1. ✅ Cache déjà implémenté dans `PubliciteSearchService` (5 min TTL)
2. ⚠️ Vérifier que le cache Redis fonctionne correctement
3. ⚠️ Optimiser la requête `publicites` avec index (voir 1.2)
4. ⚠️ Paralléliser les requêtes indépendantes

#### 2.2 `GET /api/services/239` - 1.2 secondes
```
"⏱️ [ModerateRequest] GET /api/services/239 -> 200 (1201 ms) - Requête modérément lente"
```

**Problèmes**:
- Requête `SELECT id, data, is_active, created_at, user_id FROM services WHERE id = $1` prend 394ms
- Requête `SELECT id, service_id, product_index, ... FROM service_products WHERE service_id = $1` prend 72ms
- Total: ~466ms de requêtes DB, reste = overhead réseau/processing

**Solutions**:
1. ✅ Vérifier index sur `services.id` (PRIMARY KEY devrait être rapide)
2. ⚠️ Vérifier index sur `service_products.service_id`
3. ⚠️ Implémenter cache pour les services fréquemment consultés

#### 2.3 `GET /api/users/profile/99` - 1.4 secondes
```
responseTimeMS=1430
```

**Problèmes**:
- Requête `SELECT email, role, nom_complet FROM users WHERE id = $1` devrait être rapide (<10ms)
- Le temps est probablement dû à des requêtes supplémentaires ou overhead réseau

**Solutions**:
1. ⚠️ Vérifier si des requêtes supplémentaires sont faites dans le handler
2. ⚠️ Implémenter cache pour les profils utilisateurs

### 3. 🔄 Problèmes de Connexion Base de Données

#### 3.1 Connexions Lentes
Les `SELECT 1` prennent 400-800ms, ce qui est anormalement lent pour un health check.

**Causes possibles**:
- Latence réseau vers Render PostgreSQL (Europe → ?)
- Pool saturé
- Connexions idle fermées par Render

**Solutions**:
1. ✅ `max_lifetime` déjà à 180s (3 min) - bon pour Render
2. ✅ `idle_timeout` à 120s (2 min) - bon
3. ⚠️ Vérifier la latence réseau vers Render
4. ⚠️ Implémenter un health check asynchrone en arrière-plan
5. ⚠️ Réduire `test_before_acquire` si trop coûteux

### 4. 📋 Recommandations Prioritaires

#### Priorité 1 - Critique (Impact Immédiat)
1. **Créer index sur `publicites`** (voir 1.2)
   - Impact: Réduction de 1.136s → <50ms
   - Effort: 5 minutes

2. **Optimiser requête `delivery_parcels`** (voir 1.4)
   - Impact: Réduction de 436-765ms → <50ms
   - Effort: 10 minutes

3. **Créer index sur `delivery_matching_queue.delivery_id`** (voir 1.3)
   - Impact: Réduction de 1.288s → <50ms
   - Effort: 5 minutes

#### Priorité 2 - Important (Amélioration Continue)
1. **Monitoring du pool de connexions**
   - Ajouter métriques: connexions actives, en attente, temps d'acquisition
   - Alertes si saturation

2. **Cache Redis pour services/profils**
   - Cache TTL: 5-10 minutes pour services
   - Cache TTL: 15-30 minutes pour profils utilisateurs

3. **Parallélisation des requêtes indépendantes**
   - Dans `search/direct`, paralléliser les requêtes qui ne dépendent pas les unes des autres

#### Priorité 3 - Optimisation (Long Terme)
1. **Circuit breaker pour DB**
   - Éviter les cascades d'erreurs quand DB est surchargée

2. **Query optimization review**
   - Analyser toutes les requêtes >100ms avec `EXPLAIN ANALYZE`
   - Créer index manquants

3. **Connection pooling optimization**
   - Ajuster `min_connections` selon charge réelle
   - Implémenter pool séparé pour requêtes lourdes

## 🛠️ Actions Immédiates

### Migration SQL à Créer
```sql
-- backend/migrations/YYYYMMDD_optimize_search_performance.sql

-- 1. Index pour publicites
CREATE INDEX IF NOT EXISTS idx_publicites_active_filter 
ON publicites(date_fin, date_debut DESC) 
WHERE status = 'active' AND date_fin > NOW();

-- 2. Index pour delivery_matching_queue
CREATE INDEX IF NOT EXISTS idx_delivery_matching_queue_delivery_id 
ON delivery_matching_queue(delivery_id);

-- 3. Index pour deliveries.parcel_id
CREATE INDEX IF NOT EXISTS idx_deliveries_parcel_id 
ON deliveries(parcel_id);

-- 4. Index pour service_products.service_id (si pas déjà existant)
CREATE INDEX IF NOT EXISTS idx_service_products_service_id 
ON service_products(service_id) 
WHERE is_active = TRUE;
```

### Code à Modifier

1. **`backend/src/services/delivery_service.rs:4049-4056`**
   - Remplacer sous-requête par JOIN (voir 1.4)

2. **`backend/src/services/publicite_search_service.rs`**
   - Vérifier que le cache fonctionne correctement
   - Ajouter logging pour cache hit/miss ratio

## 📈 Métriques à Surveiller

1. **Temps de réponse moyen**:
   - `/api/search/direct`: Objectif <1s
   - `/api/services/:id`: Objectif <500ms
   - `/api/users/profile/:id`: Objectif <300ms

2. **Requêtes SQL**:
   - Aucune requête >500ms (sauf requêtes complexes justifiées)
   - 95% des requêtes <100ms

3. **Pool de connexions**:
   - Temps d'acquisition <100ms (95th percentile)
   - Connexions en attente <5

## ✅ Checklist de Validation

- [ ] Migration SQL appliquée
- [ ] Code `delivery_service.rs` modifié
- [ ] Index créés et vérifiés avec `EXPLAIN ANALYZE`
- [ ] Cache Redis fonctionnel pour publicités
- [ ] Métriques de monitoring ajoutées
- [ ] Tests de performance effectués
- [ ] Documentation mise à jour






