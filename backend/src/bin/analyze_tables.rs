// Script pour analyser les tables et forcer PostgreSQL à utiliser les nouveaux index
// Usage: cargo run --bin analyze_tables

use sqlx::PgPool;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgresql://yukpo_db_user:88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4@dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com/yukpo_db".to_string());
    
    println!("📊 Analyse des tables pour optimiser l'utilisation des index...\n");
    
    let pool = PgPool::connect(&database_url).await?;
    
    let tables = vec![
        "video_generation_jobs",
        "global_promo_entries",
        "global_promo_events",
        "live_flash_sales",
        "live_sessions",
    ];
    
    for table in tables.iter() {
        println!("🔍 Analyse de la table {}...", table);
        let query = format!("ANALYZE {}", table);
        match sqlx::query(&query).execute(&pool).await {
            Ok(_) => println!("✅ Table {} analysée", table),
            Err(e) => eprintln!("❌ Erreur pour {}: {}", table, e),
        }
    }
    
    println!("\n✨ Analyse terminée! PostgreSQL devrait maintenant utiliser les nouveaux index.");
    Ok(())
}




