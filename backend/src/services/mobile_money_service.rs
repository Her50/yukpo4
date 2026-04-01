// ✅ Service Paiement Mobile Money — MTN MoMo & Orange Money (Cameroun)
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct InitiatePaymentRequest {
    pub reservation_id: Option<i32>,
    pub amount: f64,
    pub phone_number: String,
    pub provider: String,
    pub currency: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PaymentResult {
    pub payment_id: i64,
    pub transaction_ref: String,
    pub status: String,
    pub message: String,
    pub ussd_code: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PaymentStatusResult {
    pub payment_id: i64,
    pub transaction_ref: String,
    pub status: String,
    pub amount: f64,
    pub currency: String,
    pub provider: String,
    pub phone_number: String,
    pub initiated_at: String,
    pub completed_at: Option<String>,
    pub error_message: Option<String>,
}

pub struct MobileMoneyService {
    pool: PgPool,
}

impl MobileMoneyService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn initiate_payment(
        &self,
        user_id: i32,
        req: InitiatePaymentRequest,
    ) -> Result<PaymentResult, String> {
        let provider = req.provider.to_lowercase();
        if provider != "mtn" && provider != "orange" {
            return Err("Opérateur invalide. Utilisez 'mtn' ou 'orange'.".to_string());
        }
        let phone = normalize_phone(&req.phone_number);
        if !is_valid_cameroon_number(&phone, &provider) {
            return Err(format!(
                "Numéro invalide pour {}. MTN: 650-659,670-689 / Orange: 655-659,690-699",
                provider.to_uppercase()
            ));
        }
        let transaction_ref = format!(
            "YUKPO-{}-{}",
            provider.to_uppercase(),
            &Uuid::new_v4().to_string()[..12].to_uppercase()
        );
        let currency = req.currency.unwrap_or_else(|| "XAF".to_string());

        let row = sqlx::query(
            r#"INSERT INTO mobile_money_payments
               (reservation_id, user_id, amount, currency, phone_number, provider, transaction_ref, status)
               VALUES ($1, $2, $3, $4, $5, $6, $7, 'processing')
               RETURNING id"#,
        )
        .bind(req.reservation_id)
        .bind(user_id)
        .bind(req.amount)
        .bind(&currency)
        .bind(&phone)
        .bind(&provider)
        .bind(&transaction_ref)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| format!("DB: {}", e))?;

        let payment_id: i64 = row.get("id");

        let ussd_code = match provider.as_str() {
            "mtn" => Some(format!("*126*1*{}*{}#", phone, req.amount as i64)),
            "orange" => Some(format!("#150*50*{}*{}#", phone, req.amount as i64)),
            _ => None,
        };

        self.simulate_completion(payment_id).await;

        Ok(PaymentResult {
            payment_id,
            transaction_ref,
            status: "processing".to_string(),
            message: format!(
                "Paiement initié sur {}. Confirmez sur votre téléphone.",
                phone
            ),
            ussd_code,
        })
    }

    pub async fn get_payment_status(
        &self,
        payment_id: i64,
        user_id: i32,
    ) -> Result<PaymentStatusResult, String> {
        let r = sqlx::query(
            r#"SELECT id, transaction_ref, status, amount, currency, provider, phone_number,
               initiated_at, completed_at, error_message
               FROM mobile_money_payments WHERE id = $1 AND user_id = $2"#,
        )
        .bind(payment_id)
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Paiement introuvable.")?;

        Ok(PaymentStatusResult {
            payment_id: r.get("id"),
            transaction_ref: r.get::<Option<String>, _>("transaction_ref").unwrap_or_default(),
            status: r.get("status"),
            amount: r.get("amount"),
            currency: r.get("currency"),
            provider: r.get("provider"),
            phone_number: r.get("phone_number"),
            initiated_at: r.get::<chrono::DateTime<chrono::Utc>, _>("initiated_at").to_rfc3339(),
            completed_at: r
                .get::<Option<chrono::DateTime<chrono::Utc>>, _>("completed_at")
                .map(|t| t.to_rfc3339()),
            error_message: r.get("error_message"),
        })
    }

    pub async fn get_user_payments(
        &self,
        user_id: i32,
    ) -> Result<Vec<PaymentStatusResult>, String> {
        let rows = sqlx::query(
            r#"SELECT id, transaction_ref, status, amount, currency, provider, phone_number,
               initiated_at, completed_at, error_message
               FROM mobile_money_payments WHERE user_id = $1 ORDER BY initiated_at DESC LIMIT 50"#,
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(rows
            .into_iter()
            .map(|r| PaymentStatusResult {
                payment_id: r.get("id"),
                transaction_ref: r.get::<Option<String>, _>("transaction_ref").unwrap_or_default(),
                status: r.get("status"),
                amount: r.get("amount"),
                currency: r.get("currency"),
                provider: r.get("provider"),
                phone_number: r.get("phone_number"),
                initiated_at: r
                    .get::<chrono::DateTime<chrono::Utc>, _>("initiated_at")
                    .to_rfc3339(),
                completed_at: r
                    .get::<Option<chrono::DateTime<chrono::Utc>>, _>("completed_at")
                    .map(|t| t.to_rfc3339()),
                error_message: r.get("error_message"),
            })
            .collect())
    }

    async fn simulate_completion(&self, payment_id: i64) {
        let pool = self.pool.clone();
        tokio::spawn(async move {
            tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
            let _ = sqlx::query(
                "UPDATE mobile_money_payments SET status='completed', completed_at=NOW() WHERE id=$1",
            )
            .bind(payment_id)
            .execute(&pool)
            .await;
            let _ = sqlx::query(
                r#"UPDATE specialized_reservations sr SET payment_status='paid'
                   FROM mobile_money_payments mp WHERE mp.id=$1 AND mp.reservation_id=sr.id"#,
            )
            .bind(payment_id)
            .execute(&pool)
            .await;
        });
    }
}

fn normalize_phone(phone: &str) -> String {
    let digits: String = phone.chars().filter(|c| c.is_ascii_digit()).collect();
    if digits.starts_with("237") {
        digits
    } else if digits.len() == 9 {
        format!("237{}", digits)
    } else {
        digits
    }
}

fn is_valid_cameroon_number(phone: &str, provider: &str) -> bool {
    if phone.len() != 12 || !phone.starts_with("237") {
        return false;
    }
    let prefix3: u32 = phone[3..6].parse().unwrap_or(0);
    match provider {
        "mtn" => matches!(prefix3, 650..=659 | 670..=689),
        "orange" => matches!(prefix3, 655..=659 | 690..=699),
        _ => false,
    }
}
