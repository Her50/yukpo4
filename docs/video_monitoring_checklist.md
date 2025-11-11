# Vidéo Immersive – Checklist QA & Monitoring

## Scénarios automatisables
- Script end-to-end (mock IA) :
  1. appel `POST /api/media/product/{service}/{index}/estimate-video`
  2. vérifier `affordable`, `progress_steps` (budget validé)
  3. lancer `POST /api/media/product/{service}/{index}/generate-video`
  4. vérifier `progress_steps` (timeline, audio, mux)
  5. contrôler `cost_estimation` et `immersive_timeline`
- Tests fallback :
  - Simuler solde insuffisant (attendre 403).
  - Simuler absence b-roll (warning + timeline sans vidéo).

## Monitoring runtime
- Middleware `monitoring` (log méthode, statut, temps ms).
- `GET /api/media/analytics/overview?days=7`
  - `videos_generated`
  - `total_views`, `total_shares`
  - `average_quality_score`
  - `distribution_success`, `distribution_pending`
- `GET /api/media/quality?limit=50` pour historique détaillé.

## Points de collecte (logs / dashboards)
- `record_engagement` (events `quality_score`, `progress_steps`, `cost_estimation`).
- `media_distribution` (statuts `scheduled`, `processing`, `completed`).
- Récupérer `VideoGenerationResult.progress_steps` côté front pour UX temps réel.

## Variables d'environnement utiles
- Coût IA : `IA_COST_PER_1K_TOKENS_USD`, `VIDEO_DEFAULT_TOKENS_ESTIMATE`, `VIDEO_TOKENS_PER_SLIDE_ESTIMATE`.
- Coûts additionnels : `VIDEO_AUDIO_MASTERING_COST_USD`, `VIDEO_BROLL_AI_COST_USD`.
- Conversion : `USD_TO_FCFA_RATE`, `USD_TO_EUR_RATE`, `VIDEO_DEFAULT_USER_CURRENCY`.
- Worker Remotion : `VIDEO_RENDERER_ENABLE_GPU`, `VIDEO_RENDERER_CHROMIUM_EXECUTABLE`, `VIDEO_RENDERER_BROWSER_DOWNLOAD_DIR`.
- Référence détaillée : voir `docs/video_pipeline_env.md`.

## Actions recommandées (cloud)
1. Exposer les endpoints analytics (auth JWT) aux dashboards internes.
2. Configurer alertes (ex. coût > seuil, `affordable = false`).
3. Intégrer la commande QA e2e dans la CI/CD (pipeline staging).
