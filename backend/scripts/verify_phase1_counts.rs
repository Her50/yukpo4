// ✅ Script de vérification Phase 1 - Compter effets et templates existants
// Usage: cargo run --bin verify_phase1_counts

use sqlx::{PgPool, Row};
use std::env;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Récupérer DATABASE_URL depuis les variables d'environnement
    let database_url = env::var("DATABASE_URL")
        .expect("DATABASE_URL doit être définie dans les variables d'environnement");

    println!("🔍 Phase 1 - Vérification des comptages existants");
    println!("==================================================");
    println!();

    // Connexion à la base de données
    let pool = PgPool::connect(&database_url).await?;
    println!("✅ Connexion à la base de données établie");
    println!();

    // 1. Compter les effets
    println!("📊 1. Comptage des effets");
    println!("---------------------------");
    
    let effects_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM effects")
        .fetch_one(&pool)
        .await?;
    
    println!("   Total effets: {}", effects_count);
    
    // Compter par catégorie
    let effects_by_category = sqlx::query(
        "SELECT category, COUNT(*) as count FROM effects GROUP BY category ORDER BY count DESC"
    )
    .fetch_all(&pool)
    .await?;
    
    println!("   Par catégorie:");
    for row in effects_by_category {
        let category: String = row.get("category");
        let count: i64 = row.get("count");
        println!("     - {}: {}", category, count);
    }
    
    // Compter premium vs gratuit
    let premium_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM effects WHERE is_premium = true")
        .fetch_one(&pool)
        .await?;
    let free_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM effects WHERE is_premium = false OR is_premium IS NULL")
        .fetch_one(&pool)
        .await?;
    
    println!("   Premium: {}, Gratuit: {}", premium_count, free_count);
    println!();

    // 2. Compter les templates
    println!("📊 2. Comptage des templates vidéo");
    println!("-----------------------------------");
    
    let templates_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM video_templates")
        .fetch_one(&pool)
        .await?;
    
    println!("   Total templates: {}", templates_count);
    
    // Compter par industrie
    let templates_by_industry = sqlx::query(
        "SELECT industry, COUNT(*) as count FROM video_templates GROUP BY industry ORDER BY count DESC"
    )
    .fetch_all(&pool)
    .await?;
    
    println!("   Par industrie:");
    for row in templates_by_industry {
        let industry: Option<String> = row.get("industry");
        let count: i64 = row.get("count");
        let industry_str = industry.as_deref().unwrap_or("Non spécifié");
        println!("     - {}: {}", industry_str, count);
    }
    
    // Compter premium vs gratuit
    let templates_premium_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM video_templates WHERE is_premium = true")
        .fetch_one(&pool)
        .await?;
    let templates_free_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM video_templates WHERE is_premium = false OR is_premium IS NULL")
        .fetch_one(&pool)
        .await?;
    
    println!("   Premium: {}, Gratuit: {}", templates_premium_count, templates_free_count);
    println!();

    // 3. Résumé et recommandations
    println!("📋 Résumé et Recommandations");
    println!("-----------------------------");
    
    if effects_count >= 100 {
        println!("   ✅ Effets: {} (objectif 100+ atteint)", effects_count);
    } else {
        println!("   ⚠️  Effets: {} (objectif 100+ non atteint, manque {})", 
                 effects_count, 100 - effects_count);
    }
    
    if templates_count >= 1000 {
        println!("   ✅ Templates: {} (objectif 1000+ atteint)", templates_count);
    } else {
        println!("   ⚠️  Templates: {} (objectif 1000+ non atteint, manque {})", 
                 templates_count, 1000 - templates_count);
    }
    println!();

    Ok(())
}

