// Programme temporaire pour appliquer la migration fix_product_creation_timeout
use dotenvy::dotenv;
use sqlx::postgres::PgPoolOptions;
use std::env;
use yukpomnang_backend::migrations::auto_migrate::ensure_fix_product_creation_timeout;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenv().ok();
    yukpomnang_backend::init_logging();

    let mut db_url = env::var("DATABASE_URL")
        .map_err(|e| {
            eprintln!("❌ DATABASE_URL manquante: {}", e);
            Box::new(e) as Box<dyn std::error::Error>
        })?;

    // Ajouter sslmode=require si nécessaire
    if !db_url.contains("sslmode=") {
        let separator = if db_url.contains('?') { "&" } else { "?" };
        db_url.push_str(&format!("{}sslmode=require", separator));
    }

    println!("🔌 Connexion à la base de données...");
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&db_url)
        .await?;

    println!("✅ Connexion réussie");
    println!("🔧 Application de la migration fix_product_creation_timeout...");

    match ensure_fix_product_creation_timeout(&pool).await {
        Ok(_) => {
            println!("✅ Migration appliquée avec succès!");
            Ok(())
        }
        Err(e) => {
            eprintln!("❌ Erreur lors de l'application de la migration: {}", e);
            Err(Box::new(e) as Box<dyn std::error::Error>)
        }
    }
}

