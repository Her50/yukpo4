# 📊 Le Vrai Tableau Reçu par LinearAutocompleteEditor

## 🎯 Format exact des données dans les logs

D'après les logs de création de service, voici le **vrai tableau** que LinearAutocompleteEditor reçoit :

### 📋 1. Format dans la réponse IA (logs backend)

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

### 📋 2. Format chargé dans FormulaireYukpoIntelligentScreen

**Fichier :** `mobile/src/screens/FormulaireYukpoIntelligentScreen.tsx`  
**Lignes :** 1697-1722

```typescript
// ✅ Chargement depuis suggestion.data.produits
if (iaProduitsNode && !initialValues.produits) {
  if (typeof iaProduitsNode === 'object' && 'valeur' in iaProduitsNode) {
    const typeDonnee = iaProduitsNode.type_donnee || 'autocomplete';
    if (typeDonnee === 'autocomplete') {
      initialValues.produits = {
        type_donnee: 'autocomplete',
        valeur: Array.isArray(iaProduitsNode.valeur) ? iaProduitsNode.valeur : [],
        // ✅ LE VRAI TABLEAU : ["Réparation fuite,Installation robinet,..."]
        separateur: iaProduitsNode.separateur || ',',
        sous_caracteristiques: iaProduitsNode.sous_caracteristiques || {},
        identifiant_base: iaProduitsNode.identifiant_base || 'produits',
        filtrable: iaProduitsNode.filtrable !== false,
        origine_champs: iaProduitsNode.origine_champs || 'ia'
      };
    }
  }
}
```

**Résultat dans `initialValues.produits` :**
```typescript
{
  type_donnee: 'autocomplete',
  valeur: [
    "Réparation fuite,Installation robinet,Entretien canalisation,À domicile,Matériel inclus,Garantie 1 mois,Yaoundé"
  ],
  separateur: ',',
  sous_caracteristiques: {
    type: ["Réparation fuite", "Installation robinet", "Entretien canalisation"],
    mode: ["À domicile", "En atelier"],
    materiel: ["Matériel inclus", "Matériel non inclus"],
    garantie: ["Garantie 1 mois", "Garantie 3 mois"],
    zone: ["Yaoundé", "Douala", "Toutes zones"],
    delai: ["Rapide 24h", "Normal 2-3 jours", "Sur RDV"],
    qualite: ["Professionnelle", "Standard"],
    prix: ["Fixe", "Variable selon prestation"]
  },
  identifiant_base: 'produits',
  filtrable: true,
  origine_champs: 'ia'
}
```

### 📋 3. Format extrait pour LinearAutocompleteEditor

**Fichier :** `mobile/src/screens/FormulaireYukpoIntelligentScreen.tsx`  
**Lignes :** 2452-2470

```typescript
// ✅ Extraction depuis valeursFormulaire['produits']
const fieldValue = valeursFormulaire[field.name];  // field.name = 'produits'
let currentValues: string[] = [];
let currentSousCaracs = field.sousCaracteristiques || {};

if (fieldValue && typeof fieldValue === 'object' && 'valeur' in fieldValue) {
  // Cas objet complexe depuis l'IA
  const rawValues = Array.isArray(fieldValue.valeur) ? fieldValue.valeur : [];
  currentValues = rawValues.map(v => {
    if (typeof v === 'string') {
      return v;  // ✅ Retourne la string complète
    }
    // ... conversions
  }).filter(v => v.length > 0);

  currentSousCaracs = fieldValue.sous_caracteristiques || field.sousCaracteristiques || {};
}
```

**Résultat dans `currentValues` :**
```typescript
currentValues = [
  "Réparation fuite,Installation robinet,Entretien canalisation,À domicile,Matériel inclus,Garantie 1 mois,Yaoundé"
]
```

### 📋 4. Format passé à LinearAutocompleteEditor

**Fichier :** `mobile/src/screens/FormulaireYukpoIntelligentScreen.tsx`  
**Lignes :** 2535-2540

```typescript
<LinearAutocompleteEditor
  label={field.label}
  identifiantBase={field.identifiantBase || field.name || 'produit'}
  sousCaracteristiques={currentSousCaracs || {}}
  separateur={safeSeparateur}  // ","
  value={currentValues || []}  // ✅ LE VRAI TABLEAU PASSÉ ICI
  // ...
/>
```

**Le vrai tableau passé via la prop `value` :**
```typescript
value = [
  "Réparation fuite,Installation robinet,Entretien canalisation,À domicile,Matériel inclus,Garantie 1 mois,Yaoundé"
]
```

### 📋 5. Format reçu dans LinearAutocompleteEditor

**Fichier :** `mobile/src/components/LinearAutocompleteEditor.tsx`  
**Lignes :** 632-642

```typescript
// ✅ Extraction depuis la prop value
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

**Résultat dans `iaCombinaisons` :**
```typescript
iaCombinaisons = [
  "Réparation fuite,Installation robinet,Entretien canalisation,À domicile,Matériel inclus,Garantie 1 mois,Yaoundé"
]
```

**Lignes :** 557-578

```typescript
// ✅ Affichage de la première valeur
const displayValue = (() => {
    if (!value || !Array.isArray(value) || value.length === 0) {
        return '';
    }

    const firstValue = value[0];  // ✅ Prend value[0]

    if (typeof firstValue === 'string') {
        return firstValue;  // ✅ Retourne la string complète
    }
    
    return '';
})();
```

**Résultat dans `displayValue` :**
```typescript
displayValue = "Réparation fuite,Installation robinet,Entretien canalisation,À domicile,Matériel inclus,Garantie 1 mois,Yaoundé"
```

## 📊 Tableau complet des transformations

| Étape | Variable | Type | Valeur |
|-------|----------|------|--------|
| **1. IA génère** | `suggestion.data.produits.valeur` | `string[]` | `["Réparation fuite,Installation robinet,..."]` |
| **2. Formulaire charge** | `initialValues.produits.valeur` | `string[]` | `["Réparation fuite,Installation robinet,..."]` |
| **3. Formulaire extrait** | `currentValues` | `string[]` | `["Réparation fuite,Installation robinet,..."]` |
| **4. Formulaire passe** | `value` (prop) | `string[]` | `["Réparation fuite,Installation robinet,..."]` |
| **5. Linear reçoit** | `value` (prop) | `string[]` | `["Réparation fuite,Installation robinet,..."]` |
| **6. Linear extrait** | `iaCombinaisons` | `string[]` | `["Réparation fuite,Installation robinet,..."]` |
| **7. Linear affiche** | `displayValue` | `string` | `"Réparation fuite,Installation robinet,..."` |

## 🎯 Le Vrai Tableau (résumé)

### Format exact dans les logs

```json
{
  "produits": {
    "valeur": [
      "Réparation fuite,Installation robinet,Entretien canalisation,À domicile,Matériel inclus,Garantie 1 mois,Yaoundé"
    ]
  }
}
```

### Format passé à LinearAutocompleteEditor

```typescript
value = [
  "Réparation fuite,Installation robinet,Entretien canalisation,À domicile,Matériel inclus,Garantie 1 mois,Yaoundé"
]
```

### Format affiché dans LinearAutocompleteEditor

```typescript
displayValue = "Réparation fuite,Installation robinet,Entretien canalisation,À domicile,Matériel inclus,Garantie 1 mois,Yaoundé"
```

## ✅ Points importants

1. **Le tableau `valeur` contient UNE SEULE string** : La combinaison complète choisie par l'IA
2. **Format de la string** : Valeurs séparées par des virgules (séparateur `,`)
3. **Index préféré** : `ai_preferred_index: 0` → La première valeur du tableau (`valeur[0]`)
4. **Sous-caractéristiques** : Contiennent TOUTES les options possibles, pas seulement celles utilisées
5. **LinearAutocompleteEditor** : Reçoit `value = ["combinaison complète"]` et affiche `value[0]`

## 🔍 Détails de la combinaison

La string complète contient :
- `"Réparation fuite"` → type
- `"Installation robinet"` → type (deuxième)
- `"Entretien canalisation"` → type (troisième)
- `"À domicile"` → mode
- `"Matériel inclus"` → materiel
- `"Garantie 1 mois"` → garantie
- `"Yaoundé"` → zone

**Séparateur :** `,` (virgule)

**Total :** 7 valeurs dans la combinaison

