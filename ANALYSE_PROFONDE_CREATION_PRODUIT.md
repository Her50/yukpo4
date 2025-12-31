# Analyse approfondie : Erreur 500 et lenteur création produit

## 🔍 Analyse des logs

### Problème 1 : Erreur 500 - Timeout TLS

**Logs observés :**
```
"slow statement: execution time exceeded alert threshold"
"SELECT add_product_to_service_jsonb($1, $2)"
"elapsed":"3.089728818s"

"[DB Retry] Tentative 1/7 échouée (erreur TLS récupérable): 
error communicating with database: peer closed connection without sending TLS close_notify"
```

**Cause racine identifiée :**
1. La fonction PostgreSQL `add_product_to_service_jsonb` fait un `SELECT` pour calculer l'index AVANT l'UPDATE
2. Si le JSONB `services.data` est volumineux (plusieurs centaines de KB avec beaucoup de produits), ce SELECT peut prendre 2-3 secondes
3. Puis l'UPDATE lui-même peut prendre 1-2 secondes si le JSONB est volumineux
4. Total : 3-5 secondes → timeout TLS de Render DB (fermeture après ~3s d'inactivité)

### Problème 2 : Lenteur même sans média

**Séquence d'opérations identifiée dans le code :**

```rust
// 1. SELECT pour vérifier le service (ligne 57-63)
SELECT user_id, data FROM services WHERE id = $1
// ⚠️ Charge TOUT le JSONB même si on a juste besoin de user_id

// 2. SELECT pour vérifier le solde (ligne 98-101)
SELECT tokens_balance FROM users WHERE id = $1
// ✅ Rapide

// 3. UPDATE pour débiter (ligne 134)
UPDATE users SET tokens_balance = tokens_balance - $1 WHERE id = $2
// ✅ Rapide

// 4. Dans la fonction PostgreSQL add_product_to_service_jsonb :
SELECT COALESCE(jsonb_array_length(data->'produits'->'valeur'), 0)
FROM services WHERE id = p_service_id
// ⚠️ LENT si JSONB volumineux (doit parser tout le JSONB)

// 5. UPDATE pour ajouter le produit
UPDATE services SET data = ... WHERE id = p_service_id
// ⚠️ LENT si JSONB volumineux (doit réécrire tout le JSONB)

// 6. SELECT pour récupérer service_data pour indexation (ligne 537)
SELECT data FROM services WHERE id = $1
// ⚠️ TRÈS LENT - charge TOUT le JSONB (peut être 500KB+)
// C'est la cause principale de la lenteur !

// 7. save_autocomplete_combination fait :
//    - get_geoname_id (SELECT)
//    - build_location_vector (peut faire requêtes externes)
//    - Plusieurs INSERT dans autocomplete_characteristics
//    - Boucles sur variations de prix
// ⚠️ Peut prendre 1-2 secondes supplémentaires
```

## 🎯 Causes exactes identifiées

### Cause 1 : SELECT complet du JSONB après UPDATE (LIGNE 537)

**Code problématique :**
```rust
// backend/src/controllers/product_addition_controller.rs:537
sqlx::query("SELECT data FROM services WHERE id = $1")
    .bind(service_id_clone)
    .fetch_one(&pool_clone)
    .await
```

**Problème :**
- Charge TOUT le JSONB `services.data` qui peut être très volumineux
- Si le service a déjà 10-20 produits, le JSONB peut faire 200-500 KB
- PostgreSQL doit parser et sérialiser tout le JSONB
- Temps d'exécution : **1-3 secondes** selon la taille

**Solution :**
- Ne pas charger tout le JSONB
- Extraire seulement les champs nécessaires pour l'indexation
- Ou utiliser une fonction PostgreSQL qui retourne directement les données nécessaires

### Cause 2 : Fonction PostgreSQL fait SELECT avant UPDATE

**Code dans la migration :**
```sql
SELECT COALESCE(jsonb_array_length(data->'produits'->'valeur'), 0)
INTO v_product_index
FROM services
WHERE id = p_service_id
FOR UPDATE;
```

**Problème :**
- Même avec `FOR UPDATE`, PostgreSQL doit parser le JSONB pour calculer la longueur
- Si le JSONB est volumineux, cela peut prendre 500ms-1s

**Solution :**
- Utiliser `RETURNING` dans l'UPDATE pour calculer l'index après
- Ou utiliser un compteur séparé dans une table dédiée

### Cause 3 : save_autocomplete_combination fait trop de requêtes

**Opérations dans save_autocomplete_combination :**
1. `get_geoname_id` : SELECT sur `geo_hierarchy`
2. `build_location_vector` : Peut faire des requêtes externes (GeoNames API)
3. Plusieurs INSERT dans `autocomplete_characteristics`
4. Boucles sur variations de prix avec INSERT multiples

**Problème :**
- Chaque requête ajoute de la latence
- Les requêtes externes peuvent être lentes
- Total : 1-2 secondes supplémentaires

**Solution :**
- Rendre l'indexation asynchrone (déjà fait avec timeout, mais peut être amélioré)
- Mettre en cache les résultats de `get_geoname_id`
- Batch les INSERT

## 🔧 Solutions proposées

### Solution 1 : Éviter le SELECT complet du JSONB

**Avant (ligne 537) :**
```rust
sqlx::query("SELECT data FROM services WHERE id = $1")
```

**Après :**
```rust
// Option A : Extraire seulement les champs nécessaires
sqlx::query("SELECT data->'produits' as produits, data->'lieu_produit' as lieu FROM services WHERE id = $1")

// Option B : Utiliser une fonction PostgreSQL qui retourne directement les données nécessaires
sqlx::query_scalar("SELECT get_product_data_for_indexation($1)")
```

### Solution 2 : Optimiser la fonction PostgreSQL

**Créer une fonction qui retourne directement l'index :**
```sql
CREATE OR REPLACE FUNCTION add_product_to_service_jsonb_v2(
    p_service_id INTEGER,
    p_product_json JSONB
) RETURNS TABLE(product_index INTEGER, produits_data JSONB, lieu_data JSONB) AS $$
BEGIN
    UPDATE services
    SET 
        data = CASE
            WHEN data->'produits'->'valeur' IS NOT NULL THEN
                jsonb_set(data, '{produits,valeur}', 
                    (data->'produits'->'valeur') || jsonb_build_array(p_product_json), true)
            -- ... autres cas
        END,
        updated_at = NOW()
    WHERE id = p_service_id
    RETURNING 
        COALESCE(jsonb_array_length(data->'produits'->'valeur'), 0) - 1 as product_index,
        data->'produits' as produits_data,
        data->'lieu_produit' as lieu_data;
END;
$$ LANGUAGE plpgsql;
```

### Solution 3 : Rendre l'indexation vraiment asynchrone

**Actuellement :**
- L'indexation est synchrone avec timeout de 5s
- Si elle échoue, le produit est quand même créé mais non indexé

**Amélioration :**
- Mettre l'indexation dans une queue (tokio::spawn avec channel)
- Ne pas attendre la fin de l'indexation pour répondre
- Logger les erreurs pour monitoring

### Solution 4 : Cache pour get_geoname_id

**Problème :**
- `get_geoname_id` fait un SELECT à chaque fois
- Peut être mis en cache car les lieux ne changent pas souvent

**Solution :**
- Utiliser Redis ou cache mémoire pour `get_geoname_id`
- TTL de 24h-48h

## 📊 Estimation des gains

| Opération | Temps actuel | Temps optimisé | Gain |
|-----------|--------------|----------------|------|
| SELECT data complet | 1-3s | 50-100ms | **95%** |
| Fonction PostgreSQL | 500ms-1s | 50-100ms | **90%** |
| save_autocomplete | 1-2s | 200-500ms (async) | **75%** |
| **TOTAL** | **3-6s** | **300-700ms** | **85-90%** |

## 🚀 Plan d'action prioritaire

1. **URGENT** : Éviter le SELECT complet du JSONB (ligne 537)
2. **URGENT** : Optimiser la fonction PostgreSQL pour éviter le SELECT préalable
3. **IMPORTANT** : Rendre l'indexation vraiment asynchrone
4. **NICE TO HAVE** : Cache pour get_geoname_id

## 🔍 Vérification

Pour vérifier la taille du JSONB :
```sql
SELECT 
    id,
    pg_column_size(data) as data_size_bytes,
    pg_column_size(data) / 1024.0 as data_size_kb
FROM services
WHERE id = 191;
```

Si `data_size_kb > 100`, c'est un service volumineux qui causera des lenteurs.

