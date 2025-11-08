pub mod assistance_controller;
pub mod auth_controller;
pub mod echange_controller;
pub mod ia_controller;
pub mod ia_status_controller;
pub mod interaction_controller;
pub mod media_controller;
pub mod prestataire_controller;
pub mod service_controller;
pub mod token_pack_controller;
pub mod user_controller;
// pub mod fournitures_controller;
pub mod appliance_model_controller; // ✅ NOUVEAU: Contrôleur pour modèles d'appareils électroménagers (autocomplete)
pub mod autocomplete_controller; // ✅ NOUVEAU: Contrôleur pour autocomplete characteristics
pub mod combination_progress_controller; // ✅ NOUVEAU 2025-11-03: Contrôleur pour progression génération combinaisons
pub mod conversation_controller; // ✅ NOUVEAU: Contrôleur pour @mentions et multi-participants
pub mod debug_controller;
pub mod embedding_controller;
pub mod health_structure_controller; // ✅ NOUVEAU: Contrôleur pour structures de santé (autocomplete)
pub mod history_controller;
pub mod image_search_controller; // ✅ NOUVEAU: Contrôleur pour recherche par image
pub mod intelligent_service_controller;
pub mod media_product_controller; // ✅ NOUVEAU: Contrôleur pour médias par produit spécifique
pub mod mixed_content_controller; // ✅ NOUVEAU: Contrôleur pour contenu mixte (publicités + organiques)
pub mod notification_controller; // ✅ Contrôleur de notifications
pub mod payment_controller;
pub mod phone_model_controller; // ✅ NOUVEAU: Contrôleur pour modèles de smartphones (autocomplete)
pub mod places_controller; // ✅ NOUVEAU 2025-11-02: Contrôleur pour enrichissement géographique GeoNames
pub mod popular_products_controller; // ✅ NOUVEAU 2025-11-04: Contrôleur pour produits populaires (analyse concurrence)
pub mod product_addition_controller; // ✅ NOUVEAU 2025-11-01: Contrôleur pour ajout incrémental de produits
pub mod product_lifecycle_controller; // ✅ Contrôleur de gestion du cycle de vie des produits
pub mod product_reactions_controller; // ✅ NOUVEAU 2025-11-04: Contrôleur pour réactions/émotions sur les produits
pub mod product_comments_controller; // ✅ NOUVEAU 2025-11-08: Contrôleur pour fil de commentaires produits
pub mod publicite_controller; // ✅ NOUVEAU: Contrôleur pour système de publicité payante
pub mod push_controller; // ✅ Contrôleur de push notifications
pub mod recommendation_controller; // ✅ NOUVEAU: Contrôleur pour recommandations et tracking visibilité
pub mod scheduling_search_controller; // ✅ NOUVEAU: Contrôleur pour recherche avec planifications
pub mod scoring_controller; // ✅ Contrôleur pour scoring de services
pub mod search_history_controller; // ✅ NOUVEAU: Contrôleur pour historique de recherche
pub mod service_team_controller; // ✅ NOUVEAU: Contrôleur pour gestion d'équipe des services
pub mod signalement_controller; // ✅ NOUVEAU: Contrôleur pour signalements de produits/services
pub mod vehicle_model_controller; // ✅ NOUVEAU: Contrôleur pour modèles de véhicules (autocomplete)
pub mod webhook_controller;
pub mod webrtc_controller; // ✅ NOUVEAU: Contrôleur WebRTC pour appels // ✅ NOUVEAU 2025-11-06: Contrôleur pour debug et vérification des tables

// pub use service_controller::update_token_debit;
