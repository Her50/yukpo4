// Script pour appliquer directement la migration hybrid_image_search_relevance
// Usage: cargo run --bin apply_migration_relevance

use dotenvy::dotenv;
use sqlx::postgres::PgPoolOptions;
use std::env;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenv().ok();

    let db_url = env::var("DATABASE_URL").map_err(|e| format!("DATABASE_URL manquante: {}", e))?;

    let mut db_url_final = db_url.clone();
    if !db_url_final.contains("sslmode=") {
        let separator = if db_url_final.contains('?') { "&" } else { "?" };
        db_url_final.push_str(&format!("{}sslmode=require", separator));
    }

    println!("🔌 Connexion à la base de données...");
    let pool = PgPoolOptions::new().max_connections(5).connect(&db_url_final).await?;

    println!("📝 Application de la migration hybrid_image_search_relevance...");

    // Utiliser la fonction publique ensure_hybrid_image_search_relevance
    yukpomnang_backend::migrations::auto_migrate::ensure_hybrid_image_search_relevance(&pool)
        .await?;

    println!("✅ Migration appliquée avec succès !");

    Ok(())
}
