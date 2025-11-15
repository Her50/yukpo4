## Orchestration GPU & LiveKit – Cartographie Phase 2

### 1. Vue d’ensemble
- **Backend Render (Axum)**  
  Orchestration des jobs, planification, stockage des timelines, upload S3/Wasabi, exposé via `https://yukpomnang.onrender.com`.  
- **Worker Remotion GPU**  
  Service Node/Chromium/FFmpeg exposant `POST /render`, capable d’utiliser NVENC/NVDEC. Hébergé sur **Hetzner AX/RTX** ou Render GPU.  
- **Stockage partagé**  
  Volume `VIDEO_RENDERER_SHARED_VOLUME` monté sur le backend + worker (`/srv/yukpo/jobs`), conserve timeline, rushes, masters intermédiaires.  
- **Stockage objet & CDN**  
  S3/Wasabi (`media_storage_service`) + CDN (CloudFront, Bunny, Cloudflare) pour distribution publique.  
- **LiveKit (Hetzner VM)**  
  Gestion rooms temps réel + analytics. Communique via API `RoomService`/`IngressService`.  
- **Monitoring centralisé**  
  Prometheus (scrape `/internal/metrics/pipeline`, métriques worker), Grafana dashboards, alerting Slack/Email.

```
Client → Backend Render → VideoRenderDispatcher
                          ↳ RPC GPU Worker (render) → Volume partagé → Upload S3/CDN
                          ↳ Fallback local Remotion (Render VM) si RPC KO
LiveKit VM ↔ Backend (cleanup, analytics)
Prometheus/Grafana ↔ Backend & Worker & LiveKit
```

### 2. Flux détaillé d’un job vidéo
1. **Trigger** : `POST /videos/generate` (payload storyboard).  
2. **Préparation** : backend compose timeline (`ImmersiveTimeline`) + assets audio.  
3. **Dispatch** : `VideoRenderDispatcher.render()`  
   - Essayez RPC GPU (`RenderExecutionMode::GpuRpc`) → `POST https://renderer.yukpo.live/render`.  
   - Timeout configuré via `VIDEO_RENDERER_TIMEOUT_SECS` (recommandé 900 s).  
   - Retries (`VIDEO_RENDERER_MAX_RETRIES`) + fallback local (`RenderExecutionMode::Offline`).  
4. **Worker GPU** :  
   - Récupère timeline JSON, assets depuis volume partagé (`/srv/yukpo/jobs/<job_id>`).  
   - Lance Remotion (`npm run render`) avec acceleration GPU (Chromium headless + NVENC).  
   - Dépose master MP4 + timeline serialisée dans volume (`<job_id>/final.mp4`).  
   - Retourne JSON `{ job_id, master_video, warnings }`.  
5. **Backend post-traitement** :  
   - `media_storage_service` upload S3/Wasabi (`store_file`).  
   - Génère URL CDN (`UPLOAD_BASE_URL`).  
   - Met à jour `video_generation_jobs` (statut, rendu, audio premium si activé).  
   - Envoie notifications/metrics (`record_engagement`, pipeline health).  
6. **Monitoring** : pipeline worker (`pipeline_health_worker`) log la latence + statut. Prometheus enregistre `render_duration_seconds`, `render_failures_total`.

### 3. LiveKit – Interaction
- **VM Hetzner (Ubuntu 22.04, cgroup v2)** : héberge LiveKit + ingress/egress, accessible via `https://livekit.yukpo.live`.  
- **Backend tâches** :  
  - `livekit_cleanup` : purge rooms/inress → nécessite `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`.  
  - `live_analytics` : synchronise métriques room → pousse dans Prometheus.  
  - Warnings actuels (`401 Unauthorized`) = clés non configurées.  
- **Réseau** :  
  - LB/Traefik gère TLS (Let’s Encrypt) + mTLS optionnel.  
  - Firewall Hetzner : uniquement backend Render/worker autorisés (`allow-list`).  
  - WebRTC clients passent via UDP 80/443, fallback TCP.

### 4. Pré-requis hardware & scaling
| Composant | Specs minimales | Scaling |
|-----------|----------------|--------|
| Backend Render | Render Professional (4 vCPU/8 Go) | Autoscale horizontal selon CPU (>70 %) |
| Worker GPU (prod) | Hetzner **AX161** (AMD 7950X3D + RTX 4090) ou AX102 + L4 | Cluster 2 nœuds + autoscale via `hcloud-server` + Terraform |
| Worker GPU (staging) | Hetzner **AX41-NVMe** (RTX 4000) | 1 nœud, scale manuel |
| Storage volume | NVMe 200 GB (jobs) + S3/Wasabi | Volume Hetzner + backup Snapshots |
| LiveKit VM | CX42 (8 vCPU/16 Go) | Autoscale + HCloud LB |

- **GPU drivers** : `nvidia-driver-535` + `libnvidia-encode`.  
- **Docker runtime** : `--gpus all` (nvidia-container-toolkit).  
- **Benchmark** : exécuter `scripts/run_video_pipeline_qa.sh` → viser < 4 minutes/job 4K.

### 5. Réseau & sécurité
- **DNS/TLS** :
  - `renderer.yukpo.live` → Traefik/Cloudflare. Forcer HTTPS, HTTP/2.  
  - Certificats via Let’s Encrypt wildcard ou Cloudflare DNS.
- **Auth** :
  - Jeton d’API pour le worker : header `Authorization: Bearer <VIDEO_RENDERER_RPC_TOKEN>`.  
  - LiveKit → couples `API_KEY` / `API_SECRET`, stockés dans Render Secrets/Hetzner Vault.  
- **Firewall** :
  - Worker GPU : autoriser seulement IP Render backend + bastion.  
  - LiveKit : ports 443/TCP, 7881/UDP (WebRTC).  
- **Hardening** :
  - Traefik middleware `rate-limit`, `ip-whitelist`.  
  - mTLS possible entre backend et worker (`VIDEO_RENDERER_TLS_CLIENT_CERT`).  
  - Cloudflare Spectrum ou Zero Trust pour LiveKit (prévenir DDoS).

### 6. Variables & secrets critiques
- `VIDEO_RENDERER_RPC_URL`, `VIDEO_RENDERER_RPC_TOKEN` (backend).  
- `VIDEO_RENDERER_SHARED_VOLUME`, `VIDEO_RENDERER_ENABLE_GPU` (backend + worker).  
- `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_URL`.  
- `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `UPLOAD_BASE_URL`.  
- `PIPELINE_ALERT_WEBHOOK` (Slack/Email).  
- Tout stocké dans Render Secrets / Hetzner `systemd` `EnvironmentFile=/etc/yukpo.env`.

### 7. Monitoring & Alerting
- **Prometheus** :
  - Backend : `/internal/metrics/pipeline` (latence rendu, jobs en échec).  
  - Worker : exporter `render_job_duration_seconds`, `gpu_temperature_celsius`, `nvenc_utilization`.  
  - LiveKit : exporter `livekit_room_participants`, `livekit_egress_failures_total`.
- **Grafana dashboards** :
  - `Video Pipeline Overview` : latence, warnings, throughput/min.  
  - `GPU Utilization` : % usage, température, mémoire (panel NVIDIA exporter).  
  - `LiveKit Rooms` : participants actifs, erreurs API.  
- **Alertes** :
  - `render_failure_ratio > 5%` (5m).  
  - `gpu_temp > 85°C` (1m).  
  - `livekit_api_errors > 0` (sustained 5m) → vérifier secrets.
- **Logs** :
  - Worker : JSON via Loki ou Vector.  
  - Backend : Render Log Streams + alert route `/internal/alerts/pipeline`.

### 8. Checklist déploiement
1. **Préparer Docker image** du worker (`Dockerfile.gpu`) avec Node 18, Chromium, FFmpeg + NVENC.  
2. **Provisionner Hetzner** : serveur GPU, volume, firewall, Traefik (TLS, Auth).  
3. **Configurer secrets** : Render (backend) + Hetzner (`/etc/yukpo.env`).  
4. **Brancher monitoring** : Prometheus scrape worker (`/metrics`), exporter GPU (dcgm-exporter).  
5. **Tester** :  
   - `curl -H "Authorization: Bearer TOKEN" https://renderer.yukpo.live/health`.  
   - `scripts/run_video_pipeline_qa.sh --rpc https://renderer.yukpo.live`.  
   - Vérifier pipeline health, latence, upload S3/CDN.  
6. **Plan de reprise** : fallback local activé (`remotion_local`), snapshot volume jobs, canary deploy du worker.  
7. **Documentation** : mettre à jour `config/video_renderer_env.md`, `BACKEND_CONFIG_SUMMARY.md`, Runbook Grafana.

---

Cette cartographie sert de guide pour la configuration complète du rendu GPU/LiveKit : elle structure l’infrastructure, liste les variables critiques et les contrôles de monitoring afin de garantir un pipeline vidéo hautement disponible et prêt pour des milliers de rendus par minute.


