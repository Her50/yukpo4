# 💰 Documentation : Calcul du Coût de Livraison

## 📊 Vue d'ensemble

Le système de calcul des coûts de livraison Yukpomnang est composé de **deux parties principales** :

1. **Prix du produit** (avec promotions et prix négociés)
2. **Coût de livraison** (basé sur la distance)

---

## 1️⃣ Calcul du Prix du Produit

### Endpoint
```
POST /api/delivery/estimate-costs
```

### Logique de Calcul

Le prix du produit est récupéré via `ProductPriceService::get_real_product_price_cents()` qui prend en compte :

1. **Prix de base** : `product.price` ou `product.prix` ou `product.prix_produit`
2. **Promotions actives** :
   - Vérification `promotionActive = true`
   - Vérification date de fin (`promotionDateFin`)
   - Application selon `promotionValeur` :
     - Pourcentage : `"-20%"` → `prix * (1 - 20/100)`
     - Réduction fixe : `"-500 FCFA"` → `prix - 500`
     - Prix fixe : `"1000 FCFA"` → `1000`
3. **Prix négociés** (si `conversation_id` fourni) :
   - Recherche dans `negotiated_prices` table
   - Priorité : Prix négocié > Prix promotion > Prix de base
4. **Prix réduit** : `product.discounted_price` si disponible

### Exemple
```rust
// Produit avec prix de base 5000 FCFA
// Promotion active : "-20%"
// Prix final = 5000 * 0.8 = 4000 FCFA = 400000 centimes
```

---

## 2️⃣ Calcul du Coût de Livraison

### Formule

```rust
// 1. Calculer la distance (formule Haversine)
distance_km = haversine_distance(pickup, dropoff) / 1000.0

// 2. Calculer le coût
estimated_cost_fcfa = (distance_km * 500.0).max(1000.0)

// 3. Convertir en centimes
delivery_cost_cents = (estimated_cost_fcfa * 100.0) as i64
```

### Détails

**Formule Haversine** :
```rust
pub fn haversine_distance(pos1: (f64, f64), pos2: (f64, f64)) -> f64 {
    const EARTH_RADIUS_KM: f64 = 6371.0;
    let (lat1, lon1) = (pos1.0.to_radians(), pos1.1.to_radians());
    let (lat2, lon2) = (pos2.0.to_radians(), pos2.1.to_radians());
    
    let dlat = lat2 - lat1;
    let dlon = lon2 - lon1;
    
    let a = (dlat / 2.0).sin().powi(2)
        + lat1.cos() * lat2.cos() * (dlon / 2.0).sin().powi(2);
    let c = 2.0 * a.sqrt().asin();
    
    EARTH_RADIUS_KM * c * 1000.0 // Retourne en mètres
}
```

**Tarification** :
- **500 FCFA par kilomètre**
- **Minimum 1000 FCFA** (même pour très courte distance)
- Distance calculée en ligne droite (Haversine)

### Exemples

| Distance | Calcul | Coût Livraison |
|----------|--------|----------------|
| 0.5 km   | `max(0.5 * 500, 1000)` | 1000 FCFA |
| 2 km     | `2 * 500` | 1000 FCFA |
| 5 km     | `5 * 500` | 2500 FCFA |
| 10 km    | `10 * 500` | 5000 FCFA |

---

## 3️⃣ Modes de Facturation (Billing Mode)

### `standard` (Par défaut)
- **Client paie** : Produit + Livraison
- **Total** : `product_price_cents + delivery_cost_cents`

### `merchant_inclusive`
- **Client paie** : Produit uniquement
- **Prestataire paie** : Livraison
- **Total client** : `product_price_cents`
- **Livraison gratuite** : `is_delivery_free = true`

### `partner`
- Mode partenaire (à définir selon besoins)

---

## 4️⃣ Calcul du Total

```rust
let total_cents = product_price_cents + if is_delivery_free { 0 } else { delivery_cost_cents };
```

### Exemple Complet

**Scénario** :
- Produit : 5000 FCFA (avec promotion -20% = 4000 FCFA)
- Distance : 3 km
- Billing mode : `standard`

**Calcul** :
1. Prix produit : 4000 FCFA = 400000 centimes
2. Coût livraison : `3 * 500 = 1500 FCFA` = 150000 centimes
3. Total : `400000 + 150000 = 550000 centimes` = 5500 FCFA

---

## 5️⃣ Réservation de Paiement

Avant le matching des coursiers, le système :

1. **Vérifie le solde** du client
2. **Crée une réservation** dans `delivery_payment_reservations`
3. **Débite immédiatement** le portefeuille
4. **Rembourse** si le coursier refuse

### Structure Réservation

```sql
delivery_payment_reservations (
    delivery_id UUID,
    user_id INTEGER,
    product_price_cents BIGINT,
    delivery_cost_cents BIGINT,
    total_amount_cents BIGINT,
    billing_mode TEXT,
    merchant_pays_delivery BOOLEAN,
    reservation_status TEXT, -- 'reserved', 'debited', 'released', 'refunded'
    client_payment_method JSONB
)
```

---

## 6️⃣ Mise à Jour du Pricing

Le pricing peut être mis à jour après création via :

```
POST /api/delivery/{id}/pricing
```

**Composants** :
- `base_price_cents` : Frais de base
- `distance_price_cents` : Frais selon distance
- `surcharge_cents` : Surcharges (urgence, etc.)
- `discount_cents` : Réductions
- `shopping_cost_cents` : Coût courses (si shopping)
- `shopping_discount_cents` : Réduction courses

**Total final** :
```rust
total = base_price_cents 
      + distance_price_cents 
      + surcharge_cents 
      - discount_cents 
      + shopping_cost_cents 
      - shopping_discount_cents
```

---

## 7️⃣ Recalcul Automatique

Si le dropoff change après création :

1. **Recalcul distance** (Haversine ou Google Maps API si disponible)
2. **Recalcul coût livraison** : `(distance_km * 500).max(1000)`
3. **Mise à jour pricing** automatique
4. **Notification** au client et coursier

---

## 📝 Notes Importantes

1. **Distance en ligne droite** : Le calcul utilise Haversine (distance géodésique), pas la distance routière réelle
2. **Minimum garanti** : 1000 FCFA même pour très courte distance
3. **Promotions** : Vérification automatique des dates de validité
4. **Prix négociés** : Priorité sur promotions si conversation_id fourni
5. **Billing mode** : Défini dans `product_delivery_config` par le prestataire

---

## 🔄 Évolution Future

**TODO** :
- [ ] Intégration Google Maps Distance Matrix API pour distance routière réelle
- [ ] Tarification dynamique selon type véhicule
- [ ] Tarification selon heure (surge pricing)
- [ ] Tarification selon zone (zones premium)
- [ ] Tarification selon poids/volume colis

---

**Documentation générée le 2025-01-27**

