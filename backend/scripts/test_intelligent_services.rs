// Script de test pour le système intelligent de gestion des services
// Usage: cargo run --bin test_intelligent_services

use sqlx::PgPool;
use tokio;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialiser le logger
    env_logger::init();
    
    // Connexion à la base de données
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgresql://postgres:password@localhost/yukpomnang".to_string());
    
    let pool = PgPool::connect(&database_url).await?;
    
    println!("🧠 Test du système intelligent de gestion des services");
    println!("==================================================");
    
    // 1. Vérifier les services en attente de traitement
    println!("\n📊 Services en attente de traitement:");
    let pending_stats = get_pending_services_stats(&pool).await?;
    println!("  - Services non tarissables expirés: {}", pending_stats.expired_non_tarissable);
    println!("  - Services tarissables à traiter: {}", pending_stats.tarissable_to_process);
    println!("  - Utilisateurs avec solde insuffisant: {}", pending_stats.users_insufficient_balance);
    
    // 2. Exécuter le traitement intelligent
    println!("\n🚀 Exécution du traitement intelligent...");
    let result = yukpomnang::services::intelligent_service_manager::process_expired_services_intelligently(&pool).await?;
    
    println!("✅ Résultats du traitement:");
    println!("  - Services renouvelés automatiquement: {}", result.auto_renewed);
    println!("  - Services désactivés (solde insuffisant): {}", result.manually_deactivated);
    println!("  - Services tarissables désactivés: {}", result.tarissable_deactivated);
    println!("  - Total débité: {} FCFA", result.total_debited);
    println!("  - Erreurs: {}", result.errors);
    
    // 3. Vérifier les logs des actions
    println!("\n📝 Dernières actions loggées:");
    let recent_logs = get_recent_service_logs(&pool).await?;
    for log in recent_logs {
        println!("  - Service {}: {} - {}", log.service_id, log.action, log.reason);
    }
    
    println!("\n🎉 Test terminé avec succès!");
    Ok(())
}

#[derive(Debug)]
struct PendingStats {
    expired_non_tarissable: i64,
    tarissable_to_process: i64,
    users_insufficient_balance: i64,
}

#[derive(Debug)]
struct ServiceLog {
    service_id: i32,
    action: String,
    reason: String,
}

async fn get_pending_services_stats(pool: &PgPool) -> Result<PendingStats, sqlx::Error> {
    let now = chrono::Utc::now();
    
    // Services non tarissables expirés
    let expired_non_tarissable = sqlx::query!(
        r#"
        SELECT COUNT(*) as count
        FROM services s
        WHERE s.is_active = TRUE
          AND s.is_tarissable = FALSE
          AND s.auto_deactivate_at IS NOT NULL
          AND s.auto_deactivate_at < $1
        "#,
        now
    )
    .fetch_one(pool)
    .await?
    .count.unwrap_or(0);

    // Services tarissables à traiter
    let tarissable_to_process = sqlx::query!(
        r#"
        SELECT COUNT(*) as count
        FROM services s
        WHERE s.is_active = TRUE
          AND s.is_tarissable = TRUE
          AND s.vitesse_tarissement IS NOT NULL
        "#,
    )
    .fetch_one(pool)
    .await?
    .count.unwrap_or(0);

    // Utilisateurs avec solde insuffisant
    let users_insufficient_balance = sqlx::query!(
        r#"
        SELECT COUNT(DISTINCT u.id) as count
        FROM users u
        JOIN services s ON s.user_id = u.id
        WHERE s.is_active = TRUE
          AND s.is_tarissable = FALSE
          AND s.auto_deactivate_at IS NOT NULL
          AND s.auto_deactivate_at < $1
          AND u.tokens_balance < 1000
        "#,
        now
    )
    .fetch_one(pool)
    .await?
    .count.unwrap_or(0);

    Ok(PendingStats {
        expired_non_tarissable,
        tarissable_to_process,
        users_insufficient_balance,
    })
}

async fn get_recent_service_logs(pool: &PgPool) -> Result<Vec<ServiceLog>, sqlx::Error> {
    let logs = sqlx::query!(
        r#"
        SELECT service_id, action, reason
        FROM service_logs
        WHERE created_at > NOW() - INTERVAL '1 hour'
        ORDER BY created_at DESC
        LIMIT 10
        "#,
    )
    .fetch_all(pool)
    .await?;

    Ok(logs.into_iter().map(|log| ServiceLog {
        service_id: log.service_id,
        action: log.action,
        reason: log.reason,
    }).collect())
}
