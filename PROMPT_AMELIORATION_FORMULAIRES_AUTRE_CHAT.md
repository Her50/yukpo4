# 🤖 PROMPT OPTIMISÉ - Amélioration Formulaires Produits (Nouveau Chat)

## 📋 Contexte du Projet

Je travaille sur **Yukpomnang**, une plateforme marketplace multiservices (Cameroun) avec :
- **Backend** : Rust (Axum, SQLx, PostgreSQL, pgvector)
- **Frontend** : React Native (TypeScript, Expo)
- **Base de données** : PostgreSQL avec extensions

## 🎯 Objectif de ce Chat

Améliorer les formulaires de catégories de produits dans `mobile/src/components/ProductManagerMobile.tsx` en suivant les standards établis.

---

## 📚 Documents de Référence OBLIGATOIRES

Lis attentivement ces fichiers avant de commencer :

1. **`GUIDE_MASTER_AMELIORATION_FORMULAIRES_PRODUITS.md`**
   - Méthodologie complète
   - Checklist détaillée
   - Exemples concrets
   - Bonnes pratiques

2. **Récapitulatifs des catégories déjà améliorées** :
   - `mobile/RECAPITULATIF_COMPLET_FUSION_CATEGORIES_ALIMENTATION.md`
   - `mobile/RECAPITULATIF_FINAL_CHAUSSURES.md`
   - `mobile/RECAPITULATIF_AMELIORATIONS_ASSURANCE.md`
   - `mobile/AMELIORATIONS_CATEGORIE_AUTOMOBILE.md`
   - `mobile/RECAPITULATIF_AMELIORATIONS_COVOITURAGE.md`
   - `mobile/RECAPITULATIF_AMELIORATIONS_DECORATION.md`

3. **Fichiers clés du système** :
   - `mobile/src/data/productModalities.ts` (modalités)
   - `mobile/src/components/ProductManagerMobile.tsx` (formulaires)
   - `mobile/src/config/categoryConfig.ts` (configuration)

---

## ✅ Checklist OBLIGATOIRE (À Suivre Strictement)

Pour chaque catégorie de produit :

### 1. Nom du Produit (PRIORITÉ 1)
- [ ] **OBLIGATOIRE** : Transformer en `SelectModalitySelector`
- [ ] Pré-remplir avec 50-70+ noms pertinents
- [ ] Permettre ajout progressif (🆕 Autre)
- [ ] Synchroniser avec `newProduct.name`

### 2. Tous les Champs Liste (PRIORITÉ 1)
- [ ] **AUCUN champ liste ne doit être vide**
- [ ] Définir 10-30 modalités par défaut
- [ ] Utiliser `SelectModalitySelector` ou `MultiSelectModalitySelector`
- [ ] Recherche intelligente intégrée

### 3. Dates et Heures (PRIORITÉ 2)
- [ ] Transformer en `NativeDatePicker` (dates)
- [ ] Transformer en `NativeTimePicker` (heures)

### 4. Layout et Forme (PRIORITÉ 2)
- [ ] Organiser en sections avec icônes
- [ ] 2 champs par ligne (`fieldRow`)
- [ ] Réduire espaces verticaux
- [ ] Mini commentaires sur toggles

### 5. Variantes (PRIORITÉ 3)
- [ ] Déterminer si nécessaires
- [ ] Créer composant si besoin
- [ ] Configurer `supportsVariants: true`

### 6. Configuration (PRIORITÉ 1)
- [ ] Mettre à jour `categoryConfig.ts`
- [ ] Définir 5-10 filtres pertinents
- [ ] Style visuel adapté

### 7. Vérifications (PRIORITÉ 1)
- [ ] Pas de doublons (vérifier avec `Select-String`)
- [ ] `read_lints` sans erreurs
- [ ] ProductCard compatible
- [ ] Filtrage coherent

### 8. Documentation (PRIORITÉ 3)
- [ ] Créer récapitulatif Markdown

---

## 🧩 Composants Disponibles

Utilise ces composants réutilisables :

1. **`SelectModalitySelector`** : Liste choix unique
2. **`MultiSelectModalitySelector`** : Liste choix multiples
3. **`NativeDatePicker`** : Sélecteur de date
4. **`NativeTimePicker`** : Sélecteur d'heure
5. **`ProductVariantManager`** : Variantes alimentation
6. **`ChaussureVariantManager`** : Variantes chaussures
7. **`AssuranceProduitSelector`** : Produit filtré par type
8. **`VehicleModelSelector`** : Modèle filtré par marque
9. **`OptionsPrimesManager`** : Options assurance

---

## 📝 Instructions Spécifiques

### Catégories à Améliorer (40 restantes)

**NE PAS toucher** (déjà complétées) :
- ✅ agroalimentaire (alimentation)
- ✅ chaussure
- ✅ assurance
- ✅ automobile
- ✅ covoiturage
- ✅ decoration
- ✅ hopital_clinique

**À améliorer** (exemples prioritaires) :
- 🔧 **Électroménager** : Marque, modèle, type, état, garantie...
- 📱 **Téléphones** : Marque, modèle (intelligent), stockage, RAM...
- 💻 **Ordinateurs** : Type, marque, processeur, RAM, stockage...
- 🪑 **Mobilier** : Catégorie, matière, style, dimensions...
- 🏨 **Hôtellerie** : Type, services, équipements, planning...
- 🚌 **Ticket voyage** : Compagnie, départ, destination, classe...
- 👕 **Vêtements** : Type, taille, couleur, matière (variantes ?)...
- 📚 **Livres/Fournitures** : Type, catégorie, état...
- 💊 **Pharmacie** : Planning + garde + services
- 🧪 **Laboratoire** : Analyses proposées + planning
- Et 30+ autres...

---

## 🎯 Workflow Recommandé

### Étape 1 : Préparation
```
1. Lis le GUIDE_MASTER complet
2. Lis 2-3 récapitulatifs de catégories déjà faites
3. Identifie la catégorie à traiter
4. Cherche le case existant ou constate son absence
```

### Étape 2 : Création Modalités
```
1. Ouvre mobile/src/data/productModalities.ts
2. Cherche case 'nom_categorie'
3. Crée 8-10 listes avec 10-30 options chacune
4. Inclus '🆕 Autre (ajouter)' partout
5. Logique métier cohérente
```

### Étape 3 : Formulaire
```
1. Ouvre mobile/src/components/ProductManagerMobile.tsx
2. Trouve/Crée case 'nom_categorie' dans renderSpecificFields
3. Organise en 3-6 sections
4. Utilise composants réutilisables
5. 2 champs par ligne
6. Messages d'aide
```

### Étape 4 : Configuration
```
1. Ouvre mobile/src/config/categoryConfig.ts
2. Vérifie doublon : Select-String -Pattern "nom_categorie:"
3. Crée/Met à jour configuration complète
4. 5-10 filtres pertinents
5. Style visuel
```

### Étape 5 : Vérifications
```
1. read_lints sur tous les fichiers modifiés
2. Corriger erreurs
3. Vérifier ProductCard
4. Vérifier ResultatBesoinScreen si besoin
```

### Étape 6 : Documentation
```
1. Créer RECAPITULATIF_AMELIORATIONS_[CATEGORIE].md
2. Avant/Après
3. Modalités créées
4. Exemples concrets
```

---

## 🚨 Points d'Attention CRITIQUES

### ⚠️ TOUJOURS Vérifier les Doublons

```bash
# Avant d'ajouter une configuration
Select-String -Path "categoryConfig.ts" -Pattern "nom_categorie:" -CaseSensitive

# Si doublon détecté → Supprimer l'ancien
```

### ⚠️ TOUJOURS Synchroniser le Nom

```typescript
// Pour le champ "Nom du produit"
onSelect={(value) => setNewProduct({
    ...newProduct,
    nomSpecifique: value,
    name: value // ✅ CRITIQUE
})}
```

### ⚠️ TOUJOURS Définir Modalités Par Défaut

```typescript
// ❌ JAMAIS FAIRE
types: []

// ✅ TOUJOURS FAIRE
types: ['Type 1', 'Type 2', 'Type 3', '🆕 Autre (ajouter)']
```

### ⚠️ TOUJOURS Utiliser les Composants Appropriés

```typescript
// Pour dates
<NativeDatePicker ... />

// Pour heures
<NativeTimePicker ... />

// Pour listes choix unique
<SelectModalitySelector ... />

// Pour listes choix multiples
<MultiSelectModalitySelector ... />
```

---

## 📦 Fichiers à Modifier (Standard)

Pour chaque catégorie :

1. **`mobile/src/data/productModalities.ts`** (TOUJOURS)
2. **`mobile/src/components/ProductManagerMobile.tsx`** (TOUJOURS)
3. **`mobile/src/config/categoryConfig.ts`** (TOUJOURS)
4. **`mobile/src/components/ProductCard.tsx`** (RAREMENT - système générique)
5. **`mobile/src/screens/ResultatBesoinScreen.tsx`** (RAREMENT - cas spéciaux)

---

## 🎨 Styles Visuels par Type

### Couleurs Recommandées

| Type | Couleur | Icône | Exemple |
|------|---------|-------|---------|
| Immobilier | Bleu #3B82F6 | 🏠 | Bâtiments |
| Automobile | Orange #F59E0B | 🚗 | Véhicules |
| Alimentation | Vert #10B981 | 🍽️ | Produits |
| Santé | Rouge #DC2626 | 🏥 | Hôpitaux |
| Mode | Rose #EC4899 | 👗 | Vêtements |
| Tech | Violet #8B5CF6 | 📱 | Électronique |
| Déco | Rose #E91E63 | 🎨 | Articles |

---

## 💡 Conseils pour Gagner du Temps

1. **Utilise les TODO lists** : Organise ton travail en points clairs
2. **Lis les récapitulatifs** : Inspire-toi des catégories déjà faites
3. **Vérifie doublons tôt** : Avant d'écrire du code
4. **Teste au fur et à mesure** : `read_lints` après chaque modification
5. **Documente en parallèle** : Note les modalités créées au fil de l'eau

---

## 🚀 Exemple de Prompt Initial

```
Salut ! Je vais améliorer la catégorie [NOM_CATEGORIE] dans Yukpomnang.

J'ai lu le GUIDE_MASTER_AMELIORATION_FORMULAIRES_PRODUITS.md et les récapitulatifs des catégories déjà améliorées.

Je vais suivre cette checklist :
1. Analyser le formulaire existant (ou constater son absence)
2. Créer modalités complètes selon la logique métier
3. Transformer nom du produit en SelectModalitySelector
4. Transformer tous les champs liste
5. Transformer dates/heures en natifs
6. Organiser en sections
7. Vérifier variantes si nécessaires
8. Configurer categoryConfig
9. Vérifier ProductCard et filtrage
10. Documenter

Commençons !
```

---

## 🎓 Résumé Ultra-Compact

**Pour améliorer une catégorie** :
1. Lis le GUIDE_MASTER
2. Crée 8-10 listes de modalités (100-200 options)
3. Nom du produit = SelectModalitySelector (50-70+ noms)
4. Tous champs liste = SelectModal ou MultiSelectModal
5. Dates/Heures = Composants natifs
6. Layout = Sections + 2 champs/ligne
7. categoryConfig = Configuration complète
8. Vérifie doublons, lints, filtrage
9. Documente

**Temps estimé** : 30-120 min selon complexité

**Qualité attendue** : ⭐⭐⭐⭐⭐ Production Ready

---

## ✅ Validation Finale

Avant de passer à la catégorie suivante, vérifier :

- [ ] ✅ Tous les champs liste ont des modalités
- [ ] ✅ Nom du produit est une liste déroulante
- [ ] ✅ Dates/Heures sont des composants natifs
- [ ] ✅ Layout organisé en sections
- [ ] ✅ `read_lints` clean
- [ ] ✅ Configuration categoryConfig complète
- [ ] ✅ Pas de doublons
- [ ] ✅ Documentation créée

---

**Bonne chance ! 🚀**
**Ce guide contient TOUT ce dont tu as besoin pour réussir !**








