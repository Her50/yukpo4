# ✅ Checklist de Déploiement - Améliorations Workflow de Livraison

## 📋 Checklist Rapide

### 🔴 Avant Déploiement

- [ ] **Sauvegarde base de données** effectuée
- [ ] **Code review** effectué
- [ ] **Tests** passent (backend, frontend, mobile)
- [ ] **Documentation** à jour
- [ ] **Variables d'environnement** configurées
- [ ] **Migrations testées** en staging

---

### 🟡 Backend

#### Préparation
- [ ] Migrations SQL créées et testées
- [ ] `auto_migrate.rs` contient les nouvelles fonctions
- [ ] `sqlx-data.json` régénéré (si nécessaire)
- [ ] Variables d'environnement configurées :
  - [ ] `DATABASE_URL`
  - [ ] `SQLX_OFFLINE=true` (pour build sans DB)

#### Déploiement
- [ ] Migrations appliquées sur la base de production
- [ ] Code compilé sans erreurs (`cargo build --release`)
- [ ] Service redémarré
- [ ] Logs vérifiés :
  - [ ] Migrations appliquées
  - [ ] Tâches périodiques démarrées
  - [ ] Pas d'erreurs critiques

#### Vérifications
- [ ] Tables créées :
  - [ ] `product_delivery_config`
  - [ ] `product_orders`
  - [ ] `order_cancellations`
  - [ ] `product_cancellation_stats`
  - [ ] `category_preparation_stats`
  - [ ] `product_stock_locations`
  - [ ] `stock_reservations`
  - [ ] `courier_verification_codes`
- [ ] Routes API testées :
  - [ ] `POST /api/orders`
  - [ ] `GET /api/orders/:id`
  - [ ] `GET /api/provider/:id/analytics/dashboard`
- [ ] Tâches périodiques actives :
  - [ ] Recalcul stats catégories
  - [ ] Recalcul stats annulation
  - [ ] OrderTimeoutMonitor

---

### 🟢 Frontend

#### Préparation
- [ ] Nouveaux fichiers créés :
  - [ ] `SimilarProductsPage.tsx`
  - [ ] `OrderManagementPage.tsx`
  - [ ] `ProviderAnalyticsPage.tsx`
  - [ ] `DeliveryBadge.tsx`
  - [ ] `providerAnalyticsService.ts`
  - [ ] `productDeliveryService.ts`
- [ ] Routes ajoutées dans `App.tsx`
- [ ] Routes ajoutées dans `AppRoutesRegistry.ts`
- [ ] Variables d'environnement configurées :
  - [ ] `VITE_API_BASE_URL`
  - [ ] `VITE_WS_BASE_URL`

#### Déploiement
- [ ] Dépendances installées (`npm install`)
- [ ] Build réussi (`npm run build`)
- [ ] Déployé sur Netlify/Vercel/serveur
- [ ] Variables d'environnement configurées dans le dashboard

#### Vérifications
- [ ] Pages accessibles :
  - [ ] `/similar-products`
  - [ ] `/orders/management`
  - [ ] `/provider/analytics`
- [ ] ProductCard affiche les badges
- [ ] Services API fonctionnent (console navigateur)
- [ ] Pas d'erreurs 404

---

### 🔵 Mobile

#### Préparation
- [ ] Nouveaux fichiers créés :
  - [ ] `OrderStatusScreen.tsx`
  - [ ] `ProviderOrderManagementScreen.tsx`
  - [ ] `orderService.ts`
  - [ ] `productDeliveryService.ts`
  - [ ] `stockService.ts`
  - [ ] `notificationSoundService.ts`
- [ ] Navigation ajoutée dans `AppNavigator.tsx`
- [ ] Variables d'environnement configurées :
  - [ ] `EXPO_PUBLIC_API_BASE_URL`
  - [ ] `EXPO_PUBLIC_WS_BASE_URL`
- [ ] Sons de notification ajoutés (optionnel) :
  - [ ] `order_notification.mp3`
  - [ ] `courier_assigned.mp3`
  - [ ] `order_ready.mp3`

#### Déploiement
- [ ] Dépendances installées (`npm install`)
- [ ] Build réussi (`eas build` ou `expo build`)
- [ ] Testé sur appareils réels
- [ ] Soumis aux stores (si applicable)

#### Vérifications
- [ ] Navigation vers nouveaux screens fonctionne
- [ ] Appels API fonctionnent
- [ ] Notifications sonores fonctionnent (si fichiers ajoutés)
- [ ] Polling temps réel fonctionne
- [ ] ProductCard affiche les badges (si implémenté)

---

### 🟣 Post-Déploiement

#### Tests Fonctionnels
- [ ] **Client** : Créer une commande
- [ ] **Client** : Voir produits similaires si non disponible
- [ ] **Prestataire** : Recevoir notification sonore
- [ ] **Prestataire** : Valider/Rejeter une commande
- [ ] **Prestataire** : Voir analytics dashboard
- [ ] **Prestataire** : Vérifier coursier avec code PIN
- [ ] **Système** : Timeout automatique fonctionne
- [ ] **Système** : Tâches périodiques s'exécutent

#### Monitoring
- [ ] Logs vérifiés (pas d'erreurs critiques)
- [ ] Métriques surveillées :
  - [ ] Taux d'erreur API
  - [ ] Temps de réponse
  - [ ] Utilisation base de données
- [ ] Alertes configurées

#### Documentation
- [ ] Documentation API accessible
- [ ] Guide utilisateur accessible
- [ ] Changelog mis à jour

---

## 🚨 En cas de problème

### Rollback Backend
1. Revenir au commit précédent
2. Recompiler et redéployer
3. Vérifier les logs

### Rollback Frontend
1. Revenir au commit précédent
2. Rebuild et redéployer
3. Vérifier les pages

### Rollback Mobile
1. Revenir au commit précédent
2. Rebuild
3. Redéployer

### ⚠️ ATTENTION : Base de Données
**Ne pas supprimer les tables en production sans sauvegarde complète !**

---

## 📞 Support

En cas de problème :
1. Vérifier les logs
2. Consulter `docs/DEPLOYMENT_GUIDE_DELIVERY_WORKFLOW.md`
3. Vérifier les issues GitHub
4. Contacter l'équipe technique

---

**Date** : _______________  
**Déployé par** : _______________  
**Environnement** : _______________  
**Version** : _______________

