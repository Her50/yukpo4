//! Module centralisé pour les métriques Prometheus
//!
//! Ce module expose toutes les métriques Prometheus utilisées dans l'application.
//! Les métriques sont formatées manuellement pour être compatibles avec le système existant.

use once_cell::sync::Lazy;
use std::sync::atomic::{AtomicI64, AtomicU64, Ordering};
use std::sync::Arc;

/// Métriques pour les promotions globales (Black Friday, etc.)
pub struct GlobalPromoMetrics {
    /// Nombre d'événements actifs
    pub events_active: Arc<AtomicI64>,
    /// Total des entrées créées
    pub entries_total: Arc<AtomicU64>,
    /// Total des vues d'entrées
    pub entries_views_total: Arc<AtomicU64>,
    /// Total des clics sur entrées
    pub entries_clicks_total: Arc<AtomicU64>,
    /// Total des vues de pages catalogue
    pub catalog_page_views_total: Arc<AtomicU64>,
    /// Total des recherches dans le catalogue
    pub catalog_searches_total: Arc<AtomicU64>,
    /// Total des revenus générés (en centimes)
    pub revenue_cents_total: Arc<AtomicU64>,
}

impl GlobalPromoMetrics {
    pub fn new() -> Self {
        Self {
            events_active: Arc::new(AtomicI64::new(0)),
            entries_total: Arc::new(AtomicU64::new(0)),
            entries_views_total: Arc::new(AtomicU64::new(0)),
            entries_clicks_total: Arc::new(AtomicU64::new(0)),
            catalog_page_views_total: Arc::new(AtomicU64::new(0)),
            catalog_searches_total: Arc::new(AtomicU64::new(0)),
            revenue_cents_total: Arc::new(AtomicU64::new(0)),
        }
    }

    /// Formate les métriques au format Prometheus
    pub fn format_prometheus(&self) -> String {
        let mut output = String::new();

        output.push_str("# HELP global_promo_events_active Number of active global promo events\n");
        output.push_str("# TYPE global_promo_events_active gauge\n");
        output.push_str(&format!(
            "global_promo_events_active {}\n",
            self.events_active.load(Ordering::Relaxed)
        ));

        output.push_str("# HELP global_promo_entries_total Total number of promo entries\n");
        output.push_str("# TYPE global_promo_entries_total counter\n");
        output.push_str(&format!(
            "global_promo_entries_total {}\n",
            self.entries_total.load(Ordering::Relaxed)
        ));

        output.push_str("# HELP global_promo_entries_views_total Total promo entry views\n");
        output.push_str("# TYPE global_promo_entries_views_total counter\n");
        output.push_str(&format!(
            "global_promo_entries_views_total {}\n",
            self.entries_views_total.load(Ordering::Relaxed)
        ));

        output.push_str("# HELP global_promo_entries_clicks_total Total promo entry clicks\n");
        output.push_str("# TYPE global_promo_entries_clicks_total counter\n");
        output.push_str(&format!(
            "global_promo_entries_clicks_total {}\n",
            self.entries_clicks_total.load(Ordering::Relaxed)
        ));

        output.push_str("# HELP global_promo_catalog_page_views_total Total catalog page views\n");
        output.push_str("# TYPE global_promo_catalog_page_views_total counter\n");
        output.push_str(&format!(
            "global_promo_catalog_page_views_total {}\n",
            self.catalog_page_views_total.load(Ordering::Relaxed)
        ));

        output.push_str("# HELP global_promo_catalog_searches_total Total catalog searches\n");
        output.push_str("# TYPE global_promo_catalog_searches_total counter\n");
        output.push_str(&format!(
            "global_promo_catalog_searches_total {}\n",
            self.catalog_searches_total.load(Ordering::Relaxed)
        ));

        output
            .push_str("# HELP global_promo_revenue_cents_total Total revenue generated in cents\n");
        output.push_str("# TYPE global_promo_revenue_cents_total counter\n");
        output.push_str(&format!(
            "global_promo_revenue_cents_total {}\n",
            self.revenue_cents_total.load(Ordering::Relaxed)
        ));

        output
    }
}

impl Default for GlobalPromoMetrics {
    fn default() -> Self {
        Self::new()
    }
}

/// Métriques pour les carrousels de produits
pub struct ProductCarouselMetrics {
    /// Total des scrolls
    pub scrolls_total: Arc<AtomicU64>,
    /// Total des événements de scroll automatique
    pub auto_scroll_events_total: Arc<AtomicU64>,
    /// Total des items vus
    pub items_viewed_total: Arc<AtomicU64>,
    /// Total des interactions
    pub interactions_total: Arc<AtomicU64>,
    /// Total des pauses
    pub pause_events_total: Arc<AtomicU64>,
    /// Total des reprises
    pub resume_events_total: Arc<AtomicU64>,
}

impl ProductCarouselMetrics {
    pub fn new() -> Self {
        Self {
            scrolls_total: Arc::new(AtomicU64::new(0)),
            auto_scroll_events_total: Arc::new(AtomicU64::new(0)),
            items_viewed_total: Arc::new(AtomicU64::new(0)),
            interactions_total: Arc::new(AtomicU64::new(0)),
            pause_events_total: Arc::new(AtomicU64::new(0)),
            resume_events_total: Arc::new(AtomicU64::new(0)),
        }
    }

    pub fn format_prometheus(&self) -> String {
        let mut output = String::new();

        output.push_str("# HELP product_carousel_scrolls_total Total product carousel scrolls\n");
        output.push_str("# TYPE product_carousel_scrolls_total counter\n");
        output.push_str(&format!(
            "product_carousel_scrolls_total {}\n",
            self.scrolls_total.load(Ordering::Relaxed)
        ));

        output.push_str(
            "# HELP product_carousel_auto_scroll_events_total Total auto scroll events\n",
        );
        output.push_str("# TYPE product_carousel_auto_scroll_events_total counter\n");
        output.push_str(&format!(
            "product_carousel_auto_scroll_events_total {}\n",
            self.auto_scroll_events_total.load(Ordering::Relaxed)
        ));

        output.push_str("# HELP product_carousel_items_viewed_total Total items viewed\n");
        output.push_str("# TYPE product_carousel_items_viewed_total counter\n");
        output.push_str(&format!(
            "product_carousel_items_viewed_total {}\n",
            self.items_viewed_total.load(Ordering::Relaxed)
        ));

        output.push_str("# HELP product_carousel_interactions_total Total interactions\n");
        output.push_str("# TYPE product_carousel_interactions_total counter\n");
        output.push_str(&format!(
            "product_carousel_interactions_total {}\n",
            self.interactions_total.load(Ordering::Relaxed)
        ));

        output.push_str("# HELP product_carousel_pause_events_total Total pause events\n");
        output.push_str("# TYPE product_carousel_pause_events_total counter\n");
        output.push_str(&format!(
            "product_carousel_pause_events_total {}\n",
            self.pause_events_total.load(Ordering::Relaxed)
        ));

        output.push_str("# HELP product_carousel_resume_events_total Total resume events\n");
        output.push_str("# TYPE product_carousel_resume_events_total counter\n");
        output.push_str(&format!(
            "product_carousel_resume_events_total {}\n",
            self.resume_events_total.load(Ordering::Relaxed)
        ));

        output
    }
}

impl Default for ProductCarouselMetrics {
    fn default() -> Self {
        Self::new()
    }
}

/// Métriques pour les carrousels de vidéos
pub struct VideoCarouselMetrics {
    /// Total des scrolls
    pub scrolls_total: Arc<AtomicU64>,
    /// Total des événements de scroll automatique
    pub auto_scroll_events_total: Arc<AtomicU64>,
    /// Total des vidéos vues
    pub videos_viewed_total: Arc<AtomicU64>,
    /// Total des événements play
    pub play_events_total: Arc<AtomicU64>,
    /// Total des événements pause
    pub pause_events_total: Arc<AtomicU64>,
    /// Total des engagements (likes, shares, comments)
    pub engagement_total: Arc<AtomicU64>,
}

impl VideoCarouselMetrics {
    pub fn new() -> Self {
        Self {
            scrolls_total: Arc::new(AtomicU64::new(0)),
            auto_scroll_events_total: Arc::new(AtomicU64::new(0)),
            videos_viewed_total: Arc::new(AtomicU64::new(0)),
            play_events_total: Arc::new(AtomicU64::new(0)),
            pause_events_total: Arc::new(AtomicU64::new(0)),
            engagement_total: Arc::new(AtomicU64::new(0)),
        }
    }

    pub fn format_prometheus(&self) -> String {
        let mut output = String::new();

        output.push_str("# HELP video_carousel_scrolls_total Total video carousel scrolls\n");
        output.push_str("# TYPE video_carousel_scrolls_total counter\n");
        output.push_str(&format!(
            "video_carousel_scrolls_total {}\n",
            self.scrolls_total.load(Ordering::Relaxed)
        ));

        output
            .push_str("# HELP video_carousel_auto_scroll_events_total Total auto scroll events\n");
        output.push_str("# TYPE video_carousel_auto_scroll_events_total counter\n");
        output.push_str(&format!(
            "video_carousel_auto_scroll_events_total {}\n",
            self.auto_scroll_events_total.load(Ordering::Relaxed)
        ));

        output.push_str("# HELP video_carousel_videos_viewed_total Total videos viewed\n");
        output.push_str("# TYPE video_carousel_videos_viewed_total counter\n");
        output.push_str(&format!(
            "video_carousel_videos_viewed_total {}\n",
            self.videos_viewed_total.load(Ordering::Relaxed)
        ));

        output.push_str("# HELP video_carousel_play_events_total Total play events\n");
        output.push_str("# TYPE video_carousel_play_events_total counter\n");
        output.push_str(&format!(
            "video_carousel_play_events_total {}\n",
            self.play_events_total.load(Ordering::Relaxed)
        ));

        output.push_str("# HELP video_carousel_pause_events_total Total pause events\n");
        output.push_str("# TYPE video_carousel_pause_events_total counter\n");
        output.push_str(&format!(
            "video_carousel_pause_events_total {}\n",
            self.pause_events_total.load(Ordering::Relaxed)
        ));

        output.push_str(
            "# HELP video_carousel_engagement_total Total engagement (likes, shares, comments)\n",
        );
        output.push_str("# TYPE video_carousel_engagement_total counter\n");
        output.push_str(&format!(
            "video_carousel_engagement_total {}\n",
            self.engagement_total.load(Ordering::Relaxed)
        ));

        output
    }
}

impl Default for VideoCarouselMetrics {
    fn default() -> Self {
        Self::new()
    }
}

/// Métriques pour les échanges clients/prestataires (Chat)
pub struct ChatMetrics {
    /// Conversations actives
    pub conversations_active: Arc<AtomicI64>,
    /// Total des messages envoyés
    pub messages_sent_total: Arc<AtomicU64>,
    /// Total des messages livrés
    pub messages_delivered_total: Arc<AtomicU64>,
    /// Total des messages lus
    pub messages_read_total: Arc<AtomicU64>,
    /// Total des conversations résolues
    pub conversations_resolved_total: Arc<AtomicU64>,
    /// Total des conversations non résolues
    pub conversations_unresolved_total: Arc<AtomicU64>,
    /// Total des messages audio
    pub audio_messages_total: Arc<AtomicU64>,
    /// Total des appels WebRTC
    pub webrtc_calls_total: Arc<AtomicU64>,
    /// Total des notifications envoyées
    pub notifications_sent_total: Arc<AtomicU64>,
}

impl ChatMetrics {
    pub fn new() -> Self {
        Self {
            conversations_active: Arc::new(AtomicI64::new(0)),
            messages_sent_total: Arc::new(AtomicU64::new(0)),
            messages_delivered_total: Arc::new(AtomicU64::new(0)),
            messages_read_total: Arc::new(AtomicU64::new(0)),
            conversations_resolved_total: Arc::new(AtomicU64::new(0)),
            conversations_unresolved_total: Arc::new(AtomicU64::new(0)),
            audio_messages_total: Arc::new(AtomicU64::new(0)),
            webrtc_calls_total: Arc::new(AtomicU64::new(0)),
            notifications_sent_total: Arc::new(AtomicU64::new(0)),
        }
    }

    pub fn format_prometheus(&self) -> String {
        let mut output = String::new();

        output.push_str("# HELP chat_conversations_active_total Active chat conversations\n");
        output.push_str("# TYPE chat_conversations_active_total gauge\n");
        output.push_str(&format!(
            "chat_conversations_active_total {}\n",
            self.conversations_active.load(Ordering::Relaxed)
        ));

        output.push_str("# HELP chat_messages_sent_total Total messages sent\n");
        output.push_str("# TYPE chat_messages_sent_total counter\n");
        output.push_str(&format!(
            "chat_messages_sent_total {}\n",
            self.messages_sent_total.load(Ordering::Relaxed)
        ));

        output.push_str("# HELP chat_messages_delivered_total Total messages delivered\n");
        output.push_str("# TYPE chat_messages_delivered_total counter\n");
        output.push_str(&format!(
            "chat_messages_delivered_total {}\n",
            self.messages_delivered_total.load(Ordering::Relaxed)
        ));

        output.push_str("# HELP chat_messages_read_total Total messages read\n");
        output.push_str("# TYPE chat_messages_read_total counter\n");
        output.push_str(&format!(
            "chat_messages_read_total {}\n",
            self.messages_read_total.load(Ordering::Relaxed)
        ));

        output.push_str("# HELP chat_conversations_resolved_total Total resolved conversations\n");
        output.push_str("# TYPE chat_conversations_resolved_total counter\n");
        output.push_str(&format!(
            "chat_conversations_resolved_total {}\n",
            self.conversations_resolved_total.load(Ordering::Relaxed)
        ));

        output.push_str(
            "# HELP chat_conversations_unresolved_total Total unresolved conversations\n",
        );
        output.push_str("# TYPE chat_conversations_unresolved_total counter\n");
        output.push_str(&format!(
            "chat_conversations_unresolved_total {}\n",
            self.conversations_unresolved_total.load(Ordering::Relaxed)
        ));

        output.push_str("# HELP chat_audio_messages_total Total audio messages\n");
        output.push_str("# TYPE chat_audio_messages_total counter\n");
        output.push_str(&format!(
            "chat_audio_messages_total {}\n",
            self.audio_messages_total.load(Ordering::Relaxed)
        ));

        output.push_str("# HELP chat_webrtc_calls_total Total WebRTC calls\n");
        output.push_str("# TYPE chat_webrtc_calls_total counter\n");
        output.push_str(&format!(
            "chat_webrtc_calls_total {}\n",
            self.webrtc_calls_total.load(Ordering::Relaxed)
        ));

        output.push_str("# HELP chat_notifications_sent_total Total notifications sent\n");
        output.push_str("# TYPE chat_notifications_sent_total counter\n");
        output.push_str(&format!(
            "chat_notifications_sent_total {}\n",
            self.notifications_sent_total.load(Ordering::Relaxed)
        ));

        output
    }
}

impl Default for ChatMetrics {
    fn default() -> Self {
        Self::new()
    }
}

/// Métriques pour la navigation ResultaBesoinScreen
pub struct NavigationMetrics {
    /// Total des vues d'écran
    pub screen_views_total: Arc<AtomicU64>,
    /// Total des recherches
    pub searches_total: Arc<AtomicU64>,
    /// Total des résultats affichés
    pub results_displayed_total: Arc<AtomicU64>,
    /// Total des filtres appliqués
    pub filters_applied_total: Arc<AtomicU64>,
    /// Total des clics sur items
    pub item_clicks_total: Arc<AtomicU64>,
    /// Total des recherches sans résultats
    pub searches_without_results_total: Arc<AtomicU64>,
    /// Total des recherches géolocalisées
    pub geolocation_searches_total: Arc<AtomicU64>,
    /// Total des interactions avec la carte
    pub map_interactions_total: Arc<AtomicU64>,
}

impl NavigationMetrics {
    pub fn new() -> Self {
        Self {
            screen_views_total: Arc::new(AtomicU64::new(0)),
            searches_total: Arc::new(AtomicU64::new(0)),
            results_displayed_total: Arc::new(AtomicU64::new(0)),
            filters_applied_total: Arc::new(AtomicU64::new(0)),
            item_clicks_total: Arc::new(AtomicU64::new(0)),
            searches_without_results_total: Arc::new(AtomicU64::new(0)),
            geolocation_searches_total: Arc::new(AtomicU64::new(0)),
            map_interactions_total: Arc::new(AtomicU64::new(0)),
        }
    }

    pub fn format_prometheus(&self) -> String {
        let mut output = String::new();

        output.push_str("# HELP resulta_besoin_screen_views_total Total screen views\n");
        output.push_str("# TYPE resulta_besoin_screen_views_total counter\n");
        output.push_str(&format!(
            "resulta_besoin_screen_views_total {}\n",
            self.screen_views_total.load(Ordering::Relaxed)
        ));

        output.push_str("# HELP resulta_besoin_screen_searches_total Total searches\n");
        output.push_str("# TYPE resulta_besoin_screen_searches_total counter\n");
        output.push_str(&format!(
            "resulta_besoin_screen_searches_total {}\n",
            self.searches_total.load(Ordering::Relaxed)
        ));

        output.push_str(
            "# HELP resulta_besoin_screen_results_displayed_total Total results displayed\n",
        );
        output.push_str("# TYPE resulta_besoin_screen_results_displayed_total counter\n");
        output.push_str(&format!(
            "resulta_besoin_screen_results_displayed_total {}\n",
            self.results_displayed_total.load(Ordering::Relaxed)
        ));

        output
            .push_str("# HELP resulta_besoin_screen_filters_applied_total Total filters applied\n");
        output.push_str("# TYPE resulta_besoin_screen_filters_applied_total counter\n");
        output.push_str(&format!(
            "resulta_besoin_screen_filters_applied_total {}\n",
            self.filters_applied_total.load(Ordering::Relaxed)
        ));

        output.push_str("# HELP resulta_besoin_screen_item_clicks_total Total item clicks\n");
        output.push_str("# TYPE resulta_besoin_screen_item_clicks_total counter\n");
        output.push_str(&format!(
            "resulta_besoin_screen_item_clicks_total {}\n",
            self.item_clicks_total.load(Ordering::Relaxed)
        ));

        output.push_str("# HELP resulta_besoin_screen_searches_without_results_total Total searches without results\n");
        output.push_str("# TYPE resulta_besoin_screen_searches_without_results_total counter\n");
        output.push_str(&format!(
            "resulta_besoin_screen_searches_without_results_total {}\n",
            self.searches_without_results_total.load(Ordering::Relaxed)
        ));

        output.push_str(
            "# HELP resulta_besoin_screen_geolocation_searches_total Total geolocation searches\n",
        );
        output.push_str("# TYPE resulta_besoin_screen_geolocation_searches_total counter\n");
        output.push_str(&format!(
            "resulta_besoin_screen_geolocation_searches_total {}\n",
            self.geolocation_searches_total.load(Ordering::Relaxed)
        ));

        output.push_str(
            "# HELP resulta_besoin_screen_map_interactions_total Total map interactions\n",
        );
        output.push_str("# TYPE resulta_besoin_screen_map_interactions_total counter\n");
        output.push_str(&format!(
            "resulta_besoin_screen_map_interactions_total {}\n",
            self.map_interactions_total.load(Ordering::Relaxed)
        ));

        output
    }
}

impl Default for NavigationMetrics {
    fn default() -> Self {
        Self::new()
    }
}

/// Instance globale des métriques
pub static GLOBAL_PROMO_METRICS: Lazy<GlobalPromoMetrics> = Lazy::new(GlobalPromoMetrics::new);
pub static PRODUCT_CAROUSEL_METRICS: Lazy<ProductCarouselMetrics> =
    Lazy::new(ProductCarouselMetrics::new);
pub static VIDEO_CAROUSEL_METRICS: Lazy<VideoCarouselMetrics> =
    Lazy::new(VideoCarouselMetrics::new);
pub static CHAT_METRICS: Lazy<ChatMetrics> = Lazy::new(ChatMetrics::new);
pub static NAVIGATION_METRICS: Lazy<NavigationMetrics> = Lazy::new(NavigationMetrics::new);

// ✅ NOUVEAU 2025-01-27 : Métriques pour création de produits
pub mod product_creation_metrics;

/// Formate toutes les métriques additionnelles au format Prometheus
pub fn format_all_additional_metrics() -> String {
    let mut output = String::new();

    output.push_str("\n# === Global Promo Metrics ===\n");
    output.push_str(&GLOBAL_PROMO_METRICS.format_prometheus());

    output.push_str("\n# === Product Carousel Metrics ===\n");
    output.push_str(&PRODUCT_CAROUSEL_METRICS.format_prometheus());

    output.push_str("\n# === Video Carousel Metrics ===\n");
    output.push_str(&VIDEO_CAROUSEL_METRICS.format_prometheus());

    output.push_str("\n# === Chat Metrics ===\n");
    output.push_str(&CHAT_METRICS.format_prometheus());

    output.push_str("\n# === Navigation Metrics ===\n");
    output.push_str(&NAVIGATION_METRICS.format_prometheus());

    // ✅ NOUVEAU : Métriques création de produits
    if let Ok(metrics) = product_creation_metrics::ProductCreationMetrics::new() {
        output.push_str("\n# === Product Creation Metrics ===\n");
        output.push_str(&format_product_creation_metrics(&metrics));
    }

    output
}

/// Formate les métriques de création de produits
fn format_product_creation_metrics(
    _metrics: &product_creation_metrics::ProductCreationMetrics,
) -> String {
    use prometheus::Encoder;
    let encoder = prometheus::TextEncoder::new();
    let metric_families = prometheus::gather();
    let mut buffer = Vec::new();
    encoder
        .encode(&metric_families, &mut buffer)
        .unwrap_or_default();
    String::from_utf8(buffer).unwrap_or_default()
}
