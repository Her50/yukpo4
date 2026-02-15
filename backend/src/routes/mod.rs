pub mod admin_user_routes;
pub mod advanced_analytics_routes;
pub mod advanced_timeline_routes;
pub mod ai_chat_routes;
pub mod analytics_routes;
pub mod appliance_model_routes; // ✅ Routes pour modèles d'appareils électroménagers
pub mod ar_routes;
pub mod auth_routes;
pub mod autocomplete_routes; // ✅ NOUVEAU: Routes pour autocomplete characteristics
pub mod bourse_livre_routes;
pub mod chat_media_routes;
pub mod chat_reactions_routes;
pub mod chat_routes; // ✅ NOUVEAU: Routes de chat avec push notifications
pub mod combination_routes;
pub mod content_routes;
pub mod conversation_routes; // ✅ NOUVEAU: Routes pour @mentions et multi-participants
pub mod creator_analytics_routes;
pub mod debug_routes;
pub mod delivery_external_routes;
pub mod delivery_metrics_routes;
pub mod delivery_optimization_routes;
pub mod delivery_routes;
pub mod diagnostic_routes;
pub mod echange_routes;
pub mod embedding_routes; // ✅ Routes pour embeddings
pub mod export_routes;
pub mod extended_audio_routes;
pub mod feature_flags_routes;
pub mod flash_promo_routes;
pub mod fournitures_routes;
pub mod generative_routes;
pub mod global_promo_routes;
pub mod gpu_routes; // ✅ NOUVEAU 2026-02-14: Routes pour gestion GPU GCP
pub mod health_routes;
pub mod health_structure_routes;
pub mod history_routes;
pub mod ia_routes;
pub mod image_search_routes;
pub mod kyc_admin_routes;
pub mod kyc_webhook_routes;
pub mod live_ai_routes;
pub mod live_routes;
pub mod media_routes;
pub mod metrics_routes;
pub mod metrics_tracking_routes;
pub mod mobile_logs_routes;
pub mod navigation_routes; // ✅ NOUVEAU: Routes pour navigation intelligente
pub mod nearby_services_routes;
pub mod negotiated_price_routes;
pub mod notification_routes; // ✅ Routes de notifications
pub mod offres_emploi_routes;
pub mod order_routes;
pub mod orientation_scolaire_routes;
pub mod partner_validation_routes; // ✅ NOUVEAU: Routes pour validation des partenaires
pub mod payment_routes;
pub mod phone_model_routes; // ✅ Routes pour modèles de smartphones
pub mod places_routes; // ✅ NOUVEAU: Routes pour autocomplete de lieux (Google Maps API)
pub mod plugin_routes;
pub mod popular_products_routes;
pub mod prestataire_routes;
pub mod product_comments_routes; // ✅ NOUVEAU: Routes pour commentaires de produits
pub mod product_lifecycle_routes; // ✅ Routes de gestion du cycle de vie des produits
pub mod product_reactions_routes;
pub mod products_management; // ✅ Routes pour gestion des produits
pub mod products_routes; // ✅ PHASE 3: Routes pour gestion produits via table service_products
pub mod provider_analytics_routes;
pub mod publicite_ab_testing_routes;
pub mod publicite_ai_routes;
pub mod publicite_assets_routes;
pub mod publicite_audiences_routes;
pub mod publicite_auto_optimization_routes;
pub mod publicite_pixel_routes;
pub mod publicite_routes; // ✅ NOUVEAU: Routes pour système de publicité payante
pub mod push_routes; // ✅ Routes de push notifications
pub mod recommendation_routes; // ✅ NOUVEAU: Routes pour recommandations et tracking visibilité
pub mod scheduling_search_routes; // ✅ NOUVEAU: Routes pour recherche avec planifications
pub mod search_history_routes; // ✅ NOUVEAU: Routes pour historique de recherche
pub mod service_routes;
pub mod service_team_routes; // ✅ NOUVEAU: Routes pour gestion d'équipe des services
pub mod shopping_routes;
pub mod signalement_routes; // ✅ NOUVEAU: Routes pour signalements
pub mod social_features_routes;
pub mod specialized_services_routes;
pub mod stock_media_routes;
pub mod studio_routes; // ✅ NOUVEAU: Routes Studio pour création vidéo immersive
pub mod system_health_routes;
pub mod token_pack_routes;
pub mod token_stats_routes; // ✅ NOUVEAU: Routes pour statistiques de consommation de tokens
pub mod upload_routes;
pub mod user_routes;
pub mod vehicle_model_routes;
pub mod video_hls_routes;
pub mod video_metrics_routes;
pub mod video_ml_routes;
pub mod video_routes;
pub mod weather_routes;
pub mod webhook_routes;
pub mod webrtc_routes; // ✅ Routes WebRTC pour appels // ✅ NOUVEAU: Routes pour feature flags

// === Routes d'Optimisation IA ===
// pub mod ia_routes_optimized; // Temporairement d?sactiv?
