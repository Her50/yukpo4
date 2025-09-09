use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use chrono::{DateTime, Utc};
use crate::core::types::AppResult;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TypingStatus {
    pub user_id: i32,
    pub chat_id: String,
    pub is_typing: bool,
    pub last_activity: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TypingEvent {
    pub event_type: String, // "start_typing", "stop_typing"
    pub user_id: i32,
    pub chat_id: String,
    pub timestamp: DateTime<Utc>,
}

pub struct TypingStatusService {
    typing_users: Arc<RwLock<HashMap<String, HashMap<i32, TypingStatus>>>>,
}

impl TypingStatusService {
    pub fn new() -> Self {
        Self {
            typing_users: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Démarrer le statut de frappe
    pub async fn start_typing(&self, user_id: i32, chat_id: String) -> AppResult<()> {
        let mut typing = self.typing_users.write().await;
        
        let chat_typing = typing.entry(chat_id.clone()).or_insert_with(HashMap::new);
        
        chat_typing.insert(user_id, TypingStatus {
            user_id,
            chat_id: chat_id.clone(),
            is_typing: true,
            last_activity: Utc::now(),
        });

        log::info!("Utilisateur {} a commencé à taper dans le chat {}", user_id, chat_id);
        Ok(())
    }

    /// Arrêter le statut de frappe
    pub async fn stop_typing(&self, user_id: i32, chat_id: String) -> AppResult<()> {
        let mut typing = self.typing_users.write().await;
        
        if let Some(chat_typing) = typing.get_mut(&chat_id) {
            chat_typing.remove(&user_id);
            
            // Si le chat est vide, le supprimer
            if chat_typing.is_empty() {
                typing.remove(&chat_id);
            }
        }

        log::info!("Utilisateur {} a arrêté de taper dans le chat {}", user_id, chat_id);
        Ok(())
    }

    /// Obtenir le statut de frappe pour un chat
    pub async fn get_typing_status(&self, chat_id: &str) -> Vec<TypingStatus> {
        let typing = self.typing_users.read().await;
        
        if let Some(chat_typing) = typing.get(chat_id) {
            chat_typing.values().cloned().collect()
        } else {
            Vec::new()
        }
    }

    /// Nettoyer les statuts de frappe expirés
    pub async fn cleanup_expired_typing(&self) {
        let mut typing = self.typing_users.write().await;
        let now = Utc::now();
        let timeout = chrono::Duration::seconds(30); // 30 secondes d'inactivité

        for (chat_id, chat_typing) in typing.iter_mut() {
            chat_typing.retain(|_, status| {
                let is_expired = now.signed_duration_since(status.last_activity) > timeout;
                if is_expired {
                    log::debug!("Statut de frappe expiré pour l'utilisateur {} dans le chat {}", 
                               status.user_id, chat_id);
                }
                !is_expired
            });
        }

        // Supprimer les chats vides
        typing.retain(|_, chat_typing| !chat_typing.is_empty());
    }

    /// Mettre à jour l'activité de frappe
    pub async fn update_typing_activity(&self, user_id: i32, chat_id: String) -> AppResult<()> {
        let mut typing = self.typing_users.write().await;
        
        if let Some(chat_typing) = typing.get_mut(&chat_id) {
            if let Some(status) = chat_typing.get_mut(&user_id) {
                status.last_activity = Utc::now();
            }
        }

        Ok(())
    }

    /// Obtenir tous les utilisateurs qui tapent actuellement
    pub async fn get_all_typing_users(&self) -> HashMap<String, Vec<i32>> {
        let typing = self.typing_users.read().await;
        
        typing.iter()
            .map(|(chat_id, chat_typing)| {
                let user_ids: Vec<i32> = chat_typing.keys().cloned().collect();
                (chat_id.clone(), user_ids)
            })
            .collect()
    }
}

// Tâche de nettoyage périodique
pub async fn start_typing_cleanup_task(service: Arc<TypingStatusService>) {
    let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(60)); // Toutes les minutes
    
    loop {
        interval.tick().await;
        service.cleanup_expired_typing().await;
    }
} 