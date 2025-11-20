# 📋 Workflow Global - Module Améliorations Livraison

## Vue d'ensemble

Ce document décrit en détail ce que les utilisateurs (prestataires et clients) peuvent réellement faire avec le module de livraison amélioré, basé sur le code réellement développé.

---

## 👤 WORKFLOW CLIENT

### 1. Création d'une Commande

#### Actions disponibles
- **Créer une commande** via `POST /api/delivery/orders`
- Le système vérifie automatiquement :
  - ✅ Disponibilité du produit (jour de la semaine)
  - ✅ Disponibilité horaire (plage horaire configurée)
  - ✅ Stock disponible (si gestion de stock activée)

#### Résultats possibles

**✅ Produit disponible**
- Commande créée avec statut `pending`
- Un `validation_deadline` est calculé automatiquement
- Le prestataire reçoit une notification sonore (mobile)
- Le client peut suivre sa commande en temps réel

**❌ Produit non disponible**
- La commande n'est **pas créée**
- Le système retourne :
  - `available: false`
  - `reason`: Raison de non-disponibilité
  - `similar_products`: Liste de 5 produits similaires basés sur :
    - `autocomplete_characteristics` (recherche vectorielle)
    - Description du produit
    - Catégorie

#### Code réel
```typescript
// mobile/src/services/orderService.ts
createOrder: async (orderData: CreateOrderPayload) => {
  // POST /api/delivery/orders
  // Vérifie disponibilité avant création
}
```

### 2. Suivi de Commande

#### Actions disponibles
- **Voir le statut d'une commande** via `GET /api/delivery/orders/:order_id`
- **Voir toutes ses commandes** via `GET /api/delivery/orders/client/my-orders`
- **Suivi en temps réel** avec polling automatique (toutes les 10 secondes)

#### Informations affichées
- Statut actuel (`pending`, `validated`, `ready`, `rejected`, `cancelled`)
- Temps de préparation estimé
- Date/heure de disponibilité estimée (`estimated_ready_at`)
- Historique complet (créée, validée, rejetée, etc.)
- Délai de validation (`validation_deadline`)

#### Écrans disponibles
- **Mobile** : `OrderStatusScreen` avec rafraîchissement automatique
- **Frontend** : Navigation vers `/order/:orderId` (à implémenter si nécessaire)

#### Code réel
```typescript
// mobile/src/screens/OrderStatusScreen.tsx
useEffect(() => {
  loadOrder();
  const interval = setInterval(() => {
    if (orderId) loadOrder();
  }, 10000); // Polling toutes les 10 secondes
}, [orderId]);
```

### 3. Produits Similaires

#### Actions disponibles
- **Voir produits similaires** si commande non disponible
- **Voir produits similaires** pour une commande existante via `GET /api/delivery/orders/:order_id/similar`

#### Algorithme de similarité
- Recherche basée sur `autocomplete_characteristics` (vecteurs)
- Recherche basée sur description du produit
- Score de similarité calculé (0-1)
- Maximum 5 produits retournés

#### Écrans disponibles
- **Frontend** : `SimilarProductsPage` avec affichage en grille
- **Mobile** : Navigation possible depuis notification

#### Code réel
```rust
// backend/src/services/similar_products_service.rs
find_similar_products(
  service_id, 
  product_index, 
  5 // limite
) -> Vec<SimilarProduct>
```

---

## 🏪 WORKFLOW PRESTATAIRE

### 1. Gestion des Commandes

#### Actions disponibles
- **Voir commandes en attente** via `GET /api/delivery/orders/provider/pending`
- **Valider une commande** via `POST /api/delivery/orders/:order_id/validate`
- **Rejeter une commande** via `POST /api/delivery/orders/:order_id/reject` (avec raison obligatoire)

#### Notifications
- **Notification sonore** automatique pour nouvelles commandes (mobile)
- Détection de nouvelles commandes via comparaison du nombre de commandes `pending`
- Polling automatique toutes les 15 secondes

#### Validation de commande
- Si `is_immediately_available = true` :
  - Statut passe directement à `ready`
  - Le matching de livraison est déclenché immédiatement
- Si `is_immediately_available = false` :
  - Statut passe à `validated`
  - Le prestataire peut fournir `estimated_ready_at`
  - Le matching est déclenché quand le statut devient `ready`

#### Rejet de commande
- Raison obligatoire (champ texte)
- Statut passe à `rejected`
- Le client est notifié
- Des produits similaires peuvent être suggérés au client

#### Écrans disponibles
- **Mobile** : `ProviderOrderManagementScreen` avec liste et actions
- **Frontend** : `OrderManagementPage` avec filtres et tableaux

#### Code réel
```typescript
// mobile/src/screens/ProviderOrderManagementScreen.tsx
// Notification sonore
if (newOrdersCount > lastOrderCount && lastOrderCount > 0) {
  playNotificationSound('order');
}
```

### 2. Analytics et Statistiques

#### Actions disponibles
- **Statistiques de commandes** : `GET /api/provider/:provider_id/analytics/orders`
- **Métriques délais préparation** : `GET /api/provider/:provider_id/analytics/preparation-time`
- **Analyse des rejets** : `GET /api/provider/:provider_id/analytics/rejections`
- **Analyse des annulations** : `GET /api/provider/:provider_id/analytics/cancellations`
- **Performance par produit** : `GET /api/provider/:provider_id/analytics/product-performance`
- **Dashboard complet** : `GET /api/provider/:provider_id/analytics/dashboard`

#### Données disponibles

**Statistiques de commandes**
- Total, pending, validated, ready, rejected, cancelled
- Répartition par statut

**Métriques délais préparation**
- Temps moyen, médian, min, max
- Par produit (service_id + product_index)
- Nombre de commandes par produit

**Analyse des rejets**
- Taux de rejet global
- Raisons de rejet (fréquence, pourcentage)
- Rejets par produit

**Analyse des annulations**
- Taux d'annulation global
- Par type (timeout, rejected, provider_cancelled, courier_unavailable)
- Produits à fort taux d'annulation (>20%)
- Évolution dans le temps

**Performance par produit**
- Nombre total de commandes
- Taux de validation
- Temps moyen de préparation
- Taux d'annulation

#### Écrans disponibles
- **Frontend** : `ProviderAnalyticsPage` avec graphiques et tableaux
- **Mobile** : Navigation depuis dashboard (à implémenter)

#### Code réel
```typescript
// frontend/src/services/providerAnalyticsService.ts
getOrderStatistics(providerId, dateRange?)
getPreparationTimeMetrics(providerId, dateRange?)
getCancellationAnalytics(providerId, dateRange?)
```

### 3. Gestion du Stock (Optionnel)

#### Actions disponibles
- **Mettre à jour le stock** via `PUT /api/delivery/stock/:config_id`
- **Supprimer un lieu de stock** via `DELETE /api/delivery/stock/:config_id/location/:location_id`

#### Code réel
```rust
// backend/src/routes/delivery_routes.rs
.route("/api/delivery/stock/:config_id", put(update_stock))
.route("/api/delivery/stock/:config_id/location/:location_id", delete(delete_stock_location))
```

---

## ⚙️ FONCTIONNALITÉS SYSTÈME AUTOMATIQUES

### 1. Vérification Disponibilité

#### Vérifications effectuées
- ✅ Jour de la semaine (`availability_days`)
- ✅ Plage horaire (`pickup_availability_schedule` - JSONB)
- ✅ Stock disponible (si gestion activée)

#### Code réel
```rust
// backend/src/services/product_availability_service.rs
check_availability(
  service_id,
  product_index,
  datetime // Optionnel, maintenant si None
) -> AvailabilityInfo
```

### 2. Timeout Automatique

#### Fonctionnement
- Si une commande `pending` n'est pas validée avant `validation_deadline` :
  - La commande est automatiquement annulée
  - Statut passe à `cancelled`
  - Raison : "timeout"
  - Le client est notifié

#### Code réel
```rust
// backend/src/tasks/order_timeout_monitor.rs
start_order_timeout_monitor() // Tâche périodique
```

### 3. Calcul Dynamique Temps de Préparation

#### Fonctionnement
- Temps calculé par catégorie basé sur historique
- Si `is_immediately_available = true` : 0 minutes
- Sinon : temps moyen de la catégorie
- Recalcul quotidien des statistiques

#### Code réel
```rust
// backend/src/services/dynamic_preparation_time_service.rs
get_preparation_time_for_category(category_id) -> i32
```

### 4. Matching Livraison Intelligent

#### Fonctionnement
- Le matching est déclenché uniquement quand :
  - Statut = `ready`
  - `estimated_ready_at` est dans le passé (ou proche)
- Si le statut n'est pas `ready`, le matching est retardé

#### Code réel
```rust
// backend/src/services/delivery_service.rs
enqueue_delivery_matching() // Vérifie order.status avant matching
```

---

## 📱 INTERFACES UTILISATEUR

### Mobile

#### Client
- **OrderStatusScreen** : Suivi commande avec polling
  - Affichage statut en temps réel
  - Historique complet
  - Actions si prestataire (valider)

#### Prestataire
- **ProviderOrderManagementScreen** : Gestion commandes
  - Liste des commandes en attente
  - Actions : Valider / Rejeter
  - Notification sonore pour nouvelles commandes
  - Polling automatique (15s)

### Frontend

#### Client
- **SimilarProductsPage** : Produits similaires
  - Affichage en grille responsive
  - Navigation vers produits

#### Prestataire
- **OrderManagementPage** : Gestion commandes
  - Tableau avec filtres par statut
  - Actions : Valider / Rejeter / Voir détails
  - Modal pour raison de rejet

- **ProviderAnalyticsPage** : Analytics complètes
  - Statistiques de commandes
  - Métriques délais préparation
  - Analyse annulations
  - Performance par produit
  - Sélecteur de période

---

## 🎯 EXEMPLES PRATIQUES

### Exemple 1 : Client commande un produit disponible

**Scénario** : Marie veut commander un repas à emporter pour 18h00.

1. **Marie crée la commande** (mobile ou frontend)
   - Service ID: 123, Product Index: 0
   - Client ID: 456, Provider ID: 789

2. **Système vérifie disponibilité**
   - ✅ Jour : Mardi (disponible)
   - ✅ Horaire : 18h00 dans la plage 17h-20h
   - ✅ Stock : Disponible

3. **Commande créée**
   - Statut : `pending`
   - `validation_deadline` : 19h00 (dans 1h)
   - Notification sonore envoyée au prestataire

4. **Prestataire reçoit notification**
   - Son de notification joué sur mobile
   - Commande apparaît dans `ProviderOrderManagementScreen`

5. **Prestataire valide**
   - Clique sur "Valider"
   - Si `is_immediately_available = true` :
     - Statut → `ready`
     - Matching livraison déclenché immédiatement
   - Si `is_immediately_available = false` :
     - Statut → `validated`
     - Prestataire peut indiquer `estimated_ready_at`

6. **Client suit en temps réel**
   - `OrderStatusScreen` se met à jour automatiquement
   - Voir statut, temps préparation, date estimée

**Résultat** : Commande traitée avec suivi en temps réel.

---

### Exemple 2 : Produit non disponible - Produits similaires

**Scénario** : Jean veut commander un produit qui n'est pas disponible.

1. **Jean crée la commande**
   - Service ID: 456, Product Index: 2
   - Produit : "Pizza Margherita"

2. **Système vérifie disponibilité**
   - ❌ Jour : Dimanche (non disponible ce jour)
   - OU ❌ Horaire : 14h00 (hors plage 17h-20h)
   - OU ❌ Stock : Épuisé

3. **Commande non créée**
   - Réponse : `available: false`
   - `reason`: "Produit non disponible le dimanche" ou "Hors plage horaire"

4. **Système recherche produits similaires**
   - Recherche dans `autocomplete_characteristics` : ["pizza", "italien", "fromage"]
   - Recherche dans descriptions : "pizza", "margherita"
   - Retourne 5 produits similaires avec scores

5. **Client voit produits similaires**
   - `SimilarProductsPage` affiche les alternatives
   - Produits triés par score de similarité
   - Client peut choisir un produit alternatif

**Résultat** : Client trouve une alternative rapidement.

---

### Exemple 3 : Prestataire analyse ses performances

**Scénario** : Sarah (prestataire) veut analyser ses performances du mois.

1. **Sarah accède aux analytics**
   - Navigation : Dashboard → Analytics détaillées
   - `ProviderAnalyticsPage` se charge

2. **Sélection de période**
   - Période : 1er au 31 janvier 2025
   - Requête : `GET /api/provider/789/analytics/dashboard?period_start=...&period_end=...`

3. **Données affichées**

   **Statistiques commandes**
   - Total : 150 commandes
   - Validées : 120 (80%)
   - Rejetées : 20 (13%)
   - Annulées : 10 (7%)

   **Métriques délais préparation**
   - Temps moyen : 25 minutes
   - Temps médian : 22 minutes
   - Min : 10 minutes, Max : 45 minutes

   **Analyse annulations**
   - Taux global : 7%
   - Par type :
     - Timeout : 5
     - Rejet : 3
     - Autre : 2
   - Produits à fort taux :
     - Service 123, Produit 0 : 25% (4/16)

   **Performance par produit**
   - Service 123, Produit 0 :
     - 16 commandes
     - Taux validation : 75%
     - Temps moyen : 30 min
     - Taux annulation : 25% ⚠️

4. **Actions de Sarah**
   - Identifie le produit problématique (Service 123, Produit 0)
   - Décide d'améliorer la disponibilité
   - Ajuste les plages horaires
   - Réduit le temps de préparation

**Résultat** : Sarah optimise ses performances grâce aux analytics.

---

## 🔄 FLUX COMPLET D'UNE COMMANDE

```
1. CLIENT crée commande
   ↓
2. SYSTÈME vérifie disponibilité
   ├─ Disponible → Commande créée (pending)
   └─ Non disponible → Produits similaires suggérés
   ↓
3. PRESTATAIRE reçoit notification (sonore mobile)
   ↓
4. PRESTATAIRE voit commande dans liste
   ↓
5. PRESTATAIRE décide :
   ├─ VALIDER
   │  ├─ is_immediately_available = true → ready (matching déclenché)
   │  └─ is_immediately_available = false → validated (matching quand ready)
   └─ REJETER
      └─ Raison obligatoire → rejected (client notifié)
   ↓
6. CLIENT suit en temps réel (polling 10s)
   ↓
7. Si timeout → Commande annulée automatiquement
   ↓
8. Analytics mises à jour (recalcul quotidien)
```

---

## 📊 STATISTIQUES ET MÉTRIQUES

### Calculées automatiquement
- ✅ Temps moyen de préparation par catégorie (recalcul quotidien)
- ✅ Taux d'annulation par produit (recalcul quotidien)
- ✅ Statistiques de commandes (en temps réel)
- ✅ Métriques de préparation (en temps réel)

### Accessibles via API
- ✅ Toutes les analytics prestataire
- ✅ Données avec filtres par période
- ✅ Export possible (à implémenter)

---

## 🎯 POINTS CLÉS

1. **Vérification disponibilité** : Jour + Horaire + Stock
2. **Produits similaires** : Basés sur caractéristiques vectorielles
3. **Timeout automatique** : Annulation si non validé
4. **Matching intelligent** : Seulement quand `ready`
5. **Analytics complètes** : Toutes les métriques disponibles
6. **Notifications sonores** : Mobile pour nouvelles commandes
7. **Suivi temps réel** : Polling automatique

---

**Dernière mise à jour** : 2025-01-20  
**Basé sur** : Code réellement développé dans le projet

