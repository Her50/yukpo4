## Guide unique des variables d’environnement & secrets (Phase 3)

Ce document centralise les variables nécessaires aux APIs, connecteurs externes, modes offline (`SQLX_OFFLINE`) et workers. À synchroniser avec Doppler/Vault, fichiers `.env`, Render, Hetzner et CI.

### 1. Backend core (Axum/SQLx)

| Variable | Rôle | Notes |
| --- | --- | --- |
| `RUST_LOG` | Logs structurés | ex: `info,sqlx=warn`. |
| `APP_BASE_URL` | URL publique backend | Utilisé pour webhooks (LiveKit, sociaux). |
| `DATABASE_URL` | Connexion PostgreSQL (Render) | Format `postgresql://user:pass@host/db`. |
| `SQLX_OFFLINE` | Mode offline migrations | `true` en CI/worker GPU (cache `sqlx-data.json`). |
| `REDIS_URL` | Cache géocoding, rate limit | Optionnel si fallback en mémoire. |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | Auth API | Rotation trimestrielle, stocker dans Vault. |
| `DELIVERY_WEBHOOK_SECRET` | Signature webhooks internes | HMAC SHA256, unique par environnement. |

### 2. LiveKit & temps réel

| Variable | Rôle |
| --- | --- |
| `LIVEKIT_URL` | Endpoint cluster LiveKit. |
| `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | Auth API. |
| `LIVEKIT_WEBHOOK_SECRET` | Signature `X-LiveKit-Signature`. |
| `LIVEKIT_INGRESS_ID` | Ingress audio (cf. `docs/livekit-ingress.md`). |

### 3. Stockage médias (Wasabi/S3)

| Variable | Rôle |
| --- | --- |
| `WASABI_ACCESS_KEY` / `WASABI_SECRET_KEY` | IAM principal. |
| `WASABI_REGION` | ex: `eu-central-1`. |
| `WASABI_BUCKET` | Bucket principal médias. |
| `S3_FALLBACK_BUCKET`, `S3_FALLBACK_REGION`, `S3_FALLBACK_ENDPOINT` | Support migration AWS. |
| `STORAGE_SIGNING_KEY` | Signature URLs temporaires (download). |

### 4. Audio & IA

| Variable | Rôle |
| --- | --- |
| `PREMIUM_AUDIO_ENABLED` | Toggle service. |
| `PREMIUM_AUDIO_PROVIDER` | `dolby`, `audioshake`, `custom`. |
| `PREMIUM_AUDIO_ENDPOINT`, `PREMIUM_AUDIO_API_KEY` | Auth provider. |
| `PREMIUM_AUDIO_POLL_INTERVAL_MS` | Polling statut. |
| `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `LOCAL_IA_ENDPOINT` | Routing IA. |
| `IA_ROUTING_MODE` | `cloud`, `gpu`, `hybrid`. |
| `IA_TIMEOUT_MS`, `IA_COST_PER_1K_TOKENS_USD`, `VIDEO_DEFAULT_TOKENS_ESTIMATE` | Aligné sur `docs/video_pipeline_env.md`. |

### 5. Géolocalisation & carto

| Variable | Rôle |
| --- | --- |
| `GEOCODING_PROVIDER` | `mapbox`, `google`, `offline`. |
| `MAPBOX_TOKEN` / `GOOGLE_GEOCODING_KEY` | Clés API. |
| `GEOCODING_CACHE_TTL_SECS` | Cache Redis. |
| `GPS_RESOLVER_STRICT_MODE` | Forcer validation lat/lon. |

### 6. Delivery & logistique

| Variable | Rôle |
| --- | --- |
| `DELIVERY_MATCHING_STRATEGY` | `sla_first`, `cost_first`, etc. |
| `DELIVERY_DEFAULT_SLA_MINUTES` | Promesse affichée vidéo/app. |
| `DELIVERY_ANALYTICS_QUEUE` | Nom queue (Redis/NATS). |
| `TRACKING_SSE_ENABLED` | Active SSE pour `TrackingManager`. |

### 7. Vidéo & worker GPU

| Variable | Rôle |
| --- | --- |
| `VIDEO_RENDERER_ENABLED`, `VIDEO_RENDERER_PROJECT_ROOT`, `VIDEO_RENDERER_NODE_BIN` | Config Remotion worker. |
| `VIDEO_RENDERER_AUTO_BUILD`, `VIDEO_RENDERER_ENABLE_GPU` | Mode build/GPU. |
| `VIDEO_RENDERER_CHROMIUM_EXECUTABLE` | Chemin Chromium custom. |
| `BROLL_CACHE_ENABLED`, `BROLL_CACHE_TTL_SECS`, `BROLL_DOWNLOAD_DIR` | Cache b-roll. |
| `GPU_WORKER_SSH_KEY`, `GPU_WORKER_HEALTHCHECK_URL` | Gestion Hetzner. |
| `REMOTION_BROKER_URL`, `REMOTION_WEBHOOK_SECRET` | Communication backend ↔ worker. |

### 8. Connecteurs sociaux (préparation)

| Variable | Rôle |
| --- | --- |
| `SOCIAL_DISTRIBUTION_ENABLED` | Feature flag global. |
| `SOCIAL_WEBHOOK_SECRET_INSTAGRAM` | Signature `X-Hub-Signature-256`. |
| `SOCIAL_WEBHOOK_SECRET_TIKTOK` | Signature `X-Tt-Signature`. |
| `SOCIAL_WEBHOOK_SECRET_YOUTUBE` | PubSubHubbub. |
| `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET` | OAuth. |
| `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` | OAuth. |
| `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET` | OAuth. |
| `SOCIAL_REDIRECT_URI` | Callback partagé (https://api.yukpo.com/social/callback). |
| `SOCIAL_CRON_ENABLED` | Trigger sync metrics. |

### 9. Observabilité & sécurité

| Variable | Rôle |
| --- | --- |
| `SENTRY_DSN`, `SENTRY_ENV` | Traces backend. |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Export OpenTelemetry. |
| `WAF_MODE` | `monitor`, `block`. |
| `RATE_LIMIT_WINDOW_SECONDS`, `RATE_LIMIT_MAX_REQUESTS` | Budget global. |
| `HMAC_GLOBAL_SECRET` | Signature webhooks internes. |

### 10. Compliance & gouvernance

| Variable | Rôle |
| --- | --- |
| `DATA_RETENTION_DAYS` | Purge logs. |
| `AUDIT_LOG_BUCKET` | Archive chiffrée (S3 Glacier). |
| `PRIVACY_REQUEST_EMAIL` | Contact DPO. |

### 11. Gestion des fichiers `.env`

1. **Sources** : `config/phase3_env_master_guide.md` (ce fichier), `docs/video_pipeline_env.md`, `config/livekit_env.md`.  
2. **Templates** : générer `backend/.env.example`, `frontend/.env.example`, `worker/.env.example`.  
3. **Validation** : script `scripts/check_env.rs` (à créer) qui charge la liste des variables attendues, vérifie présence et cohérence (ex: `if SOCIAL_DISTRIBUTION_ENABLED=true alors INSTAGRAM_APP_ID != ""`).  
4. **Modes offline** : activer `SQLX_OFFLINE=true` et maintenir `sqlx-data.json` à jour (commande `cargo sqlx prepare -- --lib`). Documenter la procédure dans `docs/api_connectors_phase3.md`.  
5. **Rotation** : conserver `ROTATION_CALENDAR.md` avec dates de renouvellement (LiveKit, JWT, Wasabi, IA).  

### 12. Stockage des secrets

- **Doppler/Vault** : source unique, injection via GitHub Actions/Render.  
- **K8s / Docker** : convertir en `Secret` base64; jamais committer.  
- **GPU Hetzner** : Ansible récupère secrets via Tailscale + Vault agent.  
- **CI/CD** : utiliser tokens courts (TTL<1h) pour `OPENAI_API_KEY` et `WASABI_SECRET_KEY`.  

### 13. Checklist de mise à jour

- [ ] Revue trimestrielle des variables vs code (`grep env::var`).  
- [ ] Synchroniser README/env guide après tout ajout variable.  
- [ ] Vérifier que chaque secret a un owner + rotation planifiée.  
- [ ] Tests automatiques (`scripts/check_env.rs`) intégrés à CI PR.  
- [ ] Exporter version signée de ce guide dans l’outil interne (Confluence/Notion).  


