// Script temporaire pour appliquer les migrations 2025-01-01
use sqlx::PgPool;
use std::env;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenv::dotenv().ok();
    
    let database_url = env::var("DATABASE_URL")
        .expect("DATABASE_URL doit être définie");
    
    println!("🔍 Connexion à la base de données...");
    let pool = PgPool::connect(&database_url).await?;
    println!("✅ Connecté à la base de données");
    
    // Migration 1: Aligner search_services_gps_final
    println!("\n🔧 Application migration 1: Alignement search_services_gps_final...");
    let migration1 = include_str!("../migrations/20250101_ALIGN_SEARCH_GPS_FINAL_WITH_KEYWORD_SEARCH.sql");
    sqlx::raw_sql(migration1).execute(&pool).await?;
    println!("✅ Migration 1 appliquée");
    
    // Migration 2: Optimiser hybrid_image_search
    println!("\n🔧 Application migration 2: Optimisation hybrid_image_search...");
    let migration2 = include_str!("../migrations/20250101_OPTIMIZE_HYBRID_IMAGE_SEARCH_WITH_UNACCENT_SIMILARITY.sql");
    sqlx::raw_sql(migration2).execute(&pool).await?;
    println!("✅ Migration 2 appliquée");
    
    println!("\n✅ Toutes les migrations ont été appliquées avec succès!");
    Ok(())
}


