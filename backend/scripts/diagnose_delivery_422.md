# 🔍 Diagnostic Erreur 422 - Création Commande Livraison

## Problème
Erreur 422 lors de l'appel `POST /api/delivery/client-order`

## Causes Possibles

### 1. Configuration de livraison incomplète (LE PLUS PROBABLE)
**Symptôme** : Le produit existe mais la configuration de livraison n'est pas complète.

**Vérification SQL** :
```sql
SELECT 
    service_id, 
    product_index, 
    is_configured,
    pickup_address,
    pickup_latitude,
    pickup_longitude,
    required_vehicle_type_id
FROM product_delivery_config
WHERE service_id = <SERVICE_ID> 
  AND product_index = <PRODUCT_INDEX>;
```

**Solution** : Le prestataire doit compléter la configuration via `/api/delivery/product-config`

### 2. Service non trouvé
**Vérification SQL** :
```sql
SELECT id, is_active, gps 
FROM services 
WHERE id = <SERVICE_ID> AND is_active = true;
```

### 3. GPS invalide
**Vérification SQL** :
```sql
-- GPS du service
SELECT id, gps FROM services WHERE id = <SERVICE_ID>;

-- GPS de l'utilisateur
SELECT id, gps FROM users WHERE id = <USER_ID>;
```

Le format attendu est : `"longitude,latitude"` (ex: `"11.5021,3.8480"`)

### 4. Dropoff manquant
**Vérification** : Dans le payload mobile, vérifier que `dropoff` contient :
```json
{
  "latitude": 3.8480,
  "longitude": 11.5021,
  "address": "Adresse complète" // optionnel
}
```

## Actions Correctives

### Pour le prestataire (configuration produit)
1. Accéder à l'interface de configuration du produit
2. Remplir tous les champs obligatoires :
   - Adresse de pickup (pickup_address, pickup_latitude, pickup_longitude)
   - Type de véhicule requis (required_vehicle_type_id)
   - Poids et volume si applicable
   - Marquer `is_configured = true`

### Pour le développeur (amélioration UX)
1. **Améliorer le message d'erreur** : Retourner un message plus clair indiquant exactement ce qui manque
2. **Vérification préalable** : Vérifier la configuration avant d'afficher le bouton "Me livrer"
3. **Fallback automatique** : Si configuration incomplète, utiliser les données du service comme fallback

## Code à Vérifier

### Backend - `backend/src/routes/delivery_routes.rs` ligne 1158-1165
```rust
// ✅ 2. Vérifier si configuration complète
if let Some(config) = &delivery_config {
    if !config.is_configured.unwrap_or(false) {
        return Err(crate::core::types::AppError::BadRequest(
            "Configuration de livraison incomplète pour ce produit. Le prestataire doit compléter la configuration.".into(),
        ));
    }
}
```

**Note** : Cette erreur retourne `BadRequest` (400), pas 422. Si vous recevez 422, cela peut venir :
- D'un middleware qui convertit certaines erreurs
- D'une erreur de désérialisation JSON (Axum peut retourner 422 dans certains cas)

### Mobile - `mobile/src/components/delivery/OrderDeliveryModal.tsx` ligne 460
```typescript
if (!serviceId || typeof serviceId !== 'number' || serviceId <= 0 || selectedProducts.length === 0 || !dropoffLocation) {
    Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires');
    return;
}
```

## Logs à Vérifier

Dans les logs fournis, chercher :
- `[create_client_order]` pour voir l'erreur exacte
- Les requêtes SQL vers `product_delivery_config`
- Les erreurs de validation

## Test Rapide

```bash
# Vérifier la configuration d'un produit
curl -X GET "https://yukpomnang.onrender.com/api/delivery/product-config/<SERVICE_ID>/<PRODUCT_INDEX>" \
  -H "Authorization: Bearer <TOKEN>"

# Vérifier la disponibilité
curl -X GET "https://yukpomnang.onrender.com/api/delivery/product-availability/<SERVICE_ID>/<PRODUCT_INDEX>" \
  -H "Authorization: Bearer <TOKEN>"
```


