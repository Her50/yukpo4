# 📊 ANALYSE COMPLÈTE DES WARNINGS - LOGS

Date: 2026-01-04
Source: Logs production yukpomnang.onrender.com

## 🎯 RÉSUMÉ EXÉCUTIF

**Total de catégories de problèmes identifiées : 5**

1. ✅ **Requêtes SQL lentes** (>1s) - **CRITIQUE**
2. ✅ **Acquisition lente de connexions DB** (>2s) - **CRITIQUE**
3. ⚠️ **Erreurs traitement média** (décodage base64) - **MOYEN**
4. ⚠️ **Requêtes HTTP lentes** (>3s) - **MOYEN**
5. ℹ️ **Warnings applicatifs** (timeouts, 404, etc.) - **FAIBLE**

---

## 1. 🔴 REQUÊTES SQL LENTES (>1s) - CRITIQUE

### 1.1 SELECT sur table `deliveries` (Très fréquent, 1-1.8s)

**Problème** : Requête SELECT complexe avec conversions PostGIS (ST_X/ST_Y) sur plusieurs colonnes géométriques

**Requête type** :
```sql
SELECT id, status, creator_id, courier_id,
    ST_Y(pickup_location::geometry) AS pickup_lat,
    ST_X(pickup_location::geometry) AS pickup_lng,
    ST_Y(dropoff_location::geometry) AS dropoff_lat,
    ST_X(dropoff_location::geometry) AS dropoff_lng,
    ...
    ST_Y(recipient_dropoff_override::geometry) AS recipient_dropoff_lat,
    ST_X(recipient_dropoff_override::geometry) AS recipient_dropoff_lng,
    ST_Y(store_location::geometry) AS store_lat,
    ST_X(store_location::geometry) AS store_lng,
    CASE WHEN return_pickup_location IS NOT NULL THEN ST_Y(...) ELSE NULL END,
    ...
FROM deliveries
WHERE id = $1
```

**Temps d'exécution** : 1.0s - 1.8s
**Fréquence** : Très élevée (apparaît dans presque tous les logs)
**Impact** : Élevé - utilisée fréquemment pour récupérer les détails de livraison

**Causes probables** :
- Conversion géométrie PostGIS coûteuse (ST_X/ST_Y sur chaque colonne)
- Pas d'index spatial sur les colonnes géométriques
- Plusieurs colonnes géométriques (pickup, dropoff, store, return, recipient)
- Conversion CAST `::geometry` répétée

**Solutions possibles** :
- Créer des colonnes calculées ou vues matérialisées pour lat/lng
- Ajouter des index GIST sur les colonnes géométriques
- Optimiser les conversions PostGIS
- Utiliser des fonctions PostgreSQL qui retournent directement lat/lng

---

### 1.2 UPDATE sur `delivery_matching_queue` (1.0-1.3s)

**Problème** : UPDATE avec plusieurs colonnes conditionnelles

**Requête type** :
```sql
UPDATE delivery_matching_queue
SET
    status = $2,
    next_attempt_at = COALESCE($3, next_attempt_at),
    payload = COALESCE($4, payload),
    attempt_count = attempt_count + CASE WHEN $5 THEN 1 ELSE 0 END,
    updated_at = NOW()
WHERE delivery_id = $1
```

**Temps d'exécution** : 1.0s - 1.3s
**Fréquence** : Élevée
**Impact** : Moyen-Élevé

**Causes probables** :
- Index manquant ou inefficient sur `delivery_id`
- Contention sur la table (beaucoup d'updates concurrents)
- COALESCE peut forcer des scans de table

**Solutions possibles** :
- Index unique/composite sur `delivery_id`
- Optimiser les conditions COALESCE
- Utiliser UPDATE ... RETURNING pour éviter un SELECT séparé

---

### 1.3 SELECT sur `product_creation_queue` avec FOR UPDATE SKIP LOCKED (1.4s)

**Problème** : SELECT avec verrou FOR UPDATE SKIP LOCKED

**Requête type** :
```sql
SELECT id, service_id, user_id, product_data,
    images_to_process, status, priority, attempt_count, max_attempts,
    error_message, result_data, created_at, started_at, completed_at
FROM product_creation_queue
WHERE status = 'pending'
ORDER BY priority ASC, created_at ASC
LIMIT $1
FOR UPDATE SKIP LOCKED
```

**Temps d'exécution** : 1.4s
**Fréquence** : Moyenne (worker de queue)
**Impact** : Moyen

**Causes probables** :
- Index manquant sur `(status, priority, created_at)`
- FOR UPDATE SKIP LOCKED peut être coûteux si beaucoup de lignes verrouillées
- Tri sur plusieurs colonnes

**Solutions possibles** :
- Index composite sur `(status, priority, created_at)`
- Optimiser le verrouillage
- Considérer une partition de table par status

---

### 1.4 SELECT sur fonction `find_nearby_couriers` (1.1-1.6s)

**Problème** : Fonction PostgreSQL retournant les coursiers proches

**Requête type** :
```sql
SELECT courier_id, user_id, distance_meters, load_factor,
    active_deliveries, max_capacity, engine_type, is_primary
FROM find_nearby_couriers($1, $2, $3, $4, $5)
```

**Temps d'exécution** : 1.1s - 1.6s
**Fréquence** : Moyenne-Élevée
**Impact** : Élevé (utilisée pour matching des livraisons)

**Causes probables** :
- Fonction PostgreSQL complexe avec calculs géographiques
- Pas d'index spatial sur les emplacements des coursiers
- Calculs de distance coûteux

**Solutions possibles** :
- Optimiser la fonction `find_nearby_couriers`
- Ajouter des index GIST pour les recherches spatiales
- Utiliser PostGIS ST_DWithin au lieu de calculs de distance manuels

---

### 1.5 INSERT dans `product_creation_queue` (2.1s)

**Problème** : INSERT avec RETURNING

**Requête type** :
```sql
INSERT INTO product_creation_queue 
    (service_id, user_id, product_data, images_to_process, priority)
VALUES ($1, $2, $3, $4, $5)
RETURNING id
```

**Temps d'exécution** : 2.1s
**Fréquence** : Moyenne
**Impact** : Élevé (création de produits)

**Causes probables** :
- Données volumineuses dans `product_data` (JSONB)
- Trigger ou contrainte coûteuse
- Index sur colonnes JSONB

**Solutions possibles** :
- Vérifier les triggers
- Optimiser les index JSONB
- Compression des données

---

### 1.6 SELECT sur `delivery_matching_queue` avec status IN (1.25s)

**Problème** : SELECT avec plusieurs status

**Requête type** :
```sql
SELECT id, delivery_id, zone_id, status, priority, attempt_count,
    payload, next_attempt_at, enqueued_at, updated_at
FROM delivery_matching_queue
WHERE status IN ('queued', 'searching')
  AND next_attempt_at <= NOW()
ORDER BY priority ASC, next_attempt_at ASC
LIMIT $1
```

**Temps d'exécution** : 1.25s
**Fréquence** : Moyenne (worker de matching)
**Impact** : Moyen

**Causes probables** :
- Index manquant sur `(status, next_attempt_at, priority)`
- Scan de table pour plusieurs status

**Solutions possibles** :
- Index composite sur `(status, next_attempt_at, priority)`
- Partition par status si approprié

---

### 1.7 SELECT sur `delivery_parcels` (1.1s)

**Problème** : SELECT avec sous-requête

**Requête type** :
```sql
SELECT type_id FROM delivery_parcels 
WHERE id = (SELECT parcel_id FROM deliveries WHERE id = $1)
```

**Temps d'exécution** : 1.1s
**Fréquence** : Moyenne
**Impact** : Moyen

**Causes probables** :
- Sous-requête non optimisée
- JOIN serait plus efficace

**Solutions possibles** :
- Remplacer par JOIN
- Index sur `deliveries.parcel_id`

---

### 1.8 SELECT 1 (queries simples mais lentes, 1.0-1.6s)

**Problème** : Queries très simples `SELECT 1` mais prennent >1s

**Temps d'exécution** : 1.0s - 1.6s
**Fréquence** : Variable
**Impact** : Variable (health checks, connexions DB)

**Causes probables** :
- Problème de connexion DB (latence réseau)
- Pool de connexions saturé
- Database sous charge

**Solutions possibles** :
- Vérifier la connexion à la DB
- Augmenter la taille du pool
- Utiliser un read replica pour les health checks

---

## 2. 🔴 ACQUISITION LENTE DE CONNEXIONS DB (>2s) - CRITIQUE

**Problème** : Acquisition de connexions depuis le pool SQLx prend >2s

**Message type** :
```
"acquired connection, but time to acquire exceeded slow threshold"
"aquired_after_secs": 2.15-2.17s
"slow_acquire_threshold_secs": 2.0
```

**Fréquence** : Élevée (plusieurs connexions simultanées)
**Impact** : **TRÈS ÉLEVÉ** - Toutes les requêtes sont ralenties

**Causes probables** :
- Pool de connexions trop petit (saturation)
- Toutes les connexions sont utilisées par des requêtes lentes
- Base de données sous charge
- Connexions non libérées correctement
- Réseau lent vers la DB (Render.com)

**Solutions possibles** :
- Augmenter `max_connections` dans le pool
- Réduire `idle_timeout` pour libérer les connexions inutilisées
- Optimiser les requêtes lentes (voir section 1)
- Utiliser un read replica pour les lectures
- Vérifier les connexions qui restent ouvertes
- Monitoring du pool de connexions

---

## 3. ⚠️ ERREURS TRAITEMENT MÉDIA (DÉCODAGE BASE64) - MOYEN

**Problème** : Erreurs de décodage base64 dans `OptimizedMediaProcessor`

**Message type** :
```
"[OptimizedMediaProcessor] ⚠️ Erreurs lors du traitement: 
  [\"Erreur traitement média: ?? Bad Request: Erreur décodage base64: Invalid byte 58, offset 4.\", ...]"
```

**Fréquence** : Variable (8 erreurs dans un batch)
**Impact** : Moyen (certains médias ne sont pas traités)

**Causes probables** :
- Données base64 invalides (caractères non base64, offset 4 = caractère ':')
- Format de données incorrect (URL au lieu de base64 ?)
- Données corrompues
- Validation insuffisante avant traitement

**Solutions possibles** :
- Améliorer la validation des données base64 avant décodage
- Détecter et ignorer les URLs (format `data:image/...`)
- Logging plus détaillé pour identifier la source
- Fallback gracieux (ignorer le média invalide)

---

## 4. ⚠️ REQUÊTES HTTP LENTES (>3s) - MOYEN

### 4.1 POST /api/services/{id}/products (3.7s)

**Endpoint** : `POST /api/services/191/products`
**Temps de réponse** : 3710ms
**Fréquence** : Variable
**Impact** : Élevé (création de produits)

**Causes probables** :
- Requête SQL lente (INSERT product_creation_queue = 2.1s)
- Traitement des médias
- Validation complexe
- Indexation autocomplete

**Solutions possibles** :
- Optimiser l'INSERT dans product_creation_queue
- Traitement asynchrone des médias
- Cache des validations
- Indexation asynchrone

---

### 4.2 POST /api/ia/creation-service (7.0s)

**Endpoint** : `POST /api/ia/creation-service`
**Temps de réponse** : 7026ms
**Fréquence** : Variable
**Impact** : Élevé (création de service)

**Causes probables** :
- Appel IA externe (OpenAI/Claude) - normal pour IA
- Traitement d'images
- Génération de suggestions complexes

**Solutions possibles** :
- Caching des réponses IA similaires
- Optimisation des prompts
- Traitement asynchrone si possible
- Timeout et fallback

---

## 5. ℹ️ WARNINGS APPLICATIFS - FAIBLE

### 5.1 Erreurs WebSocket (Normales)

**Message** : `[WebSocket] Erreur: Software caused connection abort`
**Impact** : Faible (déconnexions normales)
**Action** : Aucune (déjà géré gracieusement)

---

### 5.2 Timeouts vérification auth/services/coursier

**Messages** :
- `[AuthContext] ⚠️ Timeout vérification auth (5s)`
- `[AppNavigator] Timeout vérification services spécialisés`
- `[AppNavigator] Timeout vérification coursier`

**Impact** : Faible-Moyen (features non bloquantes)
**Causes** : Probablement liées aux requêtes SQL lentes
**Action** : Résoudre les requêtes SQL lentes

---

### 5.3 Feature Flags 404

**Message** : `[FeatureFlagContext] ❌ Erreur lors du chargement des feature flags: HTTP 404`
**Impact** : Faible (endpoint peut ne pas exister)
**Action** : Vérifier si l'endpoint doit exister

---

### 5.4 Pipeline Health "Critical"

**Message** : `[PipelineWorker] Statut pipeline "critical" | stale_jobs=0 | failed24h=1`
**Impact** : Moyen (monitoring)
**Action** : Vérifier les jobs en échec

---

## 📋 PRIORITÉS DE CORRECTION

### 🔴 PRIORITÉ CRITIQUE (Impact immédiat)

1. **Pool de connexions DB** - Résout de nombreux autres problèmes
2. **SELECT deliveries** - Requête la plus fréquente et lente
3. **UPDATE delivery_matching_queue** - Fréquent et lent

### 🟡 PRIORITÉ HAUTE

4. **find_nearby_couriers** - Impact matching livraisons
5. **product_creation_queue (INSERT)** - Création produits
6. **SELECT product_creation_queue** - Worker de queue

### 🟢 PRIORITÉ MOYENNE

7. **SELECT delivery_matching_queue** - Worker matching
8. **SELECT delivery_parcels** - Optimisation simple
9. **Traitement média base64** - Validation améliorée

### ⚪ PRIORITÉ FAIBLE

10. **Requêtes HTTP lentes** - Peut être résolu en optimisant SQL
11. **Warnings applicatifs** - Déjà gérés gracieusement

---

## 🎯 PLAN D'ACTION RECOMMANDÉ

1. **Phase 1 : Pool de connexions** (Impact immédiat sur tous les problèmes)
   - Augmenter max_connections
   - Monitoring du pool
   - Read replica pour lectures

2. **Phase 2 : Optimisation deliveries** (Plus grande amélioration)
   - Index GIST sur colonnes géométriques
   - Vues matérialisées pour lat/lng
   - Optimisation conversions PostGIS

3. **Phase 3 : Optimisation queues** (Performance système)
   - Index composites sur delivery_matching_queue
   - Index sur product_creation_queue
   - Optimisation find_nearby_couriers

4. **Phase 4 : Validation et monitoring** (Robustesse)
   - Validation base64 améliorée
   - Monitoring des performances
   - Alertes sur requêtes lentes

