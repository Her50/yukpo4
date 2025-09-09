// Task Periodique Bloc 18
// V?rifie tous les jours les statuts des services et met en veille si besoin

use tokio::time::{sleep, Duration};

pub async fn run_service_checker() {
    loop {
        println!("?? V?rification automatique des services...");

        // Ici tu boucles sur tous les services actifs
        // Appel check_and_update_service_status()

        sleep(Duration::from_secs(86400)).await; // 24h
    }
}





