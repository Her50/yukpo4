use sqlx::PgPool;
use log::{info, error, warn};
use crate::services::intelligent_service_manager::process_expired_services_intelligently;

/// 🧠 Tâche périodique pour le système intelligent de gestion des services
/// Exécute le traitement intelligent des services expirés
pub async fn run_intelligent_service_processing(pool: &PgPool) {
    info!("🧠 Démarrage du traitement intelligent des services...");
    
    match process_expired_services_intelligently(pool).await {
        Ok(result) => {
            if result.auto_renewed > 0 || result.manually_deactivated > 0 || result.tarissable_deactivated > 0 {
                info!("🎯 Traitement intelligent terminé:");
                info!("  ✅ Services renouvelés automatiquement: {}", result.auto_renewed);
                info!("  ❌ Services désactivés (solde insuffisant): {}", result.manually_deactivated);
                info!("  🍎 Services tarissables désactivés: {}", result.tarissable_deactivated);
                info!("  💰 Total débité: {} FCFA", result.total_debited);
                
                if result.errors > 0 {
                    warn!("  ⚠️ Erreurs rencontrées: {}", result.errors);
                }
            } else {
                info!("✅ Aucun service à traiter pour le moment");
            }
        }
        Err(e) => {
            error!("❌ Erreur lors du traitement intelligent des services: {}", e);
        }
    }
}

/// 🔄 Tâche périodique complète qui inclut l'ancien système et le nouveau système intelligent
pub async fn run_complete_service_processing(pool: &PgPool) {
    info!("🚀 Démarrage du traitement complet des services...");
    
    // 1. Exécuter le système intelligent (priorité)
    run_intelligent_service_processing(pool).await;
    
    // 2. Exécuter l'ancien système pour les services tarissables (fallback)
    match crate::tasks::service_deactivation::desactiver_services_tarissables(pool).await {
        Ok(_) => info!("✅ Traitement des services tarissables terminé"),
        Err(e) => error!("❌ Erreur traitement services tarissables: {}", e),
    }
    
    // 3. Envoyer les alertes aux prestataires
    match crate::tasks::service_deactivation::envoyer_alertes_prestataires(pool).await {
        Ok(_) => info!("✅ Envoi des alertes terminé"),
        Err(e) => error!("❌ Erreur envoi alertes: {}", e),
    }
    
    info!("🎉 Traitement complet des services terminé");
}

