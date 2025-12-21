# Résumé : Problème Destinataire dans l'Interface Mobile

## 🔍 Problème Identifié

Dans l'écran de création de livraison (`DeliveryParcelFlowNew.tsx`), **il n'y a pas d'étape pour renseigner les informations du destinataire**.

### État Actuel du Formulaire

Le formulaire a **3 étapes** :
1. ✅ **Informations du colis** (type, poids, volume, valeur, notes, photos)
2. ✅ **Adresse de collecte** (pickup location)
3. ✅ **Adresse de livraison** (dropoff location)

**❌ Manque** : Une étape pour renseigner les informations du destinataire

### Structure Attendue

Le type `DeliveryRecipientPayload` (défini dans `mobile/src/types/delivery.ts`) attend :

```typescript
export interface DeliveryRecipientPayload {
    name: string;              // ✅ Obligatoire
    phone: string;             // ✅ Obligatoire
    countryCode?: string;      // Optionnel
    consentGranted: boolean;   // ✅ Obligatoire
    instructions?: string;     // Optionnel
    deliveryAccess?: string;   // Optionnel
    allowTracking?: boolean;   // Optionnel
}
```

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

## ✅ Solution

Ajouter une **4ème étape** dans le formulaire pour renseigner les informations du destinataire.

### Nouvelle Étape à Ajouter

**Étape 4 : Informations du destinataire**

Champs à ajouter :
- **Nom du destinataire** (`name`) - obligatoire
- **Téléphone** (`phone`) - obligatoire
- **Code pays** (`countryCode`) - optionnel (défaut: "+237" pour Cameroun)
- **Consentement** (`consentGranted`) - checkbox obligatoire
- **Instructions de livraison** (`instructions`) - optionnel (textarea)
- **Autoriser le suivi** (`allowTracking`) - checkbox optionnel

### Modifications à Apporter

1. **Ajouter les états** pour les champs du destinataire
2. **Créer le composant** `RecipientInfoStep`
3. **Ajouter l'étape** dans le tableau `steps`
4. **Inclure `recipient`** dans le payload lors de la soumission

## 📝 Impact

**Actuellement** :
- Les livraisons sont créées **sans destinataire**
- Le destinataire doit être assigné plus tard via `assignRecipient`
- Le matching ne se déclenche pas (problème corrigé précédemment, mais toujours pas de destinataire)

**Avec la correction** :
- Les livraisons seront créées **avec un destinataire**
- Le matching se déclenche immédiatement
- Le coursier peut contacter le destinataire directement
- Meilleure expérience utilisateur

## 🎯 Prochaines Étapes

1. Modifier `DeliveryParcelFlowNew.tsx` pour ajouter l'étape destinataire
2. Tester la création de livraison avec destinataire
3. Vérifier que le matching se déclenche correctement

