// Script de diagnostic pour vérifier l'état des migrations et tables
// Usage: cargo run --bin diagnose_migrations

use sqlx::PgPool;
use std::env;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();
    
    let db_url = env::var("DATABASE_URL").map_err(|e| {
        eprintln!("❌ DATABASE_URL manquante: {}", e);
        e
    })?;

    println!("🔍 Connexion à la base de données...");
    let pool = PgPool::connect(&db_url).await?;
    println!("✅ Connexion établie\n");

    // 1. Vérifier la table _sqlx_migrations
    println!("📊 1. État de la table _sqlx_migrations:");
    let migrations_table_exists: bool = sqlx::query_scalar(
        "SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = '_sqlx_migrations'
        )",
    )
    .fetch_one(&pool)
    .await?;
    
    if migrations_table_exists {
        let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM _sqlx_migrations")
            .fetch_one(&pool)
            .await?;
        let successful: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM _sqlx_migrations WHERE success = true"
        )
        .fetch_one(&pool)
        .await?;
        let failed: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM _sqlx_migrations WHERE success = false"
        )
        .fetch_one(&pool)
        .await?;
        
        println!("   ✅ Table existe");
        println!("   📊 Total: {}, Réussies: {}, Échouées: {}", total, successful, failed);
        
        if failed > 0 {
            println!("\n   ⚠️ Migrations échouées:");
            let failed_migrations = sqlx::query_as::<_, (i64, String)>(
                "SELECT version, description FROM _sqlx_migrations WHERE success = false ORDER BY version"
            )
            .fetch_all(&pool)
            .await?;
            
            for (version, desc) in failed_migrations {
                println!("      - {}: {}", version, desc);
            }
        }
    } else {
        println!("   ❌ Table n'existe pas (aucune migration appliquée)");
    }

    // 2. Vérifier les tables critiques
    println!("\n📊 2. État des tables critiques:");
    let critical_tables = vec![
        "users",
        "services",
        "deliveries",
        "product_creation_queue",
        "publicites",
        "pharmacies",
        "matching_offres_candidats",
        "live_flash_sales",
        "global_promo_events",
        "delivery_matching_queue",
        "video_generation_jobs",
        "delivery_proximity_suggestions",
        "product_orders",
        "social_publication_jobs",
    ];

    for table in &critical_tables {
        let exists: bool = sqlx::query_scalar(&format!(
            "SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = '{}'
            )",
            table
        ))
        .fetch_one(&pool)
        .await?;
        
        if exists {
            let count: i64 = sqlx::query_scalar(&format!("SELECT COUNT(*) FROM {}", table))
                .fetch_one(&pool)
                .await
                .unwrap_or(0);
            println!("   ✅ {} ({} lignes)", table, count);
        } else {
            println!("   ❌ {} (MANQUANTE)", table);
        }
    }

    // 3. Vérifier les fonctions critiques
    println!("\n📊 3. État des fonctions critiques:");
    let critical_functions = vec![
        "run_audio_cache_cleanup",
        "cleanup_old_audio_transcriptions",
    ];

    for func in &critical_functions {
        let exists: bool = sqlx::query_scalar(&format!(
            "SELECT EXISTS (
                SELECT FROM pg_proc p
                JOIN pg_namespace n ON p.pronamespace = n.oid
                WHERE n.nspname = 'public'
                AND p.proname = '{}'
            )",
            func
        ))
        .fetch_one(&pool)
        .await?;
        
        if exists {
            println!("   ✅ {}()", func);
        } else {
            println!("   ❌ {}() (MANQUANTE)", func);
        }
    }

    // 4. Vérifier les extensions
    println!("\n📊 4. Extensions PostgreSQL:");
    let extensions = sqlx::query_as::<_, (String,)>(
        "SELECT extname FROM pg_extension ORDER BY extname"
    )
    .fetch_all(&pool)
    .await?;
    
    for (ext,) in extensions {
        println!("   ✅ {}", ext);
    }

    println!("\n✅ Diagnostic terminé");
    Ok(())
}

