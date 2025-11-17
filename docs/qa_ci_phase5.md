# Phase 5 – QA & CI Industrialisation

Cette page est la source unique pour la mise en œuvre de la phase 5 : fiabiliser la chaîne de livraison grâce à une CI élargie, aux scripts QA automatisés et à la documentation des environnements.

## 1. Workflows CI GitHub

Workflow : `.github/workflows/ci.yml`

- **Déclencheurs** : `push` (main/develop), `pull_request`, `workflow_dispatch`, cron quotidien `0 2 * * *`
- **Concurrency** : une exécution par branche (`ci-Yukpo Phase 5 CI`)

### Jobs

| Job | Description | Points clés |
| --- | --- | --- |
| `backend` | fmt/clippy/tests/sqlx/build sur Ubuntu + Windows | `SQLX_OFFLINE=true`, secret `DATABASE_URL_OFFLINE`, artefact `backend/sqlx-data.json` |
| `frontend` | lint + vitest coverage + build | Cache npm, `npx playwright install`, artefacts `frontend/coverage`, `frontend/dist` |
| `mobile` | vitest coverage + `expo export --platform web` | Secrets API Expo, artefacts `mobile/coverage`, `mobile/dist-web` |
| `video_renderer` | build Remotion worker + rendu sample | Artefacts `video-renderer/renders`, `video-renderer/jobs` |
| `qa_seed` | applique `scripts/seed_staging.sh` sur la base staging | Requiert `STAGING_DATABASE_URL`, installe `psql` |
| `playwright_e2e` | tests Playwright headless sur staging | `PLAYWRIGHT_TEST_BASE_URL`, `API_BEARER_TOKEN`, rapport HTML en artefact |
| `qa_video` | exécute `scripts/run_video_pipeline_qa.sh --ci` | Scénarios audio premium / fallback / LiveKit mock / Wasabi, artefacts `artifacts/video-qa` |
| `detox_android` | suite Detox Android via emulator runner (push/schedule uniquement) | Nécessite `reactivecircus/android-emulator-runner` |

> TODO : ajouter un job `detox_ios` (runner macOS) et un rapport Codecov (backend via Tarpaulin, frontend/mobile via Vitest coverage).

## 2. Scripts QA & Artefacts

### `scripts/run_video_pipeline_qa.sh`

- Options : `--ci`, `--scenarios`, `--skip-backend`
- Env : `QA_ARTIFACTS_DIR`, `QA_MOBILE_CONFIGURATION`, `QA_PLAYWRIGHT_PROJECT`, `QA_VIDEO_SCENARIOS`
- Étapes : backend fmt/clippy/tests, build Remotion (`video-renderer`), Detox (configurable), Playwright.
- Sorties : 
  - `artifacts/video-qa/<timestamp>/qa.log`
  - `artifacts/video-qa/<timestamp>/summary.json`
  - copies `video-renderer/renders`, `mobile/artifacts`, `frontend/playwright-report`
- Scénarios supportés (à activer via `QA_VIDEO_SCENARIOS` ou `--scenarios`) :
  - `audio-premium` : exporte `PREMIUM_AUDIO_ENABLED=true`
  - `fallback-local` : vérifier `storage` local
  - `livekit-mock` : démarrer le mock LiveKit avant Detox / Playwright
  - `wasabi-storage` : forcer les variables `AWS_WASABI_*`

### `scripts/test_video_generation.ps1`

Reste disponible pour lancer un test API ciblé (génération + endpoint qualité) en local ou via un runner Windows. Peut servir à enrichir les jobs QA (ex: `Invoke-Pester`).

### Logs & Artefacts

| Source | Emplacement | Consommé par |
| --- | --- | --- |
| Detox | `mobile/artifacts/**/*` → `artifacts/video-qa/mobile` | `qa_video` job |
| Playwright | `frontend/playwright-report` + traces | jobs `frontend` / `playwright_e2e` |
| Remotion | `video-renderer/renders` | `video_renderer`, `qa_video` |
| LiveKit mock | TODO : journaliser vers `artifacts/video-qa/livekit.log` |

## 3. Seeds & Environnements

- **Script Bash** : `scripts/seed_staging.sh`
- **Script PowerShell** : `scripts/seed_staging.ps1`
- Dépendances : `psql` (installé dans le job `qa_seed`)
- Actuellement couverts :
  - `backend/scripts/seed_delivery_staging.sql` (client/coursier/livraison)
- À ajouter :
  - `backend/scripts/seed_media_staging.sql` (services média + tokens IA)
  - `backend/scripts/seed_video_assets.sql` (assets Remotion, IA, Wasabi)

### Templates d’environnement

| Fichier | Description |
| --- | --- |
| `env_template/backend.qa.env` | Variables `DATABASE_URL`, `REDIS_URL`, `MONGODB_URL`, `VIDEO_RENDERER_*`, `PREMIUM_AUDIO_*`, flags backend |
| `env_template/web.qa.env` | `VITE_API_BASE_URL`, `VITE_WS_BASE_URL`, flags web |
| `env_template/mobile.qa.env` | `EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUBLIC_WS_BASE_URL`, flags Expo |
| `gpu_worker_config.json` | déjà en place, documenter comment l’injecter (Wasabi cred, GPU flags) |

## 4. Feature Flags

- Objectif : pouvoir activer/désactiver `gpu_worker`, `connectors_livekit`, `global_promos`, `delivery_v2`, etc.
- Étapes :
  1. Ajouter `config/feature_flags.yml` (liste des flags, description, défaut).
  2. Backend : `feature_flags.rs` (lecture YAML/env, `FeatureFlagService` injectable via `Arc`).
  3. API : `GET /api/meta/feature-flags` pour les clients.
  4. Frontend/Mobile : `FeatureFlagProvider` + hook `useFeatureFlag`.
  5. Docs : section flags dans cette page + dans la checklist PR (cf. §6).

## 5. QA automatisée (scénarios critiques)

| Domaine | Scénario | Outil | Fréquence | Owner |
| --- | --- | --- | --- | --- |
| Vidéo immersive | Génération audio premium + fallback IAS | `scripts/run_video_pipeline_qa.sh --scenarios audio-premium` | nightly + avant release | Media Ops |
| Livraison | Création commande + tracking temps réel | Playwright (`tests/e2e/delivery-tracking.spec.ts`) | par PR | Web |
| Mobile | Wizard création service + suivi job | Detox (`android.emu.debug` / `ios.sim.debug`) | nightly + release candidate | Mobile |
| Connecteurs IA | LiveKit mock -> événements websocket | LiveKit mock + Playwright | weekly | Platform |
| Seeds/Provisioning | `scripts/seed_staging.(sh|ps1)` | GitHub Actions `qa_seed` | à chaque CI (non PR) | DevOps |

## 6. Release checklist & PR template

Fichier : `.github/PULL_REQUEST_TEMPLATE.md`

Checklist (extrait) :

- [ ] `cargo fmt`, `cargo clippy`, `cargo test` (backend)
- [ ] `npm run lint:check`, `npm run test -- --coverage`, `npm run build` (web)
- [ ] `npm run test -- --coverage` (mobile)
- [ ] `scripts/run_video_pipeline_qa.sh --scenarios …` exécuté (joindre artefacts)
- [ ] `npm run test:e2e` (Playwright) ou `Detox` selon périmètre
- [ ] Migrations appliquées sur staging / `scripts/seed_staging` OK
- [ ] Feature flags documentés (défaut, scope)

## 7. Observabilité QA

- Backend coverage : intégrer `cargo tarpaulin --out Xml --output-dir coverage/backend` (job nightly) + upload Codecov (`codecov/codecov-action@v4`).
- Frontend/Mobile coverage : `vitest --coverage` (artefacts déjà générés).
- Logs :
  - `artifacts/video-qa/qa.log`
  - `artifacts/video-qa/summary.json`
  - `artifacts/video-qa/livekit.log` (TODO)
  - `video-renderer/logs/*.log`
- Reporting : script (TODO) `scripts/qa/report.js` qui consolide les résultats CI + coverage + flags et met à jour `docs/qa/reports/<date>.md`.

## 8. Roadmap restante

1. Ajouter les seeds média/vidéo et les templates `.env`.
2. Implémenter le service de feature flags (backend + front/mobile) + endpoint.
3. Ajouter job `detox_ios` + runner GPU auto-hébergé (Remotion) pour `qa_video`.
4. Brancher Codecov + tarpaulin.
5. Script de reporting + commentaire automatique dans les PR (`actions/github-script`).

> Référence rapide : `docs/video_pipeline_qa.md`, `docs/video_monitoring_checklist.md`, `docs/STAGING_BACKEND_SETUP.md`, `docs/QA_GLOBAL_PROMO_SELF_SERVICE.md`.

