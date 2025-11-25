// Tests automatisés pour le système intelligent de matching banque de sang
#[cfg(test)]
mod blood_donation_matching_tests {
    use axum::{
        body::Body,
        http::{Request, StatusCode},
        Router,
    };
    use serde_json::json;
    use std::sync::Arc;
    use tower::ServiceExt;
    use yukpomnang_backend::{
        build_app,
        state::AppState,
    };

    // Helper function to create test app
    async fn create_test_app() -> Router {
        let app_state = Arc::new(AppState::mock_for_tests().await);
        build_app(app_state)
    }

    // Helper function to create a test user and get auth token
    async fn create_test_user_and_token(app: &Router) -> (i32, String) {
        // TODO: Implémenter création utilisateur de test et récupération token
        // Pour l'instant, retourner des valeurs mock
        (1, "test_token".to_string())
    }

    #[tokio::test]
    async fn test_create_blood_donation_request_with_stock_available() {
        let app = create_test_app().await;
        
        // Simuler une banque avec stock disponible
        // Le système devrait retourner un message indiquant que le stock est disponible
        // et ne pas créer de demande
        
        let request_data = json!({
            "banque_sang_id": 1,
            "service_id": 1,
            "groupe_sanguin_requis": "O+",
            "quantite_requise": 1,
            "is_urgent": false
        });

        let request = Request::builder()
            .uri("/api/blood-donation/requests")
            .method("POST")
            .header("Content-Type", "application/json")
            .header("Authorization", "Bearer test_token")
            .body(Body::from(serde_json::to_string(&request_data).unwrap()))
            .unwrap();

        let response = app.oneshot(request).await.unwrap();
        
        // Si stock disponible, devrait retourner 200 avec stock_available: true
        assert_eq!(response.status(), StatusCode::OK);
        
        // TODO: Vérifier le body de la réponse
        // let body = hyper::body::to_bytes(response.into_body()).await.unwrap();
        // let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
        // assert_eq!(json["stock_available"], true);
    }

    #[tokio::test]
    async fn test_create_blood_donation_request_without_stock() {
        let app = create_test_app().await;
        
        // Simuler une situation où aucune banque n'a le stock
        // Le système devrait créer une demande et lancer le matching
        
        let request_data = json!({
            "banque_sang_id": 1,
            "service_id": 1,
            "groupe_sanguin_requis": "AB-",
            "quantite_requise": 2,
            "is_urgent": true,
            "urgence_level": "critique",
            "request_latitude": 4.0511,
            "request_longitude": 9.7679
        });

        let request = Request::builder()
            .uri("/api/blood-donation/requests")
            .method("POST")
            .header("Content-Type", "application/json")
            .header("Authorization", "Bearer test_token")
            .body(Body::from(serde_json::to_string(&request_data).unwrap()))
            .unwrap();

        let response = app.oneshot(request).await.unwrap();
        
        // Devrait créer la demande et retourner 201
        assert_eq!(response.status(), StatusCode::CREATED);
    }

    #[tokio::test]
    async fn test_invalid_blood_group() {
        let app = create_test_app().await;
        
        let request_data = json!({
            "banque_sang_id": 1,
            "service_id": 1,
            "groupe_sanguin_requis": "INVALID",
            "quantite_requise": 1
        });

        let request = Request::builder()
            .uri("/api/blood-donation/requests")
            .method("POST")
            .header("Content-Type", "application/json")
            .header("Authorization", "Bearer test_token")
            .body(Body::from(serde_json::to_string(&request_data).unwrap()))
            .unwrap();

        let response = app.oneshot(request).await.unwrap();
        
        // Devrait retourner 400 Bad Request
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn test_blood_group_compatibility_rules() {
        // Test des règles de compatibilité des groupes sanguins
        // O- peut donner à tous
        // O+ peut donner à O+, A+, B+, AB+
        // A- peut donner à A-, A+, AB-, AB+
        // etc.
        
        // Ce test vérifie que find_potential_blood_donors respecte les règles
        // TODO: Implémenter test SQL direct de la fonction find_potential_blood_donors
    }

    #[tokio::test]
    async fn test_update_match_status_accepted() {
        let app = create_test_app().await;
        
        let request_data = json!({
            "match_id": "test_match_id",
            "new_status": "accepted"
        });

        let request = Request::builder()
            .uri("/api/blood-donation/matches/update-status")
            .method("POST")
            .header("Content-Type", "application/json")
            .header("Authorization", "Bearer test_token")
            .body(Body::from(serde_json::to_string(&request_data).unwrap()))
            .unwrap();

        let response = app.oneshot(request).await.unwrap();
        
        // Devrait retourner 200 OK
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_update_match_status_declined() {
        let app = create_test_app().await;
        
        let request_data = json!({
            "match_id": "test_match_id",
            "new_status": "declined",
            "declined_reason": "Indisponible"
        });

        let request = Request::builder()
            .uri("/api/blood-donation/matches/update-status")
            .method("POST")
            .header("Content-Type", "application/json")
            .header("Authorization", "Bearer test_token")
            .body(Body::from(serde_json::to_string(&request_data).unwrap()))
            .unwrap();

        let response = app.oneshot(request).await.unwrap();
        
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_list_active_requests() {
        let app = create_test_app().await;
        
        let request = Request::builder()
            .uri("/api/blood-donation/requests")
            .method("GET")
            .header("Authorization", "Bearer test_token")
            .body(Body::empty())
            .unwrap();

        let response = app.oneshot(request).await.unwrap();
        
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_get_user_blood_groups() {
        let app = create_test_app().await;
        
        let request = Request::builder()
            .uri("/api/blood-donation/donor/blood-groups")
            .method("GET")
            .header("Authorization", "Bearer test_token")
            .body(Body::empty())
            .unwrap();

        let response = app.oneshot(request).await.unwrap();
        
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_create_or_update_blood_group() {
        let app = create_test_app().await;
        
        let request_data = json!({
            "groupe_sanguin": "O+",
            "is_available_for_donation": true
        });

        let request = Request::builder()
            .uri("/api/blood-donation/donor/blood-group")
            .method("POST")
            .header("Content-Type", "application/json")
            .header("Authorization", "Bearer test_token")
            .body(Body::from(serde_json::to_string(&request_data).unwrap()))
            .unwrap();

        let response = app.oneshot(request).await.unwrap();
        
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_update_last_donation() {
        let app = create_test_app().await;
        
        let request_data = json!({
            "groupe_sanguin": "O+",
            "donation_date": "2025-01-15"
        });

        let request = Request::builder()
            .uri("/api/blood-donation/donor/update-last-donation")
            .method("POST")
            .header("Content-Type", "application/json")
            .header("Authorization", "Bearer test_token")
            .body(Body::from(serde_json::to_string(&request_data).unwrap()))
            .unwrap();

        let response = app.oneshot(request).await.unwrap();
        
        assert_eq!(response.status(), StatusCode::OK);
        
        // TODO: Vérifier que next_donation_available_date est calculé correctement (8 semaines après)
    }

    #[tokio::test]
    async fn test_notify_donors_for_request() {
        let app = create_test_app().await;
        
        let request_data = json!({
            "request_id": "test_request_id",
            "max_donors_to_notify": 10
        });

        let request = Request::builder()
            .uri("/api/blood-donation/requests/notify")
            .method("POST")
            .header("Content-Type", "application/json")
            .header("Authorization", "Bearer test_token")
            .body(Body::from(serde_json::to_string(&request_data).unwrap()))
            .unwrap();

        let response = app.oneshot(request).await.unwrap();
        
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_donor_availability_after_donation() {
        // Test que le donneur devient non disponible après acceptation
        // et que next_donation_available_date est calculé correctement
        
        // TODO: Implémenter test complet du flux :
        // 1. Créer demande
        // 2. Accepter match
        // 3. Vérifier que is_available_for_donation = false
        // 4. Vérifier que next_donation_available_date = last_donation_date + 56 jours
    }

    #[tokio::test]
    async fn test_gps_distance_calculation() {
        // Test que la distance GPS est calculée correctement
        // entre la demande et les donneurs potentiels
        
        // TODO: Implémenter test de la fonction find_potential_blood_donors
        // avec différentes positions GPS
    }

    #[tokio::test]
    async fn test_urgency_notification_sound() {
        // Test que les notifications urgentes utilisent le bon son
        // - critique -> "alert_urgent"
        // - urgent -> "default"
        // - normal -> "default"
        
        // TODO: Implémenter test du service push_notification_service
        // pour vérifier le paramètre sound
    }
}

