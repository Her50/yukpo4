// Script pour appliquer directement les index d'optimisation
// Usage: cargo run --bin apply_indexes_direct

use sqlx::PgPool;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgresql://yukpo_db_user:88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4@dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com/yukpo_db".to_string());
    
    println!("🔧 Application des index d'optimisation...");
    
    let pool = PgPool::connect(&database_url).await?;
    
    let indexes = vec![
        // Index pour video_generation_jobs
        "CREATE INDEX IF NOT EXISTS idx_video_generation_jobs_status_updated_at 
         ON video_generation_jobs(status, updated_at)
         WHERE status IS NOT NULL",
        
        // Index pour global_promo_entries
        "CREATE INDEX IF NOT EXISTS idx_global_promo_entries_event_id_status 
         ON global_promo_entries(event_id, status)
         WHERE event_id IS NOT NULL",
        
        // Index pour global_promo_events
        "CREATE INDEX IF NOT EXISTS idx_global_promo_events_status_dates 
         ON global_promo_events(status, starts_at, ends_at)
         WHERE status IN ('scheduled', 'live', 'archived')",
        
        // Index pour live_flash_sales
        "CREATE INDEX IF NOT EXISTS idx_live_flash_sales_status_dates 
         ON live_flash_sales(status, start_at, end_at)
         WHERE status IN ('scheduled', 'live', 'ended')",
        
        // Index pour live_sessions
        "CREATE INDEX IF NOT EXISTS idx_live_sessions_id_host_user 
         ON live_sessions(id, host_user_id, service_id)
         WHERE id IS NOT NULL",
    ];
    
    for (i, index_sql) in indexes.iter().enumerate() {
        println!("📊 Création de l'index {}...", i + 1);
        match sqlx::query(index_sql).execute(&pool).await {
            Ok(_) => println!("✅ Index {} créé avec succès", i + 1),
            Err(e) => {
                if e.to_string().contains("already exists") {
                    println!("ℹ️ Index {} existe déjà (normal)", i + 1);
                } else {
                    eprintln!("❌ Erreur pour l'index {}: {}", i + 1, e);
                }
            }
        }
    }
    
    println!("✨ Terminé!");
    Ok(())
}



