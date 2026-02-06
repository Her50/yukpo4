// ✅ Script pour vérifier les comptages effets et templates
// Usage: cargo run --bin check_counts

use log::info;
use sqlx::postgres::PgPoolOptions;
use std::env;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();
    env_logger::init();

    let database_url = env::var("DATABASE_URL")
        .expect("DATABASE_URL doit être définie dans les variables d'environnement");

    info!("Connexion à la base de données...");

    let pool = PgPoolOptions::new().max_connections(5).connect(&database_url).await?;

    info!("✅ Connexion PostgreSQL établie.");
    println!();

    // Compter les effets
    let effects_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM effects").fetch_one(&pool).await?;
    println!("📊 Total effets: {}", effects_count);

    if effects_count >= 100 {
        println!("   ✅ Objectif 100+ atteint");
    } else {
        println!(
            "   ⚠️  Objectif 100+ non atteint (manque {})",
            100 - effects_count
        );
    }

    // Compter les templates
    let templates_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM video_templates")
        .fetch_one(&pool)
        .await?;
    println!("📊 Total templates: {}", templates_count);

    if templates_count >= 1000 {
        println!("   ✅ Objectif 1000+ atteint");
    } else {
        println!(
            "   ⚠️  Objectif 1000+ non atteint (manque {})",
            1000 - templates_count
        );
    }

    println!();
    println!("✅ Vérification terminée");

    Ok(())
}
