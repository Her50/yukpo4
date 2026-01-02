# 🔍 Analyse Détaillée du Processus de Recherche Textuelle

## Vue d'ensemble

Le processus de recherche textuelle dans Yukpomnang suit plusieurs étapes pour transformer la requête utilisateur en résultats pertinents. Voici une analyse complète étape par étape.

---

## 📝 ÉTAPE 1 : Extraction des Mots-Clés

### Fonction : `extract_keywords_from_text()`

**Fichier** : `backend/src/services/orchestration_ia.rs` (ligne 1732)

### Processus :

1. **Nettoyage du texte** :
   - Conversion en minuscules
   - Remplacement des séparateurs (`,`, `;`, `|`) par des espaces
   - Suppression des expressions de recherche courantes :
     - "je cherche", "je voudrais", "je veux", "je souhaite", etc.

2. **Filtrage des stop words** :
   - Liste de ~150 stop words français (pronoms, articles, prépositions, conjonctions, adverbes)
   - Exemples : "je", "un", "le", "de", "pour", "avec", "et", "ou", "très", etc.

3. **Filtrage des mots** :
   - Mots de **plus de 2 caractères** uniquement
   - Exclusion des mots uniquement numériques
   - Exclusion des doublons

### Exemple :

```
Input: "je cherche une veste en cuir Zara"
↓
Nettoyage: "veste cuir zara"
↓
Filtrage stop words: "veste", "cuir", "zara" (✅ tous > 2 caractères)
↓
Output: ["veste", "cuir", "zara"]
```

### ⚠️ Problème identifié :

**Le mot "en" est supprimé** car il fait moins de 3 caractères, ce qui cause des problèmes de matching pour "Veste en cuir Zara" → devient "veste cuir zara".

---

## 🔄 ÉTAPE 2 : Normalisation de la Requête

### Fonction : `normalize_query_advanced()`

**Fichier** : `backend/src/services/native_search_service.rs` (ligne 1388)

### Processus :

1. **Normalisation de base** :
   - Conversion en minuscules
   - Suppression des caractères non-alphanumériques (sauf `*` et espaces)
   - Détection des wildcards `*`

2. **Gestion des mots tronqués** :
   - Si un mot se termine par `*`, création de variantes avec/sans accents
   - Exemple : "gate*" → ["gate", "gâte", "gâter", etc.]

3. **Création de variantes d'accents** :
   - Fonction `create_word_variants()` :
     - Variantes sans accents : "café" → "cafe"
     - Variantes avec accents : "cafe" → "café", "cafè", "cafê", "cafë"

### Exemple :

```
Input: "veste cuir zara"
↓
Normalisation: "veste cuir zara" (pas de changement)
↓
Variantes accents: ["veste", "cuir", "zara"] (pas de variantes nécessaires)
↓
Output: "veste cuir zara"
```

---

## 🎯 ÉTAPE 3 : Matching avec `autocomplete_characteristics`

### Structure de `autocomplete_characteristics` :

```sql
CREATE TABLE autocomplete_characteristics (
    id SERIAL PRIMARY KEY,
    service_id INTEGER,
    valeur TEXT,                    -- Nom du produit (ex: "Veste en cuir Zara")
    characteristic_vector TEXT[],   -- Vecteur de caractéristiques du produit
    full_vector TEXT[],            -- Vecteur complet (nom + description + catégorie)
    usage_count INTEGER,            -- Nombre d'utilisations
    is_real_product BOOLEAN,
    identifiant_base TEXT           -- 'produits'
);
```

### ⚠️ Problème : Pas de Matching Vectoriel d'Inclusion

**Ce qui est préconisé** : Matching vectoriel d'inclusion avec sommation des `true` après inclusion vectorielle.

**Ce qui est actuellement implémenté** : **PAS de matching vectoriel d'inclusion**. Le système utilise :

1. **Matching textuel ILIKE** (insensible à la casse, gère les accents)
2. **Full-text search PostgreSQL** (`to_tsvector` + `plainto_tsquery`)
3. **Conversion des vecteurs en tsvector** pour recherche full-text

### Processus actuel de matching :

#### A. CTE `autocomplete_matches` :

```sql
WITH autocomplete_matches AS (
    SELECT 
        ac.service_id,
        ac.valeur,
        ac.characteristic_vector,  -- TEXT[] (ex: ["Veste", "cuir", "Zara"])
        ac.full_vector,            -- TEXT[] (ex: ["Veste", "en", "cuir", "Zara", "description", ...])
        -- SCORING :
        (
            -- 1. Match exact (score: 100.0)
            CASE WHEN LOWER(ac.valeur) = LOWER($1) THEN 100.0 ELSE 0.0 END +
            
            -- 2. Match début (score: 80.0)
            CASE WHEN ac.valeur ILIKE $1 || '%' THEN 80.0 ELSE 0.0 END +
            
            -- 3. Match partiel (score: 60.0)
            CASE WHEN ac.valeur ILIKE '%' || $1 || '%' THEN 60.0 ELSE 0.0 END +
            
            -- 4. Full-text search sur valeur (score: 25.0 * ts_rank)
            ts_rank(to_tsvector('french', ac.valeur), plainto_tsquery('french', $1)) * 25.0 +
            
            -- 5. Full-text search sur characteristic_vector (score: 15.0 * ts_rank)
            -- ⚠️ CONVERSION : characteristic_vector (TEXT[]) → tsvector → recherche
            COALESCE(ts_rank(
                characteristic_vector_to_tsvector(ac.characteristic_vector), 
                plainto_tsquery('french', $1)
            ), 0.0) * 15.0 +
            
            -- 6. Full-text search sur full_vector (score: 12.0 * ts_rank)
            -- ⚠️ CONVERSION : full_vector (TEXT[]) → tsvector → recherche
            COALESCE(ts_rank(
                full_vector_to_tsvector(ac.full_vector), 
                plainto_tsquery('french', $1)
            ), 0.0) * 12.0 +
            
            -- 7. Bonus usage_count (score: 2.0 * usage_count)
            (ac.usage_count::REAL * 2.0)
        )::REAL as ac_score
    FROM autocomplete_characteristics ac
    WHERE 
        -- CONDITIONS DE MATCHING :
        LOWER(ac.valeur) = LOWER($1)                    -- Match exact
        OR ac.valeur ILIKE $1 || '%'                    -- Match début
        OR ac.valeur ILIKE '%' || $1 || '%'             -- Match partiel
        OR to_tsvector('french', ac.valeur) @@ plainto_tsquery('french', $1)  -- Full-text valeur
        OR characteristic_vector_to_tsvector(ac.characteristic_vector) @@ plainto_tsquery('french', $1)  -- Full-text vecteur
        OR full_vector_to_tsvector(ac.full_vector) @@ plainto_tsquery('french', $1)  -- Full-text full_vector
)
```

#### B. Fonctions de conversion vectorielle :

**Fichier** : `backend/migrations/20251227_ensure_search_indexes_exist.sql`

```sql
-- Conversion characteristic_vector (TEXT[]) → tsvector
CREATE OR REPLACE FUNCTION characteristic_vector_to_tsvector(char_vec TEXT[])
RETURNS tsvector AS $$
BEGIN
    RETURN to_tsvector('french', array_to_string(COALESCE(char_vec, ARRAY[]::TEXT[]), ' '));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Conversion full_vector (TEXT[]) → tsvector
CREATE OR REPLACE FUNCTION full_vector_to_tsvector(char_vec TEXT[])
RETURNS tsvector AS $$
BEGIN
    RETURN to_tsvector('french', array_to_string(COALESCE(char_vec, ARRAY[]::TEXT[]), ' '));
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

**Processus** :
1. `characteristic_vector` (TEXT[]) → `array_to_string()` → String → `to_tsvector()` → tsvector
2. Recherche full-text avec `plainto_tsquery()` sur ce tsvector

### ⚠️ Ce qui manque : Matching Vectoriel d'Inclusion

**Ce qui devrait être fait** (selon votre préconisation) :

```sql
-- Matching vectoriel d'inclusion
-- Pour chaque mot-clé de la requête, vérifier s'il est inclus dans le vecteur
WITH keyword_matches AS (
    SELECT 
        ac.service_id,
        ac.characteristic_vector,
        ac.full_vector,
        -- Sommation des matches (true = 1, false = 0)
        (
            -- Vérifier inclusion de chaque mot-clé dans characteristic_vector
            CASE WHEN 'veste' = ANY(ac.characteristic_vector) THEN 1 ELSE 0 END +
            CASE WHEN 'cuir' = ANY(ac.characteristic_vector) THEN 1 ELSE 0 END +
            CASE WHEN 'zara' = ANY(ac.characteristic_vector) THEN 1 ELSE 0 END
        )::INTEGER as characteristic_matches,
        (
            -- Vérifier inclusion de chaque mot-clé dans full_vector
            CASE WHEN 'veste' = ANY(ac.full_vector) THEN 1 ELSE 0 END +
            CASE WHEN 'cuir' = ANY(ac.full_vector) THEN 1 ELSE 0 END +
            CASE WHEN 'zara' = ANY(ac.full_vector) THEN 1 ELSE 0 END
        )::INTEGER as full_matches
    FROM autocomplete_characteristics ac
    WHERE 
        -- Filtrer seulement les services qui ont au moins un match
        'veste' = ANY(ac.characteristic_vector) 
        OR 'cuir' = ANY(ac.characteristic_vector)
        OR 'zara' = ANY(ac.characteristic_vector)
        OR 'veste' = ANY(ac.full_vector)
        OR 'cuir' = ANY(ac.full_vector)
        OR 'zara' = ANY(ac.full_vector)
)
SELECT 
    service_id,
    -- Score basé sur le nombre de matches
    (characteristic_matches::REAL / 3.0 * 100.0) as characteristic_score,
    (full_matches::REAL / 3.0 * 100.0) as full_score,
    GREATEST(
        (characteristic_matches::REAL / 3.0 * 100.0),
        (full_matches::REAL / 3.0 * 100.0)
    ) as vector_inclusion_score
FROM keyword_matches
ORDER BY vector_inclusion_score DESC;
```

**Avantages du matching vectoriel d'inclusion** :
- ✅ **Plus rapide** : Utilise les index GIN sur les arrays PostgreSQL
- ✅ **Plus précis** : Match exact sur chaque mot-clé individuellement
- ✅ **Gère les mots manquants** : "Veste en cuir Zara" match même si "en" n'est pas dans la requête
- ✅ **Scoring clair** : Nombre de matches / nombre total de mots-clés

---

## 📊 ÉTAPE 4 : Scoring et Combinaison

### A. Score depuis `autocomplete_characteristics` :

Le score `ac_score` est calculé dans la CTE `autocomplete_matches` (voir ci-dessus).

### B. Score depuis titre/description service :

```sql
COALESCE(
    CASE WHEN LOWER(s.data->'titre_service'->>'valeur') = LOWER($1) THEN 50.0 ELSE 0.0 END +
    CASE WHEN s.data->'titre_service'->>'valeur' ILIKE $1 || '%' THEN 35.0 ELSE 0.0 END +
    CASE WHEN s.data->'titre_service'->>'valeur' ILIKE '%' || $1 || '%' THEN 25.0 ELSE 0.0 END +
    CASE WHEN s.data->'description'->>'valeur' ILIKE '%' || $1 || '%' THEN 15.0 ELSE 0.0 END +
    ts_rank(to_tsvector('french', s.data->'titre_service'->>'valeur'), plainto_tsquery('french', $1)) * 10.0 +
    ts_rank(to_tsvector('french', s.data->'description'->>'valeur'), plainto_tsquery('french', $1)) * 5.0,
    0.0
)
```

### C. Score final :

```sql
GREATEST(
    COALESCE(ac.ac_score, 0.0),  -- Score autocomplete (priorité haute)
    score_titre_description       -- Score titre/description (priorité basse)
)::REAL as fulltext_score
```

**Priorité** : Score autocomplete > Score titre/description

---

## 🔄 ÉTAPE 5 : Fallbacks

### A. Fallback Trigram (similarité de chaînes) :

**Déclenchement** : Si `fulltext_results.len() < max_results / 2` OU `avg_score < 5.0`

**Fonction** : `trigram_search_with_gps()`

**Processus** :
- Utilise la fonction PostgreSQL `similarity()` (extension `pg_trgm`)
- Compare la requête avec titre, description, catégorie
- Seuil minimum : `similarity > 0.1`

### B. Fallback Keyword Search :

**Déclenchement** : Si encore pas assez de résultats après trigram

**Fonction** : `keyword_search_with_gps()`

**Processus** :
- Recherche par mots-clés individuels
- Score basé sur nombre de matches

---

## 📈 ÉTAPE 6 : Tri Final

```rust
fulltext_results.sort_by(|a, b| {
    // 1. Comparer par score (DESC)
    let score_cmp = b.total_score.partial_cmp(&a.total_score);
    
    // 2. Si scores égaux ou très proches (< 0.1), utiliser distance (ASC)
    if score_cmp == Ordering::Equal || (a.total_score - b.total_score).abs() < 0.1 {
        dist_a.partial_cmp(&dist_b)
    } else {
        score_cmp
    }
});
```

**Priorité** :
1. Score de pertinence (DESC)
2. Distance GPS (ASC) si scores proches

---

## ⚠️ Problèmes Identifiés

### 1. **Pas de Matching Vectoriel d'Inclusion**

**Problème** : Le système convertit les vecteurs TEXT[] en tsvector pour recherche full-text, mais ne fait **PAS** de matching vectoriel d'inclusion direct.

**Impact** :
- Plus lent (conversion tsvector + full-text search)
- Moins précis (full-text peut rater des matches exacts)
- Ne gère pas bien les mots manquants (ex: "en" dans "Veste en cuir Zara")

**Solution préconisée** :
```sql
-- Matching vectoriel d'inclusion direct
CASE WHEN 'veste' = ANY(ac.characteristic_vector) THEN 1 ELSE 0 END +
CASE WHEN 'cuir' = ANY(ac.characteristic_vector) THEN 1 ELSE 0 END +
CASE WHEN 'zara' = ANY(ac.characteristic_vector) THEN 1 ELSE 0 END
```

### 2. **Extraction de Mots-Clés Supprime les Mots Courts**

**Problème** : Les mots de moins de 3 caractères sont supprimés (ex: "en").

**Impact** : "Veste en cuir Zara" → "veste cuir zara" (perd "en")

**Solution** : Ajuster le seuil ou gérer les mots courts différemment.

### 3. **Scoring Non Optimisé pour Recherches à Un Seul Mot**

**Problème** : Pour "veste" seul, le scoring peut être faible si le match n'est pas exact.

**Solution** : Scores augmentés (déjà fait dans les corrections récentes).

---

## 🚀 Recommandations

### 1. Implémenter le Matching Vectoriel d'Inclusion

```sql
-- Pour chaque mot-clé extrait, vérifier inclusion dans les vecteurs
WITH keyword_vector_matches AS (
    SELECT 
        ac.service_id,
        ac.characteristic_vector,
        ac.full_vector,
        -- Sommation des matches pour characteristic_vector
        (
            SELECT COUNT(*)::REAL
            FROM unnest($1::TEXT[]) AS keyword
            WHERE keyword = ANY(ac.characteristic_vector)
        ) / array_length($1::TEXT[], 1)::REAL * 100.0 as characteristic_match_score,
        -- Sommation des matches pour full_vector
        (
            SELECT COUNT(*)::REAL
            FROM unnest($1::TEXT[]) AS keyword
            WHERE keyword = ANY(ac.full_vector)
        ) / array_length($1::TEXT[], 1)::REAL * 100.0 as full_match_score
    FROM autocomplete_characteristics ac
    WHERE 
        -- Au moins un mot-clé doit matcher
        EXISTS (
            SELECT 1 FROM unnest($1::TEXT[]) AS keyword
            WHERE keyword = ANY(ac.characteristic_vector) 
               OR keyword = ANY(ac.full_vector)
        )
)
```

### 2. Combiner Matching Vectoriel + Scoring Actuel

```sql
GREATEST(
    -- Score matching vectoriel d'inclusion (nouveau, priorité très haute)
    COALESCE(vm.characteristic_match_score, vm.full_match_score, 0.0) * 1.5,
    
    -- Score autocomplete actuel (priorité haute)
    COALESCE(ac.ac_score, 0.0),
    
    -- Score titre/description (priorité basse)
    score_titre_description
)::REAL as final_score
```

### 3. Optimiser avec Index GIN sur Arrays

```sql
-- Index pour accélérer le matching vectoriel
CREATE INDEX idx_autocomplete_characteristic_vector_gin 
ON autocomplete_characteristics USING GIN (characteristic_vector);

CREATE INDEX idx_autocomplete_full_vector_gin 
ON autocomplete_characteristics USING GIN (full_vector);
```

---

## 📝 Résumé du Flux Actuel

```
1. Input utilisateur: "je cherche une veste en cuir Zara"
   ↓
2. extract_keywords_from_text() → ["veste", "cuir", "zara"] (⚠️ "en" supprimé)
   ↓
3. normalize_query_advanced() → "veste cuir zara"
   ↓
4. fulltext_search_with_gps() :
   a. CTE autocomplete_matches :
      - ILIKE matching sur ac.valeur
      - Full-text search sur ac.valeur (to_tsvector)
      - Full-text search sur characteristic_vector (conversion → tsvector)
      - Full-text search sur full_vector (conversion → tsvector)
      - Calcul ac_score
   b. CTE best_autocomplete_per_service : Meilleur match par service
   c. CTE matched_services : Services matchés
   d. Score final : GREATEST(ac_score, score_titre_description)
   ↓
5. Fallback trigram si peu de résultats
   ↓
6. Fallback keyword_search si encore peu de résultats
   ↓
7. Tri par score + distance
   ↓
8. Retour résultats
```

---

## ✅ Conclusion

Le système actuel utilise **full-text search PostgreSQL** avec conversion des vecteurs TEXT[] en tsvector, mais **ne fait PAS de matching vectoriel d'inclusion direct** comme préconisé. 

L'implémentation du matching vectoriel d'inclusion améliorerait :
- ⚡ **Performance** : Plus rapide avec index GIN sur arrays
- 🎯 **Précision** : Match exact sur chaque mot-clé
- 🔧 **Robustesse** : Gère mieux les mots manquants


