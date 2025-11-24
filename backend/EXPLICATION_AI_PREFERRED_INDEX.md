# Explication : ai_preferred_index dans le JSON généré par l'IA

## Structure du JSON généré par l'IA

L'IA génère un JSON avec le champ `produits` qui contient :

```json
{
  "produits": {
    "type_donnee": "autocomplete",
    "valeur": [
      "Combinaison1,Val1,Val2,Val3,...,",
      "Combinaison2,ValA,ValB,ValC,...,",
      "Combinaison3,ValX,ValY,ValZ,...,"
    ],
    "separateur": ",",
    "sous_caracteristiques": {
      "dimension1": ["Val1", "ValA", "ValX"],
      "dimension2": ["Val2", "ValB", "ValY"],
      // ... 8+ dimensions
    },
    "ai_preferred_index": 0,  // ← INDEX (nombre), PAS un tableau
    "filtrable": true,
    "identifiant_base": "produits",
    "origine_champs": "ia"
  }
}
```

## Ce que signifie ai_preferred_index

**`ai_preferred_index`** est un **nombre (index)** qui indique la position de la combinaison préférée par l'IA dans le tableau `produits.valeur[]`.

### Exemple concret

Si l'IA génère :
```json
{
  "produits": {
    "valeur": [
      "Ndolé,Poisson braisé,Plantains frits,Épicé,Portion individuelle,Sur place,À emporter,Disponible",
      "Poulet DG,Riz,Épicé,Portion familiale,Sur place,Disponible",
      "Eru,Frites,Non épicé,Portion individuelle,À emporter,Sur commande"
    ],
    "ai_preferred_index": 0
  }
}
```

**Interprétation** :
- Le tableau `valeur[]` contient **3 combinaisons** (indices 0, 1, 2)
- `ai_preferred_index: 0` signifie que la **combinaison préférée est à l'index 0**
- Donc la combinaison préférée = `valeur[0]` = `"Ndolé,Poisson braisé,Plantains frits,Épicé,Portion individuelle,Sur place,À emporter,Disponible"`

## Utilisation dans le code

### 1. Extraction de l'index

```rust
let ai_preferred_index = produits_field
    .get("ai_preferred_index")
    .and_then(|v| v.as_i64())
    .unwrap_or(0) as usize;
```

### 2. Marquage de la combinaison préférée

```rust
// Pour chaque combinaison dans valeur[]
for (index, valeur_str) in valeurs.iter().enumerate() {
    // Vérifier si cette combinaison est celle préférée par l'IA
    let is_ai_preferred = index == ai_preferred_index;
    
    // Sauvegarder dans la base avec is_ai_preferred = true/false
    sqlx::query("INSERT INTO autocomplete_combinations (..., is_ai_preferred, ...)")
        .bind(is_ai_preferred)
        .execute(...)
}
```

### 3. Résultat en base de données

Dans la table `autocomplete_combinations`, une seule combinaison aura `is_ai_preferred = TRUE` :
- La combinaison à l'index `ai_preferred_index` → `is_ai_preferred = TRUE`
- Toutes les autres → `is_ai_preferred = FALSE`

## Règles importantes

1. **`ai_preferred_index` est TOUJOURS présent** (obligatoire dans le prompt)
2. **C'est un nombre** (0, 1, 2, 3, etc.) - PAS un tableau
3. **Il pointe vers une position** dans le tableau `produits.valeur[]`
4. **Si input clair** : `ai_preferred_index` = index de la combinaison correspondant aux caractéristiques réelles
5. **Si input vague** : `ai_preferred_index` = index de la combinaison la plus probable/appropriée
6. **Index 0 = première combinaison** dans le tableau `valeur[]`

## Exemple complet

```json
{
  "intention": "creation_service",
  "data": {
    "produits": {
      "type_donnee": "autocomplete",
      "valeur": [
        "Ndolé,Poisson braisé,Plantains frits,Épicé,Portion individuelle,Sur place,À emporter,Disponible",
        "Poulet DG,Riz,Épicé,Portion familiale,Sur place,Disponible",
        "Eru,Frites,Non épicé,Portion individuelle,À emporter,Sur commande"
      ],
      "sous_caracteristiques": {
        "plat": ["Ndolé", "Poisson braisé", "Poulet DG", "Eru"],
        "accompagnement": ["Plantains frits", "Riz", "Frites"],
        "saveur": ["Épicé", "Non épicé"],
        "portion": ["Portion individuelle", "Portion familiale"],
        "service": ["Sur place", "À emporter"],
        "disponibilité": ["Disponible", "Sur commande"]
      },
      "ai_preferred_index": 0,  // ← Combinaison préférée = valeur[0]
      "filtrable": true,
      "identifiant_base": "produits",
      "origine_champs": "ia"
    }
  }
}
```

**Dans ce cas** :
- 3 combinaisons générées (indices 0, 1, 2)
- `ai_preferred_index = 0` → la première combinaison (Ndolé...) est préférée
- Cette combinaison sera pré-sélectionnée dans le formulaire utilisateur
- Elle sera marquée `is_ai_preferred = TRUE` dans la base de données

## Résumé

- ❌ **PAS de tableau** `ai_preferred`
- ✅ **Un champ nombre** `ai_preferred_index` (ex: 0, 1, 2)
- ✅ **Pointe vers** une position dans `produits.valeur[]`
- ✅ **Obligatoire** dans tous les cas (même pour images précises)
- ✅ **Doit correspondre** aux caractéristiques réelles de l'input

