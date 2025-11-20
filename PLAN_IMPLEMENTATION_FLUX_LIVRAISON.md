# 📋 Plan d'Implémentation : Flux de Livraison (DeliveryShoppingFlow & DeliveryParcelFlow)

## 🎯 Contexte

D'après l'analyse des documents `ANALYSE_WORKFLOW_LIVRAISON_AMELIORATIONS.md` et `PROMPT_IMPLEMENTATION_AMELIORATIONS_LIVRAISON.md`, il existe deux workflows distincts :

### 1. Workflow "Se faire livrer" (Client identifie un produit)
- **Déclencheur** : Client clique sur "Se faire livrer" depuis un produit
- **Caractéristiques** :
  - Vérification disponibilité produit (jour, stock, temps préparation)
  - Validation prestataire requise
  - Workflow : Pending → Validated → Preparing → Ready → CourierAssigned
  - Système de préparation avec temps estimé
  - Gestion stock en temps réel
- **Fichiers concernés** : Système de commandes produits (`product_orders`, `product_delivery_config`)

### 2. Workflow "Livraison" (Utilisateur veut livrer)
- **Déclencheur** : Bouton "Livraison" dans l'en-tête de HomeScreen
- **Caractéristiques** :
  - **PAS de vérification produit/disponibilité**
  - Focus sur : pickup/drop points, moments de livraison, matching coursier
  - Utilise `createDeliveryRequest` directement
  - Support déménagement
  - Deux sous-flux :
    - **Courses supermarché** : Sélection supermarché, composition panier
    - **Livraison colis** : Points pickup/drop, infos colis (type, poids, photos)

---

## 🔧 Implémentation

### Étape 1 : Créer `DeliveryShoppingFlow.tsx`

**Localisation** : `mobile/src/screens/delivery/DeliveryShoppingFlow.tsx`

**Fonctionnalités** :
1. **Sélection supermarché** :
   - Liste des supermarchés disponibles (APIs configurées)
   - Recherche/filtrage par nom, distance
   - Affichage adresse, horaires, distance

2. **Composition panier** :
   - Ajout produits au panier
   - Quantités, prix
   - Total du panier

3. **Points pickup/drop** :
   - Sélection point pickup (adresse supermarché)
   - Sélection point drop (adresse livraison)
   - Utilisation GPS pour suggestions
   - **IMPORTANT** : Afficher adresses textuelles, pas coordonnées GPS brutes

4. **Création livraison** :
   - Appel `createDeliveryRequest` avec :
     ```typescript
     {
       parcel: {
         type_id: 'shopping',
         notes: 'Courses supermarché',
         metadata: { supermarket_id, basket_items }
       },
       pickup: { latitude, longitude, address: 'Adresse supermarché' },
       dropoff: { latitude, longitude, address: 'Adresse livraison' },
       metadata: { kind: 'shopping', supermarket_id, basket_total }
     }
     ```

**Composants à utiliser** :
- `NativeInput` pour adresses
- `NativeButton` pour actions
- `NativeCard` pour sections
- `SafeIcon` pour icônes
- `ModernGPSModal` pour sélection GPS

---

### Étape 2 : Créer `DeliveryParcelFlow.tsx`

**Localisation** : `mobile/src/screens/delivery/DeliveryParcelFlow.tsx`

**Fonctionnalités** :
1. **Informations colis** :
   - Type de colis (document, paquet, déménagement)
   - Poids (kg)
   - Volume (cm³) - optionnel
   - Valeur déclarée - optionnel
   - Photos du colis (optionnel)
   - Notes

2. **Points pickup/drop** :
   - Sélection point pickup (adresse expéditeur)
   - Sélection point drop (adresse destinataire)
   - Utilisation GPS pour suggestions
   - **IMPORTANT** : Afficher adresses textuelles, pas coordonnées GPS brutes

3. **Support déménagement** :
   - Si type = "déménagement", afficher champs supplémentaires :
     - Nombre de cartons
     - Meubles à transporter
     - Accès (ascenseur, étage, etc.)

4. **Création livraison** :
   - Appel `createDeliveryRequest` avec :
     ```typescript
     {
       parcel: {
         type_id: parcelType,
         weight_kg: weight,
         volume_cm3: volume,
         declared_value: value,
         notes: notes,
         photos: photos,
         constraints: { is_moving: type === 'déménagement', ... }
       },
       pickup: { latitude, longitude, address: 'Adresse pickup' },
       dropoff: { latitude, longitude, address: 'Adresse dropoff' },
       metadata: { kind: 'parcel', is_moving: type === 'déménagement' }
     }
     ```

**Composants à utiliser** :
- `NativeInput` pour champs texte
- `NativeButton` pour actions
- `NativeCard` pour sections
- `MediaUploadManager` pour photos colis
- `ModernGPSModal` pour sélection GPS

---

### Étape 3 : Modifier `DeliveryHomeScreen.tsx`

**Modifications** :
1. **Corriger `handleStartParcel`** :
   ```typescript
   const handleStartParcel = useCallback(() => {
       if (navigating) return;
       console.log('[DeliveryHomeScreen] 📦 Navigation vers DeliveryParcelFlow');
       setNavigating(true);
       
       try {
           navigation.navigate('DeliveryParcelFlow');
           console.log('[DeliveryHomeScreen] ✅ Navigation réussie vers DeliveryParcelFlow');
       } catch (error: any) {
           console.error('[DeliveryHomeScreen] ❌ Erreur navigation:', error);
           Alert.alert('Erreur', 'Impossible d\'ouvrir le flux colis.');
           setNavigating(false);
       }
   }, [navigation, navigating]);
   ```

2. **Vérifier que `handleStartShopping` navigue vers `DeliveryShoppingFlow`** (déjà fait)

---

### Étape 4 : Ajouter routes dans `AppNavigator.tsx`

**Routes à ajouter** :
```typescript
// Dans SecondaryStack ou DeliveryStack
<Stack.Screen 
    name="DeliveryShoppingFlow" 
    component={DeliveryShoppingFlow}
    options={{ title: 'Courses supermarché' }}
/>
<Stack.Screen 
    name="DeliveryParcelFlow" 
    component={DeliveryParcelFlow}
    options={{ title: 'Livraison de colis' }}
/>
```

---

### Étape 5 : Service API pour supermarchés

**Créer** : `mobile/src/services/supermarketService.ts`

```typescript
export interface Supermarket {
    id: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    distance_km?: number;
    opening_hours?: string;
    phone?: string;
}

export const supermarketService = {
    // Récupérer liste des supermarchés disponibles
    getAvailableSupermarkets: async (lat?: number, lng?: number): Promise<Supermarket[]> => {
        // TODO: Appeler API backend pour récupérer supermarchés
        // Endpoint: GET /api/supermarkets?lat={lat}&lng={lng}
        // Pour l'instant, retourner liste mockée ou vide
        return [];
    },
    
    // Rechercher produits dans un supermarché
    searchProducts: async (supermarketId: string, query: string) => {
        // TODO: Appeler API backend ou API externe du supermarché
        // Endpoint: GET /api/supermarkets/{id}/products?query={query}
        return [];
    },
};
```

**Note** : Les APIs de supermarchés doivent être configurées dans le backend. Pour l'instant, on peut utiliser une liste mockée ou une intégration basique.

---

### Étape 6 : Utiliser `createDeliveryRequest` existant

**Service** : `mobile/src/services/api.ts` → `deliveryApi.createDeliveryRequest`

**Exemple d'utilisation** :
```typescript
import { deliveryApi, CreateDeliveryRequestPayload } from '../services/api';

const createShoppingDelivery = async (data: ShoppingDeliveryData) => {
    const payload: CreateDeliveryRequestPayload = {
        parcel: {
            type_id: 1, // ou enum approprié
            notes: `Courses supermarché: ${data.supermarketName}`,
            metadata: {
                supermarket_id: data.supermarketId,
                basket_items: data.basketItems,
                basket_total: data.total
            }
        },
        pickup: {
            latitude: data.pickupLat,
            longitude: data.pickupLng,
            address: data.pickupAddress
        },
        dropoff: {
            latitude: data.dropoffLat,
            longitude: data.dropoffLng,
            address: data.dropoffAddress
        },
        metadata: {
            kind: 'shopping',
            supermarket_id: data.supermarketId
        }
    };
    
    const result = await deliveryApi.createDeliveryRequest(payload);
    return result;
};
```

---

## ✅ Checklist d'Implémentation

### Phase 1 : Écrans de base
- [ ] Créer `DeliveryShoppingFlow.tsx` avec structure de base
- [ ] Créer `DeliveryParcelFlow.tsx` avec structure de base
- [ ] Ajouter routes dans `AppNavigator.tsx`
- [ ] Tester navigation depuis `DeliveryHomeScreen`

### Phase 2 : DeliveryShoppingFlow
- [ ] Implémenter sélection supermarché (liste + recherche)
- [ ] Implémenter composition panier
- [ ] Implémenter sélection points pickup/drop (avec GPS)
- [ ] Implémenter création livraison avec `createDeliveryRequest`
- [ ] Gérer erreurs et validation
- [ ] Navigation vers tracking après création

### Phase 3 : DeliveryParcelFlow
- [ ] Implémenter formulaire informations colis
- [ ] Implémenter upload photos colis
- [ ] Implémenter sélection points pickup/drop (avec GPS)
- [ ] Implémenter support déménagement
- [ ] Implémenter création livraison avec `createDeliveryRequest`
- [ ] Gérer erreurs et validation
- [ ] Navigation vers tracking après création

### Phase 4 : Intégration APIs
- [ ] Créer `supermarketService.ts`
- [ ] Intégrer APIs supermarchés (ou mock pour l'instant)
- [ ] Tester création livraisons end-to-end

### Phase 5 : Tests et améliorations
- [ ] Tester tous les flux
- [ ] Vérifier affichage adresses textuelles (pas GPS)
- [ ] Vérifier gestion erreurs
- [ ] Améliorer UX (loading states, confirmations, etc.)

---

## 📝 Notes Importantes

1. **Différence avec workflow "Se faire livrer"** :
   - Le workflow "Livraison" n'utilise **PAS** le système de préparation de produits
   - Pas de vérification disponibilité
   - Pas de validation prestataire
   - Matching coursier démarre directement après création

2. **Affichage adresses** :
   - **TOUJOURS** afficher adresses textuelles (ex: "123 Rue de la Paix, Douala")
   - **JAMAIS** afficher coordonnées GPS brutes (ex: "4.0500, 9.7000")
   - Utiliser geocoding inverse si nécessaire

3. **APIs supermarchés** :
   - Les APIs doivent être configurées dans le backend
   - Pour l'instant, on peut utiliser une liste mockée ou une intégration basique
   - L'utilisateur a mentionné que les APIs sont "intégrées ou du moins configurées"

4. **Support déménagement** :
   - Le système doit supporter les déménagements
   - Ajouter champs spécifiques dans `parcel.constraints`

---

## 🔗 Références

- `ANALYSE_WORKFLOW_LIVRAISON_AMELIORATIONS.md` : Workflow "Se faire livrer"
- `PROMPT_IMPLEMENTATION_AMELIORATIONS_LIVRAISON.md` : Détails implémentation
- `backend/src/services/delivery_service.rs` : Service `create_delivery_request`
- `mobile/src/services/api.ts` : API `deliveryApi.createDeliveryRequest`
- `mobile/src/screens/delivery/DeliveryHomeScreen.tsx` : Écran d'accueil livraison

---

**Date de création** : 2025-01-20  
**Version** : 1.0

