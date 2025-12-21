# Analyse du Matching de Coursier dans les Logs

**Date**: 2025-12-21  
**Objectif**: Vérifier si le matching de coursier fonctionne correctement dans les logs fournis

## Indicateurs à rechercher dans les logs

### 1. Worker de Matching (`DeliveryMatchingWorker`)
- **Logs attendus**:
  - `[DeliveryMatchingWorker] X livraison(s) retraitées`
  - `[DeliveryMatchingWorker] Aucune livraison à traiter`
  - `[DeliveryMatchingWorker] Worker X: X livraison(s) retraitées`
  - `[DeliveryMatchingWorker] Cache actif: skip requête`

### 2. Requêtes SQL sur `delivery_matching_queue`
- **Requêtes attendues**:
  - `SELECT ... FROM delivery_matching_queue WHERE status IN ('queued', 'searching') AND next_attempt_at <= NOW()`
  - `UPDATE delivery_matching_queue SET status = ...`
  - `INSERT INTO delivery_matching_queue ...`

### 3. Requêtes SQL de Matching (`list_matching_candidates`)
- **Requêtes attendues**:
  - `SELECT ... FROM courier_availability_snapshots ...`
  - `SELECT ... FROM find_nearby_couriers(...)`
  - `ST_Distance(...)` pour calculer les distances

### 4. Logs du Service de Matching
- **Logs attendus**:
  - `[DeliveryMatching] Tentative échouée pour {delivery_id}: {error}`
  - `[DeliveryMatching] Matching réussi pour {delivery_id}`
  - `[DeliveryMatching] Aucun coursier disponible pour {delivery_id}`

### 5. Métriques Prometheus
- **Métriques attendues**:
  - `delivery_matching_started_total`
  - `delivery_matching_success_total`
  - `delivery_matching_failed_total`
  - `delivery_matching_queue_depth`

## Analyse des logs fournis

### ✅ Indicateurs positifs (matching fonctionne)
- [ ] Logs du worker `DeliveryMatchingWorker` présents
- [ ] Requêtes SQL sur `delivery_matching_queue` présentes
- [ ] Requêtes `list_matching_candidates` ou `find_nearby_couriers` présentes
- [ ] Logs de succès/échec du matching présents
- [ ] Métriques Prometheus mises à jour

### ❌ Indicateurs négatifs (matching ne fonctionne pas)
- [ ] Aucun log du worker `DeliveryMatchingWorker`
- [ ] Aucune requête SQL sur `delivery_matching_queue`
- [ ] Erreurs de connexion DB dans les requêtes de matching
- [ ] Timeouts sur les requêtes de matching
- [ ] Aucune métrique Prometheus mise à jour

## Problèmes potentiels identifiés

### 1. Worker non démarré
- **Symptôme**: Aucun log `[DeliveryMatchingWorker]`
- **Cause possible**: Le worker n'est pas démarré dans `main.rs`
- **Vérification**: Vérifier que `start_delivery_matching_worker` est appelé dans `main.rs`

### 2. File de matching vide
- **Symptôme**: Logs `Aucune livraison à traiter` répétés
- **Cause possible**: Aucune livraison n'est enregistrée dans `delivery_matching_queue`
- **Vérification**: Vérifier que `enqueue_delivery_matching` est appelé lors de la création d'une livraison

### 3. Requêtes SQL lentes
- **Symptôme**: Requêtes `delivery_matching_queue` ou `list_matching_candidates` prennent > 1s
- **Cause possible**: Index manquants ou requêtes non optimisées
- **Vérification**: Vérifier les index créés dans `20251221_optimize_delivery_indexes.sql`

### 4. Erreurs de matching
- **Symptôme**: Logs `[DeliveryMatching] Tentative échouée` répétés
- **Cause possible**: Problème dans `attempt_auto_matching` ou `list_matching_candidates`
- **Vérification**: Analyser les messages d'erreur dans les logs

## Recommandations

1. **Vérifier le démarrage du worker**: S'assurer que `start_delivery_matching_worker` est appelé dans `main.rs`
2. **Vérifier l'enregistrement des livraisons**: S'assurer que `enqueue_delivery_matching` est appelé lors de la création d'une livraison
3. **Vérifier les index**: S'assurer que les index de `20251221_optimize_delivery_indexes.sql` sont créés
4. **Analyser les erreurs**: Si des erreurs sont présentes, analyser les messages pour identifier la cause

## Prochaines étapes

1. Analyser les logs fournis pour identifier les indicateurs ci-dessus
2. Vérifier le code pour s'assurer que le worker est démarré
3. Vérifier que les livraisons sont bien enregistrées dans `delivery_matching_queue`
4. Si des problèmes sont identifiés, proposer des corrections

