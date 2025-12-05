// ✅ Script standalone pour exécuter la tâche cron des trajets récurrents
// Date: 2025-01-29
// Usage: cargo run --bin recurring_trips_cron -- generate 30
//        cargo run --bin recurring_trips_cron -- activate 7
//        cargo run --bin recurring_trips_cron -- full

use dotenvy::dotenv;
use sqlx::postgres::PgPoolOptions;
use std::env;
use std::sync::Arc;
use yukpomnang_backend::tasks::recurring_trips_cron::run_recurring_trips_cron;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenv().ok();

    // Initialiser logging basique
    yukpomnang_backend::init_logging();

    // Récupérer arguments
    let args: Vec<String> = env::args().collect();

    if args.len() < 2 {
        eprintln!("Usage: {} <action> [days_ahead]", args[0]);
        eprintln!("Actions:");
        eprintln!("  generate <days>  - Génère instances récurrentes (défaut: 30 jours)");
        eprintln!("  activate <days>  - Active instances en attente (défaut: 7 jours)");
        eprintln!("  full <days>      - Génère ET active (défaut: 30 jours)");
        std::process::exit(1);
    }

    let action = &args[1];
    let days_ahead = args.get(2).and_then(|d| d.parse::<i32>().ok());

    // Connexion base de données
    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL doit être défini dans .env");

    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
        .expect("Échec connexion base de données");

    let pool_arc = Arc::new(pool);

    println!("🚀 Exécution tâche cron trajets récurrents: {}", action);

    // Exécuter la tâche
    match run_recurring_trips_cron(pool_arc, action, days_ahead).await {
        Ok(_) => {
            println!("✅ Tâche terminée avec succès");
            std::process::exit(0);
        }
        Err(e) => {
            eprintln!("❌ Erreur: {}", e);
            std::process::exit(1);
        }
    }
}
