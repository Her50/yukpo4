use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use chrono::{DateTime, Utc};
use uuid::Uuid;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserStatus {
    pub user_id: i32,
    pub is_online: bool,
    pub last_seen: DateTime<Utc>,
    pub connection_id: Option<Uuid>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatusUpdate {
    pub user_id: i32,
    pub is_online: bool,
    pub timestamp: DateTime<Utc>,
}

pub struct StatusManager {
    users: Arc<RwLock<HashMap<i32, UserStatus>>>,
    connections: Arc<RwLock<HashMap<Uuid, i32>>>,
}

impl StatusManager {
    pub fn new() -> Self {
        Self {
            users: Arc::new(RwLock::new(HashMap::new())),
            connections: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn user_connected(&self, user_id: i32, connection_id: Uuid) {
        let mut users = self.users.write().await;
        let mut connections = self.connections.write().await;
        
        // Mettre à jour le statut de l'utilisateur
        users.insert(user_id, UserStatus {
            user_id,
            is_online: true,
            last_seen: Utc::now(),
            connection_id: Some(connection_id),
        });
        
        // Associer la connexion à l'utilisateur
        connections.insert(connection_id, user_id);
        
        log::info!("Utilisateur {} connecté (connexion: {})", user_id, connection_id);
    }

    pub async fn user_disconnected(&self, connection_id: Uuid) {
        let mut users = self.users.write().await;
        let mut connections = self.connections.write().await;
        
        if let Some(user_id) = connections.remove(&connection_id) {
            if let Some(user_status) = users.get_mut(&user_id) {
                user_status.is_online = false;
                user_status.last_seen = Utc::now();
                user_status.connection_id = None;
                
                log::info!("Utilisateur {} déconnecté", user_id);
            }
        }
    }

    pub async fn update_user_activity(&self, user_id: i32) {
        let mut users = self.users.write().await;
        if let Some(user_status) = users.get_mut(&user_id) {
            user_status.last_seen = Utc::now();
        }
    }

    pub async fn get_user_status(&self, user_id: i32) -> Option<UserStatus> {
        let users = self.users.read().await;
        users.get(&user_id).cloned()
    }

    pub async fn get_all_online_users(&self) -> Vec<i32> {
        let users = self.users.read().await;
        users
            .iter()
            .filter(|(_, status)| status.is_online)
            .map(|(user_id, _)| *user_id)
            .collect()
    }

    pub async fn cleanup_inactive_users(&self) {
        let mut users = self.users.write().await;
        let now = Utc::now();
        let timeout = chrono::Duration::minutes(5); // 5 minutes
        
        users.retain(|_, status| {
            if status.is_online && now.signed_duration_since(status.last_seen) > timeout {
                log::info!("Utilisateur {} marqué comme inactif", status.user_id);
                status.is_online = false;
            }
            true
        });
    }

    pub async fn broadcast_status_update(&self, user_id: i32, is_online: bool) -> StatusUpdate {
        StatusUpdate {
            user_id,
            is_online,
            timestamp: Utc::now(),
        }
    }
}

impl Default for StatusManager {
    fn default() -> Self {
        Self::new()
    }
}

// Tâche de nettoyage périodique
pub async fn start_cleanup_task(status_manager: Arc<StatusManager>) {
    let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(60)); // Toutes les minutes
    
    loop {
        interval.tick().await;
        status_manager.cleanup_inactive_users().await;
    }
} 