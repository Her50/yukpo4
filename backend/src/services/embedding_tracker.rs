use crate::core::types::AppError;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(FromRow)]
struct ServiceIdRow {
    id: i32,
}

#[derive(FromRow)]
struct ServiceDataRow {
    data: serde_json::Value,
}

/// ? Statut d'embedding d'un service
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EmbeddingStatus {
    pub service_id: i32,
    pub status: String, // "pending", "processing", "success", "failed", "retry"
    pub error_message: Option<String>,
    pub last_attempt: Option<chrono::DateTime<chrono::Utc>>,
    pub attempts: i32,
    pub successful_embeddings: i32,
    pub failed_embeddings: i32,
    pub total_embeddings: i32,
    pub processing_time_ms: Option<u64>,
}

impl EmbeddingStatus {
    pub fn new(service_id: i32) -> Self {
        Self {
            service_id,
            status: "pending".to_string(),
            error_message: None,
            last_attempt: None,
            attempts: 0,
            successful_embeddings: 0,
            failed_embeddings: 0,
            total_embeddings: 0,
            processing_time_ms: None,
        }
    }

    pub fn processing() -> Self {
        Self {
            service_id: 0,
            status: "processing".to_string(),
            error_message: None,
            last_attempt: Some(chrono::Utc::now()),
            attempts: 0,
            successful_embeddings: 0,
            failed_embeddings: 0,
            total_embeddings: 0,
            processing_time_ms: None,
        }
    }

    pub fn success(successful: i32, total: i32, processing_time_ms: u64) -> Self {
        Self {
            service_id: 0,
            status: "success".to_string(),
            error_message: None,
            last_attempt: Some(chrono::Utc::now()),
            attempts: 1,
            successful_embeddings: successful,
            failed_embeddings: total - successful,
            total_embeddings: total,
            processing_time_ms: Some(processing_time_ms),
        }
    }

    pub fn failed(error_msg: String, attempts: i32) -> Self {
        Self {
            service_id: 0,
            status: "failed".to_string(),
            error_message: Some(error_msg),
            last_attempt: Some(chrono::Utc::now()),
            attempts,
            successful_embeddings: 0,
            failed_embeddings: 0,
            total_embeddings: 0,
            processing_time_ms: None,
        }
    }
}

/// ? Service de suivi des embeddings
pub struct EmbeddingTracker {
    pool: sqlx::PgPool,
    redis_client: redis::Client,
}

impl EmbeddingTracker {
    pub fn new(pool: sqlx::PgPool, redis_client: redis::Client) -> Self {
        Self { pool, redis_client }
    }

    /// ? R?cup?re le statut d'embedding d'un service
    pub async fn get_status(&self, service_id: i32) -> Result<EmbeddingStatus, AppError> {
        use crate::utils::redis_helper;

        let key = format!("embedding_status:{}", service_id);

        // ✅ CORRIGÉ: Utiliser le helper Redis avec retry automatique
        match redis_helper::get_with_retry(&self.redis_client, &key).await {
            Ok(Some(json)) => {
                let status: EmbeddingStatus = serde_json::from_str(&json)
                    .map_err(|e| AppError::Internal(format!("Erreur parsing JSON: {}", e)))?;
                Ok(status)
            }
            Ok(None) => {
                // Si pas de statut en cache, cr?er un statut par d?faut
                let status = EmbeddingStatus::new(service_id);
                Ok(status)
            }
            Err(e) => {
                // ✅ CORRIGÉ: Si Redis n'est pas disponible, retourner un statut par défaut au lieu d'échouer
                log::warn!("⚠️ [EmbeddingTracker] Redis indisponible pour get_status (service {}): {}. Utilisation statut par défaut.", service_id, e);
                let status = EmbeddingStatus::new(service_id);
                Ok(status)
            }
        }
    }

    /// ? Met ? jour le statut d'embedding d'un service
    pub async fn update_status(
        &self,
        service_id: i32,
        status: EmbeddingStatus,
    ) -> Result<(), AppError> {
        use crate::utils::redis_helper;

        let key = format!("embedding_status:{}", service_id);
        let status_json = serde_json::to_string(&status)
            .map_err(|e| AppError::Internal(format!("Erreur s?rialisation JSON: {}", e)))?;

        // ✅ CORRIGÉ: Utiliser le helper Redis avec retry automatique
        // Stocker avec expiration de 24h
        match redis_helper::set_with_retry(&self.redis_client, &key, &status_json, Some(86400))
            .await
        {
            Ok(_) => {
                log::info!(
                    "[EMBEDDING_TRACKER] Statut mis ? jour pour service {}: {:?}",
                    service_id,
                    status.status
                );
                Ok(())
            }
            Err(e) => {
                // ✅ CORRIGÉ: Si Redis n'est pas disponible, logger un avertissement mais ne pas échouer
                log::warn!("⚠️ [EmbeddingTracker] Redis indisponible pour update_status (service {}): {}. L'opération continue sans cache.", service_id, e);
                Ok(())
            }
        }
    }

    /// ? R?cup?re le statut de tous les services d'un utilisateur
    pub async fn get_user_services_status(
        &self,
        user_id: i32,
    ) -> Result<Vec<EmbeddingStatus>, AppError> {
        let services: Vec<ServiceIdRow> =
            sqlx::query_as("SELECT id FROM services WHERE user_id = $1 ORDER BY created_at DESC")
                .bind(user_id)
                .fetch_all(&self.pool)
                .await
                .map_err(|e| AppError::Internal(format!("Erreur requ?te services: {}", e)))?;

        let mut statuses = Vec::new();
        for service in services {
            let status = self.get_status(service.id).await?;
            statuses.push(status);
        }

        Ok(statuses)
    }

    /// ? Relance l'embedding d'un service
    pub async fn retry_embedding(
        &self,
        service_id: i32,
        _user_id: i32,
    ) -> Result<EmbeddingStatus, AppError> {
        // V?rifier que l'utilisateur est propri?taire du service
        let service: Option<ServiceDataRow> =
            sqlx::query_as("SELECT data FROM services WHERE id = $1 AND user_id = $2")
                .bind(service_id)
                .bind(_user_id)
                .fetch_optional(&self.pool)
                .await
                .map_err(|e| {
                    AppError::Internal(format!("Erreur v?rification propri?taire: {}", e))
                })?;

        let service = service.ok_or(AppError::BadRequest(
            "Service non trouv? ou acc?s refus?".to_string(),
        ))?;

        // Mettre ? jour le statut ? "retry"
        let mut status = EmbeddingStatus::new(service_id);
        status.status = "retry".to_string();
        status.attempts += 1;
        status.last_attempt = Some(chrono::Utc::now());

        self.update_status(service_id, status.clone()).await?;

        // Lancer l'embedding en arri?re-plan
        let tracker_clone = self.clone();
        let service_data = service.data;

        tokio::spawn(async move {
            if let Err(e) = tracker_clone
                .process_service_embedding(service_id, &service_data, _user_id)
                .await
            {
                log::error!("[EMBEDDING_TRACKER] Erreur lors de la relance d'embedding pour service {}: {:?}", service_id, e);
            }
        });

        Ok(status)
    }

    /// ? Traite l'embedding d'un service avec mise ? jour du statut
    pub async fn process_service_embedding(
        &self,
        service_id: i32,
        service_data: &serde_json::Value,
        _user_id: i32,
    ) -> Result<(), AppError> {
        // Mettre ? jour le statut ? "processing"
        let mut status = EmbeddingStatus::new(service_id);
        status.status = "processing".to_string();
        status.last_attempt = Some(chrono::Utc::now());
        self.update_status(service_id, status).await?;

        let start_time = std::time::Instant::now();

        // Utiliser le service d'embedding existant
        if let Err(e) = self.run_embeddings(service_id, service_data).await {
            let error_msg = format!("Erreur embedding: {:?}", e);
            let failed_status = EmbeddingStatus::failed(error_msg, 1);
            self.update_status(service_id, failed_status).await?;
            return Err(e);
        }

        let processing_time = start_time.elapsed().as_millis() as u64;

        // Mettre ? jour le statut ? "success"
        let success_status = EmbeddingStatus::success(1, 1, processing_time); // Simplifi? pour l'instant
        self.update_status(service_id, success_status).await?;

        Ok(())
    }

    /// ? Ex?cute les embeddings pour un service
    async fn run_embeddings(
        &self,
        service_id: i32,
        _service_data: &serde_json::Value,
    ) -> Result<(), AppError> {
        // Utiliser la logique d'embedding existante de creer_service.rs
        // Pour l'instant, on simule un embedding r?ussi
        log::info!(
            "[EMBEDDING_TRACKER] Traitement embedding pour service {}",
            service_id
        );

        // TODO: Int?grer avec le code d'embedding existant
        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await; // Simulation

        Ok(())
    }
}

impl Clone for EmbeddingTracker {
    fn clone(&self) -> Self {
        Self {
            pool: self.pool.clone(),
            redis_client: self.redis_client.clone(),
        }
    }
}
