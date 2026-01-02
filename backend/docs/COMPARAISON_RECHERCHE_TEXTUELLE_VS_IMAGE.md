# 🔍 Comparaison : Recherche Textuelle vs Recherche par Image

## 📋 Vue d'ensemble

Le système utilise deux approches différentes pour construire les mots-clés/tags selon le type de recherche :

1. **Recherche textuelle simple** : Utilise directement la requête utilisateur
2. **Recherche par image** : Extrait des tags depuis l'analyse IA de l'image

## 🔤 Recherche Textuelle Simple

### Construction des Mots-Clés

#### Étape 1: Extraction depuis la requête utilisateur

```rust
// Dans native_search_service.rs
let keywords = extract_keywords_from_text(search_query);
let query_with_keywords = if keywords.is_empty() {
    search_query.to_string()
} else {
    keywords.join(" ")
};
```

**Fonction `extract_keywords_from_text`** :
- Filtre les stop words (mots vides : "le", "la", "de", "du", etc.)
- Garde uniquement les mots significatifs
- Retourne un tableau de mots-clés

#### Étape 2: Normalisation

```rust
let (normalized_query, has_wildcards) = self.normalize_query_advanced(&query_with_keywords);
```

**Fonction `normalize_query_advanced`** :
1. **Minuscules** : `"Mèches"` → `"mèches"`
2. **Suppression caractères spéciaux** : Garde uniquement alphanumériques + espaces + `*`
3. **Gestion wildcards** : Détecte `*` pour recherche partielle
4. **Variantes accents** : Crée variantes avec/sans accents
   - `"mèches"` → `["mèches", "meches"]`

**Résultat** : `"Mèches"` → `"mèches meches"` (variantes avec/sans accents)

#### Étape 3: Matching avec les Produits

La requête normalisée est utilisée directement dans la recherche SQL :

```sql
-- Recherche dans autocomplete_characteristics
WHERE (
    ac.valeur ILIKE '%mèches%' OR ac.valeur ILIKE '%meches%'
    OR to_tsvector('french', ac.valeur) @@ plainto_tsquery('french', 'mèches meches')
    OR characteristic_vector_to_tsvector(ac.characteristic_vector) @@ plainto_tsquery('french', 'mèches meches')
    OR full_vector_to_tsvector(ac.full_vector) @@ plainto_tsquery('french', 'mèches meches')
)
```

### Structure des Produits dans `autocomplete_characteristics`

Pour les produits génériques (sans marque/couleur), la structure est :

```sql
-- Exemple produit générique : "Cours de soutien en mathématiques"
valeur = "Cours de soutien en mathématiques"
characteristic_vector = ["Cours", "soutien", "mathématiques", "Éducation", "0", "XAF"]
full_vector = ["Cours", "soutien", "mathématiques", "Éducation", "0", "XAF", "Douala", "Cameroun"]
```

**Champs extraits** (dans `extract_product_vector_from_object`) :
1. **Prioritaires** : `nom_produit`, `nom`, `categorie_produit`, `categorie`, `description_produit`, `description`
2. **Optionnels** : `marque`, `modele`, `taille`, `style`, `couleur`, `etat` (seulement si présents)
3. **Prix/Devise** : `prix`, `devise`

**Point clé** : Pour les produits génériques, `marque` et `couleur` sont **optionnels** et peuvent être absents.

## 🖼️ Recherche par Image

### Construction des Tags

#### Étape 1: Analyse IA de l'Image

L'IA génère un JSON avec structure détaillée :

```json
{
  "data": {
    "category": "Coiffure",
    "nom_produit": "Mèches brésiliennes",
    "description_produit": "Mèches brésiliennes de haute qualité...",
    "produits": {
      "valeur": ["Mèches brésiliennes,Lisse,Noir,18 pouces,100g,Premium,Non traité,Brésil"],
      "sous_caracteristiques": {
        "marque": ["Brésil"],
        "couleur": ["Noir"],
        "texture": ["Lisse"],
        "longueur": ["18 pouces"],
        "poids": ["100g"],
        "qualite": ["Premium"]
      }
    }
  }
}
```

#### Étape 2: Extraction et Normalisation

```rust
// Dans hybrid_image_search_service.rs
fn normalize_tag(tag: &str) -> String {
    tag.trim()
        .to_lowercase()
        .chars()
        .map(|c| match c {
            'à' | 'á' | 'â' | 'ã' | 'ä' => 'a',
            'è' | 'é' | 'ê' | 'ë' => 'e',
            // ...
        })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}
```

**Tags extraits** :
1. Depuis `produits.valeur` (split par virgule)
2. Depuis `sous_caracteristiques.marque`
3. Depuis `sous_caracteristiques.couleur`
4. Depuis toutes les autres clés de `sous_caracteristiques`
5. `nom_produit` et `category` ajoutés

**Résultat** : `["mèches brésiliennes", "lisse", "noir", "18 pouces", "100g", "premium", "non traité", "brésil", "coiffure"]`

#### Étape 3: Matching avec les Produits

Les tags sont passés à `hybrid_image_search` :

```sql
SELECT * FROM hybrid_image_search(
    $1::TEXT[],  -- tags: ["mèches brésiliennes", "lisse", "noir", ...]
    $2::TEXT,    -- category: "Coiffure"
    $3::TEXT,    -- marque: "Brésil" (si présent)
    $4::TEXT,    -- couleur: "Noir" (si présent)
    $5::TEXT,    -- search_query_semantic: "Mèches brésiliennes de haute qualité..."
    ...
)
```

## ⚠️ PROBLÈME IDENTIFIÉ

### Incompatibilité entre Recherche Image et Produits Génériques

**Recherche par image** suppose que les produits ont :
- ✅ Marque (`search_marque`)
- ✅ Couleur (`search_couleur`)
- ✅ Tags spécifiques détaillés

**Produits génériques** (services, prestations) ont :
- ❌ Pas de marque
- ❌ Pas de couleur
- ✅ Seulement : nom, description, catégorie

**Exemple concret** :

**Produit générique** (Cours de mathématiques) :
```sql
valeur = "Cours de soutien en mathématiques"
characteristic_vector = ["Cours", "soutien", "mathématiques", "Éducation", "0", "XAF"]
-- Pas de marque, pas de couleur
```

**Recherche par image** (cherche "Mèches") :
```sql
tags = ["mèches brésiliennes", "lisse", "noir", "18 pouces", ...]
search_marque = "Brésil"
search_couleur = "Noir"
```

**Résultat : Aucun match** car :
- Le produit générique n'a pas de marque/couleur
- Les tags de l'image ne matchent pas avec "Cours de soutien en mathématiques"

**MAIS** : Si la recherche par image cherche "Cours" ou "mathématiques", elle devrait matcher, mais la fonction SQL actuelle exige des correspondances sur marque/couleur OU tags, ce qui peut exclure les produits génériques.

## 🔧 SOLUTION PROPOSÉE

### Adapter `hybrid_image_search` pour les Produits Génériques

La fonction SQL doit :

1. **Ne pas exiger marque/couleur** si elles sont NULL
2. **Matcher sur tags OU query semantic** même sans marque/couleur
3. **Réduire le poids des critères spécifiques** (marque/couleur) pour les produits génériques

**Modification de la condition WHERE** :

```sql
-- AVANT (trop strict)
AND (
    (search_marque IS NOT NULL AND ac.valeur ILIKE search_marque || '%')
    OR (search_tags IS NOT NULL AND ... >= 2)
    OR (search_query_semantic IS NOT NULL AND ...)
)

-- APRÈS (adapté produits génériques)
AND (
    -- Option 1: Correspondance sur query semantic (description) - FONCTIONNE pour produits génériques
    (search_query_semantic IS NOT NULL AND search_query_semantic != '' AND (
        ac.valeur ILIKE search_query_semantic || '%'
        OR to_tsvector(pg_lang, ac.valeur) @@ plainto_tsquery(pg_lang, search_query_semantic)
        OR characteristic_vector_to_tsvector(ac.characteristic_vector) @@ plainto_tsquery(pg_lang, search_query_semantic)
        OR full_vector_to_tsvector(ac.full_vector) @@ plainto_tsquery(pg_lang, search_query_semantic)
    ))
    -- Option 2: Correspondance sur au moins 2 tags - FONCTIONNE si tags génériques
    OR (search_tags IS NOT NULL AND array_length(search_tags, 1) > 0 AND (
        (SELECT COUNT(*) FROM unnest(search_tags) tag 
         WHERE ac.valeur ILIKE '%' || tag || '%'
         OR characteristic_vector_to_tsvector(ac.characteristic_vector) @@ plainto_tsquery(pg_lang, tag)) >= 2
    ))
    -- Option 3: Correspondance marque exacte - SEULEMENT si marque fournie (produits spécifiques)
    OR (search_marque IS NOT NULL AND search_marque != '' AND (
        ac.valeur ILIKE search_marque || '%'
        OR (ac.product_labels->>'marque') ILIKE search_marque || '%'
    ))
)
-- ✅ Les critères secondaires (couleur, catégorie) sont des filtres additionnels, pas obligatoires
AND (search_couleur IS NULL OR search_couleur = '' OR (
    ac.valeur ILIKE '%' || search_couleur || '%'
    OR (jsonb_typeof(ac.product_labels->'couleurs') = 'array' 
        AND ac.product_labels->'couleurs'::text ILIKE '%' || search_couleur || '%')
))
```

### Améliorer l'Extraction des Tags depuis l'Image

Pour les produits génériques, l'IA doit extraire des tags **génériques** :

**Exemple** : Image d'un cours de mathématiques
- ❌ Ne pas chercher marque/couleur (inexistants)
- ✅ Extraire : "cours", "mathématiques", "soutien", "éducation", "lycée"
- ✅ `search_query_semantic` : "Cours de soutien en mathématiques pour élèves du lycée"

## 📊 Comparaison des Approches

| Aspect | Recherche Textuelle | Recherche par Image |
|--------|---------------------|-------------------|
| **Source** | Requête utilisateur directe | Analyse IA de l'image |
| **Normalisation** | Minuscules + variantes accents | Minuscules + suppression accents |
| **Matching** | ILIKE + full-text sur `valeur`, `characteristic_vector`, `full_vector` | Tags + marque + couleur + query semantic |
| **Produits génériques** | ✅ Fonctionne bien (pas de dépendance marque/couleur) | ⚠️ Problème si exige marque/couleur |
| **Produits spécifiques** | ✅ Fonctionne | ✅ Fonctionne mieux (plus de détails) |

## ✅ Recommandations

1. **Adapter `hybrid_image_search`** pour ne pas exiger marque/couleur
2. **Améliorer le prompt IA** pour distinguer produits génériques vs spécifiques
3. **Utiliser `search_query_semantic`** comme critère principal (fonctionne pour tous les types)
4. **Réduire le poids des tags spécifiques** (marque/couleur) dans le scoring
5. **Augmenter le poids de `search_query_semantic`** pour matching sémantique


