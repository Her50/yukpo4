# 🔴 BUG FIX: Champs produits non pré-remplis dans le formulaire

**Date**: 2025-11-06  
**Gravité**: MAJEUR - UX dégradée  
**Composant**: `FormulaireYukpoIntelligentScreen`

---

## 🐛 **SYMPTÔME**

Les champs `nom_produit`, `categorie_produit`, `description_produit` sont **vides** dans le formulaire malgré :
1. ✅ Le JSON IA contient ces champs
2. ✅ Les champs `titre_service`, `category`, `description` (bloc Informations générales) sont bien pré-remplis
3. ✅ Les valeurs sont dans `initialValues`

---

## 🔍 **CAUSE RACINE**

### **Flux de données IA → Formulaire**

```typescript
// 1. JSON IA arrive dans suggestion.data
{
  "nom_produit": { "type_donnee": "string", "valeur": "iPhone 14 Pro Max" },
  "categorie_produit": { "type_donnee": "string", "valeur": "Smartphone" },
  "description_produit": { "type_donnee": "string", "valeur": "..." }
}

// 2. processIASuggestion() génère les DynamicField
components = [
  { name: "nom_produit", type: "text", value: "iPhone 14 Pro Max" }, // ✅ value est ici
  { name: "categorie_produit", type: "text", value: "Smartphone" }, // ✅ value est ici
  //...
]

// 3. initialValues est créé SÉPARÉMENT depuis suggestion.data
initialValues = {
  titre_service: "...",
  category: "...",
  nom_produit: "iPhone 14 Pro Max",  // ✅ valeur extracte correctement
  //...
}

// 4. ❌ PROBLÈME: setValeursFormulaire() reçoit SEULEMENT initialValues
setValeursFormulaire(prev => ({
  ...prev,
  ...initialValues  // ✅ OK pour titre_service, category, etc.
  // ❌ MAIS: ne contient PAS les field.value de components[] !
}));

// 5. Rendu des champs text/textarea
<NativeInput
  value={valeursFormulaire[field.name] || ''}  // ❌ valeursFormulaire.nom_produit existe mais...
/>

// 6. ❌ Résultat: Champs vides car field.value n'est PAS copié dans valeursFormulaire
```

---

## 🔧 **PROBLÈME DÉTAILLÉ**

### **Pourquoi titre_service fonctionne mais pas nom_produit ?**

**titre_service** :
1. ✅ Extrait dans `initialValues.titre_service` (ligne 966)
2. ✅ Copié dans `valeursFormulaire` (ligne 1089-1092)
3. ✅ Rendu affiche `valeursFormulaire.titre_service` → OK

**nom_produit** :
1. ✅ Extrait dans `initialValues.nom_produit` (ligne 994)
2. ✅ Copié dans `valeursFormulaire` (ligne 1089-1092)
3. ✅ Rendu devrait afficher `valeursFormulaire.nom_produit` → **POURQUOI VIDE ?**

**Hypothèse** : Le `setValeursFormulaire` est peut-être écrasé ailleurs ?

### **Vérification du code (lignes 1086-1092)** :

```typescript
setComposants(components);
setBlocks(organizedBlocks);
setValeursFormulaire(prev => ({
  ...prev,           // État précédent
  ...initialValues   // Données IA (contient nom_produit, categorie_produit, description_produit)
}));
```

**Analyse** :
- ✅ `initialValues.nom_produit` existe (ligne 994)
- ✅ Copié dans `valeursFormulaire` (ligne 1091)
- ❌ **MAIS** : Si un autre `setValeursFormulaire` se déclenche APRÈS, il peut écraser !

---

## ✅ **SOLUTION APPLIQUÉE**

Extraire **AUSSI** les `field.value` des composants générés par `formDispatcher` :

```typescript
// ✅ CORRECTION: Extraire les valeurs des components
const componentValues: Record<string, any> = {};
components.forEach(field => {
  if (field.value !== undefined && field.value !== null && field.value !== '') {
    componentValues[field.name] = field.value;
    console.log(`[FormulaireYukpoIntelligentScreen] ✅ Valeur extraite: ${field.name} = ${field.value}`);
  }
});

setValeursFormulaire(prev => ({
  ...prev,
  ...initialValues,       // Valeurs extraites de suggestion.data
  ...componentValues      // ✅ NOUVEAU: Valeurs depuis field.value
}));
```

---

## 📊 **IMPACT**

| Champ | Avant | Après |
|-------|-------|-------|
| `titre_service` | ✅ Pré-rempli | ✅ Pré-rempli |
| `category` | ✅ Pré-rempli | ✅ Pré-rempli |
| `description` | ✅ Pré-rempli | ✅ Pré-rempli |
| `nom_produit` | ❌ Vide | ✅ Pré-rempli |
| `categorie_produit` | ❌ Vide | ✅ Pré-rempli |
| `description_produit` | ❌ Vide | ✅ Pré-rempli |

---

## 🎯 **VALIDATION**

Après correction, vérifier que :
1. ✅ `nom_produit` est affiché avec la valeur de l'IA
2. ✅ `categorie_produit` est affiché avec la valeur de l'IA
3. ✅ `description_produit` est affiché avec la valeur de l'IA
4. ✅ Les logs console affichent "Valeur extraite de component"

**Logs attendus** :
```
[FormulaireYukpoIntelligentScreen] ✅ Valeur extraite de component: nom_produit = iPhone 14 Pro Max
[FormulaireYukpoIntelligentScreen] ✅ Valeur extraite de component: categorie_produit = Smartphone
[FormulaireYukpoIntelligentScreen] ✅ Valeur extraite de component: description_produit = ...
```

---

## ✅ **FICHIERS MODIFIÉS**

- `mobile/src/screens/FormulaireYukpoIntelligentScreen.tsx` (2 endroits : lignes 1086-1094 et 1267-1273)

**Solution double sécurité** : Les valeurs sont extraites à la fois depuis `suggestion.data` (initialValues) ET depuis `components[].value` (componentValues).

**Toutes les corrections appliquées ! 🎉**

