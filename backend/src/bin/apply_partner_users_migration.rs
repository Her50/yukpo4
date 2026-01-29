// Script pour appliquer la migration des colonnes partner_status et partner_type à la table users
use sqlx::PgPool;
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

    println!("📦 Application de la migration partner_status et partner_type pour users...");

    // Exécuter les migrations une par une
    let steps = vec![
        (
            "Ajouter colonne partner_type",
            r#"
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'users' AND column_name = 'partner_type'
                ) THEN
                    ALTER TABLE users ADD COLUMN partner_type VARCHAR(50);
                END IF;
            END
            $$;
            "#,
        ),
        (
            "Ajouter colonne partner_status",
            r#"
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'users' AND column_name = 'partner_status'
                ) THEN
                    ALTER TABLE users ADD COLUMN partner_status VARCHAR(50) DEFAULT NULL;
                END IF;
            END
            $$;
            "#,
        ),
        (
            "Créer index partner_type",
            "CREATE INDEX IF NOT EXISTS idx_users_partner_type ON users(partner_type) WHERE partner_type IS NOT NULL;",
        ),
        (
            "Créer index partner_status",
            "CREATE INDEX IF NOT EXISTS idx_users_partner_status ON users(partner_status) WHERE partner_status IS NOT NULL;",
        ),
    ];

    for (step_name, sql) in steps {
        println!("🔄 Exécution: {}...", step_name);
        match sqlx::query(sql).execute(&pool).await {
            Ok(_) => {
                println!("✅ {} - OK", step_name);
            }
            Err(e) => {
                let error_msg = e.to_string();
                // Ignorer les erreurs "already exists" qui sont normales
                if error_msg.contains("already exists")
                    || error_msg.contains("duplicate")
                    || error_msg.contains("does not exist")
                {
                    println!("ℹ️  {} - Déjà appliqué", step_name);
                } else {
                    eprintln!("❌ Erreur lors de {}:", step_name);
                    eprintln!("   {}", error_msg);
                    return Err(e.into());
                }
            }
        }
    }

    println!("✅ Migration terminée!");

    Ok(())
}
