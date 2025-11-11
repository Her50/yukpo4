APIS BACKEND & WORKFLOW TEMPS RÉEL – SERVICE LIVRAISON YUKPO
============================================================

## 1. Architecture globale
- Service dédié dans `backend/src/services/delivery/`.
- Contrôleurs Axum regroupés dans `backend/src/controllers/delivery_controller.rs`.
- Routes ajoutées via `backend/src/routes/delivery.rs`.
- Séparation logique :
  - `DeliveryService` (gestion course + transitions).
  - `MatchingService` (sélection coursier).
  - `PricingService` (estimation coût).
  - `TrackingService` (WebSocket + enregistrement GPS).
  - `CourierOnboardingService` (inscription coursiers).
- Utilisation de traits pour testabilité (mock en tests).
- State machine : `DeliveryStateMachine` centralise transitions et validations.

## 2. Endpoints REST (Axum)

### 2.1 Création demande
`POST /api/deliveries`
- Auth : client ou prestataire (JWT).  
- Payload :
  ```json
  {
    "parcel": {
      "type_slug": "fragile",
      "weight_kg": 5.2,
      "volume_cm3": 12000,
      "declared_value": 25000,
      "notes": "Manipuler avec soin",
      "photos": ["https://cdn/..."]
    },
    "pickup": {
      "latitude": 3.85451,
      "longitude": 11.50234,
      "address": "Yaoundé, Bastos",
      "label": "Mon domicile"
    },
    "dropoff": {
      "latitude": 3.86621,
      "longitude": 11.51702,
      "address": "Centre-ville",
      "label": "Bureau"
    },
    "preferences": {
      "contact_phone": "+237...",
      "time_window_start": "2025-11-10T14:00:00Z",
      "time_window_end": "2025-11-10T15:00:00Z",
      "insurance_opt_in": true
    }
  }
  ```
- Réponse :
  ```json
  {
    "delivery_id": "uuid",
    "status": "requested",
    "estimated_distance_m": 3250,
    "estimated_duration_s": 780,
    "pricing_preview": {
      "currency": "XAF",
      "amount_cents": 2500,
      "breakdown": { "base": 1500, "distance": 800, "surcharge": 200 }
    }
  }
  ```

### 2.2 Confirmation client
`POST /api/deliveries/{deliveryId}/confirm`
- Valide la demande après aperçu prix.  
- Déclenche matching coursier (async).  
- Réponse : `202 Accepted` avec `{"status":"awaiting_courier_confirmation"}`.

### 2.3 Récupération détail
`GET /api/deliveries/{deliveryId}`
- Retourne infos complètes (parcel, status, timeline, pricing).

### 2.4 Liste livraisons en cours
`GET /api/deliveries/active`
- Filtre par utilisateur actif (client ou coursier).  
- Résultat : tableau avec résumé + statut.

### 2.5 Annulation par client
`POST /api/deliveries/{deliveryId}/cancel`
- Payload optionnel : `{"reason":"client_cancelled","notes":"Erreur adresse"}`.  
- Conditions : seulement avant `picked_up`.

### 2.6 Acceptation / refus coursier
`POST /api/couriers/me/deliveries/{deliveryId}/accept`  
`POST /api/couriers/me/deliveries/{deliveryId}/reject`
- Auth : coursier.  
- Vérifie statuts & matching actif.

### 2.7 Transition pickup/delivery
`POST /api/couriers/me/deliveries/{deliveryId}/events`
- Payload :
  ```json
  {
    "event": "picked_up",
    "gps": { "lat": 3.85, "lng": 11.50 },
    "proof_photo": "https://cdn/...",
    "signature": "base64"
  }
  ```
- Autorisé pour événements : `arrival_pickup`, `picked_up`, `arrival_destination`, `delivered`.

### 2.8 Notation
`POST /api/deliveries/{deliveryId}/ratings/courier`  
`POST /api/deliveries/{deliveryId}/ratings/client`
- Payload : score 1-5, tags, commentaire.

### 2.9 Tracking
`POST /api/couriers/me/deliveries/{deliveryId}/tracking`
- Pour envoi points GPS (si WebSocket indispo).  
- Payload : `{"latitude":...,"longitude":...,"speed_kmh":35.4}`.

### 2.10 Onboarding coursier
`POST /api/couriers/applications`
- Payload multipart (données + fichiers).  
- Étapes :  
  - `POST /api/couriers/applications/{id}/documents`  
  - `PATCH /api/couriers/applications/{id}` (mise à jour statut).  
`GET /api/couriers/me` pour récupérer profil, assets, statut.

### 2.11 Admin/backoffice (REST ou GraphQL selon existant)
- `GET /api/admin/couriers/applications`  
- `POST /api/admin/couriers/{id}/approve`  
- `POST /api/admin/deliveries/{id}/force-cancel`

## 3. Matching & workers

- Processus déclenché à la confirmation client.
- `MatchingService::match_delivery(delivery_id)` :
  1. Récupère contraintes colis + point pickup.
  2. Recherche coursiers `approved` avec assets compatibles dans rayon (SQL).
  3. Calcule score (distance → 60%, rating → 20%, fiabilité → 10%, disponibilité → 10%).
  4. Insère entrée dans `matching_queue` (table à créer ou job en mémoire).
  5. Envoie notification au coursier #1.
- Si refus / timeout (ex 45s) → passe au suivant.
- Worker asynchrone (Tokio task) gère relances + fallback (élargir rayon).
- Logs structurés pour audit.

## 4. WebSocket temps réel

### 4.1 Endpoint
`GET /ws/deliveries/{trackingToken}`
- Auth : token public (en lecture) + vérification signature/expiration.
- Clients internes (app Yukpo) utilisent JWT + relèvent plus d’infos (ex: contact coursier).

### 4.2 Messages (JSON)
- `delivery_status_update` :
  ```json
  {
    "type": "delivery_status_update",
    "delivery_id": "uuid",
    "status": "en_route_delivery",
    "timestamp": "2025-11-10T14:22:03Z"
  }
  ```
- `courier_location_update` :
  ```json
  {
    "type": "courier_location_update",
    "delivery_id": "uuid",
    "latitude": 3.8571,
    "longitude": 11.5102,
    "speed_kmh": 32,
    "eta_seconds": 300
  }
  ```
- `matching_update` :
  ```json
  {
    "type": "matching_update",
    "delivery_id": "uuid",
    "status": "waiting_courier",
    "candidate_rank": 1,
    "expires_in_seconds": 25
  }
  ```
- `issue_reported` :
  ```json
  {
    "type": "issue_reported",
    "delivery_id": "uuid",
    "message": "Trafic dense détecté, ETA +6 min"
  }
  ```

### 4.3 Gestion connexion
- Timeout inactif : 60s → ping/pong.
- Reconnaissance auto : tentative reconnection via token.
- Historisation messages pour rattrapage (optionnel : ring buffer en mémoire).

## 5. Workflow états (backend)

| État courant | Action | Next state | Conditions |
|--------------|--------|------------|------------|
| `requested` | client confirme | `awaiting_courier_confirmation` | pricing validé |
| `awaiting_courier_confirmation` | coursier accepte | `accepted` | coursier disponible |
| `accepted` | ping tracking actif | `en_route_pickup` | first GPS reçu |
| `en_route_pickup` | arrivée confirmée | `arrival_pickup` | distance < seuil |
| `arrival_pickup` | colis pris | `picked_up` | preuve fournie |
| `picked_up` | départ livraison | `en_route_delivery` | GPS update |
| `en_route_delivery` | arrivée zone | `arrival_destination` | distance < seuil |
| `arrival_destination` | remise colis | `delivered` | photo/signature |
| `delivered` | paiement effectué | `completed` | paiement success |

Transitions invalides → erreur `409 Conflict`.

## 6. Erreurs & validations
- Utiliser `Result<T, AppError>` personnalisé.
- Codes HTTP :
  - `400` : validation.
  - `401` : auth manquante.
  - `403` : rôle non autorisé.
  - `404` : ressource inconnue.
  - `409` : transition invalide / coursier indisponible.
  - `422` : contrainte business (colis incompatible).
  - `500` : erreur interne (log + alert).
- Validation entrée : `serde` + `validator` crate (`#[derive(Deserialize, Validate)]`).
- Logging structuré via `tracing`.

## 7. Notifications
- Module `NotificationService` :
  - push (Firebase / Expo), email, SMS.
  - templates : `delivery_match_found`, `courier_en_route`, `delivery_arrived`, `delivery_delayed`.
- Events émis par state machine → pipeline notifications.

## 8. Sécurité & conformité
- Toutes routes sous `/api/deliveries` nécessitent JWT + scopes (`client`, `courier`, `admin`).
- Rate limiting sur endpoints de tracking (ex: 1 req / 2s).
- Stockage signatures & pièces justificatives chiffré (S3 + KMS).
- Logs d’audit pour actions sensibles (forçage annulation, modification prix).

## 9. Intégration SQLx offline
- Pour chaque endpoint, définir requêtes paramétrées (ex: `sqlx::query!`).
- Après ajout de nouvelles requêtes :  
  `cargo sqlx prepare -- --bin backend` (ou script documented) → met à jour `sqlx-data.json`.
- CI en mode offline : pas d’accès réseau → utiliser DB sqlite “shadow” ou Postgres local via feature `offline`.

## 10. Tâches asynchrones complémentaires
- `DeliveryTimeoutJob` : annule course si aucun coursier dans délai.
- `PricingRecomputeJob` : ajuste prix si variation trafic > seuil avant pickup (avec accord client via notif).
- `RatingAggregationJob` : recalcule `couriers.rating_average`.
- `TrackingCleanupJob` : archive `delivery_tracking_points` > 30 jours.

## 11. Backoffice & API internes
- Dashboard admin (peut utiliser API REST existantes) : visualiser livraisons, matcher manuellement, suspendre coursiers.
- Endpoint interne pour importer données trafic (`POST /internal/traffic`) protégé via token service.

## 12. Prochaines étapes backend
1. Implémenter `delivery_status` enum en Rust + state machine.
2. Ecrire contrôleurs CRUD selon endpoints ci-dessus.
3. Mettre en place `MatchingService` avec tests unitaires (scénarios multi coursiers).
4. Implémenter WebSocket (Axum `WebSocketUpgrade`) + tests d’intégration.
5. Ajouter notifications (integration avec service existant).

## 13. Compléments livraison (2025-11)

- **Endpoints destinataire & wallet (Axum `/delivery/...`)**
  - `POST /delivery/{id}/recipient` : assigne les informations destinataire enrichies (phone normalisé, consentements, `dropoff_override`).
  - `GET /delivery/{id}/recipient` : expose le profil/état courant (après contrôle d’accès client/coursier/destinataire).
  - `POST /delivery/{id}/recipient/location` : met à jour la position transmise par le destinataire (WS + historique).
  - `POST /wallet/debit` / `POST /wallet/refund` : débit/remboursement instantané du portefeuille livraison (JWT requis).
- **Observabilité** : exposition Prometheus via `GET /metrics/delivery` (public, format `text/plain; version=0.0.4`).
  - `delivery_recipient_dropoff_events_total`
  - `delivery_wallet_debit_events_total`
  - `delivery_wallet_refund_events_total`
  - `delivery_wallet_debit_amount_cents_total`
  - `delivery_wallet_refund_amount_cents_total`
- **Tests d’intégration** : scénario bout-en-bout (assignation destinataire, mise à jour dropoff, débit/refund wallet) vérifiant les métriques et la restitution JSON.
- **Audit & traçabilité** : table `delivery_wallet_events` (auto-migration) consignant chaque mutation (`debit`/`refund`, solde après opération, raison, métadonnées).

