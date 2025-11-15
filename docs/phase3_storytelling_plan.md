# Phase 3 — Intégration templates/storytelling & infra vidéo

## 1. Registre de templates narratifs
- [x] Ajouter un `TemplateRegistry` côté `video-renderer` (`storyTemplates.ts`) avec les variantes `blog`, `tutorial`, `testimonial`, `comparison`.
- [ ] Sérialiser ce registre via un endpoint backend `GET /studio/templates` (Axum) afin que web + mobile puissent afficher le metadata (catégories, ton, CTA recommandés).
- [ ] Stocker le template sélectionné dans `studio_sessions.recommended_templates[0]` pour chaque prévisualisation.
- [ ] Ajouter un champ `template_context` JSONB dans `studio_sessions.timeline_settings` pour tracer les champs métiers (SLA delivery, ton IA, CTA).

### Checklist backend
1. Créer `TemplateRegistryService` qui charge les specs du renderer (lecture JSON/const).
2. Exposer `GET /api/studio/templates` (cache 5 min en mémoire).
3. Étendre `StudioService.save_timeline` pour enregistrer `lane` (template choisi) + `metadata->>'business_context'`.
4. Ajouter tests d’intégration couvrant:
   - sélection template + preview.
   - remontée des templates via API.

## 2. Orchestrateur & worker Remotion
- [ ] `ImmersiveOrchestrator` doit scorer les templates selon:
  - `service.category` (`recommendedCategories`).
  - métriques delivery (SLA < 45min ⇒ favoriser `tutorial` ou `testimonial` selon `pain_point`).
  - disponibilité audio (si `voice_profile_id` → `testimonial` / `comparison`).
- [ ] Pipeline worker:
  - Charger `templateId` + `StoryBusinessContext`.
  - Utiliser `buildTimelineFromTemplate(templateId, ctx)` pour générer la timeline avant enrichissement IA.
  - Ajouter instrumentation Prometheus: durée par template, nb de warnings.
- [ ] Tests snapshot Remotion pour chaque template (fixtures `context.json`).

## 3. Prévisualisation & publication
- [x] Web & mobile consomment désormais `studioService`.
- [ ] Ajouter preview basse résolution depuis worker GPU (H.264 480p) avec stockage Wasabi (prefix `studio/previews/{session_id}.mp4`).
- [ ] Créer Cloudflare R2/Wasabi bucket dédié + policy 5 min expire.
- [ ] `publish_session` doit déclencher:
  - recalcul timeline haute résolution + audio (avec voix sélectionnée).
  - génération variantes ABR (1080/720/480) + HLS manifest.
  - enregistrement `video_variant_id` sur la table delivery (future intégration métier).

## 4. Analytics & A/B testing
- [ ] Table `studio_ab_tests`:
  - `id`, `session_id`, `variant_a_template`, `variant_b_template`, `target_metric`, `status`.
- [ ] Endpoint `POST /studio/ab-tests` pour configurer une expérimentation (CTA, ton, asset).
- [ ] Instrumenter LiveKit / player web pour envoyer:
  - `watch_time_ms`, `completion_rate`, `cta_clicks`, `conversion_id`.
- [ ] Dashboard (Grafana + Metabase) avec:
  - succès previews, durée moyenne, % fallback offline.
  - résultats A/B (écart metric, significance).

## 5. Sécurité & infra
- [ ] Secrets Studio (API IA, Wasabi, Remotion) via Vault/SOPS (déjà amorcé pour GPU).
- [ ] Quotas IA:
  - middleware Axum limit 5 previews / heure / compte.
  - compteur Redis pour abtests (1 active / service).
- [ ] WAF Cloudflare sur `/api/studio/*`.
- [ ] Monitoring:
  - exporter `studio_preview_duration_seconds`, `studio_preview_errors_total`.
  - tracer `template_id`, `delivery_sla_bucket`.

## 6. Déploiement / PR order
1. **PR#1** backend migrations supplémentaires (`studio_ab_tests`, colonnes context).
2. **PR#2** TemplateRegistryService + endpoint `/studio/templates`.
3. **PR#3** Orchestrateur worker (Remotion) + instrumentation.
4. **PR#4** UI web + mobile (liaison template metadata, preview video player).
5. **PR#5** Analytics/A-B testing + dashboards.

## 7. Tests à prévoir
- Axum integration tests (`studio_controller`), y compris quotas.
- Remotion snapshot tests + unit tests scoring orchestrateur.
- Frontend RTL tests (CreatorStudioPreviewCard) + Jest mobile hook.
- Load tests `POST /studio/preview` (k6) pour valider timeouts.

---
Statut actuel (14 novembre 2025):
- ✅ Registre templates côté renderer.
- ✅ Hooks web/mobile connectés au backend Studio.
- ⏳ Reste à faire: endpoints metadata, orchestrateur scoring, preview GPU, analytics, A/B tests.

