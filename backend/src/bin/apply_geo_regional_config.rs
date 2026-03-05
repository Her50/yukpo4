// Programme pour appliquer la migration geo_regional_config directement en base
use dotenvy::dotenv;
use sqlx::postgres::PgPoolOptions;
use std::env;
use yukpomnang_backend::migrations::auto_migrate::ensure_geo_regional_config_table;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenv().ok();
    yukpomnang_backend::init_logging();

    let mut db_url = env::var("DATABASE_URL").map_err(|e| {
        eprintln!("❌ DATABASE_URL manquante: {}", e);
        Box::new(e) as Box<dyn std::error::Error>
    })?;

    // Ajouter sslmode=require si nécessaire
    if !db_url.contains("sslmode=") {
        let separator = if db_url.contains('?') { "&" } else { "?" };
        db_url.push_str(&format!("{}sslmode=require", separator));
    }

    println!("🔌 Connexion à la base de données...");
    let pool = PgPoolOptions::new().max_connections(5).connect(&db_url).await?;

    println!("✅ Connexion réussie");
    println!("🌍 Application de la migration geo_regional_config...");

    match ensure_geo_regional_config_table(&pool).await {
        Ok(_) => {
            println!("✅ Table geo_regional_config créée/vérifiée avec données de seed!");

            // Vérifier le contenu
            let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM geo_regional_config")
                .fetch_one(&pool)
                .await?;
            println!("📊 {} pays configurés en base", count.0);

            Ok(())
        }
        Err(e) => {
            eprintln!("❌ Erreur lors de l'application de la migration: {}", e);
            Err(Box::new(e) as Box<dyn std::error::Error>)
        }
    }
}
