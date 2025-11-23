# 📋 Choix du Vecteur IA - LinearAutocompleteEditor

## 🎯 Ce que LinearAutocompleteEditor renvoie pour le vecteur IA

### Format de retour via `onChange`

Quand l'utilisateur sélectionne une combinaison IA préférée, `LinearAutocompleteEditor` appelle :

```typescript
onChange([vector], sousCaracs)
```

Où :
- **`vector`** : Une string contenant le vecteur complet séparé par le séparateur
- **`sousCaracs`** : Un objet `Record<string, string[]>` contenant les sous-caractéristiques organisées par label

### Exemple concret

**Input (depuis l'IA) :**
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
      "zone": ["Yaoundé", "Douala", "Toutes zones"]
    }
  }
}
```

**Output (ce que `onChange` reçoit) :**
```typescript
// Premier paramètre : tableau de strings (vecteurs)
[
  "Réparation fuite,Installation robinet,Entretien canalisation,À domicile,Matériel inclus,Garantie 1 mois,Yaoundé"
]

// Deuxième paramètre : sous-caractéristiques organisées
{
  "type": ["Réparation fuite", "Installation robinet", "Entretien canalisation"],
  "mode": ["À domicile", "En atelier"],
  "materiel": ["Matériel inclus", "Matériel non inclus"],
  "garantie": ["Garantie 1 mois", "Garantie 3 mois"],
  "zone": ["Yaoundé", "Douala", "Toutes zones"]
}
```

## 🔄 Flux de traitement

### 1. Extraction des combinaisons IA

**Fichier :** `mobile/src/components/LinearAutocompleteEditor.tsx`  
**Ligne :** 632-642

```typescript
const iaCombinaisons = useMemo(() => {
    if (!value || !Array.isArray(value)) {
        return [];
    }

    const combos = value
        .filter((combo) => typeof combo === 'string' && combo.trim().length > 0)
        .map((combo) => combo.trim());

    return Array.from(new Set(combos));
}, [value]);
```

### 2. Sélection de la combinaison IA

**Fichier :** `mobile/src/components/LinearAutocompleteEditor.tsx`  
**Ligne :** 1383-1391

```typescript
const applyIaCombination = (combo: string, draftKey: string) => {
    const parts = smartSplit(combo || '', separateur || ',').map((part) => part.trim()).filter(Boolean);
    const fallbackRows = buildLabeledPairs(parts, labelOrder, labelOrder, {
        maxValuesPerLabel: 2,
        contextTokens,
        categoryTokens,
    });
    applySuggestionDraft(draftKey, fallbackRows);
};
```

### 3. Application et envoi via onChange

**Fichier :** `mobile/src/components/LinearAutocompleteEditor.tsx`  
**Ligne :** 805-821

```typescript
const applySuggestionDraft = useCallback(
    (key: string, fallbackRows: Array<{ label: string; value: string }>) => {
        const rows = suggestionDrafts[key] && suggestionDrafts[key].length > 0
            ? suggestionDrafts[key]
            : fallbackRows;
        const result = createVectorFromRows(rows);

        if (!result) {
            Alert.alert('Suggestion vide', 'Ajoutez au moins une modalité avant de valider.');
            return;
        }

        // ✅ ICI : Envoi du vecteur IA choisi
        onChange([result.vector], result.sousCaracs);
        setSearchQuery('');
    },
    [createVectorFromRows, onChange, suggestionDrafts]
);
```

### 4. Construction du vecteur final

**Fichier :** `mobile/src/components/LinearAutocompleteEditor.tsx`  
**Ligne :** 675-703

```typescript
const createVectorFromRows = useCallback(
    (rows: Array<{ label: string; value: string }>) => {
        const cleaned = rows
            .map((row) => ({
                label: (row.label ?? '').trim() || 'Caractéristique',
                value: (row.value ?? '').trim(),
            }))
            .filter((row) => row.value.length > 0);

        if (cleaned.length === 0) {
            return null;
        }

        // Construction du vecteur : valeurs jointes par le séparateur
        const vector = cleaned.map((row) => row.value).join(separateur || ',');

        // Construction des sous-caractéristiques organisées par label
        const sousCaracs: Record<string, string[]> = {};
        cleaned.forEach((row) => {
            if (!sousCaracs[row.label]) {
                sousCaracs[row.label] = [];
            }
            if (!sousCaracs[row.label].includes(row.value)) {
                sousCaracs[row.label].push(row.value);
            }
        });

        return { vector, sousCaracs };
    },
    [separateur]
);
```

## 📤 Format final renvoyé

### Structure complète

```typescript
// Signature de onChange
onChange: (values: string[], updatedSousCaracs?: Record<string, string[]>) => void

// Appel avec le vecteur IA
onChange(
    // Premier paramètre : tableau contenant le vecteur complet
    [
        "Réparation fuite,Installation robinet,Entretien canalisation,À domicile,Matériel inclus,Garantie 1 mois,Yaoundé"
    ],
    // Deuxième paramètre : sous-caractéristiques organisées
    {
        "type": ["Réparation fuite", "Installation robinet", "Entretien canalisation"],
        "mode": ["À domicile", "En atelier"],
        "materiel": ["Matériel inclus", "Matériel non inclus"],
        "garantie": ["Garantie 1 mois", "Garantie 3 mois"],
        "zone": ["Yaoundé", "Douala", "Toutes zones"]
    }
)
```

## 🎨 Affichage dans l'interface

### Suggestions IA affichées

**Fichier :** `mobile/src/components/LinearAutocompleteEditor.tsx`  
**Ligne :** 1474-1499

Les combinaisons IA sont affichées avec :
- **Titre** : `"Suggestion IA 1"`, `"Suggestion IA 2"`, etc.
- **Source** : `'ia'`
- **Score** : Calculé avec `computeIaSuggestionScore` + 4 points de bonus
- **Valeur** : Stockée dans `iaValue`

### Caractéristiques préférées par l'IA

**Fichier :** `mobile/src/components/LinearAutocompleteEditor.tsx`  
**Ligne :** 1501-1553

Un candidat spécial est créé à partir des `sous_caracteristiques` :
- **Titre** : `"Caractéristiques suggérées par l'IA"`
- **Score** : 15 (priorité maximale)
- **isPreferred** : `true`
- **Source** : `'ia'`

## ✅ Points importants

1. **Le vecteur est toujours un tableau** : `[vector]` même s'il n'y a qu'un seul vecteur
2. **Le séparateur est préservé** : Utilisé pour joindre les valeurs et pour les re-séparer
3. **Les sous-caractéristiques sont optionnelles** : Le deuxième paramètre peut être `undefined`
4. **Format cohérent** : Même format que les autres sources (popular, combination)

## 🔍 Utilisation dans le formulaire parent

Dans `FormulaireYukpoIntelligentScreen.tsx`, le handler reçoit :

```typescript
<LinearAutocompleteEditor
    value={currentValues || []}
    onChange={(newValues, updatedSousCaracs) => {
        // newValues : string[] - ["Réparation fuite,Installation robinet,..."]
        // updatedSousCaracs : Record<string, string[]> | undefined
        
        setValeursFormulaire(prev => ({
            ...prev,
            produits: {
                type_donnee: 'autocomplete',
                valeur: newValues, // Tableau de strings
                separateur: ',',
                sous_caracteristiques: updatedSousCaracs || prev.produits?.sous_caracteristiques || {},
                identifiant_base: 'produits',
                filtrable: true,
                origine_champs: 'ia'
            }
        }));
    }}
/>
```

## 📝 Résumé

**Avant le choix IA du vecteur autocomplete, LinearAutocompleteEditor doit renvoyer :**

```typescript
onChange(
    [vectorString],  // Tableau contenant le vecteur complet comme string
    sousCaracs      // Objet organisant les valeurs par label (optionnel)
)
```

Où :
- `vectorString` = `"valeur1,valeur2,valeur3,..."` (séparé par le séparateur)
- `sousCaracs` = `{ "label1": ["valeur1"], "label2": ["valeur2"], ... }`

