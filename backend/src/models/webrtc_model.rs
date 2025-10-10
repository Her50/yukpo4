use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

/// Type de message WebRTC signaling
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum SignalingMessageType {
    /// Offre SDP d'un pair
    Offer,
    /// Réponse SDP d'un pair
    Answer,
    /// Candidat ICE
    IceCandidate,
    /// Appel rejeté
    CallRejected,
    /// Appel terminé
    CallEnded,
    /// Ping pour maintenir la connexion
    Ping,
    /// Pong en réponse au ping
    Pong,
}

/// Message de signaling WebRTC
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignalingMessage {
    /// Type de message
    #[serde(rename = "type")]
    pub message_type: SignalingMessageType,
    
    /// ID de l'utilisateur expéditeur
    pub from: String,
    
    /// ID de l'utilisateur destinataire
    pub to: String,
    
    /// Description de session (SDP) pour offer/answer
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sdp: Option<serde_json::Value>,
    
    /// Candidat ICE
    #[serde(skip_serializing_if = "Option::is_none")]
    pub candidate: Option<serde_json::Value>,
    
    /// Type d'appel (audio/video)
    #[serde(rename = "callType", skip_serializing_if = "Option::is_none")]
    pub call_type: Option<String>,
    
    /// ID du service lié (optionnel)
    #[serde(rename = "serviceId", skip_serializing_if = "Option::is_none")]
    pub service_id: Option<String>,
    
    /// Timestamp du message
    #[serde(default = "Utc::now")]
    pub timestamp: DateTime<Utc>,
}

/// État d'un pair WebRTC
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeerState {
    /// ID de l'utilisateur
    pub user_id: String,
    
    /// Est en ligne
    pub is_online: bool,
    
    /// Est en appel
    pub is_in_call: bool,
    
    /// ID de l'appel en cours
    #[serde(skip_serializing_if = "Option::is_none")]
    pub current_call_id: Option<String>,
    
    /// Timestamp de la dernière activité
    pub last_activity: DateTime<Utc>,
}

/// Réponse d'erreur WebRTC
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignalingError {
    pub error: String,
    pub message: String,
    pub timestamp: DateTime<Utc>,
}

impl SignalingError {
    pub fn new(error: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            error: error.into(),
            message: message.into(),
            timestamp: Utc::now(),
        }
    }
}

