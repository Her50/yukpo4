# 🔍 Construction des Tags pour la Recherche par Image

## Vue d'ensemble

Les tags sont construits à partir de l'analyse IA de l'image dans la fonction `analyze_image_like_creation` du service `HybridImageSearchService`. Ils servent ensuite à matcher les produits dans la base de données via la fonction SQL `hybrid_image_search`.

## 📋 Processus de Construction

### Étape 1: Analyse IA de l'Image

L'IA analyse l'image et génère un JSON avec la structure suivante :

```json
{
  "data": {
    "category": "Électronique",
    "nom_produit": "Souris Logitech MX Master 3",
    "description_produit": "Souris sans fil ergonomique...",
    "produits": {
      "valeur": ["Logitech,MX Master 3,Sans fil,Noir"],
      "sous_caracteristiques": {
        "marque": ["Logitech"],
        "modele": ["MX Master 3"],
        "couleur": ["Noir", "Gris"],
        "type": ["Souris"],
        "connectivite": ["Sans fil", "Bluetooth"],
        "ergonomie": ["Ergonomique"]
      }
    }
  }
}
```

### Étape 2: Normalisation des Tags

Tous les tags passent par la fonction `normalize_tag()` qui :

1. **Trim** : Supprime les espaces avant/après
2. **Minuscules** : Convertit en minuscules
3. **Suppression accents** : Remplace les caractères accentués
   - `à, á, â, ã, ä` → `a`
   - `è, é, ê, ë` → `e`
   - `ì, í, î, ï` → `i`
   - `ò, ó, ô, õ, ö` → `o`
   - `ù, ú, û, ü` → `u`
   - `ç` → `c`
   - `ñ` → `n`
4. **Normalisation espaces** : Supprime les espaces multiples

**Exemple** :
- `"Logitech"` → `"logitech"`
- `"Mèches Brésiliennes"` → `"meches bresiliennes"`
- `"Noir  "` → `"noir"`

### Étape 3: Extraction depuis `produits.valeur`

Si `produits.valeur` est un tableau avec une chaîne comma-separated :

```rust
// Format: ["Logitech,MX Master 3,Sans fil,Noir"]
if let Some(first_val) = valeur_arr.first().and_then(|v| v.as_str()) {
    let parts: Vec<&str> = first_val.split(',').map(|s| s.trim()).collect();
    // parts = ["Logitech", "MX Master 3", "Sans fil", "Noir"]
    for part in parts {
        let normalized = normalize_tag(part);
        tags.push(normalized);  // Ajoute chaque partie normalisée
    }
}
```

**Résultat** : `["logitech", "mx master 3", "sans fil", "noir"]`

### Étape 4: Extraction depuis `sous_caracteristiques`

#### 4.1 Marque (`marque` ou `brand`)

```rust
if let Some(marques_arr) = sous_caracs.get("marque").and_then(|m| m.as_array()) {
    marque = marques_arr.first().map(|s| normalize_tag(s));
    // Ajoute toutes les marques aux tags
    for val in marques_arr {
        tags.push(normalize_tag(val));
    }
}
```

**Résultat** : `marque = Some("logitech")`, tags incluent `"logitech"`

#### 4.2 Modèle (`modele` ou `model`)

Même processus que la marque.

**Résultat** : `_modele = Some("mx master 3")`, tags incluent `"mx master 3"`

#### 4.3 Couleurs (`couleur` ou `color`)

```rust
if let Some(couleurs_arr) = sous_caracs.get("couleur").and_then(|c| c.as_array()) {
    couleurs = couleurs_arr
        .iter()
        .filter_map(|v| v.as_str())
        .map(|s| normalize_tag(s))
        .collect();
    // Ajoute chaque couleur aux tags
    for couleur in &couleurs {
        tags.push(couleur.clone());
    }
}
```

**Résultat** : `couleurs = ["noir", "gris"]`, tags incluent `"noir"` et `"gris"`

#### 4.4 Autres Caractéristiques

Toutes les autres clés dans `sous_caracteristiques` sont également extraites :

```rust
for (_key, value) in sous_caracs.iter() {
    if let Some(vals) = value.as_array() {
        for val in vals.iter().filter_map(|v| v.as_str()) {
            let normalized = normalize_tag(val);
            tags.push(normalized);
        }
    }
}
```

**Résultat** : Tags incluent `"souris"`, `"sans fil"`, `"bluetooth"`, `"ergonomique"`, etc.

### Étape 5: Fallback si `sous_caracteristiques` manquant

Si `sous_caracteristiques` n'existe pas, extraction depuis `description_produit` :

```rust
if !description_produit.is_empty() {
    let words: Vec<&str> = description_produit.split_whitespace().collect();
    for word in words.iter().take(10) {  // Limite à 10 mots
        let normalized = normalize_tag(word);
        if normalized.len() > 2 && !tags.contains(&normalized) {
            tags.push(normalized);  // Ignore mots trop courts (< 3 caractères)
        }
    }
}
```

### Étape 6: Ajout du Nom et de la Catégorie

```rust
let nom = normalize_tag(&nom_produit);
let categorie = normalize_tag(&category_str);

if !tags.contains(&nom) {
    tags.push(nom.clone());  // Ex: "souris logitech mx master 3"
}
if !tags.contains(&categorie) {
    tags.push(categorie.clone());  // Ex: "electronique"
}
```

## 📊 Exemple Complet

### Input JSON IA

```json
{
  "data": {
    "category": "Électronique",
    "nom_produit": "Souris Logitech MX Master 3",
    "description_produit": "Souris sans fil ergonomique pour professionnels",
    "produits": {
      "valeur": ["Logitech,MX Master 3,Sans fil,Noir"],
      "sous_caracteristiques": {
        "marque": ["Logitech"],
        "modele": ["MX Master 3"],
        "couleur": ["Noir", "Gris"],
        "type": ["Souris"],
        "connectivite": ["Sans fil", "Bluetooth"],
        "usage": ["Professionnel"]
      }
    }
  }
}
```

### Tags Construits (après normalisation)

```rust
tags = [
    "logitech",           // depuis valeur autocomplete
    "mx master 3",        // depuis valeur autocomplete
    "sans fil",           // depuis valeur autocomplete
    "noir",               // depuis valeur autocomplete
    "logitech",           // depuis sous_caracteristiques.marque (déjà présent, pas dupliqué)
    "mx master 3",        // depuis sous_caracteristiques.modele (déjà présent)
    "noir",               // depuis sous_caracteristiques.couleur (déjà présent)
    "gris",               // depuis sous_caracteristiques.couleur
    "souris",             // depuis sous_caracteristiques.type
    "sans fil",           // depuis sous_caracteristiques.connectivite (déjà présent)
    "bluetooth",          // depuis sous_caracteristiques.connectivite
    "professionnel",      // depuis sous_caracteristiques.usage
    "souris logitech mx master 3",  // nom_produit normalisé
    "electronique"        // category normalisée
]
```

**Tags finaux (dédupliqués)** : `["logitech", "mx master 3", "sans fil", "noir", "gris", "souris", "bluetooth", "professionnel", "souris logitech mx master 3", "electronique"]`

## ⚠️ Problèmes Potentiels

### 1. Tags Vides ou Insuffisants

**Symptôme** : `tags.len() < 3`

**Causes possibles** :
- `produits.sous_caracteristiques` manquant dans le JSON IA
- `produits.valeur` vide ou mal formaté
- Description trop courte ou générique

**Solution** : Le code utilise un fallback qui extrait des mots de la description, mais c'est moins précis.

### 2. Tags Mal Normalisés

**Symptôme** : Tags avec accents ou espaces multiples

**Cause** : La fonction `normalize_tag()` n'est pas appliquée partout

**Solution** : Vérifier que tous les tags passent par `normalize_tag()`

### 3. Tags Trop Génériques

**Symptôme** : Tags comme `"produit"`, `"objet"`, `"article"`

**Cause** : L'IA génère des tags trop génériques

**Solution** : Améliorer le prompt IA pour exiger des tags spécifiques

## 🔧 Utilisation dans la Recherche SQL

Les tags sont passés à la fonction PostgreSQL `hybrid_image_search` :

```sql
SELECT * FROM hybrid_image_search(
    $1::TEXT[],  -- tags: ["logitech", "mx master 3", "sans fil", ...]
    $2::TEXT,    -- category: "Électronique"
    $3::TEXT,    -- marque: "Logitech"
    $4::TEXT,    -- couleur: "Noir"
    $5::TEXT,    -- search_query_semantic: "Souris sans fil ergonomique..."
    ...
)
```

La fonction SQL cherche des correspondances :
- **ILIKE** : `ac.valeur ILIKE '%logitech%'`
- **Full-text** : `characteristic_vector_to_tsvector(...) @@ plainto_tsquery('french', 'logitech')`
- **Tags communs** : Au moins 2 tags doivent correspondre pour un score significatif

## 📝 Logs de Debug

Le code génère des logs détaillés :

```rust
log_info(&format!(
    "[HybridImageSearch] 🏷️ Tags extraits ({}): {:?}",
    tags.len(),
    &tags.iter().take(15).map(|s| s.as_str()).collect::<Vec<_>>().join(", ")
));
```

**Exemple de log** :
```
[HybridImageSearch] 🏷️ Tags extraits (10): logitech, mx master 3, sans fil, noir, gris, souris, bluetooth, professionnel, souris logitech mx master 3, electronique
```

Si moins de 3 tags sont extraits, un warning est généré :
```
[HybridImageSearch] ⚠️ ATTENTION: Seulement 2 tags extraits (minimum recommandé: 3-5 pour bon matching)
```

## ✅ Bonnes Pratiques

1. **Minimum 3-5 tags** : Pour un matching efficace
2. **Tags spécifiques** : Éviter les tags génériques comme "produit", "objet"
3. **Normalisation cohérente** : Tous les tags doivent être normalisés
4. **Déduplication** : Éviter les doublons dans le tableau de tags
5. **Validation** : Vérifier que les tags ne sont pas vides avant la recherche SQL


