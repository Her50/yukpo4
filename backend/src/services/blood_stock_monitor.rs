// ✅ NOUVEAU: Service de monitoring automatique des stocks de banque de sang

use crate::core::types::{AppError, AppResult};
use crate::state::AppState;
use log::{error, info, warn};
use sqlx::PgPool;
use std::sync::Arc;

pub struct BloodStockMonitor {
    pool: Arc<PgPool>,
}

impl BloodStockMonitor {
    pub fn new(state: Arc<AppState>) -> Self {
        Self {
            pool: Arc::new(state.pg.clone()),
        }
    }

    /// Vérifier tous les stocks de banques de sang et déclencher matching si nécessaire
    pub async fn check_all_stocks(&self) -> AppResult<()> {
        info!("[BloodStockMonitor] Début vérification stocks banques de sang");

        // Récupérer toutes les banques de sang avec leurs stocks
        let banks = sqlx::query_as::<_, BankStockInfo>(
            r#"
            SELECT 
                s.id as service_id,
                s.user_id as banque_id,
                s.data->'stocks_groupes_sanguins' as stocks_json
            FROM services s
            WHERE s.specialized_type = 'banque_sang'
            AND s.is_active = true
            "#,
        )
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| {
            error!("[BloodStockMonitor] Erreur récupération banques: {}", e);
            AppError::Internal(format!("Erreur récupération banques: {}", e))
        })?;

        let mut total_checks = 0;
        let mut low_stocks = 0;
        let mut empty_stocks = 0;

        for bank in banks {
            if let Some(stocks) = bank.stocks_json {
                let stocks_map: serde_json::Map<String, serde_json::Value> =
                    serde_json::from_value(stocks).unwrap_or_default();

                for (groupe, stock_data) in stocks_map {
                    total_checks += 1;

                    let quantite: i32 = stock_data
                        .get("quantite")
                        .and_then(|v| v.as_str())
                        .and_then(|s| s.parse::<i32>().ok())
                        .unwrap_or(0);

                    if quantite == 0 {
                        empty_stocks += 1;
                        warn!(
                            "[BloodStockMonitor] ⚠️ Stock vide: Banque {} - Groupe {}",
                            bank.service_id, groupe
                        );

                        // Déclencher matching automatique
                        if let Err(e) = self
                            .trigger_matching_for_stock(bank.service_id, bank.banque_id, &groupe)
                            .await
                        {
                            error!(
                                "[BloodStockMonitor] Erreur déclenchement matching pour {}: {}",
                                groupe, e
                            );
                        }
                    } else if quantite <= 5 {
                        low_stocks += 1;
                        warn!(
                            "[BloodStockMonitor] ⚠️ Stock faible: Banque {} - Groupe {} ({} poches)",
                            bank.service_id, groupe, quantite
                        );

                        // Optionnel: Notifier le prestataire
                        // self.notify_provider_low_stock(bank.banque_id, &groupe, quantite).await?;
                    }
                }
            }
        }

        info!(
            "[BloodStockMonitor] Vérification terminée: {} stocks vérifiés, {} faibles, {} vides",
            total_checks, low_stocks, empty_stocks
        );

        Ok(())
    }

    /// Déclencher matching automatique pour un stock vide
    async fn trigger_matching_for_stock(
        &self,
        service_id: i32,
        banque_id: i32,
        groupe_sanguin: &str,
    ) -> AppResult<()> {
        info!(
            "[BloodStockMonitor] Déclenchement matching automatique: Service {}, Groupe {}",
            service_id, groupe_sanguin
        );

        // Récupérer les coordonnées GPS de la banque
        let gps_info: Option<(Option<f64>, Option<f64>)> = sqlx::query_as(
            r#"
            SELECT 
                (gps->>'lat')::float as lat,
                (gps->>'lng')::float as lng
            FROM services
            WHERE id = $1
            "#,
        )
        .bind(service_id)
        .fetch_optional(&*self.pool)
        .await?;

        // Créer une demande de don automatique
        

        // Note: On utilise directement le service de matching au lieu du contrôleur
        // pour éviter les dépendances circulaires
        // Les valeurs sont passées directement via .bind() ci-dessous

        // Appeler la fonction SQL directement pour créer la demande
        let result: serde_json::Value = sqlx::query_scalar(
            r#"
            SELECT create_blood_donation_request(
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
            )
            "#,
        )
        .bind(banque_id)
        .bind(service_id)
        .bind(groupe_sanguin)
        .bind(Some(10))
        .bind(Some("poches".to_string()))
        .bind(Some(true))
        .bind(Some("critique".to_string()))
        .bind(None::<String>) // deadline_date
        .bind(gps_info.as_ref().and_then(|(lat, _)| *lat))
        .bind(gps_info.as_ref().and_then(|(_, lng)| *lng))
        .bind(None::<String>) // request_location_address
        .bind(None::<String>) // notes
        .bind(None::<String>) // patient_name
        .bind(None::<String>) // hospital_name
        .bind(Some(50.0)) // max_distance_km
        .fetch_one(&*self.pool)
        .await
        .map_err(|e| {
            error!("[BloodStockMonitor] Erreur création demande: {}", e);
            AppError::Internal(format!("Erreur création demande: {}", e))
        })?;

        if let Some(request_id) = result.get("request_id").and_then(|v| v.as_str()) {
            info!(
                "[BloodStockMonitor] ✅ Demande créée: {} - Notifications en cours...",
                request_id
            );

            // Notifier les donneurs (en arrière-plan)
            // Note: Le système de matching gère automatiquement les notifications
            // via les triggers PostgreSQL et le service de notifications
            info!(
                "[BloodStockMonitor] ✅ Demande {} créée - Le système de matching notifiera automatiquement les donneurs",
                request_id
            );
        }

        Ok(())
    }
}

#[derive(sqlx::FromRow)]
struct BankStockInfo {
    service_id: i32,
    banque_id: i32,
    stocks_json: Option<serde_json::Value>,
}
