# ✅ Corrections Format Backend - Livraison

## Problèmes identifiés et corrigés

### 1. **Endpoint incorrect**
- ❌ **Avant** : Frontend utilisait `/api/delivery/request` (n'existe pas)
- ✅ **Après** : Frontend utilise `/api/delivery` (endpoint existant)

### 2. **Format de réponse backend**
- ❌ **Avant** : Frontend/mobile s'attendait à `{ id, status, kind }` directement
- ✅ **Après** : Extraction correcte depuis `{ "delivery": DeliverySummary }`
  - Frontend : `delivery.id`, `delivery.status`, `delivery.metadata.kind`
  - Mobile : Même logique dans `deliveryApi.createDeliveryRequest()`

### 3. **Champs manquants ou undefined**
- ❌ **Avant** : `photos` pouvait être `undefined` si vide
- ✅ **Après** : `photos` est toujours un tableau (même vide : `[]`)

- ❌ **Avant** : `constraints` pouvait être `undefined`
- ✅ **Après** : `constraints` est toujours un objet (même vide : `{}`)

- ❌ **Avant** : `initial_event_payload` n'était pas toujours présent
- ✅ **Après** : `initial_event_payload` est toujours un objet (même vide : `{}`)

### 4. **Métadonnées mal placées (Shopping Flow)**
- ❌ **Avant** : `parcel.metadata` contenait les infos du panier (n'existe pas dans le modèle backend)
- ✅ **Après** : Déplacé vers `metadata` au niveau racine (format attendu par le backend)

## Format backend attendu

```rust
CreateDeliveryPayload {
    parcel: ParcelPayload {
        type_id: Option<i32>,
        weight_kg: Option<f64>,
        volume_cm3: Option<f64>,
        declared_value: Option<f64>,
        notes: Option<String>,
        photos: Value,        // JSON Value (tableau ou objet)
        constraints: Value,  // JSON Value (objet)
    },
    pickup: LocationPayload {
        latitude: f64,
        longitude: f64,
        address: Option<String>,
    },
    dropoff: LocationPayload {
        latitude: f64,
        longitude: f64,
        address: Option<String>,
    },
    distance_meters: Option<i32>,
    estimated_duration_seconds: Option<i32>,
    metadata: Value,              // JSON Value (objet)
    initial_event_payload: Value,  // JSON Value (objet)
    recipient: Option<RecipientPayload>,
}
```

## Format réponse backend

```rust
// Backend retourne :
{
    "delivery": {
        "id": "uuid",
        "status": "requested",
        "metadata": {
            "kind": "parcel" | "shopping",
            ...
        },
        "shopping_required": bool,
        ...
    }
}
```

## Fichiers modifiés

### Frontend
- ✅ `frontend/src/services/deliveryApi.ts` - Normalisation payload + extraction réponse
- ✅ `frontend/src/pages/delivery/DeliveryParcelFlowPage.tsx` - Format photos/constraints
- ✅ `frontend/src/pages/delivery/DeliveryShoppingFlowPage.tsx` - Format photos/constraints + metadata

### Mobile
- ✅ `mobile/src/services/api.ts` - Normalisation payload + extraction réponse
- ✅ `mobile/src/screens/delivery/DeliveryParcelFlow.tsx` - Format photos/constraints
- ✅ `mobile/src/screens/delivery/DeliveryShoppingFlow.tsx` - Format photos/constraints + metadata

## Tests recommandés

1. ✅ Créer une livraison "parcel" depuis le frontend
2. ✅ Créer une livraison "parcel" depuis le mobile
3. ✅ Créer une livraison "shopping" depuis le frontend
4. ✅ Créer une livraison "shopping" depuis le mobile
5. ✅ Vérifier que la réponse contient bien `id`, `status`, `kind`
6. ✅ Vérifier que le tracking fonctionne après création

