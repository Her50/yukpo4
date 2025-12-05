# Analyse des logs backend - 2025-11-30 16:15-16:16

## 📊 Vue d'ensemble

Analyse des logs système sur une période d'environ 1 minute (16:15:56 - 16:16:46) montrant l'activité normale du backend Yukpomnang.

## ✅ Points positifs

### 1. **Connexion LiveKit réussie**
```
✅ LiveKit: Connexion établie avec succès (tentative 1)
```
- Connexion initiale réussie au service LiveKit (46.224.14.85:7880)
- Pool de connexions HTTP réutilisé efficacement
- Aucune erreur de connexion

### 2. **Pool de base de données sain**
```
[DB Monitor] ✅ Pool healthy - Size: 10, Active: 0, Idle: 10
```
- Pool PostgreSQL fonctionnel avec 10 connexions disponibles
- Toutes les connexions sont inactives (idle), aucune saturation
- Monitoring actif toutes les 30 secondes (configurable via `DB_HEALTH_CHECK_INTERVAL_SECS`)

### 3. **Requêtes SQL performantes**
- Toutes les requêtes s'exécutent rapidement (< 5ms pour la plupart)
- Aucune requête lente détectée
- Index utilisés efficacement

### 4. **Tâches périodiques opérationnelles**
- **Pipeline Health Worker** : Exécution régulière (toutes les ~15 secondes selon les logs)
- **Delivery Matching Worker** : Aucune livraison en attente (état normal)
- **Global Promo Scheduler** : Vérification des événements promotionnels
- **Live Flash Sale Scheduler** : Vérification des ventes flash

## 📈 Patterns d'exécution observés

### Tâches exécutées toutes les ~15 secondes
1. **Pipeline Health Monitoring** (`pipeline_health_worker.rs`)
   - Requêtes sur `video_generation_jobs` (statistiques par statut)
   - Requêtes sur `media` (comptage vidéos)
   - Requêtes sur `media_engagement` (vues, partages, qualité)
   - Requêtes sur `media_distribution` (statut distribution)

### Tâches exécutées toutes les ~30 secondes
1. **DB Health Monitor** (`db_monitor.rs`)
   - Test de connexion PostgreSQL
   - Vérification du pool (size, active, idle)
   - Alerte si saturation > 80%

2. **Delivery Matching Worker** (`delivery_matching_worker.rs`)
   - Traitement de la file `delivery_matching_queue`
   - Batch size: 10 (configurable via `DELIVERY_MATCHING_WORKER_BATCH_SIZE`)
   - Intervalle: 30s (configurable via `DELIVERY_MATCHING_WORKER_INTERVAL_SECS`)

### Tâches exécutées périodiquement
1. **Global Promo Scheduler** (`global_promo_scheduler.rs`)
   - Vérification des événements promotionnels à démarrer
   - Vérification des événements à terminer
   - Gestion des entrées approuvées

2. **Live Flash Sale Scheduler** (`live_flash_sale_scheduler.rs`)
   - Vérification des ventes flash programmées
   - Gestion des notifications de début/fin
   - Gestion des commentaires IA (si activés)

## 🔍 Détails des requêtes SQL

### Requêtes Pipeline Health (toutes les ~15s)

#### 1. Statistiques des jobs vidéo par statut
```sql
SELECT status, COUNT(*)::bigint AS count
FROM video_generation_jobs
GROUP BY status
```
- **Performance** : ~0.8-2.8ms
- **Résultats** : 2 statuts retournés (probablement 'completed' et 'failed')

#### 2. Jobs échoués (24h)
```sql
SELECT COUNT(*)::bigint AS count
FROM video_generation_jobs
WHERE status = 'failed'
  AND updated_at >= NOW() - INTERVAL '24 hours'
```
- **Performance** : ~1.7-3.9ms

#### 3. Jobs complétés (24h)
```sql
SELECT COUNT(*)::bigint AS count
FROM video_generation_jobs
WHERE status = 'completed'
  AND updated_at >= NOW() - INTERVAL '24 hours'
```
- **Performance** : ~1.5-2.8ms

#### 4. Dernier job complété
```sql
SELECT MAX(updated_at) AS last_completed
FROM video_generation_jobs
WHERE status = 'completed'
```
- **Performance** : ~0.7-1.7ms

#### 5. Jobs stale (bloqués > 30 min)
```sql
SELECT job_id, status, updated_at
FROM video_generation_jobs
WHERE status IN ('queued', 'running')
  AND updated_at < NOW() - INTERVAL '30 minutes'
ORDER BY updated_at ASC
LIMIT 10
```
- **Performance** : ~1.6-2.2ms
- **Résultats** : 0 jobs stale (état sain)

#### 6. Vidéos générées (7 jours)
```sql
SELECT COUNT(*) AS total
FROM media
WHERE media_type = 'video'
  AND uploaded_at >= NOW() - ($1::int * INTERVAL '1 day')
```
- **Performance** : ~2.1-2.2ms

#### 7. Engagement média (vues, partages, qualité)
```sql
SELECT
    COUNT(*) FILTER (WHERE event_type = 'view')   AS views,
    COUNT(*) FILTER (WHERE event_type = 'share')  AS shares,
    COALESCE(AVG((metadata ->> 'quality_score')::float), 0.0) AS avg_quality
FROM media_engagement
WHERE occurred_at >= NOW() - ($1::int * INTERVAL '1 day')
  AND event_type IN ('view', 'share', 'quality_score')
```
- **Performance** : ~2.0-2.3ms

#### 8. Distribution média
```sql
SELECT
    COUNT(*) FILTER (WHERE status = 'completed')                       AS completed,
    COUNT(*) FILTER (WHERE status IN ('scheduled', 'processing'))      AS pending
FROM media_distribution
WHERE updated_at >= NOW() - ($1::int * INTERVAL '1 day')
```
- **Performance** : ~1.7-1.9ms

### Requêtes Delivery Matching (toutes les ~30s)

```sql
SELECT id, delivery_id, zone_id, status, priority, attempt_count,
       payload, next_attempt_at, enqueued_at, updated_at
FROM delivery_matching_queue
WHERE status IN ('queued', 'searching')
  AND next_attempt_at <= NOW()
ORDER BY priority ASC, next_attempt_at ASC
LIMIT $1
```
- **Performance** : ~0.9-5.2ms
- **Résultats** : 0 livraisons à traiter (état normal)

### Requêtes Global Promo (périodiques)

#### Événements à démarrer
```sql
SELECT id, display_name
FROM global_promo_events
WHERE status = 'scheduled' AND starts_at <= $1
```
- **Performance** : ~0.8-1.8ms
- **Résultats** : 0 événements à démarrer

#### Événements à terminer
```sql
SELECT id, display_name
FROM global_promo_events
WHERE status IN ('scheduled','live') AND ends_at <= $1
```
- **Performance** : ~1.4-1.7ms
- **Résultats** : 0 événements à terminer

### Requêtes Live Flash Sale (périodiques)

#### Ventes flash programmées à démarrer
```sql
SELECT lfs.id, lfs.live_session_id, lfs.service_id, lfs.promo_price_cfa,
       lfs.start_at, lfs.scheduled_notification_sent_at,
       ls.host_user_id, ls.service_id AS primary_service_id,
       ls.metadata, ls.title
FROM live_flash_sales lfs
JOIN live_sessions ls ON ls.id = lfs.live_session_id
WHERE lfs.status = 'scheduled'
  AND lfs.start_at <= $1
  AND lfs.scheduled_notification_sent_at IS NULL
```
- **Performance** : ~1.8-2.4ms
- **Résultats** : 0 ventes flash à démarrer

#### Ventes flash en cours à terminer
```sql
SELECT lfs.id, lfs.live_session_id, lfs.service_id, lfs.end_at,
       lfs.ending_notification_sent_at,
       ls.host_user_id, ls.service_id AS primary_service_id,
       ls.metadata, ls.title
FROM live_flash_sales lfs
JOIN live_sessions ls ON ls.id = lfs.live_session_id
WHERE lfs.status = 'live'
  AND lfs.end_at <= $1
  AND lfs.ending_notification_sent_at IS NULL
```
- **Performance** : ~1.6-1.9ms
- **Résultats** : 0 ventes flash à terminer

#### Commentaires IA pour ventes flash en cours
```sql
WITH reservations AS (
    SELECT flash_sale_id, SUM(quantity) AS reserved_quantity
    FROM live_flash_sale_reservations
    GROUP BY flash_sale_id
)
SELECT lfs.id, lfs.live_session_id, lfs.service_id, lfs.stock_target,
       COALESCE(res.reserved_quantity, 0) AS reserved_quantity,
       lfs.commentary_interval_seconds, lfs.last_commentary_sent_at,
       lfs.end_at, COALESCE(lfs.metadata, '{}'::jsonb) AS flash_metadata,
       ls.host_user_id, ls.service_id AS primary_service_id,
       COALESCE(ls.metadata, '{}'::jsonb) AS session_metadata, ls.title
FROM live_flash_sales lfs
JOIN live_sessions ls ON ls.id = lfs.live_session_id
LEFT JOIN reservations res ON res.flash_sale_id = lfs.id
WHERE lfs.status = 'live'
  AND lfs.commentary_mode = 'ai_voice'
  AND lfs.end_at > $1
  AND (lfs.last_commentary_sent_at IS NULL
       OR lfs.last_commentary_sent_at <= $1 - make_interval(secs => lfs.commentary_interval_seconds))
```
- **Performance** : ~2.3-2.4ms
- **Résultats** : 0 commentaires IA à générer

## ⚠️ Observations et recommandations

### 1. **Fréquence des requêtes Pipeline Health**
**Observation** : Les requêtes de monitoring pipeline s'exécutent toutes les ~15 secondes selon les logs, alors que le worker interne est configuré pour 300 secondes (5 minutes).

**Cause identifiée** : Il existe des **endpoints API** qui appellent `compute_pipeline_health` :
- `/internal/health/pipeline` (system_health_controller.rs)
- `/internal/metrics/pipeline` (metrics_controller.rs - format Prometheus)

Ces endpoints sont probablement interrogés par un système de monitoring externe (Prometheus, Grafana, healthcheck, etc.) qui fait du polling toutes les 15 secondes.

**Recommandation** : 
- ✅ **Pas d'action requise** si c'est un système de monitoring externe qui fait le polling (comportement normal)
- Si vous voulez réduire la fréquence, configurer le système de monitoring externe pour qu'il interroge moins souvent (ex: 60-120 secondes)
- Le worker interne (`PIPELINE_HEALTH_CHECK_INTERVAL_SECS=300`) continue de fonctionner correctement en arrière-plan

### 2. **Aucune activité détectée**
- Aucun job vidéo en cours (queued/running)
- Aucune livraison en attente de matching
- Aucun événement promotionnel actif
- Aucune vente flash en cours

**Interprétation** : État normal pour un système en période de faible activité. Les workers continuent de surveiller mais n'ont rien à traiter.

### 3. **Performance des requêtes**
Toutes les requêtes s'exécutent rapidement (< 5ms), ce qui indique :
- Index bien configurés
- Base de données non surchargée
- Requêtes optimisées

### 4. **Pool de connexions**
- Pool sain avec 10 connexions disponibles
- Aucune connexion active (0% utilisation)
- Configuration appropriée pour la charge actuelle

## 📝 Configuration recommandée

### Variables d'environnement vérifiées

```bash
# Pipeline Health Worker (tâche interne)
PIPELINE_HEALTH_CHECK_INTERVAL_SECS=300  # ✅ Confirmé: 300s (5 minutes)

# DB Health Monitor
DB_HEALTH_CHECK_INTERVAL_SECS=30  # ✅ OK

# Delivery Matching Worker
DELIVERY_MATCHING_WORKER_INTERVAL_SECS=30  # ✅ OK
DELIVERY_MATCHING_WORKER_BATCH_SIZE=10  # ✅ OK
```

### Endpoints API de monitoring

Les requêtes toutes les ~15 secondes proviennent probablement d'appels externes à ces endpoints :
- `GET /internal/health/pipeline` - Health check du pipeline
- `GET /internal/metrics/pipeline` - Métriques Prometheus

**Note** : Si vous utilisez Prometheus ou un autre système de monitoring, vérifier la configuration du scraping (intervalle de polling) dans votre configuration Prometheus/Grafana.

## ✅ Conclusion

**État général** : ✅ **SYSTÈME SAIN**

- Toutes les tâches périodiques fonctionnent correctement
- Aucune erreur détectée
- Performance des requêtes SQL excellente
- Pool de base de données sain
- Connexions externes (LiveKit) opérationnelles

**Action requise** : Aucune action urgente. 

**Explication** : Les requêtes toutes les ~15 secondes proviennent probablement d'un système de monitoring externe (Prometheus, healthcheck, etc.) qui interroge les endpoints `/internal/health/pipeline` ou `/internal/metrics/pipeline`. Le worker interne fonctionne correctement avec un intervalle de 300 secondes.

