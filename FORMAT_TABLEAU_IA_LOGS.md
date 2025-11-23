# 📊 Format du Tableau IA - Analyse des Logs

## 🔍 Analyse des logs fournis

D'après les logs de création de service, voici le format exact du tableau IA :

### 📋 Structure complète dans les logs

```json
{
  "produits": {
    "type_donnee": "autocomplete",
    "valeur": [
      "Réparation fuite,Installation robinet,Entretien canalisation,À domicile,Matériel inclus,Garantie 1 mois,Yaoundé"
    ],
    "separateur": ",",
    "sous_caracteristiques": {
      "type": ["Réparation fuite", "Installation robinet", "Entretien canalisation"],
      "mode": ["À domicile", "En atelier"],
      "materiel": ["Matériel inclus", "Matériel non inclus"],
      "garantie": ["Garantie 1 mois", "Garantie 3 mois"],
      "zone": ["Yaoundé", "Douala", "Toutes zones"],
      "delai": ["Rapide 24h", "Normal 2-3 jours", "Sur RDV"],
      "qualite": ["Professionnelle", "Standard"],
      "prix": ["Fixe", "Variable selon prestation"]
    },
    "dependencies": {
      "strict": []
    },
    "ai_preferred_index": 0,
    "filtrable": true,
    "identifiant_base": "produits",
    "origine_champs": "ia"
  }
}
```

## 🎯 Le Choix du Tableau IA

### 1. Format du tableau `valeur`

**Type :** `string[]` (tableau de strings)

**Contenu :** Chaque string est une combinaison complète, avec les valeurs séparées par le `separateur`

**Exemple :**
```json
"valeur": [
  "Réparation fuite,Installation robinet,Entretien canalisation,À domicile,Matériel inclus,Garantie 1 mois,Yaoundé"
]
```

### 2. Le champ `ai_preferred_index`

**Type :** `number` (entier)

**Valeur dans les logs :** `0`

**Signification :**
- `ai_preferred_index: 0` = La combinaison à l'index 0 (première combinaison) est préférée par l'IA
- `ai_preferred_index: 1` = La combinaison à l'index 1 (deuxième combinaison) est préférée
- etc.

**Dans les logs :**
```json
"ai_preferred_index": 0
```

Cela signifie que `valeur[0]` est la combinaison préférée par l'IA.

### 3. Comment le choix est fait

**Fichier :** `backend/src/services/creer_service.rs`  
**Lignes :** 2655-2695

```rust
let ai_preferred_index = produits_field
    .get("ai_preferred_index")
    .and_then(|v| v.as_i64())
    .unwrap_or(0) as usize;

// Traiter chaque combinaison
for (index, valeur_str) in valeurs.iter().enumerate() {
    // ...
    
    // ✅ ICI : Déterminer si cette combinaison est préférée
    let is_ai_preferred = index == ai_preferred_index;
    
    // Sauvegarder avec le flag is_ai_preferred
    sqlx::query(
        r#"INSERT INTO autocomplete_combinations 
           (..., is_ai_preferred, ...)
           VALUES (..., $4, ...)"#
    )
    .bind(is_ai_preferred)  // true si index == ai_preferred_index
    .execute(pool).await;
}
```

## 📊 Exemple avec plusieurs combinaisons

Si l'IA génère plusieurs combinaisons :

```json
{
  "produits": {
    "type_donnee": "autocomplete",
    "valeur": [
      "Réparation fuite,À domicile,Matériel inclus,Garantie 1 mois,Yaoundé",  // Index 0
      "Installation robinet,À domicile,Matériel inclus,Garantie 3 mois,Yaoundé",  // Index 1
      "Entretien canalisation,En atelier,Matériel non inclus,Garantie 1 mois,Douala"  // Index 2
    ],
    "separateur": ",",
    "sous_caracteristiques": {
      "type": ["Réparation fuite", "Installation robinet", "Entretien canalisation"],
      "mode": ["À domicile", "En atelier"],
      "materiel": ["Matériel inclus", "Matériel non inclus"],
      "garantie": ["Garantie 1 mois", "Garantie 3 mois"],
      "zone": ["Yaoundé", "Douala", "Toutes zones"]
    },
    "ai_preferred_index": 0  // ✅ La première combinaison (index 0) est préférée
  }
}
```

**Résultat :**
- `valeur[0]` → `is_ai_preferred = true` ✅
- `valeur[1]` → `is_ai_preferred = false`
- `valeur[2]` → `is_ai_preferred = false`

## 🔄 Flux complet

### 1. Génération par l'IA

L'IA génère :
```json
{
  "produits": {
    "valeur": ["combinaison1", "combinaison2", "combinaison3"],
    "ai_preferred_index": 0
  }
}
```

### 2. Sauvegarde en base

**Fichier :** `backend/src/services/creer_service.rs`  
**Fonction :** `save_ia_combinations_to_db`

```rust
for (index, valeur_str) in valeurs.iter().enumerate() {
    let is_ai_preferred = index == ai_preferred_index;  // true pour index 0
    
    sqlx::query("INSERT INTO autocomplete_combinations (..., is_ai_preferred, ...)")
        .bind(is_ai_preferred)  // true pour la combinaison préférée
        .execute(pool).await;
}
```

### 3. Récupération côté frontend

**Fichier :** `mobile/src/screens/FormulaireYukpoIntelligentScreen.tsx`  
**Ligne :** 1761-1762

```typescript
// Récupérer les combinaisons par session_id
const combinationsResponse = await apiGet(`/api/combinations/session/${session_id}`);

// Trouver la combinaison préférée par l'IA
const preferred = combinationsResponse.combinations.find((c: any) => c.is_ai_preferred);
```

### 4. Affichage dans LinearAutocompleteEditor

**Fichier :** `mobile/src/components/LinearAutocompleteEditor.tsx`  
**Ligne :** 1465-1469

```typescript
items.push({
    key: draftKey,
    source: 'combination',
    rows,
    score,
    title: combo.isAIPreferred ? 'Version IA des prestataires' : 'Combinaison des prestataires',
    isPreferred: combo.isAIPreferred,  // true pour la combinaison préférée
    combination: combo,
});
```

## 📝 Résumé du format du tableau IA

### Structure JSON

```json
{
  "produits": {
    "type_donnee": "autocomplete",
    "valeur": [
      "combinaison1,combinaison2,combinaison3,...",  // Index 0
      "combinaison4,combinaison5,combinaison6,...",  // Index 1 (optionnel)
      "combinaison7,combinaison8,combinaison9,..."   // Index 2 (optionnel)
    ],
    "separateur": ",",
    "sous_caracteristiques": {
      "dimension1": ["valeur1", "valeur2", "valeur3"],
      "dimension2": ["valeurA", "valeurB"],
      "dimension3": ["valeurX", "valeurY", "valeurZ"]
    },
    "ai_preferred_index": 0,  // ✅ Index de la combinaison préférée
    "filtrable": true,
    "identifiant_base": "produits",
    "origine_champs": "ia"
  }
}
```

### Points clés

1. **`valeur`** : Tableau de strings, chaque string = une combinaison complète
2. **`ai_preferred_index`** : Index (0-based) de la combinaison préférée dans le tableau `valeur`
3. **`sous_caracteristiques`** : Toutes les valeurs possibles pour chaque dimension (pas seulement celles utilisées)
4. **`separateur`** : Caractère utilisé pour séparer les valeurs dans chaque combinaison (généralement `","`)

### Dans les logs fournis

- **Tableau `valeur`** : Contient 1 combinaison à l'index 0
- **`ai_preferred_index`** : `0` → La combinaison à l'index 0 est préférée
- **Résultat** : `valeur[0]` sera marquée `is_ai_preferred = true` en base de données

## ✅ Conclusion

**Le choix du tableau IA se fait via `ai_preferred_index` :**
- C'est un nombre qui indique l'index (position) de la combinaison préférée dans le tableau `valeur`
- Dans les logs : `ai_preferred_index: 0` signifie que la première combinaison (`valeur[0]`) est préférée
- Cette combinaison sera marquée `is_ai_preferred = true` en base de données
- Le frontend récupère et affiche cette combinaison en priorité

