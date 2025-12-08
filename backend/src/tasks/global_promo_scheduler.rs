use std::sync::Arc;

use tokio::time::{interval, Duration};

use crate::{services::global_promo_service::GlobalPromoService, state::AppState};

pub fn start_global_promo_scheduler(state: Arc<AppState>) {
    // Intervalle configurable via variable d'environnement (défaut: 30s)
    let poll_interval_seconds: u64 = std::env::var("GLOBAL_PROMO_SCHEDULER_INTERVAL_SECS")
        .unwrap_or_else(|_| "30".to_string())
        .parse()
        .unwrap_or(30);

    let _ = tokio::spawn(async move {
        let mut ticker = interval(Duration::from_secs(poll_interval_seconds));
        loop {
            ticker.tick().await;
            GlobalPromoService::process_scheduler(state.clone()).await;
        }
    });
}
