# ✅ Solution : Calcul du Coût de Livraison par Type d'Engin

## 🎯 Problème Résolu

Le calcul actuel utilisait une formule fixe : **500 FCFA/km (minimum 1000 FCFA)** sans tenir compte du type d'engin utilisé.

## 💡 Solution Implémentée

### 1. Table de Configuration `delivery_engine_pricing`

**Structure** :
- `engine_type` : Type d'engin (PK)
- `cost_per_km_fcfa` : Coût par kilomètre en FCFA
- `minimum_cost_fcfa` : Coût minimum garanti
- `fuel_consumption_l_per_km` : Consommation carburant (optionnel, pour info)
- `description` : Description du type d'engin

### 2. Valeurs par Défaut Réalistes

| Type d'Engin | Coût/km | Minimum | Consommation | Description |
|--------------|---------|---------|--------------|-------------|
| **Pieton** | 200 FCFA | 500 FCFA | - | Livraison à pied |
| **VeloCargo** | 300 FCFA | 800 FCFA | - | Vélo cargo |
| **Scooter** | 400 FCFA | 1000 FCFA | 0.030 L/km | Scooter (~3L/100km) |
| **Moto** | 450 FCFA | 1000 FCFA | 0.040 L/km | Moto (~4L/100km) |
| **Voiture** | 600 FCFA | 1500 FCFA | 0.080 L/km | Voiture (~8L/100km) |
| **Camionnette** | 700 FCFA | 2000 FCFA | 0.100 L/km | Camionnette (~10L/100km) |
| **CamionLeger** | 900 FCFA | 3000 FCFA | 0.120 L/km | Camion léger (~12L/100km) |
| **Autre** | 500 FCFA | 1000 FCFA | - | Autre type |

### 3. Calcul Dynamique

**Formule** :
```
coût = max(distance_km × cost_per_km_fcfa, minimum_cost_fcfa)
```

**Exemple** :
- Distance : 5 km
- Type : Moto
- Calcul : `max(5 × 450, 1000) = 2250 FCFA`

### 4. Service `DeliveryEnginePricingService`

**Fonctionnalités** :
- ✅ Récupérer configuration par type d'engin
- ✅ Calculer coût pour distance donnée
- ✅ Mettre à jour les prix (admin)
- ✅ Fallback si configuration absente

### 5. Intégration dans `estimate_delivery_costs`

**Logique** :
1. Récupérer `preferred_vehicle_type` depuis le payload
2. Mapper vers `DeliveryEngineType`
3. Utiliser `DeliveryEnginePricingService` pour calculer
4. Fallback sur moto si non spécifié

## 📊 Avantages de cette Solution

### ✅ Réaliste
- Prend en compte les coûts réels (carburant, maintenance)
- Différencie les types d'engins selon leur consommation

### ✅ Paramétrable
- Admin peut ajuster les prix sans code
- Facile d'ajouter de nouveaux types d'engins

### ✅ Simple
- Pas de calcul complexe (chevaux, etc.)
- Formule claire : `distance × coût/km` avec minimum

### ✅ Applicable
- Migration automatique avec valeurs par défaut
- Fallback si configuration absente
- Compatible avec l'existant

## 🔧 Utilisation

### Frontend/Mobile

```typescript
// Dans OrderDeliveryModal
const payload = {
  service_id: 1,
  product_index: 0,
  dropoff: { latitude: 4.0511, longitude: 9.7679 },
  preferred_vehicle_type: "moto" // ou "scooter", "car", etc.
};

const response = await fetch('/api/delivery/estimate-costs', {
  method: 'POST',
  body: JSON.stringify(payload)
});
```

### Admin (Mise à jour des prix)

```rust
let pricing_service = DeliveryEnginePricingService::new(pool);
pricing_service.update_pricing_config(
    DeliveryEngineType::Moto,
    500.0,  // Nouveau coût/km
    1200.0, // Nouveau minimum
    Some(0.045), // Nouvelle consommation
    Some("Moto - Prix mis à jour".to_string())
).await?;
```

## 📈 Évolution Future

### Option 1 : Calcul par Carburant (Plus Complexe)
- Prix carburant en temps réel
- Consommation par engin
- Calcul : `distance × consommation × prix_carburant + marge`

### Option 2 : Facteurs Multiplicateurs
- Base : coût/km
- Multiplicateurs : poids, volume, urgence, terrain
- Calcul : `base × poids_factor × volume_factor × ...`

### Option 3 : Zones de Prix
- Coûts différents par zone géographique
- Table `delivery_zone_pricing`

**Pour l'instant, la solution simple est la meilleure !** ✅

---

**Créé le 2025-01-27**

