# 📊 Monitoring du Calcul des Coûts de Livraison

## ✅ Métriques Prometheus Ajoutées

### 1. Estimations de Coûts

- `delivery_estimate_cost_requests_total` : Nombre total de requêtes d'estimation
- `delivery_estimate_cost_duration_seconds` : Durée des estimations (histogramme)
- `delivery_estimate_cost_errors_total` : Nombre d'erreurs d'estimation

### 2. Coûts Calculés

- `delivery_cost_calculated_total` : Nombre de coûts de livraison calculés
- `delivery_cost_amount_cents_total` : Montant total des coûts (en centimes)
- `delivery_product_price_calculated_total` : Nombre de prix produits calculés
- `delivery_product_price_amount_cents_total` : Montant total des prix produits (en centimes)

### 3. Billing Modes

- `delivery_billing_mode_standard_total` : Commandes avec billing `standard`
- `delivery_billing_mode_merchant_inclusive_total` : Commandes avec livraison gratuite
- `delivery_billing_mode_partner_total` : Commandes avec billing `partner`

### 4. Distances

- `delivery_distance_km` : Distribution des distances (histogramme)
- `delivery_distance_short_total` : Livraisons < 1 km
- `delivery_distance_medium_total` : Livraisons 1-10 km
- `delivery_distance_long_total` : Livraisons > 10 km

### 5. Promotions

- `delivery_product_promotion_applied_total` : Promotions appliquées
- `delivery_product_promotion_discount_cents_total` : Montant total des réductions (en centimes)
- `delivery_negotiated_price_applied_total` : Prix négociés appliqués

### 6. Réservations Paiement

- `delivery_payment_reservation_created_total` : Réservations créées
- `delivery_payment_reservation_amount_cents_total` : Montant total réservé (en centimes)
- `delivery_payment_reservation_failed_total` : Réservations échouées
- `delivery_payment_reservation_failed_insufficient_balance_total` : Échecs solde insuffisant

## 📍 Endpoint Prometheus

Les métriques sont exposées via l'endpoint existant `/metrics/delivery` qui inclut maintenant toutes les métriques de pricing.

## 🔍 Exemples de Requêtes PromQL

```promql
# Taux d'erreur des estimations
rate(delivery_estimate_cost_errors_total[5m]) / rate(delivery_estimate_cost_requests_total[5m])

# Durée moyenne des estimations
rate(delivery_estimate_cost_duration_seconds_sum[5m]) / rate(delivery_estimate_cost_duration_seconds_count[5m])

# Distribution des distances
histogram_quantile(0.95, delivery_distance_km)

# Taux de promotions appliquées
rate(delivery_product_promotion_applied_total[5m]) / rate(delivery_product_price_calculated_total[5m])

# Taux d'échec des réservations
rate(delivery_payment_reservation_failed_total[5m]) / rate(delivery_payment_reservation_created_total[5m])
```

## 🎯 Points d'Instrumentation

1. **`estimate_delivery_costs`** (delivery_routes.rs)
   - Début/fin de requête
   - Calculs de coûts
   - Billing modes
   - Distances

2. **`ProductPriceService`** (product_price_service.rs)
   - Promotions appliquées
   - Prix négociés appliqués

3. **`DeliveryPaymentService::reserve_payment`** (delivery_payment_service.rs)
   - Réservations créées
   - Échecs (solde insuffisant)

## 📈 Dashboard Grafana Recommandé

1. **Vue d'ensemble** : Requêtes/min, taux d'erreur, durée moyenne
2. **Coûts** : Distribution des coûts, montants moyens
3. **Distances** : Distribution des distances, catégories
4. **Promotions** : Taux d'application, montants de réduction
5. **Paiements** : Réservations, échecs, montants

---

**Créé le 2025-01-27**

