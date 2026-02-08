use sqlx::{PgPool, PgPoolOptions};
use std::env;
use std::fs;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Récupérer DATABASE_URL
    let mut db_url = env::var("DATABASE_URL").map_err(|e| {
        eprintln!("❌ DATABASE_URL manquante: {}", e);
        eprintln!("   Définissez-la avec: $env:DATABASE_URL = 'postgresql://...'");
        e
    })?;

    // Ajouter sslmode=require si nécessaire pour AWS RDS
    if !db_url.contains("sslmode=") {
        let separator = if db_url.contains('?') { "&" } else { "?" };
        db_url.push_str(&format!("{}sslmode=require", separator));
        println!("🔧 Paramètre sslmode=require ajouté à DATABASE_URL (requis pour AWS RDS)");
    }

    println!("🔗 Connexion à la base de données AWS RDS...");
    println!("   Host: {}", mask_password(&db_url));

    // Créer le pool de connexions
    let pool = PgPoolOptions::new().max_connections(1).connect(&db_url).await?;

    println!("✅ Connecté à la base de données");

    // Lire le fichier SQL
    let sql_file = "migrations/20260207_fix_all_missing_tables_and_functions.sql";
    println!("📄 Lecture du fichier: {}", sql_file);

    let sql_content = fs::read_to_string(sql_file)?;

    println!("🚀 Exécution du script SQL...");
    println!("   Ce script va:");
    println!("   1. Créer la table user_saved_addresses");
    println!("   2. Créer la fonction calculate_best_vector_match_score");
    println!("   3. Créer la fonction product_combination_exists");
    println!("   4. Corriger l'index unique pour services_search_optimized_v2");
    println!("");

    // Exécuter le script SQL
    sqlx::raw_sql(&sql_content).execute(&pool).await?;

    println!("✅ Script SQL exécuté avec succès!");
    println!("");
    println!("🔍 Vérification des résultats...");

    // Vérifier que la table existe
    let table_exists: bool = sqlx::query_scalar(
        "SELECT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'user_saved_addresses'
        )",
    )
    .fetch_one(&pool)
    .await?;

    if table_exists {
        println!("✅ Table user_saved_addresses créée");
    } else {
        println!("❌ Table user_saved_addresses n'existe pas");
    }

    // Vérifier les fonctions
    let func1_exists: bool = sqlx::query_scalar(
        "SELECT EXISTS (
            SELECT 1 FROM pg_proc 
            WHERE proname = 'calculate_best_vector_match_score'
        )",
    )
    .fetch_one(&pool)
    .await?;

    if func1_exists {
        println!("✅ Fonction calculate_best_vector_match_score créée");
    } else {
        println!("❌ Fonction calculate_best_vector_match_score n'existe pas");
    }

    let func2_exists: bool = sqlx::query_scalar(
        "SELECT EXISTS (
            SELECT 1 FROM pg_proc 
            WHERE proname = 'product_combination_exists'
        )",
    )
    .fetch_one(&pool)
    .await?;

    if func2_exists {
        println!("✅ Fonction product_combination_exists créée");
    } else {
        println!("❌ Fonction product_combination_exists n'existe pas");
    }

    // Vérifier l'index
    let index_exists: bool = sqlx::query_scalar(
        "SELECT EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE tablename = 'services_search_optimized_v2' 
            AND indexname = 'idx_services_search_optimized_v2_unique'
        )",
    )
    .fetch_one(&pool)
    .await?;

    if index_exists {
        println!("✅ Index unique pour services_search_optimized_v2 créé");
    } else {
        println!("⚠️ Index unique pour services_search_optimized_v2 n'existe pas (la vue peut ne pas exister)");
    }

    println!("");
    println!("🎉 Correction terminée!");

    Ok(())
}

fn mask_password(url: &str) -> String {
    if let Some(at_pos) = url.find('@') {
        if let Some(colon_pos) = url[8..].find(':') {
            let start = 8; // Après "postgresql://"
            let end = start + colon_pos + 1;
            format!("{}***{}", &url[..end], &url[at_pos..])
        } else {
            url.to_string()
        }
    } else {
        url.to_string()
    }
}
