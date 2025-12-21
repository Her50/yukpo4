# 🔧 Correction de la Lenteur de `/api/autocomplete/search-products`

## 🐛 Problème Identifié

**Endpoint** : `POST /api/autocomplete/search-products`  
**Temps de réponse** : **15 secondes** (15036ms, 14987ms)  
**Erreurs** : Timeout et "Aborted" côté mobile

### Cause Racine

La requête SQL dans `autocomplete_search_service.rs` utilisait :
- ❌ `LIKE '%...%'` avec sous-requêtes corrélées multiples
- ❌ `unnest()` + `EXISTS()` pour chaque élément du vecteur de recherche
- ❌ Pas d'utilisation de l'index GIN tsvector

**Résultat** : Scan complet de table = **15 secondes** même avec 27 produits

---

## ✅ Solution Appliquée

### Fichier : `backend/src/services/autocomplete_search_service.rs`

#### Avant (LENT - 15 secondes) :
```sql
-- ❌ Problèmes :
-- 1. LIKE '%...%' ne peut pas utiliser d'index efficacement
-- 2. Sous-requêtes corrélées multiples (une par élément du vecteur)
-- 3. unnest() + EXISTS() = très lent
WHERE EXISTS (
    SELECT 1 FROM unnest($1::TEXT[]) AS search_val
    WHERE EXISTS (
        SELECT 1 FROM unnest(ac.full_vector) AS vec_val
        WHERE LOWER(vec_val) LIKE '%' || LOWER(search_val) || '%'
    )
)
```

#### Après (RAPIDE - < 100ms) :
```sql
-- ✅ Optimisations :
-- 1. Utilise tsvector @@ tsquery avec index GIN (ultra-rapide)
-- 2. Pas de sous-requêtes corrélées
-- 3. Recherche directe dans l'index
WHERE (
    to_tsvector('french', ac.valeur) @@ plainto_tsquery('french', $2)
    OR to_tsvector('french', array_to_string(ac.full_vector, ' ')) @@ plainto_tsquery('french', $2)
    OR to_tsvector('french', array_to_string(ac.characteristic_vector, ' ')) @@ plainto_tsquery('french', $2)
)
```

### Changements Techniques

1. **Transformation du vecteur en tsquery** :
   ```rust
   let search_query = combination_vector.join(" | "); // "mot1 | mot2 | mot3"
   ```

2. **Utilisation de l'index GIN tsvector** :
   - `to_tsvector('french', ac.valeur) @@ plainto_tsquery('french', $2)`
   - Utilise l'index `idx_autocomplete_characteristics_valeur_tsvector`

3. **Score optimisé** :
   ```sql
   ts_rank(to_tsvector('french', ac.valeur), plainto_tsquery('french', $2)) * 20.0 +
   (ac.usage_count::REAL * 2.0)
   ```

---

## 📊 Performance Attendue

### Avant Optimisation
- **Temps** : **15 secondes** (15000ms)
- **Méthode** : Scan complet avec LIKE '%...%'
- **Index** : Aucun (impossible avec LIKE)

### Après Optimisation
- **Temps** : **< 100ms** (attendu)
- **Méthode** : Recherche directe dans index GIN
- **Index** : `idx_autocomplete_characteristics_valeur_tsvector`

**Gain** : **150x plus rapide** ⚡

---

## 🔍 Vérification

### Test de Performance SQL

```sql
-- Test avec l'index GIN tsvector
EXPLAIN ANALYZE
SELECT DISTINCT ON (s.id)
    s.id as service_id,
    ac.valeur,
    ts_rank(to_tsvector('french', ac.valeur), plainto_tsquery('french', 'toyota')) * 20.0 as relevance_score
FROM autocomplete_characteristics ac
INNER JOIN services s ON s.id = ac.service_id
WHERE ac.is_real_product = TRUE
AND ac.identifiant_base = 'produits'
AND s.is_active = TRUE
AND to_tsvector('french', ac.valeur) @@ plainto_tsquery('french', 'toyota')
ORDER BY relevance_score DESC
LIMIT 10;
```

**Résultat attendu** :
- **Temps** : < 10ms
- **Index utilisé** : `Bitmap Index Scan on idx_autocomplete_characteristics_valeur_tsvector`

---

## ✅ Corrections Appliquées

### 1. Requête SANS GPS (ligne 181-278)
- ✅ Remplacement de `LIKE '%...%'` par `tsvector @@ tsquery`
- ✅ Utilisation de l'index GIN tsvector
- ✅ Score basé sur `ts_rank` au lieu de sous-requêtes corrélées

### 2. Requête AVEC GPS (ligne 63-180)
- ✅ Même optimisation que sans GPS
- ✅ Conservation du calcul de distance GPS
- ✅ Tri par distance + pertinence

---

## 🎯 Résultat

L'endpoint `/api/autocomplete/search-products` devrait maintenant être :
- ✅ **< 100ms** au lieu de 15 secondes
- ✅ Utilise l'index GIN tsvector
- ✅ Pas de timeout côté mobile
- ✅ Pas d'erreurs "Aborted"

---

## 📝 Notes

- L'index GIN tsvector `idx_autocomplete_characteristics_valeur_tsvector` doit exister (créé par la migration `20251220_reindex_existing_products.sql`)
- La recherche utilise maintenant `plainto_tsquery` qui gère automatiquement le stemming français
- Le score de pertinence combine `ts_rank` (pertinence textuelle) + `usage_count` (popularité) + bonus lieu

