// ✅ NOUVEAU 2026-02-06: Service de gestion de la phase de lancement
// Pendant la phase de lancement (3 mois), les prestataires peuvent :
// - Créer autant de produits qu'ils veulent gratuitement
// - Réactiver leurs produits gratuitement

use chrono::{DateTime, Utc};
use sqlx::{PgPool, Row};
use std::env;

/// Date de début de la phase de lancement (configurable via variable d'environnement)
/// Format: "2026-02-06T00:00:00Z" ou laisser vide pour utiliser la date actuelle
pub fn get_launch_phase_start_date() -> DateTime<Utc> {
    if let Ok(date_str) = env::var("LAUNCH_PHASE_START_DATE") {
        if let Ok(date) = DateTime::parse_from_rfc3339(&date_str) {
            return date.with_timezone(&Utc);
        }
    }
    // Par défaut: date actuelle (démarrage de la phase de lancement)
    Utc::now()
}

/// Durée de la phase de lancement en jours (3 mois = 90 jours)
pub const LAUNCH_PHASE_DURATION_DAYS: i64 = 90;

/// Date de fin de la phase de lancement
pub fn get_launch_phase_end_date() -> DateTime<Utc> {
    let start = get_launch_phase_start_date();
    start + chrono::Duration::days(LAUNCH_PHASE_DURATION_DAYS)
}

/// Vérifie si on est actuellement dans la phase de lancement
pub fn is_launch_phase_active() -> bool {
    let now = Utc::now();
    let end_date = get_launch_phase_end_date();
    now <= end_date
}

/// Vérifie si un utilisateur est dans la phase de lancement
/// Un utilisateur est dans la phase de lancement si :
/// - On est dans la phase de lancement globale ET
/// - L'utilisateur a été créé avant la fin de la phase de lancement
pub async fn is_user_in_launch_phase(pool: &PgPool, user_id: i32) -> Result<bool, sqlx::Error> {
    if !is_launch_phase_active() {
        return Ok(false);
    }

    // Vérifier la date de création de l'utilisateur
    let user_created_at: Option<DateTime<Utc>> =
        sqlx::query_scalar("SELECT created_at FROM users WHERE id = $1")
            .bind(user_id)
            .fetch_optional(pool)
            .await?;

    match user_created_at {
        Some(created_at) => {
            let end_date = get_launch_phase_end_date();
            Ok(created_at <= end_date)
        }
        None => Ok(false),
    }
}

/// Vérifie si un utilisateur peut créer des produits gratuitement
/// Conditions :
/// 1. L'utilisateur est dans la phase de lancement (créé avant la fin de la phase)
/// 2. OU c'est son premier produit gratuit (free_product_created = 0)
pub async fn can_create_product_free(pool: &PgPool, user_id: i32) -> Result<bool, sqlx::Error> {
    // Vérifier si c'est le premier produit gratuit
    let free_product_created: i32 =
        sqlx::query_scalar("SELECT COALESCE(free_product_created, 0) FROM users WHERE id = $1")
            .bind(user_id)
            .fetch_one(pool)
            .await
            .unwrap_or(0);

    // Si c'est le premier produit, c'est toujours gratuit
    if free_product_created == 0 {
        return Ok(true);
    }

    // Sinon, vérifier si on est dans la phase de lancement
    is_user_in_launch_phase(pool, user_id).await
}

/// Vérifie si un utilisateur peut réactiver des produits gratuitement
/// Condition : L'utilisateur est dans la phase de lancement
pub async fn can_reactivate_product_free(pool: &PgPool, user_id: i32) -> Result<bool, sqlx::Error> {
    is_user_in_launch_phase(pool, user_id).await
}

/// Incrémente le compteur de produits gratuits créés
pub async fn increment_free_product_count(pool: &PgPool, user_id: i32) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE users SET free_product_created = COALESCE(free_product_created, 0) + 1 WHERE id = $1"
    )
    .bind(user_id)
    .execute(pool)
    .await?;
    Ok(())
}

/// Récupère le nombre de produits gratuits créés par un utilisateur
pub async fn get_free_product_count(pool: &PgPool, user_id: i32) -> Result<i32, sqlx::Error> {
    let count: i32 =
        sqlx::query_scalar("SELECT COALESCE(free_product_created, 0) FROM users WHERE id = $1")
            .bind(user_id)
            .fetch_one(pool)
            .await
            .unwrap_or(0);
    Ok(count)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_launch_phase_dates() {
        let start = get_launch_phase_start_date();
        let end = get_launch_phase_end_date();
        assert!(end > start);
        let duration = (end - start).num_days();
        assert_eq!(duration, LAUNCH_PHASE_DURATION_DAYS);
    }
}
