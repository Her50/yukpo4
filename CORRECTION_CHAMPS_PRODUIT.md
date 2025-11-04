# ?? CORRECTION : Champs Produit Non Chargés

## ? PROBLÈME

Les champs **nom_produit**, **categorie_produit**, et **description_produit** ne se chargent PAS automatiquement depuis le JSON de l'IA, alors que les champs généraux (**titre_service**, **category**, **description**) fonctionnent correctement.

### Preuve dans les images :
- Image 1 : Champs produit VIDES
- Image 2 : Champs produit avec placeholder uniquement, pas de valeur

### Log de l'IA :
L'IA génère bien les champs :
```json
{
  "intention": "creation_service",
  "data": {
    "titre_service": {"valeur": "Cours de répétition en mathématiques..."},
    "category": {"valeur": "Éducation"},
    "description": {"valeur": "Offre de cours..."}
  }
}
```

**MAIS** : Aucun champ produit généré car l'utilisateur dit "Je fais des cours de répétition" = **PRESTATION**, pas produit.

## ? CAUSE RACINE

### 1. L'IA ne génère PAS de champs produit pour une PRESTATION
Le prompt actuel (creation_service_prompt.md) génère :
- **Si PRODUIT détecté** ? nom_produit, categorie_produit, description_produit
- **Si PRESTATION détectée** ? AUCUN champ produit (juste titre, category, description)

### 2. Le formulaire crée les champs vides par défaut
Dans **FormulaireYukpoIntelligentScreen.tsx** lignes 244-273 :
```typescript
const defaultProductsFields: DynamicField[] = [
  {
    name: 'nom_produit',
    value: formValues.nom_produit || ''  // ? formValues.nom_produit est toujours vide !
  },
  {
    name: 'categorie_produit',
    value: formValues.categorie_produit || ''  // ? VIDE
  },
  {
    name: 'description_produit',
    value: formValues.description_produit || ''  // ? VIDE
  }
];
```

### 3. Les champs généraux fonctionnent car ils sont extraits
Quelque part dans le code (probablement dans loadServiceData ou après l'appel IA) :
```typescript
initialValues.titre_service = suggestion.data.titre_service?.valeur || '';
initialValues.category = suggestion.data.category?.valeur || '';
initialValues.description = suggestion.data.description?.valeur || '';
```

**MAIS** : Aucune ligne équivalente pour :
```typescript
initialValues.nom_produit = suggestion.data.nom_produit?.valeur || '';
initialValues.categorie_produit = suggestion.data.categorie_produit?.valeur || '';
initialValues.description_produit = suggestion.data.description_produit?.valeur || '';
```

---

## ?? SOLUTIONS

### Solution A : Forcer l'IA à générer les champs produit (RECOMMANDÉ)

**Fichier** : ackend/ia_prompts/creation_service_prompt.md

**Modifier** : Ajouter une règle stricte :
```markdown
## RÈGLE CRITIQUE : CHAMPS PRODUIT TOUJOURS GÉNÉRÉS

Même pour une PRESTATION, tu DOIS générer ces 3 champs :
- nom_produit (= nom de la prestation)
- categorie_produit (= catégorie de la prestation)
- description_produit (= description détaillée)

**EXEMPLE PRESTATION** :
{
  "nom_produit": {"valeur": "Cours de répétition en mathématiques niveau terminal C"},
  "categorie_produit": {"valeur": "Éducation - Cours particuliers"},
  "description_produit": {"valeur": "Cours de répétition adaptés au programme..."}
}
```

### Solution B : Extraire les champs généraux vers les champs produit

**Fichier** : mobile/src/screens/FormulaireYukpoIntelligentScreen.tsx

**Ajouter** après le chargement des données (dans loadServiceData ou après l'appel IA) :
```typescript
// ? Si champs produit manquants, utiliser les champs généraux
if (suggestion.data) {
  // Extraire nom_produit (ou utiliser titre_service si absent)
  if (suggestion.data.nom_produit) {
    initialValues.nom_produit = typeof suggestion.data.nom_produit === 'object' 
      ? suggestion.data.nom_produit.valeur 
      : suggestion.data.nom_produit;
  } else if (suggestion.data.titre_service) {
    // Fallback : utiliser titre_service comme nom_produit
    initialValues.nom_produit = typeof suggestion.data.titre_service === 'object' 
      ? suggestion.data.titre_service.valeur 
      : suggestion.data.titre_service;
  }
  
  // Extraire categorie_produit (ou utiliser category si absent)
  if (suggestion.data.categorie_produit) {
    initialValues.categorie_produit = typeof suggestion.data.categorie_produit === 'object' 
      ? suggestion.data.categorie_produit.valeur 
      : suggestion.data.categorie_produit;
  } else if (suggestion.data.category) {
    // Fallback : utiliser category comme categorie_produit
    initialValues.categorie_produit = typeof suggestion.data.category === 'object' 
      ? suggestion.data.category.valeur 
      : suggestion.data.category;
  }
  
  // Extraire description_produit (ou utiliser description si absent)
  if (suggestion.data.description_produit) {
    initialValues.description_produit = typeof suggestion.data.description_produit === 'object' 
      ? suggestion.data.description_produit.valeur 
      : suggestion.data.description_produit;
  } else if (suggestion.data.description) {
    // Fallback : utiliser description comme description_produit
    initialValues.description_produit = typeof suggestion.data.description === 'object' 
      ? suggestion.data.description.valeur 
      : suggestion.data.description;
  }
  
  console.log('[PRODUIT] Champs chargés:', {
    nom: initialValues.nom_produit,
    categorie: initialValues.categorie_produit,
    description: initialValues.description_produit
  });
}
```

### Solution C : Combiner A + B (MEILLEURE)

1. Modifier le prompt pour **toujours** générer les champs produit
2. Ajouter un **fallback** côté frontend au cas où l'IA oublie

---

## ?? OÙ AJOUTER LE CODE

Cherchez cette section dans **FormulaireYukpoIntelligentScreen.tsx** :
```typescript
// CORRECTION: S'assurer que le champ category est bien chargé
if (suggestion.data.category) {
  const categoryValue = typeof suggestion.data.category === 'object' && 'valeur' in suggestion.data.category
    ? suggestion.data.category.valeur
    : suggestion.data.category;
  initialValues.category = categoryValue;
  console.log('[FormulaireYukpoIntelligentScreen] Catégorie chargée:', categoryValue);
}
```

**JUSTE APRÈS**, ajoutez le code de la Solution B.

---

## ?? IMPLÉMENTATION IMMÉDIATE

Voulez-vous que j'implémente la **Solution C** (A + B) ?
