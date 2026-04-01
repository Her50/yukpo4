// ✅ Service Programme Fidélité — points sur trajets, récompenses, coupons
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};
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

pub const POINTS_TRIP_COMPLETED: i32 = 10;
pub const POINTS_RATING_GIVEN: i32 = 5;
pub const POINTS_REFERRAL: i32 = 50;
pub const POINTS_FIRST_TRIP: i32 = 20;

pub struct LoyaltyService {
    pool: PgPool,
}

impl LoyaltyService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn credit(
        &self,
        user_id: i32,
        points: i32,
        action: &str,
        reference_id: Option<i32>,
        desc: Option<&str>,
    ) -> Result<i64, String> {
        let row = sqlx::query(
            "INSERT INTO loyalty_points (user_id, points, action, reference_id, description) VALUES ($1,$2,$3,$4,$5) RETURNING id",
        )
        .bind(user_id)
        .bind(points)
        .bind(action)
        .bind(reference_id)
        .bind(desc)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| format!("DB: {}", e))?;
        Ok(row.get("id"))
    }

    pub async fn get_balance(&self, user_id: i32) -> Result<PointsBalance, String> {
        let earned: i64 = sqlx::query_scalar::<_, Option<i64>>(
            "SELECT COALESCE(SUM(points),0) FROM loyalty_points WHERE user_id=$1 AND points > 0",
        )
        .bind(user_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| e.to_string())?
        .unwrap_or(0);

        let spent: i64 = sqlx::query_scalar::<_, Option<i64>>(
            "SELECT COALESCE(SUM(ABS(points)),0) FROM loyalty_points WHERE user_id=$1 AND points < 0",
        )
        .bind(user_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| e.to_string())?
        .unwrap_or(0);

        Ok(PointsBalance {
            user_id,
            balance: earned - spent,
            total_earned: earned,
            total_spent: spent,
        })
    }

    pub async fn get_history(&self, user_id: i32) -> Result<Vec<PointsEntry>, String> {
        let rows = sqlx::query(
            "SELECT id, points, action, description, created_at FROM loyalty_points WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50",
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(rows
            .into_iter()
            .map(|r| PointsEntry {
                id: r.get("id"),
                points: r.get("points"),
                action: r.get("action"),
                description: r.get("description"),
                created_at: r.get::<chrono::DateTime<chrono::Utc>, _>("created_at").to_rfc3339(),
            })
            .collect())
    }

    pub async fn get_rewards(&self) -> Result<Vec<LoyaltyReward>, String> {
        let rows = sqlx::query(
            "SELECT id, title, description, points_cost, reward_type, reward_value::float8 FROM loyalty_rewards WHERE is_active=true ORDER BY points_cost ASC",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(rows
            .into_iter()
            .map(|r| LoyaltyReward {
                id: r.get("id"),
                title: r.get("title"),
                description: r.get("description"),
                points_cost: r.get("points_cost"),
                reward_type: r.get("reward_type"),
                reward_value: r.get::<Option<f64>, _>("reward_value").unwrap_or(0.0),
            })
            .collect())
    }

    pub async fn redeem(&self, user_id: i32, reward_id: i32) -> Result<Redemption, String> {
        let reward_row = sqlx::query(
            "SELECT id, title, description, points_cost, reward_type, reward_value::float8 FROM loyalty_rewards WHERE id=$1 AND is_active=true",
        )
        .bind(reward_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Récompense introuvable ou inactive.")?;

        let reward = LoyaltyReward {
            id: reward_row.get("id"),
            title: reward_row.get("title"),
            description: reward_row.get("description"),
            points_cost: reward_row.get("points_cost"),
            reward_type: reward_row.get("reward_type"),
            reward_value: reward_row.get::<Option<f64>, _>("reward_value").unwrap_or(0.0),
        };

        let balance = self.get_balance(user_id).await?;
        if balance.balance < reward.points_cost as i64 {
            return Err(format!(
                "Solde insuffisant ({} pts). Requis : {} pts.",
                balance.balance, reward.points_cost
            ));
        }

        let coupon = format!("YUKPO-{}", &Uuid::new_v4().to_string()[..8].to_uppercase());

        let red = sqlx::query(
            r#"INSERT INTO loyalty_redemptions (user_id, reward_id, points_spent, coupon_code)
               VALUES ($1,$2,$3,$4) RETURNING id, coupon_code, expires_at"#,
        )
        .bind(user_id)
        .bind(reward_id)
        .bind(reward.points_cost)
        .bind(&coupon)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| format!("DB redemption: {}", e))?;

        self.credit(
            user_id,
            -(reward.points_cost),
            "redemption",
            None,
            Some(&format!("Échange contre : {}", reward.title)),
        )
        .await?;

        Ok(Redemption {
            id: red.get("id"),
            reward,
            coupon_code: red.get("coupon_code"),
            status: "active".to_string(),
            expires_at: red.get::<chrono::DateTime<chrono::Utc>, _>("expires_at").to_rfc3339(),
        })
    }

    pub async fn on_trip_completed(&self, user_id: i32, reservation_id: i32) -> Result<(), String> {
        let trip_count: i64 = sqlx::query_scalar::<_, Option<i64>>(
            "SELECT COUNT(*) FROM loyalty_points WHERE user_id=$1 AND action='trip_completed'",
        )
        .bind(user_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| e.to_string())?
        .unwrap_or(0);

        let pts = if trip_count == 0 {
            POINTS_TRIP_COMPLETED + POINTS_FIRST_TRIP
        } else {
            POINTS_TRIP_COMPLETED
        };
        self.credit(
            user_id,
            pts,
            "trip_completed",
            Some(reservation_id),
            Some("Points gagnés pour trajet terminé"),
        )
        .await?;
        Ok(())
    }
}
