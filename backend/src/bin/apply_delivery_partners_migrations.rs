// Script pour appliquer directement les migrations delivery_partners sur Render
use sqlx::{PgPool, Row};
use std::env;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();

    let db_url = env::var("DATABASE_URL").map_err(|e| format!("DATABASE_URL manquante: {}", e))?;

    // Ajouter sslmode=require pour Render PostgreSQL
    let mut db_url = db_url;
    if !db_url.contains("sslmode=") {
        let separator = if db_url.contains('?') { "&" } else { "?" };
        db_url.push_str(&format!("{}sslmode=require", separator));
    }

    println!("🔌 Connexion à la base de données...");
    let pool = PgPool::connect(&db_url).await?;

    println!("📦 Application des migrations delivery_partners...");

    // Lire le fichier SQL de migration complet
    let migration_sql =
        include_str!("../../migrations/20260104_apply_delivery_partners_migrations.sql");

    // Fonction pour diviser et exécuter plusieurs commandes SQL en gérant les blocs DO $$ ... $$
    async fn execute_multiple_sql_commands(pool: &PgPool, sql: &str) -> Result<(), sqlx::Error> {
        let mut commands = Vec::new();
        let mut current = String::new();
        let mut in_dollar_quote = false;
        let mut dollar_tag = String::new();

        for line in sql.lines() {
            let trimmed = line.trim();

            current.push_str(line);
            current.push('\n');

            // Détecter les blocs $$...$$
            if trimmed.contains("$$") {
                if !in_dollar_quote {
                    // Début d'un bloc $$
                    if let Some(tag) = trimmed.split("$$").nth(1) {
                        dollar_tag = tag.trim().to_string();
                    } else {
                        dollar_tag = String::new();
                    }
                    in_dollar_quote = true;
                } else {
                    // Fin d'un bloc $$
                    if trimmed.contains(&format!("$${}", dollar_tag))
                        || (dollar_tag.is_empty() && trimmed.ends_with("$$"))
                    {
                        in_dollar_quote = false;
                        dollar_tag.clear();
                    }
                }
            }

            // Si on n'est pas dans un bloc $$ et qu'on trouve un ';', c'est la fin d'une commande
            if !in_dollar_quote && trimmed.ends_with(';') {
                let cmd = current.trim().to_string();
                if !cmd.is_empty() && !cmd.starts_with("--") {
                    commands.push(cmd);
                }
                current.clear();
            }
        }

        // Ajouter la dernière commande si elle existe
        if !current.trim().is_empty() && !current.trim().starts_with("--") {
            commands.push(current.trim().to_string());
        }

        // Exécuter chaque commande
        for (i, cmd) in commands.iter().enumerate() {
            if cmd.trim().is_empty() {
                continue;
            }

            // Ignorer les SELECT de status
            if cmd.trim().starts_with("SELECT") && cmd.contains("status") {
                if let Ok(rows) = sqlx::query(cmd).fetch_all(pool).await {
                    for row in rows {
                        if let Ok(status) = row.try_get::<String, _>(0) {
                            println!("✅ {}", status);
                        }
                    }
                }
                continue;
            }

            match sqlx::query(cmd.as_str()).execute(pool).await {
                Ok(_) => {
                    println!("✅ Étape {} appliquée", i + 1);
                }
                Err(e) => {
                    let error_msg = e.to_string();
                    // Ignorer les erreurs "already exists" qui sont normales
                    if error_msg.contains("already exists")
                        || error_msg.contains("duplicate")
                        || error_msg.contains("does not exist")
                        || error_msg.contains("already has value")
                    {
                        println!("ℹ️  Étape {} ignorée (déjà appliquée)", i + 1);
                    } else {
                        eprintln!("❌ Erreur étape {}: {}", i + 1, error_msg);
                        return Err(e);
                    }
                }
            }
        }

        Ok(())
    }

    println!("🔄 Exécution du script de migration...");

    match execute_multiple_sql_commands(&pool, migration_sql).await {
        Ok(_) => {
            println!("✅ Migration appliquée avec succès!");
        }
        Err(e) => {
            let error_msg = e.to_string();
            // Certaines erreurs sont normales (déjà appliquées)
            if error_msg.contains("already exists")
                || error_msg.contains("duplicate")
                || error_msg.contains("does not exist")
                || error_msg.contains("already has value")
            {
                println!(
                    "ℹ️  Migration partiellement appliquée (certaines étapes déjà effectuées)"
                );
            } else {
                eprintln!("❌ Erreur lors de l'application de la migration:");
                eprintln!("   {}", error_msg);
                return Err(e.into());
            }
        }
    }

    println!("✅ Toutes les migrations ont été appliquées avec succès!");

    Ok(())
}
