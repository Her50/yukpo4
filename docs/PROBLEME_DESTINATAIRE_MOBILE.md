# Problème : Informations du Destinataire Manquantes dans l'Interface Mobile

## 🔍 Problème Identifié

Dans l'écran de création de livraison mobile (`DeliveryParcelFlowNew.tsx`), **il n'y a pas d'étape pour renseigner les informations du destinataire**.

### État Actuel

Le formulaire a 3 étapes :
1. ✅ **Informations du colis** (type, poids, volume, valeur, notes, photos)
2. ✅ **Adresse de collecte** (pickup location)
3. ✅ **Adresse de livraison** (dropoff location)

**Manque** : Une étape pour renseigner les informations du destinataire (nom, téléphone, etc.)

### Code Actuel

Dans `DeliveryParcelFlowNew.tsx` (lignes 202-229), le payload créé ne contient **pas** de champ `recipient` :

```typescript
const payload: CreateDeliveryRequestPayload = {
    preferred_vehicle_type: transportMode || undefined,
    parcel: { ... },
    pickup: { ... },
    dropoff: { ... },
    metadata: { ... },
    initial_event_payload: {},
    // ❌ recipient manquant !
};
```

### Type Attendu

Le type `CreateDeliveryRequestPayload` (défini dans `mobile/src/services/api.ts`) accepte un champ `recipient` optionnel :

```typescript
export interface CreateDeliveryRequestPayload {
  preferred_vehicle_type?: string;
  parcel: DeliveryParcelInput;
  pickup: DeliveryLocationInput;
  dropoff: DeliveryLocationInput;
  distance_meters?: number;
  estimated_duration_seconds?: number;
  metadata?: Record<string, unknown>;
  initial_event_payload?: Record<string, unknown>;
  recipient?: DeliveryRecipientPayload; // ← Optionnel mais devrait être renseigné
}
```

## ✅ Solution Proposée

Ajouter une **4ème étape** dans le formulaire pour renseigner les informations du destinataire :

1. **Informations du colis**
2. **Adresse de collecte**
3. **Adresse de livraison**
4. **🆕 Informations du destinataire** (nom, téléphone, notes)

### Champs à Ajouter

- `recipient.contact_name` (nom du destinataire)
- `recipient.contact_phone` (téléphone - obligatoire)
- `recipient.notes` (notes pour le coursier - optionnel)
- `recipient.user_id` (si le destinataire est un utilisateur de l'app - optionnel)

### Alternative : Destinataire Automatique

Si le destinataire n'est pas renseigné, le backend pourrait :
- Utiliser les informations de l'utilisateur créateur par défaut
- Ou permettre d'assigner le destinataire plus tard via `assignRecipient`

## 📝 Impact

**Actuellement** : Les livraisons sont créées **sans destinataire**, donc :
- Le matching ne se déclenche pas (problème corrigé précédemment)
- Le destinataire doit être assigné plus tard via `assignRecipient`

**Avec la correction** : Les livraisons seront créées **avec un destinataire**, donc :
- Le matching se déclenche immédiatement
- Le coursier peut contacter le destinataire directement

