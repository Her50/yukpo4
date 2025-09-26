#[cfg(test)]
mod webhook_integration_tests {
    use axum::{
        body::Body,
        http::{Request, StatusCode},
        Router,
    };
    use serde_json::json;
    use tower::ServiceExt;
    use yukpomnang_backend::{
        build_app,
        state::AppState,
        services::phone_validation_service::{PhoneValidationService, PhoneValidationRequest},
    };
    use std::sync::Arc;

    // Helper function to create test app
    async fn create_test_app() -> Router {
        // Créer un état de test minimal
        let app_state = Arc::new(AppState {
            pg: sqlx::PgPool::connect("postgresql://test:test@localhost:5432/test")
                .await
                .expect("Failed to connect to test database"),
            mongo: mongodb::Client::with_uri_str("mongodb://localhost:27017")
                .await
                .expect("Failed to connect to test MongoDB"),
            redis: redis::Client::open("redis://localhost:6379")
                .expect("Failed to connect to test Redis"),
            app_ia: Arc::new(yukpomnang_backend::services::app_ia::AppIA::new()),
            massive_load_handler: Arc::new(yukpomnang_backend::services::massive_load_handler::MassiveLoadHandler::new()),
            gpu_optimizer: Arc::new(yukpomnang_backend::services::gpu_optimizer::GPUOptimizer::new()),
        });
        
        build_app(app_state)
    }

    #[tokio::test]
    async fn test_webhook_health() {
        let app = create_test_app().await;
        
        let request = Request::builder()
            .uri("/webhooks/health")
            .method("GET")
            .body(Body::empty())
            .unwrap();
            
        let response = app.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_webhook_test_endpoint() {
        let app = create_test_app().await;
        
        let test_data = json!({
            "transaction_id": "test_txn_123",
            "status": "SUCCESS",
            "amount": 1000,
            "currency": "XAF",
            "phone_number": "675123456",
            "payment_method": "orange_money"
        });
        
        let request = Request::builder()
            .uri("/webhooks/test")
            .method("POST")
            .header("content-type", "application/json")
            .body(Body::from(test_data.to_string()))
            .unwrap();
            
        let response = app.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_phone_validation_service() {
        let phone_service = PhoneValidationService::new();
        
        // Test numéro Cameroun valide
        let request = PhoneValidationRequest {
            phone_number: "675123456".to_string(),
            country: Some("CM".to_string()),
        };
        
        let result = phone_service.validate_phone_number(request);
        assert!(result.is_valid);
        assert_eq!(result.country_code, Some("CM".to_string()));
        assert!(result.carrier.is_some());
    }

    #[tokio::test]
    async fn test_phone_validation_invalid() {
        let phone_service = PhoneValidationService::new();
        
        // Test numéro invalide
        let request = PhoneValidationRequest {
            phone_number: "123".to_string(),
            country: Some("CM".to_string()),
        };
        
        let result = phone_service.validate_phone_number(request);
        assert!(!result.is_valid);
        assert!(result.error_message.is_some());
    }

    #[tokio::test]
    async fn test_phone_validation_auto_detection() {
        let phone_service = PhoneValidationService::new();
        
        // Test détection automatique
        let request = PhoneValidationRequest {
            phone_number: "+237675123456".to_string(),
            country: None,
        };
        
        let result = phone_service.validate_phone_number(request);
        assert!(result.is_valid);
        assert_eq!(result.country_code, Some("CM".to_string()));
    }

    #[tokio::test]
    async fn test_supported_countries() {
        let phone_service = PhoneValidationService::new();
        let countries = phone_service.get_supported_countries();
        
        assert!(countries.contains(&"CM".to_string()));
        assert!(countries.contains(&"CI".to_string()));
        assert!(countries.contains(&"BF".to_string()));
        assert!(countries.contains(&"ML".to_string()));
        assert!(countries.contains(&"NE".to_string()));
        assert!(countries.contains(&"SN".to_string()));
        assert!(countries.contains(&"TG".to_string()));
        assert!(countries.contains(&"MG".to_string()));
    }

    #[tokio::test]
    async fn test_carriers_for_country() {
        let phone_service = PhoneValidationService::new();
        let carriers = phone_service.get_carriers_for_country("CM");
        
        assert!(carriers.contains(&"Orange".to_string()));
        assert!(carriers.contains(&"MTN".to_string()));
    }

    #[tokio::test]
    async fn test_phone_formatting() {
        let phone_service = PhoneValidationService::new();
        
        let request = PhoneValidationRequest {
            phone_number: "675123456".to_string(),
            country: Some("CM".to_string()),
        };
        
        let result = phone_service.validate_phone_number(request);
        assert!(result.is_valid);
        assert!(result.formatted_number.is_some());
        assert!(result.formatted_number.unwrap().starts_with("+237"));
    }

    #[tokio::test]
    async fn test_multiple_countries() {
        let phone_service = PhoneValidationService::new();
        
        // Test Côte d'Ivoire
        let request_ci = PhoneValidationRequest {
            phone_number: "0712345678".to_string(),
            country: Some("CI".to_string()),
        };
        
        let result_ci = phone_service.validate_phone_number(request_ci);
        assert!(result_ci.is_valid);
        assert_eq!(result_ci.country_code, Some("CI".to_string()));
        
        // Test Burkina Faso
        let request_bf = PhoneValidationRequest {
            phone_number: "70123456".to_string(),
            country: Some("BF".to_string()),
        };
        
        let result_bf = phone_service.validate_phone_number(request_bf);
        assert!(result_bf.is_valid);
        assert_eq!(result_bf.country_code, Some("BF".to_string()));
    }
}
