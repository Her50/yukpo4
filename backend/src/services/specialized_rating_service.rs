// ✅ NOUVEAU: Service de gestion des avis et ratings

use crate::core::types::{AppError, AppResult};
use crate::models::specialized_rating::{ServiceRatingStats, SpecializedRating};
use sqlx::{PgPool, Row};
use std::sync::Arc;

pub struct SpecializedRatingService {
    pool: Arc<PgPool>,
}

impl SpecializedRatingService {
    pub fn new(pool: Arc<PgPool>) -> Self {
        Self { pool }
    }

    /// Créer un avis
    pub async fn create_rating(
        &self,
        service_id: i32,
        service_type: &str,
        user_id: i32,
        prestataire_id: i32,
        rating: i32,
        comment: Option<String>,
        quality_rating: Option<i32>,
        punctuality_rating: Option<i32>,
        price_rating: Option<i32>,
        communication_rating: Option<i32>,
        reservation_id: Option<i32>,
    ) -> AppResult<SpecializedRating> {
        // Vérifier que le rating est entre 1 et 5
        if rating < 1 || rating > 5 {
            return Err(AppError::BadRequest(
                "Le rating doit être entre 1 et 5".to_string(),
            ));
        }

        // Vérifier si l'utilisateur a déjà laissé un avis pour ce service
        let existing = sqlx::query_scalar::<_, i32>(
            r#"
            SELECT COUNT(*) FROM specialized_ratings
            WHERE service_id = $1 AND user_id = $2
            "#,
        )
        .bind(service_id)
        .bind(user_id)
        .fetch_one(&*self.pool)
        .await?;

        if existing > 0 {
            return Err(AppError::BadRequest(
                "Vous avez déjà laissé un avis pour ce service".to_string(),
            ));
        }

        // Vérifier si l'utilisateur a utilisé le service (via réservation)
        let is_verified = if let Some(res_id) = reservation_id {
            sqlx::query_scalar::<_, bool>(
                r#"
                SELECT EXISTS(
                    SELECT 1 FROM specialized_reservations
                    WHERE id = $1 AND user_id = $2 AND status = 'completed'
                )
                "#,
            )
            .bind(res_id)
            .bind(user_id)
            .fetch_one(&*self.pool)
            .await?
        } else {
            false
        };

        let rating_id: i32 = sqlx::query_scalar(
            r#"
            INSERT INTO specialized_ratings (
                service_id, service_type, user_id, prestataire_id,
                rating, comment, quality_rating, punctuality_rating,
                price_rating, communication_rating, reservation_id,
                is_verified, helpful_count, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 0, NOW(), NOW())
            RETURNING id
            "#,
        )
        .bind(service_id)
        .bind(service_type)
        .bind(user_id)
        .bind(prestataire_id)
        .bind(rating)
        .bind(&comment)
        .bind(quality_rating)
        .bind(punctuality_rating)
        .bind(price_rating)
        .bind(communication_rating)
        .bind(reservation_id)
        .bind(is_verified)
        .fetch_one(&*self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur création avis: {}", e)))?;

        let rating_record = self.get_rating_by_id(rating_id).await?;
        Ok(rating_record)
    }

    /// Obtenir les statistiques de ratings d'un service
    pub async fn get_service_rating_stats(&self, service_id: i32) -> AppResult<ServiceRatingStats> {
        let row_opt = sqlx::query(
            r#"
            SELECT 
                service_id,
                AVG(rating)::numeric(3,2) as average_rating,
                COUNT(*)::int as total_ratings,
                jsonb_build_object(
                    '1', COUNT(*) FILTER (WHERE rating = 1),
                    '2', COUNT(*) FILTER (WHERE rating = 2),
                    '3', COUNT(*) FILTER (WHERE rating = 3),
                    '4', COUNT(*) FILTER (WHERE rating = 4),
                    '5', COUNT(*) FILTER (WHERE rating = 5)
                ) as rating_distribution,
                AVG(quality_rating)::numeric(3,2) as average_quality,
                AVG(punctuality_rating)::numeric(3,2) as average_punctuality,
                AVG(price_rating)::numeric(3,2) as average_price,
                AVG(communication_rating)::numeric(3,2) as average_communication
            FROM specialized_ratings
            WHERE service_id = $1
            GROUP BY service_id
            "#,
        )
        .bind(service_id)
        .fetch_optional(&*self.pool)
        .await?;

        if let Some(row) = row_opt {
            Ok(ServiceRatingStats {
                service_id: row.get(0),
                average_rating: row
                    .get::<Option<rust_decimal::Decimal>, _>(1)
                    .map(|d| d.to_string().parse::<f64>().unwrap_or(0.0))
                    .unwrap_or(0.0),
                total_ratings: row.get(2),
                rating_distribution: row.get(3),
                average_quality: row
                    .get::<Option<rust_decimal::Decimal>, _>(4)
                    .map(|d| d.to_string().parse::<f64>().ok()),
                average_punctuality: row
                    .get::<Option<rust_decimal::Decimal>, _>(5)
                    .map(|d| d.to_string().parse::<f64>().ok()),
                average_price: row
                    .get::<Option<rust_decimal::Decimal>, _>(6)
                    .map(|d| d.to_string().parse::<f64>().ok()),
                average_communication: row
                    .get::<Option<rust_decimal::Decimal>, _>(7)
                    .map(|d| d.to_string().parse::<f64>().ok()),
            })
        } else {
            // Retourner des stats vides si aucun avis
            Ok(ServiceRatingStats {
                service_id,
                average_rating: 0.0,
                total_ratings: 0,
                rating_distribution: serde_json::json!({"1": 0, "2": 0, "3": 0, "4": 0, "5": 0}),
                average_quality: None,
                average_punctuality: None,
                average_price: None,
                average_communication: None,
            })
        }
    }

    /// Lister les avis d'un service
    pub async fn list_service_ratings(
        &self,
        service_id: i32,
        limit: Option<i32>,
        offset: Option<i32>,
    ) -> AppResult<Vec<SpecializedRating>> {
        let limit = limit.unwrap_or(20).min(100);
        let offset = offset.unwrap_or(0);

        let rows = sqlx::query(
            r#"
            SELECT id, service_id, service_type, user_id, prestataire_id,
                   rating, comment, quality_rating, punctuality_rating,
                   price_rating, communication_rating, reservation_id,
                   is_verified, helpful_count, created_at, updated_at
            FROM specialized_ratings
            WHERE service_id = $1
            ORDER BY helpful_count DESC, created_at DESC
            LIMIT $2 OFFSET $3
            "#,
        )
        .bind(service_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(&*self.pool)
        .await?;

        let ratings: Vec<SpecializedRating> = rows
            .into_iter()
            .map(|row| SpecializedRating {
                id: row.get(0),
                service_id: row.get(1),
                service_type: row.get(2),
                user_id: row.get(3),
                prestataire_id: row.get(4),
                rating: row.get(5),
                comment: row.get(6),
                quality_rating: row.get(7),
                punctuality_rating: row.get(8),
                price_rating: row.get(9),
                communication_rating: row.get(10),
                reservation_id: row.get(11),
                is_verified: row.get(12),
                helpful_count: row.get(13),
                created_at: row.get(14),
                updated_at: row.get(15),
            })
            .collect();

        Ok(ratings)
    }

    /// Récupérer un avis par ID
    async fn get_rating_by_id(&self, rating_id: i32) -> AppResult<SpecializedRating> {
        let row = sqlx::query(
            r#"
            SELECT id, service_id, service_type, user_id, prestataire_id,
                   rating, comment, quality_rating, punctuality_rating,
                   price_rating, communication_rating, reservation_id,
                   is_verified, helpful_count, created_at, updated_at
            FROM specialized_ratings
            WHERE id = $1
            "#,
        )
        .bind(rating_id)
        .fetch_one(&*self.pool)
        .await?;

        Ok(SpecializedRating {
            id: row.get(0),
            service_id: row.get(1),
            service_type: row.get(2),
            user_id: row.get(3),
            prestataire_id: row.get(4),
            rating: row.get(5),
            comment: row.get(6),
            quality_rating: row.get(7),
            punctuality_rating: row.get(8),
            price_rating: row.get(9),
            communication_rating: row.get(10),
            reservation_id: row.get(11),
            is_verified: row.get(12),
            helpful_count: row.get(13),
            created_at: row.get(14),
            updated_at: row.get(15),
        })
    }

    /// Marquer un avis comme utile
    pub async fn mark_helpful(&self, rating_id: i32, user_id: i32) -> AppResult<()> {
        // Vérifier si l'utilisateur a déjà marqué comme utile
        let exists = sqlx::query_scalar::<_, bool>(
            r#"
            SELECT EXISTS(
                SELECT 1 FROM rating_helpful_votes
                WHERE rating_id = $1 AND user_id = $2
            )
            "#,
        )
        .bind(rating_id)
        .bind(user_id)
        .fetch_one(&*self.pool)
        .await?;

        if exists {
            return Err(AppError::BadRequest(
                "Vous avez déjà marqué cet avis comme utile".to_string(),
            ));
        }

        // Ajouter le vote et incrémenter le compteur
        sqlx::query(
            r#"
            INSERT INTO rating_helpful_votes (rating_id, user_id, created_at)
            VALUES ($1, $2, NOW());
            
            UPDATE specialized_ratings
            SET helpful_count = helpful_count + 1
            WHERE id = $1
            "#,
        )
        .bind(rating_id)
        .bind(user_id)
        .execute(&*self.pool)
        .await?;

        Ok(())
    }
}
