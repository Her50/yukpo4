// ✅ NOUVEAU Phase 2.4: Modèle pour collaboration en temps réel

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Collaborator {
    pub user_id: String,
    pub username: String,
    pub avatar_url: Option<String>,
    pub color: String, // Couleur pour identifier le collaborateur
    pub is_active: bool,
    pub last_seen: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollaborationCursor {
    pub user_id: String,
    pub position: CursorPosition,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CursorPosition {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum CollaborationActionType {
    ClipAdded,
    ClipDeleted,
    ClipMoved,
    EffectApplied,
    TextChanged,
    KeyframeUpdated,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollaborationAction {
    pub id: String,
    pub user_id: String,
    pub action_type: CollaborationActionType,
    pub timeline_id: String,
    pub data: serde_json::Value,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollaborationSession {
    pub session_id: String,
    pub timeline_id: String,
    pub owner_id: String,
    pub collaborators: Vec<Collaborator>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum CollaborationMessageType {
    Join,
    Leave,
    CursorMove,
    CursorUpdate,    // ✅ NOUVEAU Phase 4: Mise à jour cursor
    Comment,         // ✅ NOUVEAU Phase 4: Nouveau commentaire
    CommentResolved, // ✅ NOUVEAU Phase 4: Commentaire résolu
    Action,
    Sync,
    Conflict,
    Ping,
    Pong,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollaborationMessage {
    pub message_type: CollaborationMessageType,
    pub user_id: String,
    pub session_id: String,
    pub data: Option<serde_json::Value>,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollaborationConflict {
    pub conflict_id: String,
    pub user_id: String,
    pub action: CollaborationAction,
    pub resolution: ConflictResolution,
    pub resolved_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ConflictResolution {
    LastWriteWins,
    Merge,
    Manual,
}
