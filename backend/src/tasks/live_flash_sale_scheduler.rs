use std::sync::Arc;

use tokio::time::{interval, Duration};

use crate::{services::live_flash_sale_service::LiveFlashSaleService, state::AppState};

const FLASH_SALE_POLL_INTERVAL_SECONDS: u64 = 30;

pub fn start_flash_sale_scheduler(state: Arc<AppState>) {
    tokio::spawn(async move {
        let mut ticker = interval(Duration::from_secs(FLASH_SALE_POLL_INTERVAL_SECONDS));
        loop {
            ticker.tick().await;
            LiveFlashSaleService::process_timers(state.clone()).await;
        }
    });
}




