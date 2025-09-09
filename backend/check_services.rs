use sqlx::postgres::PgPoolOptions;
use std::env;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Récupérer l'URL de la base de données depuis les variables d'environnement
    let database_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres:postgres@localhost:5432/yukpo_db".to_string());

    println!("🔍 Connexion à la base de données...");
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await?;

    println!("✅ Connexion réussie !");
    println!("\n📊 Vérification des services...\n");

    // Vérifier les services spécifiques mentionnés dans les logs
    let service_ids = vec![531974, 862419, 20977, 518829, 939282, 742692, 27];
    
    for service_id in service_ids {
        let row = sqlx::query!(
            "SELECT id, is_active, created_at, user_id FROM services WHERE id = $1",
            service_id
        )
        .fetch_optional(&pool)
        .await?;

        match row {
            Some(service) => {
                println!("✅ Service {}: ACTIF={}, User={}, Créé={}", 
                    service.id, 
                    service.is_active, 
                    service.user_id,
                    service.created_at
                );
            },
            None => {
                println!("❌ Service {}: N'EXISTE PAS", service_id);
            }
        }
    }

    println!("\n📈 Statistiques générales:");
    
    // Compter tous les services
    let total_count = sqlx::query!("SELECT COUNT(*) as count FROM services")
        .fetch_one(&pool)
        .await?;
    println!("   Total des services: {}", total_count.count.unwrap_or(0));

    // Compter les services actifs
    let active_count = sqlx::query!("SELECT COUNT(*) as count FROM services WHERE is_active = true")
        .fetch_one(&pool)
        .await?;
    println!("   Services actifs: {}", active_count.count.unwrap_or(0));

    // Compter les services inactifs
    let inactive_count = sqlx::query!("SELECT COUNT(*) as count FROM services WHERE is_active = false")
        .fetch_one(&pool)
        .await?;
    println!("   Services inactifs: {}", inactive_count.count.unwrap_or(0));

    // Afficher les 10 derniers services créés
    println!("\n🕒 10 derniers services créés:");
    let recent_services = sqlx::query!(
        "SELECT id, is_active, created_at, user_id FROM services ORDER BY created_at DESC LIMIT 10"
    )
    .fetch_all(&pool)
    .await?;

    for service in recent_services {
        println!("   ID={}, ACTIF={}, User={}, Créé={}", 
            service.id, 
            service.is_active, 
            service.user_id,
            service.created_at
        );
    }

    Ok(())
} 