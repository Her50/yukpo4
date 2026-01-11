use sqlx::postgres::PgPoolOptions;
use std::env;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Récupérer l'URL de la base de données depuis les variables d'environnement
    let database_url = env::var("DATABASE_URL")
        .expect("DATABASE_URL doit être défini");

    println!("🔍 Connexion à la base de données...");
    let pool = PgPoolOptions::new()
        .max_connections(1)
        .connect(&database_url)
        .await?;

    println!("✅ Connexion réussie !");
    println!("\n📊 Application de la migration d'optimisation...\n");

    // Lire le contenu de la migration
    let migration_sql = include_str!("../migrations/20260111_optimize_delivery_queries_additional.sql");

    // Diviser en commandes SQL individuelles
    let commands: Vec<&str> = migration_sql
        .split(';')
        .map(|s| s.trim())
        .filter(|s| !s.is_empty() && !s.starts_with("--"))
        .collect();

    println!("📝 Application de {} commandes SQL...\n", commands.len());

    let mut applied = 0;
    let mut skipped = 0;

    for (i, command) in commands.iter().enumerate() {
        if command.trim().is_empty() {
            continue;
        }

        // Ajouter le point-virgule si nécessaire
        let full_command = if command.ends_with(';') {
            command.to_string()
        } else {
            format!("{};", command)
        };

        match sqlx::query(&full_command).execute(&pool).await {
            Ok(_) => {
                applied += 1;
                println!("✅ Commande {} appliquée", i + 1);
            }
            Err(e) => {
                // Ignorer les erreurs "already exists" pour les index
                let error_msg = e.to_string();
                if error_msg.contains("already exists") || error_msg.contains("duplicate") {
                    skipped += 1;
                    println!("⏭️  Commande {} déjà appliquée (ignorée)", i + 1);
                } else {
                    println!("❌ Erreur à la commande {}: {}", i + 1, e);
                    return Err(e.into());
                }
            }
        }
    }

    println!("\n📊 Résumé:");
    println!("   ✅ Appliquées: {}", applied);
    println!("   ⏭️  Ignorées (déjà existantes): {}", skipped);
    println!("   📈 Total: {}\n", applied + skipped);

    println!("✅ Migration d'optimisation appliquée avec succès !");
    Ok(())
}

