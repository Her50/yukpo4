// Script pour créer ou mettre à jour l'utilisateur super admin
// Usage: cargo run --bin create_admin_user

use sqlx::postgres::PgPoolOptions;
use std::env;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL doit être défini dans .env");

    let pool = PgPoolOptions::new().max_connections(5).connect(&database_url).await?;

    let admin_email = "admin@yukpo.dev";
    let admin_name = "Super Super Admin";
    // Hash pour le mot de passe: Hernandez87
    let password_hash = "$2b$12$yi.th1fxm9Xrz6A.PjP9wuWyDrueHMZZBReIH7i7X.efPhGNV1Pii";

    println!("Vérification si l'utilisateur super admin existe déjà...");

    // Vérifier si l'utilisateur existe
    let user_exists: bool =
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)")
            .bind(admin_email)
            .fetch_one(&pool)
            .await?;

    if user_exists {
        println!("✅ L'utilisateur super admin existe déjà. Mise à jour...");
        sqlx::query(
            r#"
            UPDATE users 
            SET 
                password_hash = $1,
                role = 'super_admin',
                nom_complet = $2,
                updated_at = NOW()
            WHERE email = $3
            "#,
        )
        .bind(password_hash)
        .bind(admin_name)
        .bind(admin_email)
        .execute(&pool)
        .await?;
        println!("✅ Utilisateur super admin mis à jour avec succès!");
    } else {
        println!("Création de l'utilisateur super admin...");
        sqlx::query(
            r#"
            INSERT INTO users (
                email, 
                password_hash, 
                role, 
                nom_complet, 
                tokens_balance, 
                token_price_user, 
                token_price_provider, 
                commission_pct, 
                preferred_lang, 
                is_provider, 
                created_at, 
                updated_at
            )
            VALUES (
                $1, $2, 'super_admin', $3, 1000000, 1.0, 1.0, 0.0, 'fr', false, NOW(), NOW()
            )
            "#,
        )
        .bind(admin_email)
        .bind(password_hash)
        .bind(admin_name)
        .execute(&pool)
        .await?;
        println!("✅ Utilisateur super admin créé avec succès!");
    }

    // Afficher l'utilisateur créé
    #[derive(sqlx::FromRow)]
    struct UserInfo {
        id: i32,
        email: String,
        role: String,
        nom_complet: Option<String>,
        tokens_balance: i64,
        created_at: chrono::DateTime<chrono::Utc>,
    }

    let user = sqlx::query_as::<_, UserInfo>(
        "SELECT id, email, role, nom_complet, tokens_balance, created_at 
         FROM users 
         WHERE email = $1",
    )
    .bind(admin_email)
    .fetch_one(&pool)
    .await?;

    println!("\n=== Informations de l'utilisateur admin ===");
    println!("ID: {}", user.id);
    println!("Email: {}", user.email);
    println!("Role: {}", user.role);
    println!(
        "Nom complet: {}",
        user.nom_complet.as_deref().unwrap_or("N/A")
    );
    println!("Tokens: {}", user.tokens_balance);
    println!("Créé le: {}", user.created_at);
    println!("\n=== Identifiants de connexion ===");
    println!("Email: {}", admin_email);
    println!("Mot de passe: Hernandez87");
    println!("Rôle: super_admin (tous les droits)");

    Ok(())
}
