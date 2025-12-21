# Vérification du Matching de Coursier

**Date**: 2025-12-21  
**Objectif**: Vérifier si le matching de coursier fonctionne dans les logs fournis

## ✅ Vérifications du Code

### 1. Worker démarré dans `main.rs`
- **Ligne 737**: `tasks::delivery_matching_worker::start_delivery_matching_worker(app_state.clone());`
- **Status**: ✅ Le worker est bien démarré

### 2. Configuration du Worker
- **Intervalle par défaut**: 10 secondes (`DELIVERY_MATCHING_WORKER_INTERVAL_SECS`)
- **Batch size par défaut**: 50 (`DELIVERY_MATCHING_WORKER_BATCH_SIZE`)
- **Workers parallèles par défaut**: 3 (`DELIVERY_MATCHING_WORKER_PARALLEL`)
- **Cache TTL**: 30 secondes (`DELIVERY_MATCHING_EMPTY_CACHE_TTL_SECS`)

### 3. Processus de Matching
1. **Worker** (`DeliveryMatchingWorker`) s'exécute toutes les 10 secondes
2. **Récupération** des livraisons en file (`fetch_matching_queue_batch`)
3. **Traitement** de chaque livraison (`process_matching_backlog`)
4. **Matching** (`attempt_auto_matching`) :
   - Récupération des candidats (`list_matching_candidates`)
   - Calcul du score pour chaque candidat
   - Assignation du meilleur candidat
   - Mise à jour du statut dans `delivery_matching_queue`

## 🔍 Analyse des Logs à Rechercher

### Logs du Worker
```
[DeliveryMatchingWorker] X livraison(s) retraitées
[DeliveryMatchingWorker] Aucune livraison à traiter
[DeliveryMatchingWorker] Worker X: X livraison(s) retraitées
[DeliveryMatchingWorker] Cache actif: skip requête
```

### Requêtes SQL sur `delivery_matching_queue`
```sql
SELECT ... FROM delivery_matching_queue 
WHERE status IN ('queued', 'searching') 
AND next_attempt_at <= NOW()
ORDER BY priority ASC, next_attempt_at ASC
LIMIT 50
```

### Requêtes SQL de Matching
```sql
-- Option 1: Fonction optimisée
SELECT ... FROM find_nearby_couriers($1, $2, $3, $4, $5)

-- Option 2: Méthode classique
SELECT ... FROM courier_availability_snapshots cas
LEFT JOIN LATERAL (...) cza ON TRUE
WHERE cas.captured_at >= NOW() - INTERVAL '30 minutes'
AND cas.is_online = TRUE
AND cas.active_deliveries < cas.max_capacity
```

### Logs du Service de Matching
```
[DeliveryMatching] Cache hit pour pickup (...)
[DeliveryMatching] Cache miss pour pickup (...)
[DeliveryMatching] Tentative échouée pour {delivery_id}: {error}
[DeliveryMatching] Matching réussi pour {delivery_id}
```

## 📊 Résultats de l'Analyse des Logs

### Indicateurs Positifs ✅
- [ ] Logs `[DeliveryMatchingWorker]` présents
- [ ] Requêtes SQL sur `delivery_matching_queue` présentes
- [ ] Requêtes `list_matching_candidates` ou `find_nearby_couriers` présentes
- [ ] Logs de succès/échec du matching présents

### Indicateurs Négatifs ❌
- [ ] Aucun log du worker `DeliveryMatchingWorker`
- [ ] Aucune requête SQL sur `delivery_matching_queue`
- [ ] Erreurs de connexion DB dans les requêtes de matching
- [ ] Timeouts sur les requêtes de matching

## 🔍 Analyse des Logs Fournis

**Note**: Les logs fournis par l'utilisateur doivent être analysés pour vérifier la présence des indicateurs ci-dessus.

### Script d'Analyse
Un script PowerShell est disponible pour automatiser l'analyse:
```powershell
.\scripts\analyze_matching_logs.ps1 -LogFile "path/to/logs.json"
```

### Analyse Manuelle
Si vous préférez analyser manuellement, recherchez dans vos logs:
1. **Logs du worker**: `[DeliveryMatchingWorker]`
2. **Requêtes SQL**: `delivery_matching_queue`
3. **Requêtes de matching**: `list_matching_candidates` ou `find_nearby_couriers`
4. **Logs du service**: `[DeliveryMatching]`

## 🔧 Problèmes Potentiels

### 1. Aucune livraison dans la file
- **Symptôme**: Logs `Aucune livraison à traiter` répétés
- **Cause**: Aucune livraison n'est enregistrée dans `delivery_matching_queue`
- **Vérification**: Vérifier que `enqueue_delivery_matching` est appelé lors de la création d'une livraison

### 2. Worker silencieux
- **Symptôme**: Aucun log du worker
- **Cause possible**: Le worker ne s'exécute pas ou les logs sont au niveau DEBUG
- **Vérification**: Vérifier le niveau de log (`RUST_LOG`)

### 3. Requêtes SQL lentes
- **Symptôme**: Requêtes `delivery_matching_queue` ou `list_matching_candidates` prennent > 1s
- **Cause possible**: Index manquants ou requêtes non optimisées
- **Vérification**: Vérifier les index créés dans `20251221_optimize_delivery_indexes.sql`

### 4. Erreurs de matching
- **Symptôme**: Logs `[DeliveryMatching] Tentative échouée` répétés
- **Cause possible**: Problème dans `attempt_auto_matching` ou `list_matching_candidates`
- **Vérification**: Analyser les messages d'erreur dans les logs

## 📝 Recommandations

1. **Vérifier les logs au niveau DEBUG**: Le worker peut être silencieux si les logs sont au niveau INFO
2. **Vérifier l'enregistrement des livraisons**: S'assurer que `enqueue_delivery_matching` est appelé
3. **Vérifier les index**: S'assurer que les index de `20251221_optimize_delivery_indexes.sql` sont créés
4. **Analyser les erreurs**: Si des erreurs sont présentes, analyser les messages pour identifier la cause

