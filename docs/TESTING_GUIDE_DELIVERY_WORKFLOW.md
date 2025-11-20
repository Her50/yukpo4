# 🧪 Guide de Tests : Améliorations Workflow de Livraison

## Vue d'ensemble

Ce guide décrit les tests end-to-end à effectuer pour valider les nouvelles fonctionnalités du workflow de livraison.

---

## 🧪 Tests Backend

### 1. Tests de Disponibilité Produit

#### Test 1.1 : Produit disponible
```bash
# Créer une commande pour un produit disponible
POST /api/orders
{
  "service_id": 123,
  "product_index": 0,
  "client_user_id": 456,
  "provider_user_id": 789
}
# Attendu : 200 OK avec order créée
```

#### Test 1.2 : Produit non disponible (jour)
```bash
# Créer une commande pour un produit non disponible aujourd'hui
# (availability_days ne contient pas le jour actuel)
POST /api/orders
# Attendu : 400 Bad Request avec similar_products
```

#### Test 1.3 : Produit non disponible (plage horaire)
```bash
# Créer une commande en dehors des plages horaires
POST /api/orders
# Attendu : 400 Bad Request avec similar_products
```

---

### 2. Tests de Validation Commande

#### Test 2.1 : Valider une commande normale
```bash
POST /api/orders/:order_id/validate
{}
# Attendu : 200 OK, status = "validated"
```

#### Test 2.2 : Valider une commande immédiatement disponible
```bash
# Produit avec is_immediately_available = TRUE
POST /api/orders/:order_id/validate
{}
# Attendu : 200 OK, status = "ready", matching coursier déclenché
```

#### Test 2.3 : Rejeter une commande
```bash
POST /api/orders/:order_id/reject
{
  "reason": "Produit en rupture de stock"
}
# Attendu : 200 OK, status = "rejected", rejection_reason défini
```

---

### 3. Tests de Timeout

#### Test 3.1 : Timeout automatique
```bash
# Créer une commande avec validation_deadline dans le passé
# Attendu : Commande automatiquement annulée par OrderTimeoutMonitor
```

#### Test 3.2 : Vérification périodique
```bash
# Vérifier que OrderTimeoutMonitor s'exécute toutes les minutes
# Attendu : Logs montrant la vérification des timeouts
```

---

### 4. Tests de Produits Similaires

#### Test 4.1 : Recherche produits similaires
```bash
GET /api/orders/:order_id/similar
# Attendu : 200 OK avec liste de produits similaires
```

#### Test 4.2 : Similarité basée sur autocomplete_characteristics
```bash
# Vérifier que la recherche utilise autocomplete_characteristics
GET /api/delivery/products/:service_id/:product_index/similar
# Attendu : Produits avec similarité > 0.5
```

---

### 5. Tests Analytics

#### Test 5.1 : Statistiques commandes
```bash
GET /api/provider/:provider_id/analytics/orders
# Attendu : 200 OK avec order_stats complets
```

#### Test 5.2 : Métriques préparation
```bash
GET /api/provider/:provider_id/analytics/preparation-time
# Attendu : 200 OK avec métriques (moyenne, médiane, etc.)
```

#### Test 5.3 : Analyse annulations
```bash
GET /api/provider/:provider_id/analytics/cancellations
# Attendu : 200 OK avec cancellation_stats détaillés
```

#### Test 5.4 : Dashboard complet
```bash
GET /api/provider/:provider_id/analytics/dashboard
# Attendu : 200 OK avec toutes les données analytics
```

---

### 6. Tests Vérification Coursier

#### Test 6.1 : Générer code vérification
```bash
GET /api/delivery/:delivery_id/verification-code
# Attendu : 200 OK avec verification_code (6 chiffres) et qr_code_url
```

#### Test 6.2 : Vérifier avec code correct
```bash
POST /api/delivery/:delivery_id/verify-courier
{
  "pin": "123456" // Code généré précédemment
}
# Attendu : 200 OK, verified = true
```

#### Test 6.3 : Vérifier avec code incorrect
```bash
POST /api/delivery/:delivery_id/verify-courier
{
  "pin": "000000"
}
# Attendu : 400 Bad Request, verified = false
```

---

### 7. Tests Tâches Périodiques

#### Test 7.1 : Recalcul stats catégories
```bash
# Vérifier que la tâche s'exécute toutes les 24h
# Attendu : Logs montrant le recalcul des stats
```

#### Test 7.2 : Recalcul stats annulation
```bash
# Vérifier que la tâche s'exécute toutes les 24h
# Attendu : Logs montrant le recalcul des stats d'annulation
```

---

## 📱 Tests Mobile

### 1. Tests UI

#### Test 1.1 : Affichage badges ProductCard
- [ ] Badge "⚡ Livraison rapide" affiché si `is_immediately_available = TRUE`
- [ ] Badge "⏱️ Prêt en X min" affiché si `preparation_time_minutes > 0`
- [ ] Badge "📅 Disponible [jours]" affiché si `availability_days` défini
- [ ] Badge "⚠️ Taux d'annulation" affiché selon le taux

#### Test 1.2 : OrderStatusScreen
- [ ] Affichage du statut de la commande
- [ ] Polling toutes les 10 secondes
- [ ] Bouton "Valider" visible pour prestataire si status = "pending"
- [ ] Affichage des dates importantes

#### Test 1.3 : ProviderOrderManagementScreen
- [ ] Liste des commandes en attente
- [ ] Filtres par statut fonctionnels
- [ ] Actions Valider/Rejeter fonctionnelles
- [ ] Modal rejet avec raison
- [ ] Notification sonore pour nouvelles commandes

---

### 2. Tests Navigation

#### Test 2.1 : Navigation vers produits similaires
- [ ] Redirection automatique vers SimilarProductsPage après rejet
- [ ] Paramètres `orderId` ou `serviceId/productIndex` passés correctement
- [ ] Affichage des produits similaires

#### Test 2.2 : Navigation vers suivi commande
- [ ] Navigation vers OrderStatusScreen avec orderId
- [ ] Affichage correct des données

---

### 3. Tests Notifications

#### Test 3.1 : Notification sonore
- [ ] Son joué lors d'une nouvelle commande
- [ ] Son local prioritaire, fallback distant
- [ ] Gestion du cache des sons

#### Test 3.2 : Notifications push
- [ ] Notification reçue pour nouvelle commande
- [ ] Redirection vers ResultatBesoin avec produits préchargés
- [ ] Données similaires extraites correctement

---

## 🌐 Tests Frontend

### 1. Tests UI

#### Test 1.1 : ProductCard avec badges
- [ ] Badges affichés correctement
- [ ] Tooltips fonctionnels au survol
- [ ] Design responsive (mobile/tablette/desktop)
- [ ] Badge annulation en position absolue (haut gauche)

#### Test 1.2 : SimilarProductsPage
- [ ] Affichage des produits similaires
- [ ] Grid responsive
- [ ] Navigation vers ProductCard fonctionnelle
- [ ] Gestion loading/error

#### Test 1.3 : OrderManagementPage
- [ ] Tableau des commandes avec filtres
- [ ] Actions Valider/Rejeter fonctionnelles
- [ ] Modal rejet avec textarea
- [ ] Actualisation manuelle

#### Test 1.4 : ProviderAnalyticsPage
- [ ] Affichage de toutes les métriques
- [ ] Sélecteur de période fonctionnel
- [ ] Graphiques (si implémentés)
- [ ] Export CSV/PDF (placeholder)

---

### 2. Tests Services API

#### Test 2.1 : providerAnalyticsService
- [ ] Toutes les méthodes fonctionnent
- [ ] Gestion des erreurs correcte
- [ ] Paramètres dateRange optionnels

#### Test 2.2 : productDeliveryService
- [ ] getDeliveryConfig fonctionne
- [ ] Formatage des jours correct
- [ ] Formatage du temps de préparation correct
- [ ] getCancellationBadge retourne les bonnes couleurs

---

## 🔄 Tests End-to-End

### Scénario 1 : Commande complète (produit disponible)

1. **Client** : Recherche un produit
2. **Client** : Voit le badge "⚡ Livraison rapide"
3. **Client** : Clique sur "Se faire livrer"
4. **Backend** : Vérifie la disponibilité → ✅ Disponible
5. **Backend** : Crée la commande → Status "pending"
6. **Prestataire** : Reçoit notification sonore
7. **Prestataire** : Ouvre "Mes commandes"
8. **Prestataire** : Voit la commande en attente
9. **Prestataire** : Clique sur "Valider"
10. **Backend** : Met à jour status → "ready" (immédiatement disponible)
11. **Backend** : Déclenche matching coursier
12. **Client** : Voit le statut mis à jour → "Prête"
13. **Coursier** : Reçoit l'assignation
14. **Prestataire** : Génère code vérification
15. **Coursier** : Arrive et entre le code
16. **Prestataire** : Vérifie le code → ✅ Vérifié
17. **Prestataire** : Remet le colis

---

### Scénario 2 : Produit non disponible → Produits similaires

1. **Client** : Recherche un produit
2. **Client** : Clique sur "Se faire livrer"
3. **Backend** : Vérifie la disponibilité → ❌ Non disponible (jour)
4. **Backend** : Recherche produits similaires
5. **Backend** : Retourne 400 avec `similar_products`
6. **Client** : Voit la page "Produits similaires"
7. **Client** : Sélectionne un produit similaire
8. **Client** : Clique sur "Se faire livrer"
9. **Backend** : Vérifie la disponibilité → ✅ Disponible
10. **Backend** : Crée la commande

---

### Scénario 3 : Rejet avec raison

1. **Prestataire** : Reçoit une commande
2. **Prestataire** : Ouvre la commande
3. **Prestataire** : Clique sur "Rejeter"
4. **Prestataire** : Entre la raison "Produit en rupture de stock"
5. **Prestataire** : Confirme le rejet
6. **Backend** : Met à jour status → "rejected"
7. **Backend** : Recherche produits similaires
8. **Backend** : Envoie notification au client avec produits similaires
9. **Client** : Reçoit notification
10. **Client** : Clique sur la notification
11. **Client** : Redirigé vers ResultatBesoin avec produits similaires préchargés

---

### Scénario 4 : Timeout automatique

1. **Client** : Crée une commande
2. **Backend** : Crée la commande avec `validation_deadline` = maintenant + 30 min
3. **Prestataire** : Ne valide pas la commande
4. **Backend** : OrderTimeoutMonitor détecte le timeout (après 30 min)
5. **Backend** : Annule automatiquement la commande
6. **Backend** : Met à jour status → "cancelled"
7. **Backend** : Recherche produits similaires
8. **Backend** : Envoie notification au client
9. **Client** : Reçoit notification avec produits similaires

---

### Scénario 5 : Analytics Prestataire

1. **Prestataire** : Accède au dashboard analytics
2. **Prestataire** : Sélectionne période "30 jours"
3. **Backend** : Récupère toutes les données analytics
4. **Frontend** : Affiche les statistiques
5. **Prestataire** : Voit le taux d'annulation élevé pour un produit
6. **Prestataire** : Identifie le problème
7. **Prestataire** : Exporte les données en CSV
8. **Prestataire** : Analyse les tendances

---

## ✅ Checklist de Validation

### Backend
- [ ] Toutes les routes API fonctionnent
- [ ] Gestion d'erreurs correcte
- [ ] Timeouts gérés automatiquement
- [ ] Produits similaires recherchés correctement
- [ ] Analytics calculés correctement
- [ ] Tâches périodiques s'exécutent
- [ ] Vérification coursier fonctionne

### Mobile
- [ ] Badges affichés sur ProductCard
- [ ] OrderStatusScreen fonctionne
- [ ] ProviderOrderManagementScreen fonctionne
- [ ] Notifications sonores fonctionnent
- [ ] Navigation vers produits similaires fonctionne
- [ ] Polling temps réel fonctionne

### Frontend
- [ ] ProductCard avec badges fonctionne
- [ ] SimilarProductsPage fonctionne
- [ ] OrderManagementPage fonctionne
- [ ] ProviderAnalyticsPage fonctionne
- [ ] Services API fonctionnent
- [ ] Design responsive

### End-to-End
- [ ] Scénario 1 : Commande complète ✅
- [ ] Scénario 2 : Produits similaires ✅
- [ ] Scénario 3 : Rejet avec raison ✅
- [ ] Scénario 4 : Timeout automatique ✅
- [ ] Scénario 5 : Analytics ✅

---

## 🐛 Tests de Régression

### Vérifier que les fonctionnalités existantes fonctionnent toujours

- [ ] Recherche de produits
- [ ] Création de services
- [ ] Livraisons existantes
- [ ] Matching coursier
- [ ] Tracking livraison
- [ ] Notifications existantes

---

## 📊 Métriques de Performance

### Mesurer les performances

- [ ] Temps de réponse API < 500ms
- [ ] Temps de chargement pages < 2s
- [ ] Polling mobile : 10s (OrderStatusScreen), 15s (ProviderOrderManagement)
- [ ] Recalcul stats : < 5 min pour toutes les catégories

---

## 🔍 Tests de Charge

### Tester avec volume élevé

- [ ] 100 commandes simultanées
- [ ] 1000 produits similaires recherchés
- [ ] Analytics avec 10 000 commandes
- [ ] Recalcul stats avec 100 catégories

---

## 📝 Notes de Test

Documenter les résultats des tests :
- Date de test
- Environnement (dev/staging/prod)
- Résultats (✅/❌)
- Bugs trouvés
- Commentaires

---

## 🚀 Déploiement

### Checklist avant déploiement

- [ ] Tous les tests passent
- [ ] Documentation à jour
- [ ] Migrations appliquées
- [ ] Variables d'environnement configurées
- [ ] Monitoring activé
- [ ] Logs configurés

---

## 📚 Références

- Documentation API : `docs/API_DELIVERY_WORKFLOW_IMPROVEMENTS.md`
- Guide Utilisateur : `docs/USER_GUIDE_DELIVERY_WORKFLOW.md`
- Prompt d'implémentation : `PROMPT_IMPLEMENTATION_AMELIORATIONS_LIVRAISON.md`

