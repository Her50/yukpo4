# 🔍 Analyse des Erreurs dans les Logs

## 📋 Erreurs Identifiées

### 1. ⚠️ Requêtes SQL Lentes (`SELECT 1`)

**Problème** :
```
"slow statement: execution time exceeded alert threshold"
"summary":"SELECT 1"
"elapsed":"2.125991613s"  // 2.1 secondes !
"elapsed":"2.468086246s"  // 2.5 secondes !
"elapsed":"1.342712037s"  // 1.3 secondes !
```

**Cause** :
- Les `SELECT 1` sont des **health checks** du pool de connexions DB
- Prendre 2+ secondes indique un **problème de connexion à Render PostgreSQL**
- Possible causes :
  - Connexions DB fermées par Render (idle timeout)
  - Latence réseau élevée vers Render
  - Pool de connexions saturé
  - Connexions TLS qui expirent

**Impact** :
- Health checks lents = indicateur de problèmes de connexion DB
- Peut causer des timeouts sur d'autres requêtes

**Solution** :
- ✅ Déjà configuré : `max_lifetime` et `idle_timeout` dans `main.rs`
- ✅ Déjà configuré : `test_before_acquire` pour tester les connexions
- ⚠️ À améliorer : Réduire la fréquence des health checks si trop lents

---

### 2. ❌ Timeout `/api/autocomplete/search-products` (15 secondes)

**Problème** :
```
[POST] yukpomnang.onrender.com/api/autocomplete/search-products
responseTimeMS=15036  // 15 secondes !
responseTimeMS=14987  // 15 secondes !
```

**Erreurs Mobile** :
```
[ERROR] Mobile API | Timeout pour /api/autocomplete/search-products
[ERROR] Mobile API | Error: Aborted
[ERROR] Mobile API | {"message":"Aborted","name":"AbortError"}
```

**Cause** :
- Requête SQL utilisant `LIKE '%...%'` avec sous-requêtes corrélées
- Pas d'utilisation de l'index GIN tsvector
- Scan complet de table = très lent

**Solution** :
- ✅ **CORRIGÉ** : Remplacement de `LIKE '%...%'` par `tsvector @@ tsquery`
- ✅ **CORRIGÉ** : Utilisation de l'index GIN tsvector
- ✅ **CORRIGÉ** : Suppression des sous-requêtes corrélées

**Fichier modifié** : `backend/src/services/autocomplete_search_service.rs`

**Performance attendue** :
- Avant : 15 secondes
- Après : < 100ms

---

### 3. ⚠️ Requêtes SQL Lentes (autres)

**Problème** :
```
"summary":"SELECT MAX(updated_at) AS last_completed"
"elapsed":"430.547106ms"  // 430ms

"summary":"SELECT COUNT(*)::bigint AS count"
"elapsed":"358.044754ms"  // 358ms

"summary":"SELECT COUNT(*)::bigint AS count"
"elapsed":"127.11421ms"   // 127ms
```

**Cause** :
- Requêtes sur `video_generation_jobs` sans index approprié
- Latence réseau vers Render PostgreSQL
- Requêtes qui scannent toute la table

**Impact** :
- Lenteur des métriques et statistiques
- Pas critique pour la recherche, mais à optimiser

**Solution** :
- Vérifier les index sur `video_generation_jobs`
- Ajouter des index si nécessaire
- Considérer un cache pour les métriques

---

## 🔧 Corrections Appliquées

### ✅ 1. Optimisation `/api/autocomplete/search-products`

**Fichier** : `backend/src/services/autocomplete_search_service.rs`

**Changements** :
1. Remplacement de `LIKE '%...%'` par `tsvector @@ tsquery`
2. Utilisation de l'index GIN tsvector
3. Suppression des sous-requêtes corrélées
4. Score basé sur `ts_rank` au lieu de calculs complexes

**Performance** :
- Avant : 15 secondes
- Après : < 100ms (attendu)

---

### ⚠️ 2. Health Checks Lents (`SELECT 1`)

**Fichier** : `backend/src/utils/db_monitor.rs`

**Problème** :
- Health checks toutes les 30 secondes
- `SELECT 1` prend 2+ secondes (problème de connexion DB)

**Solutions Possibles** :

#### Option A : Réduire la fréquence des health checks
```rust
// Augmenter l'intervalle si les health checks sont trop lents
let interval_secs: u64 = std::env::var("DB_HEALTH_CHECK_INTERVAL_SECS")
    .unwrap_or_else(|_| "60".to_string())  // 60s au lieu de 30s
    .parse()
    .unwrap_or(60);
```

#### Option B : Utiliser `test_before_acquire` au lieu de health check séparé
- Le pool teste déjà les connexions avant acquisition
- Le health check séparé peut être optionnel

#### Option C : Health check avec timeout plus court
```rust
// Réduire le timeout du health check
let test_result = tokio::time::timeout(
    Duration::from_secs(2),  // 2s au lieu de 5s
    sqlx::query("SELECT 1").execute(&pool),
)
.await;
```

**Recommandation** : Option A (réduire la fréquence) car les health checks lents indiquent un problème de connexion DB qui est déjà géré par `test_before_acquire`.

---

## 📊 Résumé des Erreurs

| Erreur | Fréquence | Impact | Statut |
|--------|-----------|--------|--------|
| Timeout `/api/autocomplete/search-products` | Fréquent | Critique | ✅ **CORRIGÉ** |
| `SELECT 1` lent (health check) | Toutes les 30s | Moyen | ⚠️ À optimiser |
| Requêtes métriques lentes | Occasionnel | Faible | ⚠️ À optimiser |

---

## 🎯 Actions Recommandées

### ✅ Immédiat (Déjà fait)
1. ✅ Optimiser `/api/autocomplete/search-products` avec index GIN
2. ✅ Vérifier que l'index GIN tsvector existe

### ⚠️ À Faire
1. ⚠️ Réduire la fréquence des health checks (60s au lieu de 30s)
2. ⚠️ Ajouter des index sur `video_generation_jobs` si nécessaire
3. ⚠️ Considérer un cache pour les métriques

---

## 🔍 Vérification

### Test de Performance Autocomplete

```bash
# Test de l'endpoint optimisé
curl -X POST https://yukpomnang.onrender.com/api/autocomplete/search-products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"query": "toyota", "limit": 10}' \
  -w "\nTime: %{time_total}s\n"
```

**Résultat attendu** : < 0.1s (100ms)

### Test de Connexion DB

```sql
-- Test de connexion directe
SELECT 1;
```

**Résultat attendu** : < 10ms (si connexion locale) ou < 100ms (si Render)

---

## 📝 Notes

- Les health checks lents (`SELECT 1` en 2+ secondes) indiquent un problème de connexion DB vers Render
- Ce problème est déjà partiellement géré par `test_before_acquire` dans le pool
- La réduction de la fréquence des health checks peut aider à réduire le bruit dans les logs
- L'optimisation de `/api/autocomplete/search-products` devrait résoudre les timeouts mobile

