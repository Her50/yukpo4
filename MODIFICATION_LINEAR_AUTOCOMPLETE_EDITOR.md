# 🔧 Modification de LinearAutocompleteEditor

## 📋 Problème

L'utilisateur souhaite que `LinearAutocompleteEditor` affiche **d'abord le tableau des sous-caractéristiques** (comme lors d'une recherche) au lieu d'afficher directement les sous-caractéristiques déjà validées (chips).

## ✅ Solution Appliquée

### Modification 1 : Affichage du tableau en priorité

**Fichier** : `mobile/src/components/LinearAutocompleteEditor.tsx`

**Ligne 2254** : Le tableau s'affiche toujours si des sous-caractéristiques sont disponibles, même si des chips validés existent déjà.

**Ligne 2427** : Les chips ne s'affichent que si le tableau n'est pas disponible ou s'il a été validé.

```typescript
// ✅ AVANT : Les chips s'affichaient toujours s'ils existaient
{chips.length > 0 ? (
    <View style={[styles.vectorContainer, styles.vectorContainerActive]}>
        // ... chips ...
    </View>
) : null}

// ✅ APRÈS : Les chips ne s'affichent que si le tableau n'est pas affiché
{chips.length > 0 && !(preferredDraftCandidate && preferredDraftCandidate.rows.length > 0) && !displayCandidate ? (
    <View style={[styles.vectorContainer, styles.vectorContainerActive]}>
        // ... chips ...
    </View>
) : null}
```

## 🎯 Comportement Attendu

### Avant la Modification

1. ❌ Si `value` contient des valeurs → Les chips s'affichent directement
2. ❌ Le tableau ne s'affiche que si l'utilisateur fait une recherche
3. ❌ L'utilisateur ne voit pas les sous-caractéristiques suggérées par l'IA

### Après la Modification

1. ✅ Le tableau s'affiche **en premier** si des sous-caractéristiques sont disponibles
2. ✅ Les chips ne s'affichent que si le tableau n'est pas disponible ou s'il a été validé
3. ✅ L'utilisateur peut voir et valider/modifier les sous-caractéristiques suggérées par l'IA

## 📊 Flux d'Affichage

### Scénario 1 : Sous-caractéristiques disponibles (nouveau produit)

1. ✅ Le tableau s'affiche avec les sous-caractéristiques suggérées par l'IA
2. ✅ L'utilisateur peut modifier les valeurs dans le tableau
3. ✅ L'utilisateur clique sur "Valider" → Les chips s'affichent
4. ✅ Le tableau disparaît après validation

### Scénario 2 : Produit existant avec valeurs validées

1. ✅ Le tableau s'affiche **en premier** avec les sous-caractéristiques suggérées
2. ✅ Les chips validés sont **cachés** tant que le tableau est affiché
3. ✅ L'utilisateur peut valider le tableau → Les chips s'affichent
4. ✅ Ou l'utilisateur peut modifier les valeurs dans le tableau

### Scénario 3 : Aucune sous-caractéristique disponible

1. ✅ Le tableau ne s'affiche pas
2. ✅ Les chips s'affichent normalement (si `value` contient des valeurs)

## 🔍 Détails Techniques

### Condition d'Affichage du Tableau

```typescript
{(loadingSuggestions || loadingCombinationSuggestions || displayCandidate || combinationError || (preferredDraftCandidate && preferredDraftCandidate.rows.length > 0)) && (
    // Tableau affiché
)}
```

**Priorité** :
1. `preferredDraftCandidate` (sous-caractéristiques préférées de l'IA)
2. `displayCandidate` (meilleure suggestion)
3. `loadingSuggestions` ou `loadingCombinationSuggestions` (chargement)

### Condition d'Affichage des Chips

```typescript
{chips.length > 0 && !(preferredDraftCandidate && preferredDraftCandidate.rows.length > 0) && !displayCandidate ? (
    // Chips affichés
) : null}
```

**Logique** :
- Les chips s'affichent **seulement si** :
  - `chips.length > 0` (des chips existent)
  - **ET** `!(preferredDraftCandidate && preferredDraftCandidate.rows.length > 0)` (pas de tableau préféré)
  - **ET** `!displayCandidate` (pas de tableau à afficher)

## ✅ Résultat

Le tableau des sous-caractéristiques s'affiche maintenant **en premier** à l'ouverture des formulaires de création de produit, permettant à l'utilisateur de valider/modifier les suggestions de l'IA avant de voir les chips validés.

---

*Modification effectuée le ${new Date().toISOString()}*

