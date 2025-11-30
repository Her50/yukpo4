# 🔍 ANALYSE : Problème de stemming et variations dans la recherche

## Date : 2025-11-30

---

## ❌ PROBLÈME IDENTIFIÉ

Le full-text search ne matche pas les variations :
- "plombier" ne trouve pas "plomberie"
- "électricien" ne trouve pas "électricité"
- Etc.

**Cause** : Le stemming français de PostgreSQL (`to_tsvector('french', ...)`) ne gère pas bien les variations profession → activité.

---

## 📊 ANALYSE DE L'EXISTANT

### 1. Code actuel dans `native_search_service.rs`

- ✅ Utilise `plainto_tsquery('french', ...)` et `to_tsvector('french', ...)`
- ✅ Il y a déjà une fonction `detect_category_from_query()` qui fait le mapping (ligne 1998)
- ✅ Mais cette fonction n'est utilisée que pour filtrer par catégorie, pas pour enrichir la requête

### 2. Mapping existant dans `detect_category_from_query()`

```rust
("plombier", "plomberie"),
("plomberie", "plomberie"),
("électricien", "électricité"),
// etc.
```

### 3. Problème

- Le full-text search PostgreSQL avec `french` ne stemme pas "plombier" → "plomberie"
- Les deux mots sont traités comme différents
- La recherche trigram est utilisée en fallback, mais seulement si pas assez de résultats

---

## ✅ SOLUTIONS PROPOSÉES

### Solution 1 : Enrichir la requête avec les variations (RECOMMANDÉ)

**Principe** : Avant de faire la recherche, enrichir la requête avec les variations connues.

**Avantages** :
- Simple à implémenter
- Utilise les mappings existants
- Pas besoin de modifier les index

**Implémentation** :
```rust
fn expand_search_query_with_variations(&self, query: &str) -> String {
    let query_lower = query.to_lowercase();
    let mut expanded_terms = vec![query.to_string()];
    
    // Mapping profession → activité
    let variations = vec![
        ("plombier", "plomberie"),
        ("plomberie", "plombier"),
        ("électricien", "électricité"),
        ("électricité", "électricien"),
        // etc.
    ];
    
    for (from, to) in variations {
        if query_lower.contains(from) {
            expanded_terms.push(to.to_string());
            // Remplacer aussi dans la requête
            let replaced = query_lower.replace(from, to);
            if replaced != query_lower {
                expanded_terms.push(replaced);
            }
        }
    }
    
    expanded_terms.join(" | ")
}
```

**Utilisation dans SQL** :
```sql
-- Au lieu de :
plainto_tsquery('french', $1)

-- Utiliser :
plainto_tsquery('french', expanded_query) -- expanded_query = "plombier | plomberie"
```

### Solution 2 : Recherche trigram combinée (RECOMMANDÉ)

**Principe** : Utiliser la recherche trigram pour détecter les variations similaires.

**Avantages** :
- Détecte automatiquement les variations
- Gère aussi les fautes de frappe
- Pas besoin de mapping manuel

**Implémentation** :
Ajouter une recherche trigram avec `similarity()` pour chaque terme :
```sql
-- Dans la fonction SQL, ajouter :
OR similarity(LOWER(pe.data->'category'->>'valeur'), LOWER($1)) > 0.6
OR similarity(LOWER(pe.data->'titre_service'->>'valeur'), LOWER($1)) > 0.7
```

### Solution 3 : Dictionnaire de synonymes PostgreSQL (AVANCÉ)

**Principe** : Créer un dictionnaire de synonymes pour PostgreSQL.

**Avantages** :
- Géré nativement par PostgreSQL
- Performant

**Inconvénients** :
- Configuration plus complexe
- Nécessite une migration

---

## 🎯 SOLUTION RECOMMANDÉE : Combinée

**Combiner Solution 1 + Solution 2** :
1. **Enrichir la requête** avec les variations connues (Solution 1)
2. **Ajouter la recherche trigram** pour détecter les variations similaires (Solution 2)
3. **Gérer la casse** avec `LOWER()` / `ILIKE` (déjà fait)
4. **Gérer les accents** avec `unaccent_immutable()` (déjà fait)

---

## 📝 AUTRES CORRECTIONS À FAIRE

### 1. Gérer les erreurs de saisie

**Actuel** : La recherche trigram existe mais seulement en fallback.

**À améliorer** : Intégrer la recherche trigram directement dans la requête principale avec un seuil de similarité.

### 2. Gérer les troncatures

**Actuel** : Utilise `LIKE '%...%'` pour les troncatures.

**À améliorer** : Utiliser `word_similarity()` de PostgreSQL pour les troncatures partielles.

### 3. Gérer la casse

**Actuel** : ✅ Déjà géré avec `LOWER()` et `ILIKE`.

### 4. Optimiser l'ordre des recherches

**Actuel** : Full-text → Trigram → Keyword

**À améliorer** : Combiner les trois méthodes dans une seule requête avec des poids différents.

---

*Analyse créée le : 2025-11-30*

