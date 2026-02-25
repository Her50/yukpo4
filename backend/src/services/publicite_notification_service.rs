use log;
use serde_json::json;
use sqlx::{PgPool, Row};
use std::time::Duration;
use tokio::time::sleep;

use crate::services::push_notification_service;

#[derive(Debug, Clone)]
pub struct PubliciteAlert {
    pub user_id: i32,
    pub campaign_id: i32,
    pub alert_type: String, // "low_performance", "budget_depleted", "high_cpc", "low_ctr"
    pub message: String,
    pub severity: String, // "info", "warning", "critical"
    pub data: serde_json::Value,
}

/// Vérifie les performances des publicités et génère des alertes
pub async fn check_and_generate_alerts(pool: &PgPool) -> Result<Vec<PubliciteAlert>, sqlx::Error> {
    let mut alerts = Vec::new();

    // Récupérer toutes les publicités actives
    let active_campaigns = sqlx::query(
        r#"
        SELECT 
            id, user_id, titre, vues, clics, impressions, cout, status,
            date_debut, date_fin
        FROM publicites
        WHERE status = 'active'
        AND date_fin > NOW()
        "#,
    )
    .fetch_all(pool)
    .await?;

    for row in active_campaigns {
        let campaign_id: i32 = row.get::<i32, _>("id");
        let user_id: i32 = row.get::<i32, _>("user_id");
        let titre: String = row.get::<String, _>("titre");
        let vues: i32 = row.get::<Option<i32>, _>("vues").unwrap_or(0);
        let clics: i32 = row.get::<Option<i32>, _>("clics").unwrap_or(0);
        let impressions: i32 = row.get::<Option<i32>, _>("impressions").unwrap_or(0);
        let cout: i32 = row.get::<Option<i32>, _>("cout").unwrap_or(0);

        // 1. Vérifier le taux de conversion faible
        if vues > 100 {
            let conversion_rate = (clics as f64 / vues as f64) * 100.0;
            if conversion_rate < 1.0 {
                alerts.push(PubliciteAlert {
                    user_id,
                    campaign_id,
                    alert_type: "low_performance".to_string(),
                    message: format!(
                        "⚠️ Votre publicité '{}' a un taux de conversion faible ({:.2}%). Considérez d'affiner le ciblage.",
                        titre, conversion_rate
                    ),
                    severity: "warning".to_string(),
                    data: json!({
                        "conversion_rate": conversion_rate,
                        "vues": vues,
                        "clics": clics
                    }),
                });
            }
        }

        // 2. Vérifier le CTR faible
        if impressions > 1000 {
            let ctr = (vues as f64 / impressions as f64) * 100.0;
            if ctr < 0.5 {
                alerts.push(PubliciteAlert {
                    user_id,
                    campaign_id,
                    alert_type: "low_ctr".to_string(),
                    message: format!(
                        "📉 Votre publicité '{}' a un CTR faible ({:.2}%). Améliorez le titre ou l'image.",
                        titre, ctr
                    ),
                    severity: "warning".to_string(),
                    data: json!({
                        "ctr": ctr,
                        "impressions": impressions,
                        "vues": vues
                    }),
                });
            }
        }

        // 3. Vérifier le CPC élevé
        if clics > 10 && cout > 0 {
            let cpc = (cout as f64) / (clics as f64);
            // Comparer avec la moyenne (supposons 100 FCFA comme seuil)
            if cpc > 200.0 {
                alerts.push(PubliciteAlert {
                    user_id,
                    campaign_id,
                    alert_type: "high_cpc".to_string(),
                    message: format!(
                        "💰 Votre publicité '{}' a un CPC élevé ({:.0} FCFA). Optimisez votre stratégie d'enchères.",
                        titre, cpc
                    ),
                    severity: "warning".to_string(),
                    data: json!({
                        "cpc": cpc,
                        "cout": cout,
                        "clics": clics
                    }),
                });
            }
        }

        // 4. Vérifier si le budget est presque épuisé
        // (Pour simplifier, on vérifie si la campagne approche de sa fin)
        let date_fin: chrono::DateTime<chrono::Utc> =
            row.get::<chrono::DateTime<chrono::Utc>, _>("date_fin");
        let days_remaining = (date_fin - chrono::Utc::now()).num_days();
        if days_remaining <= 3 && days_remaining > 0 {
            alerts.push(PubliciteAlert {
                user_id,
                campaign_id,
                alert_type: "campaign_ending_soon".to_string(),
                message: format!(
                    "⏰ Votre publicité '{}' se termine dans {} jour(s). Pensez à la relancer si les performances sont bonnes.",
                    titre, days_remaining
                ),
                severity: "info".to_string(),
                data: json!({
                    "days_remaining": days_remaining
                }),
            });
        }
    }

    Ok(alerts)
}

/// Envoie les alertes aux utilisateurs (via notifications push ou email)
pub async fn send_alerts_to_users(
    pool: &PgPool,
    alerts: Vec<PubliciteAlert>,
) -> Result<usize, sqlx::Error> {
    let mut sent_count = 0;

    for alert in alerts {
        // Créer une notification en base de données
        let notification_result = sqlx::query(
            r#"
            INSERT INTO notifications (
                user_id, type, title, message, data, read, created_at
            )
            VALUES ($1, $2, $3, $4, $5, false, NOW())
            ON CONFLICT DO NOTHING
            RETURNING id
            "#,
        )
        .bind(alert.user_id)
        .bind("publicite_alert")
        .bind(format!("Alerte Publicité: {}", alert.alert_type))
        .bind(&alert.message)
        .bind(&alert.data)
        .fetch_optional(pool)
        .await;

        match notification_result {
            Ok(Some(_)) => {
                sent_count += 1;
                log::info!(
                    "✅ Alerte envoyée: user {} - campagne {} - type {}",
                    alert.user_id,
                    alert.campaign_id,
                    alert.alert_type
                );
            }
            Ok(None) => {
                log::warn!("⚠️ Notification déjà existante, ignorée");
            }
            Err(e) => {
                log::error!("❌ Erreur création notification: {:?}", e);
            }
        }

        // Envoyer aussi une push notification Expo
        let push_data = json!({
            "type": "publicite_alert",
            "alert_type": alert.alert_type,
            "campaign_id": alert.campaign_id,
            "severity": alert.severity,
            "redirect": {
                "screen": "PubliciteDashboard",
                "params": { "campaign_id": alert.campaign_id }
            }
        });
        if let Err(e) = push_notification_service::send_push_notification(
            pool,
            alert.user_id,
            format!("Alerte Publicité: {}", alert.alert_type),
            alert.message.clone(),
            Some(push_data),
            Some("default".to_string()),
        )
        .await
        {
            log::warn!(
                "⚠️ Push notification échouée pour alerte pub user {}: {:?}",
                alert.user_id,
                e
            );
        }
    }

    Ok(sent_count)
}

/// Tâche périodique pour vérifier et envoyer les alertes
pub async fn start_publicite_alert_monitor(pool: sqlx::PgPool) {
    log::info!("🚀 Démarrage du moniteur d'alertes publicités...");

    loop {
        match check_and_generate_alerts(&pool).await {
            Ok(alerts) => {
                if !alerts.is_empty() {
                    log::info!("📊 {} alerte(s) générée(s)", alerts.len());
                    match send_alerts_to_users(&pool, alerts).await {
                        Ok(sent) => {
                            log::info!("✅ {} notification(s) envoyée(s)", sent);
                        }
                        Err(e) => {
                            log::error!("❌ Erreur envoi alertes: {:?}", e);
                        }
                    }
                }
            }
            Err(e) => {
                log::error!("❌ Erreur vérification alertes: {:?}", e);
            }
        }

        // Vérifier toutes les heures
        sleep(Duration::from_secs(3600)).await;
    }
}
