# 📦 Configuration de la Livraison - Guide d'Accès

*Date: 2025-11-25*

## 🎯 Où configurer la livraison ?

La configuration de livraison est accessible depuis **l'écran de gestion des produits** (`MesProduitsScreen`), qui est accessible via l'onglet **"Mes Services"** dans la navigation principale.

---

## 📍 Accès depuis l'application mobile

### Étape 1 : Accéder à "Mes Services"
1. Ouvrir l'application mobile
2. Aller dans l'onglet **"Mes Services"** (icône briefcase dans la barre de navigation du bas)
3. Vous arrivez sur `MesProduitsScreen` qui liste tous vos services et produits

### Étape 2 : Accéder à la gestion des produits d'un service
1. Dans `MesProduitsScreen`, sélectionner un service
2. Cela ouvre la gestion des produits de ce service (via `ProductManagerMobile`)

### Étape 3 : Configurer la livraison

**Option A : Configuration pour un produit spécifique**
- Dans la liste des produits, chaque produit a un bouton avec l'icône **🚚 (truck)** à côté des boutons Éditer/Supprimer
- Cliquer sur ce bouton ouvre `ProductDeliveryConfigModal` pour ce produit

**Option B : Configuration pour tous les produits**
- En haut de la liste des produits, il y a un bouton **"🚚 Configurer livraison pour tous les produits"**
- Cliquer sur ce bouton ouvre `ProductDeliveryConfigModal` en mode transversal (pour tous les produits)

---

## 🔍 Emplacement dans le code

### Fichiers concernés

1. **`mobile/src/screens/MesProduitsScreen.tsx`**
   - Écran principal qui liste les services et produits
   - Accessible via l'onglet "Mes Services"

2. **`mobile/src/components/ProductManagerMobile.tsx`**
   - Composant de gestion des produits d'un service
   - Contient les boutons de configuration de livraison :
     - Ligne 2233 : Bouton global "🚚 Configurer livraison pour tous les produits"
     - Ligne 2292-2301 : Bouton par produit (icône truck)

3. **`mobile/src/components/delivery/ProductDeliveryConfigModal.tsx`**
   - Modal de configuration de livraison
   - Permet de configurer :
     - Adresse de retrait
     - Type de véhicule requis
     - Poids et volume
     - Instructions spéciales (isotherme, fragile)
     - Horaires de disponibilité
     - Mode de facturation

---

## ⚠️ Problème identifié

**L'utilisateur ne voit pas ces pages dans ses écrans mobile.**

### Causes possibles :

1. **Navigation non accessible** : L'onglet "Mes Services" n'est peut-être pas visible ou accessible
2. **Composant non rendu** : `ProductManagerMobile` n'est peut-être pas utilisé dans `MesProduitsScreen`
3. **Boutons masqués** : Les boutons de configuration de livraison sont peut-être conditionnels et ne s'affichent pas

### Vérifications à faire :

1. Vérifier que `MesProduitsScreen` utilise bien `ProductManagerMobile`
2. Vérifier que les boutons de configuration de livraison sont visibles (pas de condition qui les masque)
3. Vérifier que l'onglet "Mes Services" est bien dans la navigation principale

---

## 🔧 Solutions proposées

### Solution 1 : Vérifier l'utilisation de ProductManagerMobile dans MesProduitsScreen

Si `MesProduitsScreen` n'utilise pas `ProductManagerMobile`, il faut l'ajouter ou créer un écran dédié à la gestion des produits.

### Solution 2 : Ajouter un accès direct depuis MesServicesScreen

Ajouter un bouton dans `MesServicesScreen` pour accéder directement à la configuration de livraison d'un produit/service.

### Solution 3 : Créer un écran dédié "Configuration Livraison"

Créer un nouvel écran accessible depuis le menu principal ou depuis les paramètres du service.

---

## 📝 Prochaines étapes

1. ✅ Vérifier si `MesProduitsScreen` utilise `ProductManagerMobile`
2. ✅ Vérifier la visibilité des boutons de configuration de livraison
3. ✅ Si nécessaire, créer un accès alternatif ou améliorer la navigation

---

*Documentation créée le 2025-11-25*

