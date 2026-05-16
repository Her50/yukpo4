pub mod chat_websocket; // ✅ NOUVEAU 2025-01-27 : WebSocket pour chat avec Redis pub/sub
pub mod delivery_chat; // ✅ NOUVEAU: WebSocket pour chat de livraison
pub mod delivery_tracking;
pub mod flash_sale_websocket;
pub mod status_manager;
pub mod upload_status_ws; // ✅ NOUVEAU 2025-01-27 : WebSocket pour statut upload
pub mod webrtc_signaling;
pub mod websocket_handler; // ✅ NOUVEAU: WebSocket pour mises à jour temps réel Flash Sales
pub mod ws_auth; // ✅ 2026-05-16 : Auth JWT pour tous les handlers WebSocket

pub use chat_websocket::{create_chat_websocket_router, ChatWebSocketManager, ChatWsMessage};
pub use delivery_chat::{
    create_delivery_chat_websocket_router, DeliveryChatMessage, DeliveryChatWebSocketManager,
};
pub use delivery_tracking::{DeliveryTrackingManager, DeliveryWsEvent, DeliveryWsMessage};
pub use status_manager::StatusManager;
pub use upload_status_ws::add_upload_status_websocket_routes;
pub use webrtc_signaling::{create_webrtc_manager, create_webrtc_router, WebRTCSignalingManager};
pub use websocket_handler::{create_websocket_router, StatusMessage};
