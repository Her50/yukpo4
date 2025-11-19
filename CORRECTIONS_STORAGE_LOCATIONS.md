# Corrections à apporter pour StorageLocationsScreen et api.ts

## Erreurs probables identifiées

### 1. mobile/src/services/api.ts
- `listDeliveryZones` doit retourner un tableau de `DeliveryZone`
- Vérifier que la structure de réponse correspond au type attendu

### 2. mobile/src/screens/delivery/StorageLocationsScreen.tsx
- Vérifier l'import de `deliveryApi`
- Vérifier l'utilisation de `listDeliveryZones()`
- Vérifier le typage de `zones` state
- Vérifier l'utilisation de `zone_id` dans les fonctions

### 3. frontend/src/pages/delivery/StorageLocationsPage.tsx
- Vérifier l'import de `listDeliveryZones`
- Vérifier le typage de `zones` state

