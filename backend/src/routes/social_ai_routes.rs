// Routes Social AI Engine
// Content generation, chatbot, Meta Ads, inbox, webhooks

use axum::{
    middleware,
    routing::{get, post, put},
    Router,
};
use std::sync::Arc;

use crate::{
    controllers::social_ai_controller::{
        add_thread_note,
        create_dpa_campaign,
        create_promo_campaign,
        escalate_thread,
        // Content AI
        generate_post,
        get_content_calendar,
        get_thread,
        instagram_dm_webhook,
        list_campaigns,
        // Inbox
        list_inbox,
        list_posts,
        messenger_webhook,
        resolve_thread,
        // Ads
        save_ad_account,
        search_inbox,
        // Chatbot
        update_chatbot_config,
        update_content_preferences,
        verify_webhook,
        whatsapp_webhook,
    },
    middlewares::jwt::jwt_auth,
    state::AppState,
};

pub fn social_ai_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    // Routes protégées JWT
    let protected = Router::new()
        // ── Content AI ────────────────────────────────────────────────────────
        .route("/api/social-ai/content/generate", post(generate_post))
        .route(
            "/api/social-ai/content/calendar/:service_id",
            get(get_content_calendar),
        )
        .route("/api/social-ai/content/posts/:service_id", get(list_posts))
        .route(
            "/api/social-ai/content/preferences/:service_id",
            put(update_content_preferences),
        )
        // ── Chatbot config ─────────────────────────────────────────────────────
        .route(
            "/api/social-ai/chatbot/config/:service_id",
            put(update_chatbot_config),
        )
        // ── Inbox ──────────────────────────────────────────────────────────────
        .route("/api/social-ai/inbox/:service_id", get(list_inbox))
        .route("/api/social-ai/inbox/:service_id/search", get(search_inbox))
        .route("/api/social-ai/inbox/thread/:thread_id", get(get_thread))
        .route(
            "/api/social-ai/inbox/thread/:thread_id/escalate",
            post(escalate_thread),
        )
        .route(
            "/api/social-ai/inbox/thread/:thread_id/resolve",
            post(resolve_thread),
        )
        .route(
            "/api/social-ai/inbox/thread/:thread_id/note",
            post(add_thread_note),
        )
        // ── Meta Ads ───────────────────────────────────────────────────────────
        .route("/api/social-ai/ads/account", post(save_ad_account))
        .route(
            "/api/social-ai/ads/campaigns/:service_id",
            get(list_campaigns),
        )
        .route(
            "/api/social-ai/ads/campaign/promo",
            post(create_promo_campaign),
        )
        .route("/api/social-ai/ads/dpa", post(create_dpa_campaign))
        .layer(middleware::from_fn_with_state(state.clone(), jwt_auth));

    // Routes publiques (webhooks Meta — pas de JWT, vérifié par token webhook)
    let public = Router::new()
        .route("/api/social-ai/webhook/verify", get(verify_webhook))
        .route("/api/social-ai/webhook/messenger", post(messenger_webhook))
        .route(
            "/api/social-ai/webhook/instagram",
            post(instagram_dm_webhook),
        )
        .route("/api/social-ai/webhook/whatsapp", post(whatsapp_webhook));

    Router::new().merge(protected).merge(public)
}
