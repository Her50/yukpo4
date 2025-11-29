# 📘 Guide d'Application du Fix de Recherche

## 🎯 Objectif

Corriger les problèmes critiques de recherche identifiés dans l'analyse des logs du 29 novembre 2025.

---

## 📋 Étapes d'Application

### Étape 1 : Exécuter le Script SQL

```bash
# Se connecter à la base de données
psql -h <host> -U <user> -d yukpomnang

# Exécuter le script
\i backend/FIX_RECHERCHE_PRODUITS_COMPLETE_2025_11_29.sql
```

**OU** via SQLx :

```bash
cd backend
sqlx migrate add fix_recherche_produits_complete_2025_11_29
# Copier le contenu de FIX_RECHERCHE_PRODUITS_COMPLETE_2025_11_29.sql dans la migration
sqlx migrate run
```

### Étape 2 : Vérifier les Résultats

```sql
-- Vérifier que la fonction search_services_gps_final est correcte
SELECT * FROM search_services_gps_final('test', NULL, 50, 5);

-- Vérifier que la fonction search_products_optimized fonctionne
SELECT * FROM search_products_optimized('avensis', NULL, NULL, 10);

-- Vérifier les index créés
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE indexname LIKE 'idx_services%unaccent%' 
   OR indexname LIKE 'idx_services%produits%';
```

### Étape 3 : Modifier le Code Rust (CRITIQUE)

#### Option A : Utiliser la nouvelle fonction `search_products_optimized()`

**Fichier** : `backend/src/services/native_search_service.rs`

**Ligne ~1137** : Remplacer la requête SQL actuelle par :

```rust
// ✅ CORRIGÉ : Utiliser la fonction optimisée qui extrait produits AVANT filtrage
let sql = r#"
    SELECT 
        service_id,
        service_data as data,
        created_at,
        user_id,
        gps,
        category,
        relevance_score::REAL as fulltext_score
    FROM search_products_optimized($1, $2, $3, $4)
"#;
```

#### Option B : Corriger la requête existante (plus complexe)

**Fichier** : `backend/src/services/native_search_service.rs`

**Ligne ~1139** : Modifier la CTE `products_extracted` :

```rust
let sql = format!(
    r#"
WITH all_products_extracted AS (
    -- ✅ CORRIGÉ: Extraire TOUS les produits AVANT de filtrer
    SELECT 
        s.id as service_id,
        s.data,
        s.created_at,
        s.user_id,
        s.gps,
        s.category,
        CASE 
            WHEN jsonb_typeof(s.data->'produits') = 'array' 
            THEN s.data->'produits'
            WHEN jsonb_typeof(s.data->'produits'->'valeur') = 'array'
            THEN s.data->'produits'->'valeur'
            ELSE '[]'::jsonb
        END as products_array
    FROM services s
    WHERE s.is_active = true
    AND ($2::text IS NULL OR s.category = $2 OR s.data->'category'->>'valeur' = $2)
    -- ✅ PAS de filtre sur titre_service/description/category ici !
),
products_matched AS (
    -- ✅ Filtrer sur les PRODUITS qui matchent
    SELECT DISTINCT
        ape.service_id,
        ape.data,
        ape.created_at,
        ape.user_id,
        ape.gps,
        ape.category,
        GREATEST(
            -- Score produits
            COALESCE((
                SELECT MAX(
                    CASE 
                        WHEN product->>'nom' ILIKE '%' || $1 || '%' THEN 12.0
                        WHEN product->>'categorie' ILIKE '%' || $1 || '%' THEN 10.0
                        ...
                    END
                )
                FROM jsonb_array_elements(ape.products_array) AS product
                WHERE (
                    product->>'nom' ILIKE '%' || $1 || '%'
                    OR product->>'categorie' ILIKE '%' || $1 || '%'
                    ...
                )
            ), 0.0),
            -- Score service (pour services sans produits)
            CASE 
                WHEN ape.data->'titre_service'->>'valeur' ILIKE '%' || $1 || '%' THEN 10.0
                ...
            END
        )::REAL as relevance_score
    FROM all_products_extracted ape
    WHERE (
        -- ✅ Recherche dans PRODUITS
        EXISTS (
            SELECT 1 
            FROM jsonb_array_elements(ape.products_array) AS product
            WHERE (
                product->>'nom' ILIKE '%' || $1 || '%'
                OR product->>'categorie' ILIKE '%' || $1 || '%'
                ...
            )
        )
        -- ✅ OU recherche dans service (pour services sans produits)
        OR ape.data->'titre_service'->>'valeur' ILIKE '%' || $1 || '%'
        OR ape.data->'description'->>'valeur' ILIKE '%' || $1 || '%'
        ...
    )
)
SELECT * FROM products_matched
ORDER BY relevance_score DESC
LIMIT $4
"#,
    // ... reste du code
);
```

---

## 🔍 Tests à Effectuer

### Test 1 : Recherche "avensis"

**Avant** : 0 résultats  
**Attendu après fix** : Résultats si produits "Toyota Avensis" existent

```bash
# Test via API
curl -X POST http://localhost:8000/api/search/direct \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"query": "avensis", "gps": "4.03,9.81"}'
```

### Test 2 : Recherche "glace"

**Avant** : 1 résultat après 10+ secondes  
**Attendu après fix** : Résultats en <2 secondes

### Test 3 : Vérifier les index

```sql
-- Vérifier que les index sont utilisés
EXPLAIN ANALYZE
SELECT * FROM services s
WHERE is_active = true
AND unaccent_immutable(COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', '')) ILIKE '%test%';
```

**Attendu** : Utilisation de `idx_services_titre_service_unaccent_trgm`

---

## ⚠️ Points d'Attention

### 1. Performance

- Les index peuvent prendre du temps à créer (quelques minutes)
- Exécuter `ANALYZE services;` après création des index

### 2. Compatibilité

- La fonction `unaccent_immutable()` nécessite l'extension `unaccent`
- Vérifier : `SELECT * FROM pg_extension WHERE extname = 'unaccent';`

### 3. Migration Progressive

- Option A (fonction SQL) : Plus rapide à déployer, moins de modifications Rust
- Option B (requête corrigée) : Plus de contrôle, mais nécessite plus de modifications

---

## 📊 Résultats Attendus

| Métrique | Avant | Après Fix |
|----------|-------|-----------|
| Temps de recherche "avensis" | 20.9s (0 résultats) | <2s (résultats si existent) |
| Temps de recherche "glace" | 10.5s (1 résultat) | <2s (résultats) |
| Utilisation index | 0% | >80% |
| Résultats trouvés | 0 pour produits | Corrects |

---

## 🐛 Dépannage

### Problème : "function unaccent_immutable does not exist"

**Solution** :
```sql
-- Vérifier que l'extension unaccent est installée
CREATE EXTENSION IF NOT EXISTS unaccent;
```

### Problème : "structure of query does not match function result type"

**Solution** :
```sql
-- Vérifier la signature de search_services_gps_final
SELECT pg_get_function_arguments(oid), pg_get_function_result(oid)
FROM pg_proc
WHERE proname = 'search_services_gps_final';
```

### Problème : Index non utilisés

**Solution** :
```sql
-- Forcer l'analyse des statistiques
ANALYZE services;
ANALYZE autocomplete_characteristics;

-- Vérifier les statistiques
SELECT schemaname, tablename, last_analyze
FROM pg_stat_user_tables
WHERE tablename IN ('services', 'autocomplete_characteristics');
```

---

## 📝 Notes Finales

1. **Priorité** : Corriger la logique de recherche (Option A ou B) est CRITIQUE
2. **Index** : Les index avec `unaccent_immutable()` amélioreront les performances mais ne résoudront pas le problème de logique
3. **Tests** : Tester avec des données réelles avant déploiement en production

---

## 🔗 Références

- Analyse complète : `backend/ANALYSE_COMPLETE_PROBLEMES_RECHERCHE_2025_11_29.md`
- Script SQL : `backend/FIX_RECHERCHE_PRODUITS_COMPLETE_2025_11_29.sql`

