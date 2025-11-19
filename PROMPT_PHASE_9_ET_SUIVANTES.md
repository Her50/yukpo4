# 🚀 PROMPT : Phase 9 et Phases Suivantes - Système de Livraison Intelligent Yukpomnang

## 📋 CONTEXTE DU PROJET

### Structure du Projet
- **Monorepo** : `C:\Users\23767\yukpomnang2`
- **Backend** : Rust avec Axum, SQLx, PostgreSQL (avec pgvector et imgsmlr)
- **Frontend** : React avec TypeScript, TailwindCSS
- **Mobile** : React Native avec Expo, TypeScript
- **Base de données** : PostgreSQL sur Render, SQLx offline mode (`SQLX_OFFLINE=true`)

### Règles de Développement
- Toujours vérifier le code existant avant de modifier
- Toutes les migrations SQLx doivent être en mode offline, intégrées dans `auto_migrate`, ajoutées à `0000_create_all_tables.sql` (ou équivalent), et `sqlx-data.json` doit être régénéré
- Utiliser `Result<T, E>` pour la gestion d'erreurs
- Valider toutes les entrées utilisateur
- Utiliser TypeScript strictement

## ✅ CE QUI A ÉTÉ FAIT (Phases 0-8)

### Phase 0 : Exploration et Vérification de l'Existant ✅
- Rapport d'exploration créé (`PHASE_0_EXPLORATION_RAPPORT.md`)

### Phase 1 : Fondations ✅
- **Amélioration 1** : Systématisation des infos de livraison
  - Table `product_delivery_config` créée
  - Service de validation backend
  - Formulaires frontend/mobile pour configuration
  - Bouton transversal pour configurer tous les produits

### Phase 2 : Améliorations du Flux de Commande et Validation ✅
- **Amélioration 4** : Auto-remplissage adresses (déjà implémenté)
- **Amélioration 5** : Modification adresses à tout moment
  - Backend : fonction pour mettre à jour pickup
  - WebSocket event pour notifier les changements
  - Recalcul de distance si dropoff déjà défini
- **Amélioration 6** : Formulaire persistant si infos manquantes
  - Notification au prestataire si configuration incomplète
  - Endpoint de validation produit

### Phase 3 : Intelligence Avancée ✅
- **Amélioration 7** : Plages horaires prestataire/client et matching intelligent
  - Table `client_delivery_preferences` créée
  - Service `DeliveryScheduleService` créé
  - API endpoints pour préférences client
  - Intégration dans le matching
  - UI frontend/mobile pour spécifier préférences

### Phase 4 : Externalisation ✅
- **Amélioration 8** : Livraison pour prestataires WhatsApp/Facebook
  - Tables `external_delivery_providers` et `public_tracking_tokens` créées
  - Routes API publiques (`/api/external/delivery`, `/api/external/track/:token`)
  - Validation API key, conversion payload, génération tokens
  - Webhooks pour notifier les providers externes
  - Système de "system users" pour providers externes

### Phase 5 : Gestion Financière Avancée ✅
- **Améliorations 10-15** : Gestion financière avancée
  - Table `delivery_payment_reservations` créée
  - Service `DeliveryPaymentService` créé
  - Réservation de paiement avant matching
  - Débit définitif quand coursier accepte
  - Reversement prestataire avec commission (5% par défaut, configurable via `YUKPO_COMMISSION_RATE`)
  - Gestion rejet produit (remboursement sans commission)
- **Extension** : Matching intelligent des modes de paiement
  - Colonnes `payment_methods` dans `users`
  - Service `PaymentMatchingService` créé
  - Matching MTN Money / Orange Money / Wallet interne
  - Stubs pour futures APIs mobile money
  - Documentation d'intégration créée

### Phase 6 : Automatisation Intelligente ✅
- **Améliorations 16-20** : Automatisation intelligente
  - Détection GPS automatique (proximité 50m)
  - Suggestions automatiques changement de statut
  - Table `delivery_proximity_suggestions` créée
  - WebSocket event `ProximitySuggestion`
  - Notifications push automatiques (tous les statuts importants)
  - Préparation SMS/Email (feature flags, provider selection)
  - Tâche `delivery_timeout_monitor` créée
    - Auto-confirmation après 30 secondes
    - Alertes après 2 minutes si pas de confirmation

### Phase 7 : Améliorations UX Studio Vidéo ✅
- **Améliorations 21-23** : Améliorations UX Studio Vidéo
  - Auto-remplissage Brief IA depuis description produit/service
  - Endpoint `POST /api/studio/sessions/{session_id}/suggestions` créé
  - Suggestions IA avancées avec fallback
  - Affichage coûts dans `OrderDeliveryModal` (produit + livraison)
  - Récupération coûts depuis API `/api/delivery/estimate-costs`
  - Application mobile : même améliorations

### Phase 8 : Points d'Entrée Commande Multiples ✅
- **Amélioration 24** : Commande depuis ProductCard
  - Bouton "Se faire livrer" uniquement pour produits (pas prestations)
  - Modal `OrderDeliveryModal` intégré
- **Amélioration 25** : Commande depuis ChatModal
  - Bouton "Commander avec livraison" dans le chat
  - Intégration `OrderDeliveryModal` dans `ChatModal` (frontend et mobile)
- **Amélioration 26** : Sélection multi-produits
  - Sélection multiple de produits dans `OrderDeliveryModal`
  - Coût de livraison indépendant du nombre de produits
  - Affichage des promotions (produit et globales)
- **Extension** : Système de prix négociés
  - Table `negotiated_prices` créée
  - Service `NegotiatedPriceService` créé
  - Routes API pour créer/accepter/rejeter prix négociés
  - Intégration dans `ProductPriceService` (priorité absolue)
  - Composants `NegotiatedPriceModal` (frontend et mobile)
  - Intégration dans `ChatModal` avec bouton "💰 Négocier un prix"
  - Utilisation de l'ID réel de conversation (avec fallback sur `service.id`)

## ⏳ CE QUI RESTE À FAIRE (Phase 9)

### Amélioration 27 : Page publique dropoff ✅
**Statut** : DÉJÀ IMPLÉMENTÉ (Phase 4)
- Page publique pour clients sans compte
- Lien de partage pour fournir adresse de livraison

### Amélioration 28 : Sélection livreur personnel ⏳
**Objectif** : Permettre au prestataire de choisir son propre livreur pour une livraison

**Implémentation nécessaire** :
1. **Backend** :
   - Ajouter champ `preferred_courier_id` dans `delivery_requests` ou `deliveries`
   - Modifier le matching pour prioriser le livreur choisi
   - Endpoint `POST /api/delivery/{id}/assign-courier` pour assigner manuellement
   - Vérifier que le coursier choisi est disponible et éligible

2. **Frontend/Mobile** :
   - Interface pour sélectionner un livreur dans la liste des coursiers disponibles
   - Afficher les coursiers disponibles avec leurs stats (taux de réussite, temps moyen)
   - Bouton "Choisir un livreur" dans l'interface prestataire

### Amélioration 29 : Notification client fournit adresse ⏳
**Objectif** : Alerter le prestataire quand le client fournit son adresse de livraison

**Implémentation nécessaire** :
1. **Backend** :
   - WebSocket event `DropoffAddressProvided` quand dropoff est confirmé
   - Notification push au prestataire
   - Optionnel : Email/SMS notification

2. **Frontend/Mobile** :
   - Badge/notification dans l'interface prestataire
   - Timeline de la livraison mise à jour

### Amélioration 30 : Amélioration UX dropoff pending ⏳
**Objectif** : Meilleure gestion du dropoff temporaire/optionnel

**Implémentation nécessaire** :
1. **Backend** :
   - Statut `dropoff_pending` plus clair
   - Permettre modification dropoff même après matching
   - Recalculer distance si dropoff change

2. **Frontend/Mobile** :
   - Interface claire pour "Adresse à confirmer"
   - Bouton "Modifier l'adresse" visible et accessible
   - Indicateur visuel que l'adresse est temporaire

### Amélioration 31 : Chaînage vidéos lors création ⏳
**Objectif** : Définir des vidéos liées pendant la création de vidéo

**Implémentation nécessaire** :
1. **Backend** :
   - Table `video_dependencies` ou champ dans `video_sessions`
   - Endpoint pour définir les dépendances
   - Navigation automatique vers vidéo suivante

2. **Frontend/Mobile** :
   - Sélecteur de vidéos liées dans le wizard de création
   - Affichage des vidéos liées dans la timeline

### Amélioration 32 : Plusieurs lieux de stock ⏳
**Objectif** : Prestataire peut avoir plusieurs points de départ, matching choisit le plus proche

**Implémentation nécessaire** :
1. **Backend** :
   - Table `merchant_storage_locations` (plusieurs pickup par prestataire)
   - Modifier `product_delivery_config` pour référencer un `storage_location_id`
   - Modifier le matching pour calculer distance depuis tous les points de stock
   - Choisir le point le plus proche du dropoff

2. **Frontend/Mobile** :
   - Interface pour gérer plusieurs lieux de stock
   - Sélection du lieu de stock lors de la configuration produit
   - Affichage du lieu de stock choisi dans les détails de livraison

### Amélioration 33 : Renommage pickup/dropoff ⏳
**Objectif** : Remplacer par termes plus naturels : "départ" et "destination"

**Implémentation nécessaire** :
1. **Backend** :
   - Optionnel : Alias dans les réponses API (`departure`/`destination` en plus de `pickup`/`dropoff`)
   - Garder les noms techniques en base de données

2. **Frontend/Mobile** :
   - Remplacer tous les labels "pickup" par "Point de départ"
   - Remplacer tous les labels "dropoff" par "Destination" ou "Point de livraison"
   - Mettre à jour les messages utilisateur
   - Fichiers à modifier :
     - `frontend/src/components/delivery/OrderDeliveryModal.tsx`
     - `mobile/src/components/delivery/OrderDeliveryModal.tsx`
     - `frontend/src/components/delivery/ProductDeliveryConfigModal.tsx`
     - `mobile/src/components/delivery/ProductDeliveryConfigModal.tsx`
     - Tous les autres composants de livraison

## 📋 FICHIERS IMPORTANTS À CONNAÎTRE

### Backend
- `backend/src/migrations/auto_migrate.rs` : Migrations automatiques
- `backend/src/services/delivery_service.rs` : Service principal de livraison
- `backend/src/services/delivery_repository.rs` : Repository pour accès DB
- `backend/src/routes/delivery_routes.rs` : Routes API livraison
- `backend/src/models/delivery_model.rs` : Modèles de données
- `backend/src/services/product_price_service.rs` : Calcul prix avec promotions et prix négociés
- `backend/src/services/negotiated_price_service.rs` : Gestion prix négociés
- `backend/src/tasks/delivery_timeout_monitor.rs` : Monitor des timeouts

### Frontend
- `frontend/src/components/delivery/OrderDeliveryModal.tsx` : Modal commande livraison
- `frontend/src/components/delivery/ProductDeliveryConfigModal.tsx` : Configuration livraison produit
- `frontend/src/components/chat/ChatModal.tsx` : Chat avec intégration commande
- `frontend/src/components/chat/NegotiatedPriceModal.tsx` : Modal prix négociés

### Mobile
- `mobile/src/components/delivery/OrderDeliveryModal.tsx` : Modal commande livraison
- `mobile/src/components/delivery/ProductDeliveryConfigModal.tsx` : Configuration livraison produit
- `mobile/src/components/ChatModalMobile.tsx` : Chat avec intégration commande
- `mobile/src/components/chat/NegotiatedPriceModal.tsx` : Modal prix négociés

## 🔧 POINTS CRITIQUES À RETENIR

1. **Migrations SQLx** : Toujours en mode offline, intégrer dans `auto_migrate.rs` et `0000_create_all_tables.sql`
2. **Prix négociés** : Priorité absolue (Prix négocié > Promotion produit > Promotion globale > Prix de base)
3. **Conversation ID** : Utiliser l'ID réel de conversation si disponible, sinon `service.id` (fallback)
4. **Sécurité prix négociés** : Filtrage par `client_user_id` garantit l'isolation entre clients
5. **Coût livraison** : Indépendant du nombre de produits (calculé une seule fois)
6. **Commission** : 5% par défaut, configurable via `YUKPO_COMMISSION_RATE`
7. **Rejet produit** : Pas de commission, remboursement prix produit, coût livraison non remboursé

## 📝 ORDRE D'IMPLÉMENTATION RECOMMANDÉ (Phase 9)

1. **Amélioration 33** : Renommage pickup/dropoff (le plus simple, impact UX immédiat)
2. **Amélioration 30** : UX dropoff pending (améliore l'expérience existante)
3. **Amélioration 29** : Notification adresse (améliore la communication)
4. **Amélioration 28** : Sélection livreur (fonctionnalité importante)
5. **Amélioration 32** : Plusieurs lieux de stock (complexité moyenne)
6. **Amélioration 31** : Chaînage vidéos (fonctionnalité avancée)

## 🎯 INSTRUCTIONS POUR CONTINUER

1. **Commencer par l'Amélioration 33** (Renommage) car c'est la plus simple
2. **Vérifier les erreurs de compilation** après chaque modification
3. **Tester les fonctionnalités** après chaque amélioration
4. **Documenter** les changements dans un fichier de suivi
5. **Respecter les règles** : migrations offline, vérification code existant, etc.

## 📚 DOCUMENTATION DE RÉFÉRENCE

- `PLAN_COMPLET_AMELIORATIONS_LIVRAISON.md` : Plan détaillé de toutes les améliorations
- `PROMPT_IMPLEMENTATION_AMELIORATIONS_LIVRAISON.md` : Prompt original d'implémentation
- `RESUME_COMPLET_IMPLEMENTATION.md` : Résumé de ce qui a été fait
- `ANALYSE_SECURITE_PRIX_NEGOCIES.md` : Analyse sécurité prix négociés
- `ARCHITECTURE_GESTION_FINANCIERE_LIVRAISON.md` : Architecture gestion financière
- `DOCUMENTATION_INTEGRATION_APIS_MOBILE_MONEY.md` : Documentation intégration mobile money

## 🔍 DÉTAILS TECHNIQUES IMPORTANTS

### Structure des Tables Existantes

#### `product_delivery_config`
- `service_id`, `product_index`
- `pickup_address`, `pickup_latitude`, `pickup_longitude`
- `required_vehicle_type_id`
- `pickup_availability_schedule` (JSONB)
- `billing_mode` ('standard' ou 'merchant_inclusive')
- `is_configured` (boolean)

#### `deliveries`
- `id` (UUID)
- `service_id`, `creator_id`, `recipient_user_id`
- `pickup_latitude`, `pickup_longitude`, `pickup_address`
- `dropoff_latitude`, `dropoff_longitude`, `dropoff_address`
- `status` (enum DeliveryStatus)
- `courier_id` (optionnel)

#### `delivery_payment_reservations`
- `delivery_id`, `client_user_id`
- `product_price_cents`, `delivery_cost_cents`
- `billing_mode`
- `status` ('reserved', 'confirmed', 'released', 'refunded')
- `client_payment_method`, `merchant_payment_method`, `payout_method_used`

#### `negotiated_prices`
- `conversation_id`, `service_id`, `product_index`
- `merchant_user_id`, `client_user_id`
- `original_price_cents`, `negotiated_price_cents`
- `status` ('pending', 'accepted', 'rejected', 'expired')
- UNIQUE(conversation_id, service_id, product_index, client_user_id)

### Services Backend Importants

#### `DeliveryService`
- `create_delivery_request()` : Crée une demande de livraison
- `update_delivery_status()` : Met à jour le statut
- `check_proximity_and_suggest_status_update()` : Détection GPS
- `enqueue_delivery_matching()` : Lance le matching

#### `DeliveryPaymentService`
- `reserve_payment()` : Réserve les fonds
- `confirm_payment()` : Confirme le paiement
- `payout_merchant()` : Reverse au prestataire
- `handle_product_rejection()` : Gère le rejet produit

#### `ProductPriceService`
- `get_real_product_price()` : Calcule le prix réel avec promotions et prix négociés
- Priorité : Prix négocié > Promotion produit > Promotion globale > Prix de base

### Endpoints API Importants

- `POST /api/delivery/client-order` : Créer une commande client
- `POST /api/delivery/estimate-costs` : Estimer les coûts
- `POST /api/delivery/{id}/update-status` : Mettre à jour le statut
- `POST /api/negotiated-prices` : Créer/mettre à jour prix négocié
- `POST /api/negotiated-prices/{id}/accept` : Accepter prix négocié
- `POST /api/negotiated-prices/{id}/reject` : Rejeter prix négocié

## 🎯 DÉTAILS PAR AMÉLIORATION (Phase 9)

### Amélioration 28 : Sélection livreur personnel

**Backend** :
1. Ajouter `preferred_courier_id` dans `delivery_requests` ou `deliveries`
2. Modifier `enqueue_delivery_matching()` pour vérifier si `preferred_courier_id` est défini
3. Si défini, assigner directement ce coursier (vérifier disponibilité)
4. Endpoint `POST /api/delivery/{id}/assign-courier` avec payload `{ courier_id: number }`
5. Vérifier que le coursier est actif et éligible

**Frontend/Mobile** :
1. Endpoint `GET /api/couriers/available?service_id={id}` pour lister les coursiers
2. Interface de sélection avec stats (taux réussite, temps moyen, distance)
3. Bouton "Choisir un livreur" dans l'interface prestataire (dashboard livraisons)

### Amélioration 29 : Notification client fournit adresse

**Backend** :
1. Dans `update_delivery_status()` ou `create_delivery_request()`, détecter quand dropoff est confirmé
2. Envoyer WebSocket event `DropoffAddressProvided` au prestataire
3. Notification push via `push_notification_service::send_push_notification()`
4. Optionnel : Email/SMS si configuré

**Frontend/Mobile** :
1. Écouter l'événement WebSocket `DropoffAddressProvided`
2. Afficher badge/notification dans l'interface prestataire
3. Mettre à jour la timeline de la livraison

### Amélioration 30 : Amélioration UX dropoff pending

**Backend** :
1. Permettre modification dropoff même si statut > `Requested`
2. Recalculer distance si dropoff change
3. Mettre à jour le pricing si nécessaire

**Frontend/Mobile** :
1. Badge "Adresse à confirmer" si dropoff temporaire
2. Bouton "Modifier l'adresse" toujours visible
3. Indicateur visuel (icône, couleur) pour adresse temporaire

### Amélioration 31 : Chaînage vidéos

**Backend** :
1. Table `video_dependencies` :
   ```sql
   CREATE TABLE video_dependencies (
       id SERIAL PRIMARY KEY,
       parent_session_id INTEGER NOT NULL REFERENCES video_sessions(id),
       child_session_id INTEGER NOT NULL REFERENCES video_sessions(id),
       order_index INTEGER,
       created_at TIMESTAMPTZ DEFAULT NOW()
   )
   ```
2. Endpoint `POST /api/studio/sessions/{id}/dependencies` pour définir dépendances
3. Endpoint `GET /api/studio/sessions/{id}/next` pour récupérer vidéo suivante

**Frontend/Mobile** :
1. Sélecteur de vidéos dans le wizard de création
2. Affichage des vidéos liées dans la timeline
3. Navigation automatique vers vidéo suivante

### Amélioration 32 : Plusieurs lieux de stock

**Backend** :
1. Table `merchant_storage_locations` :
   ```sql
   CREATE TABLE merchant_storage_locations (
       id SERIAL PRIMARY KEY,
       merchant_user_id INTEGER NOT NULL REFERENCES users(id),
       name TEXT NOT NULL,
       address TEXT NOT NULL,
       latitude DOUBLE PRECISION NOT NULL,
       longitude DOUBLE PRECISION NOT NULL,
       is_active BOOLEAN DEFAULT TRUE,
       created_at TIMESTAMPTZ DEFAULT NOW()
   )
   ```
2. Modifier `product_delivery_config` : ajouter `storage_location_id` (optionnel, fallback sur service GPS)
3. Modifier le matching : calculer distance depuis tous les points de stock actifs
4. Choisir le point le plus proche du dropoff

**Frontend/Mobile** :
1. Interface pour gérer plusieurs lieux de stock (CRUD)
2. Sélection du lieu de stock lors de la configuration produit
3. Affichage du lieu de stock choisi dans les détails de livraison

### Amélioration 33 : Renommage pickup/dropoff

**Backend** :
- Optionnel : Ajouter alias dans réponses API
- Garder les noms techniques en DB

**Frontend/Mobile** :
- Remplacer tous les labels utilisateur :
  - "pickup" → "Point de départ" ou "Départ"
  - "dropoff" → "Destination" ou "Point de livraison"
- Fichiers à modifier :
  - `OrderDeliveryModal.tsx` (frontend et mobile)
  - `ProductDeliveryConfigModal.tsx` (frontend et mobile)
  - Tous les composants de livraison
  - Messages d'erreur et de succès

## ✅ CHECKLIST AVANT DE COMMENCER

- [ ] Lire ce prompt en entier
- [ ] Vérifier que toutes les phases 0-8 sont bien complétées
- [ ] Vérifier qu'il n'y a pas d'erreurs de compilation
- [ ] Comprendre la structure des fichiers mentionnés
- [ ] Commencer par l'Amélioration 33 (Renommage)

## 📝 NOTES FINALES

- **Toujours vérifier le code existant** avant de modifier
- **Tester après chaque modification**
- **Documenter les changements** dans un fichier de suivi
- **Respecter les conventions** de nommage et de structure
- **Gérer les erreurs** proprement avec des messages clairs

---

**Bonne continuation ! 🚀**


