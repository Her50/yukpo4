## Configuration Vidéo – Variables d’environnement

Ce guide décrit la configuration des variables nécessaires pour le pipeline de rendu vidéo Yukpomnang, avec des recommandations d’infrastructure dimensionnées pour gérer des milliers de vidéos ou transactions par minute.

---

### 1. Vue d’ensemble des composants

| Composant | Rôle | Plateforme recommandée |
|-----------|------|------------------------|
| Backend Axum (`yukpomnang_backend`) | Orchestration et API | **Render** (instances autoscalables) |
| Worker Remotion GPU | Rendu vidéo (Chromium/FFmpeg, NVENC) | **Hetzner Cloud CX/AX GPU** ou Render GPU (autoscale) |
| Stockage média | Masters, sous-titres, assets | **Wasabi / AWS S3** + CDN (CloudFront, Bunny ou Cloudflare) |
| Secrets & monitoring | Gestion variables, métriques | Render Secrets + Hetzner `systemd`, Prometheus/Grafana (Managed Grafana Cloud ou Grafana OSS) |

Ces plateformes offrent une montée en charge automatique ou via API (Terraform). Pour du trafic très élevé :
- Render autoscale horizontalement (`instance_type=professional`) ;
- Hetzner GPU (AX161-NVMe ou NVIDIA L4) avec autoscale via `hetzner-cloud-controller` ;
- S3/Wasabi supportent des millions de requêtes/minute, surtout via CloudFront/Bunny.

---

### 2. Variables côté backend (`.env`, Render, CI)

| Variable | Description | Exemple |
|----------|-------------|---------|
| `VIDEO_RENDERER_ENABLED` | Active le renderer (par défaut `true` si dossier détecté) | `true` |
| `VIDEO_RENDERER_PROJECT_ROOT` | Chemin vers le dossier `video-renderer` (volume monté côté backend) | `/srv/yukpo/video-renderer` |
| `VIDEO_RENDERER_NODE_BIN` | Binaire Node.js utilisé pour le worker local | `/usr/local/bin/node` |
| `VIDEO_RENDERER_AUTO_BUILD` | Autorise `npm run build` automatique si `dist/` absent | `false` en prod (build CI) |
| `VIDEO_RENDERER_ENABLE_GPU` | Active les optimisations GPU (NVENC) | `true` sur instance GPU |
| `VIDEO_RENDERER_CHROMIUM_EXECUTABLE` | Chemin vers Chromium préinstallé (sinon laissé vide) | `/usr/bin/chromium` |
| `VIDEO_RENDERER_BROWSER_DOWNLOAD_DIR` | Dossier cache Chromium | `/srv/yukpo/.cache/chromium` |
| `VIDEO_RENDERER_RPC_URL` | URL HTTPS du worker GPU (fallback local si vide) | `https://renderer.yukpo.live/render` |
| `VIDEO_RENDERER_TIMEOUT_SECS` | Timeout d’un job (seconds) | `900` (15 min) |
| `VIDEO_RENDERER_MAX_RETRIES` | Nombre de retries sur l’exécuteur principal | `2` |
| `VIDEO_RENDERER_SHARED_VOLUME` | Volume partagé jobs/renders (`/srv/yukpo/jobs`) | `/srv/yukpo/jobs` |

**Render (backend)** \
1. Dashboard Render → Service backend → *Environment* → ajouter les clés ci-dessus. \
2. Monter un Render Volume (`/srv/yukpo`) si besoin d’un stockage persistant local. \
3. Redéployer ; vérifier `/internal/metrics/pipeline` et logs.

**CI (GitHub Actions / Render)** \
Importer en secrets `VIDEO_RENDERER_PROJECT_ROOT`, `VIDEO_RENDERER_RPC_URL`, etc., pour exécuter `scripts/run_video_pipeline_qa.sh`.

---

### 3. Variables worker GPU (Hetzner ou Render GPU)

| Variable | Description | Exemple |
|----------|-------------|---------|
| `VIDEO_RENDERER_PROJECT_ROOT` | Dossier de l’app Remotion dans le conteneur | `/srv/yukpo/video-renderer` |
| `VIDEO_RENDERER_NODE_BIN` | Binaire Node dans l’image Docker | `/usr/local/bin/node` |
| `VIDEO_RENDERER_ENABLE_GPU` | `true` (obligatoire pour NVENC) | `true` |
| `VIDEO_RENDERER_CHROMIUM_EXECUTABLE` | Binaire Chromium bundle dans l’image | `/usr/bin/chromium` |
| `VIDEO_RENDERER_BROWSER_DOWNLOAD_DIR` | Cache Chromium | `/srv/yukpo/.cache/chromium` |
| `VIDEO_RENDERER_SHARED_VOLUME` | Volume monté partagé avec le backend | `/srv/yukpo/jobs` |
| `VIDEO_RENDERER_TIMEOUT_SECS` | Recommandé > durée maximale d’un job | `900` |

**Hetzner Cloud** \
1. Créer un volume `jobs` (`hcloud volume create --name yukpo-jobs --size 100 --server <ID> --automount`). \
2. Monter sur `/srv/yukpo/jobs` + `chown render:render`. \
3. Déployer Docker (compose) du worker :
   ```yaml
   services:
     remotion-renderer:
       image: registry.example.com/video-renderer:prod
       runtime: nvidia
       environment:
         VIDEO_RENDERER_SHARED_VOLUME: /srv/yukpo/jobs
         VIDEO_RENDERER_PROJECT_ROOT: /srv/yukpo/video-renderer
         VIDEO_RENDERER_ENABLE_GPU: "true"
         REMOTION_ENABLE_GPU: "true"
       volumes:
         - /srv/yukpo/jobs:/srv/yukpo/jobs
         - /srv/yukpo/video-renderer:/srv/yukpo/video-renderer
       ports:
         - "8080:8080"
   ```
4. Sécuriser l’API via Traefik + Let’s Encrypt ou Cloudflare Tunnel (`https://renderer.yukpo.live`).

**Render GPU** \
1. Créer un service worker GPU, `docker build -t registry.render.com/.../video-renderer:prod`. \
2. Monter un volume `/srv/yukpo/jobs` partagé avec le backend. \
3. Ajouter les variables dans l’onglet *Environment*. \
4. Activer l’autoscale (min 1, max 3) pour absorber la montée en charge.

---

### 4. Stockage & CDN (S3/Wasabi)

| Variable | Description | Exemple |
|----------|-------------|---------|
| `UPLOAD_STORAGE_PATH` | Racine locale (montée) où le backend stocke temporairement | `/srv/yukpo/jobs` |
| `UPLOAD_BASE_URL` | URL publique CDN | `https://cdn.yukpo.com` |
| `S3_ENDPOINT` | URL S3 (Wasabi: `https://s3.eu-central-1.wasabisys.com`) | – |
| `S3_BUCKET` | Bucket principal | `yukpo-video-prod` |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | Credentials (Vault/Render Secrets) | – |
| `S3_REGION` | Région (AWS `eu-west-3`, Wasabi `eu-central-1`) | – |

**Workflow recommandé** \
1. Le backend écrit dans `/srv/yukpo/jobs/<job_uuid>/final.mp4`. \
2. Upload S3 via client `aws-sdk-s3` (`tokio::task::spawn_blocking`). \
3. Expose l’objet via CDN (CloudFront, Cloudflare R2 + Workers, Bunny). \
4. Nettoyer le volume local (service Cron `tmpreaper` ou job rust).

---

### 5. Bonnes pratiques secrets & montée en charge

1. **Vault/Secret Manager** : Centraliser (`AWS Secrets Manager`, `HashiCorp Vault`, `Doppler`) pour répliquer les variables entre environnements. \
2. **Infrastructure as Code** : Terraform pour Render, Hetzner, S3 (module `render_service`, `hcloud_server`, `aws_s3_bucket`). \
3. **Autoscale & files d’attente** : Coupler le backend avec une queue (Eks: `Redis Queue`, `Upstash`, `AWS SQS`) pour lisser les pics de jobs. \
4. **Monitoring** : collecter `render_latency_seconds`, `render_failures_total`, `gpu_utilization` (via `nvidia-smi dmon` export). \
5. **Sécurité** : 
   - Restreindre l’API renderer (mTLS, allow-list IP backend). 
   - Chiffrer le trafic (HTTPS, Cloudflare Zero Trust). 
   - Rotation clés S3 et Webhook signature (`PIPELINE_ALERT_WEBHOOK` + secret).

---

### 6. Checklist mise en production

1. **Local** : `.env` mis à jour, `VIDEO_RENDERER_RPC_URL` vide → fallback local, `cargo run`. \
2. **Staging** :
   - Worker GPU sur Hetzner (AX41-NVMe + RTX 4000 Ada ou L40S) ;
   - CDN/Bucket staging (`cdn-staging.yukpo.com`). \
3. **Production** :
   - Render backend pro + autoscale ; 
   - Hetzner GPU (AX161 + L40S) en cluster 2 nœuds + HCloud LB ; 
   - S3/Wasabi répliqué + CDN multi-edge ; 
   - Prometheus/Grafana (scrape `/internal/metrics/pipeline`). \
4. **Secrets** : documentés dans `config/secrets_map.md` et stockés dans Vault/Render Secrets. \
5. **Tests** : `scripts/run_video_pipeline_qa.sh`, rendu Remotion sample, diffusion CDN, alertes Slack (`PIPELINE_ALERT_WEBHOOK`).

---

En suivant ces étapes, Yukpomnang s’appuie sur une infrastructure moderne, autoscalable et prête pour la montée en charge. Ajustez les tailles d’instances (Render Professional, Hetzner AX161, S3 Multi-AZ) selon la croissance réelle et automatiser les déploiements via CI/CD et Terraform pour garder un contrôle complet sur vos environnements.


