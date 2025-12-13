pub mod advanced_analytics_routes; // ✅ NOUVEAU: Routes analytics avancés (heatmaps, A/B testing, cohort)
pub mod advanced_timeline_routes; // ✅ NOUVEAU Phase 2: Routes pour timelines multi-pistes avancées
pub mod ai_chat_routes;
pub mod analytics_routes; // ✅ Phase 10 - Routes d'analytics pour prestataires
pub mod appliance_model_routes; // ✅ Routes pour modèles d'appareils électroménagers
pub mod ar_routes; // ✅ NOUVEAU Phase 3.2: Routes pour preview AR/VR
pub mod auth_routes;
pub mod autocomplete_routes; // ✅ NOUVEAU: Routes pour autocomplete characteristics
pub mod bourse_livre_routes; // ✅ NOUVEAU 2025-01-27: Routes pour bourse du livre avec IA
pub mod chat_media_routes; // ✅ NOUVEAU 2025-01-27: Routes pour upload médias chat vers S3/Wasabi
pub mod chat_reactions_routes; // ✅ NOUVEAU: Routes pour réactions de chat
pub mod chat_routes; // ✅ NOUVEAU: Routes de chat avec push notifications
pub mod combination_routes; // ✅ NOUVEAU 2025-11-03: Routes pour progression génération combinaisons
pub mod comment_media_routes; // ✅ NOUVEAU: Routes pour médias de commentaires
pub mod content_routes; // ✅ NOUVEAU: Routes pour engagement contenu mixte
pub mod conversation_routes; // ✅ NOUVEAU: Routes pour @mentions et multi-participants
pub mod creator_analytics_routes; // ✅ NOUVEAU: Routes analytics créateurs
pub mod debug_routes;
pub mod delivery_external_routes; // ✅ Phase 4 - Amélioration 8: Routes API publiques pour prestataires externes
pub mod delivery_metrics_routes;
pub mod delivery_optimization_routes; // ✅ NOUVEAU: Routes optimisation (VRP, ML ETA, AI, Forecasting, Fraud)
pub mod delivery_public_routes;
pub mod delivery_routes;
pub mod diagnostic_routes; // ✅ NOUVEAU 2025-11-04: Routes de diagnostic de la base de données
pub mod echange_routes;
pub mod embedding_routes; // ✅ Routes pour embeddings
pub mod export_routes; // ✅ NOUVEAU Phase 2.3: Routes pour jobs d'export vidéo
pub mod extended_audio_routes; // ✅ NOUVEAU Phase 2.2: Routes pour bibliothèque audio étendue
pub mod flash_promo_routes; // ✅ NOUVEAU: Routes pour flash promotionnels de produits (gratuit)
pub mod fournitures_routes;
pub mod generative_routes; // ✅ NOUVEAU Phase 3.1: Routes pour génération vidéo IA complète
pub mod global_promo_routes;
pub mod health_routes; // ✅ Phase 10 - Routes de santé et vérification services
pub mod health_structure_routes;
pub mod history_routes;
pub mod ia_routes;
pub mod image_search_routes;
pub mod kyc_admin_routes; // ✅ NOUVEAU: Routes admin KYC
pub mod kyc_webhook_routes; // ✅ NOUVEAU: Routes webhook KYC
pub mod live_ai_routes;
pub mod live_routes;
pub mod media_routes;
pub mod media_upload_routes;
pub mod metrics_routes;
pub mod metrics_tracking_routes;
pub mod mobile_logs_routes; // ✅ NOUVEAU : Routes pour logs mobile
pub mod nearby_services_routes;
pub mod negotiated_price_routes; // ✅ NOUVEAU : Routes prix négociés
pub mod notification_routes; // ✅ Routes de notifications
pub mod offres_emploi_routes; // ✅ NOUVEAU 2025-01-28: Routes pour offres d'emploi et matching intelligent
pub mod order_routes; // ✅ NOUVEAU : Routes pour commandes produits
pub mod orientation_scolaire_routes; // ✅ NOUVEAU 2025-01-28: Routes pour orientation scolaire et établissements
pub mod payment_routes;
pub mod phone_model_routes; // ✅ Routes pour modèles de smartphones
pub mod places_routes; // ✅ NOUVEAU: Routes pour autocomplete de lieux (Google Maps API)
pub mod plugin_routes;
pub mod popular_products_routes; // ✅ NOUVEAU 2025-11-04: Routes pour produits populaires (analyse concurrence)
pub mod prestataire_routes;
pub mod product_lifecycle_routes; // ✅ Routes de gestion du cycle de vie des produits
pub mod product_reactions_routes; // ✅ NOUVEAU 2025-11-04: Routes pour réactions/émotions sur les produits
pub mod products_management; // ✅ Routes pour gestion des produits
pub mod provider_analytics_routes; // ✅ NOUVEAU : Routes analytics prestataire
pub mod publicite_ab_testing_routes; // ✅ NOUVEAU: Routes pour A/B testing avancé
pub mod publicite_ai_routes; // ✅ NOUVEAU: Routes IA pour suggestions publicitaires
pub mod publicite_assets_routes; // ✅ NOUVEAU: Routes pour bibliothèque de médias
pub mod publicite_audiences_routes; // ✅ NOUVEAU: Routes pour audiences personnalisées
pub mod publicite_auto_optimization_routes; // ✅ NOUVEAU: Routes pour optimisation automatique
pub mod publicite_pixel_routes; // ✅ NOUVEAU: Routes pour tracking pixel avancé
pub mod publicite_routes; // ✅ NOUVEAU: Routes pour système de publicité payante
pub mod push_routes; // ✅ Routes de push notifications
pub mod recommendation_routes; // ✅ NOUVEAU: Routes pour recommandations et tracking visibilité
pub mod scheduling_search_routes; // ✅ NOUVEAU: Routes pour recherche avec planifications
pub mod search_history_routes; // ✅ NOUVEAU: Routes pour historique de recherche
pub mod service_routes;
pub mod service_team_routes; // ✅ NOUVEAU: Routes pour gestion d'équipe des services
pub mod shopping_routes;
pub mod signalement_routes; // ✅ NOUVEAU: Routes pour signalements
pub mod social_features_routes; // ✅ NOUVEAU: Routes fonctionnalités sociales avancées (Duet, Remix, Stitch, Réactions)
pub mod specialized_services_routes; // ✅ 2025-11-26: Routes pour services spécialisés (pharmacies, hôpitaux, laboratoires, agences, covoiturage, taxi)
pub mod stock_media_routes; // ✅ NOUVEAU Phase 2: Routes pour Stock Media Integration
pub mod system_health_routes;
pub mod token_pack_routes;
pub mod token_stats_routes; // ✅ NOUVEAU: Routes pour statistiques de consommation de tokens
pub mod upload_routes; // ✅ NOUVEAU: Routes pour upload préalable de fichiers
pub mod user_routes;
pub mod vehicle_model_routes;
pub mod video_hls_routes; // ✅ NOUVEAU: Routes HLS/DASH pour qualité adaptative serveur
pub mod video_metrics_routes; // ✅ Phase 4: Routes pour métriques Prometheus de scalabilité vidéo
pub mod video_ml_routes; // ✅ NOUVEAU: Routes ML pour recommandations vidéo et hashtags
pub mod video_routes; // ✅ NOUVEAU: Routes pour récupération des vidéos utilisateur
pub mod weather_routes;
pub mod webhook_routes;
pub mod webrtc_routes; // ✅ Routes WebRTC pour appels // ✅ NOUVEAU 2025-11-06: Routes de debug pour vérification tables autocomplete/localisation
pub mod websocket_routes; // ✅ NOUVEAU Phase 2.4: Routes WebSocket pour collaboration en temps réel // ✅ NOUVEAU Phase 2: Routes pour gestion des plugins

// === Routes d'Optimisation IA ===
// pub mod ia_routes_optimized; // Temporairement d?sactiv?
