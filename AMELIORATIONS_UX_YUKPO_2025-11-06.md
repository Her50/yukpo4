# 🎨 Améliorations UX Yukpomnang - 2025-11-06

## 📋 Liste des améliorations demandées

### ✅ 1. Contrôle service existant pour formulaire produit uniquement
**Status** : 🟡 En cours  
**Fichiers** : `HomeScreen.tsx`, `FormulaireYukpoIntelligentScreen.tsx`

**Logique** :
- ✅ FAIT: HomeScreen vérifie si utilisateur a déjà un service via `/api/services/my-services`
- ✅ FAIT: Si service existe → `mode: 'add_product'`, `existingServiceId`, `focusBlock: 'produits'`
- ✅ FAIT: FormulaireYukpoIntelligentScreen démarre au bloc produits (index 3) si `isAddingProductToExistingService`
- ⏳ À FAIRE: Filtrer les blocs visibles pour n'afficher que le bloc produits
- ⏳ À FAIRE: Modifier le bouton de sauvegarde pour appeler `/api/services/{existingServiceId}/products`
- ⏳ À FAIRE: Masquer la navigation entre blocs si mode `add_product`

---

### 2. Rediriger "Mes Services" vers management produit directement
**Status** : ⏳ À faire  
**Fichiers** : `AppNavigator.tsx`, `MesServicesScreen.tsx`

**Actions** :
- Rediriger le bouton "Mes Services" vers la page de management d'un produit
- Déplacer statistiques, gestion membres, création publicité dans management produit
- Suspendre/supprimer l'ancienne page `MesServicesScreen`

---

### 3. Réorganiser bloc Produit
**Status** : ⏳ À faire  
**Fichiers** : `FormulaireYukpoIntelligentScreen.tsx`, champs dynamiques

**Modifications** :
- Déplacer prix et devise **après** lieu de commercialisation
- Devise à **droite** du champ prix (plus miniaturisée, sélecteur compact)
- Ajout images/vidéos **à la fin** du bloc, près du prix (plus visible)
- Resserrer les champs verticalement (réduire gaps/margins)

**Ordre des champs souhaité** :
1. Nom du produit
2. Catégorie produit
3. Description produit
4. Caractéristiques produit (LinearAutocompleteEditor)
5. Lieu de commercialisation
6. **Prix** (avec devise à droite inline)
7. **Images/Vidéos** (MediaUploadManager)

---

### 4. Corriger exemple dynamique dans LinearAutocompleteEditor
**Status** : ⏳ À faire  
**Fichier** : `LinearAutocompleteEditor.tsx`

**Problème actuel** :
- Affiche un exemple figé : "noir, 2024"
- Devrait afficher l'exemple dynamique de l'IA : `value[0].split(separateur)`

**Vérification** :
- `generatePlaceholder()` ligne 334-366
- Vérifier que `value[0]` est bien passé et utilisé

---

### 5. Scroll horizontal entre blocs + synchronisation boutons
**Status** : ⏳ À faire  
**Fichier** : `FormulaireYukpoIntelligentScreen.tsx`

**Améliorations** :
- Permettre scroll horizontal manuel entre les blocs
- Implémenter `ScrollView` horizontal avec `pagingEnabled`
- Synchroniser les boutons de navigation avec le bloc actuellement affiché
- Détecter le scroll et mettre à jour `currentBlock` automatiquement
- Mettre en surbrillance le bon bouton de bloc selon la position du scroll

---

### 6. Améliorer flèche retour ResultatBesoinScreen
**Status** : ⏳ À faire  
**Fichier** : `ResultatBesoinScreen.tsx`

**Problème** :
- Flèche retour trop excentrée vers le haut
- Pas assez visible

**Solution** :
- Augmenter la taille de l'icône
- Ajuster le `marginTop` / `paddingTop`
- Ajouter un fond semi-transparent pour la visibilité
- Peut-être ajouter un bouton "Retour" avec texte

---

## 📊 Progression

- [x] Commit 4ac1645: Contrôle service existant (50% fait)
- [ ] Filtrage blocs visibles en mode add_product
- [ ] Modifier bouton sauvegarde pour add_product
- [ ] Réorganiser ordre des champs bloc Produit
- [ ] Prix + devise inline
- [ ] Images/vidéos à la fin du bloc
- [ ] Resserrer spacing vertical
- [ ] Scroll horizontal entre blocs
- [ ] Synchronisation boutons/blocs
- [ ] Flèche retour ResultatBesoinScreen
- [ ] Rediriger Mes Services

---

## 🎯 Prochaines étapes (ordre de priorité)

1. **URGENT** : Compléter mode `add_product` (filtrer blocs, changer bouton)
2. **MOYEN** : Réorganiser bloc Produit (ordre des champs, prix+devise inline)
3. **MOYEN** : Scroll horizontal + synchronisation
4. **FAIBLE** : Flèche retour ResultatBesoinScreen
5. **FAIBLE** : Rediriger Mes Services

