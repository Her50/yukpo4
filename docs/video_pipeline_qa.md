# QA Pipeline Vidéo – Checklist TikTok/Reels

## 1. Worker Remotion (GPU)
- **Préparation**
  - Vérifier `REMOTION_PROJECT_ROOT`, `REMOTION_NODE_BIN`, `REMOTION_ENABLE_GPU`.
  - Lancer `npm run build` dans le projet Remotion si besoin (ou laisser `ensure_build`).
- **Tests**
  - `cargo test remotion_timeline` (si tests unitaires) puis lancer un rendu réel :
    ```bash
    curl -X POST http://backend.internal/api/media/product/<service>/<product>/generate-video
    ```
  - Inspecter artefacts : watermark Yukpo, LUT appliquée, transitions, mix audio.
  - Vérifier fallback IA (logs `[RemotionRenderer]`) si asset manquant.
- **Acceptation**
  - Temps de rendu < 120 s sur GPU.
  - Vidéo exportée dans `renders/<job>` + `jobs/<job>.json`.

## 2. Mobile Expo (Wizard immersif)
- **Préparation**
  - Installer dépendances : `npm install` (mobile) + expo CLI.
  - Variables `.env` alignées (API_BASE_URL, IA tokens).
- **Scénarios**
  1. Auth → lancer wizard → estimation budget (toast `Budget validé`).
  2. Lancer génération → suivre polling (`VideoAnalyticsScreen` => job timeline).
  3. Réception résultat → lecture vidéo, toasts i18n.
  4. Mode offline (Couper réseau) → vérifier fallback/erreurs.
- **Automatisation (option)**
  - Detox : script `detox test --configuration ios.sim.debug`.
  - Captures `VideoAnalyticsScreen` FR/EN.

## 3. Web Playwright (Wizard + Analytics)
- **Préparation**
  - `cd frontend && npm install && npm run dev` (ou build). NB: config `API_BASE_URL`.
- **Tests**
  - Script Playwright (ex: `tests/video-wizard.spec.ts`)
    1. Auth mock / stub service.
    2. Remplir wizard, valider budget, lancer job (mock API).
    3. Vérifier UI progression (status badges, timeline).
    4. Vérifier `VideoAnalyticsOverviewSection` : tabs Contenu/Live, synthèse.
    5. Vérifier accessibilité (ARIA) via `page.accessibility.snapshot()`.
- **Commandes**
  ```bash
  npm run test:e2e -- --project=chromium --grep="Immersive"
  ```

## 4. Résultats & Reporting
- Centraliser logs/jobs dans `docs/qa/` (CSV ou Markdown).
- Remonter anomalies en issues (avec job_id, logs pipeline, captures).
- Mettre à jour `pipeline_monitoring.md` si nouveaux signaux.
- **Script rapide** : `./scripts/run_video_pipeline_qa.sh` (nécessite Remotion, Detox, Playwright configurés).
