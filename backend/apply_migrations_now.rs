// Script pour appliquer les migrations 2025-01-01 directement
use sqlx::PgPool;
use std::env;

// Fonction pour diviser et exécuter plusieurs commandes SQL
async fn execute_multiple_sql_commands(pool: &PgPool, sql: &str) -> Result<(), sqlx::Error> {
    // Diviser par ';' mais garder les blocs $$...$$
    let mut commands = Vec::new();
    let mut current = String::new();
    let mut in_dollar_quote = false;
    let mut dollar_tag = String::new();
    
    for line in sql.lines() {
        let trimmed = line.trim();
        
        // Détecter les blocs $$...$$
        if trimmed.contains("$$") {
            if !in_dollar_quote {
                // Début d'un bloc $$
                if let Some(tag) = trimmed.split("$$").nth(1) {
                    dollar_tag = format!("$${}", tag);
                    in_dollar_quote = true;
                } else {
                    dollar_tag = "$$".to_string();
                    in_dollar_quote = true;
                }
            } else {
                // Fin d'un bloc $$
                if trimmed.contains(&dollar_tag) {
                    in_dollar_quote = false;
                    dollar_tag.clear();
                }
            }
        }
        
        current.push_str(line);
        current.push('\n');
        
        // Si on n'est pas dans un bloc $$ et qu'on trouve un ';', c'est une commande complète
        if !in_dollar_quote && trimmed.ends_with(';') {
            let cmd = current.trim().to_string();
            if !cmd.is_empty() && !cmd.starts_with("--") {
                commands.push(cmd);
            }
            current.clear();
        }
    }
    
    // Ajouter la dernière commande si elle existe
    if !current.trim().is_empty() {
        commands.push(current.trim().to_string());
    }
    
    // Exécuter chaque commande
    for (i, cmd) in commands.iter().enumerate() {
        if cmd.trim().is_empty() || cmd.trim().starts_with("--") {
            continue;
        }
        println!("  Exécution commande {}...", i + 1);
        sqlx::raw_sql(cmd).execute(pool).await?;
    }
    
    Ok(())
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenv::dotenv().ok();
    
    let database_url = env::var("DATABASE_URL")
        .expect("DATABASE_URL doit être définie");
    
    println!("🔍 Connexion à la base de données...");
    let pool = PgPool::connect(&database_url).await?;
    println!("✅ Connecté à la base de données");
    
    // Migration 1: Aligner search_services_gps_final
    println!("\n🔧 Application migration 1: Alignement search_services_gps_final...");
    let migration1 = include_str!("../migrations/20250101_ALIGN_SEARCH_GPS_FINAL_WITH_KEYWORD_SEARCH.sql");
    execute_multiple_sql_commands(&pool, migration1).await?;
    println!("✅ Migration 1 appliquée");
    
    // Migration 2: Optimiser hybrid_image_search
    println!("\n🔧 Application migration 2: Optimisation hybrid_image_search...");
    let migration2 = include_str!("../migrations/20250101_OPTIMIZE_HYBRID_IMAGE_SEARCH_WITH_UNACCENT_SIMILARITY.sql");
    execute_multiple_sql_commands(&pool, migration2).await?;
    println!("✅ Migration 2 appliquée");
    
    println!("\n✅ Toutes les migrations ont été appliquées avec succès!");
    Ok(())
}

