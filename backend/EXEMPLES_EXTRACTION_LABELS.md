# Exemples d'Extraction de Valeurs avec Labels

## 🎯 Problématique Résolue

**Avant (sans labels)** :
```sql
product_vector = ["Nike", "Air Max", "Noir", "42"]
-- ❌ Comment extraire la couleur ? Impossible de savoir que "Noir" = couleur !
```

**Maintenant (avec labels)** :
```sql
product_vector = ["Nike", "Air Max", "Noir", "42"]
product_labels = ["marque", "modele", "couleur", "pointure"]
-- ✅ On peut extraire la couleur facilement !
```

---

## 📊 Structure des deux tables

### Table 1 : `autocomplete_characteristics`

Stocke les **caractéristiques individuelles** avec leurs labels.

**Structure** :
| id | identifiant_base | sous_caracteristique | valeur | usage_count |
|----|------------------|----------------------|--------|-------------|
| 1  | produits         | marque               | Nike   | 15          |
| 2  | produits         | marque               | Adidas | 12          |
| 3  | produits         | couleur              | Noir   | 25          |
| 4  | produits         | couleur              | Blanc  | 18          |
| 5  | produits         | pointure             | 42     | 30          |

**✅ Extraction facile** :
```sql
-- Récupérer toutes les marques
SELECT valeur FROM autocomplete_characteristics 
WHERE identifiant_base = 'produits' AND sous_caracteristique = 'marque';
-- Résultat : ["Nike", "Adidas"]

-- Récupérer toutes les couleurs
SELECT valeur FROM autocomplete_characteristics 
WHERE identifiant_base = 'produits' AND sous_caracteristique = 'couleur';
-- Résultat : ["Noir", "Blanc"]
```

---

### Table 2 : `autocomplete_combinations`

Stocke les **vecteurs complets** avec leurs labels.

**Structure** :
| id | product_vector | product_labels | is_ai_preferred | session_id |
|----|----------------|----------------|-----------------|------------|
| 1  | ["Nike", "Air Max", "Noir", "42"] | ["marque", "modele", "couleur", "pointure"] | TRUE | session-123 |
| 2  | ["Adidas", "Superstar", "Blanc", "38"] | ["marque", "modele", "couleur", "pointure"] | FALSE | session-123 |

**✅ Extraction par label** :
```sql
-- Extraire la couleur d'une combinaison spécifique
SELECT get_vector_value_by_label(
    product_vector, 
    product_labels, 
    'couleur'
) as couleur
FROM autocomplete_combinations
WHERE id = 1;
-- Résultat : "Noir"

-- Extraire la marque
SELECT get_vector_value_by_label(
    product_vector, 
    product_labels, 
    'marque'
) as marque
FROM autocomplete_combinations
WHERE id = 1;
-- Résultat : "Nike"
```

**✅ Conversion en JSONB structuré** :
```sql
-- Convertir le vecteur en objet JSON
SELECT vector_to_jsonb(product_vector, product_labels) as structured_data
FROM autocomplete_combinations
WHERE id = 1;
-- Résultat : {"marque": "Nike", "modele": "Air Max", "couleur": "Noir", "pointure": "42"}
```

---

## 🔍 Exemples de requêtes avancées

### 1. Rechercher toutes les combinaisons avec marque "Nike"

```sql
SELECT 
    id,
    product_vector,
    get_vector_value_by_label(product_vector, product_labels, 'marque') as marque,
    get_vector_value_by_label(product_vector, product_labels, 'couleur') as couleur,
    vector_to_jsonb(product_vector, product_labels) as structured
FROM autocomplete_combinations
WHERE get_vector_value_by_label(product_vector, product_labels, 'marque') = 'Nike';
```

### 2. Grouper par couleur

```sql
SELECT 
    get_vector_value_by_label(product_vector, product_labels, 'couleur') as couleur,
    COUNT(*) as nb_combinaisons,
    SUM(usage_count) as popularite_totale
FROM autocomplete_combinations
GROUP BY get_vector_value_by_label(product_vector, product_labels, 'couleur')
ORDER BY popularite_totale DESC;
```

### 3. Rechercher par plusieurs critères

```sql
SELECT 
    product_vector,
    vector_to_jsonb(product_vector, product_labels) as data,
    usage_count
FROM autocomplete_combinations
WHERE 
    get_vector_value_by_label(product_vector, product_labels, 'marque') = 'Nike'
    AND get_vector_value_by_label(product_vector, product_labels, 'couleur') = 'Noir'
ORDER BY usage_count DESC;
```

### 4. Reconstruire l'objet autocomplete original

```sql
SELECT 
    id,
    vector_to_jsonb(product_vector, product_labels) as produit,
    vector_to_jsonb(location_vector, location_labels) as localisation,
    is_ai_preferred,
    usage_count
FROM autocomplete_combinations
WHERE session_id = 'session-123'
ORDER BY is_ai_preferred DESC, usage_count DESC;
```

---

## 📝 Exemples d'utilisation dans le backend Rust

### Extraire une valeur spécifique

```rust
// Récupérer la marque d'une combinaison
let marque: Option<String> = sqlx::query_scalar(
    "SELECT get_vector_value_by_label($1::TEXT[], $2::TEXT[], 'marque')"
)
.bind(&combination.product_vector)
.bind(&combination.product_labels)
.fetch_optional(pool)
.await?;

println!("Marque extraite : {:?}", marque); // Some("Nike")
```

### Convertir en JSONB structuré

```rust
// Convertir le vecteur en objet structuré
let structured: serde_json::Value = sqlx::query_scalar(
    "SELECT vector_to_jsonb($1::TEXT[], $2::TEXT[])"
)
.bind(&combination.product_vector)
.bind(&combination.product_labels)
.fetch_one(pool)
.await?;

println!("Structure : {}", structured);
// {"marque": "Nike", "modele": "Air Max", "couleur": "Noir", "pointure": "42"}
```

### Rechercher par label

```rust
// Trouver toutes les combinaisons Nike noires
let combinations: Vec<AutocompleteCombination> = sqlx::query_as(
    r#"
    SELECT * FROM autocomplete_combinations
    WHERE get_vector_value_by_label(product_vector, product_labels, 'marque') = $1
      AND get_vector_value_by_label(product_vector, product_labels, 'couleur') = $2
    ORDER BY usage_count DESC
    LIMIT 10
    "#
)
.bind("Nike")
.bind("Noir")
.fetch_all(pool)
.await?;
```

---

## ✅ Avantages de cette architecture

1. **Traçabilité complète** : On sait toujours quelle valeur correspond à quel label
2. **Extraction facile** : Fonctions SQL dédiées pour récupérer les valeurs
3. **Recherche par dimension** : Filtrer par marque, couleur, pointure, etc.
4. **Reconstruction** : Convertir en JSONB structuré quand nécessaire
5. **Performance** : Index GIN sur les vecteurs pour recherche rapide
6. **Validation** : Contrainte CHECK pour garantir même longueur vecteur/labels

---

## 📊 Exemple complet de flux

### Étape 1 : IA génère le JSON

```json
{
  "produits": {
    "type_donnee": "autocomplete",
    "valeur": ["Nike,Air Max,Noir,42,"],
    "separateur": ",",
    "sous_caracteristiques": {
      "marque": ["Nike", "Adidas"],
      "modele": ["Air Max", "Superstar"],
      "couleur": ["Noir", "Blanc"],
      "pointure": ["38", "39", "40", "41", "42"],
      "lieu": [""]
    }
  }
}
```

### Étape 2 : Backend extrait et sauvegarde

```rust
// Extraire
let combinations = extract_combinations_from_ai_response(&ai_response)?;
// combinations[0].product_vector = ["Nike", "Air Max", "Noir", "42"]
// combinations[0].product_labels = ["marque", "modele", "couleur", "pointure"]

// Sauvegarder
save_ai_combinations_batch(pool, combinations, "session-123").await?;
```

### Étape 3 : Frontend affiche avec labels

```typescript
// Récupérer la combinaison
const combo = await fetch('/api/autocomplete/combinations/session/session-123');
// combo.product_vector = ["Nike", "Air Max", "Noir", "42"]
// combo.product_labels = ["marque", "modele", "couleur", "pointure"]

// Afficher structuré
const structured = combo.product_vector.reduce((acc, value, idx) => {
  acc[combo.product_labels[idx]] = value;
  return acc;
}, {});
// {marque: "Nike", modele: "Air Max", couleur: "Noir", pointure: "42"}
```

### Étape 4 : Recherche SQL avec labels

```sql
-- Trouver toutes les chaussures Nike noires
SELECT * FROM autocomplete_combinations
WHERE 
  get_vector_value_by_label(product_vector, product_labels, 'marque') = 'Nike'
  AND get_vector_value_by_label(product_vector, product_labels, 'couleur') = 'Noir';
```

---

## 🎯 Résumé

### ✅ Table `autocomplete_characteristics`
- **Étiquette** : Colonne `sous_caracteristique` ✅
- **Exemple** : ("produits", "couleur", "jaune") → Label = "couleur" ✅

### ✅ Table `autocomplete_combinations`
- **Étiquettes** : Colonnes `product_labels` + `location_labels` ✅ 
- **Exemple** : 
  - `product_vector` = ["Nike", "Air Max", "Noir", "42"]
  - `product_labels` = ["marque", "modele", "couleur", "pointure"] ✅
  - **Extraction** : `get_vector_value_by_label(product_vector, product_labels, 'couleur')` → "Noir" ✅

**Les deux tables ont maintenant une traçabilité complète des étiquettes !** 🎉

