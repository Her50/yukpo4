# 🛒 INTÉGRATION LISTE COURSES AVEC SUPERMARCHÉS

## 🎯 OBJECTIF

Intégrer la liste de courses du service Planification Menus avec le module de supermarchés existant pour permettre la commande directe.

## 🔍 MODULES EXISTANTS IDENTIFIÉS

### 1. API Supermarchés
**Fichier** : `mobile/src/services/api.ts`

**Fonction disponible** :
```typescript
deliveryApi.listSupermarkets(latitude, longitude, radiusKm)
```
- Recherche supermarchés à proximité (GPS)
- Filtre par mots-clés (supermarche, carrefour, casino, etc.)
- Cache local (5 minutes)

### 2. Shopping API
**Fichier** : `mobile/src/services/api.ts`

**Fonctions disponibles** :
```typescript
shoppingApi.createOrder(payload)
shoppingApi.estimateOrder(payload)
shoppingApi.checkoutOrder(orderId, payload)
```

### 3. Composant Sélection Supermarché
**Fichier** : `mobile/src/components/delivery/DeliveryShoppingFlowSteps.tsx`

**Composant** : `SupermarketSelectionStep`
- Liste supermarchés avec recherche
- Tri par distance/nom
- Sélection supermarché

### 4. Flux Shopping Complet
**Fichier** : `mobile/src/screens/delivery/DeliveryShoppingFlow.tsx`
- Flow complet : sélection supermarché → panier → commande
- Intégration avec système livraison

## 🔗 INTÉGRATION RÉALISÉE

### ShoppingListScreen amélioré
- ✅ Intégration avec `deliveryApi.listSupermarkets()`
- ✅ Navigation vers `DeliveryShoppingFlow` avec items de la liste
- ✅ Utilisation GPS utilisateur pour trouver supermarchés proches

### Flux utilisateur
1. Utilisatrice génère menu → Liste courses auto
2. Dans liste courses → Clique "Commander via Yukpo"
3. Chargement supermarchés à proximité (GPS)
4. Navigation vers flow shopping avec items pré-remplis
5. Commande via système livraison existant

## 📝 CODE D'INTÉGRATION

### Dans ShoppingListScreen.tsx

```typescript
// Import du module supermarchés
import { deliveryApi } from '../../services/api';
import { useLocation } from '../../contexts/LocationContext';

// Dans le composant
const { location } = useLocation();

// Fonction commander
const handleOrder = async () => {
    // 1. Charger supermarchés à proximité
    const result = await deliveryApi.listSupermarkets(
        location.coords.latitude,
        location.coords.longitude,
        10 // 10 km
    );
    
    // 2. Naviguer vers flow shopping avec items
    navigation.navigate('DeliveryShoppingFlow', {
        basketItems: shoppingList.items.map(item => ({
            id: item.id.toString(),
            name: item.ingredient_name,
            quantity: item.quantity,
            unit: item.unit,
        })),
    });
};
```

## 🚀 PROCHAINES AMÉLIORATIONS

### Backend
- [ ] Endpoint `POST /api/menus/shopping-list/order` pour créer commande directement
- [ ] Mapping automatique ingrédients → produits disponibles
- [ ] Comparaison prix entre supermarchés

### Frontend
- [ ] Modal sélection supermarché depuis liste courses
- [ ] Aperçu panier avant commande
- [ ] Comparaison prix entre supermarchés

---

**L'intégration avec les supermarchés est maintenant fonctionnelle !**

