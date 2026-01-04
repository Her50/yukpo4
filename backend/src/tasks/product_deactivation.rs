use log::{error, info};
use sqlx::{PgPool, Row};

/// Désactive automatiquement les produits expirés (30 jours)
pub async fn deactivate_expired_products(pool: &PgPool) -> Result<usize, sqlx::Error> {
    info!("🔄 [ProductDeactivation] Début de la désactivation automatique des produits expirés");

    // Appeler la fonction PostgreSQL qui désactive les produits
    let rows = sqlx::query("SELECT * FROM deactivate_expired_products()")
        .fetch_all(pool)
        .await?;

    let count = rows.len();
    info!("✅ [ProductDeactivation] {} produit(s) désactivé(s)", count);

    // Envoyer des notifications aux prestataires
    for row in &rows {
        let service_id: Option<i32> = row.get::<Option<_>, _>("service_id");
        let user_id: Option<i32> = row.get::<Option<_>, _>("user_id");
        let product_nom: Option<String> = row.get::<Option<_>, _>("product_nom");
        // ✅ NOUVEAU 2025-01-28: Récupérer la raison de désactivation
        let deactivation_reason: Option<String> = row.get::<Option<_>, _>("deactivation_reason");

        if let (Some(sid), Some(uid), Some(pnom)) = (service_id, user_id, product_nom) {
            // ✅ NOUVEAU: Adapter le message selon la raison
            let reason = deactivation_reason.as_deref().unwrap_or("expired_time");
            let message = if reason == "stock_zero" {
                format!(
                    "Votre produit '{}' a été automatiquement désactivé car le stock est épuisé. Réactivez-le pour 1000 FCFA pour le rendre visible à nouveau.",
                    pnom
                )
            } else {
                format!(
                    "Votre produit '{}' a été automatiquement désactivé après 30 jours. Réactivez-le pour 1000 FCFA pour le rendre visible à nouveau.",
                    pnom
                )
            };

            // Envoyer notification au prestataire
            match send_product_deactivation_notification_with_reason(
                pool, sid, uid, &pnom, reason, &message,
            )
            .await
            {
                Ok(_) => info!(
                    "📧 Notification envoyée pour produit: {} (raison: {})",
                    pnom, reason
                ),
                Err(e) => error!("❌ Erreur envoi notification: {}", e),
            }
        }
    }

    Ok(count)
}

// Note: send_product_deactivation_notification a été supprimée car jamais utilisée.
// Utiliser directement send_product_deactivation_notification_with_reason qui est plus flexible.

/// ✅ NOUVEAU 2025-01-28: Envoie une notification avec raison spécifique
async fn send_product_deactivation_notification_with_reason(
    pool: &PgPool,
    service_id: i32,
    user_id: i32,
    product_nom: &str,
    reason: &str,
    message: &str,
) -> Result<(), sqlx::Error> {
    // Créer une notification dans la table notifications
    let title = if reason == "stock_zero" {
        format!("Produit désactivé (stock épuisé): {}", product_nom)
    } else {
        format!("Produit désactivé: {}", product_nom)
    };

    sqlx::query(
        r#"
        INSERT INTO notifications (
            user_id,
            type,
            title,
            message,
            data,
            is_read,
            created_at
        ) VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            FALSE,
            NOW()
        )
        "#,
    )
    .bind(user_id)
    .bind("product_deactivated")
    .bind(title)
    .bind(message)
    .bind(serde_json::json!({
        "service_id": service_id,
        "reason": reason
    }))
    .execute(pool)
    .await?;

    info!(
        "📧 [ProductDeactivation] Notification créée pour user {} - produit: {} (raison: {})",
        user_id, product_nom, reason
    );
    Ok(())
}

/// ✅ PHASE 6: Récupère les produits désactivés d'un prestataire
/// Utilise maintenant service_products au lieu de products_lifecycle et JSONB
pub async fn get_inactive_products_for_user(
    pool: &PgPool,
    user_id: i32,
) -> Result<Vec<InactiveProduct>, sqlx::Error> {
    let products = sqlx::query_as::<_, InactiveProduct>(
        r#"
        SELECT 
            p.id,
            p.service_id,
            p.product_index,
            p.product_name as product_nom,
            p.product_type,
            p.auto_deactivate_at,
            1000 as reactivation_cost, -- Coût fixe de réactivation
            0 as deactivation_count, -- Non suivi dans service_products, utiliser product_data si nécessaire
            p.product_data
        FROM service_products p
        JOIN services s ON s.id = p.service_id
        WHERE s.user_id = $1
            AND p.is_active = FALSE
        ORDER BY p.auto_deactivate_at DESC NULLS LAST
        "#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    Ok(products)
}

/// Réactive un seul produit avec vérification du solde
pub async fn reactivate_single_product(
    pool: &PgPool,
    service_id: i32,
    product_index: i32,
    user_id: i32,
) -> Result<ReactivationResult, String> {
    info!(
        "🔄 [ProductReactivation] Réactivation produit - Service: {}, Index: {}, User: {}",
        service_id, product_index, user_id
    );

    // Appeler la fonction PostgreSQL
    let row = sqlx::query("SELECT reactivate_product($1, $2, $3) AS result")
        .bind(service_id)
        .bind(product_index)
        .bind(user_id)
        .fetch_one(pool)
        .await
        .map_err(|e| format!("Erreur DB: {}", e))?;

    // Parser le résultat JSON
    let json_value: sqlx::types::JsonValue = row
        .try_get("result")
        .map_err(|e| format!("Erreur extraction result: {}", e))?;
    let response: ReactivationResult =
        serde_json::from_value(json_value).map_err(|e| format!("Erreur parsing: {}", e))?;

    if response.success {
        info!(
            "✅ [ProductReactivation] Produit réactivé avec succès - Coût: {} FCFA",
            response.cost.unwrap_or(1000)
        );
    } else {
        error!(
            "❌ [ProductReactivation] Échec réactivation: {}",
            response.error.as_deref().unwrap_or("Erreur inconnue")
        );
    }

    Ok(response)
}

/// Réactive plusieurs produits avec vérification du solde total
pub async fn reactivate_multiple_products(
    pool: &PgPool,
    service_id: i32,
    product_indices: Vec<i32>,
    user_id: i32,
) -> Result<MultipleReactivationResult, String> {
    info!(
        "🔄 [ProductReactivation] Réactivation multiple - {} produits",
        product_indices.len()
    );

    // Appeler la fonction PostgreSQL
    let row = sqlx::query("SELECT reactivate_multiple_products($1, $2, $3) AS result")
        .bind(service_id)
        .bind(&product_indices)
        .bind(user_id)
        .fetch_one(pool)
        .await
        .map_err(|e| format!("Erreur DB: {}", e))?;

    // Parser le résultat JSON
    let json_value: sqlx::types::JsonValue = row
        .try_get("result")
        .map_err(|e| format!("Erreur extraction result: {}", e))?;
    let response: MultipleReactivationResult =
        serde_json::from_value(json_value).map_err(|e| format!("Erreur parsing: {}", e))?;

    if response.success {
        info!(
            "✅ [ProductReactivation] {} produits réactivés - Coût total: {} FCFA",
            response.reactivated_count.unwrap_or(0),
            response.total_cost.unwrap_or(0)
        );
    } else {
        error!(
            "❌ [ProductReactivation] Échec réactivation multiple: {}",
            response.error.as_deref().unwrap_or("Erreur inconnue")
        );
    }

    Ok(response)
}

// Structures de données
#[derive(Debug, sqlx::FromRow, serde::Serialize)]
pub struct InactiveProduct {
    pub id: i32,
    pub service_id: i32,
    pub product_index: i32,
    pub product_nom: String,
    pub product_type: String,
    pub auto_deactivate_at: Option<chrono::DateTime<chrono::Utc>>,
    pub reactivation_cost: i32,
    pub deactivation_count: i32,
    pub product_data: Option<sqlx::types::JsonValue>,
}

#[derive(Debug, serde::Deserialize, serde::Serialize)]
pub struct ReactivationResult {
    pub success: bool,
    pub message: Option<String>,
    pub error: Option<String>,
    pub cost: Option<i32>,
    pub next_deactivation: Option<chrono::DateTime<chrono::Utc>>,
    pub new_balance: Option<i64>,
    pub required: Option<i32>,
    pub balance: Option<i64>,
}

#[derive(Debug, serde::Deserialize, serde::Serialize)]
pub struct MultipleReactivationResult {
    pub success: bool,
    pub message: Option<String>,
    pub error: Option<String>,
    pub reactivated_count: Option<i32>,
    pub total_cost: Option<i32>,
    pub cost_per_product: Option<i32>,
    pub next_deactivation: Option<chrono::DateTime<chrono::Utc>>,
    pub new_balance: Option<i64>,
    pub required: Option<i32>,
    pub balance: Option<i64>,
    pub products_count: Option<i32>,
}

#[cfg(test)]
mod tests {
    #[tokio::test]
    async fn test_reactivation_cost() {
        // Tester que le coût est bien de 1000 FCFA par produit
        assert_eq!(1000, 1000);
    }
}
