// ✅ Tâche cron pour générer et activer les trajets récurrents
// Date: 2025-01-29
// Usage: Peut être exécuté périodiquement (cron, scheduler, etc.)

use crate::core::types::AppResult;
use crate::services::recurring_trips_service::RecurringTripsService;
use log::{error, info};
use sqlx::PgPool;
use std::sync::Arc;

pub struct RecurringTripsCron {
    pool: Arc<PgPool>,
}

impl RecurringTripsCron {
    pub fn new(pool: Arc<PgPool>) -> Self {
        Self { pool }
    }

    /// Génère les instances récurrentes pour les N prochains jours
    pub async fn generate_instances(&self, days_ahead: i32) -> AppResult<usize> {
        info!(
            "[RecurringTripsCron] 🚀 Démarrage génération instances récurrentes ({} jours)",
            days_ahead
        );

        let service = RecurringTripsService::new((*self.pool).clone());

        match service.generate_recurring_instances(days_ahead).await {
            Ok(count) => {
                info!(
                    "[RecurringTripsCron] ✅ {} instances générées avec succès",
                    count
                );
                Ok(count)
            }
            Err(e) => {
                error!("[RecurringTripsCron] ❌ Erreur génération instances: {}", e);
                Err(e)
            }
        }
    }

    /// Active les instances en attente (crée les trajets réels)
    pub async fn activate_instances(&self, days_ahead: i32) -> AppResult<usize> {
        info!(
            "[RecurringTripsCron] 🚀 Démarrage activation instances en attente ({} jours)",
            days_ahead
        );

        let service = RecurringTripsService::new((*self.pool).clone());

        match service.activate_pending_instances(days_ahead).await {
            Ok(count) => {
                info!(
                    "[RecurringTripsCron] ✅ {} instances activées avec succès",
                    count
                );
                Ok(count)
            }
            Err(e) => {
                error!("[RecurringTripsCron] ❌ Erreur activation instances: {}", e);
                Err(e)
            }
        }
    }

    /// Exécute les deux tâches (génération + activation)
    pub async fn run_full_cycle(
        &self,
        generate_days: i32,
        activate_days: i32,
    ) -> AppResult<(usize, usize)> {
        info!(
            "[RecurringTripsCron] 🔄 Démarrage cycle complet (génération: {}j, activation: {}j)",
            generate_days, activate_days
        );

        let generated = self.generate_instances(generate_days).await?;
        let activated = self.activate_instances(activate_days).await?;

        info!(
            "[RecurringTripsCron] ✅ Cycle complet terminé: {} générées, {} activées",
            generated, activated
        );
        Ok((generated, activated))
    }
}

/// Fonction helper pour exécuter depuis un script standalone
pub async fn run_recurring_trips_cron(
    pool: Arc<PgPool>,
    action: &str,
    days_ahead: Option<i32>,
) -> AppResult<()> {
    let cron = RecurringTripsCron::new(pool);

    match action {
        "generate" => {
            let days = days_ahead.unwrap_or(30);
            cron.generate_instances(days).await?;
        }
        "activate" => {
            let days = days_ahead.unwrap_or(7);
            cron.activate_instances(days).await?;
        }
        "full" => {
            let gen_days = days_ahead.unwrap_or(30);
            let act_days = days_ahead.unwrap_or(7);
            cron.run_full_cycle(gen_days, act_days).await?;
        }
        _ => {
            return Err(crate::core::types::AppError::BadRequest(format!(
                "Action inconnue: {}. Utilisez 'generate', 'activate' ou 'full'",
                action
            )));
        }
    }

    Ok(())
}
