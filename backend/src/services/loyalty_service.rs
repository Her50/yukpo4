// ✅ Service Programme Fidélité — points sur trajets, récompenses, coupons
use sqlx::PgPool;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct PointsBalance {
    pub user_id: i32,
    pub balance: i64,
    pub total_earned: i64,
    pub total_spent: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PointsEntry {
    pub id: i64,
    pub points: i32,
    pub action: String,
    pub description: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LoyaltyReward {
    pub id: i32,
    pub title: String,
    pub description: Option<String>,
    pub points_cost: i32,
    pub reward_type: String,
    pub reward_value: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Redemption {
    pub id: i64,
    pub reward: LoyaltyReward,
    pub coupon_code: String,
    pub status: String,
    pub expires_at: String,
}

/// Points gagnés par action
pub const POINTS_TRIP_COMPLETED: i32  = 10;
pub const POINTS_RATING_GIVEN: i32    = 5;
pub const POINTS_REFERRAL: i32        = 50;
pub const POINTS_FIRST_TRIP: i32      = 20;

pub struct LoyaltyService { pool: PgPool }

impl LoyaltyService {
    pub fn new(pool: PgPool) -> Self { Self { pool } }

    /// Créditer des points
    pub async fn credit(&self, user_id: i32, points: i32, action: &str, reference_id: Option<i32>, desc: Option<&str>) -> Result<i64, String> {
        let row = sqlx::query!(
            "INSERT INTO loyalty_points (user_id, points, action, reference_id, description) VALUES ($1,$2,$3,$4,$5) RETURNING id",
            user_id, points, action, reference_id, desc.map(|s| s.to_string()),
        ).fetch_one(&self.pool).await.map_err(|e| format!("DB: {}", e))?;
        Ok(row.id)
    }

    /// Solde actuel de l'utilisateur
    pub async fn get_balance(&self, user_id: i32) -> Result<PointsBalance, String> {
        let earned: i64 = sqlx::query_scalar!(
            "SELECT COALESCE(SUM(points),0) FROM loyalty_points WHERE user_id=$1 AND points > 0",
            user_id,
        ).fetch_one(&self.pool).await.map_err(|e| e.to_string())?.unwrap_or(0);

        let spent: i64 = sqlx::query_scalar!(
            "SELECT COALESCE(SUM(ABS(points)),0) FROM loyalty_points WHERE user_id=$1 AND points < 0",
            user_id,
        ).fetch_one(&self.pool).await.map_err(|e| e.to_string())?.unwrap_or(0);

        Ok(PointsBalance {
            user_id,
            balance: earned - spent,
            total_earned: earned,
            total_spent: spent,
        })
    }

    /// Historique des mouvements
    pub async fn get_history(&self, user_id: i32) -> Result<Vec<PointsEntry>, String> {
        let rows = sqlx::query!(
            "SELECT id, points, action, description, created_at FROM loyalty_points WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50",
            user_id,
        ).fetch_all(&self.pool).await.map_err(|e| e.to_string())?;

        Ok(rows.into_iter().map(|r| PointsEntry {
            id: r.id, points: r.points, action: r.action,
            description: r.description, created_at: r.created_at.to_rfc3339(),
        }).collect())
    }

    /// Catalogue des récompenses disponibles
    pub async fn get_rewards(&self) -> Result<Vec<LoyaltyReward>, String> {
        let rows = sqlx::query!(
            "SELECT id, title, description, points_cost, reward_type, reward_value::float8 FROM loyalty_rewards WHERE is_active=true ORDER BY points_cost ASC",
        ).fetch_all(&self.pool).await.map_err(|e| e.to_string())?;

        Ok(rows.into_iter().map(|r| LoyaltyReward {
            id: r.id, title: r.title, description: r.description,
            points_cost: r.points_cost, reward_type: r.reward_type,
            reward_value: r.reward_value.unwrap_or(0.0),
        }).collect())
    }

    /// Racheter une récompense contre des points
    pub async fn redeem(&self, user_id: i32, reward_id: i32) -> Result<Redemption, String> {
        let reward = sqlx::query!(
            "SELECT id, title, description, points_cost, reward_type, reward_value::float8 FROM loyalty_rewards WHERE id=$1 AND is_active=true",
            reward_id,
        ).fetch_optional(&self.pool).await.map_err(|e| e.to_string())?
         .ok_or("Récompense introuvable ou inactive.")?;

        let balance = self.get_balance(user_id).await?;
        if balance.balance < reward.points_cost as i64 {
            return Err(format!("Solde insuffisant ({} pts). Requis : {} pts.", balance.balance, reward.points_cost));
        }

        let coupon = format!("YUKPO-{}", &Uuid::new_v4().to_string()[..8].to_uppercase());

        // Transaction atomique
        let red = sqlx::query!(
            r#"INSERT INTO loyalty_redemptions (user_id, reward_id, points_spent, coupon_code)
               VALUES ($1,$2,$3,$4) RETURNING id, coupon_code, expires_at"#,
            user_id, reward_id, reward.points_cost, coupon,
        ).fetch_one(&self.pool).await.map_err(|e| format!("DB redemption: {}", e))?;

        // Débiter les points
        self.credit(user_id, -(reward.points_cost), "redemption", None,
            Some(&format!("Échange contre : {}", reward.title))).await?;

        Ok(Redemption {
            id: red.id,
            reward: LoyaltyReward {
                id: reward.id, title: reward.title, description: reward.description,
                points_cost: reward.points_cost, reward_type: reward.reward_type,
                reward_value: reward.reward_value.unwrap_or(0.0),
            },
            coupon_code: red.coupon_code,
            status: "active".to_string(),
            expires_at: red.expires_at.to_rfc3339(),
        })
    }

    /// Créditer automatiquement à la fin d'un trajet
    pub async fn on_trip_completed(&self, user_id: i32, reservation_id: i32) -> Result<(), String> {
        // 10 pts par trajet, +20 si premier trajet
        let trip_count: i64 = sqlx::query_scalar!(
            "SELECT COUNT(*) FROM loyalty_points WHERE user_id=$1 AND action='trip_completed'",
            user_id,
        ).fetch_one(&self.pool).await.map_err(|e| e.to_string())?.unwrap_or(0);

        let pts = if trip_count == 0 { POINTS_TRIP_COMPLETED + POINTS_FIRST_TRIP }
                  else { POINTS_TRIP_COMPLETED };
        self.credit(user_id, pts, "trip_completed", Some(reservation_id),
            Some("Points gagnés pour trajet terminé")).await?;
        Ok(())
    }
}
