// Script pour exécuter les scripts de diagnostic et correction AWS
// Date: 2026-01-30
use sqlx::PgPool;
use std::env;
use std::fs;

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
        match sqlx::raw_sql(cmd).execute(pool).await {
            Ok(_) => {}
            Err(e) => {
                // Ignorer certaines erreurs (déjà existant, etc.)
                let err_str = e.to_string().to_lowercase();
                if err_str.contains("already exists")
                    || err_str.contains("duplicate")
                    || err_str.contains("does not exist")
                {
                    println!("    ⚠️  Erreur ignorée (attendu): {}", e);
                } else {
                    println!("    ❌ Erreur: {}", e);
                    return Err(e);
                }
            }
        }
    }

    Ok(())
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();

    // Récupérer DATABASE_URL
    let mut database_url = env::var("DATABASE_URL")
        .map_err(|_| "DATABASE_URL doit être définie. Utilisez: export DATABASE_URL='***host:port/db'")?;

    // Ajouter sslmode=require si pas déjà présent (requis pour AWS RDS)
    if !database_url.contains("sslmode=") {
        let separator = if database_url.contains('?') { "&" } else { "?" };
        database_url.push_str(&format!("{}sslmode=require", separator));
        println!("🔧 Paramètre sslmode=require ajouté à DATABASE_URL (requis pour AWS RDS)");
    }

    println!("🔍 Connexion à la base de données AWS...");
    let pool = PgPool::connect(&database_url).await?;
    println!("✅ Connecté à la base de données AWS");

    // Chemin des scripts
    let script_dir = env::current_dir()?.join("backend").join("scripts");

    let diagnostic_script = script_dir.join("diagnostic_migrations_aws.sql");
    let fix_script = script_dir.join("fix_migrations_aws.sql");

    // Vérifier que les scripts existent
    if !diagnostic_script.exists() {
        return Err(format!("Script de diagnostic non trouvé: {:?}", diagnostic_script).into());
    }
    if !fix_script.exists() {
        return Err(format!("Script de correction non trouvé: {:?}", fix_script).into());
    }

    // ============================================================================
    // ÉTAPE 1: DIAGNOSTIC
    // ============================================================================
    println!("ÉTAPE 1: DIAGNOSTIC");
    println!("{}", "=".repeat(80));
    println!();

    println!("🔍 Exécution du script de diagnostic...");
    println!();

    let diagnostic_sql = fs::read_to_string(&diagnostic_script)?;
    match execute_multiple_sql_commands(&pool, &diagnostic_sql).await {
        Ok(_) => {
            println!("✅ Diagnostic terminé avec succès");
        }
        Err(e) => {
            println!("⚠️  Diagnostic terminé avec des erreurs: {}", e);
            println!("💡 Continuation avec le script de correction...");
        }
    }
    println!();

    // Demander confirmation avant d'appliquer les corrections
    println!("{}", "=".repeat(80));
    println!("⚠️  ATTENTION: Le script de correction va modifier la base de données");
    println!("{}", "=".repeat(80));
    println!();

    // Vérifier si AUTO_CONFIRM est défini
    let auto_confirm = env::var("AUTO_CONFIRM").unwrap_or_default() == "true";

    if !auto_confirm {
        use std::io::{self, Write};
        print!("Voulez-vous continuer avec le script de correction? (O/N): ");
        io::stdout().flush()?;
        let mut input = String::new();
        io::stdin().read_line(&mut input)?;

        if input.trim().to_lowercase() != "o" && input.trim().to_lowercase() != "y" {
            println!();
            println!("❌ Opération annulée par l'utilisateur");
            return Ok(());
        }
    } else {
        println!("Auto-confirmation activée, continuation automatique...");
    }
    println!();

    // ============================================================================
    // ÉTAPE 2: CORRECTION
    // ============================================================================
    println!("ÉTAPE 2: CORRECTION");
    println!("{}", "=".repeat(80));
    println!();

    println!("🔧 Exécution du script de correction...");
    println!();

    let fix_sql = fs::read_to_string(&fix_script)?;
    match execute_multiple_sql_commands(&pool, &fix_sql).await {
        Ok(_) => {
            println!("✅ Correction terminée avec succès");
        }
        Err(e) => {
            println!("❌ Correction terminée avec des erreurs: {}", e);
            return Err(e.into());
        }
    }
    println!();

    // ============================================================================
    // ÉTAPE 3: VÉRIFICATION FINALE
    // ============================================================================
    println!("ÉTAPE 3: VÉRIFICATION FINALE");
    println!("{}", "=".repeat(80));
    println!();

    println!("🔍 Exécution du diagnostic final...");
    println!();

    match execute_multiple_sql_commands(&pool, &diagnostic_sql).await {
        Ok(_) => {
            println!("✅ Vérification finale terminée");
        }
        Err(e) => {
            println!("⚠️  Vérification finale terminée avec des erreurs: {}", e);
        }
    }
    println!();

    println!("{}", "=".repeat(80));
    println!("✅ PROCESSUS TERMINÉ");
    println!("{}", "=".repeat(80));
    println!();
    println!("📋 Prochaines étapes:");
    println!("   1. Examiner les résultats ci-dessus");
    println!("   2. Vérifier les logs de l'application");
    println!("   3. Tester les fonctionnalités critiques");
    println!();

    Ok(())
}
