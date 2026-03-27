//! Tests d'intégration HTTP : analytics orientation (`/track`, batch filière).
//! Nécessite `TEST_DATABASE_URL` (voir `AppState::mock_for_tests`).

#[cfg(test)]
mod tests {
    use axum::{
        body::Body,
        http::{Request, StatusCode},
        Router,
    };
    use serde_json::json;
    use std::sync::Arc;
    use tower::ServiceExt;
    use yukpomnang_backend::{build_app, state::AppState};

    async fn create_test_app() -> Router {
        let app_state = Arc::new(AppState::mock_for_tests().await);
        build_app(app_state)
    }

    #[tokio::test]
    async fn track_analytics_rejects_invalid_event_type() {
        let app = create_test_app().await;
        let body = json!({
            "etablissement_id": 1,
            "event_type": "invalid_type_xyz",
            "filiere": null,
        });
        let request = Request::builder()
            .uri("/api/orientation/analytics/track")
            .method("POST")
            .header("content-type", "application/json")
            .body(Body::from(body.to_string()))
            .unwrap();
        let response = app.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn track_filiere_batch_rejects_empty_filiere() {
        let app = create_test_app().await;
        let body = json!({
            "filiere": "   ",
            "etablissement_ids": [1, 2],
        });
        let request = Request::builder()
            .uri("/api/orientation/analytics/track-filiere-search-batch")
            .method("POST")
            .header("content-type", "application/json")
            .body(Body::from(body.to_string()))
            .unwrap();
        let response = app.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn track_filiere_batch_ok_with_empty_ids() {
        let app = create_test_app().await;
        let body = json!({
            "filiere": "Scientifique",
            "etablissement_ids": [],
        });
        let request = Request::builder()
            .uri("/api/orientation/analytics/track-filiere-search-batch")
            .method("POST")
            .header("content-type", "application/json")
            .body(Body::from(body.to_string()))
            .unwrap();
        let response = app.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);
    }
}
