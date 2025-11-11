PLAN INTÉGRATION FRONTEND – SERVICE LIVRAISON YUKPO
===================================================

## 1. Architecture globale
- **Stacks** : React Native (mobile) + React Web (si décliné). Code partagé via monorepo.  
- **Organisation** :
  - `frontend/src/contexts/DeliveryContext.tsx`
  - `frontend/src/hooks/delivery/`
  - `frontend/src/components/delivery/`
  - `frontend/src/screens/delivery/`
  - `frontend/src/services/deliveryApi.ts`
- Respect des règles repo : logique métier dans hooks/services, composants UI uniquement présentation, TypeScript strict, gestion erreurs robuste.

## 2. DeliveryContext & store
- `DeliveryContext` gère :
  - Livraisons actives (client + coursier).
  - Subscription WebSocket (statuts, tracking).
  - Actions : `requestDelivery`, `confirmDelivery`, `cancelDelivery`, `submitRating`.
  - Cache local des parcel types, engins disponibles, adresses favorites.
- Implementation :
  ```ts
  interface DeliveryState {
    activeDeliveries: Record<string, Delivery>;
    isRequestInProgress: boolean;
    error?: DeliveryError;
    parcelCatalog: ParcelType[];
  }
  ```
- Mémoisation via `useMemo`, `useCallback`.
- Sync AsyncStorage pour reprise en cas de crash.

## 3. Hooks métier
- `useDeliveryRequest()` :
  - State machine locale (étapes du flow).
  - Validation formulaire (Yup / Zod).
  - Upload photos (services storage).
- `useDeliveryTracking(deliveryId)` :
  - Souscription WebSocket.
  - Fallback polling HTTP.
  - Calcul ETA dynamique, distance restant.
- `useCourierApplication()` :
  - Gestion formulaire coursier, upload docs.
- `useDeliveryAvatar()` :
  - Gestion dialogues avatar (messages contextuels, CTA).

## 4. Composants UI principaux
- `DeliveryAvatar` :
  - Animations Lottie (motard / coureur).
  - Props : `mode` (`idle`, `suggestion`, `success`, `warning`), `onAction`.
  - Intégration centralisée via provider pour éviter duplication état.
- `DeliveryRequestStepper` :
  - Étapes : colis → lieux → estimation → confirmation.
  - Barre de progression, boutons Next/Back.
- `ParcelNatureCard` :
  - Liste typologies (icône + description + contrainte).
- `DeliveryLocationPicker` :
  - Map interactive (Mapbox/OSM).
  - Recherche adresse, suggestions historiques.
- `DeliverySummaryCard` :
  - Récap coût, distance, coursier proposé.
- `DeliveryTimeline` :
  - Visualisation statuts (icônes, timestamps).
- `DeliveryTrackingMap` :
  - Carte temps réel, itinéraire, trafic.
- `CourierApplicationForm` :
  - Sections collapsibles (profil, engins, équipements, documents).
- `CourierAssetCard` :
  - Visuel engin + capacités.

## 5. Écrans & navigation
- `DeliveryFlowScreen` : wizard complet.
- `DeliveryTrackingScreen` : suivi temps réel + timeline + chat.
- `DeliveryHistoryScreen` : historique livraisons (client/coursier).
- `CourierApplicationScreen` : onboarding coursier.
- `CourierDashboardScreen` : livraisons à accepter, calendrier, stats.

Navigation :
- Ajouter nouvelle entrée dans `AppNavigator` tab bar : `Livraison` ou badge sur `Home`.  
- Pour coursiers approuvés, tab spécifique `Courses`.
- Deep links :
  - `yukpo://delivery/{id}`
  - `yukpo://courier/registration`

## 6. Points d’intégration UX existants
- `HomeScreen` :
  - Section “Livraison intelligente” avec `DeliveryAvatar`, CTA `Demander une livraison`.
  - Bannière secondaire `Rejoindre Yukpo Livraison` (CTA vue coursier).
- `ProductCard` :
  - Bouton “Programmer une livraison” lorsque produit livrable.
  - Avatar mini affichant disponibilité coursiers.
- `ChatModalMobile` :
  - Message automatique du bot/ avatar proposant d’organiser la livraison.
- `MonCompte` :
  - Section `Services` → carte “Livraison Yukpo”.
  - CTA `Devenir coursier Yukpo` (renvoie `CourierApplicationScreen`).
- `MesServices` / `Dashboard` :
  - Widget livraisons en cours pour prestataires.
- Notifications in-app : usage de `DeliveryAvatar` en overlay pour événements critiques.

## 7. Flux utilisateur (client)
1. Appuie CTA (avatar sur Home, ProductCard, Chat).  
2. Étape colis (sélection type, entrée poids/dimensions, upload photo).  
3. Étape points (map + suggestions).  
4. Review estimation (coût, durée, trajet).  
5. Confirmation → animation avatar “Je trouve le meilleur coursier”.  
6. Suivi temps réel (timeline + map).  
7. Livraison terminée → modale notation.

## 8. Flux utilisateur (coursier)
1. CTA `Devenir coursier Yukpo` → formulaire.  
2. Validation admin → activation.  
3. Tab “Courses” : liste courses disponibles (push temps réel).  
4. Acceptation / refus.  
5. Navigation assistée + validations étapes.  
6. Après livraison : notation client + accès stats, revenus.

## 9. Gestion erreurs & edge cases
- Mode offline : sauvegarder brouillons demande (parcel + lieux) pour reprise.  
- Pas de GPS : fallback sélection manuelle sur carte + message avatar.  
- Aucun coursier compatible : avatar propose alternative (attendre / ajuster colis).  
- Coursier annule : notification + rematching automatique (afficher timer).  
- WebSocket down : fallback polling + message d’information.

## 10. Performance & optimisation
- Mémoisation contextes pour éviter re-render massifs.  
- Suspense/lazy loading pour écrans volumineux (TrackingMap).  
- Cache Mapbox tiles.  
- Détection throttle WebSocket (max 1 update UI / 1s).  
- Usage `useTransition` pour écrans lourds (RN 0.76.9).

## 11. Accessibilité & internationalisation
- Avatar avec texte alternatif + option désactivation animations.  
- Labels explicites pour champs formulaires.  
- Support multilingue (français, anglais) via i18n déjà en place.  
- Contraste respect palette (couleurs #6366F1 et #9CA3AF).

## 12. Sécurité UX
- Validation double confirmation pour annulation après pickup.  
- Vérification numéro téléphone contact (OTP existant?).  
- Protection contre captures données sensibles (blur sur signatures en historisation).

## 13. Stratégie de déploiement UI
- Feature flag `delivery_v1` :
  - Permet test interne (QA) avant généralisation.  
  - Activation progressive par région/utilisateur.
- A/B test optionnel : avatar vs CTA classique.

## 14. Checklist implémentation
1. Créer `DeliveryContext`, hooks, services API.  
2. Implémenter `DeliveryAvatar` (assets Lottie).  
3. Développer `DeliveryFlowScreen` (étapes).  
4. Intégrer `DeliveryTrackingScreen` + WebSocket.  
5. Ajouter CTA et sections sur écrans existants (Home, ProductCard, Chat, MonCompte).  
6. Développer `CourierApplicationScreen` + liaison backend.  
7. Tests unitaires (hooks) & tests UI (React Testing Library, Detox).  
8. Documenter interactions pour équipe support.

## 15. Prochaines étapes
- Valider maquettes avec design.  
- Produire backlog tickets par composant/écran.  
- Coordonner avec backend pour endpoints & WebSocket.  
- Préparer assets avatar (animations, variations).  
- Prévoir séances tests utilisateurs internes.

