# Plan de Correction - Problèmes de Création Vidéo

## Analyse des Problèmes Identifiés

### 1. Problème de chargement des produits depuis HomeScreen (Image 1)
**Symptôme** : Lorsqu'on clique sur l'icône vidéo principale au pied de HomeScreen, les produits ne se chargent pas et on obtient un toast d'erreur indiquant qu'on ne trouve pas de produit.

**Cause identifiée** :
- La fonction `loadProductsForVideo` dans `HomeScreen.tsx` charge les services mais l'extraction des produits peut échouer si la structure de données est différente
- Le `ServiceProductSelector` peut ne pas recevoir les produits correctement formatés
- La validation dans `navigateToVideoWizard` peut échouer si `serviceId` ou `productIndex` ne sont pas correctement passés

**Fichiers concernés** :
- `mobile/src/screens/HomeScreen.tsx` (lignes 88-184)
- `mobile/src/components/ServiceProductSelector.tsx`
- `mobile/src/utils/videoNavigation.ts`

**Corrections à appliquer** :
1. Améliorer l'extraction des produits dans `loadProductsForVideo` pour gérer tous les formats possibles
2. Ajouter des logs de debug pour tracer le chargement
3. Vérifier que les produits sont correctement formatés avant de les passer au sélecteur
4. S'assurer que `navigateToVideoWizard` reçoit les bons paramètres

### 2. Problème d'affichage des étapes dans VideoCreationWizardScreen (Images 2-5)
**Symptôme** : Les boutons "Étape précédente" et "Étape suivante" masquent le contenu des étapes. On a l'impression qu'il y a une superposition de pages UI.

**Cause identifiée** :
- Les boutons sont probablement positionnés en `absolute` ou `fixed` et recouvrent le contenu
- Le layout des étapes n'utilise pas correctement `ScrollView` ou `KeyboardAvoidingView`
- Les hauteurs ne sont pas correctement calculées

**Fichiers concernés** :
- `mobile/src/screens/video/VideoCreationWizardScreen.tsx`

**Corrections à appliquer** :
1. Repositionner les boutons pour qu'ils ne masquent pas le contenu
2. Utiliser `KeyboardAvoidingView` et `ScrollView` correctement
3. Ajuster les styles pour que le contenu soit visible au-dessus des boutons
4. Utiliser `paddingBottom` sur le contenu pour éviter le chevauchement

### 3. Boucle dans le toast de création vidéo (Image 5)
**Symptôme** : Le toast de création de vidéo semble bouclé, pas de confirmation de création, mais parfois il y a confirmation.

**Cause identifiée** :
- Le polling de la génération vidéo peut être en boucle infinie
- Le statut de la génération peut ne pas être correctement détecté
- Le toast peut être affiché plusieurs fois

**Fichiers concernés** :
- `mobile/src/screens/video/VideoCreationWizardScreen.tsx`
- `mobile/src/components/VideoProgressModal.tsx`
- `mobile/src/hooks/useVideoGenerationProgress.ts`

**Corrections à appliquer** :
1. Vérifier que le polling s'arrête quand le statut est `completed` ou `failed`
2. Ajouter un timeout pour éviter les boucles infinies
3. S'assurer que le toast de confirmation n'est affiché qu'une seule fois
4. Améliorer la gestion des états de génération

### 4. UX des étapes dans ProductVideoCreationModal (Images 6+)
**Symptôme** : Les pages ne sont pas organisées en étapes pour améliorer l'UX, mais tout est vertical, il faut scroller verticalement pour parcourir toutes les étapes.

**Cause identifiée** :
- `ProductVideoCreationModal` affiche tout le contenu en une seule page avec scroll vertical
- Pas de système d'étapes comme dans `VideoCreationWizardScreen`
- Les boutons de navigation entre étapes n'existent pas

**Fichiers concernés** :
- `mobile/src/components/ProductVideoCreationModal.tsx`

**Corrections à appliquer** :
1. Implémenter un système d'étapes similaire à `VideoCreationWizardScreen`
2. Organiser le contenu en 3-4 étapes distinctes
3. Ajouter des boutons de navigation entre étapes
4. Améliorer l'indicateur de progression

### 5. Extraction et présentation des données dans les champs (Images 6+)
**Symptôme** : Les données ne sont pas toujours bien extraites ou présentées dans les champs. On voit parfois des objets JSON au lieu de valeurs lues.

**Cause identifiée** :
- Les fonctions d'extraction (`getFieldValue`, `extractProductName`, etc.) ne gèrent pas tous les cas
- Les données peuvent être dans des structures wrapper (`{valeur: "...", type_donnee: "string"}`)
- Les champs affichent directement les objets au lieu d'extraire les valeurs

**Fichiers concernés** :
- `mobile/src/components/ProductVideoCreationModal.tsx`
- `mobile/src/utils/productNormalizer.ts`
- `mobile/src/utils/displayHelpers.ts`

**Corrections à appliquer** :
1. Améliorer `getFieldValue` pour gérer tous les formats
2. Utiliser systématiquement les fonctions d'extraction dans tous les champs
3. Ajouter des fallbacks pour les cas non gérés
4. Nettoyer les données avant affichage

## Plan d'Action

### Phase 1 : Correction du chargement des produits
1. Améliorer `loadProductsForVideo` dans `HomeScreen.tsx`
2. Ajouter des logs de debug
3. Tester le chargement depuis l'icône vidéo

### Phase 2 : Correction de l'affichage des étapes
1. Repositionner les boutons dans `VideoCreationWizardScreen`
2. Ajuster le layout pour éviter le chevauchement
3. Tester la navigation entre étapes

### Phase 3 : Correction de la boucle du toast
1. Vérifier le polling dans `useVideoGenerationProgress`
2. Ajouter des timeouts et arrêts conditionnels
3. Tester la génération vidéo complète

### Phase 4 : Amélioration UX ProductVideoCreationModal
1. Implémenter le système d'étapes
2. Organiser le contenu en étapes distinctes
3. Ajouter la navigation entre étapes

### Phase 5 : Correction de l'extraction des données
1. Améliorer les fonctions d'extraction
2. Appliquer systématiquement dans tous les champs
3. Tester avec différents formats de données

