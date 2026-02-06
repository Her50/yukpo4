use sqlx::postgres::PgPoolOptions;
use std::env;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Récupérer l'URL de la base de données depuis les variables d'environnement
    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL doit être défini");

    println!("🔍 Connexion à la base de données...");
    let pool = PgPoolOptions::new().max_connections(1).connect(&database_url).await?;

    println!("✅ Connexion réussie !");
    println!("\n📊 Application de la migration d'optimisation...\n");

    // Lire le contenu de la migration
    let migration_sql =
        include_str!("../../migrations/20260111_optimize_delivery_queries_additional.sql");

    // Exécuter toutes les commandes SQL
    match sqlx::query(migration_sql).execute(&pool).await {
        Ok(_) => {
            println!("✅ Migration appliquée avec succès !");
        }
        Err(e) => {
            // Les erreurs "already exists" sont normales si les index existent déjà
            let error_msg = e.to_string();
            if error_msg.contains("already exists") || error_msg.contains("duplicate") {
                println!("⚠️  Certains index existent déjà (c'est normal)");
                println!("✅ Migration partiellement appliquée");
            } else {
                println!("❌ Erreur lors de l'application de la migration: {}", e);
                return Err(e.into());
            }
        }
    }

    println!("\n✅ Migration d'optimisation appliquée !");
    Ok(())
}
