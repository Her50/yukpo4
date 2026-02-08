// Script pour appliquer la migration consolidée des tables manquantes dans AWS
// Usage: cargo run --bin apply_missing_tables_aws
// Ou sur AWS ECS: cargo run --bin apply_missing_tables_aws

use sqlx::PgPool;
use std::env;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();

    let mut database_url = env::var("DATABASE_URL")
        .expect("DATABASE_URL doit être définie dans les variables d'environnement");

    // ✅ Ajouter sslmode=require pour AWS RDS PostgreSQL si nécessaire
    if !database_url.contains("sslmode=") {
        let separator = if database_url.contains('?') { "&" } else { "?" };
        database_url.push_str(&format!("{}sslmode=require", separator));
        println!("🔧 Paramètre sslmode=require ajouté à DATABASE_URL");
    }

    println!("🔧 Application de la migration consolidée pour créer les tables manquantes...");
    println!("📊 Connexion à la base de données...");

    let pool = PgPool::connect(&database_url).await?;
    println!("✅ Connexion établie");

    // Lire et exécuter la migration SQL consolidée
    println!(
        "🔄 Application de la migration SQL consolidée (20260129_create_missing_tables_aws.sql)..."
    );
    // ✅ CORRECTION: Chemin relatif depuis src/bin/ vers migrations/ (remonter de 2 niveaux)
    let migration_sql = include_str!("../../migrations/20260129_create_missing_tables_aws.sql");

    // ✅ Utiliser execute_migration_sql_safe pour gérer les blocs DO $$
    use yukpomnang_backend::migrations::auto_migrate::execute_migration_sql_safe;

    match execute_migration_sql_safe(&pool, migration_sql).await {
        Ok(_) => {
            println!("✅ Migration SQL consolidée appliquée avec succès");
        }
        Err(e) => {
            println!(
                "⚠️ Erreur lors de l'application (certaines tables peuvent déjà exister): {}",
                e
            );
            // Ne pas échouer complètement, certaines tables peuvent déjà exister
        }
    }

    // Vérification finale des tables critiques
    println!("\n🔍 Vérification des tables critiques après migration...");

    let critical_tables = vec![
        "users",
        "services",
        "deliveries",
        "product_creation_queue",
        "delivery_matching_queue",
        "global_promo_events",
        "live_flash_sales",
        "social_publication_jobs",
        "video_generation_jobs",
        "product_orders",
        "delivery_proximity_suggestions",
    ];

    let mut missing_tables = Vec::new();
    for table in &critical_tables {
        let exists: bool = sqlx::query_scalar(
            "SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = $1
            )",
        )
        .bind(table)
        .fetch_one(&pool)
        .await
        .unwrap_or(false);

        if exists {
            println!("  ✅ Table '{}' existe", table);
        } else {
            println!("  ❌ Table '{}' MANQUANTE", table);
            missing_tables.push(table);
        }
    }

    if missing_tables.is_empty() {
        println!("\n✅ Toutes les tables critiques existent !");
    } else {
        println!(
            "\n⚠️ {} tables critiques manquent encore:",
            missing_tables.len()
        );
        for table in &missing_tables {
            println!("   - {}", table);
        }
        println!(
            "\n💡 Vérifiez les logs pour comprendre pourquoi ces tables n'ont pas été créées."
        );
    }

    Ok(())
}
