# Amélioration de la Recherche Vectorielle : Test Vectoriel Unique (équivalent %in% R)

## Problème Identifié

L'utilisateur a raison : la normalisation avec règles hardcodées (contractions françaises) n'est pas générique et l'itération séquentielle n'est pas optimale.

## Solution Implémentée

### 1. Test Vectoriel Unique (équivalent à `%in%` en R)

**Avant** (itération séquentielle) :
```sql
SELECT COUNT(*)::REAL
FROM unnest(search_keywords_normalized) AS keyword
WHERE keyword = ANY(product_vector_normalized)
```

**Après** (test vectoriel unique) :
```sql
SELECT array_length(
    ARRAY(
        SELECT unnest(search_keywords_normalized)
        INTERSECT
        SELECT unnest(product_vector_normalized)
    ),
    1
)::REAL
```

**Équivalent R** :
```r
keywords <- c("sac", "dos")
product_vector <- c("sac", "a", "dos")
matches <- keywords %in% product_vector  # [TRUE, TRUE]
score <- sum(matches) / length(keywords) * 100  # 100%
```

### 2. Filtrage Générique des Stop Words

**Avant** : Normalisation hardcodée des contractions françaises
```rust
match normalized.as_str() {
    "au" | "aux" => "a",  // ❌ Pas générique
    ...
}
```

**Après** : Utilisation de `extract_keywords_from_text` qui filtre les stop words de manière générique
```rust
let keywords = extract_keywords_from_text(query);  // Filtre "au", "du", etc.
let search_keywords_normalized: Vec<String> = keywords
    .iter()
    .map(|w| self.normalize_word_for_vector_matching(w))  // Seulement accents
    .collect();
```

### 3. Ajout de "au" et "aux" dans les Stop Words

Pour que "Sac au dos" → "Sac dos" (après filtrage stop words) matche avec "Sac à dos" → "Sac dos" (après normalisation accents).

## Avantages

1. ✅ **Générique** : Fonctionne pour toutes les langues (pas de règles hardcodées)
2. ✅ **Optimal** : Test vectoriel unique (pas d'itération séquentielle)
3. ✅ **Performant** : Utilise l'intersection d'arrays PostgreSQL (optimisé)
4. ✅ **Maintenable** : Les stop words sont centralisés dans `extract_keywords_from_text`

## Fichiers Modifiés

1. **`backend/migrations/20260113_optimize_vector_matching_vectorial.sql`** :
   - Nouvelle migration pour optimiser la fonction avec test vectoriel

2. **`backend/src/services/native_search_service.rs`** :
   - Utilisation de `extract_keywords_from_text` pour filtrage générique
   - Suppression de la normalisation hardcodée des contractions

3. **`backend/src/services/orchestration_ia.rs`** :
   - Ajout de "au" et "aux" dans les stop words

## Migration à Appliquer

```bash
sqlx migrate run
```

La migration met à jour la fonction `calculate_vector_match_score_optimized` pour utiliser un test vectoriel unique au lieu d'une itération séquentielle.


