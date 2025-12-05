# 🧪 Plan de Tests Complets - Système de Livraison

## 🎯 Objectif
Atteindre **100% de couverture** des fonctionnalités de livraison avec tests unitaires, d'intégration et E2E.

---

## 📋 Tests Backend (Rust)

### ✅ Tests Unitaires - Calcul Coûts

**Fichier** : `backend/tests/delivery_pricing_tests.rs`

1. ✅ `test_haversine_distance` - Calcul distance entre deux points
2. ✅ `test_short_distance_minimum` - Minimum garanti 1000 FCFA
3. ✅ `test_medium_distance` - Distance moyenne (5 km)
4. ✅ `test_long_distance` - Distance longue (20 km)
5. ✅ `test_total_cost_standard` - Total avec billing standard
6. ✅ `test_total_cost_merchant_inclusive` - Total avec livraison gratuite
7. ✅ `test_centimes_conversion` - Conversion FCFA ↔ centimes
8. ✅ `test_price_with_promotion_percentage` - Prix avec promotion %
9. ✅ `test_price_with_promotion_fixed` - Prix avec promotion fixe
10. ✅ `test_complete_calculation` - Calcul complet end-to-end

### ✅ Tests d'Intégration - Endpoints

**Fichier** : `backend/tests/delivery_api_integration_tests.rs`

#### Endpoint `POST /api/delivery/estimate-costs`

1. **Test** : Estimation avec produit et dropoff
   - Créer service avec produit
   - Configurer `product_delivery_config`
   - Appeler endpoint
   - Vérifier `product_price_cents`, `delivery_cost_cents`, `total_cents`

2. **Test** : Estimation avec promotion active
   - Produit avec `promotionActive = true`
   - Vérifier prix réduit dans réponse

3. **Test** : Estimation avec `billing_mode = merchant_inclusive`
   - Vérifier `is_delivery_free = true`
   - Vérifier `delivery_cost_cents` non inclus dans total

4. **Test** : Erreur si `dropoff` manquant
   - Vérifier erreur 400 avec message clair

5. **Test** : Erreur si `service_id` invalide
   - Vérifier erreur 404

#### Endpoint `POST /api/delivery/client-order`

1. **Test** : Création commande complète
   - Créer commande
   - Vérifier livraison créée
   - Vérifier réservation paiement créée
   - Vérifier solde débité

2. **Test** : Auto-remplissage pickup depuis config
   - Vérifier pickup = config produit

3. **Test** : Auto-remplissage dropoff depuis GPS utilisateur
   - Vérifier dropoff = GPS utilisateur

4. **Test** : Erreur si produit indisponible
   - Vérifier retour produits similaires

5. **Test** : Erreur si configuration incomplète
   - Vérifier erreur avec message clair

6. **Test** : Erreur si solde insuffisant
   - Vérifier erreur avant création livraison

#### Endpoint `POST /api/delivery/{id}/pricing`

1. **Test** : Mise à jour pricing
   - Créer livraison
   - Mettre à jour pricing
   - Vérifier pricing sauvegardé

2. **Test** : Recalcul après changement dropoff
   - Changer dropoff
   - Vérifier pricing recalculé automatiquement

### ✅ Tests Services

**Fichier** : `backend/tests/delivery_service_tests.rs`

1. **Test** : `DeliveryService::create_delivery_request`
   - Création livraison complète
   - Vérification statut initial = `Requested`
   - Vérification métadonnées

2. **Test** : `DeliveryPaymentService::reserve_payment`
   - Réservation avec solde suffisant
   - Erreur si solde insuffisant
   - Vérification statut réservation

3. **Test** : Matching coursiers
   - Créer livraison
   - Vérifier matching lancé
   - Vérifier statut → `AwaitingCourierConfirmation`

---

## 📋 Tests Frontend (React + Playwright)

### ✅ Tests E2E - Parcours Client

**Fichier** : `frontend/tests/e2e/delivery-pricing.spec.ts`

1. ✅ Estimation coûts - Distance courte (minimum)
2. ✅ Estimation coûts - Distance moyenne
3. ✅ Estimation coûts - Billing mode merchant_inclusive
4. ✅ Estimation coûts - Produit avec promotion
5. ✅ Création commande - Vérification réservation paiement
6. ✅ Erreur - Solde insuffisant
7. ✅ Changement dropoff - Recalcul automatique

### ✅ Tests Composants React

**Fichier** : `frontend/src/components/delivery/__tests__/OrderDeliveryModal.test.tsx`

1. **Test** : Affichage estimation coûts
   - Vérifier affichage prix produit
   - Vérifier affichage coût livraison
   - Vérifier affichage total

2. **Test** : Sélection dropoff
   - Vérifier auto-remplissage GPS
   - Vérifier sélection manuelle
   - Vérifier recalcul coûts

3. **Test** : Billing mode merchant_inclusive
   - Vérifier badge "Gratuite"
   - Vérifier total = prix produit

4. **Test** : Produit avec promotion
   - Vérifier badge PROMO
   - Vérifier prix barré
   - Vérifier prix réduit

---

## 📋 Tests Mobile (React Native)

### ✅ Tests Unitaires

**Fichier** : `mobile/src/__tests__/deliveryPricing.test.tsx`

1. ✅ `haversineDistance` - Calcul distance
2. ✅ `calculateDeliveryCost` - Calcul coût livraison
3. ✅ `calculateTotalCost` - Calcul total

### ✅ Tests Composants

**Fichier** : `mobile/src/components/delivery/__tests__/OrderDeliveryModal.test.tsx`

1. **Test** : Rendu modal
2. **Test** : Sélection GPS
3. **Test** : Affichage coûts
4. **Test** : Soumission formulaire

### ✅ Tests E2E (Detox)

**Fichier** : `mobile/e2e/delivery.e2e.ts`

1. **Test** : Parcours commande complet
   - Ouvrir produit
   - Cliquer "Commander"
   - Sélectionner dropoff
   - Vérifier estimation
   - Confirmer commande
   - Vérifier succès

2. **Test** : Erreur solde insuffisant
   - Tenter commande avec solde insuffisant
   - Vérifier message erreur

---

## 📊 Couverture Cible

### Backend
- **Routes** : 100%
- **Services** : 100%
- **Utils** : 100%

### Frontend
- **Composants** : 90%
- **Hooks** : 100%
- **E2E** : 100% parcours critiques

### Mobile
- **Utils** : 100%
- **Composants** : 80%
- **E2E** : 100% parcours critiques

---

## 🚀 Commandes d'Exécution

### Backend
```bash
# Tests unitaires
cargo test delivery_pricing_tests

# Tests d'intégration
cargo test --test delivery_api_integration_tests

# Avec couverture
cargo test --all-features -- --nocapture
```

### Frontend
```bash
# Tests unitaires
npm test

# Tests E2E
npm run test:e2e

# Avec couverture
npm run test:coverage
```

### Mobile
```bash
# Tests unitaires
npm test

# Tests E2E (Detox)
npm run test:e2e:ios
npm run test:e2e:android
```

---

## ✅ Checklist Validation

- [ ] Tous les tests unitaires passent
- [ ] Tous les tests d'intégration passent
- [ ] Tous les tests E2E passent
- [ ] Couverture backend ≥ 90%
- [ ] Couverture frontend ≥ 80%
- [ ] Couverture mobile ≥ 70%
- [ ] Documentation à jour
- [ ] CI/CD configuré avec tests

---

**Plan généré le 2025-01-27**

