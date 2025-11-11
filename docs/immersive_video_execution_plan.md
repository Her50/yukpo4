## Yukpo Immersive Video – Plan d’implémentation

### 1. Vision globale
- Objectif : générer automatiquement des vidéos immersives (format TikTok/Reels) à partir d’un brief produit.
- Flux cible :
  1. `ImmersiveOrchestrator` reçoit un brief enrichi (IA timeline + budget utilisateur).
  2. Génération d’une `ImmersiveTimeline` (slots templates, b-roll, audio cues, effets).
  3. Rendu graphique Remotion (Chromium headless) avec effets avancés.
  4. Mastering audio haut de gamme (Dolby.io / AudioShake + SFX dynamiques).
  5. Assemblage final FFmpeg → variantes multi-format.
  6. Tracking analytics + coût + supervision.
  7. UX front affiche progression, budget, notifications.

### 2. Pipeline Remotion & rendu vidéo
- **Worker Node** : `scripts/remotion/render_worker.ts` lancé via queue; dépendances `remotion`, `remotion-three`, `remotion/lottie`, `framer-motion`, `ffmpeg-static`.
- **Entrées** : `ImmersiveTimeline` sérialisée (scènes → composant Remotion + props).
- **Sorties** : master vidéo 9:16 (1080x1920) + assets intermédiaires (subshots, stickers).
- **Rendu** :
  - Build bundler dédié (`scripts/remotion/bundle.ts`) → gère Babel/Webpack avec support Tailwind + Framer.
  - Utiliser `RenderInternals` Remotion pour orchestrer composition -> PNG frames -> FFmpeg assembly.
  - Activer GPU via Chromium Headless (Chromium flags + Docker image CUDA).
  - Configuration : variables `VIDEO_RENDERER_ENABLE_GPU`, `VIDEO_RENDERER_CHROMIUM_EXECUTABLE`, `VIDEO_RENDERER_BROWSER_DOWNLOAD_DIR`.
- **Gestion assets** :
  - Répertoire de travail isolé (`/tmp/yukpo_render/<job_id>`).
  - Upload vers S3/MinIO après rendu.
- **Templates** :
  - Mapper IntroPulse, ProductShowcase, ARHighlight, GlowCTA vers compositions Remotion.
  - Créer `templates/effects/` pour transitions 3D, speedramps, stickers AR.

### 3. Effets avancés & color grading
- **Transitions 3D** : composants `OrbitTransition`, `ParallaxSlide` utilisant `remotion-three`.
- **Stickers AR** : overlay PNG/Lottie animés; stockage `assets/stickers/`.
- **Speedramps** : timeline Remotion (keyframes playbackRate) + fonctions `createSpeedRamp(keyframes)`.
- **Color grading / LUTs** :
  - Ensemble `assets/luts/*.cube`.
  - Intégration via FFmpeg `lut3d` (pré-assemblage) ou shader Remotion (GPU).
  - Pipeline : b-roll pré-process → apply LUT → result pour montage final.

### 4. Audio premium & SFX
- **Intégration APIs** :
  - Services Dolby.io ou AudioShake (Normalisation + spatialisation).
  - Config via secrets (`PREMIUM_AUDIO_ENDPOINT`, `PREMIUM_AUDIO_API_KEY`).
- **Workflow** :
  1. Générer voix premium (TTS) → `voiceover.wav`.
  2. Envoyer stems vers Dolby/AudioShake → récupérer mix spatial `.wav`.
  3. Synchroniser avec timeline audio cues.
- **SFX dynamiques** :
  - Catalogue SFX (`assets/sfx/`) indexé par intensité/évènement.
  - `timeline.audio_events` → pipeline Rust génère `AudioLayer` (gain, offset).
  - Ajout sidechain (ducking) dans FFmpeg filter graph.
- **Fallback** : si API premium KO → pipeline local (WideStereo + loudnorm) + log analytics.

### 5. B-roll IA “wow”
- **Services IA** :
  - Connecteurs `Runway`, `Pika`, `Sora` via `broll_service::providers`.
  - Auto-prompts : `broll_prompter.rs` combine catégorie, ambiance, produit, superlatifs.
- **Caching** :
  - Cache metadata (hash brief + style) → Redis.
  - Stockage vidéo IA dans S3 + TTL; fallback stock clips.
- **Multi-format** :
  - Master 9:16, dérivés 1:1 et 16:9 (`ffmpeg -filter:v scale, crop`).
  - Génération storyboards (JPEG) pour API front.

### 6. Orchestration complète
- **Structure** :
  ```text
  ImmersiveOrchestrator::generate(job)
      → BudgetChecker::precheck()
      → ImmersiveTimelineBuilder (GPT + heuristiques)
      → TemplateAllocator (map timeline → Remotion compositions)
      → BrollService::fulfill_slots()
      → AudioPipeline::prepare_layers()
      → RenderWorkerQueue::enqueue(job)
      → Await completion → AnalyticsLogger::record()
  ```
- **Gestion d’échec** :
  - Retries (3) sur IA vidéo; downgrade vers stock.
  - Timeout global; cancellation + notification front.
  - Persist state en DB (`immersive_jobs` table) avec statut.
- **Analytics** :
  - Log sources (IA vs stock), temps rendu, coût, score qualité.

### 7. Suivi coûts & alertes
- **Journalisation** :
  - `app_ia.rs` stocke tokens par prompt (`prompt_type`, `tokens_used`, `cost_usd`).
  - `video_costs` table : `job_id`, `estimation`, `actual`, `components`.
- **Moyenne dynamique** :
  - Exponentially Weighted Moving Average par type de prompt.
- **Pré-check budget** :
  - Calcul = Σ(avg_tokens_type * price/token) + prix IA vidéo + voix premium + mastering.
  - Comparaison au solde utilisateur (tokens/crédits).
  - Si insuffisant → erreur `BudgetInsufficient`; UI propose recharge.
- **Alerting** :
  - Slack/Webhook si coût > seuil.
  - Observabilité via Prometheus metrics.

### 8. APIs, secrets & configuration
- **Env** : `.env`, Vault, Kubernetes Secrets.
- **Variables** :
  ```
  PREMIUM_TTS_ENDPOINT, PREMIUM_TTS_API_KEY, PREMIUM_TTS_VOICE
  STOCK_VIDEO_API_URL, STOCK_VIDEO_API_KEY
  RUNWAY_API_URL, RUNWAY_API_KEY
  PIKA_API_URL, PIKA_API_KEY
  DOLBY_IO_ENDPOINT, DOLBY_IO_APP_KEY, DOLBY_IO_APP_SECRET
  ```
- **Rotation** :
  - Configurer expiration, logs d’accès.
- **Rate limiting** :
  - Implémenter quotas côté service (backoff).

### 9. Infrastructure & scripts
- **Docker** :
  - Image `yukpo-remotion-worker` (Node 20, Chromium, CUDA, FFmpeg, espeak fallback, polices DejaVu/Arial).
  - GPU support (Nvidia base image + Remotion GPU flags).
- **CI/CD** :
  - Pipeline worker (lint, unit tests, rendu sample 5s).
  - Stage backend: tests Rust + checks budgeting.
- **Jobs** :
  - `scripts/render_job.ps1` pour test local.
  - Kubernetes Cron pour purge caches.
- **Guide complet** :
  - Voir `docs/cloud_deployment_guide.md` pour la configuration Docker/K8s, variables et secrets.

### 10. Frontend UX & transparence
- **UI** :
  - Bouton “Créer vidéo immersive”.
  - Modal progression (phases : préparation IA, génération b-roll, rendu vidéo, mastering audio).
  - ETA estimée, statut, logs compacts.
  - Alerte budget insuffisant + option recharge.
- **WebSocket** :
  - Channel `immersive_generation_progress`.
  - Events : `queued`, `broll_fetch`, `rendering`, `audio_mastering`, `finalizing`, `completed`, `error`.
- **API backend** :
  - `VideoGenerationResult` expose `progress_steps` + `cost_estimation` pour l'UI.

### 11. QA, monitoring & analytics
- **Tests automatisés** :
  - Scénario complet (brief → rendu) avec mocks IA.
  - Tests fallback (IA vidéo KO, budget insuffisant).
  - Validation multi-format (durée, ratio, LUT).
- **Monitoring** :
  - Sentry (exceptions pipeline).
  - Prometheus/Grafana : temps rendu, taux réussite, coût moyen.
  - Alertes budget > seuil.
  - Middleware `monitoring` log (méthode / status / temps).
- **Support** :
  - Dashboard analytics (`GET /api/media/analytics/overview?days=7`).
  - Dashboard analytics (jobs, coûts, succès par template).


