SERVICE LIVRAISON INTELLIGENT YUKPO
===================================

## 1. Contexte & objectifs
- Offrir un service de livraison “hyper intelligent” intégré à Yukpo, couvrant l’ensemble du cycle (demande, matching, exécution, suivi, paiement, notation).
- Optimiser l’expérience utilisateur via un avatar omniprésent représentant le service.
- Garantir un matching précis entre colis, coursiers et engins en tenant compte des contraintes terrain, trafic et équipements nécessaires.
- Assurer une traçabilité complète et un calcul de coût dynamique basés sur des données temps réel.

## 2. Personas & cas d’usage
- **Client particulier** : souhaite envoyer un paquet ponctuel, suit le colis en temps réel.
- **Prestataire professionnel** : planifie des livraisons récurrentes ou urgentes.
- **Coursier** : accepte des courses adaptées à ses équipements, gère son planning et sa réputation.
- **Opérateur Yukpo** : supervise le service, gère les coursiers, analyse la performance.

Cas principaux :
1. Demande livraison simple (client → coursier).
2. Demande avec exigences spécifiques (fragile, médical).
3. Absence de coursier compatible → suggestions alternatives.
4. Suivi temps réel multicanal (mobile, web).
5. Notation bilatérale post-course.
6. Inscription d’un nouveau coursier et validation administrative.

## 3. Expérience utilisateur & avatar
- Avatar “Yukpo Delivery” (visuel moto / coureur) présent :
  - `HomeScreen`, `ProductCard`, `ChatModalMobile`, sections profil.
  - Notifications proactives (bulle conversationnelle, CTA contextuels).
- CTA principaux :
  - “Demander une livraison” (clients/prestataires).
  - “Suivre mon colis” (trackers actifs).
  - “Rejoindre Yukpo Livraison” (coursiers potentiels).
- Guidelines avatar :
  - Ton professionnel + chaleureux.
  - Animations légères pour actions clés (matching trouvé, départ, arrivée).
  - Accessibilité : texte alternatif, compatibilité mode sombre.

## 4. Workflow détaillé (état par état)
1. **requested** : client lance le flow depuis un CTA.
2. **collect_parcel_info** : description colis (catégorie, poids, dimensions, contraintes, photos → analyse IA).
3. **select_locations** : choix point retrait + livraison (GPS, adresses sauvegardées, carte interactive).
4. **pre_match** : estimation initiale distance/temps sans coursier.
5. **awaiting_courier_confirmation** :
   - Filtrage coursiers disponibles par proximité pickup (< rayon configurable).
   - Filtre par compatibilité engin/équipement selon nature colis.
   - Classement par distance pickup (critère prioritaire), puis score composite (notation, fiabilité, historique, disponibilité).
   - Envoi proposition au coursier #1 (push + app).
6. **accepted** : coursier accepte → verrouillage prix, affichage timeline temps réel.
7. **en_route_pickup** : suivi GPS coursier, ETA dynamique, alertes trafic.
8. **arrival_pickup** : confirmation arrivée (scan QR, photo).
9. **picked_up** : validation colis récupéré (horodatage, preuve).
10. **en_route_delivery** : navigation optimisée (trafic, segments difficiles), suivi carte pour client.
11. **arrival_destination** : notification arrivée.
12. **delivered** : photo/sigature, code vérification.
13. **completed** : paiement final, reçu, notation bilatérale.
14. **cancelled** : annulation (client/coursier/problème colis) avec motif et gestion remboursement.

Transitions gérées par backend via événements authentifiés + WebSockets pour diffusion front.

## 5. Matching intelligent & reconnaissance colis
- **Typologie colis** : catalogue configurable (`alimentaire`, `fragile`, `volumineux`, `document`, `urgent`, `médical`, etc.).
- Chaque type possède des contraintes (poids max, dimensions, température, manipulation).
- **Récolte données colis** :
  - Formulaire guidé avec tags + saisie libre.
  - Upload photos (optionnel) → service IA (vision) pour estimer volume / proposer engin.
  - Historique des colis similaires pour suggestions rapides.
- **Matching coursier** :
  - Requête sur coursiers disponibles dans rayon (SQL + index géo).
  - Vérification assets (`courier_assets`) : type engin, équipements, capacité.
  - Score = f(distance pickup, adéquation engin, rating, compliance, disponibilité).
  - Si aucun coursier idéal → proposer attente, rayon étendu, ou engin supérieur (avec ajustement prix).
- **Reco intelligente** :
  - Pipeline IA asynchrone (timeout + fallback heuristique).
  - Validation côté backend pour éviter suggestions incohérentes.

## 6. Interface inscription coursier
- Nouvel écran accessible via CTA “Rejoindre Yukpo Livraison” (Homescreen + Section `MonCompte` + bannière avatar).
- Flow inscription :
  1. Informations personnelles (identité, contact, documents légaux).
  2. Types d’engins + équipements (photos justificatives, capacité, disponibilité par plage horaire).
  3. Zones de couverture, rayon favori, préférences courses.
  4. Vérification documents (backoffice).
  5. Activation compte + tutoriel.
- Backend :
  - Endpoint création dossier coursier.
  - Stockage documents (S3/bucket).
  - Workflow validation (statuts : `pending_review`, `approved`, `rejected`, `suspended`).

## 7. Modèle de données (aperçu)
- `deliveries` : id, creator_id, courier_id, parcel_id, pickup_point (geometry), dropoff_point (geometry), status enum, pricing_id, created_at…
- `delivery_events` : horodatages transitions (pickup_time, dropoff_time…).
- `delivery_parcel` : type_id, weight_kg, volume_cm3, constraints JSON, photos.
- `parcel_types` : catalogue configuré (nom, contraintes, métadonnées).
- `couriers` : profil coursier (user_id, statut, rating global, disponibilité).
- `courier_assets` : engin_type enum, capacities, equipments JSON, is_primary, availability.
- `courier_ratings` : delivery_id, score, tags, commentaires.
- `pricing_rules` : coefficients base, distance, surcharge trafic/terrain, surcharge équipement.
- `traffic_snapshots` / `terrain_segments` : données analytiques stockées pour calibration.
- `delivery_tracking_points` : positions GPS historisées (optionnel).

### Contraintes SQLx offline
- Préparer migrations sous `backend/migrations/` :
  - `000X_create_delivery_tables.sql`.
  - `000Y_seed_parcel_types.sql`.
- Insérer les données initiales (types colis, engins) via fichiers `auto_migrate/*.sql` pour cohérence avec conventions existantes (voir migrations en place).
- Utiliser `sqlx migrate build` pour générer métadonnées offline et mettre à jour `sqlx-data.json`.
- Chaque requête SQL ajoutée doit être recompilée avec la base fictive offline (`cargo sqlx prepare -- --lib`) selon processus décrit dans `CHOIX_SQLX_OFFLINE.md`.

## 8. APIs backend Axum
- **REST endpoints** (exemples) :
  - `POST /api/deliveries` : créer une demande (payload colis + lieux + préférences).
  - `POST /api/deliveries/{id}/confirm` : confirmation client après estimation prix.
  - `POST /api/deliveries/{id}/accept` : acceptation coursier.
  - `POST /api/deliveries/{id}/events` : transitions (pickup, delivered…).
  - `GET /api/deliveries/{id}` : récupérer état + timeline.
  - `GET /api/deliveries/active` : liste en cours pour utilisateur connecté.
  - `POST /api/couriers/applications` : inscription coursier.
  - `GET /api/couriers/me` : voir profil coursier + disponibilité.
  - `PATCH /api/couriers/me/assets` : mettre à jour engins/équipements.
- **WebSocket livraison** :
  - Auth obligatoire (JWT) pour client et coursier. Endpoint serveur : `GET /delivery/{id}/ws`.
  - Messages JSON (`DeliveryWsEvent`) :
    - `status` (statut + motif éventuel d’annulation),
    - `location` (lat/lng, vitesse, bearing, précision optionnels),
    - `pricing` (détails tarification calculée).
  - Broadcast en mémoire via `DeliveryTrackingManager` (channel circulaire, cleanup si plus d'abonnés).
  - Reconnexion : client gère le retry, côté serveur pas de persistance (statut reconsommé via REST au connect).
  - Logging/metrics : nombre d’abonnés par course, temps moyen diffusion, taux d’erreur sérialisation.
- **Services internes** :
  - Module matching (trait service).
  - Module pricing (avec injection dépendances trafic/terrain).
  - Module notification (push, email, in-app).
  - Module rating & reputation (agrégation, recalcul périodique).

## 9. Architecture frontend
- **Contexte global** : `DeliveryContext` stocke états actifs, subscriptions WebSocket, paramètres par utilisateur.
- **Hooks** :
  - `useDeliveryRequest()` : création + mise à jour étapes (colis, lieux, estimation).
  - `useDeliveryTracking(deliveryId)` : écoute temps réel, calcul ETA local.
  - `useCourierApplication()` : flow inscription coursier.
  - `usePricingPreview()` : prévisualisation coûts (throttling, caching).
- **Composants** :
  - `DeliveryAvatar` : animations, dialogues, CTA, personnalisation selon contexte.
  - `DeliveryRequestForm` : étapes multi-écrans, validation, upload photos.
  - `DeliveryTimeline` : visualisation status + timestamps.
  - `DeliveryMapView` : carte interactive (Mapbox/OSM) avec couches trafic + segments terrain.
  - `CourierApplicationForm` : sections informations, engins, documents.
  - `DeliverySummaryCard` : récap course intégrable sur `ProductCard`, `ChatModal`.
- **Navigation** :
  - Ajouter routes `DeliveryFlow`, `DeliveryTracking`, `CourierOnboarding`.
  - Intégration avatar dans `TabIcon` existant (couleur focus #6366F1, inactive #9CA3AF).
- **Gestion erreurs & accessibilité** :
  - Notifications en cas d’échec matching, absence GPS, upload photo invalide.
  - Support offline (sauvegarde brouillon demande).

## 10. IA & analytics
- **Estimation durée/coût** :
  - Algorithme hybride : heuristiques (distance, segments) + API trafic tiers + ajustement dynamique selon historique.
  - Timeout + fallback (valeurs moyennes) pour fiabilité.
- **Reconnaissance colis** :
  - Pipeline IA vision (optionnel phase 2) : classification volume/fragilité.
  - Stocker feedback utilisateurs pour améliorer suggestions.
- **Scoring coursier** :
  - Score combiné : proximité, compat engin, rating, taux réussite, délais.
  - Mise à jour après chaque course (job batch).
- **Reporting** :
  - Dashboard interne : temps moyen, satisfaction, incidents, ratio matches réussis.

## 11. Notifications & communications
- Push + in-app pour clients (acceptation, arrivée pickup/destination, incidents).
- Push + in-app pour coursiers (nouvelles courses, rappels, documents expirant).
- Emails/SMS optionnels pour confirmations critiques.
- Historisation des messages dans `chatModal` via avatar (ex : “Le coursier est en route, ETA 12 min”).

## 12. Sécurité & conformité
- Authentification JWT existante (clients/coursiers).
- Autorisations fines (un utilisateur ne peut consulter que ses livraisons).
- Chiffrement données sensibles (documents coursier, signatures).
- Audit log pour transitions états et modifications tarifaires.
- Protection anti-fraude (limiter modifications après confirmation, détection anomalies GPS).

## 13. Qualité, tests & monitoring
- **Tests unitaires** : services matching, pricing, transitions états.
- **Tests intégration** : endpoints Axum, WebSocket, interactions DB (via `sqlx` offline + tests docker).
- **Tests E2E** : scénarios mobile/web (création livraison, matching auto, suivi, feedback).
- **Monitoring** :
  - Logs structurés (traces Axum, WebSocket).
  - Metrics (Prometheus/Grafana) : temps de matching, taux cancel, retards.
  - Alertes sur indisponibilité API trafic, dépassements ETA.

## 14. Roadmap & jalons
1. **Semaine 1-2** : spécification complète (ce document), maquettes UX, ateliers données.
2. **Semaine 3-4** : implémentation backend (migrations SQLx, endpoints principaux, matching MVP).
3. **Semaine 5-6** : intégration frontend (flow demande, tracking, avatar).
4. **Semaine 7** : inscription coursier + backoffice minimal.
5. **Semaine 8** : IA estimation trafic + reconnaissance colis (version 1).
6. **Semaine 9** : tests E2E, optimisation performances, monitoring.
7. **Semaine 10** : bêta interne, retours, ajustements, préparation lancement public.

## 15. Risques & plans d’atténuation
- **Disponibilité API trafic** : prévoir fallback heuristique + cache.
- **Exactitude matching engin** : mettre en place validations manuelles initialement + collecte feedback.
- **Adoption coursiers** : simplifier onboarding, accompagnement terrain, plan incentives.
- **Complexité avatar omniprésent** : créer composants réutilisables + guidelines strictes.
- **Performance WebSocket** : tester à charge, limiter fréquence updates, compresser payloads.

## 16. Prochaines actions concrètes
- Valider cette spécification avec stakeholders.
- Démarrer conception détaillée modèle de données + migrations (`task-2`).
- Lister CTA existants et plan d’insertion avatar + bouton “Rejoindre Yukpo Livraison”.
- Préparer backlog technique (issues) selon roadmap ci-dessus.

