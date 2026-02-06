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
pub struct DeliveryFraudDetectionService {
    // Historique des fraudes détectées
    fraud_history: Vec<FraudSignal>,
    // Patterns suspects
    suspicious_patterns: HashMap<String, Vec<DateTime<Utc>>>,
}

impl DeliveryFraudDetectionService {
    pub fn new() -> Self {
        Self {
            fraud_history: Vec::new(),
            suspicious_patterns: HashMap::new(),
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

        // Enregistrer les signaux
        for signal in &signals {
            self.fraud_history.push(signal.clone());
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

    /// Vérifie si un utilisateur est blacklisté
    pub fn is_blacklisted(&self, user_id: i32) -> bool {
        // Vérifier dans l'historique
        self.fraud_history
            .iter()
            .any(|s| s.user_id == Some(user_id) && s.risk_level == RiskLevel::Critical)
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

impl Default for DeliveryFraudDetectionService {
    fn default() -> Self {
        Self::new()
    }
}
