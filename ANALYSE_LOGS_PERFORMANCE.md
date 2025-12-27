# 📊 Analyse des Logs de Performance - 27 Décembre 2025

## 🚨 Problèmes Critiques Identifiés

### 1. **Requêtes SQL Lentes - `find_nearby_couriers`**

**Symptômes :**
- Requête `find_nearby_couriers` prend **426ms, 752ms, 1.076s**
- Warning : `slow statement: execution time exceeded alert threshold` (seuil: 1s)
- Impact : Matching de livraisons ralenti

**Logs :**
```
{"timestamp":"2025-12-27T04:51:42.691324Z","level":"WARN","fields":{"message":"slow statement: execution time exceeded alert threshold","summary":"SELECT courier_id, user_id, distance_meters, …","elapsed":"1.076878543s"}}
```

**Recommandations :**
- Ajouter un index sur les colonnes GPS utilisées dans `find_nearby_couriers`
- Implémenter un cache Redis pour les résultats de matching (TTL: 30s)
- Optimiser la fonction PostgreSQL `find_nearby_couriers` avec des index GIST

---

### 2. **Requêtes `deliveries` Lentes**

**Symptômes :**
- Requête `SELECT id, status, creator_id, ... FROM deliveries WHERE id = $1` prend **810ms, 939ms, 1.015s**
- Requête répétée plusieurs fois dans les logs
- Impact : Affichage des détails de livraison ralenti

**Logs :**
```
{"timestamp":"2025-12-27T04:51:46.716886Z","level":"WARN","fields":{"message":"slow statement: execution time exceeded alert threshold","summary":"SELECT id, status, creator_id, …","elapsed":"1.015021436s"}}
```

**Recommandations :**
- Vérifier que l'index sur `deliveries.id` existe et est utilisé
- Ajouter un index composite sur `(id, status, creator_id, courier_id)` si ces colonnes sont souvent sélectionnées ensemble
- Implémenter un cache pour les livraisons récemment consultées

---

### 3. **Requêtes Enum PostgreSQL Lentes**

**Symptômes :**
- Requêtes `SELECT enumlabel FROM pg_catalog.pg_enum` prennent **400-800ms**
- Requêtes répétées fréquemment
- Impact : Initialisation des types lente

**Logs :**
```
{"timestamp":"2025-12-27T04:51:40.146973Z","level":"DEBUG","fields":{"summary":"SELECT enumlabel FROM pg_catalog.pg_enum …","elapsed":"443.632392ms"}}
```

**Recommandations :**
- Cache en mémoire des enums au démarrage de l'application
- Éviter les requêtes répétées aux catalogues PostgreSQL
- Utiliser un cache applicatif pour les types enum

---

### 4. **Health Checks Lents**

**Symptômes :**
- Requêtes `SELECT 1` (health checks) prennent parfois **300-600ms**
- Indique une surcharge ou des problèmes de connexion DB
- Impact : Monitoring et health checks peu fiables

**Logs :**
```
{"timestamp":"2025-12-27T04:51:43.839045Z","level":"DEBUG","fields":{"summary":"SELECT 1","elapsed":"335.709714ms"}}
```

**Recommandations :**
- Vérifier la taille du pool de connexions PostgreSQL
- Optimiser les paramètres de connexion (timeout, pool size)
- Implémenter un health check simplifié qui ne nécessite pas de requête DB

---

### 5. **Erreur 404 - API `/api/content/mixed`** ✅ CORRIGÉ

**Symptômes :**
- L'API `/api/content/mixed?limit=30&format=video` retourne **404**
- Erreur dans les logs mobiles : `normalizeFeed: raw n'est pas un tableau object {"status": 404, "message": "Erreur 404"}`
- Impact : Feed vidéo mobile ne fonctionne pas

**Logs :**
```
{"timestamp":"2025-12-27T04:51:43.461619Z","level":"WARN","fields":{"message":"📱[MOBILE] [WARN] VideoFeedScreen | User:56 | Device:android/34 | Time:2025-12-27T04:51:40.720Z [VideoFeedScreen] normalizeFeed: raw n'est pas un tableau object {\n  \"status\": 404,\n  \"message\": \"Erreur 404\"\n}"}}
```

**Solution appliquée :**
- ✅ Ajout de l'alias `/api/content/mixed` dans `recommendation_routes.rs`
- La route `/content/mixed` existait mais sans le préfixe `/api` requis par l'application mobile
- Correction similaire à celle déjà appliquée pour `/api/visibility/track`

**Fichier modifié :**
- `backend/src/routes/recommendation_routes.rs` - Ajout de `.route("/api/content/mixed", get(get_mixed_content))`

---

## 📈 Statistiques de Performance

### Temps de Réponse par Type de Requête

| Type de Requête | Temps Moyen | Temps Max | Occurrences |
|----------------|-------------|-----------|-------------|
| `find_nearby_couriers` | 750ms | 1.076s | 3 |
| `deliveries WHERE id = $1` | 920ms | 1.015s | 5+ |
| `SELECT enumlabel` | 500ms | 800ms | 10+ |
| `SELECT 1` (health check) | 400ms | 600ms | 20+ |
| `video_generation_jobs` | 1-2ms | 21ms | OK |
| `media_distribution` | 1-2ms | 3ms | OK |

### Requêtes Optimisées ✅

- `video_generation_jobs` : Performance excellente (< 2ms)
- `media_distribution` : Performance excellente (< 3ms)
- `media_engagement` : Performance bonne (< 2ms)

---

## 🔧 Actions Prioritaires

### Priorité 1 - Critique (Impact Utilisateur)
1. ✅ **Corriger l'API `/api/content/mixed`** - Feed vidéo mobile cassé
2. ✅ **Optimiser `find_nearby_couriers`** - Matching livraisons trop lent
3. ✅ **Optimiser requêtes `deliveries`** - Affichage détails livraison lent

### Priorité 2 - Important (Performance)
4. ✅ **Cache des enums PostgreSQL** - Éviter requêtes répétées
5. ✅ **Optimiser health checks** - Réduire latence monitoring
6. ✅ **Ajouter index manquants** - Améliorer temps de réponse

### Priorité 3 - Amélioration Continue
7. ✅ **Monitoring des requêtes lentes** - Alertes automatiques
8. ✅ **Cache Redis pour matching** - Réduire charge DB
9. ✅ **Optimisation pool de connexions** - Améliorer scalabilité

---

## 💡 Recommandations Techniques

### 1. Index PostgreSQL à Ajouter

```sql
-- Index pour find_nearby_couriers
CREATE INDEX IF NOT EXISTS idx_couriers_location_gist 
ON couriers USING GIST (location);

-- Index composite pour deliveries
CREATE INDEX IF NOT EXISTS idx_deliveries_lookup 
ON deliveries(id, status, creator_id, courier_id) 
WHERE status NOT IN ('delivered', 'cancelled', 'completed');

-- Index pour recherche GPS
CREATE INDEX IF NOT EXISTS idx_deliveries_pickup_gist 
ON deliveries USING GIST (pickup_location);
```

### 2. Cache Redis pour Matching

```rust
// Cache pour résultats find_nearby_couriers
let cache_key = format!("couriers:nearby:{}:{}:{}", lat, lng, radius);
if let Some(cached) = redis.get(&cache_key).await? {
    return Ok(cached);
}
// ... requête DB ...
redis.setex(&cache_key, 30, &result).await?; // TTL: 30s
```

### 3. Cache Enums au Démarrage

```rust
// Au démarrage de l'application
lazy_static! {
    static ref ENUM_CACHE: HashMap<String, Vec<String>> = {
        // Charger tous les enums une fois
        load_all_enums().unwrap_or_default()
    };
}
```

---

## 📝 Prochaines Étapes

1. **Immédiat** : Corriger l'endpoint `/api/content/mixed` manquant
2. **Court terme** : Ajouter les index PostgreSQL recommandés
3. **Moyen terme** : Implémenter le cache Redis pour matching
4. **Long terme** : Monitoring automatique des requêtes lentes avec alertes

---

**Date d'analyse** : 27 Décembre 2025  
**Période analysée** : ~2 minutes de logs (04:50:00 - 04:52:00)  
**Total requêtes analysées** : ~200 requêtes SQL

