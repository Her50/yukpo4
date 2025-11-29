pub mod african_locations_service; // ✅ NOUVEAU 2025-11-06: Base locale africaine pour enfants géographiques
pub mod ai_image_generation_service; // ✅ NOUVEAU 2025-11-25: Génération d'images par IA (DALL-E)
pub mod alert_service;
pub mod analytics_service; // ✅ Phase 10 - Service d'analytics pour prestataires
pub mod app_ia;
pub mod email_service; // ✅ Phase 10 - Service Email avec SendGrid
pub mod assistance;
pub mod audio_library_service;
pub mod audio_mastering_service;
pub mod audio_pipeline;
pub mod audio_analysis_service;
pub mod audio_transcription_service;
pub mod autocomplete_client_service; // ✅ NOUVEAU 2025-11-04: Suggestions CLIENT (autocomplete_characteristics)
pub mod autocomplete_combinations_service;
pub mod autocomplete_history_service;
pub mod autocomplete_search_service; // ✅ NOUVEAU 2025-11-04: Recherche par vecteur autocomplete
pub mod background_combination_generator;
pub mod besoin_service;
pub mod broll_service;
pub mod cache_service; // ✅ Phase 10 - Service de cache générique centralisé
pub mod commerce_connector_service;
pub mod content_engagement_service;
pub mod context_enricher;
pub mod cost_service;
pub mod creer_service;
pub mod upload_service; // ✅ NOUVEAU: Service pour upload préalable de fichiers
pub mod db_optimizer;
pub mod delivery_notification_service; // ✅ RECOMMANDATION 3: Notifications SMS/Email pour clients sans app
pub mod delivery_payment_service; // ✅ Phase 5 - Améliorations 10-15: Gestion financière avancée
pub mod delivery_repository;
pub mod payment_matching_service; // ✅ Phase 5 - Matching intelligent modes de paiement (MTN/Orange Money)
pub mod negotiated_price_service; // ✅ NOUVEAU : Service pour gérer les prix négociés entre prestataire et client
pub mod delivery_schedule_service; // ✅ Phase 3 - Amélioration 7: Gestion contraintes horaires
pub mod delivery_service;
pub mod distribution_automation_service;
pub mod order_preparation_service; // ✅ NOUVEAU : Workflow de préparation des commandes
pub mod product_availability_service; // ✅ NOUVEAU : Vérification disponibilité produits
pub mod product_stock_service; // ✅ NOUVEAU : Gestion stock en temps réel
pub mod similar_products_service; // ✅ NOUVEAU : Recherche produits similaires
pub mod smart_notification_service; // ✅ NOUVEAU : Notifications intelligentes avec redirection
pub mod courier_verification_service; // ✅ NOUVEAU : Vérification identité coursier
pub mod dynamic_preparation_time_service; // ✅ NOUVEAU : Calcul dynamique durée préparation par catégorie
pub mod provider_analytics_service; // ✅ NOUVEAU : Analytics prestataire
pub mod product_enrichment_service; // ✅ NOUVEAU : Enrichissement produits avec disponibilité
pub mod embedding_client;
pub mod embedding_service;
pub mod embedding_tracker;
pub mod enrich_google_places; // ✅ NOUVEAU: Enrichissement services avec données Google Places complètes
pub mod exhaustive_combination_generator;
pub mod file_extractor;
pub mod fournitures_service;
pub mod geocoding_service;
pub mod geonames_service; // ✅ NOUVEAU: Service GeoNames pour hiérarchie géographique
pub mod geographic_matching_service; // ✅ Phase 10 - Service de matching géographique optimisé
pub mod global_promo_service;
pub mod google_places_service; // ✅ NOUVEAU 2025-11-06: Service Google Places pour hiérarchie bidirectionnelle
pub mod gpu_detector;
pub mod gpu_optimizer;
pub mod hybrid_image_search_service; // ✅ NOUVEAU: Recherche hybride intelligente
pub mod ia;
pub mod ia_feedback_service;
pub mod ia_history_service;
pub mod image_search_service;
pub mod immersive_orchestrator;
pub mod immersive_timeline;
pub mod instructions;
pub mod intelligent_image_analysis_service;
pub mod intelligent_service_manager;
pub mod intelligent_translation_service;
pub mod interaction_service;
pub mod inventory_service;
pub mod live_ai_service;
pub mod live_audience_service;
pub mod live_flash_sale_service;
pub mod live_stream_service;
pub mod llm_service;
pub mod local_ai_ultra_fast;
pub mod massive_load_handler;
pub mod matching_pipeline;
pub mod media_storage_service;
pub mod mobile_money_service; // ✅ Phase 10 - Service Mobile Money (MTN/Orange Money)
pub mod mongo_history_service;
pub mod multimodal_enricher;
pub mod multimodal_optimizer;
pub mod multimodal_processor;
pub mod native_search_service;
pub mod notification_service; // ✅ Service de notifications en base de données
pub mod ocr_engine;
pub mod orchestration_ia;
pub mod orchestration_ia_optimized;
pub mod payment_service;
pub mod phone_validation_service;
pub mod product_validation_service;
pub mod product_price_service; // ✅ NOUVEAU : Service pour calculer les prix réels avec promotions
pub mod pipeline_health_service;
pub mod popular_products_service;
pub mod prestataire_service;
pub mod preview_monitoring;
pub mod programme_service;
pub mod prompt_optimizer_pro;
pub mod publicite_search_service;
pub mod push_notification_service; // ✅ Service de push notifications Expo
pub mod query_monitor; // ✅ NOUVEAU 2025-11-28: Monitoring avancé des requêtes SQL
pub mod rechercher_besoin;
pub mod remotion_renderer_service;
pub mod scheduling_search_service;
pub mod scoring_service;
pub mod search_history_service;
pub mod sms_service; // ✅ Phase 10 - Service SMS avec Twilio
pub mod security_service;
pub mod semantic_cache;
pub mod semantic_cache_pro;
pub mod semantic_exclusion;
pub mod service_history_service;
pub mod service_lifecycle_manager;
pub mod sharing_service;
pub mod social_connector_service;
pub mod social_distribution_service;
pub mod story_template_service;
pub mod studio_service;
pub mod timeline_converter; // ✅ NOUVEAU: Conversion timeline JSON -> ImmersiveTimeline
pub mod traiter_echange;
pub mod translation_optimizer;
pub mod valider_echange;
pub mod valider_programme_scolaire;
pub mod video_analytics_service;
pub mod video_generation_service;
pub mod video_job_service;
pub mod video_renderer;
pub mod voice_profile_service;
// pub mod payment_service_temporary;
// pub mod push_notifications;
// pub mod typing_status;
// pub mod voice_messages;
// pub mod file_sharing;
