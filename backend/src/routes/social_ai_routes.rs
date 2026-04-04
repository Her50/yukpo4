// Routes Social AI Engine
// Content generation, chatbot, Meta Ads, inbox, webhooks

use axum::{
    middleware,
    routing::{get, post, put},
    Router,
};
use std::sync::Arc;

use crate::{
    controllers::social_ai_addons::{
        // Email
        create_email_campaign,
        create_marketplace_listing,
        // Paiement WhatsApp
        create_payment_link,
        // Marketplace
        discover_marketplace,
        // Vision
        enrich_product_vision,
        get_crm_customer,
        // CRM
        list_crm_customers,
        list_email_campaigns,
        list_payment_links,
        update_crm_customer,
    },
    controllers::social_ai_controller::{
        add_thread_note,
        create_dpa_campaign,
        create_promo_campaign,
        escalate_thread,
        // Content AI
        generate_post,
        generate_reel_script,
        get_benchmark,
        get_content_calendar,
        get_onboarding_status,
        get_optimal_schedule,
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
    controllers::social_ai_growth::{
        // WhatsApp broadcast
        create_whatsapp_broadcast,
        // Abandoned cart
        detect_abandoned_carts,
        // Analytics export
        export_analytics_csv,
        list_whatsapp_broadcasts,
        process_abandoned_cart_jobs,
        // Email sending
        send_email_campaign,
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
            "/api/social-ai/content/calendar/{service_id}",
            get(get_content_calendar),
        )
        .route("/api/social-ai/content/posts/{service_id}", get(list_posts))
        .route(
            "/api/social-ai/content/preferences/{service_id}",
            put(update_content_preferences),
        )
        // ── Chatbot config ─────────────────────────────────────────────────────
        .route(
            "/api/social-ai/chatbot/config/{service_id}",
            put(update_chatbot_config),
        )
        // ── Inbox ──────────────────────────────────────────────────────────────
        .route("/api/social-ai/inbox/{service_id}", get(list_inbox))
        .route(
            "/api/social-ai/inbox/{service_id}/search",
            get(search_inbox),
        )
        .route("/api/social-ai/inbox/thread/{thread_id}", get(get_thread))
        .route(
            "/api/social-ai/inbox/thread/{thread_id}/escalate",
            post(escalate_thread),
        )
        .route(
            "/api/social-ai/inbox/thread/{thread_id}/resolve",
            post(resolve_thread),
        )
        .route(
            "/api/social-ai/inbox/thread/{thread_id}/note",
            post(add_thread_note),
        )
        // ── Meta Ads ───────────────────────────────────────────────────────────
        .route("/api/social-ai/ads/account", post(save_ad_account))
        .route(
            "/api/social-ai/ads/campaigns/{service_id}",
            get(list_campaigns),
        )
        .route(
            "/api/social-ai/ads/campaign/promo",
            post(create_promo_campaign),
        )
        .route("/api/social-ai/ads/dpa", post(create_dpa_campaign))
        // ── Smart scheduling ──────────────────────────────────────────────────
        .route(
            "/api/social-ai/schedule/optimal/{service_id}",
            get(get_optimal_schedule),
        )
        // ── Benchmark analytics ───────────────────────────────────────────────
        .route(
            "/api/social-ai/analytics/benchmark/{service_id}",
            get(get_benchmark),
        )
        // ── Reels script ──────────────────────────────────────────────────────
        .route(
            "/api/social-ai/content/reel-script",
            post(generate_reel_script),
        )
        // ── Onboarding ────────────────────────────────────────────────────────
        .route(
            "/api/social-ai/onboarding/status/{service_id}",
            get(get_onboarding_status),
        )
        // ── CRM léger ─────────────────────────────────────────────────────────
        .route(
            "/api/social-ai/crm/customers/{service_id}",
            get(list_crm_customers),
        )
        .route(
            "/api/social-ai/crm/customer/{service_id}/{external_id}",
            get(get_crm_customer).patch(update_crm_customer),
        )
        // ── Email marketing ───────────────────────────────────────────────────
        .route(
            "/api/social-ai/email/campaigns",
            post(create_email_campaign),
        )
        .route(
            "/api/social-ai/email/campaigns/{service_id}",
            get(list_email_campaigns),
        )
        // ── Vision AI — enrichissement catalogue ──────────────────────────────
        .route(
            "/api/social-ai/content/enrich-product",
            post(enrich_product_vision),
        )
        // ── WhatsApp payment links ────────────────────────────────────────────
        .route("/api/social-ai/payment-links", post(create_payment_link))
        .route(
            "/api/social-ai/payment-links/{service_id}",
            get(list_payment_links),
        )
        // ── Marketplace cross-partenaires ─────────────────────────────────────
        .route(
            "/api/social-ai/marketplace/discover",
            get(discover_marketplace),
        )
        .route(
            "/api/social-ai/marketplace/listings",
            post(create_marketplace_listing),
        )
        // ── Email sending réel ────────────────────────────────────────────────
        .route(
            "/api/social-ai/email/campaigns/{id}/send",
            post(send_email_campaign),
        )
        // ── WhatsApp broadcast ────────────────────────────────────────────────
        .route(
            "/api/social-ai/whatsapp/broadcasts",
            post(create_whatsapp_broadcast),
        )
        .route(
            "/api/social-ai/whatsapp/broadcasts/{service_id}",
            get(list_whatsapp_broadcasts),
        )
        // ── Abandoned cart recovery ───────────────────────────────────────────
        .route(
            "/api/social-ai/crm/abandoned-cart/detect",
            post(detect_abandoned_carts),
        )
        .route(
            "/api/social-ai/crm/abandoned-cart/process",
            post(process_abandoned_cart_jobs),
        )
        // ── Analytics export CSV ──────────────────────────────────────────────
        .route(
            "/api/social-ai/analytics/export/{service_id}",
            get(export_analytics_csv),
        )
        .layer(middleware::from_fn_with_state(state.clone(), jwt_auth));

    // Routes publiques (webhooks Meta — pas de JWT, vérifié par token webhook)
    let public = Router::new()
        .route("/api/social-ai/webhook/verify", get(verify_webhook))
        // Meta envoie GET (vérification) et POST (messages) sur la même URL
        .route(
            "/api/social-ai/webhook/messenger",
            get(verify_webhook).post(messenger_webhook),
        )
        .route(
            "/api/social-ai/webhook/instagram",
            get(verify_webhook).post(instagram_dm_webhook),
        )
        .route(
            "/api/social-ai/webhook/whatsapp",
            get(verify_webhook).post(whatsapp_webhook),
        );

    Router::new().merge(protected).merge(public)
}
