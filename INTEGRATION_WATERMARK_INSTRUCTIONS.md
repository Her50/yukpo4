# 🔧 Instructions d'Intégration Watermark

## Modifications Requises dans `video_generation_service.rs`

### 1. Ajouter l'import du service watermark

**Ligne ~45** (dans la section `use crate::services::`) :

```rust
use crate::{
    core::types::{AppError, AppResult},
    middlewares::jwt::AuthenticatedUser,
    services::{
        app_ia::VideoBriefRequest,
        audio_library_service,
        audio_mastering_service::AudioMasteringOutcome,
        audio_pipeline::{self, AudioMixConfig},
        broll_service,
        commerce_connector_service::ProductConnectorSnapshot,
        cost_service::CostEstimation,
        distribution_automation_service,
        immersive_orchestrator::{
            ImmersiveOrchestrator, TimelineAnalytics, TimelineBrollAsset, TimelineBusinessContext,
            TimelineRequest,
        },
        immersive_timeline::ImmersiveTimeline,
        inventory_service::INVENTORY_STALE_THRESHOLD_HOURS,
        timeline_converter::convert_timeline_json_to_immersive,
        video_analytics_service::{record_engagement, schedule_distribution_targets},
        video_job_service::try_store_progress,
        video_renderer::{RenderExecutionMode, RenderJobRequest, RenderJobResponse},
        voice_profile_service::ResolvedVoiceProfile,
        watermark_service, // ✅ AJOUTER ICI
    },
    state::AppState,
};
```

### 2. Option payload déjà ajoutée ✅

L'option `enable_watermark: Option<bool>` a déjà été ajoutée au `VideoGenerationPayload`.

### 3. Application du watermark avant stockage

**Ligne ~1929-1986** (juste avant le stockage) :

```rust
    let final_filename = format!("product_video_{}.mp4", session_id);
    let storage_key = format!("services/{}", final_filename);
    let mut source_master_path = renderer_response  // ✅ CHANGER EN `mut`
        .as_ref()
        .map(|resp| resp.master_video.clone())
        .unwrap_or_else(|| session_dir.join("final.mp4"));

    // ✅ AJOUTER ICI : Application du watermark Yukpo
    if payload.enable_watermark.unwrap_or(true) {
        let watermark_service = watermark_service::WatermarkService::new();
        let watermarked_path = session_dir.join("final_with_watermark.mp4");
        
        match watermark_service.apply_watermark(
            &source_master_path,
            &watermarked_path,
            None, // Utilise config par défaut
        ).await {
            Ok(path) => {
                info!("[VideoGeneration] ✅ Watermark Yukpo appliqué: {:?}", path);
                progress_steps.push(ProgressStep::completed(
                    "watermark",
                    "Watermark Yukpo appliqué",
                    Some("Branding automatique".to_string()),
                ));
                if let Some(job_id) = job_id {
                    try_store_progress(&state, job_id, "running", &progress_steps).await;
                }
                // Utiliser la vidéo avec watermark pour le stockage
                source_master_path = path;
            }
            Err(err) => {
                warn!("[VideoGeneration] ⚠️ Échec watermark, vidéo sans watermark: {}. La vidéo sera stockée sans branding.", err);
                // Continuer sans watermark (fallback)
            }
        }
    }

    let remote_location = renderer_response.as_ref().and_then(|resp| {
        // ... reste du code existant
```

### 4. Gestion du cas Remote Location

**Note importante** : Si `remote_location` existe (vidéo déjà stockée via Remotion remote), le watermark ne sera pas appliqué. C'est acceptable car :
- Le watermark pourrait être appliqué côté Remotion dans le futur
- Les vidéos Remotion remote sont moins fréquentes

Si vous voulez appliquer le watermark même pour remote, il faudrait :
1. Télécharger la vidéo remote
2. Appliquer le watermark
3. Re-uploader

**Pour l'instant, on se concentre sur le cas local (le plus fréquent)**.

---

## Résumé des Changements

1. ✅ **Service watermark créé** : `backend/src/services/watermark_service.rs`
2. ✅ **Module exporté** : Ajouté dans `backend/src/services/mod.rs`
3. ✅ **Option payload ajoutée** : `enable_watermark: Option<bool>`
4. ⏳ **Import à ajouter** : `watermark_service` dans les imports
5. ⏳ **Code d'intégration** : Appliquer watermark avant stockage
6. ⏳ **Rendre source_master_path mutable** : Changer `let` en `let mut`

---

## Tests Après Intégration

1. Vérifier compilation : `cargo check`
2. Tester avec vidéo réelle
3. Vérifier que le watermark apparaît à la fin de la vidéo
4. Vérifier performance (< 5% temps de rendu ajouté)
5. Tester avec `enable_watermark: false`

---

**Statut** : Instructions prêtes, intégration à finaliser


