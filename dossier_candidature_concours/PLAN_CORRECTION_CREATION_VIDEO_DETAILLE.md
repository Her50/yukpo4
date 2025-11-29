# Plan de Correction Détaillé - Problèmes de Création Vidéo

## Analyse des Problèmes Identifiés

### 1. Problème de chargement des produits depuis l'onglet Video (Image 1)
**Symptôme** : Lorsqu'on clique sur l'icône vidéo principale au pied de HomeScreen (onglet Video), les produits ne se chargent pas et on obtient un toast d'erreur indiquant qu'on ne trouve pas de produit.

**Cause identifiée** :
- Dans `VideoCreationIntroScreen.tsx`, la fonction `handleStart` charge les services et extrait les produits
- Le code utilise `normalizeServiceProducts` et `extractProductName` qui sont corrects
- **PROBLÈME** : Si les services sont chargés mais qu'aucun produit n'est extrait, l'alerte s'affiche mais le sélecteur de produit ne s'affiche pas correctement
- **PROBLÈME** : Le code vérifie `allProducts.length === 0` mais ne vérifie pas si les produits sont correctement formatés

**Fichiers concernés** :
- `mobile/src/screens/video/VideoCreationIntroScreen.tsx` (lignes 146-235)
- `mobile/src/components/ServiceProductSelector.tsx`

**Correction** :
1. Améliorer la validation de l'extraction des produits
2. Ajouter des logs détaillés pour diagnostiquer le problème
3. Vérifier que `normalizeServiceProducts` retourne bien un tableau
4. S'assurer que `extractProductName` retourne toujours une string valide

---

### 2. Problème d'affichage des étapes dans VideoCreationWizardScreen (Images 2-5)
**Symptôme** : Les boutons "Étape précédente" et "Étape suivante" / "Lancer le rendu" masquent le contenu des étapes.

**Cause identifiée** :
- Les boutons sont positionnés en `position: 'absolute'` avec `bottom: 0` (ligne 2316-2333)
- Le contenu du ScrollView a un `paddingBottom` de 140 (iOS) ou 130 (Android) (ligne 2312)
- **PROBLÈME** : Le padding peut ne pas être suffisant si le contenu est long
- **PROBLÈME** : Les boutons peuvent avoir une hauteur variable selon le contenu
- **PROBLÈME** : Le `zIndex: 1000` peut masquer le contenu si le ScrollView n'a pas assez de padding

**Fichiers concernés** :
- `mobile/src/screens/video/VideoCreationWizardScreen.tsx` (lignes 2312-2333, 1671, 1948, 2127)

**Correction** :
1. Augmenter le `paddingBottom` du contenu ScrollView pour garantir que tout le contenu est visible
2. Utiliser `useSafeAreaInsets` pour calculer dynamiquement l'espace nécessaire
3. Ajouter un `contentInset` au ScrollView pour iOS
4. S'assurer que les boutons ont une hauteur fixe et calculée

---

### 3. Problème de boucle du toast de création vidéo (Image 5)
**Symptôme** : Le toast de création de la vidéo semble bouclé, pas de confirmation de création, mais à certains moments il y a parfois confirmation.

**Cause identifiée** :
- Le toast est probablement affiché dans `VideoProgressModal` ou dans la fonction `handleGenerate`
- **PROBLÈME** : Le polling du statut de la vidéo peut déclencher plusieurs fois le toast
- **PROBLÈME** : Le toast peut être affiché à chaque mise à jour du statut au lieu d'une seule fois

**Fichiers concernés** :
- `mobile/src/components/VideoProgressModal.tsx`
- `mobile/src/screens/video/VideoCreationWizardScreen.tsx` (fonction `handleGenerate`)
- `mobile/src/hooks/useVideoGenerationProgress.ts`

**Correction** :
1. Vérifier que le toast n'est affiché qu'une seule fois par événement
2. Utiliser un flag pour éviter les toasts multiples
3. Améliorer la logique de polling pour ne pas déclencher de toast à chaque update

---

### 4. Problème d'UX dans ProductVideoCreationModal (Images 6+)
**Symptôme** : Dans MesServicesScreen, les autres liens d'accès au montage vidéo (en-tête de page ou sous-menu avec les ... verticaux) affichent tout en scroll vertical au lieu d'être organisés en étapes.

**Cause identifiée** :
- `ProductVideoCreationModal` n'a pas de système d'étapes avec navigation
- Tout le contenu est affiché dans un ScrollView vertical
- **PROBLÈME** : L'UX n'est pas optimale car l'utilisateur doit scroller beaucoup pour voir toutes les options

**Fichiers concernés** :
- `mobile/src/components/ProductVideoCreationModal.tsx`

**Correction** :
1. Implémenter un système d'étapes similaire à `VideoCreationWizardScreen`
2. Organiser le contenu en 3-4 étapes logiques :
   - Étape 1 : Sélection produit et médias
   - Étape 2 : Configuration style et audio
   - Étape 3 : Brief et script
   - Étape 4 : Distribution et résumé
3. Ajouter des boutons de navigation entre les étapes
4. Utiliser le même système de boutons fixes en bas avec padding approprié

---

### 5. Problème d'extraction et présentation des données dans les champs (Images 6+)
**Symptôme** : Les données ne sont pas toujours bien extraites ou présentées dans les champs (nom de produit, description, prix, etc.).

**Cause identifiée** :
- Les fonctions `extractProductName`, `extractDescription`, `getFieldValue` sont utilisées mais peuvent ne pas gérer tous les cas
- **PROBLÈME** : Les données peuvent être dans différents formats (objet JSON, string, valeur wrapper)
- **PROBLÈME** : Les champs peuvent afficher `[object Object]` au lieu de la valeur extraite

**Fichiers concernés** :
- `mobile/src/utils/displayHelpers.ts`
- `mobile/src/utils/productNormalizer.ts`
- `mobile/src/components/ProductVideoCreationModal.tsx` (fonction `normalizeProductName`, lignes 107-137)
- `mobile/src/screens/video/VideoCreationWizardScreen.tsx` (lignes 427-458)

**Correction** :
1. Améliorer `extractProductName` pour gérer tous les cas de figure
2. Améliorer `extractDescription` pour éviter l'affichage de JSON
3. Ajouter des validations pour s'assurer que les valeurs sont toujours des strings
4. Ajouter des logs pour diagnostiquer les problèmes d'extraction

---

## Plan d'Action

### Phase 1 : Corrections Critiques (Priorité Haute)
1. ✅ Corriger le chargement des produits dans `VideoCreationIntroScreen`
2. ✅ Corriger l'affichage des étapes dans `VideoCreationWizardScreen` (padding et positionnement)
3. ✅ Corriger la boucle du toast de création vidéo

### Phase 2 : Améliorations UX (Priorité Moyenne)
4. ✅ Implémenter le système d'étapes dans `ProductVideoCreationModal`
5. ✅ Améliorer l'extraction des données dans tous les champs

### Phase 3 : Tests et Validation
6. ✅ Tester tous les chemins d'accès à la création vidéo
7. ✅ Vérifier que les données sont correctement extraites et affichées
8. ✅ Vérifier que les boutons ne masquent plus le contenu

---

## Notes Techniques

- Utiliser `useSafeAreaInsets` de `react-native-safe-area-context` pour calculer dynamiquement les espacements
- S'assurer que tous les champs utilisent `extractProductName`, `extractDescription`, `getFieldValue` de manière cohérente
- Ajouter des logs détaillés pour faciliter le débogage
- Tester sur iOS et Android pour s'assurer que les espacements sont corrects

