/**
 * Script pour exécuter les migrations directement sur la base de données
 * Même si elles sont déjà dans auto_migrate, ce script les exécute directement
 */
use sqlx::postgres::PgPoolOptions;
use std::fs;
use std::path::Path;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // URL de connexion à la base de données
    let database_url = "postgresql://yukpo_db_user:88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4@dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com/yukpo_db";

    println!("🔧 Connexion à la base de données...");
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(database_url)
        .await?;

    println!("✅ Connecté à la base de données");

    // Liste des migrations à exécuter dans l'ordre
    let migrations = vec![
        "migrations/20250128_002_add_pharmacy_products.sql",
        "migrations/20250127_create_pharmacy_advanced_tables.sql",
        "migrations/20250128_create_search_history_and_saved_searches.sql",
        "migrations/20250127_create_bourse_livre_advanced_tables.sql",
        "migrations/20250127_create_orientation_scolaire_advanced_tables.sql",
        "migrations/20250127_create_offres_emploi_advanced_tables.sql",
    ];

    for migration_path in migrations {
        let full_path = Path::new(migration_path);
        if !full_path.exists() {
            println!("⚠️ Fichier non trouvé: {}", migration_path);
            continue;
        }

        println!("📝 Exécution de {}...", migration_path);

        // Lire le contenu du fichier
        let sql_content = fs::read_to_string(full_path)?;

        // Diviser en commandes SQL individuelles et exécuter
        let commands = split_sql_commands(&sql_content);

        for (i, cmd) in commands.iter().enumerate() {
            let trimmed = cmd.trim();
            if trimmed.is_empty() || trimmed.starts_with("--") {
                continue;
            }

            match sqlx::query(trimmed).execute(&pool).await {
                Ok(_) => {
                    if i == 0 {
                        println!("  ✅ Commande exécutée");
                    }
                }
                Err(e) => {
                    let error_str = e.to_string();
                    // Ignorer les erreurs de "already exists" car c'est normal
                    if error_str.contains("already exists")
                        || error_str.contains("duplicate key")
                        || error_str.contains("relation already exists")
                    {
                        println!(
                            "  ⚠️ Déjà existant (ignoré): {}",
                            error_str.split('\n').next().unwrap_or("")
                        );
                    } else {
                        println!(
                            "  ❌ Erreur: {}",
                            error_str.split('\n').next().unwrap_or("")
                        );
                        // Continuer malgré l'erreur pour les autres migrations
                    }
                }
            }
        }

        println!("✅ {} exécutée", migration_path);
    }

    println!("✅ Toutes les migrations ont été exécutées");
    Ok(())
}

/// Divise le SQL en commandes individuelles en gérant les blocs $$...$$
fn split_sql_commands(sql: &str) -> Vec<String> {
    let mut commands = Vec::new();
    let mut current = String::new();
    let mut in_dollar_block = false;
    let mut dollar_tag = String::new();

    for line in sql.lines() {
        let trimmed = line.trim();

        // Ignorer les lignes vides et commentaires seuls
        if trimmed.is_empty() || trimmed.starts_with("--") {
            if !in_dollar_block {
                continue;
            }
        }

        // Détecter début d'un bloc avec $$
        if trimmed.contains("$$") && !in_dollar_block {
            if let Some(start) = trimmed.find("$$") {
                let tag_end = trimmed[start + 2..].find("$$");
                if tag_end.is_some() {
                    dollar_tag = "$$".to_string();
                    in_dollar_block = true;
                } else {
                    let tag_start = trimmed[..start].rfind('$');
                    if let Some(ts) = tag_start {
                        dollar_tag = trimmed[ts..=start + 1].to_string();
                        in_dollar_block = true;
                    } else {
                        dollar_tag = "$$".to_string();
                        in_dollar_block = true;
                    }
                }
            }
        }

        current.push_str(line);
        current.push_str("\n");

        // Détecter fin du bloc $$
        if in_dollar_block {
            if trimmed.contains(&dollar_tag) {
                let dollar_pos = trimmed.find(&dollar_tag);
                if let Some(pos) = dollar_pos {
                    let after_dollar: &str = trimmed[pos + dollar_tag.len()..].trim();

                    if after_dollar.starts_with("LANGUAGE") {
                        if trimmed.ends_with(';') {
                            commands.push(current.trim().to_string());
                            current.clear();
                            in_dollar_block = false;
                            dollar_tag.clear();
                            continue;
                        }
                    } else if trimmed.contains("END")
                        && trimmed.ends_with(&format!("{};", dollar_tag))
                    {
                        commands.push(current.trim().to_string());
                        current.clear();
                        in_dollar_block = false;
                        dollar_tag.clear();
                        continue;
                    } else if (after_dollar.is_empty() || after_dollar == ";")
                        && trimmed.ends_with(';')
                    {
                        commands.push(current.trim().to_string());
                        current.clear();
                        in_dollar_block = false;
                        dollar_tag.clear();
                        continue;
                    }
                }
            }
        } else {
            // Hors bloc $$, diviser par point-virgule
            if trimmed.ends_with(';') {
                commands.push(current.trim().to_string());
                current.clear();
            }
        }
    }

    // Ajouter la dernière commande si elle existe
    if !current.trim().is_empty() {
        commands.push(current.trim().to_string());
    }

    commands
}
