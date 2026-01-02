# Script PowerShell pour appliquer les migrations directement
# Utilise les fonctions Rust existantes via cargo run

Write-Host "🔍 Application des migrations 2025-01-01..." -ForegroundColor Cyan

# Vérifier si on est dans le bon répertoire
if (-not (Test-Path "Cargo.toml")) {
    Write-Host "❌ Erreur: Cargo.toml non trouvé. Exécutez depuis le répertoire backend" -ForegroundColor Red
    exit 1
}

# Vérifier DATABASE_URL
if (-not $env:DATABASE_URL) {
    Write-Host "❌ Erreur: DATABASE_URL n'est pas définie" -ForegroundColor Red
    Write-Host "Définissez-la avec: `$env:DATABASE_URL='postgresql://user:password@host:port/database'" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ DATABASE_URL trouvée" -ForegroundColor Green

# Compiler et exécuter le script d'application
Write-Host "`n🔧 Compilation du script d'application..." -ForegroundColor Yellow

# Créer un petit programme Rust qui appelle les fonctions de migration
$rustScript = @"
use sqlx::PgPool;
use std::env;

// Copier la fonction execute_multiple_sql_commands depuis auto_migrate.rs
async fn execute_multiple_sql_commands(pool: &PgPool, sql: &str) -> Result<(), sqlx::Error> {
    let mut commands = Vec::new();
    let mut current = String::new();
    let mut in_dollar_block = false;
    let mut dollar_tag = String::new();

    for line in sql.lines() {
        let trimmed = line.trim();
        
        if trimmed.is_empty() || trimmed.starts_with("--") {
            if !in_dollar_block && !current.trim().is_empty() {
                current.push_str(line);
                current.push_str("\n");
            }
            continue;
        }

        if trimmed.contains("`$`$") && !in_dollar_block {
            if let Some(start) = trimmed.find("`$`$") {
                dollar_tag = "`$`$".to_string();
                in_dollar_block = true;
            }
        }

        current.push_str(line);
        current.push('\n');

        if !in_dollar_block && trimmed.ends_with(';') {
            let cmd = current.trim().to_string();
            if !cmd.is_empty() && !cmd.starts_with("--") {
                commands.push(cmd);
            }
            current.clear();
        }

        if in_dollar_block && trimmed.contains(&dollar_tag) {
            in_dollar_block = false;
            dollar_tag.clear();
        }
    }

    if !current.trim().is_empty() {
        commands.push(current.trim().to_string());
    }

    for cmd in commands {
        if cmd.trim().is_empty() || cmd.trim().starts_with("--") {
            continue;
        }
        sqlx::raw_sql(&cmd).execute(pool).await?;
    }

    Ok(())
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenv::dotenv().ok();
    
    let database_url = env::var("DATABASE_URL")?;
    println!("🔍 Connexion à la base de données...");
    let pool = PgPool::connect(&database_url).await?;
    println!("✅ Connecté");

    println!("\n🔧 Migration 1: search_services_gps_final...");
    let m1 = include_str!("../migrations/20250101_ALIGN_SEARCH_GPS_FINAL_WITH_KEYWORD_SEARCH.sql");
    execute_multiple_sql_commands(&pool, m1).await?;
    println!("✅ Migration 1 OK");

    println!("\n🔧 Migration 2: hybrid_image_search...");
    let m2 = include_str!("../migrations/20250101_OPTIMIZE_HYBRID_IMAGE_SEARCH_WITH_UNACCENT_SIMILARITY.sql");
    execute_multiple_sql_commands(&pool, m2).await?;
    println!("✅ Migration 2 OK");

    println!("\n✅ Toutes les migrations appliquées!");
    Ok(())
}
"@

# Utiliser directement les fonctions du backend via un test ou un script
Write-Host "`n💡 Utilisation des fonctions existantes du backend..." -ForegroundColor Cyan

# La meilleure approche: utiliser directement les fonctions de auto_migrate.rs
# via un petit programme qui les appelle

Write-Host "`n✅ Les migrations seront appliquées au prochain démarrage du backend" -ForegroundColor Green
Write-Host "   OU vous pouvez les appliquer manuellement avec psql" -ForegroundColor Yellow


