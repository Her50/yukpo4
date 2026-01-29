// Script de diagnostic pour comprendre pourquoi les migrations ne passent pas
// Exécutable depuis ECS ou localement avec accès VPN

use sqlx::{PgPool, Row};
use std::env;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Configuration du logging
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();

    // Récupérer DATABASE_URL
    let database_url = env::var("DATABASE_URL")
        .expect("DATABASE_URL doit être définie");

    println!("🔍 Diagnostic des migrations AWS...");
    println!("   Database: {}", mask_password(&database_url));

    // Connexion à la base de données
    let pool = PgPool::connect(&database_url).await?;
    println!("✅ Connexion à la base de données établie\n");

    // 1. Vérifier l'état de la table _sqlx_migrations
    println!("📊 1. État de la table _sqlx_migrations:");
    println!("{}", "=".repeat(80));
    
    let migrations = sqlx::query(
        "SELECT version, description, installed_on, success, execution_time, encode(checksum, 'hex') as checksum_hex
         FROM _sqlx_migrations
         ORDER BY version
         LIMIT 20"
    )
    .fetch_all(&pool)
    .await?;

    if migrations.is_empty() {
        println!("⚠️  Aucune migration enregistrée dans _sqlx_migrations");
    } else {
        println!("{:<10} {:<40} {:<20} {:<8} {:<12} {}", 
            "Version", "Description", "Installed On", "Success", "Time (ms)", "Checksum");
        println!("{}", "-".repeat(80));
        
        for row in migrations {
            let version: i64 = row.get(0);
            let description: String = row.get(1);
            let installed_on: chrono::DateTime<chrono::Utc> = row.get(2);
            let success: bool = row.get(3);
            let execution_time: i64 = row.get(4);
            let checksum_hex: String = row.get(5);
            
            let success_str = if success { "✅" } else { "❌" };
            let checksum_short = if checksum_hex.len() > 16 {
                &checksum_hex[..16]
            } else {
                &checksum_hex
            };
            
            println!("{:<10} {:<40} {:<20} {:<8} {:<12} {}...", 
                version, 
                truncate(&description, 40),
                installed_on.format("%Y-%m-%d %H:%M:%S"),
                success_str,
                execution_time,
                checksum_short
            );
        }
    }

    // 2. Vérifier quelles tables existent
    println!("\n📊 2. État des tables critiques:");
    println!("{}", "=".repeat(80));
    
    let critical_tables = vec![
        "users", "services", "media",
        "live_sessions", "live_flash_sales",
        "parcel_types", "couriers", "delivery_parcels", "deliveries",
        "delivery_zones", "delivery_matching_queue",
        "product_creation_queue", "product_orders",
        "global_promo_events", "social_publication_jobs",
        "video_generation_jobs", "delivery_proximity_suggestions"
    ];

    println!("{:<35} {:<10}", "Table", "Status");
    println!("{}", "-".repeat(80));
    
    let mut missing_tables = Vec::new();
    for table_name in &critical_tables {
        let exists: bool = sqlx::query_scalar(
            "SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = $1
            )"
        )
        .bind(table_name)
        .fetch_one(&pool)
        .await?;
        
        let status = if exists { "✅ Existe" } else { "❌ Manquante" };
        println!("{:<35} {:<10}", table_name, status);
        
        if !exists {
            missing_tables.push(table_name);
        }
    }

    // 3. Vérifier les types ENUM nécessaires
    println!("\n📊 3. Types ENUM nécessaires:");
    println!("{}", "=".repeat(80));
    
    let enum_types = vec![
        "delivery_status",
        "delivery_cancel_reason",
        "delivery_courier_status",
        "delivery_matching_status"
    ];

    println!("{:<35} {:<10}", "Type ENUM", "Status");
    println!("{}", "-".repeat(80));
    
    for enum_name in &enum_types {
        let exists: bool = sqlx::query_scalar(
            "SELECT EXISTS (
                SELECT 1 FROM pg_type
                WHERE typname = $1
            )"
        )
        .bind(enum_name)
        .fetch_one(&pool)
        .await?;
        
        let status = if exists { "✅ Existe" } else { "❌ Manquant" };
        println!("{:<35} {:<10}", enum_name, status);
    }

    // 4. Vérifier les tables de dépendance intermédiaires
    println!("\n📊 4. Tables de dépendance intermédiaires:");
    println!("{}", "=".repeat(80));
    
    let dependency_tables = vec![
        "users", "services", "live_sessions", 
        "parcel_types", "couriers", "delivery_parcels", "delivery_zones"
    ];

    println!("{:<35} {:<10}", "Table", "Status");
    println!("{}", "-".repeat(80));
    
    for table_name in &dependency_tables {
        let exists: bool = sqlx::query_scalar(
            "SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = $1
            )"
        )
        .bind(table_name)
        .fetch_one(&pool)
        .await?;
        
        let status = if exists { "✅ Existe" } else { "❌ Manquante" };
        println!("{:<35} {:<10}", table_name, status);
    }

    // 5. Résumé
    println!("\n📊 5. Résumé:");
    println!("{}", "=".repeat(80));
    
    if missing_tables.is_empty() {
        println!("✅ Toutes les tables critiques existent");
    } else {
        println!("❌ {} table(s) critique(s) manquante(s):", missing_tables.len());
        for table in &missing_tables {
            println!("   - {}", table);
        }
        println!("\n💡 Solution: Appliquer la migration consolidée:");
        println!("   cargo run --bin apply_missing_tables_migration");
    }

    Ok(())
}

fn mask_password(url: &str) -> String {
    // Masquer le mot de passe dans l'URL
    if let Some(at_pos) = url.find('@') {
        if let Some(colon_pos) = url[8..].find(':') {
            let start = 8; // Après "postgresql://"
            let end = start + colon_pos + 1;
            format!("{}****{}", &url[..end], &url[at_pos..])
        } else {
            url.to_string()
        }
    } else {
        url.to_string()
    }
}

fn truncate(s: &str, max_len: usize) -> String {
    if s.len() <= max_len {
        s.to_string()
    } else {
        format!("{}...", &s[..max_len.saturating_sub(3)])
    }
}

