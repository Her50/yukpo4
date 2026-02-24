// ✅ NOUVEAU Phase 10: Service pour mises à jour optimistes avec mécanisme d'annulation
// Mise à jour UI immédiate avec annulation si erreur serveur

use log::{error, info, warn};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimisticAction {
    pub id: String,
    pub action_type: String,
    pub data: Value,
    pub timestamp: i64,
    pub rollback_data: Value, // État avant modification pour annulation
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimisticUpdateRequest {
    pub action_type: String,
    pub data: Value,
    pub rollback_data: Value,
}

pub struct OptimisticUpdateService {
    pending_actions: Arc<RwLock<HashMap<String, OptimisticAction>>>,
    action_history: Arc<RwLock<Vec<OptimisticAction>>>,
}

impl OptimisticUpdateService {
    pub fn new() -> Self {
        Self {
            pending_actions: Arc::new(RwLock::new(HashMap::new())),
            action_history: Arc::new(RwLock::new(Vec::new())),
        }
    }

    /// ✅ NOUVEAU Phase 10: Enregistre une action optimiste
    pub async fn register_optimistic_action(
        &self,
        request: OptimisticUpdateRequest,
    ) -> Result<String, String> {
        let action_id = format!("action_{}", chrono::Utc::now().timestamp_millis());

        let action = OptimisticAction {
            id: action_id.clone(),
            action_type: request.action_type,
            data: request.data,
            timestamp: chrono::Utc::now().timestamp_millis(),
            rollback_data: request.rollback_data,
        };

        // Enregistrer dans pending
        let mut pending = self.pending_actions.write().await;
        pending.insert(action_id.clone(), action.clone());

        // Ajouter à l'historique
        let mut history = self.action_history.write().await;
        history.push(action);
        if history.len() > 100 {
            history.remove(0); // Limiter à 100 actions
        }

        info!("[OptimisticUpdate] Action enregistrée: {}", action_id);
        Ok(action_id)
    }

    /// ✅ NOUVEAU Phase 10: Confirme une action optimiste (succès serveur)
    pub async fn confirm_action(&self, action_id: &str) -> Result<(), String> {
        let mut pending = self.pending_actions.write().await;

        if pending.remove(action_id).is_some() {
            info!("[OptimisticUpdate] Action confirmée: {}", action_id);
            Ok(())
        } else {
            warn!("[OptimisticUpdate] Action non trouvée: {}", action_id);
            Err("Action non trouvée".to_string())
        }
    }

    /// ✅ NOUVEAU Phase 10: Annule une action optimiste (erreur serveur)
    pub async fn rollback_action(&self, action_id: &str) -> Result<Value, String> {
        let mut pending = self.pending_actions.write().await;

        if let Some(action) = pending.remove(action_id) {
            info!("[OptimisticUpdate] Annulation action: {}", action_id);
            Ok(action.rollback_data)
        } else {
            error!(
                "[OptimisticUpdate] Action non trouvée pour annulation: {}",
                action_id
            );
            Err("Action non trouvée".to_string())
        }
    }

    /// ✅ NOUVEAU Phase 10: Récupère toutes les actions en attente
    pub async fn get_pending_actions(&self) -> Vec<OptimisticAction> {
        let pending = self.pending_actions.read().await;
        pending.values().cloned().collect()
    }

    /// ✅ NOUVEAU Phase 10: Nettoie les actions anciennes (> 30 secondes)
    pub async fn cleanup_old_actions(&self) {
        let now = chrono::Utc::now().timestamp_millis();
        let threshold = now - 30000; // 30 secondes

        let mut pending = self.pending_actions.write().await;
        pending.retain(|_, action| action.timestamp > threshold);

        info!("[OptimisticUpdate] Nettoyage actions anciennes terminé");
    }

    /// ✅ NOUVEAU Phase 10: Retry une action échouée
    pub async fn retry_action(&self, action_id: &str) -> Result<String, String> {
        // Cloner l'action avant de libérer le lock
        let action_clone = {
            let pending = self.pending_actions.read().await;
            pending.get(action_id).cloned()
        };

        if let Some(action) = action_clone {
            // Créer une nouvelle action avec les mêmes données
            let new_request = OptimisticUpdateRequest {
                action_type: action.action_type.clone(),
                data: action.data.clone(),
                rollback_data: action.rollback_data.clone(),
            };

            self.register_optimistic_action(new_request).await
        } else {
            Err("Action non trouvée".to_string())
        }
    }
}

impl Default for OptimisticUpdateService {
    fn default() -> Self {
        Self::new()
    }
}
