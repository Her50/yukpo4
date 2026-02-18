# 🔍 Analyse des Logs - Problèmes de Connexion (18/02/2026)

## 📊 Résumé Exécutif

**Problème principal** : L'application ne peut pas traiter les requêtes de connexion car :
1. **Pas d'instance disponible** : Cloud Run n'a pas d'instance prête pour traiter les requêtes
2. **Pool de connexions PostgreSQL saturé** : Le pool n'a que 4 connexions (au lieu de 20 configurées)
3. **Requêtes SQL lentes** : Des requêtes prennent >1.8 secondes, bloquant le pool
4. **Erreurs de connexion** : Réponses malformées ou erreurs de connexion à l'instance

## 🚨 Problèmes Identifiés

### 1. **"The request was aborted because there was no available instance"**

**Erreur** :
```
The request was aborted because there was no available instance.
Additional troubleshooting documentation can be found at: 
https://cloud.google.com/run/docs/troubleshooting#abort-request
```

**Tentatives de connexion échouées** :
- `POST /api/auth/login` à `07:56:34` - Status 500
- `POST /api/mobile-logs` à `07:56:34` - Status 500
- User-Agent: `Yukpo-Mobile/1.0.0`
- Remote IP: `129.0.99.69`

**Cause** : Cloud Run n'a pas d'instance disponible pour traiter la requête. Cela peut arriver si :
- L'instance est en train de démarrer (cold start)
- L'instance a crashé
- Le pool de connexions est saturé et bloque le démarrage

**Impact** : **CRITIQUE** - Les utilisateurs ne peuvent pas se connecter

---

### 2. **Pool de Connexions PostgreSQL Saturé**

**Erreur** :
```
[DB Monitor] 🔴 Pool saturé: 100.0% utilisé (4/4)
```

**Problème** :
- Le pool n'a que **4 connexions** au lieu des **20 configurées** pour Cloud Run
- Le pool est saturé à 100% (4/4 connexions utilisées)
- Les requêtes attendent >2 secondes pour acquérir une connexion

**Logs** :
```
sqlx::pool::acquire: acquired connection, but time to acquire exceeded slow threshold
acquired_after_secs=2.50256138
slow_acquire_threshold_secs=2.0
```

**Cause probable** :
1. La configuration du pool n'est pas appliquée correctement
2. La connexion à Cloud SQL échoue partiellement (seulement 4 connexions réussissent)
3. Les connexions ne sont pas libérées correctement après utilisation

**Configuration attendue** (d'après `main.rs`) :
- `max_connections`: 20 (Cloud Run)
- `min_connections`: 0 (Cloud Run)
- `acquire_timeout`: 30s

**Configuration réelle** (d'après les logs) :
- `max_connections`: 4 ❌
- Pool saturé à 100%

**Impact** : **CRITIQUE** - Bloque toutes les requêtes nécessitant la base de données

---

### 3. **Requêtes SQL Lentes**

**Erreur** :
```
sqlx::query: slow statement: execution time exceeded alert threshold
elapsed=1.800395639s
slow_threshold=1s
```

**Requête lente** :
```sql
SELECT id, delivery_id, zone_id, status, priority, attempt_count, payload,
       next_attempt_at, enqueued_at, updated_at
FROM delivery_matching_queue
WHERE status IN ('queued', 'searching')
  AND next_attempt_at <= NOW()
ORDER BY priority ASC, next_attempt_at ASC
LIMIT $1
```

**Problème** :
- La requête prend **1.8 secondes** (seuil d'alerte: 1s)
- Cette requête bloque une connexion du pool pendant 1.8s
- Avec seulement 4 connexions, cela sature rapidement le pool

**Impact** : **ÉLEVÉ** - Contribue à la saturation du pool

---

### 4. **Erreurs de Connexion à l'Instance**

**Erreur** :
```
The request failed because either the HTTP response was malformed 
or connection to the instance had an error.
```

**Tentatives échouées** :
- `POST /api/mobile-logs` à `07:57:20` - Status 503
- `POST /api/mobile-logs` à `07:57:20` - Status 503

**Cause** : L'instance ne peut pas répondre correctement, probablement car :
- L'application Rust n'a pas fini de démarrer
- Le pool de connexions est saturé
- L'instance est en train de redémarrer

**Impact** : **ÉLEVÉ** - Les requêtes échouent avec 503

---

### 5. **Démarrage de l'Application**

**Logs de démarrage** :
```
🚀 [ENTRYPOINT] Utilisation de startup-wrapper.sh pour Cloud Run
⏳ [WRAPPER] Attente que Cloud Run valide le startup probe (90 secondes)...
🚀 [HEALTH] Démarrage serveur HTTP minimal Python sur port 8080...
✅ [HEALTH] Serveur HTTP minimal prêt sur port 8080
STARTUP HTTP probe succeeded after 1 attempt
✅ [WRAPPER] Cloud Run devrait avoir validé le startup probe
🛑 [WRAPPER] Arrêt du serveur Python pour libérer le port...
⏳ [WRAPPER] Attente libération du port (5 secondes)...
🚀 [WRAPPER] Étape 4: Démarrage application Rust...
```

**Observation** :
- Le startup probe réussit ✅
- Python est arrêté ✅
- Rust démarre ✅
- Mais ensuite, les requêtes échouent car le pool est saturé

**Impact** : **MOYEN** - Le démarrage fonctionne, mais l'application ne peut pas traiter les requêtes

---

## 🔍 Analyse Détaillée

### Tentatives de Connexion Identifiées

1. **07:56:34** - `POST /api/auth/login`
   - Status: 500
   - Erreur: "The request was aborted because there was no available instance"
   - User-Agent: `Yukpo-Mobile/1.0.0`

2. **07:57:20** - `POST /api/mobile-logs` (x2)
   - Status: 503
   - Erreur: "The request failed because either the HTTP response was malformed or connection to the instance had an error"

### Timeline des Problèmes

1. **07:49:28** - Pool saturé (4/4 connexions)
2. **07:49:47** - Requête SQL lente (1.8s)
3. **07:49:48** - Acquisition de connexion lente (2.5s)
4. **07:56:21** - Nouvelle instance démarrée (AUTOSCALING)
5. **07:56:34** - Tentative de connexion échouée (pas d'instance disponible)
6. **07:57:20** - Erreurs de connexion (réponse malformée)
7. **07:57:52** - Startup probe réussi
8. **07:58:31** - Startup probe réussi (autre instance)
9. **07:58:42** - Démarrage Rust

---

## 🎯 Solutions Recommandées

### 1. **Augmenter le Pool de Connexions PostgreSQL**

**Problème** : Le pool n'a que 4 connexions au lieu de 20

**Solution** :
- Vérifier que la configuration `max_connections=20` est bien appliquée
- Vérifier que Cloud SQL accepte 20 connexions simultanées
- Augmenter temporairement à 10-15 connexions pour tester

**Fichier** : `backend/src/main.rs` (ligne 368)

---

### 2. **Optimiser les Requêtes SQL Lentes**

**Problème** : Requête `delivery_matching_queue` prend 1.8s

**Solution** :
- Ajouter un index sur `(status, next_attempt_at)` pour accélérer la requête
- Limiter le nombre de résultats avec `LIMIT` plus petit
- Utiliser un index partiel si possible

**Fichier** : Migration SQL à créer

---

### 3. **Augmenter le Min Instances Cloud Run**

**Problème** : "No available instance" lors des cold starts

**Solution** :
- Configurer `--min-instances=1` pour garder une instance toujours prête
- Réduire le temps de démarrage en optimisant le wrapper

**Fichier** : `.github/workflows/gcp-deploy.yml`

---

### 4. **Améliorer la Gestion du Pool**

**Problème** : Connexions non libérées correctement

**Solution** :
- Vérifier que `test_before_acquire` fonctionne correctement
- Réduire `idle_timeout` pour libérer les connexions inactives plus vite
- Ajouter des logs pour tracer l'utilisation du pool

**Fichier** : `backend/src/main.rs`

---

### 5. **Ajouter des Timeouts et Retries**

**Problème** : Requêtes qui attendent indéfiniment

**Solution** :
- Ajouter des timeouts sur les requêtes HTTP
- Implémenter un retry avec backoff exponentiel
- Ajouter un circuit breaker pour éviter de surcharger le pool

**Fichier** : `backend/src/middlewares/` (nouveau middleware)

---

## 📋 Actions Immédiates

### Priorité 1 (CRITIQUE) - ✅ CORRIGÉ
1. ✅ **Vérifier la configuration du pool PostgreSQL** - Ajout de logs détaillés pour diagnostiquer pourquoi seulement 4 connexions
   - Utilisation de `DB_POOL_SIZE` depuis variable d'environnement
   - Logs de la taille réelle du pool après création
   - Logs dans `db_monitor` avec max configuré

2. ✅ **Augmenter `min-instances` à 1 dans Cloud Run** - Corrigé dans `.github/workflows/gcp-deploy.yml`
   - `--min-instances 1` ajouté à tous les déploiements
   - Évite les cold starts et les erreurs "no available instance"

3. ✅ **Optimiser la requête `delivery_matching_queue`** - Migration créée
   - Nouveau index partiel: `idx_delivery_matching_queue_ready_optimized`
   - Index pour mises à jour: `idx_delivery_matching_queue_status_updated`
   - `ANALYZE` pour mettre à jour les statistiques

### Priorité 2 (ÉLEVÉ) - ✅ CORRIGÉ
4. ✅ **Ajouter des logs détaillés pour le pool de connexions** - Implémenté
   - Logs dans `main.rs` après création du pool
   - Logs dans `db_monitor` avec métriques détaillées
   - Logs de la configuration max vs taille réelle

5. ⏳ Implémenter un health check qui vérifie le pool - À faire
6. ⏳ Ajouter des métriques pour surveiller l'utilisation du pool - À faire

### Priorité 3 (MOYEN)
7. ⏳ Améliorer les messages d'erreur pour les utilisateurs - À faire
8. ⏳ Ajouter un retry automatique côté client - À faire
9. ⏳ Documenter les limites du pool pour les développeurs - À faire

---

## ✅ Corrections Appliquées (18/02/2026)

### Commit: `f8cb2b2` et `916d880`

**Fichiers modifiés**:
1. `backend/src/main.rs` - Logs détaillés du pool
2. `backend/src/utils/db_monitor.rs` - Amélioration monitoring
3. `.github/workflows/gcp-deploy.yml` - `--min-instances 1`
4. `backend/migrations/20260218_optimize_delivery_matching_queue_final.sql` - Nouveaux index

**Résultats attendus**:
- Pool PostgreSQL: Logs permettront de diagnostiquer pourquoi seulement 4 connexions
- Cold starts: Une instance toujours prête évite les erreurs 500
- Requêtes SQL: Nouveaux index devraient réduire le temps d'exécution de 1.8s à <500ms

---

## 🔗 Références

- [Cloud Run Troubleshooting](https://cloud.google.com/run/docs/troubleshooting#abort-request)
- [Cloud SQL Connection Limits](https://cloud.google.com/sql/docs/postgres/quotas)
- [SQLx Pool Configuration](https://docs.rs/sqlx/latest/sqlx/pool/struct.PoolOptions.html)

---

## 📝 Notes

- Les logs montrent que le startup probe fonctionne correctement
- Le problème principal est la saturation du pool de connexions
- Les requêtes SQL lentes contribuent au problème
- Cloud Run scale correctement (nouvelles instances créées), mais elles ne peuvent pas traiter les requêtes à cause du pool saturé

