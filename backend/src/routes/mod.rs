pub mod auth_routes;
pub mod ia_routes;
pub mod media_routes;
pub mod service_routes;
pub mod token_pack_routes;
pub mod user_routes;
pub mod prestataire_routes;
pub mod echange_routes;
pub mod fournitures_routes;
pub mod history_routes;
pub mod payment_routes;
pub mod webhook_routes;
pub mod image_search_routes;
pub mod weather_routes;
pub mod nearby_services_routes;
pub mod ai_chat_routes;
pub mod notification_routes; // ✅ Routes de notifications
pub mod push_routes; // ✅ Routes de push notifications
pub mod webrtc_routes; // ✅ Routes WebRTC pour appels
pub mod chat_routes; // ✅ NOUVEAU: Routes de chat avec push notifications
pub mod product_lifecycle_routes; // ✅ Routes de gestion du cycle de vie des produits
pub mod conversation_routes; // ✅ NOUVEAU: Routes pour @mentions et multi-participants
pub mod scheduling_search_routes; // ✅ NOUVEAU: Routes pour recherche avec planifications
// pub mod service_team_routes; // ⚠️ TEMPORAIREMENT DÉSACTIVÉ - Nécessite réécriture complète avec sqlx::Row
pub mod signalement_routes; // ✅ NOUVEAU: Routes pour signalements

// === Routes d'Optimisation IA ===
// pub mod ia_routes_optimized; // Temporairement d?sactiv?

