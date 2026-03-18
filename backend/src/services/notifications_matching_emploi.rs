// ✅ Service pour envoyer des notifications push pour nouveaux matchings
use crate::core::types::AppResult;
use crate::services::push_notification_service;
use bigdecimal::ToPrimitive;
use log::{error, info};
use serde_json::json;
use sqlx::PgPool;

/// Envoie une notification push lorsqu'un nouveau matching est détecté
pub async fn notify_new_matching(
    pool: &PgPool,
    candidat_id: i32,
    offre_id: i32,
    score: f64,
    titre_poste: String,
) -> AppResult<()> {
    info!(
        "[notify_new_matching] Nouveau matching détecté: candidat_id={}, offre_id={}, score={}",
        candidat_id, offre_id, score
    );

    // Seulement notifier si le score est >= 70%
    if score < 70.0 {
        info!(
            "[notify_new_matching] Score trop faible ({}) pour notification",
            score
        );
        return Ok(());
    }

    let title = "🎯 Nouvelle offre correspondante !".to_string();
    let body = format!(
        "Vous avez un score de {}% pour le poste: {}",
        score as i32, titre_poste
    );

    let data = json!({
        "type": "new_job_matching",
        "offre_id": offre_id,
        "score": score,
        "titre_poste": titre_poste,
        "timestamp": chrono::Utc::now().to_rfc3339(),
    });

    match push_notification_service::send_push_notification(
        pool,
        candidat_id,
        title.clone(),
        body.clone(),
        Some(data),
        Some("default".to_string()),
    )
    .await
    {
        Ok(_) => {
            info!("[notify_new_matching] ✅ Notification envoyée avec succès");
            Ok(())
        }
        Err(e) => {
            error!("[notify_new_matching] ❌ Erreur envoi notification: {}", e);
            // Ne pas faire échouer la fonction si la notification échoue
            Ok(())
        }
    }
}

/// Vérifie les nouveaux matchings et envoie les notifications (tâche cron)
pub async fn check_and_notify_new_matchings(pool: &PgPool) -> AppResult<usize> {
    info!("[check_and_notify_new_matchings] Vérification des nouveaux matchings");

    // Récupérer les matchings récents (dernières 24h) avec score >= 70%
    let matchings = sqlx::query(
        r#"
        SELECT DISTINCT ON (m.candidat_id, m.offre_id)
            m.candidat_id,
            m.offre_id,
            m.score_total,
            o.titre_poste,
            m.created_at
        FROM matching_offres_candidats m
        JOIN offres_emploi o ON o.id = m.offre_id
        WHERE m.score_total >= 70.0
        AND m.created_at > NOW() - INTERVAL '24 hours'
        AND NOT EXISTS (
            SELECT 1 FROM candidatures c
            WHERE c.candidat_id = m.candidat_id
            AND c.offre_id = m.offre_id
        )
        ORDER BY m.candidat_id, m.offre_id, m.created_at DESC
        "#,
    )
    .fetch_all(pool)
    .await
    .map_err(|e| {
        error!("[check_and_notify_new_matchings] Erreur: {}", e);
        crate::core::types::AppError::Internal(format!("Erreur vérification matchings: {}", e))
    })?;

    let mut notified_count = 0;

    for matching in &matchings {
        use sqlx::Row;
        let candidat_id: i32 = matching.try_get("candidat_id").unwrap_or(0);
        let offre_id: i32 = matching.try_get("offre_id").unwrap_or(0);
        let score_total: bigdecimal::BigDecimal =
            matching.try_get("score_total").unwrap_or_default();
        let titre_poste: Option<String> = matching.try_get("titre_poste").unwrap_or(None);
        if let Err(e) = notify_new_matching(
            pool,
            candidat_id,
            offre_id,
            ToPrimitive::to_f64(&score_total).unwrap_or(0.0),
            titre_poste.unwrap_or_default(),
        )
        .await
        {
            error!(
                "[check_and_notify_new_matchings] Erreur notification pour matching: {}",
                e
            );
        } else {
            notified_count += 1;
        }
    }

    info!(
        "[check_and_notify_new_matchings] ✅ {} notifications envoyées",
        notified_count
    );
    Ok(notified_count)
}
