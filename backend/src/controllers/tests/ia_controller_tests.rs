// ✅ Tests d'intégration pour les routes IA

#[cfg(test)]
mod integration_tests {
    use axum::{
        body::Body,
        http::{Request, StatusCode},
    };
    use tower::ServiceExt;
    use crate::routes::ia_routes;
    use crate::state::AppState;
    use std::sync::Arc;

    // Helper pour créer un AppState de test
    fn create_test_state() -> Arc<AppState> {
        // TODO: Créer un AppState minimal pour les tests
        // Pour l'instant, ceci nécessite une vraie base de données
        todo!("Implémenter création AppState de test")
    }

    #[tokio::test]
    #[ignore] // Ignorer par défaut car nécessite setup complet
    async fn test_auto_cut_endpoint() {
        let state = create_test_state();
        let app = ia_routes(state);

        let request = Request::builder()
            .method("POST")
            .uri("/api/ia/video/auto-cut")
            .header("content-type", "application/json")
            .body(Body::from(r#"{"video_url": "test.mp4"}"#))
            .unwrap();

        let response = app.oneshot(request).await.unwrap();
        
        // Vérifier que la route existe (même si elle échoue sans auth)
        assert_ne!(response.status(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    #[ignore]
    async fn test_audio_sync_endpoint() {
        let state = create_test_state();
        let app = ia_routes(state);

        let request = Request::builder()
            .method("POST")
            .uri("/api/ia/video/audio-sync")
            .header("content-type", "application/json")
            .body(Body::from(r#"{"video_url": "test.mp4"}"#))
            .unwrap();

        let response = app.oneshot(request).await.unwrap();
        assert_ne!(response.status(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    #[ignore]
    async fn test_color_grade_endpoint() {
        let state = create_test_state();
        let app = ia_routes(state);

        let request = Request::builder()
            .method("POST")
            .uri("/api/ia/media/color-grade")
            .header("content-type", "application/json")
            .body(Body::from(r#"{"media_url": "test.jpg", "style_preset": "cinematic"}"#))
            .unwrap();

        let response = app.oneshot(request).await.unwrap();
        assert_ne!(response.status(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    #[ignore]
    async fn test_auto_captions_endpoint() {
        let state = create_test_state();
        let app = ia_routes(state);

        let request = Request::builder()
            .method("POST")
            .uri("/api/ia/video/auto-captions")
            .header("content-type", "application/json")
            .body(Body::from(r#"{"video_url": "test.mp4", "lang": "fr"}"#))
            .unwrap();

        let response = app.oneshot(request).await.unwrap();
        assert_ne!(response.status(), StatusCode::NOT_FOUND);
    }
}

