# 🤖 PROMPT ULTRA-COMPLET V2.0 - Amélioration Catégorie (Nouveau Chat)

## 📋 CONTEXTE DU PROJET

Je travaille sur **Yukpomnang**, une marketplace multiservices (Cameroun) :
- **Backend** : Rust (Axum, SQLx, PostgreSQL)
- **Frontend** : React Native (TypeScript, Expo)
- **10 catégories COMPLÉTÉES** sur 47

## 🎯 OBJECTIF DE CE CHAT

Améliorer la catégorie **[NOM_CATEGORIE]** en suivant le **GUIDE_ULTRA_COMPLET_AMELIORATION_CATEGORIE_V2.md**.

---

## 📚 DOCUMENTS DE RÉFÉRENCE OBLIGATOIRES

**Lis attentivement dans cet ordre** :

1. **`GUIDE_ULTRA_COMPLET_AMELIORATION_CATEGORIE_V2.md`** ⭐
   - Méthodologie complète (10 phases)
   - Système de variantes intelligent
   - **Système d'images multiples par variante** 📸
   - ProductCard adaptatif avec carousel
   - ResultatBesoinScreen intelligent
   - **Amélioration de catégories existantes** (sans doublons)
   - Exemples complets (Téléphones, Mobilier, Restaurant)

2. **`SYSTEME_IMAGES_VARIANTES_COMPLET.md`** 📸
   - Architecture images multiples
   - Upload et gestion d'images
   - Carousel dans ProductCard
   - État actuel vs Améliorations à apporter

2. **Récapitulatifs des catégories COMPLÉTÉES** (exemples) :
   - `mobile/RECAPITULATIF_FINAL_COMPLET_ALIMENTATION.md` (avec variantes)
   - `mobile/RECAPITULATIF_AMELIORATIONS_CHAUSSURES.md` (avec variantes)
   - `mobile/RECAPITULATIF_AMELIORATIONS_HOTELLERIE.md` (avec variantes)
   - `mobile/RECAPITULATIF_AMELIORATIONS_ELECTRICITE.md` (sans variantes)
   - `mobile/RECAPITULATIF_AMELIORATIONS_ELECTROMENAGER.md` (sans variantes)

3. **Fichiers clés du système** :
   - `mobile/src/data/productModalities.ts` (modalités)
   - `mobile/src/components/ProductManagerMobile.tsx` (formulaires)
   - `mobile/src/config/categoryConfig.ts` (configuration)
   - `mobile/src/components/ProductCard.tsx` (affichage)
   - `mobile/src/screens/ResultatBesoinScreen.tsx` (filtrage/tri)

---

## ✅ CHECKLIST ULTRA-COMPLÈTE

### 📊 PHASE 1 : ANALYSE MÉTIER (15 min)

- [ ] Identifier le type : Produit Physique / Service / Établissement / Hybride
- [ ] **QUESTION CRITIQUE** : Les variantes sont-elles nécessaires ?
  - ✅ OUI si : Plusieurs versions avec prix différents (ex: 64GB→150000, 128GB→180000)
  - ❌ NON si : Produit unique avec caractéristiques fixes
- [ ] Analyser le contexte géographique (Cameroun ?)
- [ ] Lister 5-10 caractéristiques métier clés
- [ ] Chercher le formulaire existant

### 📝 PHASE 2 : MODALITÉS (45 min)

- [ ] Créer liste "noms_produits" (50-70+ noms précis)
- [ ] Créer 8-12 listes contextuelles selon métier
- [ ] Chaque liste : 10-30 options + "🆕 Autre (ajouter)"
- [ ] Tri alphabétique ou logique métier
- [ ] Contextualisation Cameroun si applicable
- [ ] Vérifier case dans getProductModalities()

### ⭐ PHASE 3 : VARIANTES (60 min SI NÉCESSAIRE)

**SI variantes nécessaires** :

- [ ] Créer interface [Categorie]Variant (caractéristiques variables + prix + image)
- [ ] Créer composant [Categorie]VariantManager.tsx (310+ lignes)
  - [ ] Fonction handleAddVariant (+1)
  - [ ] Fonction handleAdd3Variants (+3)
  - [ ] Fonction handleUpdateVariant
  - [ ] Fonction handleDeleteVariant avec confirmation
  - [ ] Fonction handleDuplicateVariant
  - [ ] Fonction handlePickImage (expo-image-picker)
  - [ ] Fonction getPriceRange (calcul fourchette)
  - [ ] UI : Header avec boutons +1/+3
  - [ ] UI : Résumé (nombre variantes + fourchette prix)
  - [ ] UI : Liste scrollable avec cartes
  - [ ] UI : Actions par variante (📷, 📋, 🗑️)
  - [ ] UI : Validation visuelle (✓ ou ⚠️)
  - [ ] UI : État vide avec message
  - [ ] Styles cohérents

**SINON** : Passer à Phase 4

### 🏗️ PHASE 4 : FORMULAIRE (45-60 min)

- [ ] Enrichir interface Product (10-15 champs)
- [ ] Ajouter variantes[Categorie]?: [Categorie]Variant[] si applicable
- [ ] Importer [Categorie]VariantManager si variantes
- [ ] Créer/Refondre case dans renderSpecificFields

**Structure** :
- [ ] Section 1 : Identité du Produit
  - [ ] Nom produit en SelectModalitySelector
  - [ ] Synchroniser avec newProduct.name
  - [ ] Catégorie* + Type* (2 champs/ligne)
- [ ] Section 2 : Caractéristiques Métier
  - [ ] Champs spécifiques au métier
  - [ ] Layout 2 champs/ligne
- [ ] Section 3 : Variantes (SI APPLICABLE)
  - [ ] Intégrer [Categorie]VariantManager
- [ ] Section 4 : Qualité & Garantie
  - [ ] État, Garantie, Certifications
- [ ] Section finale : Message d'aide contextuel

### ⚙️ PHASE 5 : CONFIGURATION (30 min)

- [ ] Vérifier doublons avec grep
- [ ] Enrichir categoryConfig.ts
  - [ ] Terminologie adaptée
  - [ ] 10-16 filtres pertinents
  - [ ] Style visuel (couleur, icône, layout)
  - [ ] DisplayPriority logique (inclure 'variantes...' si applicable)
  - [ ] supportsVariants: true/false
- [ ] Si variantes : Ajouter dans VARIANT_SUPPORTED_CATEGORIES

### 📱 PHASE 6 : PRODUCTCARD (45 min SI LOGIQUE SPÉCIFIQUE)

**Si la catégorie nécessite un affichage spécifique** :

- [ ] Créer case dans ProductCard.tsx
- [ ] Gérer présence de variantes
  - [ ] useState pour variante sélectionnée
  - [ ] Fonction getPriceRange()
  - [ ] Fonction getCurrentImage()
- [ ] Sélecteur horizontal de variantes
  - [ ] Miniatures cliquables (30x30px)
  - [ ] Badge nombre d'options
- [ ] Image dynamique selon sélection
- [ ] Prix adaptatif
- [ ] Badges contextuels
- [ ] Caractéristiques clés affichées

**SINON** : Le système générique suffit

### 🔍 PHASE 7 : RESULTATBESOINSCREEN (30 min SI NÉCESSAIRE)

**Si la catégorie nécessite filtrage/tri spécifique** :

- [ ] Ajouter extraction prix dans getServicePrice()
- [ ] Ajouter nom champ variantes dans variantFieldMap
- [ ] Adapter tri (mode 'min' pour asc, 'max' pour desc)
- [ ] Ajouter filtres contextuels si nécessaires
- [ ] Messages spécifiques à la catégorie

**SINON** : Le système adaptatif existant suffit

### 📥 PHASE 8 : IMPORT CSV (15 min)

- [ ] Mettre à jour template CSV dans csvTemplates
- [ ] Aligner colonnes avec formulaire
- [ ] Parser arrays (split |)
- [ ] Parser JSON pour variantes si applicable
- [ ] Ajouter 3-4 exemples concrets
- [ ] Mettre à jour parsing dans handleImportCSV

### ✅ PHASE 9 : TESTS (20 min)

- [ ] read_lints sur tous fichiers modifiés
- [ ] Corriger toutes erreurs
- [ ] Vérifier doublons (grep)
- [ ] Vérifier pas de conflit de noms de champs

### 📚 PHASE 10 : DOCUMENTATION (20 min)

- [ ] Créer RECAPITULATIF_AMELIORATIONS_[CATEGORIE].md
- [ ] Lister toutes modalités (avec nombre)
- [ ] Documenter système variantes si applicable
- [ ] Structure du formulaire
- [ ] Configuration filtres
- [ ] Avant/Après
- [ ] Exemples concrets
- [ ] Template CSV
- [ ] Statistiques (gain %, temps...)

---

## 🚀 PROMPT INITIAL À UTILISER

```
Salut ! Je vais améliorer la catégorie **[NOM_CATEGORIE]** dans Yukpomnang.

J'ai lu le **GUIDE_ULTRA_COMPLET_AMELIORATION_CATEGORIE_V2.md** qui couvre :
- Méthodologie complète (10 phases)
- Système de variantes intelligent
- ProductCard adaptatif
- ResultatBesoinScreen intelligent
- Exemples complets (Téléphones avec variantes, Mobilier sans variantes, Restaurant)

📋 **Analyse métier de la catégorie [NOM_CATEGORIE]** :

1. **Type** : [Produit Physique / Service / Établissement / Hybride]

2. **Variantes nécessaires ?** : [OUI / NON]
   - Si OUI : Préciser les caractéristiques variables (ex: Taille × Couleur, Stockage × Couleur, Type chambre × Capacité)
   - Si NON : Expliquer pourquoi

3. **Contexte Cameroun ?** : [OUI / NON]
   - Si OUI : Préciser (noms d'établissements, zones, services locaux...)

4. **Caractéristiques métier clés** :
   - [Liste de 5-10 caractéristiques importantes]

5. **Nombre de variantes typiques** (si applicable) :
   - [Ex: 6-12 variantes (3 stockages × 4 couleurs)]

---

Je vais suivre les **10 PHASES** :

✅ Phase 1 : Analyse métier (15 min)
✅ Phase 2 : Modalités (45 min) - 10-12 listes, 200+ options
✅ Phase 3 : Variantes (60 min) - SI APPLICABLE
✅ Phase 4 : Formulaire (45-60 min) - 4-6 sections
✅ Phase 5 : Configuration (30 min) - 10-16 filtres
✅ Phase 6 : ProductCard (45 min) - SI LOGIQUE SPÉCIFIQUE
✅ Phase 7 : ResultatBesoinScreen (30 min) - SI NÉCESSAIRE
✅ Phase 8 : Import CSV (15 min)
✅ Phase 9 : Tests (20 min)
✅ Phase 10 : Documentation (20 min)

**Temps estimé total** : [4h si sans variantes / 6h30 si avec variantes]

Commençons par l'analyse métier ! 🚀
```

---

## 🎯 DÉCISIONS CLÉS À PRENDRE

### Question 1 : Variantes Nécessaires ?

**✅ OUI** pour :
- Téléphones (Stockage × Couleur × Prix)
- Vêtements (Taille × Couleur × Prix)
- Parfums (Volume × Prix)
- Cours en ligne (Format × Prix : PDF, Vidéo, Présentiel)
- Location véhicules (Type véhicule × Prix/jour)

**❌ NON** pour :
- Automobile (1 voiture = 1 prix)
- Immobilier (1 bien = 1 prix)
- Services uniques (Coiffure, Réparation)
- Événements (1 événement = 1 prix)

**💡 Règle d'or** : Si vous hésitez, posez-vous la question :
> "Est-ce que le même produit/service peut avoir plusieurs versions avec des prix différents ?"

### Question 2 : ProductCard Spécifique ?

**✅ OUI** si :
- Affichage très particulier
- Logique métier complexe
- Variantes avec sélecteur spécial

**❌ NON** si :
- Affichage standard suffit
- Le système générique gère bien

**💡 Conseil** : Commencer sans ProductCard spécifique. Ajouter seulement si vraiment nécessaire.

### Question 3 : ResultatBesoinScreen Spécifique ?

**✅ OUI** si :
- Filtrage très spécifique
- Tri particulier
- Logique métier unique

**❌ NON** si :
- Le système adaptatif suffit (cas général)

---

## 📊 CATÉGORIES DÉJÀ COMPLÉTÉES (Exemples à Étudier)

| Catégorie | Variantes | Listes | Options | À Étudier Pour |
|-----------|-----------|--------|---------|----------------|
| **Alimentation** | ✅ Oui | 10 | 286 | Variantes simples (Quantité) |
| **Chaussures** | ✅ Oui | 9 | 180 | Variantes doubles (Pointure × Couleur) |
| **Hôtellerie** | ✅ Oui | 12 | 210 | Variantes + Contexte Cameroun |
| **Électricité** | ❌ Non | 12 | 224 | Modalités riches sans variantes |
| **Électroménager** | ❌ Non | 10 | 229 | Formulaire structuré |

---

## 🎨 GUIDE DE STYLE PAR TYPE

| Type Produit | Couleur | Icône | Layout | Exemple |
|--------------|---------|-------|--------|---------|
| Alimentation | #10B981 (Vert) | 🍽️ | vertical | Produits alimentaires |
| Mode/Vêtements | #EC4899 (Rose) | 👗 | grid | Visuels mode |
| Tech/Électronique | #8B5CF6 (Violet) | 📱 | horizontal | Specs techniques |
| Immobilier | #3B82F6 (Bleu) | 🏠 | vertical | Biens immobiliers |
| Automobile | #F59E0B (Orange) | 🚗 | horizontal | Véhicules |
| Santé | #DC2626 (Rouge) | 🏥 | vertical | Établissements |
| Loisirs | #14B8A6 (Teal) | 🎯 | grid | Activités |
| Services | #6366F1 (Indigo) | 🛠️ | vertical | Prestations |

---

## 🔥 EXEMPLES DE PROMPTS POUR CATÉGORIES SPÉCIFIQUES

### Exemple 1 : Téléphones (AVEC Variantes)

```
Je vais améliorer la catégorie **Téléphones et Smartphones**.

📊 Analyse métier :
- Type : Produit Physique
- Variantes : ✅ OUI (Stockage × Couleur × Prix)
  → Exemple : iPhone 15 Pro en 256GB Noir = 450000 FCFA
  → Même téléphone en 512GB Bleu = 550000 FCFA
- Contexte Cameroun : Marques populaires (Infinix, Tecno, Samsung)
- Caractéristiques clés : Marque, Modèle, Stockage, RAM, Réseau, État
- Nombre variantes typique : 6-12 (3 stockages × 4 couleurs)

Je vais créer :
1. 10-12 listes de modalités (noms, marques, stockages, RAM, couleurs, réseaux...)
2. Interface TelephoneVariant
3. Composant TelephoneVariantManager
4. Formulaire 4 sections avec variantes
5. ProductCard avec sélecteur de variantes
6. Configuration avec supportsVariants: true

Commençons !
```

### Exemple 2 : Mobilier (SANS Variantes)

```
Je vais améliorer la catégorie **Mobilier et Ameublement**.

📊 Analyse métier :
- Type : Produit Physique
- Variantes : ❌ NON
  → Raison : Un meuble = un objet unique avec ses caractéristiques
  → Pas de variations de prix pour le même meuble
- Contexte Cameroun : Artisans locaux
- Caractéristiques clés : Catégorie (pièce), Type, Matière, Style, Couleur, Dimensions, État

Je vais créer :
1. 10 listes de modalités (noms, catégories, types, matières, styles, couleurs, états, dimensions, marques, assemblages)
2. Formulaire 4 sections SANS variantes
3. Configuration avec supportsVariants: false
4. Utiliser ProductCard générique

Commençons !
```

### Exemple 3 : Cours en Ligne (AVEC Variantes)

```
Je vais améliorer la catégorie **Cours et Formations en Ligne**.

📊 Analyse métier :
- Type : Service
- Variantes : ✅ OUI (Format × Prix)
  → PDF : 5000 FCFA
  → Vidéo enregistrée : 15000 FCFA
  → Live + Support : 35000 FCFA
- Contexte Cameroun : Langues (Français, Anglais)
- Caractéristiques clés : Domaine, Niveau, Langue, Durée, Certificat
- Nombre variantes typique : 2-4 (formats différents)

Je vais créer :
1. 10 listes (noms, domaines, niveaux, langues, durées, formateurs...)
2. Interface CoursVariant
3. Composant CoursVariantManager
4. Formulaire avec variantes de formats
5. Configuration avec supportsVariants: true

Commençons !
```

---

## ⚠️ POINTS D'ATTENTION CRITIQUES

### 🚨 TOUJOURS Vérifier

1. **Synchronisation nom** :
   ```typescript
   name: value  // ✅ NE JAMAIS OUBLIER
   ```

2. **Pas de listes vides** :
   ```typescript
   marques: ['Marque 1', ..., '🆕 Autre (ajouter)']  // ✅ BON
   marques: []  // ❌ MAUVAIS
   ```

3. **Variantes avec images** :
   - Chaque variante DOIT pouvoir avoir une image
   - Upload image implémenté dans le Manager

4. **Prix adaptatif** :
   - getServicePrice() doit gérer mode 'min'/'max'
   - Tri doit utiliser le bon mode

5. **VARIANT_SUPPORTED_CATEGORIES** :
   - Ajouter la catégorie si supportsVariants: true

### 🎯 Ordre de Priorité

1. **PRIORITÉ 1** (Obligatoire) :
   - Nom du produit en SelectModalitySelector
   - Toutes les listes avec modalités
   - Synchronisation name
   - Configuration categoryConfig

2. **PRIORITÉ 2** (Important) :
   - Variantes si applicable
   - Layout 2 champs/ligne
   - Sections structurées

3. **PRIORITÉ 3** (Optionnel) :
   - ProductCard spécifique (seulement si nécessaire)
   - ResultatBesoinScreen spécifique (seulement si nécessaire)

---

## 📈 OBJECTIFS DE QUALITÉ

### Métriques Cibles

| Métrique | Objectif |
|----------|----------|
| Listes de modalités | 10-12 |
| Options totales | 200-250 |
| Noms de produits | 50-70+ |
| Sections formulaire | 4-6 |
| Filtres | 10-16 |
| Temps de saisie | -60% minimum |
| Erreurs de saisie | < 5% |
| Standardisation | > 90% |

---

## 🎓 CONSEILS POUR GAGNER DU TEMPS

1. **Utilise les TODOs** : Organise ton travail
2. **Lis les récapitulatifs** : Inspire-toi des catégories complétées
3. **Vérifie doublons tôt** : grep avant d'écrire
4. **Teste au fur et à mesure** : read_lints après chaque modification
5. **Copie les styles** : Réutilise les styles des composants Manager existants
6. **Batch les imports** : Ajoute tous les imports nécessaires d'un coup

---

## 📦 FICHIERS À MODIFIER (Standard)

### Toujours Modifiés (100%)
1. `mobile/src/data/productModalities.ts`
2. `mobile/src/components/ProductManagerMobile.tsx`
3. `mobile/src/config/categoryConfig.ts`

### Si Variantes (60%)
4. `mobile/src/components/[Categorie]VariantManager.tsx` (CRÉER)

### Rarement (20%)
5. `mobile/src/components/ProductCard.tsx` (seulement si logique très spécifique)
6. `mobile/src/screens/ResultatBesoinScreen.tsx` (seulement si filtrage très spécifique)

### Documentation (100%)
7. `mobile/RECAPITULATIF_AMELIORATIONS_[CATEGORIE].md` (CRÉER)

---

## 🎯 VALIDATION FINALE

La catégorie est **COMPLÉTÉE** si :

✅ Nom du produit en SelectModalitySelector (50-70+ options)
✅ 10-12 listes de modalités (200+ options)
✅ Formulaire 4-6 sections structurées
✅ Variantes implémentées (si applicable)
✅ Configuration complète (10-16 filtres)
✅ ProductCard adaptatif (si nécessaire)
✅ ResultatBesoinScreen intelligent (si nécessaire)
✅ Import CSV aligné
✅ 0 erreur de linter
✅ Pas de doublons
✅ Documentation complète

---

## 🏆 RÉSUMÉ ULTRA-COMPACT

**Pour améliorer une catégorie** :

1. **Analyse** : Type ? Variantes ? Contexte ?
2. **Modalités** : 10-12 listes, 200+ options
3. **Variantes** : Interface + Manager (si applicable)
4. **Formulaire** : 4-6 sections, nom en liste
5. **Configuration** : 10-16 filtres, supportsVariants
6. **ProductCard** : Adaptatif (si nécessaire)
7. **ResultatBesoin** : Intelligent (si nécessaire)
8. **CSV** : Aligné
9. **Tests** : 0 erreur
10. **Documentation** : Récapitulatif

**Temps** : 4h (sans variantes) / 6h30 (avec variantes)

---

## ✨ VERSION & STATUT

**Guide** : GUIDE_ULTRA_COMPLET_AMELIORATION_CATEGORIE_V2.md  
**Prompt** : PROMPT_AMELIORATION_CATEGORIE_ULTRA_COMPLET_V2.md  
**Version** : 2.0.0  
**Date** : 27 Octobre 2025  
**Statut** : ✅ **PRÊT POUR PRODUCTION**

🚀 **Ce prompt contient TOUT ce dont tu as besoin pour réussir !**

**Utilise-le dans un nouveau chat et suis les 10 PHASES !**

---

## 📞 SUPPORT

- Guide complet : `GUIDE_ULTRA_COMPLET_AMELIORATION_CATEGORIE_V2.md`
- Exemples : Récapitulatifs des 10 catégories complétées
- Questions ? Réfère-toi au guide !

**Bonne chance pour les 37 catégories restantes !** 🎉

