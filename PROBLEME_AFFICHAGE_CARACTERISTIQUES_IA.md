# ⚠️ Problème : Pourquoi les caractéristiques spécifiques ne s'affichent pas exactement

## 🔍 Analyse du problème

### Le problème identifié

Quand LinearAutocompleteEditor reçoit la combinaison IA, il ne l'affiche pas exactement comme elle a été générée par l'IA. Voici pourquoi :

## 📊 Flux actuel (problématique)

### 1. La combinaison IA reçue

```typescript
value = [
  "Réparation fuite,Installation robinet,Entretien canalisation,À domicile,Matériel inclus,Garantie 1 mois,Yaoundé"
]
```

### 2. Traitement dans LinearAutocompleteEditor

**Fichier :** `mobile/src/components/LinearAutocompleteEditor.tsx`  
**Lignes :** 1474-1499

```typescript
limitedIaCombinaisons.forEach((value, index) => {
    const parts = smartSplit(value || '', separateur || ',').map((part) => part.trim()).filter(Boolean);
    const fallbackRows = buildLabeledPairs(parts, labelOrder, labelOrder, {
        maxValuesPerLabel: 2,
        contextTokens,
        categoryTokens,
    });
    // ...
});
```

### 3. Le problème : `buildLabeledPairs` ne connaît pas l'ordre exact

**Fichier :** `mobile/src/components/LinearAutocompleteEditor.tsx`  
**Lignes :** 324-356

```typescript
const buildLabeledPairs = (
    values: string[] = [],
    labels: string[] = [],
    fallbackLabels: string[] = [],
    options: BuildPairsOptions = {},
): Array<{ label: string; value: string }> => {
    // ...
    // ❌ PROBLÈME : Essaie de mapper les valeurs aux labels
    // mais ne connaît pas l'ordre exact des dimensions dans la combinaison IA
}
```

**Le problème :**
- `parts` = `["Réparation fuite", "Installation robinet", "Entretien canalisation", "À domicile", ...]`
- `labelOrder` = Ordre déterminé par `determineLabelOrder` (peut être différent de l'ordre IA)
- `buildLabeledPairs` essaie de mapper les valeurs aux labels, mais l'ordre peut ne pas correspondre

### 4. Le problème supplémentaire : Utilisation de `sous_caracteristiques`

**Fichier :** `mobile/src/components/LinearAutocompleteEditor.tsx`  
**Lignes :** 1501-1524

```typescript
// ✅ NOUVEAU: Créer un candidat directement à partir des sous_caracteristiques préférées de l'IA
if (sousCaracteristiques && typeof sousCaracteristiques === 'object') {
    sousCaracsKeys.forEach((key) => {
        const values = sousCaracteristiques[key];
        if (Array.isArray(values) && values.length > 0) {
            // ❌ PROBLÈME : Prend seulement la première valeur
            rows.push({
                label: key,
                value: values[0],  // ❌ Ne prend que la première valeur !
            });
        }
    });
}
```

**Le problème :**
- Cette logique prend seulement `values[0]` (la première valeur) de chaque dimension
- Mais la combinaison IA peut avoir **plusieurs valeurs** pour une dimension (comme `type`)
- Exemple : `type: ["Réparation fuite", "Installation robinet", "Entretien canalisation"]`
  - Cette logique ne prend que `"Réparation fuite"` ❌
  - Elle ignore `"Installation robinet"` et `"Entretien canalisation"` ❌

## 🎯 Pourquoi ça ne fonctionne pas

### 1. Perte de l'ordre des dimensions

La combinaison IA a un ordre spécifique :
```
1. type (3 valeurs)
2. mode (1 valeur)
3. materiel (1 valeur)
4. garantie (1 valeur)
5. zone (1 valeur)
```

Mais `buildLabeledPairs` utilise `labelOrder` qui peut être différent :
```
1. mode
2. materiel
3. type
4. garantie
5. zone
```

### 2. Perte des valeurs multiples

La combinaison IA a **3 valeurs pour `type`** :
- "Réparation fuite"
- "Installation robinet"
- "Entretien canalisation"

Mais la logique de `sous_caracteristiques` ne prend que la première :
- "Réparation fuite" seulement ❌

### 3. Mapping incorrect

`buildLabeledPairs` essaie de mapper les valeurs aux labels, mais :
- Il ne sait pas que les 3 premières valeurs sont toutes de type `type`
- Il peut mapper "Installation robinet" à `mode` au lieu de `type` ❌

## ✅ Solution : Utiliser directement la combinaison IA

### Solution 1 : Parser la combinaison avec l'ordre des dimensions

Il faut connaître l'ordre exact des dimensions dans la combinaison IA. Deux approches :

#### Approche A : Utiliser `ai_preferred_index` et reconstruire depuis la base

```typescript
// Récupérer la combinaison préférée depuis la base avec product_labels
const preferred = await apiGet(`/api/combinations/session/${session_id}`);
const combination = preferred.combinations.find(c => c.is_ai_preferred);

// Utiliser product_vector et product_labels qui ont l'ordre correct
const rows = combination.product_vector.map((value, index) => ({
    label: combination.product_labels[index],  // ✅ Ordre correct
    value: value
}));
```

#### Approche B : Parser avec `sous_caracteristiques` en respectant l'ordre

```typescript
// Parser la combinaison en utilisant l'ordre des clés de sous_caracteristiques
const sousCaracsKeys = Object.keys(sousCaracteristiques);
const parts = smartSplit(combinationString, separateur);

// Mapper chaque partie à sa dimension en respectant l'ordre
const rows: Array<{ label: string; value: string }> = [];
let partIndex = 0;

sousCaracsKeys.forEach((dimension) => {
    const possibleValues = sousCaracteristiques[dimension];
    
    // Vérifier si la partie actuelle correspond à cette dimension
    while (partIndex < parts.length) {
        const part = parts[partIndex];
        if (possibleValues.includes(part)) {
            rows.push({
                label: dimension,
                value: part
            });
            partIndex++;
        } else {
            break; // Passer à la dimension suivante
        }
    }
});
```

### Solution 2 : Stocker l'ordre des dimensions dans la combinaison

Modifier le format de la combinaison IA pour inclure l'ordre :

```json
{
  "produits": {
    "valeur": [
      "Réparation fuite,Installation robinet,Entretien canalisation,À domicile,Matériel inclus,Garantie 1 mois,Yaoundé"
    ],
    "dimension_order": ["type", "type", "type", "mode", "materiel", "garantie", "zone"],
    "sous_caracteristiques": {
      "type": ["Réparation fuite", "Installation robinet", "Entretien canalisation"],
      // ...
    }
  }
}
```

Puis utiliser cet ordre pour parser :

```typescript
const dimensionOrder = produitsField.dimension_order || [];
const parts = smartSplit(combinationString, separateur);

const rows = parts.map((value, index) => ({
    label: dimensionOrder[index] || 'Caractéristique',
    value: value
}));
```

## 📝 Résumé du problème

### Problèmes identifiés

1. ❌ **Perte de l'ordre des dimensions** : `buildLabeledPairs` utilise `labelOrder` qui peut être différent de l'ordre IA
2. ❌ **Perte des valeurs multiples** : La logique `sous_caracteristiques` ne prend que `values[0]`
3. ❌ **Mapping incorrect** : Les valeurs peuvent être mappées aux mauvaises dimensions

### Solutions proposées

1. ✅ **Utiliser `product_labels` depuis la base** : La combinaison sauvegardée a l'ordre correct
2. ✅ **Parser avec l'ordre des dimensions** : Utiliser l'ordre des clés de `sous_caracteristiques`
3. ✅ **Stocker `dimension_order`** : Ajouter un champ pour l'ordre exact des dimensions

## 🔧 Correction recommandée

La meilleure solution est d'utiliser les données depuis la base de données qui contiennent `product_vector` et `product_labels` avec l'ordre correct, plutôt que de parser la string manuellement.

