# Optimisations SQL et Ajustement des Intervalles de Monitoring

## 📋 Résumé

Ce document décrit les optimisations SQL et les ajustements des intervalles de monitoring effectués suite à l'analyse des logs du 2025-11-28.

---

## 🗄️ Optimisations SQL

### Migration créée

**Fichier**: `backend/migrations/20251128_004_optimize_monitoring_queries.sql`

### Index créés (11 optimisations)

#### 1. Video Generation Jobs (4 index)
- `idx_video_generation_jobs_status` - Pour GROUP BY status
- `idx_video_generation_jobs_status_updated_at` - Pour les requêtes de comptage par période
- `idx_video_generation_jobs_completed_updated_at` - Pour MAX(updated_at) WHERE status = 'completed'
- `idx_video_generation_jobs_stale` - Pour détecter les jobs bloqués

**Impact**: Réduction attendue de ~800µs à <500µs pour les requêtes de monitoring toutes les 15s

#### 2. Media (1 index)
- `idx_media_type_uploaded_at` - Pour COUNT(*) WHERE media_type = 'video' AND uploaded_at >= ...

**Impact**: Réduction attendue de ~2.4ms à <1ms

#### 3. Media Engagement (1 index)
- `idx_media_engagement_event_occurred` - Pour COUNT(*) FILTER avec event_type et occurred_at

**Impact**: Réduction attendue de ~2.7ms à <1ms

#### 4. Media Distribution (1 index)
- `idx_media_distribution_status_updated_at` - Pour les statistiques de distribution

**Impact**: Amélioration des requêtes toutes les 15s

#### 5. Live Flash Sales (4 index)
- `idx_live_flash_sales_status_start_at` - Pour les flash sales programmés
- `idx_live_flash_sales_status_end_at` - Pour les flash sales à terminer
- `idx_live_flash_sales_live_session_id` - Pour optimiser les JOINs
- `idx_live_flash_sales_status_end_at_for_update` - Pour les UPDATE de statut

**Impact**: Réduction attendue de ~3.4ms à <1ms

#### 6. Autres tables (5 index)
- `global_promo_events` (2 index)
- `delivery_matching_queue` (1 index)
- `product_orders` (1 index)
- `delivery_proximity_suggestions` (1 index)
- `deliveries` (1 index)
- `social_publication_jobs` (1 index)

### Application de la migration

```bash
cd backend
sqlx migrate run
```

---

## ⚙️ Ajustement des Intervalles de Monitoring

### Variables d'environnement ajoutées

Tous les intervalles sont maintenant configurables via variables d'environnement avec des valeurs par défaut raisonnables.

#### 1. DB Health Monitor
- **Variable**: `DB_HEALTH_CHECK_INTERVAL_SECS`
- **Défaut**: `30` secondes
- **Fichier**: `backend/src/utils/db_monitor.rs`

**Recommandation**: 
- Production normale: `30s` (défaut)
- Charge élevée: `60s`
- Développement: `30s`

#### 2. Pipeline Health Worker
- **Variable**: `PIPELINE_HEALTH_CHECK_INTERVAL_SECS`
- **Défaut**: `300` secondes (5 minutes)
- **Fichier**: `backend/src/tasks/pipeline_health_worker.rs`

**Recommandation**:
- Production normale: `300s` (5 min) - défaut
- Charge élevée: `600s` (10 min)
- Monitoring intensif: `180s` (3 min)

#### 3. Delivery Matching Worker
- **Variable**: `DELIVERY_MATCHING_WORKER_INTERVAL_SECS`
- **Défaut**: `30` secondes
- **Variable**: `DELIVERY_MATCHING_WORKER_BATCH_SIZE`
- **Défaut**: `10`
- **Fichier**: `backend/src/tasks/delivery_matching_worker.rs`

**Recommandation**:
- Production normale: `30s` interval, `10` batch (défaut)
- Charge élevée: `60s` interval, `20` batch
- Charge faible: `30s` interval, `5` batch

#### 4. Global Promo Scheduler
- **Variable**: `GLOBAL_PROMO_SCHEDULER_INTERVAL_SECS`
- **Défaut**: `30` secondes
- **Fichier**: `backend/src/tasks/global_promo_scheduler.rs`

**Recommandation**:
- Production normale: `30s` (défaut)
- Charge élevée: `60s`
- Événements fréquents: `30s`

#### 5. Order Timeout Monitor
- **Variable**: `ORDER_TIMEOUT_MONITOR_INTERVAL_SECS`
- **Défaut**: `60` secondes
- **Fichier**: `backend/src/tasks/order_timeout_monitor.rs`

**Recommandation**:
- Production normale: `60s` (défaut)
- Charge élevée: `120s` (2 min)
- Validation critique: `60s`

#### 6. Delivery Timeout Monitor
- **Variable**: `DELIVERY_TIMEOUT_MONITOR_INTERVAL_SECS`
- **Défaut**: `60` secondes
- **Fichier**: `backend/src/tasks/delivery_timeout_monitor.rs`

**Recommandation**:
- Production normale: `60s` (défaut)
- Charge élevée: `120s` (2 min)
- Livraisons urgentes: `60s`

---

## 📊 Impact attendu

### Performance SQL

| Requête | Avant | Après (attendu) | Amélioration |
|---------|-------|-----------------|--------------|
| Video generation stats | ~800µs | <500µs | ~40% |
| Media count | ~2.4ms | <1ms | ~60% |
| Media engagement | ~2.7ms | <1ms | ~65% |
| Live flash sales | ~3.4ms | <1ms | ~70% |

### Charge base de données

**Avant**:
- ~64-74 requêtes SQL/minute pour monitoring
- Certaines requêtes >2ms

**Après**:
- Même nombre de requêtes (intervalles configurables)
- Toutes les requêtes <1ms (grâce aux index)
- Réduction de ~40-70% du temps total de requêtes

### Flexibilité

- Intervalles ajustables sans redéploiement (variables d'environnement)
- Possibilité d'augmenter les intervalles en cas de charge élevée
- Monitoring adaptatif selon l'environnement

---

## 🚀 Déploiement

### 1. Appliquer la migration SQL

```bash
cd backend
sqlx migrate run
```

### 2. Configurer les variables d'environnement (optionnel)

Si vous souhaitez ajuster les intervalles par défaut, ajoutez dans votre `.env` ou configuration cloud:

```bash
# Monitoring (optionnel - valeurs par défaut utilisées si non définies)
DB_HEALTH_CHECK_INTERVAL_SECS=30
PIPELINE_HEALTH_CHECK_INTERVAL_SECS=300
DELIVERY_MATCHING_WORKER_INTERVAL_SECS=30
DELIVERY_MATCHING_WORKER_BATCH_SIZE=10
GLOBAL_PROMO_SCHEDULER_INTERVAL_SECS=30
ORDER_TIMEOUT_MONITOR_INTERVAL_SECS=60
DELIVERY_TIMEOUT_MONITOR_INTERVAL_SECS=60
```

### 3. Redémarrer le service

```bash
# Sur Render ou votre plateforme
# Le service redémarrera automatiquement avec les nouvelles configurations
```

---

## 📈 Monitoring post-déploiement

### Vérifier les performances

1. **Vérifier les temps de requête dans les logs**:
   - Les requêtes de monitoring devraient être <1ms
   - Plus de requêtes >2ms

2. **Vérifier l'utilisation du pool DB**:
   - Le pool devrait rester sain (<80% utilisation)
   - Moins de connexions actives grâce aux requêtes plus rapides

3. **Vérifier les index**:
   ```sql
   -- Vérifier que les index sont créés
   SELECT indexname, tablename 
   FROM pg_indexes 
   WHERE indexname LIKE 'idx_%monitoring%' 
      OR indexname LIKE 'idx_video_generation%'
      OR indexname LIKE 'idx_media%'
      OR indexname LIKE 'idx_live_flash%';
   ```

### Ajuster les intervalles si nécessaire

Si la charge DB augmente:
- Augmenter `PIPELINE_HEALTH_CHECK_INTERVAL_SECS` à 600 (10 min)
- Augmenter `DB_HEALTH_CHECK_INTERVAL_SECS` à 60
- Augmenter `GLOBAL_PROMO_SCHEDULER_INTERVAL_SECS` à 60
- Augmenter `ORDER_TIMEOUT_MONITOR_INTERVAL_SECS` à 120 (2 min)
- Augmenter `DELIVERY_TIMEOUT_MONITOR_INTERVAL_SECS` à 120 (2 min)

---

## 🔍 Détails techniques

### Index partiels (WHERE clauses)

Les index utilisent des clauses `WHERE` pour:
- Réduire la taille des index
- Améliorer les performances de recherche
- Cibler uniquement les données pertinentes

Exemple:
```sql
CREATE INDEX idx_video_generation_jobs_status_updated_at 
ON video_generation_jobs (status, updated_at DESC)
WHERE status IN ('failed', 'completed', 'queued', 'running');
```

### Index composites

Les index composites permettent des recherches rapides sur plusieurs colonnes:
- `(status, updated_at DESC)` - Pour les requêtes avec WHERE status = X AND updated_at >= Y
- `(status, next_attempt_at ASC, priority ASC)` - Pour les files d'attente triées

### ANALYZE

La migration exécute `ANALYZE` sur toutes les tables concernées pour:
- Mettre à jour les statistiques du planificateur PostgreSQL
- Permettre au planificateur de choisir les meilleurs index
- Optimiser les plans d'exécution

---

## 📝 Notes

- Les index partiels réduisent l'espace disque nécessaire
- Les valeurs par défaut des intervalles sont optimisées pour la production normale
- En cas de charge exceptionnelle, augmenter les intervalles plutôt que de réduire
- Les index sont automatiquement utilisés par PostgreSQL si pertinents

---

**Date**: 2025-11-28  
**Auteur**: Auto (AI Assistant)  
**Version**: 1.0

