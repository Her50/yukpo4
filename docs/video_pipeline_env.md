## Variables Environnement Vidéo Immersive

### Coûts IA et conversions (backend `CostEstimator`)
- **`IA_COST_PER_1K_TOKENS_USD`**  
  - Fallback: `0.015`  
  - Usage: `backend/src/services/cost_service.rs` (`token_price_per_1k_usd`)  
  - Note: valeur USD pour 1k tokens IA (IA rédaction timeline, voix, etc.).
- **`VIDEO_DEFAULT_TOKENS_ESTIMATE`**  
  - Fallback: `2400`  
  - Usage: `CostEstimator::new` (`default_tokens`)  
  - Note: estimation de base lorsque pas d’historique `token_usage_logs`.
- **`VIDEO_TOKENS_PER_SLIDE_ESTIMATE`**  
  - Fallback: `220`  
  - Usage: `CostEstimator::new` (`tokens_per_slide`)  
  - Note: tokens additionnels par élément du storyboard envoyé côté mobile.
- **`VIDEO_AUDIO_MASTERING_COST_USD`**  
  - Fallback: `0.8`  
  - Usage: `CostEstimator::new` (`default_audio_cost_usd`)  
  - Note: coût unitaire mastering premium (Dolby/AudioShake).
- **`VIDEO_BROLL_AI_COST_USD`**  
  - Fallback: `1.2`  
  - Usage: `CostEstimator::new` (`default_broll_cost_usd`)  
  - Note: coût moyen par b-roll IA (Runway, Pika, Sora).
- **`USD_TO_FCFA_RATE`**  
  - Fallback: `600.0`  
  - Usage: `CostEstimator::new` (`usd_to_fcfa`) et conversion totals FCFA.  
  - Note: mettre à jour mensuellement (indice BEAC).
- **`USD_TO_EUR_RATE`**  
  - Fallback: `0.92`  
  - Usage: `CostEstimator::new` (`usd_to_eur`).  
  - Note: utilisé pour clients UE; prévoir arrondi 2 décimales côté front.
- **`VIDEO_DEFAULT_USER_CURRENCY`**  
  - Fallback: `XAF`  
  - Usage: `CostEstimator::new` (`default_currency`).  
  - Note: sera remplacé par préférences utilisateur (TODO `resolve_user_currency`).

### Worker Remotion (backend `VideoRendererConfig` + worker Node)
- **`VIDEO_RENDERER_ENABLED`**  
  - Fallback: `true` si `VIDEO_RENDERER_PROJECT_ROOT` existe, sinon worker désactivé.  
  - Usage: `backend/src/config/video_renderer.rs` (`enabled`).  
  - Note: mettre à `false` sur environnements sans Node/Remotion.
- **`VIDEO_RENDERER_PROJECT_ROOT`**  
  - Fallback: `video-renderer`  
  - Usage: vérifie existence des bundles, dossiers `jobs/`, `renders/`.  
  - Note: valeur absolue recommandée dans Docker/K8s (`/app/video-renderer`).
- **`VIDEO_RENDERER_NODE_BIN`**  
  - Fallback: `node`  
  - Usage: `remotion_renderer_service.rs` -> process Node.  
  - Note: pointer vers `/usr/local/bin/node` dans containers personnalisés.
- **`VIDEO_RENDERER_AUTO_BUILD`**  
  - Fallback: `true`  
  - Usage: déclenche `npm run build` si bundle absent (`ensure_build`).  
  - Note: mettre à `false` en production (CI/CD doit pré-construire `dist/`).
- **`VIDEO_RENDERER_ENABLE_GPU`**  
  - Fallback: `false`  
  - Usage: exporte `REMOTION_ENABLE_GPU=true` pour Chromium flags.  
  - Note: activer seulement sur instances avec GPU NVIDIA + drivers configurés.
- **`VIDEO_RENDERER_CHROMIUM_EXECUTABLE`**  
  - Fallback: *(None)*  
  - Usage: définit `REMOTION_BROWSER_EXECUTABLE` et `PUPPETEER_EXECUTABLE_PATH`.  
  - Note: obligatoire si Chromium non détecté automatiquement (ex: `/usr/bin/chromium`).
- **`VIDEO_RENDERER_BROWSER_DOWNLOAD_DIR`**  
  - Fallback: *(None)*  
  - Usage: Rend persistants les téléchargements Chrom(ium).  
  - Note: pointer vers volume persistant (`/tmp/remotion-chrome`) dans Docker GPU.

### Audio premium (backend `PremiumAudioConfig`)
- **`PREMIUM_AUDIO_ENABLED`**  
  - Fallback: `true` (si `ENDPOINT` et `API_KEY` fournis).  
  - Usage: active/désactive `AudioMasteringService`.  
  - Note: mettre à `false` sur environnements de dev sans clé.
- **`PREMIUM_AUDIO_PROVIDER`**  
  - Fallback: `dolby`  
  - Options: `dolby`, `audioshake`, `custom`.  
  - Impact: sélection de l’implémentation provider (Dolby.io, AudioShake, pipeline interne).
- **`PREMIUM_AUDIO_ENDPOINT` / `PREMIUM_AUDIO_API_KEY`**  
  - Requis pour activer.  
  - Note: stocker dans secrets (Vault/K8s).  
- **`PREMIUM_AUDIO_POLL_INTERVAL_MS`**  
  - Fallback: `3000`  
  - Usage: polling statut mastering dans `AudioMasteringService`.

### B-roll IA et stock (`BrollConfig`)
- **`STOCK_VIDEO_API_URL` / `STOCK_VIDEO_API_KEY`**  
  - Usage: fallback stock footage provider.  
  - Note: configurer CDN interne si Runway/Pika indisponible.
- **`RUNWAY_API_URL` / `RUNWAY_API_KEY`**  
  - Usage: provider principal vidéo IA.  
- **`PIKA_API_URL` / `PIKA_API_KEY`**  
  - Usage: provider secondaire.  
- **`SORA_API_URL` / `SORA_API_KEY`**  
  - Usage: provider expérimental (garder désactivé si indispo).  
- **`BROLL_DOWNLOAD_DIR`**  
  - Fallback: `storage/broll`  
  - Note: monter volume persistant (S3 sync) dans production.
- **`BROLL_CACHE_ENABLED`**  
  - Fallback: `true`  
  - Impact: active cache Redis/FS pour éviter rerendu.  
- **`BROLL_CACHE_TTL_SECS`**  
  - Fallback: `86400` (24h)  
  - Note: min 60s (forcé par code).

### Conversion & monitoring à documenter
- Tenir à jour la documentation : `docs/video_monitoring_checklist.md`, `docs/immersive_video_execution_plan.md`.  
- Synchroniser toute modification avec les scripts de déploiement (`deploy_digitalocean/`, Docker Remotion).  
- Ajouter les valeurs validées dans les manifests Kubernetes / Compose (TODO dans guide déploiement).

### Actions à mener
1. **Mettre à jour les fichiers `.env.example` / templates** avec toutes les variables ci-dessus.  
2. **Créer un script de validation** (ex: `scripts/check_video_env.rs`) pour détecter les variables manquantes au boot.  
3. **Documenter les sources de vérité** (taux de change) et planifier leur rafraîchissement automatique.  
4. **Intégrer les secrets premium** dans la doc déploiement (Vault, Render, Fly.io, etc.).  
5. **S’assurer du fallback** en l’absence de GPU (désactiver GPU et privilégier build pré-compilé).

