## Phase 3 — API, Connecteurs & Orchestration

Ce guide consolide les attentes de la phase 3 : cartographie des APIs, connecteurs sociaux, lien delivery/vidéo, sécurité/gouvernance et préparation de la reprise GPU. Il s’appuie sur l’état actuel (backend Rust/Axum déjà en prod Render, worker GPU en pause, intégrations LiveKit/audio/S3 actives).

### 1. Cartographie des APIs & flux de données

| Service | Rôle dans Yukpomnang | Auth/secrets requis | Webhooks & flux | Plan migration / remarques |
| --- | --- | --- | --- | --- |
| **LiveKit Cloud** | Room audio/vidéo temps réel, ingestion micro mobile | `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` (config Render), cert TLS | Webhook `RoomFinished`, `ParticipantDisconnected`, et pipeline ingress enregistrés dans `docs/livekit-ingress.md`. Proxy Axum signe les callbacks (`X-LiveKit-Signature`). | Prévoir bascule vers AWS MediaLive : créer module d’abstraction `LiveSessionProvider`, exporter clé KMS spécifique, support infra multi-région. |
| **Premium audio (Dolby, AudioShake)** | Mastering & spatialisation post rendu | `PREMIUM_AUDIO_ENDPOINT`, `PREMIUM_AUDIO_API_KEY`, provider flag | Webhook `processing.completed` (Dolby) + polling fallback (`PREMIUM_AUDIO_POLL_INTERVAL_MS`). | Mutualiser via trait `AudioProvider`. Prévoir bucket Wasabi->S3 lors d’un futur move AWS. |
| **S3 (AWS) / Wasabi** | Stockage médias, manifests Remotion, exports livraison | `WASABI_ACCESS_KEY`, `WASABI_SECRET_KEY`, `WASABI_REGION`, `WASABI_BUCKET`, endpoints S3 compatibles | Eventual `ObjectCreated` webhook pour déclencher distribution sociale (optionnel). | Maintenir compatibilité double provider (Wasabi primaire, S3 secondaire). Script de migration `scripts/storage_migration.rs` à prévoir. |
| **IA providers (OpenAI, Anthropic, local)** | Génération script, prompts, IA copilote logistique | `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `IA_ROUTING_MODE` (fallback local). | Pas de webhook, mais logging `ia_requests`. Timeout < `IA_TIMEOUT_MS`. | Préparer module `IAProviderRegistry` pour ajouter modèles GPU internes. |
| **Géocoding (Mapbox/Google)** | Normalisation adresses, matching zones SLA | `MAPBOX_TOKEN` ou `GOOGLE_GEOCODING_KEY`, `GEOCODING_PROVIDER` | Handle rate limit via `GeocodingCache` Redis, fallback offline. | Préparer switch complet vers IGN Afrique en cas de latence (documenter champ `geocode_source`). |
| **Delivery & Tracking (interne)** | Matching coursiers, SLA, analytics | `DATABASE_URL`, `SQLX_OFFLINE=true`, `JWT_SECRET`, `DELIVERY_WEBHOOK_SECRET` | Webhook interne `delivery.status.updated` pour mobile/analytics, signature HMAC. | Refactor `delivery_repository.rs` selon backlog (Options, JSON, BigDecimal). |
| **Video orchestration (Remotion worker)** | Rend rendu vidéo GPU/CPU | `VIDEO_RENDERER_*`, `REMOTION_BROKER_URL`, `GPU_WORKER_SSH_KEY` | Webhook `video.render.completed` (worker -> backend) + status SSE. | Maintenir mode CPU fallback (Render) et préparer scripts GPU Hetzner. |

**Documentation supplémentaire** : compléter chaque entrée dans `config/phase3_env_master_guide.md` (variables, scopes), et ajouter diagrammes séquence (Mermaid) dans ce fichier si nécessaire.

### 2. Connecteurs sociaux & distribution

**Objectif** : préparer un module « Social Distribution » capable de publier automatiquement les vidéos générées.

| Plateforme | Auth & quotas | Flux proposé | Endpoints backend | Stockage tokens & refresh | Webhooks/cron |
| --- | --- | --- | --- | --- | --- |
| **Instagram Graph** | OAuth2 (Facebook app), plage quotas vidéo 5req/min | Upload -> publish -> insights | `POST /api/social/instagram/upload`, `POST /api/social/instagram/publish`, `GET /api/social/instagram/insights` | Table `social_tokens` (`platform`, `page_id`, `access_token`, `refresh_token`, `expires_at`, `scopes`) | Cron `sync_instagram_insights` (15 min). Webhook `instagram_basic` pour commentaires/mentions. |
| **TikTok for Developers** | OAuth2 + app review, limites journalières | Upload asset -> create post -> fetch stats | `POST /api/social/tiktok/upload`, `POST /api/social/tiktok/publish`, `GET /api/social/tiktok/metrics` | Même table `social_tokens` + payload `creator_open_id`. | Webhook `tiktok.event` (video.review, publish). Cron `sync_tiktok_metrics`. |
| **YouTube Data API** | OAuth2, quota 10k units/jour (upload=1600) | Upload -> set metadata -> monitor comments | `POST /api/social/youtube/upload`, `PATCH /api/social/youtube/video/:id`, `GET /api/social/youtube/analytics` | `social_tokens` + `channel_id`, `refresh_token`. | PubSubHubbub webhook pour nouveaux commentaires. Daily cron `sync_youtube_analytics`. |

**Architecture module** :
- `backend/src/services/social_distribution/` (traits `SocialPublisher`, impls `InstagramPublisher` etc.).
- Job queue (existing `VideoJobQueue`) rajoute étape `distribution_plan` (liste plateformes, timing, CTA).
- Storage tokens via SQL + encryption at rest (PostgreSQL `pgcrypto` ou KMS). Ajouter service `SecretEnvelope` pour déchiffrer en mémoire.
- Trigger : `video.render.completed` -> `DistributionOrchestrator` -> `enqueue_social_publish`. Support mode manuel (dashboard) + automatique (cron).
- Observabilité : table `social_distribution_events` (video_id, platform, status, retries, external_id, metrics_snapshot JSON).

### 3. Delivery, logistique & vidéo

**Concept** : chaque vidéo promo doit être liée au cycle logistique afin de refléter disponibilité réelle.

Checklist d’alignement :
1. **Mapping entités** : `video_id` ↔ `delivery_request_id` ↔ `courier_profile_id`. Créer table d’association `video_delivery_links`.
2. **Métadonnées** : stocker `zone_id`, `promo_campaign_id`, `estimated_sla_minutes`, `inventory_snapshot`. Accessible via `DeliveryService::get_video_context`.
3. **Workflow** :
   - `DeliveryService` publie événement `delivery.promo.ready` quand le matching coursier est stable (>2 min).
   - `VideoGenerationService` consomme l’événement pour générer clips contextuels (CTA, SLA).
   - `TrackingManager` enrichit stats avec `video_interaction_id`, `conversion_rate`, `view_through_deliveries`.
4. **Analytics** :
   - Ajouter colonnes `video_view_count`, `video_click_count`, `video_conversion_rate` dans table analytics journalières.
   - Intégrer `TrackingManager::record_video_event` (SSE ou WebSocket) pour suivre interactions in-app.
5. **Qualité & SLA** :
   - Dashboard (Grafana) affichant `delivery SLA vs. video promises`.
   - Alertes si `actual_sla - promised_sla > threshold` pour plus de 2 livraisons/heure.

### 4. Sécurité & gouvernance

**Audit secrets** :
- JWT/refresh : `JWT_SECRET`, `JWT_REFRESH_SECRET`, rotation trimestrielle via `doppler secrets rotate`.
- IA/API : OpenAI, Anthropic, Runway, Pika, Sora → stocker dans Doppler/Vault. Activer RBAC (lecture seule) pour worker GPU.
- LiveKit : créer pair clé/secret par environnement, rotation automatique (script `scripts/rotate_livekit_keys.rs`).
- Wasabi/S3 : utiliser comptes IAM distincts upload/lecture. Mettre en place encryption SSE, versioning.

**Stockage & rotation** :
- Source of truth secrets : `vault.yukpo` (Hashicorp) ou Doppler. CI récupère via short-lived tokens.
- Agents GPU : stocker `GPU_WORKER_SSH_KEY` dans Vault + injection Ansible.

**Protection périmètre** :
- **WAF** : activer Cloudflare WAF (OWASP rules) sur Render + endpoints GPU exposés.
- **Rate limiting** : déjà supporté via Axum `tower::limit` -> documenter budgets par endpoint (LiveKit join, social publish).
- **Signature webhooks** : 
  - LiveKit `X-LiveKit-Signature` (HMAC SHA256). 
  - Audio providers (Dolby) `X-Dolby-Signature`.
  - Futurs socials : stocker `SOCIAL_WEBHOOK_SECRET_<PLATFORM>`.
- **Zero-trust** : prévoir Tailscale/Headscale pour GPU/cron boxes.

**Checklist RGPD/compliance** :
- Inventaire données perso : tokens sociaux, logs location, audio bruts.
- Retention : 30 jours pour logs audio, 90 jours pour tokens inactifs.
- Droit à l’effacement : script `scripts/purge_user_data.rs` (à créer) purge vidéos + analytics + tokens.
- Encryption at rest : Postgres (Render) + S3 encryption, Wasabi SSE. Sur GPU, chiffrer disques (LUKS).
- Journaux d’accès secrets : activer audit Vault/Doppler.

### 5. Roadmap préparatoire « Phase GPU »

| Bloc | Pré-requis | Action | Responsable | Deadline |
| --- | --- | --- | --- | --- |
| **Hetzner GPU (H100/A100)** | Accès root, clés SSH, firewall | - Durcir SSH (`PermitRootLogin no`, MFA)  
- Mettre en place Tailscale/ZeroTier  
- Script `scripts/gpu_worker_healthcheck.sh` (watchdog) | Infra | Semaine 1 |
| **Remotion worker** | Node 18 + drivers NVIDIA + Docker runtime | - Générer AMI golden image  
- Provisionner bucket cache b-roll  
- Tester `VIDEO_RENDERER_ENABLE_GPU=true` | Video team | Semaine 1-2 |
| **Monitoring** | Prometheus/Grafana, Loki logs | - Exporter métriques GPU (nvidia-smi exporter)  
- Ajouter alertes latence social publish | SRE | Semaine 2 |
| **Dependencies** | Storage, IA clés, DB VPN | - Valider que toutes APIs whitelistent IP Hetzner  
- Configurer `SQLX_OFFLINE` pour builds worker | Backend | Semaine 2 |
| **Blockers actuels** | `delivery_repository.rs` refactor, `video_generation_service.rs` borrow fix | - Finaliser refactors (cf. backlog)  
- Re-générer `sqlx-data.json` | Backend | Avant redémarrage GPU |

### 6. Plan d’exécution (ordre des PRs & validations)

1. **PR#1 – Refactor delivery/video backend**  
   - Finaliser `delivery_repository.rs` & `video_generation_service.rs`.  
   - Tests : `cargo fmt`, `cargo test delivery::*, video::*`, `cargo sqlx prepare -- --lib`.  
   - Lints ciblés (`read_lints`).  
2. **PR#2 – Documentation & env guide**  
   - Ajouter fichiers `docs/api_connectors_phase3.md`, `config/phase3_env_master_guide.md`.  
   - Vérifier cohérence avec `docs/video_pipeline_env.md`.  
   - Validation : revue produit + tech lead.
3. **PR#3 – Social distribution scaffolding**  
   - Créer modules backend (`SocialPublisher`, endpoints), migrations `social_tokens`, `social_distribution_events`.  
   - Ajout tests unitaires + contrat webhooks simulés.  
   - Test : `cargo test social_distribution`, `npm test` pour dashboards si UI.  
4. **PR#4 – Delivery/video analytics**  
   - Ajouter table `video_delivery_links`, enrichir `TrackingManager`.  
   - Tests intégration + dashboard Grafana panels.  
5. **PR#5 – Sécurité & governance**  
   - Scripts rotation secrets, configuration WAF/rate limit, doc RGPD.  
   - Tests : pentest léger, `scripts/run_security_checks.ps1`.  
6. **PR#6 – GPU readiness**  
   - Scripts durcissement SSH, healthchecks, watchers.  
   - Validation : run `scripts/gpu_worker_healthcheck.sh`, test render GPU.

Chaque PR doit inclure checklists : docs mise à jour, tests passés, plan de déploiement. Prévoir revue inter-équipe (backend, infra, produit).


