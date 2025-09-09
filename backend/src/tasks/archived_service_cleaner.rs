// ?? T?che programm?e de nettoyage des services inactifs

//use crate::services::service_history_service::*;
use tokio::time::{sleep, Duration};

/// ?? V?rifie et nettoie les services inactifs toutes les 24h
pub async fn run_service_cleaner() {
    loop {
        println!("?? V?rification automatique des services inactifs...");

        // ?? Appelle ici la logique IA ou base pour d?sactivation automatique
        // Ex : check_and_update_service_status(pool).await;

        sleep(Duration::from_secs(60 * 60 * 24)).await; // Attente 24h
    }
}
