UX Mobile – Livraison & Course Supermarché
==========================================

## 1. Principes généraux
- **Avatar Yukpo Delivery** omniprésent (bandeau maison / floating bouton).
- Navigation mobile basée sur `React Navigation` avec stack dédiée `DeliveryShoppingFlow`.
- Respect du design system (SafeIcon, NativeButton, couleurs focus #6366F1).
- Etat global via `DeliveryContext` + nouveau `ShoppingContext` (panier + estimation).

## 2. Parcours client

### 2.1 Découverte
- **Home tab** : carte plein écran + section “Livraison intelligente”.
  - CTA : `Demander une livraison`, `Commander au supermarché`.
  - Avatar -> suggestion (parler bubble).
- **ProductCard** : bouton additionnel “Commander via Yukpo” (si stock).
- **ChatModalMobile** : message automatique `Avatar` avec quick replies.

### 2.2 Flow “Demander une livraison”
1. **Colis** (form existant) → `DeliveryRequestForm`.
2. **Point retrait / dépôt** (map, suggestions).
3. **Aperçu** : estimation, prix, coursier potentiel.
4. **Confirmation** → redirection `DeliveryTrackingScreen`.
5. **Suivi** :
   - Carte + timeline (icônes statut).
   - WebSocket `/delivery/{id}/ws` : events `status`, `location`, `pricing`.
   - Bouton contact coursier (afficher tel si dispo).

### 2.3 Flow “Course supermarché”
Stack `DeliveryShoppingFlow` (4 écrans) :

1. **PanierSupermarcheScreen**
   - Autocomplete (LinearAutocompleteEditor + `autocomplete_characteristic`).
   - Liste produits sélectionnés (quantité, unité, prix estimé).
   - Suggestion modules (produits complémentaires, alternatives).
   - CTA `Continuer` -> validation non vide.

2. **BudgetScreen**
   - Affiche total estimé + marge (configurable).
   - Récupère `walletBalance` via `useWalletBalance()`.
   - Message success ou alerte `Insuffisant` + bouton `Recharger`.
   - Possibilité d’ajouter commentaire pour coursier.

3. **PickupDeliveryScreen**
   - Choix supermarché (gps actuel + map + recherche).
   - Dropoff (adresse client).
   - Estimation `temps marché` + `temps trajet` (collé).
   - Résumé coût : panier + livraison.

4. **ShoppingSummaryScreen**
   - Récap final + CTA `Confirmer`.
   - Après confirmation → `DeliveryShoppingTrackingScreen`.

### 2.4 Suivi après commande
- **DeliveryShoppingTrackingScreen**
  - Onglets : `Timeline`, `Panier`, `Coursier`.
  - Timeline inclut nouveaux statuts : `shopping_in_progress`, `shopping_completed`.
  - Vue panier : items cochés par coursier (réception via WebSocket `shopping_update` futur).
  - Bouton contact supermarché (si utile) + options `Annuler commande` (avec contraintes).

## 3. Parcours coursier (App mobile)
- **Tab “Courses”** :
  - Cards `Course classique` vs `Course supermarché`.
  - Pour supermarché : afficher `Panier` + estimation temps + total à avancer.
- **Détails course** :
  - Checklist produits (toggle + quantités).
  - Champ commentaire + photo ticket de caisse (upload).
  - Bouton `Achat terminé` -> prompt prix final (saisir montant, upload ticket).
- **Statuts** :
  - `En route supermarché` → `Course d’achat` → `Panier complet` → `En route client`.
  - Validation finale à la livraison (code/QR).

## 4. Hooks / contextes
- `useDeliveryRequest` (existant).
- `useDeliveryTracking(deliveryId)` : WS + fallback.
- `useShoppingBasket()` :
  - `items`, `addProduct`, `updateQuantity`, `removeProduct`.
  - `estimateBasket()` : interroge `/api/shopping/orders/estimate`.
- `useWalletBalance()` : `balance`, `refresh`.
- `useCourierShopping()` (coursier) :
  - `toggleItem`, `submitReceipt`, `updateActualTotal`.

## 5. API consommées
- `GET /api/deliveries/{id}` : résumé initial.
- `GET /api/delivery/{id}/ws` : temps réel.
- `POST /api/shopping/orders/estimate` : estimation panier.
- `POST /api/shopping/orders` : création commande + livraison couplée.
- `POST /api/shopping/orders/{id}/checkout` : ticket final.
- `GET /api/wallet/balance` : solde client.

## 6. Navigation & stack
```
DeliveryStack
 ├─ DeliveryHomeScreen
 ├─ DeliveryRequestStack
 │   ├─ ParcelScreen
 │   ├─ LocationScreen
 │   └─ DeliverySummaryScreen
 ├─ DeliveryTrackingScreen
 └─ DeliveryShoppingFlow
     ├─ ShoppingBasketScreen
     ├─ ShoppingBudgetScreen
     ├─ ShoppingPickupDropScreen
     ├─ ShoppingSummaryScreen
     └─ DeliveryShoppingTrackingScreen
```

## 7. UI Components (nouveaux)
- `ShoppingProductPicker` (wrap sur autocomplete, affiche badges/quantités).
- `ShoppingBasketCard` (liste, sous-total, delete).
- `WalletAlertBanner` (montant manquant, CTA recharge).
- `DeliveryTrackingMap` (carte interactive + polyline).
- `TimelineStepper` (statut + timestamps).
- `CourierChecklistItem` (toggle + note).

## 8. États / statuts supplémentaires
Enum tracking :
- `shopping_pending` (en attente arrivée supermarché)
- `shopping_in_progress`
- `shopping_completed`
- `en_route_delivery`
- `delivered`
- `cancelled`

## 9. Notifications mobile
- Push : `Commande supermarché confirmée`, `Coursier au marché`, `Panier complété`, `En route`, `Livraison terminée`.
- In-app : alertes budget insuffisant, ticket refusé, etc.

## 10. Accessibilité & perf
- Feedbacks audio/haptics sur étapes clés.
- Lazy load carte + module autocomplete (utiliser Suspense).
- Optimiser WebSocket : throttle updates (max 1/s).

## 11. Tâches UX restantes
- Réaliser wireframes high-level pour 5 écrans (sketch Figma).
- Définir micro-interactions `DeliveryAvatar`.
- Préparer state machine détaillée pour hook `useDeliveryTracking`.
- Identifier assets (icônes supermarché, panier).

## 12. Implémentation mobile (novembre 2025)
- ✅ Contextes `DeliveryProvider` + `ShoppingProvider` intégrés à l'app Expo (gestion WS + panier + budget + wallet).
- ✅ Hooks `useDeliveryTracking`, `useShoppingBasket`, `useCourierShopping`, `useWalletBalance` exposés pour les écrans.
- ✅ Nouveaux composants design system (`ShoppingProductPicker`, `ShoppingBasketCard`, `WalletAlertBanner`, `DeliveryTrackingMap`, `TimelineStepper`, `CourierChecklistItem`, `DeliveryAvatarBubble`).
- ✅ Flow `DeliveryShoppingFlow` complet avec stack dédiée : panier ➜ budget ➜ pick-up/drop-off ➜ résumé ➜ tracking temps réel.
- ✅ Tracking enrichi (`DeliveryShoppingTrackingScreen`) avec timeline, carte, partage position destinataire et CTA chat.
- ✅ Section "Livraison intelligente" sur `HomeScreen` + nouveau `DeliveryHomeScreen` listant les livraisons actives avec reprise directe du tracking.
- ✅ Couverture tests (Vitest) sur `useDeliveryTracking` mobile : écoute WS, timeline, `lastLocationEvent`, refresh manuel.

## 13. Observabilité & monitoring (nouveau)
- **Sentry (sentry-expo)** initialisé globalement (`initObservability`) avec `dsn` fourni via `app.json` → capture crash + traces + métriques custom.
- **FPS monitor** : échantillonnage 6s, alerte Sentry si moyenne < 45 FPS (2 occurrences consécutives) + métrique `mobile.performance.fps`.
- **WebSocket analytics** :
  - `mobile.ws.status` (online/offline) à chaque transition.
  - `mobile.ws.reconnect_delay_ms` + incrément `mobile.ws.reconnect_attempts` pour suivre la résilience réseau.
  - Erreurs WS capturées via `recordWebSocketError` (Sentry).
- **File offline mutations** : assignation destinataire, statuts, wallet, localisation sont mis en file si réseau/WS indispo (5 tentatives max) et rejoués automatiquement dès reconnexion.
- **Breadcrumbs** : timeline des messages WS (`mobile.ws.message`) + breadcrumbs `websocket` pour autopsie.
- **Configuration Grafana** : expo `extra.observability` expose `fpsSampleInterval`, `fpsWarningThreshold`, `traceSampleRate`. Grafana/Hetzner consomme les métriques Sentry ou Prometheus (pipeline en cours) pour dashboard “Yukpo Mobile Courier”.
- **ErrorBoundary** : chaque crash UI → `Sentry.Native.captureException` + CTA “Signaler” qui renvoie l’exception avec tag `ErrorBoundaryUserReport`.

