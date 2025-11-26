# 🔍 Investigation des Échecs du Pipeline Worker

*Date: 2025-11-25*  
*Statut: 4 échecs dans les dernières 24h*

## 📊 Contexte

Le pipeline worker signale un statut "degraded" avec :
- `stale_jobs=0` ✅ (pas de jobs bloqués)
- `failed24h=4` ⚠️ (4 échecs dans les dernières 24h)
- `status="degraded"` ⚠️

## 🎯 Objectif

Identifier les 4 jobs qui ont échoué et comprendre les causes d'échec pour :
1. Corriger les problèmes récurrents
2. Améliorer la gestion d'erreur
3. Prévenir de futurs échecs

---

## 📋 Script SQL d'Investigation

### 1. Liste des 4 Jobs Échoués (Dernières 24h)

```sql
SELECT 
    job_id,
    user_id,
    service_id,
    product_index,
    status,
    error_message,
    progress_steps,
    created_at,
    updated_at,
    EXTRACT(EPOCH FROM (updated_at - created_at)) / 60 AS duration_minutes
FROM video_generation_jobs
WHERE status = 'failed'
  AND updated_at >= NOW() - INTERVAL '24 hours'
ORDER BY updated_at DESC
LIMIT 10;
```

### 2. Analyse Détaillée des Erreurs

```sql
SELECT 
    job_id,
    error_message,
    CASE 
        WHEN error_message LIKE '%timeout%' OR error_message LIKE '%Timeout%' THEN 'TIMEOUT'
        WHEN error_message LIKE '%API%' OR error_message LIKE '%api%' THEN 'API_ERROR'
        WHEN error_message LIKE '%storage%' OR error_message LIKE '%S3%' OR error_message LIKE '%Wasabi%' THEN 'STORAGE_ERROR'
        WHEN error_message LIKE '%memory%' OR error_message LIKE '%Memory%' THEN 'MEMORY_ERROR'
        WHEN error_message LIKE '%network%' OR error_message LIKE '%Network%' OR error_message LIKE '%connection%' THEN 'NETWORK_ERROR'
        WHEN error_message LIKE '%IA%' OR error_message LIKE '%AI%' OR error_message LIKE '%OpenAI%' OR error_message LIKE '%Anthropic%' THEN 'AI_ERROR'
        WHEN error_message LIKE '%database%' OR error_message LIKE '%Database%' OR error_message LIKE '%PostgreSQL%' THEN 'DATABASE_ERROR'
        ELSE 'OTHER'
    END AS error_category,
    updated_at,
    EXTRACT(EPOCH FROM (updated_at - created_at)) / 60 AS duration_minutes
FROM video_generation_jobs
WHERE status = 'failed'
  AND updated_at >= NOW() - INTERVAL '24 hours'
ORDER BY updated_at DESC;
```

### 3. Statistiques par Catégorie d'Erreur

```sql
SELECT 
    CASE 
        WHEN error_message LIKE '%timeout%' OR error_message LIKE '%Timeout%' THEN 'TIMEOUT'
        WHEN error_message LIKE '%API%' OR error_message LIKE '%api%' THEN 'API_ERROR'
        WHEN error_message LIKE '%storage%' OR error_message LIKE '%S3%' OR error_message LIKE '%Wasabi%' THEN 'STORAGE_ERROR'
        WHEN error_message LIKE '%memory%' OR error_message LIKE '%Memory%' THEN 'MEMORY_ERROR'
        WHEN error_message LIKE '%network%' OR error_message LIKE '%Network%' OR error_message LIKE '%connection%' THEN 'NETWORK_ERROR'
        WHEN error_message LIKE '%IA%' OR error_message LIKE '%AI%' OR error_message LIKE '%OpenAI%' OR error_message LIKE '%Anthropic%' THEN 'AI_ERROR'
        WHEN error_message LIKE '%database%' OR error_message LIKE '%Database%' OR error_message LIKE '%PostgreSQL%' THEN 'DATABASE_ERROR'
        ELSE 'OTHER'
    END AS error_category,
    COUNT(*) AS count,
    AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 60) AS avg_duration_minutes,
    MIN(updated_at) AS first_failure,
    MAX(updated_at) AS last_failure
FROM video_generation_jobs
WHERE status = 'failed'
  AND updated_at >= NOW() - INTERVAL '24 hours'
GROUP BY error_category
ORDER BY count DESC;
```

### 4. Jobs Échoués avec Détails du Service

```sql
SELECT 
    vgj.job_id,
    vgj.user_id,
    vgj.service_id,
    vgj.product_index,
    vgj.error_message,
    vgj.created_at,
    vgj.updated_at,
    s.category AS service_category,
    s.is_active AS service_active,
    u.email AS user_email
FROM video_generation_jobs vgj
LEFT JOIN services s ON vgj.service_id = s.id
LEFT JOIN users u ON vgj.user_id = u.id
WHERE vgj.status = 'failed'
  AND vgj.updated_at >= NOW() - INTERVAL '24 hours'
ORDER BY vgj.updated_at DESC;
```

### 5. Progression des Jobs Échoués (Analyse des Steps)

```sql
SELECT 
    job_id,
    error_message,
    progress_steps::jsonb->-1 AS last_step,
    jsonb_array_length(progress_steps::jsonb) AS total_steps,
    updated_at
FROM video_generation_jobs
WHERE status = 'failed'
  AND updated_at >= NOW() - INTERVAL '24 hours'
  AND progress_steps IS NOT NULL
ORDER BY updated_at DESC;
```

---

## 🔍 Points d'Investigation

### 1. Analyse des Messages d'Erreur

Les erreurs peuvent provenir de plusieurs sources :

#### A. Erreurs IA (OpenAI, Anthropic, etc.)
- **Symptômes** : Messages contenant "OpenAI", "Anthropic", "API", "quota", "rate limit"
- **Causes possibles** :
  - Quota API dépassé
  - Rate limiting
  - Clés API invalides
  - Timeout des requêtes IA
- **Actions** :
  - Vérifier les quotas API
  - Vérifier les clés API dans Render.com
  - Augmenter les timeouts si nécessaire

#### B. Erreurs de Stockage (S3/Wasabi)
- **Symptômes** : Messages contenant "S3", "Wasabi", "storage", "upload", "bucket"
- **Causes possibles** :
  - Permissions insuffisantes
  - Bucket inexistant ou inaccessible
  - Espace disque insuffisant
  - Problème réseau avec Wasabi
- **Actions** :
  - Vérifier les credentials Wasabi
  - Vérifier l'accessibilité du bucket `yukpo-video-prod`
  - Vérifier l'espace disque disponible

#### C. Erreurs de Timeout
- **Symptômes** : Messages contenant "timeout", "Timeout", "deadline"
- **Causes possibles** :
  - Jobs trop longs (dépassent les timeouts configurés)
  - Ressources insuffisantes (CPU/mémoire)
  - Problèmes réseau
- **Actions** :
  - Vérifier les timeouts dans `TimeoutConfig`
  - Optimiser les jobs longs
  - Augmenter les ressources si nécessaire

#### D. Erreurs de Mémoire
- **Symptômes** : Messages contenant "memory", "Memory", "OOM", "out of memory"
- **Causes possibles** :
  - Jobs trop gourmands en mémoire
  - Fuites mémoire
  - Ressources Render insuffisantes
- **Actions** :
  - Optimiser l'utilisation mémoire
  - Augmenter les ressources Render
  - Implémenter un garbage collection

#### E. Erreurs Réseau
- **Symptômes** : Messages contenant "network", "connection", "refused", "unreachable"
- **Causes possibles** :
  - Problèmes de connectivité
  - Services externes indisponibles
  - Firewall bloquant
- **Actions** :
  - Vérifier la connectivité réseau
  - Vérifier l'accessibilité des services externes

---

## 🛠️ Actions Correctives Recommandées

### Phase 1 : Diagnostic (Immédiat)

1. **Exécuter les scripts SQL ci-dessus** pour identifier les 4 jobs échoués
2. **Analyser les messages d'erreur** pour catégoriser les problèmes
3. **Vérifier les logs détaillés** dans Render.com pour chaque job

### Phase 2 : Corrections (Court terme)

Selon les résultats de l'analyse :

#### Si erreurs IA :
- [ ] Vérifier les quotas API (OpenAI, Anthropic, etc.)
- [ ] Vérifier les clés API dans les variables d'environnement
- [ ] Implémenter un retry avec backoff exponentiel
- [ ] Ajouter un fallback vers d'autres modèles IA

#### Si erreurs stockage :
- [ ] Vérifier les credentials Wasabi
- [ ] Tester l'upload manuel vers le bucket
- [ ] Vérifier les permissions IAM
- [ ] Implémenter un retry pour les uploads

#### Si erreurs timeout :
- [ ] Augmenter les timeouts dans `TimeoutConfig`
- [ ] Optimiser les jobs longs (parallélisation, cache)
- [ ] Implémenter un système de checkpointing

#### Si erreurs mémoire :
- [ ] Profiler l'utilisation mémoire
- [ ] Optimiser les allocations mémoire
- [ ] Augmenter les ressources Render si nécessaire

### Phase 3 : Améliorations (Moyen terme)

1. **Améliorer le logging** :
   - Ajouter plus de contexte dans les messages d'erreur
   - Logger les métriques de performance (durée, mémoire, etc.)
   - Logger les étapes de progression avant l'échec

2. **Implémenter un système de retry intelligent** :
   - Retry automatique pour les erreurs transitoires
   - Backoff exponentiel
   - Limite de tentatives

3. **Monitoring proactif** :
   - Alertes Slack/Email pour les échecs
   - Dashboard de métriques
   - Alertes si `failed24h > 10`

4. **Tests de charge** :
   - Tester la génération vidéo sous charge
   - Identifier les goulots d'étranglement
   - Optimiser les performances

---

## 📝 Template de Rapport d'Investigation

Après exécution des scripts SQL, remplir ce template :

```markdown
## Rapport d'Investigation - [DATE]

### Jobs Échoués Identifiés

| Job ID | Service ID | Product Index | Erreur | Catégorie | Durée (min) |
|--------|------------|---------------|--------|-----------|-------------|
| ...    | ...        | ...           | ...    | ...       | ...         |

### Analyse par Catégorie

- **TIMEOUT** : X jobs
- **API_ERROR** : X jobs
- **STORAGE_ERROR** : X jobs
- **MEMORY_ERROR** : X jobs
- **NETWORK_ERROR** : X jobs
- **AI_ERROR** : X jobs
- **DATABASE_ERROR** : X jobs
- **OTHER** : X jobs

### Cause Racine Identifiée

[Description de la cause principale]

### Actions Correctives

1. [Action 1]
2. [Action 2]
3. [Action 3]

### Résultats Attendus

[Description des résultats attendus après corrections]
```

---

## 🔗 Références

- **Code source** : `backend/src/services/video_generation_service.rs`
- **Service de jobs** : `backend/src/services/video_job_service.rs`
- **Contrôleur** : `backend/src/controllers/product_video_controller.rs`
- **Health check** : `backend/src/services/pipeline_health_service.rs`
- **Worker** : `backend/src/tasks/pipeline_health_worker.rs`

---

## 📞 Prochaines Étapes

1. **Exécuter les scripts SQL** sur la base de données de production
2. **Analyser les résultats** et identifier les patterns
3. **Créer un ticket** pour chaque type d'erreur identifié
4. **Implémenter les corrections** selon les priorités
5. **Surveiller** les métriques après corrections

---

*Document créé le 2025-11-25 pour investigation des échecs du pipeline worker*

