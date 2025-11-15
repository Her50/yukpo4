## Logistique temps réel Yukpo (Phase 3)

### Objectifs
- Matching coursiers fiable, multi-zones, tenant compte de la capacité et des SLA.
- Géocodage robuste (cache Redis + fallback, validation coordonnées).
- Tracking temps réel (WebSocket + Redis Pub/Sub) et alertes SLA.
- Corrélation avec pipeline vidéo (promos conditionnées par la dispo réelle).


### 1. Matching & géocodage
- **DeliveryService + Repository** :
  - Nouvelle file `delivery_matching_queue` avec statuts `delivery_matching_status`.
  - Snapshots `courier_availability_snapshots` + `courier_zone_assignments`.
  - `create_delivery_request` enfile automatiquement la livraison et tente un auto-matching immédiat.
  - Scoring : distance (max configurable), charge (load_factor), capacité résiduelle, priorité zone.
- **Géocodage** (`services/geocoding_service.rs`) :
  - Client Google + fallback Mapbox.
  - Cache Redis (`GEOCODING_CACHE_TTL_SECONDS`, par défaut 900s) + offline stub si tout échoue.
  - Paramètre `GEOCODING_TIMEOUT` via `config/timeouts.rs`.
- **Doc/vars** :
  - `REDIS_URL`, `GEOCODING_CACHE_TTL_SECONDS`, `GOOGLE_MAPS_API_KEY`, `MAPBOX_ACCESS_TOKEN`.


### 2. Tracking & WebSocket
- `DeliveryTrackingManager` reste le point d’entrée WebSocket :
  - ✅ Bridge Redis Pub/Sub (`delivery.events.{delivery_id}`) pour synchroniser les instances.
  - TODO `DeliveryWsEvent::Matching` pour notifier l’état queued/searching/assigned.
- **Mobile** : l’app client/coursier consomme le flux pour mise à jour UI (progress bars, ETA).
- **Mobile Creator Studio (QA formalisée)** :
  - `useCreatorStudio` ouvre `wss://.../api/delivery/{id}/ws` (auth header) et alimente la carte Studio (timeline, pricing dynamique, ETA, erreurs WebSocket).
  - Le module “Demander un coursier” poste sur `/api/delivery` avec un payload enrichi et propose :
    1. **Formulaire pickup/dropoff avancé** : adresses + lat/lng + instructions. Les valeurs sont persistées dans `sessionMetadata` pour réutilisation.
    2. **Sélecteur de véhicule** (Moto, Tricycle, Fourgonnette, Camion) :
       - Moto (<10 kg / petits colis express) ➜ `parcel.type_id=1`.
       - Tricycle (~1 m³ “colis pas très importants”) ➜ `type_id=2`.
       - Fourgonnette (~3 m³ / déménagement léger) ➜ `type_id=3`.
       - Camion 4T+ (gros volumes / multi-stop) ➜ `type_id=4`.
       - Le choix est synchronisé via `metadata.vehicle_type_id` pour aider le matching + instrumentation SLA.
    3. **Pickup planifié** : champ `scheduled_pickup_at` (ISO). Tant que l’heure n’est pas atteinte, `delivery_matching_queue.next_attempt_at` reste en attente et aucun matching express n’est lancé.
    4. **Mode transport passager** (XP) : toggle qui taggue `requested_delivery_mode=passenger` et `parcel.type_id=99` (le matching filtre les coursiers `passenger_mode=true`).
    5. **Lien “client choisit dropoff”** : bouton “Partager localisation client” qui génère un token public (`/delivery/public/{token}`) ; tant que `metadata.dropoff_pending=true`, le matching est bloqué puis relancé dès que le client confirme.
    6. **Mode “livraison incluse”** : toggle `billing_mode=merchant_inclusive` qui indique que le transport est facturé au marchand (aucun débit wallet client, libellé partenaire affiché dans l’UI).
    7. **Bouton Rafraîchir tracking** : relance `actions.refreshDeliveryTelemetry()` lorsque le WS est instable.
  - **Checklist QA** :
    1. Créer trois livraisons depuis la carte : Moto → Tricycle → Fourgonnette (remplir adresses/coords).
    2. Vérifier dans `delivery_matching_events` que `parcel.type_id`/`metadata.vehicle_type_id` correspondent (1,2,3) et que Slack reçoit l’alerte SLA.
    3. Observer le panneau “Livraison temps réel” : badge WS, ETA, tarif, derniers checkpoints. Tester le bouton “Rafraîchir tracking”.
    4. Configurer un pickup planifié (ex. +2h) et vérifier que `delivery_matching_queue.next_attempt_at` et l’événement `reason=scheduled_pickup` reflètent l’horaire saisi (aucune tentative auto avant l’échéance).
    5. Activer le mode passager pour une livraison de test et confirmer que le backend reçoit `requested_delivery_mode=passenger` et filtre les coursiers compatibles.
    6. (Optionnel) camions/déménagements : confirmer que le scoring/queue tiennent compte du type 4 (volume >3 m³) avant validation production.
    7. Générer un lien “client choisit dropoff” ➜ vérifier que `dropoff_pending=true`, que la file de matching reste en attente (`reason=awaiting_dropoff_confirmation`) puis que la livraison repart après soumission publique.
    8. Activer “Livraison incluse” + renseigner le marchand ➜ s’assurer que `metadata.billing_mode=merchant_inclusive`, que le wallet n’autorise plus `wallet/debit` (erreur 400) et que la UI affiche “pris en charge par <marchand>”.
- **Dashboard** : subscription par zone pour monitoring dispatch.
- Env :
  - `REDIS_URL` (obligatoire), tampon configuré via `DeliveryTrackingManager::new`.


### 3. SLA & alerting
- ✅ `tasks/delivery_sla_monitor` (cron) :
  - Analyse les livraisons livrées sur `SLA_LOOKBACK_MINUTES`.
  - Seuil `SLA_THRESHOLD_RATIO` (par défaut 1.1) vs promesse (`promised_sla_minutes` metadata ou fallback `SLA_PROMISED_MINUTES`).
  - Alerte Slack/Webhook (`SLA_ALERT_WEBHOOK`) + logs `[DeliverySLA]`.
- Export Prometheus :
  - `delivery_matching_queue_depth`, `delivery_sla_seconds`, `delivery_sla_breaches_total`, `delivery_zone_heatmap`.
  - Le worker de matching devra exposer ses stats via `pipeline_health_worker.rs` ou un endpoint `/metrics`.


### 4. Intégration vidéo
- Tables récemment ajoutées :
  - `video_delivery_links(video_id, delivery_request_id, zone_id, promised_sla_interval)`.
  - `delivery_conversion_events(event_id, video_id, delivery_request_id, source, timestamp)`.
- Workflow :
  1. Matching stable → event `delivery.promo.ready`.
  2. Worker GPU (Remotion) consomme l’événement pour (re)générer la vidéo ou activer la promo associée.
  3. Conversion trackée avec `delivery_conversion_events`.
- Docs/vars :
  - `VIDEO_DELIVERY_LINKS_ENABLED` pour activer/désactiver la corrélation en production.
  - `PROMO_READY_TOPIC` pour bus interne (Redis Stream ou queue externe).


### 5. Observabilité & sécurité
- Logs spécifiques :
  - `[DeliveryMatching]` pour scoring / queue / worker.
  - `[DeliveryService]` Wallet / Tracking (déjà présents).
- OpenTelemetry :
  - Spans `delivery.match`, `delivery.geo`, `delivery.track`.
  - Propagation `trace_id` jusqu’aux événements WS.
- Webhooks (SLA, status) :
  - HMAC `X-Yukpo-Signature` (SHA-256), secret tournant (cf. `config/security_service.rs`).
- Secrets rotation :
  - `GOOGLE_MAPS_API_KEY`, `MAPBOX_ACCESS_TOKEN`, `SLACK_SLA_WEBHOOK`, `PROMO_READY_TOPIC_KEY`.


### 6. Worker matching (nouveau module)
- ✅ `tasks/delivery_matching_worker.rs` (spawné au démarrage) :
  - `run_once` dépile `delivery_matching_queue` (statuts `queued/searching` dont `next_attempt_at <= NOW()`).
  - `run_forever` (interval configurable via env).
  - Instrumentation : logs + future ajout métriques (`processed`, `errors`, `queue_depth`).
- À coupler avec Prometheus + dashboards SLA.


### 7. Tests & outils
- **`cargo sqlx prepare`** :
  - Rôle : snapshot des requêtes pour compilation offline (stockage `.sqlx/query-*.json`).
  - Process : `cargo sqlx prepare -- --lib` + `--bin <outil>` après modification des requêtes ; ensuite `SQLX_OFFLINE=true` possible pour `cargo check`.
- **Bins maintenance** :
  - `check_services.rs`, `cleanup_ghost_embeddings.rs` sont derrière la feature `maintenance-tools`.
  - Pour les exécuter : `cargo run --features maintenance-tools --bin check_services`.


### 8. Roadmap immédiate
1. Ajouter `DeliveryWsEvent::Matching` + payloads mobiles/dashboard.
2. Exporter métriques Prometheus (matching queue, SLA breaches) & tableaux Grafana.
3. Documenter `VIDEO_DELIVERY_LINKS` + automation `delivery.promo.ready`.
4. QA mobile (hooks `useCreatorStudio`, tracking permissions) pour refléter les nouveaux events WS.

