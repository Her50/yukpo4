# ✅ IMPLÉMENTATION : type_offre dynamique

## Date: 2025-11-01

---

## 🎯 OBJECTIF

Afficher dynamiquement **"Nom du produit"** ou **"Nom de la prestation"** selon ce que l'IA détecte.

---

## ✅ 1. Prompt IA modifié

**Fichier** : `backend/ia_prompts/creation_service_prompt.md`

### A. Champ obligatoire ajouté (ligne 14)

```markdown
## ⚠️ CHAMPS OBLIGATOIRES (TOUJOURS INCLUS) :
**Ces 5 champs généraux du service sont OBLIGATOIRES :**
- titre_service (obligatoire)
- category (obligatoire)
- description (obligatoire)
- is_tarissable (OBLIGATOIRE)
- **type_offre (OBLIGATOIRE)** ⬅️ NOUVEAU
```

### B. Section de détermination (lignes 18-40)

```markdown
### 🎯 Déterminer type_offre (CRITIQUE)

**type_offre: "produit"** quand :
- Vente de biens matériels (téléphones, voitures, vêtements, meubles, etc.)
- Commerce de marchandises physiques
- Produits tangibles qu'on peut toucher

**type_offre: "prestation"** quand :
- Services professionnels (cours, réparations, consultations, etc.)
- Prestations intellectuelles (formations, conseils, coaching, etc.)
- Services à la personne (coiffure, massage, nettoyage, etc.)
- Services techniques (dépannage, installation, maintenance, etc.)

**Structure obligatoire** :
{
  "type_offre": {
    "type_donnee": "string",
    "valeur": "prestation",
    "origine_champs": "ia"
  }
}
```

### C. Exemple dans le format de réponse (ligne 209-213)

```json
{
  "type_offre": {
    "type_donnee": "string",
    "valeur": "prestation",
    "origine_champs": "ia"
  }
}
```

### D. Checklist finale (lignes 1022-1054)

```markdown
## ⚠️ CHECKLIST FINALE AVANT GÉNÉRATION (NE JAMAIS OUBLIER)

✅ **1. Les 5 champs OBLIGATOIRES :**
- [ ] titre_service (string)
- [ ] category (string)
- [ ] description (string)
- [ ] is_tarissable (boolean)
- [ ] type_offre ("produit" ou "prestation") ⚠️ CRITIQUE

**⚠️ RAPPEL CRITIQUE : Ne JAMAIS oublier `type_offre` car il détermine 
si le frontend affiche "Nom du produit" ou "Nom de la prestation" !**
```

---

## ✅ 2. Frontend modifié

**Fichier** : `mobile/src/screens/FormulaireYukpoIntelligentScreen.tsx`

### A. Cas 1 : Bloc produits n'existe pas (ligne 238-250)

```typescript
// Si le bloc n'existe pas du tout, le créer
const typeOffre = valeursFormulaire.type_offre || valeursFormulaire.nature_offre || 'produit';
const isPrestation = typeOffre === 'prestation' || typeOffre === 'service';

const defaultProductsFields: DynamicField[] = [
  {
    name: 'nom_produit',
    label: isPrestation ? 'Nom de la prestation' : 'Nom du produit',
    placeholder: isPrestation 
      ? 'Ex: Cours de maths niveau terminal, Réparation écran téléphone...' 
      : 'Ex: iPhone 14 Pro Max 256GB, Toyota RAV4 2018 4x4...',
  }
];
```

### B. Cas 2 : Bloc existe mais vide (ligne 297-313)

```typescript
else if (productsBlock.fields.length === 0) {
  const typeOffre = valeursFormulaire.type_offre || valeursFormulaire.nature_offre || 'produit';
  const isPrestation = typeOffre === 'prestation' || typeOffre === 'service';
  
  const defaultProductsFields: DynamicField[] = [
    {
      name: 'nom_produit',
      label: isPrestation ? 'Nom de la prestation' : 'Nom du produit',
      placeholder: isPrestation 
        ? 'Ex: Cours de maths niveau terminal, Réparation écran...' 
        : 'Ex: iPhone 14 Pro Max 256GB, Toyota RAV4 2018...',
    }
  ];
}
```

### C. Cas 3 : Bloc existe avec champs (ligne 361-376)

```typescript
else {
  if (!hasNomProduit) {
    const typeOffre = valeursFormulaire.type_offre || valeursFormulaire.nature_offre || 'produit';
    const isPrestation = typeOffre === 'prestation' || typeOffre === 'service';
    
    productsBlock.fields.unshift({
      name: 'nom_produit',
      label: isPrestation ? 'Nom de la prestation' : 'Nom du produit',
      placeholder: isPrestation 
        ? 'Ex: Cours de mathématiques, Réparation téléphone...' 
        : 'Ex: iPhone 14 Pro Max, Toyota RAV4 2018...',
    });
  }
}
```

---

## 🎬 Exemples de fonctionnement

### Exemple 1 : Vente de téléphone (PRODUIT)

**L'IA génère** :
```json
{
  "type_offre": {
    "type_donnee": "string",
    "valeur": "produit",
    "origine_champs": "ia"
  },
  "nom_produit": {
    "type_donnee": "string",
    "valeur": "iPhone 14 Pro Max 256GB",
    "origine_champs": "ia"
  }
}
```

**L'utilisateur voit** :
```
🛍️ Produits

📋 Nom du produit
┌─────────────────────────────────────────────────┐
│ iPhone 14 Pro Max 256GB                         │
└─────────────────────────────────────────────────┘
```

### Exemple 2 : Cours de mathématiques (PRESTATION)

**L'IA génère** :
```json
{
  "type_offre": {
    "type_donnee": "string",
    "valeur": "prestation",
    "origine_champs": "ia"
  },
  "nom_produit": {
    "type_donnee": "string",
    "valeur": "Cours de mathématiques niveau terminal",
    "origine_champs": "ia"
  }
}
```

**L'utilisateur voit** :
```
🛍️ Produits

📋 Nom de la prestation
┌─────────────────────────────────────────────────┐
│ Cours de mathématiques niveau terminal         │
└─────────────────────────────────────────────────┘
```

### Exemple 3 : Réparation téléphone (PRESTATION)

**L'IA génère** :
```json
{
  "type_offre": {
    "type_donnee": "string",
    "valeur": "prestation",
    "origine_champs": "ia"
  },
  "nom_produit": {
    "type_donnee": "string",
    "valeur": "Réparation écran téléphone",
    "origine_champs": "ia"
  }
}
```

**L'utilisateur voit** :
```
🛍️ Produits

📋 Nom de la prestation
┌─────────────────────────────────────────────────┐
│ Réparation écran téléphone                      │
└─────────────────────────────────────────────────┘
```

---

## 📊 Logique de détection

```typescript
const typeOffre = valeursFormulaire.type_offre || valeursFormulaire.nature_offre || 'produit';
const isPrestation = typeOffre === 'prestation' || typeOffre === 'service';

// Si type_offre = "prestation" ou "service" → Label = "Nom de la prestation"
// Sinon → Label = "Nom du produit"
```

**Fallback** : Si l'IA oublie d'envoyer `type_offre`, le système utilise "produit" par défaut.

---

## ✅ Points clés

1. ✅ **L'IA DOIT envoyer** `type_offre` avec valeur "produit" ou "prestation"
2. ✅ **Le formulaire adapte** automatiquement le label
3. ✅ **Le placeholder** change aussi selon le type
4. ✅ **Checklist dans le prompt** rappelle de ne pas oublier
5. ✅ **Fallback sécurisé** si type_offre manque

---

*Implémentation terminée - 2025-11-01*

