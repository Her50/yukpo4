# ✅ Implémentation : Reversement Frais de Livraison aux Coursiers

## 🎯 Objectif

Implémenter le reversement automatique des frais de livraison aux coursiers après complétion d'une livraison, avec commission Yukpo déduite.

## 📋 Modifications

### 1. ✅ Fonction `payout_courier` dans `DeliveryPaymentService`

**Fichier** : `backend/src/services/delivery_payment_service.rs`

**Fonctionnalités** :
- Récupère `delivery_cost_cents` depuis `delivery_payment_reservations`
- Calcule commission Yukpo (5% par défaut, configurable via `YUKPO_COMMISSION_RATE`)
- Calcule payout coursier = `delivery_cost_cents - commission`
- Récupère le compte de paiement du coursier depuis `courier_applications.profile_data->paymentMethod`
- Utilise `PaymentMatchingService` pour déterminer le mode de reversement optimal
- Effectue le reversement (wallet interne, MTN Money, Orange Money)
- Stocke les métadonnées dans `delivery_payment_reservations.metadata->courier_payout`

**Code** :
```rust
pub async fn payout_courier(
    &self,
    delivery_id: Uuid,
    courier_user_id: i32,
) -> AppResult<()> {
    // Récupère delivery_cost_cents
    // Calcule commission (5%)
    // Calcule payout = delivery_cost - commission
    // Récupère compte de paiement coursier
    // Effectue reversement via PaymentMatchingService
    // Stocke métadonnées
}
```

### 2. ✅ Fonction `get_courier_payment_method`

**Fichier** : `backend/src/services/delivery_payment_service.rs`

**Fonctionnalités** :
- Récupère le compte de paiement depuis `courier_applications.profile_data->paymentMethod`
- Fallback vers `users.payment_methods` si non trouvé
- Fallback final : wallet interne
- Convertit au format attendu par `PaymentMatchingService`

### 3. ✅ Intégration dans Workflow Livraison

**Fichier** : `backend/src/routes/delivery_routes.rs`

**Modification** : Dans `update_delivery_status`, quand le statut passe à `Delivered` :

```rust
// Produit accepté : Reverser au prestataire avec commission
let merchant_user_id = summary.creator_id;
if let Err(e) = payment_service.payout_merchant(delivery_id, merchant_user_id).await {
    log::error!("Erreur reversement prestataire...");
}

// ✅ NOUVEAU : Reverser les frais de livraison au coursier
if let Some(courier_id) = summary.courier_id {
    // Récupérer user_id du coursier
    let courier_user_id = ...;
    if let Err(e) = payment_service.payout_courier(delivery_id, courier_user_id).await {
        log::error!("Erreur reversement coursier...");
    }
}
```

## 💰 Calcul du Reversement

**Formule** :
```
delivery_cost_cents = coût de livraison (selon type d'engin et distance)
commission_rate = 5% (configurable via YUKPO_COMMISSION_RATE)
delivery_commission_cents = delivery_cost_cents × commission_rate
courier_payout_cents = delivery_cost_cents - delivery_commission_cents
```

**Exemple** :
- Livraison : 5 km avec Moto = 1125 FCFA (max(5×225, 1000))
- Commission : 1125 × 5% = 56.25 FCFA
- **Payout coursier** : 1125 - 56 = **1069 FCFA**

## 🔄 Flux Complet

1. **Client paie** → Réservation créée dans `delivery_payment_reservations`
2. **Coursier accepte** → Livraison assignée
3. **Livraison complétée** → Statut passe à `Delivered`
4. **Reversement automatique** :
   - Prestataire : `product_price - commission_produit`
   - **Coursier** : `delivery_cost - commission_livraison` ✅ **NOUVEAU**

## 📊 Stockage Métadonnées

**Table** : `delivery_payment_reservations.metadata`

**Structure** :
```json
{
  "delivery_commission_cents": 56,
  "courier_payout": {
    "courier_user_id": 123,
    "courier_payout_cents": 1069,
    "delivery_commission_cents": 56,
    "courier_payment_method": {
      "type": "wallet_internal",
      "phone": "...",
      "verified": true
    },
    "payout_method_used": "wallet_internal",
    "paid_at": "2025-01-27T..."
  }
}
```

## 🔐 Comptes de Paiement Coursier

**Source** :
1. `courier_applications.profile_data->paymentMethod` (priorité)
2. `users.payment_methods` (fallback)
3. Wallet interne (fallback final)

**Format** :
```json
{
  "type": "mobile_money" | "orange_money" | "carte_bancaire",
  "phoneNumber": "+237...",
  "cardNumber": "...",
  ...
}
```

## ✅ Checklist

- [x] Fonction `payout_courier` implémentée
- [x] Fonction `get_courier_payment_method` implémentée
- [x] Intégration dans workflow `Delivered`
- [x] Calcul commission correct
- [x] Stockage métadonnées
- [x] Logs pour traçabilité
- [x] Gestion erreurs
- [x] Compilation OK

## 🚀 Prochaines Étapes

1. **Tests** : Tester le reversement avec différents types d'engins
2. **Monitoring** : Ajouter métriques Prometheus pour reversements coursiers
3. **Notifications** : Notifier le coursier quand le reversement est effectué
4. **API Mobile Money** : Intégrer les APIs MTN/Orange Money quand disponibles

---

**Date** : 2025-01-27

