#[cfg(test)]
mod delivery_api_tests {
    use axum::{
        body::Body,
        http::{Request, StatusCode},
        Router,
    };
    use serde_json::json;
    use tower::ServiceExt;
    use yukpomnang_backend::{
        routes::{
            delivery_metrics_routes::delivery_metrics_routes, delivery_routes::delivery_routes,
        },
        services::delivery_service::{
            get_delivery_metrics_snapshot, CreateDeliveryParams, DeliveryRecipientInput,
            LocationInput, NewDeliveryParcelInput,
        },
        test_utils::{backend_test_db_lock, gen_jwt, setup_backend_test_context},
    };

    fn test_router(state: std::sync::Arc<yukpomnang_backend::state::AppState>) -> Router {
        Router::new()
            .merge(delivery_routes(state.clone()))
            .merge(delivery_metrics_routes(state))
    }

    #[tokio::test]
    async fn recipient_and_wallet_endpoints_update_metrics() {
        let _lock = backend_test_db_lock().await;
        let Some(context) = setup_backend_test_context().await else {
            eprintln!("[delivery_api_tests] contexte de test indisponible, test ignoré");
            return;
        };

        let state = context.state.clone();
        let mut router = test_router(state.clone());
        let token = gen_jwt("user", context.user_id);

        let service = state.delivery_service.clone();
        let baseline_metrics = get_delivery_metrics_snapshot();

        let delivery = service
            .create_delivery_request(CreateDeliveryParams {
                creator_id: context.user_id,
                parcel: NewDeliveryParcelInput {
                    type_id: None,
                    weight_kg: None,
                    volume_cm3: None,
                    declared_value: None,
                    notes: Some("Test parcel".to_string()),
                    photos: json!([]),
                    constraints: json!({}),
                },
                pickup: LocationInput {
                    latitude: 3.848,
                    longitude: 11.502,
                    address: Some("Pickup".to_string()),
                },
                dropoff: LocationInput {
                    latitude: 3.851,
                    longitude: 11.505,
                    address: Some("Dropoff".to_string()),
                },
                recipient: None,
                distance_meters: Some(1200),
                estimated_duration_seconds: Some(900),
                metadata: json!({}),
                initial_event_payload: json!({
                    "source": "integration_test"
                }),
            })
            .await
            .expect("create_delivery_request devrait réussir");

        // Assigner un destinataire avec un override de dropoff (met à jour les métriques)
        let recipient_payload = json!({
            "contact_name": "Destinataire Test",
            "contact_phone": "+237650000000",
            "country_code": "CM",
            "allow_contact": true,
            "allow_tracking": true,
            "consent_granted": true,
            "dropoff_override": {
                "latitude": 3.852,
                "longitude": 11.506,
                "address": "Override Adresse"
            }
        });

        let assign_request = Request::builder()
            .uri(format!("/delivery/{}/recipient", delivery.id))
            .method("POST")
            .header("content-type", "application/json")
            .header("authorization", format!("Bearer {}", token))
            .body(Body::from(recipient_payload.to_string()))
            .unwrap();

        let response = router
            .clone()
            .oneshot(assign_request)
            .await
            .expect("La requête assign recipient doit répondre");
        assert_eq!(response.status(), StatusCode::OK);
        let body_bytes = hyper::body::to_bytes(response.into_body())
            .await
            .expect("Lecture du corps réponse assign");
        let body_json: serde_json::Value =
            serde_json::from_slice(&body_bytes).expect("JSON assign valide");
        assert_eq!(
            body_json["recipient"]["contact_name"],
            serde_json::Value::String("Destinataire Test".to_string())
        );

        // Mettre à jour la localisation du destinataire
        let update_payload = json!({
            "latitude": 3.853,
            "longitude": 11.507,
            "address": "Nouvelle adresse"
        });

        let update_request = Request::builder()
            .uri(format!("/delivery/{}/recipient/location", delivery.id))
            .method("POST")
            .header("content-type", "application/json")
            .header("authorization", format!("Bearer {}", token))
            .body(Body::from(update_payload.to_string()))
            .unwrap();

        let update_response = router
            .clone()
            .oneshot(update_request)
            .await
            .expect("La requête update recipient location doit répondre");
        assert_eq!(update_response.status(), StatusCode::OK);

        let updated_body = hyper::body::to_bytes(update_response.into_body())
            .await
            .expect("Lecture du corps réponse update");
        let updated_json: serde_json::Value =
            serde_json::from_slice(&updated_body).expect("JSON update valide");
        assert_eq!(
            updated_json["recipient"]["dropoff_override"]["latitude"],
            serde_json::Value::from(3.853)
        );

        // Débiter le wallet via l'endpoint API
        let debit_payload = json!({
            "delivery_id": delivery.id,
            "amount_cents": 5_000,
            "currency": "XAF",
            "reason": "integration_test_debit"
        });

        let debit_request = Request::builder()
            .uri("/wallet/debit")
            .method("POST")
            .header("content-type", "application/json")
            .header("authorization", format!("Bearer {}", token))
            .body(Body::from(debit_payload.to_string()))
            .unwrap();

        let debit_response = router
            .clone()
            .oneshot(debit_request)
            .await
            .expect("La requête wallet debit doit répondre");
        assert_eq!(debit_response.status(), StatusCode::OK);

        // Vérifier le solde après débit
        let balance_after_debit = service
            .get_wallet_balance(context.user_id)
            .await
            .expect("lecture balance après débit");
        assert_eq!(balance_after_debit, 1_000_000 - 5_000);

        // Rembourser le wallet via l'endpoint API
        let refund_payload = json!({
            "delivery_id": delivery.id,
            "amount_cents": 5_000,
            "currency": "XAF",
            "reason": "integration_test_refund"
        });

        let refund_request = Request::builder()
            .uri("/wallet/refund")
            .method("POST")
            .header("content-type", "application/json")
            .header("authorization", format!("Bearer {}", token))
            .body(Body::from(refund_payload.to_string()))
            .unwrap();

        let refund_response = router
            .clone()
            .oneshot(refund_request)
            .await
            .expect("La requête wallet refund doit répondre");
        assert_eq!(refund_response.status(), StatusCode::OK);

        // Vérifier le solde revenu à la normale
        let balance_after_refund = service
            .get_wallet_balance(context.user_id)
            .await
            .expect("lecture balance après remboursement");
        assert_eq!(balance_after_refund, 1_000_000);

        // Vérifier que l'endpoint Prometheus reflète les métriques mises à jour
        let metrics_request = Request::builder()
            .uri("/metrics/delivery")
            .method("GET")
            .body(Body::empty())
            .unwrap();

        let metrics_response = router
            .oneshot(metrics_request)
            .await
            .expect("La requête metrics doit répondre");
        assert_eq!(metrics_response.status(), StatusCode::OK);
        let metrics_body = hyper::body::to_bytes(metrics_response.into_body())
            .await
            .expect("Lecture du corps des métriques");
        let metrics_text = String::from_utf8(metrics_body.to_vec()).expect("Texte métriques UTF-8");

        let latest_metrics = get_delivery_metrics_snapshot();

        assert_eq!(
            latest_metrics.recipient_dropoff_events,
            baseline_metrics.recipient_dropoff_events + 2
        );
        assert_eq!(
            latest_metrics.wallet_debit_events,
            baseline_metrics.wallet_debit_events + 1
        );
        assert_eq!(
            latest_metrics.wallet_refund_events,
            baseline_metrics.wallet_refund_events + 1
        );
        assert_eq!(
            latest_metrics.total_wallet_debit_cents,
            baseline_metrics.total_wallet_debit_cents + 5_000
        );
        assert_eq!(
            latest_metrics.total_wallet_refund_cents,
            baseline_metrics.total_wallet_refund_cents + 5_000
        );

        assert!(
            metrics_text.contains(&format!(
                "delivery_recipient_dropoff_events_total {}",
                latest_metrics.recipient_dropoff_events
            )),
            "Le total des dropoff destinataire doit apparaître dans l'endpoint Prometheus"
        );
        assert!(
            metrics_text.contains(&format!(
                "delivery_wallet_debit_events_total {}",
                latest_metrics.wallet_debit_events
            )),
            "Le total des débits wallet doit apparaître"
        );
        assert!(
            metrics_text.contains(&format!(
                "delivery_wallet_refund_events_total {}",
                latest_metrics.wallet_refund_events
            )),
            "Le total des remboursements wallet doit apparaître"
        );
        assert!(
            metrics_text.contains(&format!(
                "delivery_wallet_debit_amount_cents_total {}",
                latest_metrics.total_wallet_debit_cents
            )),
            "Le montant cumulé des débits doit apparaître"
        );
        assert!(
            metrics_text.contains(&format!(
                "delivery_wallet_refund_amount_cents_total {}",
                latest_metrics.total_wallet_refund_cents
            )),
            "Le montant cumulé des remboursements doit apparaître"
        );

        // Vérifier qu'au moins un update destinataire est visible côté service
        let updates = service
            .list_frontend_recipient_updates(delivery.id, context.user_id, 10)
            .await
            .expect("Lecture des updates destinataire");
        assert!(
            !updates.is_empty(),
            "Des mises à jour destinataire devraient exister"
        );

        // Vérifier l'endpoint GET destinataire
        let get_request = Request::builder()
            .uri(format!("/delivery/{}/recipient", delivery.id))
            .method("GET")
            .header("authorization", format!("Bearer {}", token))
            .body(Body::empty())
            .unwrap();

        let get_response = router
            .oneshot(get_request)
            .await
            .expect("La requête get recipient doit répondre");
        assert_eq!(get_response.status(), StatusCode::OK);
        let get_body = hyper::body::to_bytes(get_response.into_body())
            .await
            .expect("lecture corps get recipient");
        let get_json: serde_json::Value =
            serde_json::from_slice(&get_body).expect("JSON get recipient valide");
        assert_eq!(
            get_json["recipient"]["contact_name"],
            serde_json::Value::String("Destinataire Test".to_string())
        );
    }
}
