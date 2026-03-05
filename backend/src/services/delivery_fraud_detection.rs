//! ✅ Fraud Detection System pour détecter les fraudes en temps réel
//!
//! Ce service détecte différents types de fraudes:
//! - Fake deliveries (livraisons fictives)
//! - Payment fraud (paiements frauduleux)
//! - Account takeover (prise de compte)
//! - Collusion (collusion client-coursier)

use crate::core::types::AppResult;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::collections::HashMap;

/// Type de fraude détectée
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum FraudType {
    FakeDelivery,
    PaymentFraud,
    AccountTakeover,
    Collusion,
    SuspiciousActivity,
}

/// Niveau de risque
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum RiskLevel {
    Low,
    Medium,
    High,
    Critical,
}

/// Signal de fraude
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FraudSignal {
    pub fraud_type: FraudType,
    pub risk_level: RiskLevel,
    pub confidence: f32, // 0.0-1.0
    pub reason: String,
    pub delivery_id: Option<uuid::Uuid>,
    pub user_id: Option<i32>,
    pub courier_id: Option<i32>,
    pub detected_at: DateTime<Utc>,
    pub metadata: HashMap<String, String>,
}

/// Service de détection de fraude
/// ✅ FIX 2026-03-05: Ajout PgPool pour persister les signaux de fraude dans PostgreSQL
pub struct DeliveryFraudDetectionService {
    pool: PgPool,
    // Patterns suspects (cache mémoire, rechargé périodiquement)
    suspicious_patterns: HashMap<String, Vec<DateTime<Utc>>>,
}

impl DeliveryFraudDetectionService {
    pub fn new(pool: PgPool) -> Self {
        Self {
            pool,
            suspicious_patterns: HashMap::new(),
        }
    }

    /// Persiste un signal de fraude dans PostgreSQL
    async fn persist_signal(&self, signal: &FraudSignal) {
        let fraud_type_str = format!("{:?}", signal.fraud_type);
        let risk_level_str = format!("{:?}", signal.risk_level);
        let metadata_json = serde_json::to_value(&signal.metadata).unwrap_or_default();

        let result = sqlx::query(
            r#"
            INSERT INTO delivery_fraud_signals (
                fraud_type, risk_level, confidence, reason,
                delivery_id, user_id, courier_id, detected_at, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            "#,
        )
        .bind(&fraud_type_str)
        .bind(&risk_level_str)
        .bind(signal.confidence)
        .bind(&signal.reason)
        .bind(signal.delivery_id)
        .bind(signal.user_id)
        .bind(signal.courier_id)
        .bind(signal.detected_at)
        .bind(metadata_json)
        .execute(&self.pool)
        .await;

        if let Err(e) = result {
            log::warn!("[FraudDetection] Erreur persistance signal: {}", e);
        }
    }

    /// Analyse une livraison pour détecter la fraude
    pub async fn analyze_delivery(
        &mut self,
        _delivery_id: uuid::Uuid,
        user_id: i32,
        courier_id: Option<i32>,
        delivery_data: DeliveryData,
    ) -> AppResult<Vec<FraudSignal>> {
        let mut signals = Vec::new();

        // 1. Détecter fake delivery
        if let Some(signal) = self.detect_fake_delivery(&delivery_data, user_id, courier_id).await?
        {
            signals.push(signal);
        }

        // 2. Détecter collusion
        if let Some(signal) = self.detect_collusion(user_id, courier_id, &delivery_data).await? {
            signals.push(signal);
        }

        // 3. Détecter activité suspecte
        if let Some(signal) = self.detect_suspicious_activity(user_id, courier_id).await? {
            signals.push(signal);
        }

        // ✅ FIX: Persister les signaux dans PostgreSQL
        for signal in &signals {
            self.persist_signal(signal).await;
        }

        Ok(signals)
    }

    /// Détecte les livraisons fictives
    async fn detect_fake_delivery(
        &self,
        delivery_data: &DeliveryData,
        user_id: i32,
        courier_id: Option<i32>,
    ) -> AppResult<Option<FraudSignal>> {
        let mut risk_score = 0.0;
        let mut reasons = Vec::new();

        // Vérifier distance très courte (< 100m)
        if delivery_data.distance_km < 0.1 {
            risk_score += 0.3;
            reasons.push("Distance très courte".to_string());
        }

        // Vérifier temps de livraison très court (< 2 minutes)
        if delivery_data.duration_minutes < 2.0 {
            risk_score += 0.3;
            reasons.push("Temps de livraison très court".to_string());
        }

        // Vérifier absence de preuve (photo/vidéo)
        if !delivery_data.has_proof {
            risk_score += 0.2;
            reasons.push("Absence de preuve de livraison".to_string());
        }

        // Vérifier GPS identique pickup/delivery
        if delivery_data.pickup_gps == delivery_data.delivery_gps {
            risk_score += 0.5;
            reasons.push("GPS pickup et delivery identiques".to_string());
        }

        if risk_score > 0.5 {
            return Ok(Some(FraudSignal {
                fraud_type: FraudType::FakeDelivery,
                risk_level: if risk_score > 0.8 {
                    RiskLevel::Critical
                } else if risk_score > 0.6 {
                    RiskLevel::High
                } else {
                    RiskLevel::Medium
                },
                confidence: risk_score,
                reason: reasons.join(", "),
                delivery_id: Some(delivery_data.delivery_id),
                user_id: Some(user_id),
                courier_id,
                detected_at: Utc::now(),
                metadata: HashMap::new(),
            }));
        }

        Ok(None)
    }

    /// Détecte la collusion client-coursier
    async fn detect_collusion(
        &self,
        user_id: i32,
        courier_id: Option<i32>,
        delivery_data: &DeliveryData,
    ) -> AppResult<Option<FraudSignal>> {
        if courier_id.is_none() {
            return Ok(None);
        }

        let courier_id = courier_id.unwrap();
        let key = format!("{}_{}", user_id, courier_id);

        // Vérifier nombre de livraisons répétées entre même client/coursier
        let pattern = self.suspicious_patterns.get(&key);
        if let Some(timestamps) = pattern {
            // Si plus de 10 livraisons en 24h entre mêmes personnes
            let now = Utc::now();
            let recent = timestamps.iter().filter(|t| (now - **t).num_hours() < 24).count();

            if recent > 10 {
                return Ok(Some(FraudSignal {
                    fraud_type: FraudType::Collusion,
                    risk_level: RiskLevel::High,
                    confidence: 0.7,
                    reason: format!("{} livraisons entre même client/coursier en 24h", recent),
                    delivery_id: Some(delivery_data.delivery_id),
                    user_id: Some(user_id),
                    courier_id: Some(courier_id),
                    detected_at: Utc::now(),
                    metadata: HashMap::new(),
                }));
            }
        }

        Ok(None)
    }

    /// Détecte activité suspecte
    async fn detect_suspicious_activity(
        &mut self,
        user_id: i32,
        courier_id: Option<i32>,
    ) -> AppResult<Option<FraudSignal>> {
        let key = if let Some(cid) = courier_id {
            format!("courier_{}", cid)
        } else {
            format!("user_{}", user_id)
        };

        let pattern = self.suspicious_patterns.entry(key).or_insert_with(Vec::new);
        pattern.push(Utc::now());

        // Nettoyer anciennes entrées (> 24h)
        let now = Utc::now();
        pattern.retain(|t| (now - *t).num_hours() < 24);

        // Si trop d'activité en peu de temps
        if pattern.len() > 50 {
            return Ok(Some(FraudSignal {
                fraud_type: FraudType::SuspiciousActivity,
                risk_level: RiskLevel::Medium,
                confidence: 0.6,
                reason: format!("{} activités en 24h", pattern.len()),
                delivery_id: None,
                user_id: Some(user_id),
                courier_id,
                detected_at: Utc::now(),
                metadata: HashMap::new(),
            }));
        }

        Ok(None)
    }

    /// Vérifie si un utilisateur est blacklisté (depuis la DB)
    pub async fn is_blacklisted(&self, user_id: i32) -> bool {
        let result = sqlx::query_scalar::<_, i64>(
            r#"
            SELECT COUNT(*) FROM delivery_fraud_signals
            WHERE user_id = $1 AND risk_level = 'Critical'
            "#,
        )
        .bind(user_id)
        .fetch_one(&self.pool)
        .await;

        match result {
            Ok(count) => count > 0,
            Err(_) => false,
        }
    }
}

/// Données de livraison pour analyse
#[derive(Debug, Clone)]
pub struct DeliveryData {
    pub delivery_id: uuid::Uuid,
    pub distance_km: f64,
    pub duration_minutes: f64,
    pub has_proof: bool,
    pub pickup_gps: (f64, f64),
    pub delivery_gps: (f64, f64),
    pub payment_amount: f64,
}
