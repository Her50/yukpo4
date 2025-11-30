# ✅ SOLUTION COMPLÈTE : Gestion des variations, casse, troncatures, erreurs de saisie

## Date : 2025-11-30

---

## 🎯 OBJECTIF

Améliorer la recherche pour gérer :
1. ✅ Variations ("plombier" vs "plomberie")
2. ✅ Casse (déjà géré)
3. ✅ Troncatures (partiellement géré)
4. ✅ Erreurs de saisie (trigram en fallback seulement)

---

## 📋 PLAN D'IMPLÉMENTATION

### Étape 1 : Enrichir la requête avec les variations

**Fichier** : `backend/src/services/native_search_service.rs`

Créer une fonction qui enrichit la requête avec toutes les variations connues :
- "plombier" → ajouter "plomberie"
- "plomberie" → ajouter "plombier"
- "électricien" → ajouter "électricité"
- etc.

### Étape 2 : Modifier la fonction SQL

**Fichier** : Nouvelle migration SQL

Ajouter dans `search_services_gps_final` :
- Recherche trigram avec `similarity()` pour les variations
- Recherche avec requête enrichie (OR entre les variations)
- Seuil de similarité configurable (0.6-0.7)

### Étape 3 : Intégrer trigram dans la requête principale

**Fichier** : `backend/src/services/native_search_service.rs`

Au lieu d'utiliser trigram seulement en fallback, l'intégrer directement dans la requête avec des poids différents.

---

## 🔧 IMPLÉMENTATION

### Solution 1 : Fonction d'enrichissement de requête (Rust)

```rust
fn expand_search_query_with_variations(&self, query: &str) -> String {
    let query_lower = query.to_lowercase().trim().to_string();
    let mut expanded_terms = vec![query_lower.clone()];
    
    // Mapping bidirectionnel : profession ↔ activité
    let variations = vec![
        ("plombier", "plomberie"),
        ("plomberie", "plombier"),
        ("électricien", "électricité"),
        ("électricité", "électricien"),
        ("electricien", "électricité"), // Sans accent
        ("menuisier", "menuiserie"),
        ("menuiserie", "menuisier"),
        ("maçon", "maçonnerie"),
        ("maçonnerie", "maçon"),
        ("macon", "maçonnerie"), // Sans accent
        ("peintre", "peinture"),
        ("peinture", "peintre"),
        ("couvreur", "couverture"),
        ("couverture", "couvreur"),
        ("chauffeur", "transport"),
        ("taxi", "transport"),
        ("livreur", "livraison"),
        ("livraison", "livreur"),
        ("restaurant", "restauration"),
        ("restauration", "restaurant"),
        ("coiffeur", "coiffure"),
        ("coiffure", "coiffeur"),
    ];
    
    // Pour chaque mot de la requête, chercher des variations
    let words: Vec<&str> = query_lower.split_whitespace().collect();
    for word in &words {
        for (from, to) in &variations {
            if word == from || word.contains(from) {
                // Ajouter la variation
                let expanded_word = word.replace(from, to);
                if expanded_word != *word {
                    expanded_terms.push(expanded_word);
                }
                // Ajouter aussi le terme de variation seul
                if !expanded_terms.contains(&to.to_string()) {
                    expanded_terms.push(to.to_string());
                }
            }
        }
    }
    
    // Créer une requête enrichie avec OR (pour full-text search)
    // Format: "plombier | plomberie"
    expanded_terms.iter().unique().join(" | ")
}
```

### Solution 2 : Fonction SQL améliorée

**Ajouter dans la fonction SQL** :
```sql
-- Au lieu de :
plainto_tsquery('french', search_query)

-- Utiliser :
plainto_tsquery('french', COALESCE(expanded_query, search_query))
-- Où expanded_query = "plombier | plomberie"

-- ET ajouter la recherche trigram :
OR similarity(LOWER(COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', '')), LOWER(search_query)) > 0.6
OR similarity(LOWER(COALESCE(s.data->>'description', s.data->'description'->>'valeur', '')), LOWER(search_query)) > 0.5
OR similarity(LOWER(COALESCE(s.category, s.data->'category'->>'valeur', '')), LOWER(search_query)) > 0.7
```

### Solution 3 : Score combiné

**Dans le calcul du score** :
```sql
GREATEST(
    -- Full-text search avec requête enrichie
    ts_rank(..., plainto_tsquery('french', expanded_query)) * 10.0,
    -- Trigram similarity (pour variations)
    similarity(...) * 8.0,
    -- Recherche exacte
    CASE WHEN LOWER(...) = LOWER(search_query) THEN 15.0 ELSE 0.0 END,
    0.0
)
```

---

## 📝 MAPPING COMPLET DES VARIATIONS

Voir `detect_category_from_query()` existant (ligne 1998) et l'étendre.

---

*Solution créée le : 2025-11-30*

