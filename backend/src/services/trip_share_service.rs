// ✅ Service partage trajet temps réel — token public, lien partageable
use sqlx::PgPool;
use serde::{Deserialize, Serialize};

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

pub struct TripShareService { pool: PgPool }

impl TripShareService {
    pub fn new(pool: PgPool) -> Self { Self { pool } }

    /// Crée ou renouvelle un lien de partage pour une réservation
    pub async fn create_share(&self, user_id: i32, reservation_id: i32) -> Result<TripShareInfo, String> {
        // Vérifier que la réservation appartient à l'utilisateur
        let exists = sqlx::query_scalar!(
            "SELECT EXISTS(SELECT 1 FROM specialized_reservations WHERE id=$1 AND user_id=$2)",
            reservation_id, user_id,
        ).fetch_one(&self.pool).await.map_err(|e| e.to_string())?
         .unwrap_or(false);

        if !exists {
            return Err("Réservation introuvable ou non autorisée.".to_string());
        }

        // Upsert — renouveler si déjà existant
        let row = sqlx::query!(
            r#"INSERT INTO trip_shares (reservation_id, user_id)
               VALUES ($1, $2)
               ON CONFLICT (reservation_id) DO UPDATE
                 SET expires_at = NOW() + INTERVAL '24 hours'
               RETURNING token, expires_at"#,
            reservation_id, user_id,
        ).fetch_one(&self.pool).await.map_err(|e| format!("DB: {}", e))?;

        let share_url = format!("https://yukpo.app/track/{}", row.token);

        Ok(TripShareInfo {
            token: row.token.clone(),
            share_url,
            expires_at: row.expires_at.to_rfc3339(),
            reservation_id,
        })
    }

    /// Données publiques du trajet (sans auth) — pour la page de suivi partagée
    pub async fn get_public_data(&self, token: &str) -> Result<PublicTripData, String> {
        // Vérifier que le token est valide et non expiré
        let share = sqlx::query!(
            "SELECT reservation_id, expires_at FROM trip_shares WHERE token=$1 AND expires_at > NOW()",
            token,
        ).fetch_optional(&self.pool).await.map_err(|e| e.to_string())?
         .ok_or("Lien expiré ou invalide.")?;

        // Récupérer les infos de la réservation
        let res = sqlx::query!(
            r#"SELECT sr.status, sr.service_type, sr.reservation_date, sr.reservation_time,
               u.nom, u.prenom, u.telephone,
               ss.name AS service_name,
               sr.details
               FROM specialized_reservations sr
               JOIN users u ON u.id = sr.service_user_id
               JOIN specialized_services ss ON ss.id = sr.service_id
               WHERE sr.id = $1"#,
            share.reservation_id,
        ).fetch_optional(&self.pool).await.map_err(|e| e.to_string())?
         .ok_or("Réservation introuvable.")?;

        // GPS actuel du chauffeur (table taxis)
        let gps = sqlx::query_scalar!(
            r#"SELECT t.gps_actuel FROM taxis t
               JOIN specialized_services ss ON ss.id = t.service_id
               JOIN specialized_reservations sr ON sr.service_id = ss.id
               WHERE sr.id = $1"#,
            share.reservation_id,
        ).fetch_optional(&self.pool).await.unwrap_or(None).flatten();

        let details: serde_json::Value = res.details
            .and_then(|d| serde_json::from_value(d).ok())
            .unwrap_or(serde_json::Value::Null);

        Ok(PublicTripData {
            token: token.to_string(),
            service_type: res.service_type,
            status: res.status,
            driver_name: res.nom.map(|n| format!("{} {}", n, res.prenom.unwrap_or_default())),
            driver_phone: res.telephone,
            gps_actuel: gps,
            reservation_date: res.reservation_date.map(|d| d.to_string()),
            reservation_time: res.reservation_time,
            depart: details.get("depart").and_then(|v| v.as_str()).map(String::from),
            destination: details.get("destination").and_then(|v| v.as_str()).map(String::from),
            expires_at: share.expires_at.to_rfc3339(),
        })
    }

    /// Révoque un lien de partage
    pub async fn revoke(&self, user_id: i32, reservation_id: i32) -> Result<(), String> {
        sqlx::query!(
            "DELETE FROM trip_shares WHERE reservation_id=$1 AND user_id=$2",
            reservation_id, user_id,
        ).execute(&self.pool).await.map_err(|e| e.to_string())?;
        Ok(())
    }
}
