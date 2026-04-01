// ✅ Service notations post-trajet — taxi & covoiturage
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};

#[derive(Debug, Serialize, Deserialize)]
pub struct SubmitRatingRequest {
    pub reservation_id: i32,
    pub rated_user_id: i32,
    pub rating: f64,
    pub comment: Option<String>,
    pub service_type: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RatingEntry {
    pub id: i64,
    pub reservation_id: i32,
    pub rater_user_id: i32,
    pub rated_user_id: i32,
    pub rating: f64,
    pub comment: Option<String>,
    pub service_type: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DriverRatingSummary {
    pub rated_user_id: i32,
    pub average_rating: f64,
    pub total_ratings: i64,
    pub five_stars: i64,
    pub four_stars: i64,
    pub three_stars: i64,
    pub two_stars: i64,
    pub one_star: i64,
}

pub struct TripRatingService {
    pool: PgPool,
}

impl TripRatingService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn submit_rating(
        &self,
        rater_user_id: i32,
        req: SubmitRatingRequest,
    ) -> Result<RatingEntry, String> {
        if req.rating < 1.0 || req.rating > 5.0 {
            return Err("La note doit être entre 1 et 5.".to_string());
        }
        let service_type = req.service_type.to_lowercase();
        if service_type != "taxi" && service_type != "covoiturage" {
            return Err("service_type doit être 'taxi' ou 'covoiturage'.".to_string());
        }

        let res = sqlx::query(
            "SELECT id, status FROM specialized_reservations WHERE id = $1 AND user_id = $2",
        )
        .bind(req.reservation_id)
        .bind(rater_user_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Réservation introuvable ou non autorisée.")?;

        let status: String = res.get("status");
        if status != "completed" {
            return Err("Vous ne pouvez noter qu'un trajet terminé.".to_string());
        }

        let row = sqlx::query(
            r#"INSERT INTO trip_ratings
               (reservation_id, rater_user_id, rated_user_id, rating, comment, service_type)
               VALUES ($1, $2, $3, $4, $5, $6)
               ON CONFLICT (reservation_id, rater_user_id) DO UPDATE
                   SET rating = EXCLUDED.rating, comment = EXCLUDED.comment
               RETURNING id, created_at"#,
        )
        .bind(req.reservation_id)
        .bind(rater_user_id)
        .bind(req.rated_user_id)
        .bind(req.rating)
        .bind(req.comment.clone())
        .bind(service_type.clone())
        .fetch_one(&self.pool)
        .await
        .map_err(|e| format!("DB: {}", e))?;

        let _ = self.refresh_service_rating(req.rated_user_id, &service_type).await;

        Ok(RatingEntry {
            id: row.get("id"),
            reservation_id: req.reservation_id,
            rater_user_id,
            rated_user_id: req.rated_user_id,
            rating: req.rating,
            comment: req.comment,
            service_type,
            created_at: row.get::<chrono::DateTime<chrono::Utc>, _>("created_at").to_rfc3339(),
        })
    }

    pub async fn get_driver_ratings(
        &self,
        driver_user_id: i32,
        service_type: &str,
    ) -> Result<(DriverRatingSummary, Vec<RatingEntry>), String> {
        let summary_row = sqlx::query(
            r#"SELECT
               COUNT(*)                                      AS total,
               COALESCE(AVG(rating), 0)::float8              AS avg_rating,
               COUNT(*) FILTER (WHERE rating >= 5)           AS five_stars,
               COUNT(*) FILTER (WHERE rating >= 4 AND rating < 5) AS four_stars,
               COUNT(*) FILTER (WHERE rating >= 3 AND rating < 4) AS three_stars,
               COUNT(*) FILTER (WHERE rating >= 2 AND rating < 3) AS two_stars,
               COUNT(*) FILTER (WHERE rating < 2)            AS one_star
               FROM trip_ratings
               WHERE rated_user_id = $1 AND service_type = $2"#,
        )
        .bind(driver_user_id)
        .bind(service_type)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        let entries = sqlx::query(
            r#"SELECT id, reservation_id, rater_user_id, rated_user_id,
               rating::float8 AS rating, comment, service_type, created_at
               FROM trip_ratings
               WHERE rated_user_id = $1 AND service_type = $2
               ORDER BY created_at DESC LIMIT 20"#,
        )
        .bind(driver_user_id)
        .bind(service_type)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        let summary = DriverRatingSummary {
            rated_user_id: driver_user_id,
            average_rating: summary_row.get::<Option<f64>, _>("avg_rating").unwrap_or(0.0),
            total_ratings: summary_row.get::<Option<i64>, _>("total").unwrap_or(0),
            five_stars: summary_row.get::<Option<i64>, _>("five_stars").unwrap_or(0),
            four_stars: summary_row.get::<Option<i64>, _>("four_stars").unwrap_or(0),
            three_stars: summary_row.get::<Option<i64>, _>("three_stars").unwrap_or(0),
            two_stars: summary_row.get::<Option<i64>, _>("two_stars").unwrap_or(0),
            one_star: summary_row.get::<Option<i64>, _>("one_star").unwrap_or(0),
        };

        let rating_list = entries
            .into_iter()
            .map(|r| RatingEntry {
                id: r.get("id"),
                reservation_id: r.get("reservation_id"),
                rater_user_id: r.get("rater_user_id"),
                rated_user_id: r.get("rated_user_id"),
                rating: r.get::<Option<f64>, _>("rating").unwrap_or(0.0),
                comment: r.get("comment"),
                service_type: r.get("service_type"),
                created_at: r.get::<chrono::DateTime<chrono::Utc>, _>("created_at").to_rfc3339(),
            })
            .collect();

        Ok((summary, rating_list))
    }

    pub async fn has_rated(&self, reservation_id: i32, rater_user_id: i32) -> bool {
        sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM trip_ratings WHERE reservation_id=$1 AND rater_user_id=$2)",
        )
        .bind(reservation_id)
        .bind(rater_user_id)
        .fetch_one(&self.pool)
        .await
        .unwrap_or(false)
    }

    async fn refresh_service_rating(
        &self,
        driver_user_id: i32,
        service_type: &str,
    ) -> Result<(), sqlx::Error> {
        let avg: Option<f64> = sqlx::query_scalar::<_, Option<f64>>(
            "SELECT AVG(rating)::float8 FROM trip_ratings WHERE rated_user_id=$1 AND service_type=$2",
        )
        .bind(driver_user_id)
        .bind(service_type)
        .fetch_one(&self.pool)
        .await?;

        if let Some(avg_val) = avg {
            match service_type {
                "taxi" => {
                    let _ = sqlx::query("UPDATE taxis SET rating=$1 WHERE user_id=$2")
                        .bind(avg_val)
                        .bind(driver_user_id)
                        .execute(&self.pool)
                        .await;
                }
                "covoiturage" => {
                    let _ = sqlx::query("UPDATE covoiturages SET rating=$1 WHERE user_id=$2")
                        .bind(avg_val)
                        .bind(driver_user_id)
                        .execute(&self.pool)
                        .await;
                }
                _ => {}
            }
        }
        Ok(())
    }
}
