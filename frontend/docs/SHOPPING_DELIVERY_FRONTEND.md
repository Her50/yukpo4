Frontend Livraison & Shopping – Synthèse livrables
==================================================

## 1. Vue d’ensemble
- **Stack** : React + TypeScript + Tailwind (`frontend/`).
- **Contexts globaux** :
  - `DeliveryContext` (`src/context/DeliveryContext.tsx`) – gère les livraisons actives, la connexion WebSocket et les mutations (assignation destinataire, statuts, wallet).
  - `ShoppingContext` (`src/context/ShoppingContext.tsx`) – gère panier, estimation, destinataire, solde wallet et création de commande.
- **Services API** :
  - `src/services/deliveryApi.ts` – lecture/mutation livraisons.
  - `src/services/websocketService.ts` – connexion WS avec canal `deliveryTracking`.
  - Hooks de base dans `src/hooks/` (`useDeliveryTracking`, `useWalletBalance`, `useShopping`).
- **Routing** : pages ajoutées dans `src/pages/delivery/` et déclarées via `ROUTES.DELIVERY_*` (`src/routes/AppRoutesRegistry.ts`) + intégration dans `src/App.tsx`.

## 2. Écrans livrés

| Page | Fichier | Fonctionnalités principales |
| --- | --- | --- |
| Accueil livraison | `DeliveryHomePage.tsx` | avatar d’accueil, CTA courses & colis, liste des livraisons actives (`ActiveDeliveryCard`), rafraîchissement manuel. |
| Panier shopping | `ShoppingBasketPage.tsx` | formulaire `ShoppingItemForm`, tableau des items (`ShoppingBasketTable`), estimation automatique, gestion d’erreurs. |
| Budget & destinataire | `ShoppingBudgetPage.tsx` | bannière solde (`BudgetAlert`), formulaire destinataire (nom, téléphone, notes), rappel estimation/solde. |
| Pickup & dropoff | `ShoppingPickupDropPage.tsx` | saisie du supermarché + destinataire (lat/long), persistance sessionStorage, validations. |
| Résumé commande | `ShoppingSummaryPage.tsx` | récap panier, points GPS, instructions, confirmation (création commande + redirection tracking). |
| Tracking temps réel | `DeliveryTrackingPage.tsx` | résumé livraison, timeline (`DeliveryTimeline`), placeholder carte, actions refresh/support. |

### Navigation
- Toutes les pages sont protégées par `RequireAuth`.
- Flux shopping : `DELIVERY_SHOPPING_BASKET` → `BUDGET` → `PICKUP_DROP` → `SUMMARY` → redirection automatisée vers `DELIVERY_TRACKING`.
- `DeliveryHomePage` sert d’entrée principale via `ROUTES.DELIVERY_HOME`.

## 3. Composants UI clés

| Composant | Chemin | Description |
| --- | --- | --- |
| `ActiveDeliveryCard` | `src/components/delivery/ActiveDeliveryCard.tsx` | résumé compact d’une commande (statut, lieux, destinataire, CTA « Suivre »). |
| `DeliveryAvatarBubble` | `src/components/delivery/DeliveryAvatarBubble.tsx` | avatar conversationnel pour onboarding et rappels. |
| `ShoppingItemForm` | `src/components/delivery/ShoppingItemForm.tsx` | ajout article (nom, quantité, unité, prix estimé) avec normalisation des valeurs. |
| `ShoppingBasketTable` | `src/components/delivery/ShoppingBasketTable.tsx` | liste panier : édition quantités, suppression, affichage totaux. |
| `BudgetAlert` | `src/components/delivery/BudgetAlert.tsx` | comparaison solde Wallet vs estimation, CTA recharge. |
| `DeliveryTimeline` | `src/components/delivery/DeliveryTimeline.tsx` | timeline verticale des checkpoints (statut + timestamps). |
| `DeliveryMapPlaceholder` | `src/components/delivery/DeliveryMapPlaceholder.tsx` | placeholder avant intégration carte (couplage futur Mapbox/OSM). |
| `DeliveryLiveMap` | `src/components/delivery/DeliveryLiveMap.tsx` | rendu Leaflet temps réel (markers pickup/dropoff/coursier + trail, auto-fit des bornes). |
| `DeliveryChatPanel` | `src/components/delivery/DeliveryChatPanel.tsx` | chat temps réel (WS auto-reconnect, typing indicator, statut messages). |

Tous les composants s’appuient sur le design system existant (`Button`, `Badge`, `Card`, `DeliveryAvatarBubble`, etc.).

## 4. Contextes & Hooks
- `DeliveryContext` :
  - Stocke `deliveries`, `events`, `activeDeliveryId`, `loading`, `error`.
  - Connexion WS via `websocketService.connect({ type: 'deliveryTracking' })`.
  - Méthodes exposées : `refreshActiveDeliveries`, `refreshDelivery`, `assignRecipient`, `updateRecipientLocation`, `updateStatus`, `cancel`, `refund`, `registerListener`.
  - Application auto des événements WS (statut, localisation, pricing, panier, `recipient_dropoff`).
- `ShoppingContext` :
  - Stocke panier, estimation, destinataire, budget, solde wallet, états chargement.
  - Méthodes : `addItem`, `updateItem`, `removeItem`, `reset`, `estimate`, `createOrder`, `refreshWalletBalance`, `applyShoppingSummary`.
- Hooks :
  - `useDeliveryTracking(deliveryId)` – synchronise une livraison + timeline avec WS et refresh manuel.
  - `useWalletBalance()` – expose `balance`, `loading`, `error`, `refresh`.

## 5. Services & Types
- Types partagés dans `src/types/delivery.ts` cohérents avec mobile (définitions `DeliverySummary`, `ShoppingBasketItem`, `DeliveryRealtimeEvent`, etc.).
- API clients :
  - `deliveryApi.ts` : `listActiveDeliveries`, `getDeliveryById`, `assignDeliveryRecipient`, `updateRecipientLocation`, `updateDeliveryStatus`, `cancelDelivery`, `debitWalletForDelivery`, `refundDelivery`.
  - `shoppingApi` côté mobile uniquement (front web consomme `ShoppingContext` qui encapsule les mêmes endpoints via `ShoppingContext` interne).
  - Les routes consommées doivent être alignées avec les endpoints backend `/delivery/*`, `/shopping/*`, `/wallet/*`. Un ticket backend suit pour homogénéiser les chemins (`deliveries/*` vs `delivery/*`).
- WebSocket : `websocketService.ts` introduit la cible `deliveryTracking` et supporte reconnexion + ping/pong.

## 6. Suivi temps réel & évènements
- Chaque message WS est converti en `DeliveryRealtimeEvent` puis appliqué côté contexte (`applyEventToDelivery`).
- Historique limité à 50 événements par livraison côté front pour éviter les fuites mémoire.
- En cas d’échec WS, `refreshDelivery` (HTTP) permet de resynchroniser l’état.

## 7. Accessibilité & performances
- Composants Tailwind responsive (grid 1/2 colonnes, messages fallback).
- Interactions principales accessibles au clavier (boutons, formulaires).
- Chargements gérés via états et messages fallback.
- TODO (backend alignement) : optimisation timeline (virtualisation) + carte réelle.

## 8. Points de vigilance restants
- Harmoniser les chemins API entre front et backend (`/delivery` vs `/deliveries`, `/wallet/debit`/`refund`).
- Implémenter plateau carte temps réel (Mapbox/Leaflet) en remplacement du placeholder.
- Vérifier limites de validation côté backend (numéro destinataire, lat/lng).
- ✅ Vitest en place : hook `useDeliveryTracking` simulé avec listeners WS (timeline, refresh, state). Reste à couvrir composants + e2e.
- ✅ Nouveaux tests RTL (Vitest) :
  - `DeliveryLiveMap` mock Leaflet → vérifie fallback sans GPS, markers/trail avec événements courant/destinataire.
  - `DeliveryChatPanel` → couverture flux utilisateur (connexion WS, indicateur de frappe, envoi/erreur message, réception WS).

## 9. Notes QA & automatisation
- Tests UI situés dans `src/components/delivery/__tests__/`.
- Mocks Leaflet/WebSocket pour exécutions headless (pipeline CI future).
- Prévoir `npm run test` (vitest) dans pipeline dès que script ajouté au package.
- ✅ Nouveauté : tests Playwright E2E (`tests/e2e/delivery-tracking.spec.ts`) → monte Vite, intercepte API, simule WebSocket pour vérifier timeline + chat sur `/delivery/:id/tracking`.
- Commandes utiles :
  - `npm run test:e2e` (headless, nécessite `npx playwright install`).
  - `npm run test:e2e:headed` pour observation manuelle.

## 10. Prochaines étapes (côté frontend)
1. Brancher le chat modal web sur `DeliveryContext` (affichage événements temps réel).
2. Ajouter page coursier (checklist, reçu) une fois endpoints backend prêts.
3. Mettre en place carte interactive + partage lien destinataire.
4. Couvrir les scénarios critiques par tests automatiques.


