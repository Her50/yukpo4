use std::sync::Arc;

use tokio::time::{interval, Duration};

use crate::{services::global_promo_service::GlobalPromoService, state::AppState};

const GLOBAL_PROMO_POLL_INTERVAL_SECONDS: u64 = 30;

pub fn start_global_promo_scheduler(state: Arc<AppState>) {
    tokio::spawn(async move {
        let mut ticker = interval(Duration::from_secs(GLOBAL_PROMO_POLL_INTERVAL_SECONDS));
        loop {
            ticker.tick().await;
            GlobalPromoService::process_scheduler(state.clone()).await;
        }
    });
}
