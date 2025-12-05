// ✅ Script Rust pour créer un compte admin (plus sûr car hash automatique)
// Usage: cargo run --bin create_admin -- --email admin@yukpomnang.com --password votre_mot_de_passe

use bcrypt::{hash, DEFAULT_COST};
use sqlx::PgPool;
use std::env;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = env::args().collect();
    
    if args.len() < 5 || args[1] != "--email" || args[3] != "--password" {
        eprintln!("Usage: cargo run --bin create_admin -- --email admin@example.com --password mot_de_passe");
        std::process::exit(1);
    }
    
    let email = &args[2];
    let password = &args[4];
    
    // Hash du mot de passe
    let password_hash = hash(password, DEFAULT_COST)?;
    
    // Connexion à la base de données
    let database_url = env::var("DATABASE_URL")
        .expect("DATABASE_URL doit être définie dans .env");
    
    let pool = PgPool::connect(&database_url).await?;
    
    // Créer ou mettre à jour l'admin
    let result = sqlx::query(
        r#"
        INSERT INTO users (email, password_hash, nom_complet, role, is_verified, created_at)
        VALUES ($1, $2, $3, 'admin', true, NOW())
        ON CONFLICT (email) 
        DO UPDATE SET 
            role = 'admin',
            password_hash = EXCLUDED.password_hash,
            is_verified = true
        RETURNING id, email, nom_complet
        "#
    )
    .bind(email)
    .bind(&password_hash)
    .bind(format!("Admin {}", email))
    .fetch_one(&pool)
    .await?;
    
    println!("✅ Admin créé/mis à jour avec succès!");
    println!("   ID: {}", result.get::<i32, _>("id"));
    println!("   Email: {}", result.get::<String, _>("email"));
    println!("   Nom: {}", result.get::<String, _>("nom_complet"));
    
    Ok(())
}

