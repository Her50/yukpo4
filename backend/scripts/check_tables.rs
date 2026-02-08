// Script Rust pour vérifier les tables directement
// Compiler avec: cargo run --bin check_tables
// Ou: cargo run --example check_tables

use sqlx::postgres::PgPoolOptions;
use std::env;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let database_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgresql://yukpo_db_user:88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4@dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com/yukpo_db".to_string());

    println!("🔍 Connexion à la base de données...");
    println!();

    let pool = PgPoolOptions::new()
        .max_connections(1)
        .connect(&database_url)
        .await?;

    println!("✅ Connexion établie");
    println!();

    // Vérifier les tables critiques
    let tables = vec![
        "users",
        "services",
        "deliveries",
        "product_creation_queue",
        "delivery_matching_queue",
        "global_promo_events",
        "live_flash_sales",
        "product_orders",
        "social_publication_jobs",
        "video_generation_jobs",
        "delivery_proximity_suggestions",
        "publicites",
        "_sqlx_migrations",
    ];

    println!("📊 Vérification des tables critiques:");
    println!();

    let mut all_exist = true;
    for table in &tables {
        let exists: bool = sqlx::query_scalar(
            "SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = $1
            )",
        )
        .bind(table)
        .fetch_one(&pool)
        .await?;

        if exists {
            println!("  ✅ {} - EXISTE", table);
        } else {
            println!("  ❌ {} - MANQUANTE", table);
            all_exist = false;
        }
    }

    println!();

    // Vérifier les migrations
    let migrations_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM _sqlx_migrations WHERE success = true",
    )
    .fetch_one(&pool)
    .await
    .unwrap_or(0);

    let total_migrations: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM _sqlx_migrations")
        .fetch_one(&pool)
        .await
        .unwrap_or(0);

    println!("📊 Migrations:");
    println!("  Total: {}", total_migrations);
    println!("  Réussies: {}", migrations_count);
    println!();

    // Vérifier la migration 0
    let migration_0: Option<(String, bool)> = sqlx::query_as(
        "SELECT description, success FROM _sqlx_migrations WHERE version = 0",
    )
    .fetch_optional(&pool)
    .await?;

    if let Some((desc, success)) = migration_0 {
        if desc == "create all tables" && success {
            println!("  ✅ Migration 0 (create all tables) - OK");
        } else {
            println!("  ⚠️  Migration 0 - Description: '{}', Success: {}", desc, success);
        }
    } else {
        println!("  ⚠️  Migration 0 - Non trouvée");
    }

    println!();

    if all_exist && migrations_count > 0 {
        println!("✅ CONCLUSION: Toutes les tables critiques existent et les migrations sont appliquées !");
        Ok(())
    } else {
        println!("⚠️  CONCLUSION: Certaines tables ou migrations sont manquantes");
        std::process::exit(1);
    }
}






