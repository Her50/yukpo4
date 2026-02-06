mod end_to_end_workflow {
    use chrono::{Duration, Utc};
    use mongodb::Client as MongoClient;
    use redis::Client as RedisClient;
    use rust_decimal::prelude::FromPrimitive;
    use serde_json::json;
    use sqlx::{postgres::PgPoolOptions, PgPool, Row};
    use std::sync::{Arc, OnceLock};
    use tokio::sync::Mutex;
    use yukpomnang_backend::{
        middlewares::jwt::AuthenticatedUser,
        migrations::auto_migrate::run_auto_migrations,
        models::global_promo_model::{
            CreateGlobalPromoEventRequest, GlobalPromoCatalogQuery, ReviewGlobalPromoEntryRequest,
            UpsertGlobalPromoEntryRequest,
        },
        services::{
            creer_service,
            delivery_service::{CreateDeliveryParams, LocationInput, NewDeliveryParcelInput},
            global_promo_service::GlobalPromoService,
            video_generation_service::{generate_product_video, VideoGenerationPayload},
        },
        state::AppState,
    };

    struct E2EContext {
        state: Arc<AppState>,
        pool: PgPool,
        user_id: i32,
    }

    async fn backend_test_db_lock() -> tokio::sync::MutexGuard<'static, ()> {
        static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
        LOCK.get_or_init(|| Mutex::new(())).lock().await
    }

    async fn setup_e2e_context() -> Option<E2EContext> {
        let database_url = std::env::var("TEST_DATABASE_URL").unwrap_or_else(|_| {
            "postgres://postgres:Hernandez87@localhost/yukpomnang_test".to_string()
        });

        let pool = match PgPoolOptions::new().max_connections(5).connect(&database_url).await {
            Ok(pool) => pool,
            Err(err) => {
                eprintln!(
                    "[e2e] ❌ Impossible de se connecter à PostgreSQL ({database_url}): {err:?}"
                );
                return None;
            }
        };

        run_auto_migrations(&pool).await;

        if let Err(err) = sqlx::query(
            "TRUNCATE TABLE media_distribution, media_engagement, media, services, token_usage_logs, users RESTART IDENTITY CASCADE",
        )
        .execute(&pool)
        .await
        {
            eprintln!("[e2e] ❌ Impossible de nettoyer la base de tests: {:?}", err);
            return None;
        }

        let user_row = match sqlx::query(
            r#"
            INSERT INTO users (
                email,
                password_hash,
                role,
                is_provider,
                tokens_balance,
                preferred_lang,
                token_price_user,
                token_price_provider,
                commission_pct,
                created_at,
                updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
            RETURNING id
            "#,
        )
        .bind("test-user@example.com")
        .bind("test-hash")
        .bind("user")
        .bind(false)
        .bind(1_000_000_i64)
        .bind("fr")
        .bind(1.0_f64)
        .bind(1.0_f64)
        .bind(0.0_f32)
        .fetch_one(&pool)
        .await
        {
            Ok(row) => row,
            Err(err) => {
                eprintln!(
                    "[e2e] ❌ Impossible d'insérer l'utilisateur de test: {:?}",
                    err
                );
                return None;
            }
        };

        let user_id: i32 = user_row.get("id");

        let mongo_uri = std::env::var("TEST_MONGODB_URL")
            .unwrap_or_else(|_| "mongodb://localhost:27017".to_string());
        let mongo_client = match MongoClient::with_uri_str(&mongo_uri).await {
            Ok(client) => client,
            Err(err) => {
                eprintln!("[e2e] ❌ Impossible de créer le client MongoDB ({mongo_uri}): {err:?}");
                return None;
            }
        };

        let redis_uri =
            std::env::var("TEST_REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1/".to_string());
        let redis_client = match RedisClient::open(redis_uri.clone()) {
            Ok(client) => client,
            Err(err) => {
                eprintln!("[e2e] ❌ Impossible de créer le client Redis ({redis_uri}): {err:?}");
                return None;
            }
        };

        let ia_stats = Arc::new(Mutex::new(
            yukpomnang_backend::controllers::ia_status_controller::IAStats::default(),
        ));
        let app_ia = Arc::new(yukpomnang_backend::services::app_ia::AppIA::new(
            redis_client.clone(),
            ia_stats.clone(),
            pool.clone(),
        ));

        let mongo_history = Arc::new(
            yukpomnang_backend::services::mongo_history_service::MongoHistoryService::new(
                Arc::new(mongo_client.clone()),
                "yukpo_history_test".to_string(),
            ),
        );

        let delivery_repo = Arc::new(
            yukpomnang_backend::services::delivery_repository::DeliveryRepository::new(
                pool.clone(),
            ),
        );
        let delivery_ws_manager = Arc::new(
            yukpomnang_backend::websocket::delivery_tracking::DeliveryTrackingManager::new(
                16,
                Some(redis_client.clone()),
            ),
        );
        let delivery_service = Arc::new(
            yukpomnang_backend::services::delivery_service::DeliveryService::new(
                delivery_repo.clone(),
                delivery_ws_manager.clone(),
            ),
        );

        let cost_service =
            Arc::new(yukpomnang_backend::services::cost_service::CostEstimator::new(pool.clone()));

        let media_storage = Arc::new(
            yukpomnang_backend::services::media_storage_service::MediaStorageService::new(
                yukpomnang_backend::config::storage::MediaStorageConfig::from_env(),
            ),
        );
        let voice_profiles = Arc::new(
            yukpomnang_backend::services::voice_profile_service::VoiceProfileService::new(
                pool.clone(),
                media_storage.clone(),
            ),
        );
        let commerce_connector = Arc::new(
            yukpomnang_backend::services::commerce_connector_service::CommerceConnectorService::new(
                pool.clone(),
            ),
        );
        let story_templates = Arc::new(
            yukpomnang_backend::services::story_template_service::StoryTemplateService::new(),
        );
        let inventory = Arc::new(
            yukpomnang_backend::services::inventory_service::InventoryService::new(pool.clone()),
        );
        let studio_service = Arc::new(
            yukpomnang_backend::services::studio_service::StudioService::new(
                pool.clone(),
                media_storage.clone(),
                None,
            ),
        );

        let state = Arc::new(AppState {
            pg: pool.clone(),
            mongo: mongo_client,
            mongo_history,
            ia: app_ia,
            ia_stats,
            database_url,
            optimizations_enabled: false,
            redis_client,
            semantic_cache: None,
            prompt_optimizer: None,
            live_streaming: Arc::new(
                yukpomnang_backend::config::live_streaming::LiveStreamingConfig::from_env(),
            ),
            delivery_ws_manager,
            delivery_service,
            media_storage,
            remotion_renderer: None,
            video_renderer: None,
            audio_mastering: None,
            cost_service,
            broll_service: None,
            video_jobs: Arc::new(
                yukpomnang_backend::services::video_job_service::VideoGenerationJobService::new(
                    pool.clone(),
                ),
            ),
            voice_profiles,
            commerce_connector,
            story_templates,
            studio_service,
            inventory,
            feature_flags: Arc::new(
                yukpomnang_backend::config::feature_flags::FeatureFlagService::from_env(),
            ),
        });

        Some(E2EContext {
            state,
            pool,
            user_id,
        })
    }

    /// Test d'intégration end-to-end :
    /// - utilise un utilisateur de test (créé par `setup_e2e_context`)
    /// - crée un service (via le service métier)
    /// - lance une génération vidéo pour un produit
    /// - crée une demande de livraison liée
    /// - inscrit le service dans une campagne Global Promo et vérifie le catalogue
    #[tokio::test]
    async fn full_creator_video_delivery_global_promo_workflow() {
        let _lock = backend_test_db_lock().await;
        let Some(context) = setup_e2e_context().await else {
            eprintln!("[e2e] impossible d'initialiser le contexte de test, test ignoré");
            return;
        };

        let state = context.state.clone();
        let pool = &context.pool;
        let user_id = context.user_id;

        // 1) Création d'un service avec un produit simple
        let service_payload = json!({
            "user_id": user_id,
            "data": {
                "titre": { "type_donnee": "string", "valeur": "Service E2E", "origine_champs": "test" },
                "description": { "type_donnee": "string", "valeur": "Service complet E2E", "origine_champs": "test" },
                "category": { "type_donnee": "string", "valeur": "test_e2e", "origine_champs": "test" },
                "intention": "proposer",
                "is_tarissable": false,
                "gps": false,
                "produits": [
                    {
                        "id": "prod_0",
                        "nom": "Produit E2E",
                        "prix": 1000
                    }
                ]
            }
        });

        // Création du service via le service métier (même logique que l'API /services/create)
        creer_service::creer_service(
            &state.pg,
            user_id,
            &service_payload["data"],
            &state.redis_client,
        )
        .await
        .expect("[e2e] création de service via creer_service::creer_service");

        // Récupérer le service_id en base pour l'utilisateur
        let row = sqlx::query(
            r#"
            SELECT id
            FROM services
            WHERE user_id = $1
            ORDER BY id DESC
            LIMIT 1
            "#,
        )
        .bind(user_id)
        .fetch_one(pool)
        .await
        .expect("[e2e] service créé doit exister en base");
        let service_id: i32 = row.get("id");

        // 2) Lancer une génération vidéo pour le produit index 0 (via le service métier)
        let video_payload = VideoGenerationPayload {
            style: Some("tiktok".to_string()),
            duration_seconds: Some(15),
            headline: Some("Promo E2E".to_string()),
            call_to_action: Some("Commander maintenant".to_string()),
            story_template_id: None,
            include_price: Some(true),
            include_promotion: Some(true),
            include_contact: Some(true),
            selected_media_ids: None,
            related_product_indices: Some(vec![0]),
            use_product_gallery: Some(false),
            use_service_mediatech: Some(false),
            include_publicite_assets: Some(false),
            publish_to_chat: Some(false),
            publish_to_product_card: Some(true),
            storyboard: None,
            music_mode: Some("auto".to_string()),
            music_volume: None,
            voiceover_script: None,
            voiceover_lang: None,
            voiceover_voice: None,
            generate_square_variant: Some(false),
            generate_landscape_variant: Some(false),
            auto_storyboard: Some(true),
            subtitle_mode: Some("auto".to_string()),
            subtitle_lang: Some("fr".to_string()),
            music_track_id: None,
            voice_profile_id: None,
            distribute_channels: Some(vec!["tiktok".to_string()]),
            use_ai_templates: Some(true),
            generate_subtitles: Some(false),
            style_effects: None,
            style_transitions: None,
            style_color_palette: None,
            style_overlay_tips: None,
            style_music_hint: None,
            media_scene_overrides: None,
            media_descriptions: None,
        };

        let video_result = generate_product_video(
            state.clone(),
            &AuthenticatedUser {
                id: user_id,
                role: "user".to_string(),
            },
            service_id,
            0,
            video_payload,
            None,
        )
        .await
        .expect("[e2e] génération vidéo doit réussir");
        assert_eq!(video_result.service_id, service_id);
        assert_eq!(video_result.product_index, 0);

        // 3) Créer une demande de livraison simple pour ce service (mode standard)
        let _delivery = state
            .delivery_service
            .create_delivery_request(CreateDeliveryParams {
                creator_id: user_id,
                parcel: NewDeliveryParcelInput {
                    type_id: None,
                    weight_kg: Some(rust_decimal::Decimal::from_f64(1.0).unwrap()),
                    volume_cm3: None,
                    declared_value: Some(rust_decimal::Decimal::from_i64(1500).unwrap()),
                    notes: Some("Colis E2E".to_string()),
                    photos: json!([]),
                    constraints: json!({}),
                },
                pickup: LocationInput {
                    latitude: 3.848,
                    longitude: 11.502,
                    address: Some("E2E Pickup".to_string()),
                },
                dropoff: LocationInput {
                    latitude: 3.851,
                    longitude: 11.505,
                    address: Some("E2E Dropoff".to_string()),
                },
                recipient: None,
                distance_meters: Some(1200),
                estimated_duration_seconds: Some(900),
                metadata: json!({
                    "linked_service_id": service_id,
                    "source": "e2e_test"
                }),
                initial_event_payload: json!({
                    "source": "e2e_test"
                }),
            })
            .await
            .expect("[e2e] création de livraison doit réussir");

        // 4) Créer un évènement Global Promo et y inscrire le service,
        // puis approuver l'entrée et vérifier qu'elle apparaît dans le catalogue.
        let now = Utc::now();
        let event = GlobalPromoService::create_event(
            &pool,
            CreateGlobalPromoEventRequest {
                slug: format!("e2e-{}", now.timestamp()),
                theme: "E2E".to_string(),
                display_name: "Campagne E2E".to_string(),
                description: Some("Test global promo E2E".to_string()),
                starts_at: now - Duration::minutes(5),
                ends_at: now + Duration::hours(1),
                recurrence_rule: None,
                config: json!({}),
            },
            user_id,
        )
        .await
        .expect("[e2e] création évènement Global Promo");

        let entry = GlobalPromoService::upsert_entry_for_owner(
            &pool,
            event.id,
            user_id,
            UpsertGlobalPromoEntryRequest {
                service_id,
                live_session_id: None,
                discount_percentage: Some(10.0),
                promo_price_cfa: Some(900.0),
                stock_cap: Some(10),
                availability: "online".to_string(),
                status: None,
                metadata: json!({ "source": "e2e_test" }),
                highlighted: Some(true),
                priority_score: Some(100),
                snapshot: None,
            },
        )
        .await
        .expect("[e2e] upsert entrée Global Promo");

        // Reviewer (ici, on réutilise le même user_id pour simplifier le test)
        let _approved = GlobalPromoService::review_entry(
            &pool,
            entry.id,
            user_id,
            ReviewGlobalPromoEntryRequest {
                status: "approved".to_string(),
                message: Some("E2E OK".to_string()),
                highlighted: Some(true),
                priority_score: Some(100),
                metadata_patch: None,
            },
        )
        .await
        .expect("[e2e] review entrée Global Promo");

        let catalog = GlobalPromoService::list_active_catalog(
            &pool,
            GlobalPromoCatalogQuery {
                page: Some(1),
                page_size: Some(10),
                highlighted_only: Some(false),
                event_slug: Some(event.slug.clone()),
                availability: None,
                status: None,
                search: None,
                sort: None,
                starts_within_minutes: Some(240),
            },
        )
        .await
        .expect("[e2e] récupération catalogue Global Promo");

        assert!(
            catalog.items.iter().any(|item| item.entry.service_id == service_id),
            "[e2e] le service doit apparaître dans le catalogue Global Promo"
        );
    }
}
