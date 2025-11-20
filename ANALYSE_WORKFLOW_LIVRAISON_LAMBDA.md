# 📋 Analyse Détaillée : Workflow Livraison Lambda (Point A → Point B)

## 🎯 Contexte

Il existe **deux workflows distincts** de livraison dans l'application :

1. **Workflow "Se faire livrer"** : Client veut commander une marchandise (produit d'un service)
2. **Workflow "Livraison Lambda"** : Utilisateur veut livrer un colis quelconque (point A → point B)

---

## 📦 Workflow 1 : "Se faire livrer" (EXISTANT)

### Déclencheur
- Client clique sur bouton **"🚚 Se faire livrer"** dans `ProductCard.tsx`
- Ou depuis `ChatModalMobile.tsx` : "Commander avec livraison"

### Fichiers impliqués

#### 1. **`mobile/src/components/delivery/OrderDeliveryModal.tsx`** ⭐ COMPOSANT PRINCIPAL
**Fonctionnalités** :
- ✅ Sélection produits (multi-produits supporté)
- ✅ Point pickup : Automatique depuis configuration produit (`product_delivery_config`)
- ✅ Point dropoff : Sélection par utilisateur (GPS actuel ou adresse manuelle)
- ✅ Notes/instructions de livraison
- ✅ Préférences de livraison (date, heure, flexibilité)
- ✅ Calcul coûts (produit + livraison)
- ✅ Gestion promotions produits
- ✅ Prix négociés (via `conversationId`)

**API utilisée** :
```typescript
// Création commande avec produit
POST /api/delivery/client-order
{
  service_id: number,
  product_index: number,
  dropoff: { latitude, longitude, address },
  notes?: string,
  conversation_id?: number  // Pour prix négociés
}

// Estimation coûts
POST /api/delivery/estimate-costs
{
  service_id: number,
  product_index: number,
  dropoff: { latitude, longitude },
  conversation_id?: number
}

// Préférences livraison
POST /api/delivery/preferences
{
  delivery_id: string,
  preferred_delivery_date?: string,
  preferred_delivery_time_start?: string,
  preferred_delivery_time_end?: string,
  is_flexible: boolean,
  flexibility_window_days: number,
  urgency_level: 'standard' | 'urgent' | 'scheduled'
}
```

**Workflow backend** :
1. Vérification disponibilité produit (jour, stock, temps préparation)
2. Création `product_order` (statut: `pending`)
3. Notification prestataire
4. Validation prestataire → statut `validated`
5. Préparation → statut `preparing` → `ready`
6. Matching coursier → statut `courier_assigned`
7. Livraison → statut `delivered`

#### 2. **`mobile/src/components/ProductCard.tsx`**
- Affiche bouton "🚚 Se faire livrer" pour les produits
- Ouvre `OrderDeliveryModal` avec `serviceId` et `productIndex`

#### 3. **`mobile/src/components/ChatModalMobile.tsx`**
- Action rapide "Commander avec livraison"
- Ouvre `OrderDeliveryModal` avec contexte conversation

#### 4. **Backend : `backend/src/routes/delivery_routes.rs`**
- Route `POST /api/delivery/client-order` : Crée commande produit
- Route `POST /api/delivery/estimate-costs` : Estime coûts
- Route `POST /api/delivery/preferences` : Sauvegarde préférences

---

## 🚚 Workflow 2 : "Livraison Lambda" (À CRÉER)

### Déclencheur
- Utilisateur clique sur bouton **"Livraison"** dans l'en-tête de `HomeScreen.tsx`
- Navigation vers `DeliveryHomeScreen.tsx`
- Deux options :
  - **"Courses supermarché"** → `DeliveryShoppingFlow`
  - **"Nouveau flux colis"** → `DeliveryParcelFlow`

### Différences avec "Se faire livrer"

| Aspect | "Se faire livrer" | "Livraison Lambda" |
|--------|-------------------|-------------------|
| **Produit** | Oui (service_id + product_index) | Non (colis générique) |
| **Point pickup** | Automatique (config produit) | Manuel (utilisateur choisit) |
| **Point dropoff** | Manuel (utilisateur choisit) | Manuel (utilisateur choisit) |
| **Vérification disponibilité** | Oui | Non |
| **Validation prestataire** | Oui (workflow préparation) | Non |
| **Temps préparation** | Oui | Non |
| **Matching coursier** | Après "Ready" | Immédiat après création |
| **API** | `/api/delivery/client-order` | `/api/delivery` (createDeliveryRequest) |

### Fichiers à créer

#### 1. **`mobile/src/screens/delivery/DeliveryParcelFlow.tsx`** ⭐ NOUVEAU

**Fonctionnalités à implémenter** :
- ✅ **Informations colis** :
  - Type (document, paquet, déménagement)
  - Poids (kg)
  - Volume (cm³) - optionnel
  - Valeur déclarée - optionnel
  - Photos du colis (optionnel)
  - Notes
- ✅ **Point pickup** : Sélection manuelle (GPS ou adresse)
- ✅ **Point dropoff** : Sélection manuelle (GPS ou adresse)
- ✅ **Support déménagement** : Champs supplémentaires si type = "déménagement"
- ✅ **Création livraison** : Appel `deliveryApi.createDeliveryRequest`

**API utilisée** :
```typescript
// Création livraison lambda
POST /api/delivery
{
  parcel: {
    type_id?: number,
    weight_kg?: number,
    volume_cm3?: number,
    declared_value?: number,
    notes?: string,
    photos?: string[],
    constraints?: { is_moving?: boolean, ... }
  },
  pickup: {
    latitude: number,
    longitude: number,
    address: string
  },
  dropoff: {
    latitude: number,
    longitude: number,
    address: string
  },
  metadata: {
    kind: 'parcel',
    is_moving?: boolean
  }
}
```

#### 2. **`mobile/src/screens/delivery/DeliveryShoppingFlow.tsx`** ⭐ NOUVEAU

**Fonctionnalités à implémenter** :
- ✅ **Sélection supermarché** : Liste + recherche
- ✅ **Composition panier** : Ajout produits, quantités, prix
- ✅ **Point pickup** : Adresse supermarché (automatique)
- ✅ **Point dropoff** : Sélection manuelle
- ✅ **Création livraison** : Appel `deliveryApi.createDeliveryRequest`

**API utilisée** :
```typescript
// Création livraison shopping
POST /api/delivery
{
  parcel: {
    type_id: 'shopping',
    notes: 'Courses supermarché',
    metadata: {
      supermarket_id: string,
      basket_items: Array<{ name, quantity, price }>,
      basket_total: number
    }
  },
  pickup: {
    latitude: number,
    longitude: number,
    address: 'Adresse supermarché'
  },
  dropoff: {
    latitude: number,
    longitude: number,
    address: 'Adresse livraison'
  },
  metadata: {
    kind: 'shopping',
    supermarket_id: string
  }
}
```

---

## 🔄 Réutilisation Intelligente des Fichiers Existants

### ✅ Composants à RÉUTILISER (avec adaptations)

#### 1. **`OrderDeliveryModal.tsx`** → Base pour `DeliveryParcelFlow.tsx`

**Ce qui peut être réutilisé** :
- ✅ Structure UI (Modal, Header, ScrollView, Footer)
- ✅ Gestion GPS (chargement position actuelle)
- ✅ Sélection points pickup/dropoff
- ✅ Notes/instructions
- ✅ Préférences de livraison (date, heure, flexibilité)
- ✅ Styles (locationCard, section, etc.)

**Ce qui doit être ADAPTÉ** :
- ❌ Supprimer : Sélection produits (service_id, product_index)
- ❌ Supprimer : Calcul coûts produits
- ✅ Ajouter : Formulaire informations colis (type, poids, volume, photos)
- ✅ Ajouter : Support déménagement
- ✅ Modifier : API → `deliveryApi.createDeliveryRequest` au lieu de `/api/delivery/client-order`

**Exemple d'adaptation** :
```typescript
// OrderDeliveryModal.tsx (EXISTANT)
const handleSubmit = async () => {
  const response = await apiPost('/api/delivery/client-order', {
    service_id: serviceId,
    product_index: selectedProducts[0],
    dropoff: dropoffLocation,
    notes: notes
  });
};

// DeliveryParcelFlow.tsx (NOUVEAU - adapté)
const handleSubmit = async () => {
  const response = await deliveryApi.createDeliveryRequest({
    parcel: {
      type_id: parcelType,
      weight_kg: weight,
      volume_cm3: volume,
      notes: notes,
      photos: photos,
      constraints: { is_moving: type === 'déménagement' }
    },
    pickup: pickupLocation,
    dropoff: dropoffLocation,
    metadata: { kind: 'parcel', is_moving: type === 'déménagement' }
  });
};
```

#### 2. **Composants GPS** → Réutilisables tels quels

**Fichiers** :
- `mobile/src/components/ModernGPSModal.tsx` : Sélection GPS avec carte
- `mobile/src/contexts/LocationContext.tsx` : Contexte GPS global

**Utilisation** :
```typescript
// Dans DeliveryParcelFlow.tsx
import { useLocation } from '../../contexts/LocationContext';
import ModernGPSModal from '../../components/ModernGPSModal';

const { location } = useLocation();
// Utiliser pour pré-remplir pickup/dropoff
```

#### 3. **Composants Media** → Réutilisables pour photos colis

**Fichiers** :
- `mobile/src/components/MediaUploadManager.tsx` : Upload images/vidéos
- `mobile/src/utils/mediaCompression.ts` : Compression média

**Utilisation** :
```typescript
// Dans DeliveryParcelFlow.tsx
import MediaUploadManager from '../../components/MediaUploadManager';

<MediaUploadManager
  onImagesChange={(images) => setParcelPhotos(images)}
  maxImages={5}
  title="Photos du colis (optionnel)"
/>
```

#### 4. **Services API** → Réutilisables

**Fichiers** :
- `mobile/src/services/api.ts` : `deliveryApi.createDeliveryRequest`
- Types : `mobile/src/types/delivery.ts`

**Utilisation** :
```typescript
// Dans DeliveryParcelFlow.tsx
import { deliveryApi, CreateDeliveryRequestPayload } from '../../services/api';

const payload: CreateDeliveryRequestPayload = {
  parcel: { ... },
  pickup: { ... },
  dropoff: { ... },
  metadata: { kind: 'parcel' }
};

const result = await deliveryApi.createDeliveryRequest(payload);
```

#### 5. **Composants UI** → Réutilisables tels quels

**Fichiers** :
- `mobile/src/components/NativeDesign.tsx` : `NativeButton`, `NativeCard`, `NativeInput`
- `mobile/src/components/SafeIcon.tsx` : Icônes
- `mobile/src/theme/modernTheme.ts` : Couleurs, styles

**Utilisation** :
```typescript
// Dans DeliveryParcelFlow.tsx
import { NativeButton, NativeCard, NativeInput } from '../../components/NativeDesign';
import SafeIcon from '../../components/SafeIcon';
import { modernColors } from '../../theme/modernTheme';
```

---

## 📝 Structure Recommandée pour `DeliveryParcelFlow.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { Modal, ScrollView, View, Text, Alert } from 'react-native';
import { useLocation } from '../../contexts/LocationContext';
import { deliveryApi, CreateDeliveryRequestPayload } from '../../services/api';
import { NativeButton, NativeCard, NativeInput } from '../../components/NativeDesign';
import MediaUploadManager from '../../components/MediaUploadManager';
import ModernGPSModal from '../../components/ModernGPSModal';
import SafeIcon from '../../components/SafeIcon';

const DeliveryParcelFlow: React.FC = ({ visible, onClose, onSuccess }) => {
  const { location } = useLocation();
  
  // État colis
  const [parcelType, setParcelType] = useState<'document' | 'package' | 'moving'>('package');
  const [weight, setWeight] = useState<string>('');
  const [volume, setVolume] = useState<string>('');
  const [value, setValue] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  
  // État locations
  const [pickupLocation, setPickupLocation] = useState<Location | null>(null);
  const [dropoffLocation, setDropoffLocation] = useState<Location | null>(null);
  const [showPickupGPS, setShowPickupGPS] = useState(false);
  const [showDropoffGPS, setShowDropoffGPS] = useState(false);
  
  // État déménagement
  const [isMoving, setIsMoving] = useState(false);
  const [movingDetails, setMovingDetails] = useState({
    boxes: '',
    furniture: '',
    access: ''
  });
  
  // Charger GPS utilisateur au montage
  useEffect(() => {
    if (visible && location) {
      const coords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        address: '' // À remplir avec geocoding inverse
      };
      setDropoffLocation(coords);
    }
  }, [visible, location]);
  
  const handleSubmit = async () => {
    // Validation
    if (!pickupLocation || !dropoffLocation) {
      Alert.alert('Erreur', 'Veuillez sélectionner les points pickup et dropoff');
      return;
    }
    
    // Construire payload
    const payload: CreateDeliveryRequestPayload = {
      parcel: {
        type_id: parcelType === 'document' ? 1 : parcelType === 'package' ? 2 : 3,
        weight_kg: weight ? parseFloat(weight) : undefined,
        volume_cm3: volume ? parseFloat(volume) : undefined,
        declared_value: value ? parseFloat(value) : undefined,
        notes: notes || undefined,
        photos: photos.length > 0 ? photos : undefined,
        constraints: isMoving ? {
          is_moving: true,
          boxes: movingDetails.boxes,
          furniture: movingDetails.furniture,
          access: movingDetails.access
        } : undefined
      },
      pickup: {
        latitude: pickupLocation.latitude,
        longitude: pickupLocation.longitude,
        address: pickupLocation.address || ''
      },
      dropoff: {
        latitude: dropoffLocation.latitude,
        longitude: dropoffLocation.longitude,
        address: dropoffLocation.address || ''
      },
      metadata: {
        kind: 'parcel',
        is_moving: isMoving
      }
    };
    
    try {
      const result = await deliveryApi.createDeliveryRequest(payload);
      if (result.success && onSuccess) {
        onSuccess(result.data.id);
      }
      onClose();
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de créer la livraison');
    }
  };
  
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        {/* Header similaire à OrderDeliveryModal */}
        {/* Content avec sections : */}
        {/* 1. Informations colis */}
        {/* 2. Point pickup */}
        {/* 3. Point dropoff */}
        {/* 4. Déménagement (si type = moving) */}
        {/* 5. Notes */}
        {/* Footer avec boutons */}
      </View>
    </Modal>
  );
};
```

---

## ✅ Checklist de Réutilisation

### Composants UI
- [x] `NativeButton`, `NativeCard`, `NativeInput` → Réutilisables
- [x] `SafeIcon` → Réutilisable
- [x] `ModernGPSModal` → Réutilisable
- [x] `MediaUploadManager` → Réutilisable (pour photos colis)

### Services
- [x] `deliveryApi.createDeliveryRequest` → Réutilisable
- [x] `LocationContext` → Réutilisable
- [x] `mediaCompression` → Réutilisable

### Styles
- [x] `modernTheme` → Réutilisable
- [x] Styles de `OrderDeliveryModal` → Adaptables

### Logique
- [x] Gestion GPS → Réutilisable
- [x] Validation formulaires → Adaptable
- [x] Gestion erreurs → Réutilisable

### À créer
- [ ] `DeliveryParcelFlow.tsx` (basé sur `OrderDeliveryModal.tsx`)
- [ ] `DeliveryShoppingFlow.tsx` (nouveau)
- [ ] Service `supermarketService.ts` (pour sélection supermarchés)

---

## 🎯 Résumé

### Workflow "Se faire livrer" (EXISTANT)
- **Fichier principal** : `OrderDeliveryModal.tsx`
- **API** : `/api/delivery/client-order`
- **Spécificité** : Produit (service_id + product_index), validation prestataire, temps préparation

### Workflow "Livraison Lambda" (À CRÉER)
- **Fichiers à créer** : `DeliveryParcelFlow.tsx`, `DeliveryShoppingFlow.tsx`
- **API** : `/api/delivery` (createDeliveryRequest)
- **Spécificité** : Colis générique, pas de validation prestataire, matching immédiat

### Réutilisation
- **~70% du code** de `OrderDeliveryModal.tsx` peut être réutilisé
- **Composants GPS, Media, UI** : 100% réutilisables
- **Services API** : 100% réutilisables
- **Adaptations nécessaires** : Supprimer logique produits, ajouter formulaire colis

---

**Date de création** : 2025-01-20  
**Version** : 1.0

