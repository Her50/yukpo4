# Yukpo Remotion Renderer (Experimental)

Ce module est isolé du frontend React/Expo existant pour éviter tout conflit de dépendances.  
Il sert de worker vidéo dédié pour rendre les templates immersifs (IntroPulse, ProductShowcase, ARHighlight, GlowCTA) via Remotion.

## Pré-requis

- Node.js 20+
- FFmpeg (ffmpeg-static inclut les binaires, mais installer FFmpeg localement accélère les tests)

## Installation

```bash
cd video-renderer
npm install
```

## Générer une vidéo d’exemple

```bash
npm run render:sample
```

Le rendu est stocké dans `renders/sample-job/master.mp4`.

## Rendu custom

```bash
npm run build
node dist/cli/render-worker.js --job ./path/to/timeline.json --out-dir ./renders/custom-job --overwrite
```

Le fichier `timeline.json` doit respecter le schéma `ImmersiveTimeline` (voir `src/types/timeline.ts`).

## Intégration backend

- Le backend Rust pourra déposer un fichier timeline + assets dans un répertoire temporaire, puis invoquer ce worker (Docker ou process Node) pour produire une vidéo master 9:16.
- Les dérivés (1:1, 16:9) seront générés par la pipeline FFmpeg côté backend après assemblage.

## Variables d'environnement utiles

Le backend transmet ces variables au worker lors du rendu :

| Variable | Description | Valeur par défaut |
| --- | --- | --- |
| `VIDEO_RENDERER_PROJECT_ROOT` | Chemin vers ce dossier | `video-renderer` |
| `VIDEO_RENDERER_NODE_BIN` | Binaire Node à utiliser | `node` |
| `VIDEO_RENDERER_ENABLE_GPU` | Active les flags GPU (Chromium) | `false` |
| `VIDEO_RENDERER_CHROMIUM_EXECUTABLE` | Chemin explicite du Chrome/Chromium à utiliser | *(auto)* |
| `VIDEO_RENDERER_BROWSER_DOWNLOAD_DIR` | Dossier cache des binaires Chromium | *(auto)* |

Ces variables sont exportées avant l’exécution du worker, afin que Remotion/Puppeteer utilise la bonne version de Chrome (y compris dans un container CUDA).

## Rendu GPU (optionnel)

1. Installer un Chrome/Chromium compatible GPU (ex : image Docker `nvidia/cuda:12-base` + `chromium`).
2. Définir :
   ```bash
   export VIDEO_RENDERER_ENABLE_GPU=true
   export VIDEO_RENDERER_CHROMIUM_EXECUTABLE=/usr/bin/chromium
   export VIDEO_RENDERER_BROWSER_DOWNLOAD_DIR=/tmp/remotion-chrome
   ```
3. Vérifier que les drivers NVIDIA sont visibles (`nvidia-smi`) puis lancer `npm run render:sample`.  

Le worker active automatiquement les flags `--enable-gpu`, `--disable-software-rasterizer`, `--ignore-gpu-blocklist`, `--enable-zero-copy`.

## Container Docker (GPU ready)

Une image CUDA optimisée est fournie via `video-renderer/Dockerfile`.

```bash
# Construction (tag local)
docker build -t yukpo/video-renderer-gpu .

# Exécution (NVIDIA Container Runtime requis)
docker run --rm \
  --gpus all \
  -e JOB_FILE=/app/samples/sample-job.json \
  -e OUTPUT_DIR=/app/renders/sample \
  -e VIDEO_RENDERER_ENABLE_GPU=true \
  -v $(pwd)/renders:/app/renders \
  yukpo/video-renderer-gpu
```

Variables utiles :

| Variable | Description |
| --- | --- |
| `JOB_FILE` | Chemin (dans le conteneur) du fichier timeline à rendre. |
| `OUTPUT_DIR` | Répertoire de sortie du rendu final. |
| `RENDER_ARGS` | Arguments supplémentaires passés au CLI (`--overwrite`, `--concurrency`, …). |
| `VIDEO_RENDERER_ENABLE_GPU` | Active les flags GPU Chromium (défaut `false`). |
| `VIDEO_RENDERER_CHROMIUM_EXECUTABLE` | Chemin explicite vers Chromium si nécessaire. |

> ℹ️ Les répertoires `/app/renders` et `/app/cache` sont déclarés en volumes pour stocker les masters rendus et le cache Chromium.

### Mode serveur RPC

Pour exposer le worker via HTTP (compatible avec `VIDEO_RENDERER_RPC_URL`) :

```bash
docker run --rm \
  --gpus all \
  -p 8088:8080 \
  -e RENDER_SERVER=1 \
  -e VIDEO_RENDERER_ENABLE_GPU=true \
  -e VIDEO_RENDERER_SHARED_VOLUME=/app/renders \
  -v /srv/yukpo/jobs:/app/renders \
  -v /srv/yukpo/cache:/app/cache \
  yukpo/video-renderer-gpu
```

- `GET /health` → statut du worker.
- `POST /render` → payload :

```json
{
  "job_id": "optionnel",
  "timeline": { "...": "ImmersiveTimeline" }
}
```

Réponse :

```json
{
  "job_id": "uuid",
  "master_video": "/app/renders/<job_id>/master.mp4",
  "timeline_json": "/app/renders/<job_id>/<job_id>.timeline.json",
  "output_dir": "/app/renders/<job_id>",
  "warnings": []
}
```

Exposez idéalement ce service derrière Traefik/Nginx (`https://renderer.yukpo.live`) et configurez `VIDEO_RENDERER_RPC_URL` côté backend.

### Intégration pipeline

1. Construire et pousser l’image : `docker build -t registry.example.com/yukpo/video-renderer:latest .`.
2. Déployer un job Kubernetes (ou CronJob) avec `resources.limits.nvidia.com/gpu: 1`.
3. Monter un volume partagé pour récupérer le `master.mp4`, puis transformer/ingérer via backend.

Le backend Rust peut invoquer le worker via :

```bash
docker run --rm \
  --gpus all \
  -e JOB_FILE=/jobs/timeline.json \
  -e OUTPUT_DIR=/jobs/output \
  -v /srv/yukpo/jobs:/jobs \
  registry.example.com/yukpo/video-renderer:latest
```

Dans ce scénario, le backend copie le timeline + assets dans `/srv/yukpo/jobs/<delivery-id>/`, lance le conteneur puis récupère `master.mp4`.




