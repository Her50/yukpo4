// Binaire pour appliquer les migrations 2025-01-01 directement
use sqlx::PgPool;
use std::env;
use yukpomnang_backend::migrations::auto_migrate;

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
    match auto_migrate::ensure_search_services_gps_final_alignment(&pool).await {
        Ok(_) => println!("✅ Migration 1 appliquée avec succès"),
        Err(e) => {
            eprintln!("❌ Erreur migration 1: {}", e);
            return Err(Box::new(e));
        }
    }
    
    // Migration 2: Optimiser hybrid_image_search
    println!("\n🔧 Application migration 2: Optimisation hybrid_image_search...");
    match auto_migrate::ensure_hybrid_image_search_optimization(&pool).await {
        Ok(_) => println!("✅ Migration 2 appliquée avec succès"),
        Err(e) => {
            eprintln!("❌ Erreur migration 2: {}", e);
            return Err(Box::new(e));
        }
    }
    
    println!("\n✅ Toutes les migrations ont été appliquées avec succès!");
    Ok(())
}

