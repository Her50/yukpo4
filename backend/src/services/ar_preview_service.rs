// ✅ NOUVEAU Phase 3.2: Service de rendu 3D pour preview AR

use crate::models::ar_preview_model::{
    ARClip3D, ARPreviewRequest, ARPreviewResponse, ARTrackingState,
};
use crate::services::ar_3d_render_service::AR3DRenderService;
use log::{info, warn};
use sqlx::PgPool;
use std::sync::Arc;

pub struct ARPreviewService {
    #[allow(dead_code)]
    pool: Arc<PgPool>,
    render_service: AR3DRenderService,
}

impl ARPreviewService {
    pub fn new(pool: Arc<PgPool>) -> Self {
        Self {
            pool,
            render_service: AR3DRenderService::new(),
        }
    }

    /// Génère une preview 3D pour AR à partir d'une timeline
    pub async fn generate_ar_preview(
        &self,
        request: ARPreviewRequest,
    ) -> Result<ARPreviewResponse, String> {
        info!(
            "[ARPreview] Génération preview AR pour timeline: {}",
            request.timeline_id
        );

        // 1. Charger la timeline depuis la DB et convertir en clips 3D
        let clips = self.load_timeline_clips(&request.timeline_id).await?;

        // 2. Convertir clips en scène 3D
        let scene_data =
            self.render_service.timeline_to_ar_scene(&request.timeline_id, clips).await?;

        // 3. Rendre la scène en vidéo preview avec le service de rendu 3D
        let response = self.render_service.render_ar_preview(request, &scene_data).await?;

        Ok(response)
    }

    /// Charge les clips d'une timeline depuis la DB
    async fn load_timeline_clips(&self, timeline_id: &str) -> Result<Vec<ARClip3D>, String> {
        // TODO: Charger réellement depuis la DB
        // Pour l'instant, retourner un vecteur vide
        warn!(
            "[ARPreview] Chargement clips depuis DB non encore implémenté pour timeline: {}",
            timeline_id
        );
        Ok(vec![])
    }

    /// Valide l'état de tracking AR
    pub async fn validate_tracking_state(&self, tracking_state: &ARTrackingState) -> bool {
        tracking_state.is_tracking && tracking_state.tracking_quality >= 0.5
    }
}
