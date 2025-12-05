// ✅ NOUVEAU Phase 2.4: Service de collaboration en temps réel

use crate::models::collaboration_model::{
    CollaborationAction, CollaborationMessage, CollaborationSession, Collaborator,
    CollaborationMessageType, ConflictResolution,
};
use chrono::Utc;
use log::{error, info, warn};
use redis::Commands;
use serde_json::json;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

pub struct CollaborationService {
    redis_client: Arc<redis::Client>,
    sessions: Arc<RwLock<std::collections::HashMap<String, CollaborationSession>>>,
}

impl CollaborationService {
    pub fn new(redis_url: Option<String>) -> Result<Self, String> {
        let redis_url = redis_url.unwrap_or_else(|| {
            std::env::var("REDIS_URL")
                .unwrap_or_else(|_| "redis://127.0.0.1:6379".to_string())
        });

        let client = redis::Client::open(redis_url.as_str())
            .map_err(|e| format!("Erreur connexion Redis: {}", e))?;

        info!("[CollaborationService] Connexion Redis établie");

        Ok(Self {
            redis_client: Arc::new(client),
            sessions: Arc::new(RwLock::new(std::collections::HashMap::new())),
        })
    }

    /// Crée une nouvelle session de collaboration
    pub async fn create_session(
        &self,
        timeline_id: String,
        owner_id: String,
        owner_username: String,
    ) -> Result<String, String> {
        let session_id = Uuid::new_v4().to_string();

        let collaborator = Collaborator {
            user_id: owner_id.clone(),
            username: owner_username,
            avatar_url: None,
            color: Self::generate_color(&owner_id),
            is_active: true,
            last_seen: Utc::now(),
        };

        let session = CollaborationSession {
            session_id: session_id.clone(),
            timeline_id: timeline_id.clone(),
            owner_id,
            collaborators: vec![collaborator],
            is_active: true,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        // Stocker la session en mémoire
        self.sessions.write().await.insert(session_id.clone(), session);

        // Publier sur Redis pour notifier les autres instances
        self.publish_session_created(&session_id, &timeline_id)
            .await?;

        info!(
            "[CollaborationService] Session créée: {} pour timeline {}",
            session_id, timeline_id
        );

        Ok(session_id)
    }

    /// Rejoint une session de collaboration
    pub async fn join_session(
        &self,
        session_id: &str,
        user_id: String,
        username: String,
    ) -> Result<CollaborationSession, String> {
        let mut sessions = self.sessions.write().await;

        let session = sessions
            .get_mut(session_id)
            .ok_or_else(|| format!("Session {} introuvable", session_id))?;

        // Vérifier si l'utilisateur n'est pas déjà dans la session
        if session
            .collaborators
            .iter()
            .any(|c| c.user_id == user_id)
        {
            return Ok(session.clone());
        }

        let collaborator = Collaborator {
            user_id: user_id.clone(),
            username,
            avatar_url: None,
            color: Self::generate_color(&user_id),
            is_active: true,
            last_seen: Utc::now(),
        };

        session.collaborators.push(collaborator);
        session.updated_at = Utc::now();

        let session_clone = session.clone();
        drop(sessions);

        // Publier le join sur Redis
        self.publish_message(CollaborationMessage {
            message_type: CollaborationMessageType::Join,
            user_id,
            session_id: session_id.to_string(),
            data: None,
            timestamp: Utc::now(),
        })
        .await?;

        info!(
            "[CollaborationService] Utilisateur rejoint session: {}",
            session_id
        );

        Ok(session_clone)
    }

    /// Quitte une session de collaboration
    pub async fn leave_session(
        &self,
        session_id: &str,
        user_id: String,
    ) -> Result<(), String> {
        let mut sessions = self.sessions.write().await;

        if let Some(session) = sessions.get_mut(session_id) {
            session.collaborators.retain(|c| c.user_id != user_id);
            session.updated_at = Utc::now();
        }

        drop(sessions);

        // Publier le leave sur Redis
        self.publish_message(CollaborationMessage {
            message_type: CollaborationMessageType::Leave,
            user_id,
            session_id: session_id.to_string(),
            data: None,
            timestamp: Utc::now(),
        })
        .await?;

        info!(
            "[CollaborationService] Utilisateur quitte session: {}",
            session_id
        );

        Ok(())
    }

    /// Publie une action de collaboration
    pub async fn publish_action(
        &self,
        session_id: &str,
        action: CollaborationAction,
    ) -> Result<(), String> {
        let message = CollaborationMessage {
            message_type: CollaborationMessageType::Action,
            user_id: action.user_id.clone(),
            session_id: session_id.to_string(),
            data: Some(serde_json::to_value(&action).map_err(|e| e.to_string())?),
            timestamp: Utc::now(),
        };

        self.publish_message(message).await?;

        Ok(())
    }

    /// Publie un message sur Redis
    async fn publish_message(&self, message: CollaborationMessage) -> Result<(), String> {
        let channel = format!("collaboration:{}", message.session_id);
        let payload = serde_json::to_string(&message)
            .map_err(|e| format!("Erreur sérialisation message: {}", e))?;

        // Utiliser une connexion async pour publier
        let mut conn = self
            .redis_client
            .get_async_connection()
            .await
            .map_err(|e| format!("Erreur connexion Redis: {}", e))?;

        redis::cmd("PUBLISH")
            .arg(&channel)
            .arg(&payload)
            .query_async::<_, ()>(&mut conn)
            .await
            .map_err(|e| format!("Erreur publication Redis: {}", e))?;

        Ok(())
    }

    /// Publie la création d'une session
    async fn publish_session_created(
        &self,
        session_id: &str,
        timeline_id: &str,
    ) -> Result<(), String> {
        let channel = "collaboration:sessions";
        let payload = serde_json::json!({
            "event": "session_created",
            "session_id": session_id,
            "timeline_id": timeline_id,
        });

        let mut conn = self
            .redis_client
            .get_async_connection()
            .await
            .map_err(|e| format!("Erreur connexion Redis: {}", e))?;

        redis::cmd("PUBLISH")
            .arg(&channel)
            .arg(serde_json::to_string(&payload).unwrap())
            .query_async::<_, ()>(&mut conn)
            .await
            .map_err(|e| format!("Erreur publication Redis: {}", e))?;

        Ok(())
    }

    /// Génère une couleur unique pour un utilisateur
    fn generate_color(user_id: &str) -> String {
        // Générer une couleur basée sur l'ID utilisateur
        let hash = user_id.chars().map(|c| c as u32).sum::<u32>();
        let hue = hash % 360;
        format!("hsl({}, 70%, 50%)", hue)
    }

    /// Résout un conflit
    pub fn resolve_conflict(
        &self,
        action1: &CollaborationAction,
        action2: &CollaborationAction,
        resolution: ConflictResolution,
    ) -> Result<CollaborationAction, String> {
        match resolution {
            ConflictResolution::LastWriteWins => {
                // Retourner l'action la plus récente
                Ok(if action1.timestamp > action2.timestamp {
                    action1.clone()
                } else {
                    action2.clone()
                })
            }
            ConflictResolution::Merge => {
                // Tenter de merger les deux actions
                // Pour l'instant, retourner la plus récente
                warn!(
                    "[CollaborationService] Merge non implémenté, utilisation last-write-wins"
                );
                Ok(if action1.timestamp > action2.timestamp {
                    action1.clone()
                } else {
                    action2.clone()
                })
            }
            ConflictResolution::Manual => {
                // Nécessite une résolution manuelle
                Err("Résolution manuelle requise".to_string())
            }
        }
    }

    /// ✅ NOUVEAU Phase 4: Met à jour la position du cursor d'un utilisateur
    pub async fn update_cursor(
        &self,
        timeline_id: &str,
        user_id: String,
        position_seconds: f64,
    ) -> Result<(), String> {
        info!(
            "[CollaborationService] Mise à jour cursor - timeline: {}, user: {}, position: {}s",
            timeline_id, user_id, position_seconds
        );

        // Publier sur Redis pour synchronisation temps réel
        let cursor_message = CollaborationMessage {
            message_type: CollaborationMessageType::CursorUpdate,
            user_id: user_id.clone(),
            session_id: timeline_id.to_string(),
            data: Some(json!({
                "position_seconds": position_seconds,
                "timestamp": Utc::now().timestamp_millis()
            })),
            timestamp: Utc::now(),
        };

        self.publish_message(cursor_message).await?;

        // ✅ NOUVEAU Phase 4: Sauvegarder dans Redis avec expiration (5 secondes)
        let mut conn = self.redis_client.get_connection()
            .map_err(|e| format!("Erreur connexion Redis: {}", e))?;

        let cursor_key = format!("timeline:{}:cursors", timeline_id);
        let _: () = conn.hset(&cursor_key, &user_id, position_seconds.to_string())
            .map_err(|e| format!("Erreur sauvegarde cursor Redis: {}", e))?;
        
        // Expirer après 5 secondes d'inactivité
        let _: () = conn.expire(&cursor_key, 5)
            .map_err(|e| format!("Erreur expiration cursor: {}", e))?;

        Ok(())
    }

    /// ✅ NOUVEAU Phase 4: Récupère tous les cursors actifs pour une timeline
    pub async fn get_active_cursors(
        &self,
        timeline_id: &str,
    ) -> Result<Vec<(String, f64)>, String> {
        // Récupérer depuis Redis (cursors actifs des 5 dernières secondes)
        let mut conn = self.redis_client.get_connection()
            .map_err(|e| format!("Erreur connexion Redis: {}", e))?;

        let cursor_key = format!("timeline:{}:cursors", timeline_id);
        let cursors: Vec<(String, f64)> = conn
            .hgetall::<String, HashMap<String, String>>(cursor_key)
            .map_err(|e| format!("Erreur récupération cursors: {}", e))?
            .into_iter()
            .map(|(user_id, position_str)| {
                let position = position_str.parse::<f64>().unwrap_or(0.0);
                (user_id, position)
            })
            .collect();

        Ok(cursors)
    }

    /// ✅ NOUVEAU Phase 4: Ajoute un commentaire sur la timeline
    pub async fn add_comment(
        &self,
        timeline_id: &str,
        user_id: String,
        comment_text: String,
        timestamp_seconds: Option<f64>,
        clip_id: Option<String>,
        parent_comment_id: Option<i64>,
    ) -> Result<i64, String> {
        info!(
            "[CollaborationService] Ajout commentaire - timeline: {}, user: {}",
            timeline_id, user_id
        );

        // Générer un ID de commentaire
        let comment_id = Uuid::new_v4().as_simple().to_string().parse::<i64>()
            .unwrap_or(chrono::Utc::now().timestamp());

        // ✅ NOUVEAU Phase 4: Sauvegarder dans Redis (structure prête pour SQL)
        let mut conn = self.redis_client.get_connection()
            .map_err(|e| format!("Erreur connexion Redis: {}", e))?;

        let comment_key = format!("timeline:{}:comments:{}", timeline_id, comment_id);
        let comment_data = json!({
            "id": comment_id,
            "timeline_id": timeline_id,
            "user_id": user_id,
            "comment_text": comment_text,
            "timestamp_seconds": timestamp_seconds,
            "clip_id": clip_id,
            "parent_comment_id": parent_comment_id,
            "created_at": Utc::now().timestamp_millis()
        });

        let _: () = conn.set(&comment_key, serde_json::to_string(&comment_data).unwrap_or_default())
            .map_err(|e| format!("Erreur sauvegarde commentaire Redis: {}", e))?;

        // Ajouter à la liste des commentaires de la timeline
        let comments_list_key = format!("timeline:{}:comments", timeline_id);
        let _: () = conn.lpush(&comments_list_key, comment_id)
            .map_err(|e| format!("Erreur ajout liste commentaires: {}", e))?;

        // Publier sur Redis pour notification temps réel
        let comment_message = CollaborationMessage {
            message_type: CollaborationMessageType::Comment,
            user_id: user_id.clone(),
            session_id: timeline_id.to_string(),
            data: Some(comment_data),
            timestamp: Utc::now(),
        };

        self.publish_message(comment_message).await?;

        Ok(comment_id)
    }

    /// ✅ NOUVEAU Phase 4: Résout un commentaire
    pub async fn resolve_comment(
        &self,
        timeline_id: &str,
        comment_id: i64,
        user_id: String,
    ) -> Result<(), String> {
        info!(
            "[CollaborationService] Résolution commentaire - timeline: {}, comment: {}",
            timeline_id, comment_id
        );

        // TODO: Mettre à jour la table timeline_comments via SQL
        // resolved_at = NOW(), resolved_by = user_id

        // Publier sur Redis pour notification
        let resolve_message = CollaborationMessage {
            message_type: CollaborationMessageType::CommentResolved,
            user_id,
            session_id: timeline_id.to_string(),
            data: Some(json!({
                "comment_id": comment_id
            })),
            timestamp: Utc::now(),
        };

        self.publish_message(resolve_message).await?;

        Ok(())
    }

    /// ✅ NOUVEAU Phase 4: Récupère tous les commentaires d'une timeline
    pub async fn get_comments(
        &self,
        timeline_id: &str,
        clip_id: Option<String>,
    ) -> Result<Vec<serde_json::Value>, String> {
        let mut conn = self.redis_client.get_connection()
            .map_err(|e| format!("Erreur connexion Redis: {}", e))?;

        let comments_list_key = format!("timeline:{}:comments", timeline_id);
        let comment_ids: Vec<String> = conn.lrange(&comments_list_key, 0, -1)
            .map_err(|e| format!("Erreur récupération liste commentaires: {}", e))?;

        let mut comments = Vec::new();
        for comment_id_str in comment_ids {
            let comment_key = format!("timeline:{}:comments:{}", timeline_id, comment_id_str);
            if let Ok(comment_json_str) = conn.get::<String, String>(comment_key) {
                if let Ok(comment_data) = serde_json::from_str::<Value>(&comment_json_str) {
                    // Filtrer par clip_id si fourni
                    if let Some(clip) = clip_id.as_ref() {
                        if comment_data.get("clip_id").and_then(|v| v.as_str()) != Some(clip) {
                            continue;
                        }
                    }
                    comments.push(comment_data);
                }
            }
        }

        // Trier par timestamp décroissant
        comments.sort_by(|a, b| {
            let ts_a = a.get("created_at").and_then(|v| v.as_i64()).unwrap_or(0);
            let ts_b = b.get("created_at").and_then(|v| v.as_i64()).unwrap_or(0);
            ts_b.cmp(&ts_a)
        });

        Ok(comments)
    }
}

