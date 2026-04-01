// ✅ Service partage trajet temps réel — token public, lien partageable
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};

#[derive(Debug, Serialize, Deserialize)]
pub struct TripShareInfo {
    pub token: String,
    pub share_url: String,
    pub expires_at: String,
    pub reservation_id: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PublicTripData {
    pub token: String,
    pub service_type: Option<String>,
    pub status: String,
    pub driver_name: Option<String>,
    pub driver_phone: Option<String>,
    pub gps_actuel: Option<String>,
    pub reservation_date: Option<String>,
    pub reservation_time: Option<String>,
    pub depart: Option<String>,
    pub destination: Option<String>,
    pub expires_at: String,
}

pub struct TripShareService {
    pool: PgPool,
}

impl TripShareService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn create_share(
        &self,
        user_id: i32,
        reservation_id: i32,
    ) -> Result<TripShareInfo, String> {
        let exists: bool = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM specialized_reservations WHERE id=$1 AND user_id=$2)",
        )
        .bind(reservation_id)
        .bind(user_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        if !exists {
            return Err("Réservation introuvable ou non autorisée.".to_string());
        }

        let row = sqlx::query(
            r#"INSERT INTO trip_shares (reservation_id, user_id)
               VALUES ($1, $2)
               ON CONFLICT (reservation_id) DO UPDATE
                 SET expires_at = NOW() + INTERVAL '24 hours'
               RETURNING token, expires_at"#,
        )
        .bind(reservation_id)
        .bind(user_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| format!("DB: {}", e))?;

        let token: String = row.get("token");
        let expires_at: chrono::DateTime<chrono::Utc> = row.get("expires_at");
        let share_url = format!("https://yukpo.app/track/{}", token);

        Ok(TripShareInfo {
            token,
            share_url,
            expires_at: expires_at.to_rfc3339(),
            reservation_id,
        })
    }

    pub async fn get_public_data(&self, token: &str) -> Result<PublicTripData, String> {
        let share = sqlx::query(
            "SELECT reservation_id, expires_at FROM trip_shares WHERE token=$1 AND expires_at > NOW()",
        )
        .bind(token)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Lien expiré ou invalide.")?;

        let reservation_id: i32 = share.get("reservation_id");
        let share_expires_at: chrono::DateTime<chrono::Utc> = share.get("expires_at");

        let res = sqlx::query(
            r#"SELECT sr.status, sr.service_type, sr.reservation_date, sr.reservation_time,
               u.nom, u.prenom, u.telephone,
               sr.details
               FROM specialized_reservations sr
               JOIN users u ON u.id = sr.service_user_id
               WHERE sr.id = $1"#,
        )
        .bind(reservation_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Réservation introuvable.")?;

        let gps: Option<String> = sqlx::query_scalar::<_, Option<String>>(
            r#"SELECT t.gps_actuel FROM taxis t
               JOIN specialized_services ss ON ss.id = t.service_id
               JOIN specialized_reservations sr ON sr.service_id = ss.id
               WHERE sr.id = $1"#,
        )
        .bind(reservation_id)
        .fetch_optional(&self.pool)
        .await
        .unwrap_or(None)
        .flatten();

        let details_raw: Option<serde_json::Value> = res.get("details");
        let details = details_raw.unwrap_or(serde_json::Value::Null);
        let nom: Option<String> = res.get("nom");
        let prenom: Option<String> = res.get("prenom");
        let driver_name = nom.map(|n| format!("{} {}", n, prenom.unwrap_or_default()));

        Ok(PublicTripData {
            token: token.to_string(),
            service_type: res.get("service_type"),
            status: res.get("status"),
            driver_name,
            driver_phone: res.get("telephone"),
            gps_actuel: gps,
            reservation_date: res
                .get::<Option<chrono::NaiveDate>, _>("reservation_date")
                .map(|d| d.to_string()),
            reservation_time: res.get("reservation_time"),
            depart: details.get("depart").and_then(|v| v.as_str()).map(String::from),
            destination: details.get("destination").and_then(|v| v.as_str()).map(String::from),
            expires_at: share_expires_at.to_rfc3339(),
        })
    }

    pub async fn revoke(&self, user_id: i32, reservation_id: i32) -> Result<(), String> {
        sqlx::query("DELETE FROM trip_shares WHERE reservation_id=$1 AND user_id=$2")
            .bind(reservation_id)
            .bind(user_id)
            .execute(&self.pool)
            .await
            .map_err(|e| e.to_string())?;
        Ok(())
    }
}
