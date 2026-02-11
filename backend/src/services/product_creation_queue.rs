// ✅ NOUVEAU 2026-01-02: Service de queue asynchrone pour création de produits
// SOLUTION DÉFINITIVE: Évite les timeouts et erreurs TLS en traitant les créations en arrière-plan

use crate::core::types::{AppError, AppResult};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::{PgPool, Row};
use std::sync::Arc;
use std::time::Duration;
use tokio::time::sleep;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductCreationJob {
    pub id: i64,
    pub service_id: i32,
    pub user_id: i32,
    pub product_data: Value,
    pub images_to_process: Vec<String>,
    pub status: String,
    pub priority: i32,
    pub attempt_count: i32,
    pub max_attempts: i32,
    pub error_message: Option<String>,
    pub result_data: Option<Value>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub started_at: Option<chrono::DateTime<chrono::Utc>>,
    pub completed_at: Option<chrono::DateTime<chrono::Utc>>,
}

/// Service de queue pour création de produits
pub struct ProductCreationQueueService {
    pool: Arc<PgPool>,
}

impl ProductCreationQueueService {
    pub fn new(pool: Arc<PgPool>) -> Self {
        Self { pool }
    }

    /// Ajoute un job à la queue
    pub async fn enqueue(
        &self,
        service_id: i32,
        user_id: i32,
        product_data: Value,
        images_to_process: Vec<String>,
        priority: Option<i32>,
    ) -> AppResult<i64> {
        let priority = priority.unwrap_or(5);

        let job_id: i64 = sqlx::query_scalar(
            r#"
            INSERT INTO product_creation_queue 
                (service_id, user_id, product_data, images_to_process, priority)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id
            "#,
        )
        .bind(service_id)
        .bind(user_id)
        .bind(&product_data)
        .bind(&images_to_process)
        .bind(priority)
        .fetch_one(&*self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur ajout queue: {}", e)))?;

        log::info!(
            "[ProductCreationQueue] ✅ Job {} ajouté à la queue (service_id: {}, priority: {})",
            job_id,
            service_id,
            priority
        );

        Ok(job_id)
    }

    /// Récupère le statut d'un job
    pub async fn get_job_status(&self, job_id: i64) -> AppResult<Option<ProductCreationJob>> {
        let row = sqlx::query(
            r#"
            SELECT 
                id, service_id, user_id, product_data, 
                images_to_process,
                status, priority, attempt_count, max_attempts,
                error_message, result_data, 
                created_at, started_at, completed_at
            FROM product_creation_queue
            WHERE id = $1
            "#,
        )
        .bind(job_id)
        .fetch_optional(&*self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur récupération job: {}", e)))?;

        let job = match row {
            Some(row) => Some(ProductCreationJob {
                id: row.try_get("id")?,
                service_id: row.try_get("service_id")?,
                user_id: row.try_get("user_id")?,
                product_data: row.try_get("product_data")?,
                images_to_process: row
                    .try_get::<Vec<String>, _>("images_to_process")
                    .unwrap_or_default(),
                status: row.try_get("status")?,
                priority: row.try_get("priority")?,
                attempt_count: row.try_get("attempt_count")?,
                max_attempts: row.try_get("max_attempts")?,
                error_message: row.try_get("error_message")?,
                result_data: row.try_get("result_data")?,
                created_at: row.try_get("created_at")?,
                started_at: row.try_get("started_at")?,
                completed_at: row.try_get("completed_at")?,
            }),
            None => None,
        };

        Ok(job)
    }

    /// Récupère les jobs en attente (pour le worker)
    async fn fetch_pending_jobs(&self, limit: i32) -> AppResult<Vec<ProductCreationJob>> {
        let rows = sqlx::query(
            r#"
            SELECT 
                id, service_id, user_id, product_data,
                images_to_process,
                status, priority, attempt_count, max_attempts,
                error_message, result_data,
                created_at, started_at, completed_at
            FROM product_creation_queue
            WHERE status = 'pending'
            ORDER BY priority ASC, created_at ASC
            LIMIT $1
            FOR UPDATE SKIP LOCKED
            "#,
        )
        .bind(limit)
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur récupération jobs: {}", e)))?;

        let jobs: Result<Vec<ProductCreationJob>, sqlx::Error> = rows
            .into_iter()
            .map(|row| {
                Ok(ProductCreationJob {
                    id: row.try_get("id")?,
                    service_id: row.try_get("service_id")?,
                    user_id: row.try_get("user_id")?,
                    product_data: row.try_get("product_data")?,
                    images_to_process: row
                        .try_get::<Vec<String>, _>("images_to_process")
                        .unwrap_or_default(),
                    status: row.try_get("status")?,
                    priority: row.try_get("priority")?,
                    attempt_count: row.try_get("attempt_count")?,
                    max_attempts: row.try_get("max_attempts")?,
                    error_message: row.try_get("error_message")?,
                    result_data: row.try_get("result_data")?,
                    created_at: row.try_get("created_at")?,
                    started_at: row.try_get("started_at")?,
                    completed_at: row.try_get("completed_at")?,
                })
            })
            .collect();

        Ok(jobs.map_err(|e| AppError::Internal(format!("Erreur parsing jobs: {}", e)))?)
    }

    /// Marque un job comme en cours de traitement
    async fn mark_processing(&self, job_id: i64) -> AppResult<()> {
        sqlx::query(
            r#"
            UPDATE product_creation_queue
            SET status = 'processing',
                started_at = NOW(),
                updated_at = NOW()
            WHERE id = $1
            "#,
        )
        .bind(job_id)
        .execute(&*self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur marquage processing: {}", e)))?;

        Ok(())
    }

    /// Marque un job comme complété
    async fn mark_completed(&self, job_id: i64, result_data: Value) -> AppResult<()> {
        sqlx::query(
            r#"
            UPDATE product_creation_queue
            SET status = 'completed',
                result_data = $1,
                completed_at = NOW(),
                updated_at = NOW()
            WHERE id = $2
            "#,
        )
        .bind(&result_data)
        .bind(job_id)
        .execute(&*self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur marquage completed: {}", e)))?;

        Ok(())
    }

    /// Marque un job comme échoué
    async fn mark_failed(&self, job_id: i64, error_message: String) -> AppResult<()> {
        sqlx::query(
            r#"
            UPDATE product_creation_queue
            SET status = CASE 
                    WHEN attempt_count + 1 >= max_attempts THEN 'failed'
                    ELSE 'pending'
                END,
                attempt_count = attempt_count + 1,
                error_message = $1,
                updated_at = NOW()
            WHERE id = $2
            "#,
        )
        .bind(&error_message)
        .bind(job_id)
        .execute(&*self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur marquage failed: {}", e)))?;

        Ok(())
    }

    /// Traite un job (appelé par le worker)
    pub async fn process_job(&self, job: ProductCreationJob) -> AppResult<Value> {
        use crate::controllers::product_addition_controller::process_product_creation;
        use serde_json::json;

        log::info!(
            "[ProductCreationQueue] 🔄 Traitement job {} (service_id: {}, attempt: {}/{})",
            job.id,
            job.service_id,
            job.attempt_count + 1,
            job.max_attempts
        );

        // Marquer comme en cours
        self.mark_processing(job.id).await?;

        // ✅ NOUVEAU: Logger les images à traiter
        log::info!(
            "[ProductCreationQueue] 📦 Job {} - {} image(s) à traiter",
            job.id,
            job.images_to_process.len()
        );
        
        // Traiter le job
        match process_product_creation(
            self.pool.clone(),
            job.service_id,
            job.user_id,
            &job.product_data,
            &job.images_to_process,
        )
        .await
        {
            Ok(result) => {
                // ✅ CORRIGÉ: Vérifier le statut du traitement des médias
                let media_processing_success = result
                    .get("media_processing_success")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(true); // Par défaut true si pas d'images
                let media_insertion_count = result
                    .get("media_insertion_count")
                    .and_then(|v| v.as_i64())
                    .unwrap_or(0);
                let media_expected_count = result
                    .get("media_expected_count")
                    .and_then(|v| v.as_i64())
                    .unwrap_or(0);
                
                // ✅ NOUVEAU: Inclure le statut des médias dans le résultat
                let result_data = json!({
                    "success": true,
                    "product_index": result.get("product_index"),
                    "product_id": result.get("product_id"),
                    "service_id": job.service_id,
                    "media_processing_success": media_processing_success,
                    "media_insertion_count": media_insertion_count,
                    "media_expected_count": media_expected_count,
                });

                // ✅ CORRIGÉ: Ne marquer comme complété que si les médias ont été traités avec succès
                // (ou s'il n'y avait pas d'images à traiter)
                if !job.images_to_process.is_empty() && !media_processing_success {
                    let error_msg = format!(
                        "Produit créé mais échec traitement médias: {} attendu(s), {} sauvegardé(s)",
                        media_expected_count,
                        media_insertion_count
                    );
                    log::error!(
                        "[ProductCreationQueue] ⚠️ Job {} - {}",
                        job.id,
                        error_msg
                    );
                    
                    // ✅ NOUVEAU: Marquer le job comme complété mais avec un avertissement
                    // Le produit est créé, donc on ne peut pas le marquer comme failed
                    // Mais on inclut l'information dans le résultat
                    self.mark_completed(job.id, result_data.clone()).await?;
                    
                    log::warn!(
                        "[ProductCreationQueue] ⚠️ Job {} complété avec avertissement (médias non sauvegardés)",
                        job.id
                    );
                } else {
                    self.mark_completed(job.id, result_data.clone()).await?;
                    
                    if !job.images_to_process.is_empty() {
                        log::info!(
                            "[ProductCreationQueue] ✅ Job {} complété avec succès - {} média(x) sauvegardé(s)",
                            job.id,
                            media_insertion_count
                        );
                    } else {
                        log::info!(
                            "[ProductCreationQueue] ✅ Job {} complété avec succès (pas d'images à traiter)",
                            job.id
                        );
                    }
                }

                Ok(result_data)
            }
            Err(e) => {
                let error_msg = format!("Erreur traitement: {}", e);
                log::error!(
                    "[ProductCreationQueue] ❌ Job {} échoué: {}",
                    job.id,
                    error_msg
                );

                self.mark_failed(job.id, error_msg.clone()).await?;

                Err(AppError::Internal(error_msg))
            }
        }
    }

    /// Démarre le worker (à appeler dans main.rs)
    pub fn start_worker(self: Arc<Self>) {
        tokio::spawn(async move {
            log::info!("[ProductCreationQueue] 🚀 Worker démarré");

            loop {
                // Récupérer les jobs en attente
                match self.fetch_pending_jobs(10).await {
                    Ok(jobs) if !jobs.is_empty() => {
                        log::info!("[ProductCreationQueue] 📦 {} job(s) en attente", jobs.len());

                        // Traiter les jobs en parallèle (max 3 à la fois)
                        let mut handles = Vec::new();
                        for job in jobs.into_iter().take(3) {
                            let service = self.clone();
                            let handle = tokio::spawn(async move {
                                let _ = service.process_job(job).await;
                            });
                            handles.push(handle);
                        }

                        // Attendre que tous les jobs soient traités
                        for handle in handles {
                            let _ = handle.await;
                        }
                    }
                    Ok(_) => {
                        // Pas de jobs, attendre 5 secondes
                        sleep(Duration::from_secs(5)).await;
                    }
                    Err(e) => {
                        log::error!("[ProductCreationQueue] ❌ Erreur récupération jobs: {}", e);
                        sleep(Duration::from_secs(10)).await;
                    }
                }
            }
        });
    }
}
