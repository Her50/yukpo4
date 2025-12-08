// ✅ Service KYC pour vérification identité conducteur
// Supporte Onfido, Jumio, Sumsub, Veriff, Persona, Manual
// ✅ NOUVEAU 2025-01-29: Intégration IA pour analyse automatique des documents

use crate::core::types::{AppError, AppResult};
use crate::services::app_ia::AppIA;
use base64::prelude::*;
use log::{error, info, warn};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::PgPool;
use std::sync::Arc;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum KYCProvider {
    Onfido,
    Jumio,
    Sumsub,
    Veriff,
    Persona,
    Manual, // Vérification manuelle par admin
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DocumentType {
    Permis,
    CNI,
    Assurance,
    Passeport,
    CarteGrise,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DocumentStatus {
    Pending,
    Approved,
    Rejected,
    Expired,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentSubmission {
    pub user_id: i32,
    pub document_type: String,
    pub document_url: String,
    pub document_number: Option<String>,
    pub provider: KYCProvider,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentVerificationResult {
    pub status: DocumentStatus,
    pub confidence_score: Option<f64>,
    pub extracted_data: Option<serde_json::Value>,
    pub rejection_reason: Option<String>,
    pub verified_at: Option<chrono::DateTime<chrono::Utc>>,
}

pub struct KYCService {
    pool: Arc<PgPool>,
    provider: KYCProvider,
    onfido_api_key: Option<String>,
    onfido_webhook_token: Option<String>,
    jumio_api_key: Option<String>,
    jumio_api_secret: Option<String>,
    jumio_webhook_token: Option<String>,
    sumsub_app_token: Option<String>,
    sumsub_secret_key: Option<String>,
    veriff_api_key: Option<String>,
    veriff_api_secret: Option<String>,
    persona_api_key: Option<String>,
    persona_webhook_secret: Option<String>,
    app_ia: Option<Arc<AppIA>>, // ✅ NOUVEAU: Service IA pour analyse automatique
}

impl KYCService {
    pub async fn new(pool: Arc<PgPool>) -> Self {
        // Détecter provider depuis env (KYC_PROVIDER=onfido|jumio|sumsub|veriff|persona|manual)
        let provider = std::env::var("KYC_PROVIDER")
            .ok()
            .and_then(|p| match p.to_lowercase().as_str() {
                "onfido" => Some(KYCProvider::Onfido),
                "jumio" => Some(KYCProvider::Jumio),
                "sumsub" => Some(KYCProvider::Sumsub),
                "veriff" => Some(KYCProvider::Veriff),
                "persona" => Some(KYCProvider::Persona),
                _ => Some(KYCProvider::Manual),
            })
            .unwrap_or(KYCProvider::Manual);

        // Lire clés API Onfido
        let onfido_api_key = std::env::var("ONFIDO_API_KEY").ok();
        let onfido_webhook_token = std::env::var("ONFIDO_WEBHOOK_TOKEN").ok();

        // Lire clés API Jumio
        let jumio_api_key = std::env::var("JUMIO_API_KEY").ok();
        let jumio_api_secret = std::env::var("JUMIO_API_SECRET").ok();
        let jumio_webhook_token = std::env::var("JUMIO_WEBHOOK_TOKEN").ok();

        // Lire clés API Sumsub
        let sumsub_app_token = std::env::var("SUMSUB_APP_TOKEN").ok();
        let sumsub_secret_key = std::env::var("SUMSUB_SECRET_KEY").ok();

        // Lire clés API Veriff
        let veriff_api_key = std::env::var("VERIFF_API_KEY").ok();
        let veriff_api_secret = std::env::var("VERIFF_API_SECRET").ok();

        // Lire clés API Persona
        let persona_api_key = std::env::var("PERSONA_API_KEY").ok();
        let persona_webhook_secret = std::env::var("PERSONA_WEBHOOK_SECRET").ok();

        if let Some(ref _key) = onfido_api_key {
            info!("[KYCService] ✅ Clé API Onfido configurée");
        }
        if let Some(ref _key) = jumio_api_key {
            info!("[KYCService] ✅ Clé API Jumio configurée");
        }
        if let Some(ref _key) = sumsub_app_token {
            info!("[KYCService] ✅ Clé API Sumsub configurée");
        }
        if let Some(ref _key) = veriff_api_key {
            info!("[KYCService] ✅ Clé API Veriff configurée");
        }
        if let Some(ref _key) = persona_api_key {
            info!("[KYCService] ✅ Clé API Persona configurée");
        }

        // ✅ NOUVEAU: Initialiser le service IA si disponible
        let app_ia = if std::env::var("OPENAI_API_KEY").is_ok() 
            || std::env::var("ANTHROPIC_API_KEY").is_ok() 
            || std::env::var("GEMINI_API_KEY").is_ok() {
            // Créer RedisClient et IAStats pour AppIA
            let redis_url = std::env::var("REDIS_URL")
                .unwrap_or_else(|_| "redis://127.0.0.1:6379".to_string());
            if let Ok(redis_client) = redis::Client::open(redis_url.as_str()) {
                // RedisClient dans app_ia est un alias pour redis::Client
                let redis_client: redis::Client = redis_client;
                let ia_stats = Arc::new(tokio::sync::Mutex::new(
                    crate::controllers::ia_status_controller::IAStats::default()
                ));
                Some(Arc::new(AppIA::new(redis_client, ia_stats, (*pool).clone())))
            } else {
                warn!("[KYCService] Impossible de créer RedisClient, analyse automatique désactivée");
                None
            }
        } else {
            warn!("[KYCService] Aucune clé API IA configurée, analyse automatique désactivée");
            None
        };

        Self {
            pool,
            provider,
            onfido_api_key,
            onfido_webhook_token,
            jumio_api_key,
            jumio_api_secret,
            jumio_webhook_token,
            sumsub_app_token,
            sumsub_secret_key,
            veriff_api_key,
            veriff_api_secret,
            persona_api_key,
            persona_webhook_secret,
            app_ia,
        }
    }

    /// Soumettre un document pour vérification
    pub async fn submit_document(
        &self,
        submission: DocumentSubmission,
    ) -> AppResult<i32> {
        info!(
            "[KYCService] Soumission document user_id={}, type={}, provider={:?}",
            submission.user_id, submission.document_type, self.provider
        );

        // Valider type de document
        let valid_types = ["permis", "cni", "assurance", "passeport", "carte_grise"];
        if !valid_types.contains(&submission.document_type.as_str()) {
            return Err(AppError::BadRequest(format!(
                "Type de document invalide. Doit être: {}",
                valid_types.join(", ")
            )));
        }

        // ✅ NOUVEAU: Analyser automatiquement le document avec IA avant stockage
        let mut extracted_data = json!({
            "provider": format!("{:?}", self.provider),
            "submitted_at": chrono::Utc::now()
        });

        // Analyse IA automatique si disponible
        if let Some(ref app_ia) = self.app_ia {
            match self.analyze_document_with_ai(&submission.document_url, &submission.document_type, app_ia).await {
                Ok(ai_analysis) => {
                    info!("[KYCService] ✅ Analyse IA réussie pour document type={}", submission.document_type);
                    extracted_data["ai_analysis"] = json!(ai_analysis);
                    
                    // Extraire automatiquement le numéro de document si non fourni
                    if submission.document_number.is_none() {
                        if let Some(auto_number) = ai_analysis.get("document_number").and_then(|v| v.as_str()) {
                            info!("[KYCService] 📄 Numéro de document extrait automatiquement: {}", auto_number);
                            extracted_data["auto_extracted_number"] = json!(auto_number);
                        }
                    }
                }
                Err(e) => {
                    warn!("[KYCService] ⚠️ Analyse IA échouée (continuera sans): {}", e);
                    extracted_data["ai_analysis_error"] = json!(e.to_string());
                }
            }
        }

        // Stocker dans user_documents
        let document_id: i32 = sqlx::query_scalar(
            r#"
            INSERT INTO user_documents (
                user_id,
                document_type,
                document_url,
                document_number,
                status,
                metadata
            )
            VALUES ($1, $2, $3, $4, 'pending', $5)
            ON CONFLICT (user_id, document_type)
            DO UPDATE SET
                document_url = EXCLUDED.document_url,
                document_number = COALESCE(EXCLUDED.document_number, user_documents.document_number),
                status = 'pending',
                metadata = EXCLUDED.metadata,
                updated_at = NOW()
            RETURNING id
            "#
        )
        .bind(submission.user_id)
        .bind(&submission.document_type)
        .bind(&submission.document_url)
        .bind(submission.document_number.as_ref())
        .bind(extracted_data)
        .fetch_one(&*self.pool)
        .await
        .map_err(|e| {
            error!("[KYCService] Erreur insertion document: {}", e);
            AppError::Internal(format!("Erreur stockage document: {}", e))
        })?;

        // TODO: Intégrer avec provider externe (Onfido/Jumio)
        match self.provider {
            KYCProvider::Onfido => {
                if let Err(e) = self.verify_with_onfido(document_id, &submission).await {
                    error!("[KYCService] Erreur vérification Onfido: {}", e);
                    // Continuer même si échec (document stocké, sera vérifié manuellement)
                }
            }
            KYCProvider::Jumio => {
                if let Err(e) = self.verify_with_jumio(document_id, &submission).await {
                    error!("[KYCService] Erreur vérification Jumio: {}", e);
                }
            }
            KYCProvider::Sumsub => {
                if let Err(e) = self.verify_with_sumsub(document_id, &submission).await {
                    error!("[KYCService] Erreur vérification Sumsub: {}", e);
                }
            }
            KYCProvider::Veriff => {
                if let Err(e) = self.verify_with_veriff(document_id, &submission).await {
                    error!("[KYCService] Erreur vérification Veriff: {}", e);
                }
            }
            KYCProvider::Persona => {
                if let Err(e) = self.verify_with_persona(document_id, &submission).await {
                    error!("[KYCService] Erreur vérification Persona: {}", e);
                }
            }
            KYCProvider::Manual => {
                info!("[KYCService] Document soumis pour vérification manuelle (admin)");
            }
        }

        info!("[KYCService] ✅ Document soumis: ID={}", document_id);
        Ok(document_id)
    }

    /// Vérifier un document (appelé par webhook ou admin)
    pub async fn verify_document(
        &self,
        document_id: i32,
        result: DocumentVerificationResult,
        verified_by: Option<i32>,
    ) -> AppResult<()> {
        info!(
            "[KYCService] Vérification document ID={}, status={:?}",
            document_id, result.status
        );

        let status_str = match result.status {
            DocumentStatus::Pending => "pending",
            DocumentStatus::Approved => "approved",
            DocumentStatus::Rejected => "rejected",
            DocumentStatus::Expired => "expired",
        };

        sqlx::query(
            r#"
            UPDATE user_documents
            SET
                status = $1,
                verified_at = $2,
                verified_by = $3,
                rejection_reason = $4,
                metadata = COALESCE(metadata, '{}'::jsonb) || $5::jsonb,
                updated_at = NOW()
            WHERE id = $6
            "#
        )
        .bind(status_str)
        .bind(result.verified_at)
        .bind(verified_by)
        .bind(result.rejection_reason.as_ref())
        .bind(json!({
            "confidence_score": result.confidence_score,
            "extracted_data": result.extracted_data,
            "verified_at": result.verified_at
        }))
        .bind(document_id)
        .execute(&*self.pool)
        .await
        .map_err(|e| {
            error!("[KYCService] Erreur mise à jour document: {}", e);
            AppError::Internal(format!("Erreur vérification document: {}", e))
        })?;

        // Si document approuvé, mettre à jour flag is_verified dans users
        if matches!(result.status, DocumentStatus::Approved) {
            let user_id: Option<i32> = sqlx::query_scalar(
                "SELECT user_id FROM user_documents WHERE id = $1"
            )
            .bind(document_id)
            .fetch_optional(&*self.pool)
            .await?;

            if let Some(uid) = user_id {
                let _ = sqlx::query(
                    "UPDATE users SET is_verified = true WHERE id = $1"
                )
                .bind(uid)
                .execute(&*self.pool)
                .await;
            }
        }

        info!("[KYCService] ✅ Document vérifié: ID={}", document_id);
        Ok(())
    }

    /// Récupérer les documents d'un utilisateur
    pub async fn get_user_documents(&self, user_id: i32) -> AppResult<Vec<serde_json::Value>> {
        let documents = sqlx::query(
            r#"
            SELECT
                id,
                document_type,
                document_url,
                document_number,
                status,
                verified_at,
                verified_by,
                rejection_reason,
                expiry_date,
                metadata,
                created_at,
                updated_at
            FROM user_documents
            WHERE user_id = $1
            ORDER BY created_at DESC
            "#
        )
        .bind(user_id)
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| {
            error!("[KYCService] Erreur récupération documents: {}", e);
            AppError::Internal(format!("Erreur récupération documents: {}", e))
        })?;

        use sqlx::Row;
        let mut docs_json = Vec::new();
        for row in documents {
            docs_json.push(json!({
                "id": row.get::<i32, _>("id"),
                "document_type": row.get::<String, _>("document_type"),
                "document_url": row.get::<String, _>("document_url"),
                "document_number": row.get::<Option<String>, _>("document_number"),
                "status": row.get::<String, _>("status"),
                "verified_at": row.get::<Option<chrono::DateTime<chrono::Utc>>, _>("verified_at"),
                "verified_by": row.get::<Option<i32>, _>("verified_by"),
                "rejection_reason": row.get::<Option<String>, _>("rejection_reason"),
                "expiry_date": row.get::<Option<chrono::NaiveDate>, _>("expiry_date"),
                "metadata": row.get::<serde_json::Value, _>("metadata"),
                "created_at": row.get::<chrono::DateTime<chrono::Utc>, _>("created_at"),
                "updated_at": row.get::<chrono::DateTime<chrono::Utc>, _>("updated_at"),
            }));
        }

        Ok(docs_json)
    }

    /// Vérifier un document via Onfido API
    async fn verify_with_onfido(
        &self,
        document_id: i32,
        submission: &DocumentSubmission,
    ) -> AppResult<()> {
        let api_key = match &self.onfido_api_key {
            Some(key) => key,
            None => {
                warn!("[KYCService] ⚠️ Clé API Onfido non configurée, vérification manuelle requise");
                return Ok(()); // Pas d'erreur, juste fallback manuel
            }
        };

        info!("[KYCService] Vérification Onfido pour document ID={}", document_id);

        // Étape 1: Créer un applicant (utilisateur)
        let applicant_payload = json!({
            "first_name": "User", // TODO: Récupérer depuis users table
            "last_name": submission.user_id.to_string(),
            "email": format!("user{}@yukpomnang.com", submission.user_id), // TODO: Récupérer depuis users
        });

        let client = reqwest::Client::new();
        let applicant_response = client
            .post("https://api.onfido.com/v3.6/applicants")
            .header("Authorization", format!("Token token={}", api_key))
            .header("Content-Type", "application/json")
            .json(&applicant_payload)
            .send()
            .await
            .map_err(|e| {
                error!("[KYCService] Erreur création applicant Onfido: {}", e);
                AppError::Internal(format!("Erreur API Onfido: {}", e))
            })?;

        let applicant_data: serde_json::Value = applicant_response
            .json()
            .await
            .map_err(|e| {
                error!("[KYCService] Erreur parsing réponse Onfido: {}", e);
                AppError::Internal("Erreur parsing réponse Onfido".to_string())
            })?;

        let applicant_id = applicant_data["id"]
            .as_str()
            .ok_or_else(|| AppError::Internal("ID applicant manquant".to_string()))?;

        // Étape 2: Télécharger le document depuis document_url
        let document_bytes = client
            .get(&submission.document_url)
            .send()
            .await
            .map_err(|e| {
                error!("[KYCService] Erreur téléchargement document: {}", e);
                AppError::Internal(format!("Erreur téléchargement: {}", e))
            })?
            .bytes()
            .await
            .map_err(|e| {
                error!("[KYCService] Erreur lecture bytes: {}", e);
                AppError::Internal("Erreur lecture document".to_string())
            })?;

        // Étape 3: Créer un document check
        let document_type_onfido = match submission.document_type.as_str() {
            "permis" => "driving_licence",
            "cni" => "national_identity_card",
            "passeport" => "passport",
            _ => "national_identity_card",
        };

        // Upload document
        let form = reqwest::multipart::Form::new()
            .text("applicant_id", applicant_id.to_string())
            .text("type", document_type_onfido.to_string())
            .part(
                "file",
                reqwest::multipart::Part::bytes(document_bytes.to_vec())
                    .file_name("document.jpg")
                    .mime_str("image/jpeg")
                    .map_err(|e| AppError::Internal(format!("Erreur MIME: {}", e)))?,
            );

        let document_response = client
            .post("https://api.onfido.com/v3.6/documents")
            .header("Authorization", format!("Token token={}", api_key))
            .multipart(form)
            .send()
            .await
            .map_err(|e| {
                error!("[KYCService] Erreur upload document Onfido: {}", e);
                AppError::Internal(format!("Erreur upload Onfido: {}", e))
            })?;

        let document_data: serde_json::Value = document_response
            .json()
            .await
            .map_err(|e| {
                error!("[KYCService] Erreur parsing document Onfido: {}", e);
                AppError::Internal("Erreur parsing document".to_string())
            })?;

        let onfido_document_id = document_data["id"]
            .as_str()
            .ok_or_else(|| AppError::Internal("ID document Onfido manquant".to_string()))?;

        // Étape 4: Créer un check (vérification)
        let check_payload = json!({
            "applicant_id": applicant_id,
            "report_names": ["document"],
            "document_ids": [onfido_document_id]
        });

        let check_response = client
            .post("https://api.onfido.com/v3.6/checks")
            .header("Authorization", format!("Token token={}", api_key))
            .header("Content-Type", "application/json")
            .json(&check_payload)
            .send()
            .await
            .map_err(|e| {
                error!("[KYCService] Erreur création check Onfido: {}", e);
                AppError::Internal(format!("Erreur check Onfido: {}", e))
            })?;

        let check_data: serde_json::Value = check_response
            .json()
            .await
            .map_err(|e| {
                error!("[KYCService] Erreur parsing check Onfido: {}", e);
                AppError::Internal("Erreur parsing check".to_string())
            })?;

        let check_id = check_data["id"]
            .as_str()
            .ok_or_else(|| AppError::Internal("ID check Onfido manquant".to_string()))?;

        // Mettre à jour metadata avec IDs Onfido
        sqlx::query(
            r#"
            UPDATE user_documents
            SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb
            WHERE id = $2
            "#
        )
        .bind(json!({
            "onfido_applicant_id": applicant_id,
            "onfido_document_id": onfido_document_id,
            "onfido_check_id": check_id,
            "onfido_status": "processing",
            "submitted_at": chrono::Utc::now()
        }))
        .bind(document_id)
        .execute(&*self.pool)
        .await
        .map_err(|e| {
            error!("[KYCService] Erreur mise à jour metadata: {}", e);
            AppError::Internal("Erreur mise à jour metadata".to_string())
        })?;

        info!(
            "[KYCService] ✅ Document soumis à Onfido: applicant_id={}, check_id={}",
            applicant_id, check_id
        );

        // Note: Le résultat sera reçu via webhook (voir étape 3)
        Ok(())
    }

    /// Vérifier un document via Jumio API
    async fn verify_with_jumio(
        &self,
        document_id: i32,
        submission: &DocumentSubmission,
    ) -> AppResult<()> {
        let api_key = match &self.jumio_api_key {
            Some(key) => key,
            None => {
                warn!("[KYCService] ⚠️ Clé API Jumio non configurée, vérification manuelle requise");
                return Ok(()); // Pas d'erreur, juste fallback manuel
            }
        };

        let api_secret = match &self.jumio_api_secret {
            Some(secret) => secret,
            None => {
                warn!("[KYCService] ⚠️ Secret API Jumio non configurée");
                return Ok(());
            }
        };

        info!("[KYCService] Vérification Jumio pour document ID={}", document_id);

        // Jumio utilise une authentification basique (API Key + Secret)
        let auth = BASE64_STANDARD.encode(format!("{}:{}", api_key, api_secret));

        // Étape 1: Créer une transaction
        let transaction_payload = json!({
            "customerInternalReference": format!("user_{}", submission.user_id),
            "userReference": submission.user_id.to_string(),
            "workflowId": 100, // Workflow par défaut (à configurer selon besoins)
            "callbackUrl": format!("{}/api/kyc/webhook/jumio", 
                std::env::var("API_BASE_URL").unwrap_or_else(|_| "https://api.yukpomnang.com".to_string())),
            "redirectUrl": format!("{}/kyc/redirect", 
                std::env::var("FRONTEND_URL").unwrap_or_else(|_| "https://yukpomnang.com".to_string())),
        });

        let client = reqwest::Client::new();
        let transaction_response = client
            .post("https://netverify.com/api/v4/initiate")
            .header("Authorization", format!("Basic {}", auth))
            .header("Content-Type", "application/json")
            .header("User-Agent", "Yukpomnang-KYC/1.0")
            .json(&transaction_payload)
            .send()
            .await
            .map_err(|e| {
                error!("[KYCService] Erreur création transaction Jumio: {}", e);
                AppError::Internal(format!("Erreur API Jumio: {}", e))
            })?;

        let transaction_data: serde_json::Value = transaction_response
            .json()
            .await
            .map_err(|e| {
                error!("[KYCService] Erreur parsing transaction Jumio: {}", e);
                AppError::Internal("Erreur parsing transaction".to_string())
            })?;

        let transaction_reference = transaction_data["transactionReference"]
            .as_str()
            .ok_or_else(|| AppError::Internal("transactionReference manquant".to_string()))?;

        // Mettre à jour metadata avec transaction Jumio
        sqlx::query(
            r#"
            UPDATE user_documents
            SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb
            WHERE id = $2
            "#
        )
        .bind(json!({
            "jumio_transaction_reference": transaction_reference,
            "jumio_workflow_id": 100,
            "jumio_status": "initiated",
            "submitted_at": chrono::Utc::now()
        }))
        .bind(document_id)
        .execute(&*self.pool)
        .await
        .map_err(|e| {
            error!("[KYCService] Erreur mise à jour metadata: {}", e);
            AppError::Internal("Erreur mise à jour metadata".to_string())
        })?;

        info!(
            "[KYCService] ✅ Transaction Jumio créée: transaction_reference={}",
            transaction_reference
        );

        // Note: L'utilisateur sera redirigé vers Jumio pour upload, puis webhook recevra le résultat
        Ok(())
    }

    /// Vérifier un document via Sumsub API
    async fn verify_with_sumsub(
        &self,
        document_id: i32,
        submission: &DocumentSubmission,
    ) -> AppResult<()> {
        let app_token = match &self.sumsub_app_token {
            Some(token) => token,
            None => {
                warn!("[KYCService] ⚠️ App Token Sumsub non configuré");
                return Ok(());
            }
        };

        let secret_key = match &self.sumsub_secret_key {
            Some(key) => key,
            None => {
                warn!("[KYCService] ⚠️ Secret Key Sumsub non configuré");
                return Ok(());
            }
        };

        info!("[KYCService] Vérification Sumsub pour document ID={}", document_id);

        // Sumsub utilise Basic Auth (app_token:secret_key)
        let auth = BASE64_STANDARD.encode(format!("{}:{}", app_token, secret_key));

        // Étape 1: Créer un applicant
        let applicant_payload = json!({
            "externalUserId": format!("user_{}", submission.user_id),
            "email": format!("user{}@yukpomnang.com", submission.user_id), // TODO: Récupérer depuis users
            "phone": null,
            "lang": "fr"
        });

        let client = reqwest::Client::new();
        let applicant_response = client
            .post("https://api.sumsub.com/resources/applicants")
            .header("Authorization", format!("Basic {}", auth))
            .header("Content-Type", "application/json")
            .header("X-App-Token", app_token)
            .json(&applicant_payload)
            .send()
            .await
            .map_err(|e| {
                error!("[KYCService] Erreur création applicant Sumsub: {}", e);
                AppError::Internal(format!("Erreur API Sumsub: {}", e))
            })?;

        let applicant_data: serde_json::Value = applicant_response
            .json()
            .await
            .map_err(|e| {
                error!("[KYCService] Erreur parsing applicant Sumsub: {}", e);
                AppError::Internal("Erreur parsing applicant".to_string())
            })?;

        let applicant_id = applicant_data["id"]
            .as_str()
            .ok_or_else(|| AppError::Internal("ID applicant Sumsub manquant".to_string()))?;

        // Étape 2: Créer un access token pour l'utilisateur (pour SDK mobile)
        let token_payload = json!({
            "userId": format!("user_{}", submission.user_id),
            "ttlInSecs": 3600
        });

        let token_response = client
            .post(format!("https://api.sumsub.com/resources/accessTokens?userId=user_{}", submission.user_id))
            .header("Authorization", format!("Basic {}", auth))
            .header("X-App-Token", app_token)
            .json(&token_payload)
            .send()
            .await
            .map_err(|e| {
                error!("[KYCService] Erreur création token Sumsub: {}", e);
                AppError::Internal(format!("Erreur token Sumsub: {}", e))
            })?;

        let token_data: serde_json::Value = token_response
            .json()
            .await
            .map_err(|e| {
                error!("[KYCService] Erreur parsing token Sumsub: {}", e);
                AppError::Internal("Erreur parsing token".to_string())
            })?;

        let access_token = token_data["token"]
            .as_str()
            .ok_or_else(|| AppError::Internal("Token Sumsub manquant".to_string()))?;

        // Mettre à jour metadata
        sqlx::query(
            r#"
            UPDATE user_documents
            SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb
            WHERE id = $2
            "#
        )
        .bind(json!({
            "sumsub_applicant_id": applicant_id,
            "sumsub_access_token": access_token,
            "sumsub_status": "initiated",
            "submitted_at": chrono::Utc::now()
        }))
        .bind(document_id)
        .execute(&*self.pool)
        .await
        .map_err(|e| {
            error!("[KYCService] Erreur mise à jour metadata: {}", e);
            AppError::Internal("Erreur mise à jour metadata".to_string())
        })?;

        info!("[KYCService] ✅ Applicant Sumsub créé: applicant_id={}", applicant_id);
        // Note: L'utilisateur utilisera le SDK Sumsub mobile avec access_token, puis webhook recevra le résultat
        Ok(())
    }

    /// Vérifier un document via Veriff API
    async fn verify_with_veriff(
        &self,
        document_id: i32,
        submission: &DocumentSubmission,
    ) -> AppResult<()> {
        let api_key = match &self.veriff_api_key {
            Some(key) => key,
            None => {
                warn!("[KYCService] ⚠️ API Key Veriff non configurée");
                return Ok(());
            }
        };

        let api_secret = match &self.veriff_api_secret {
            Some(secret) => secret,
            None => {
                warn!("[KYCService] ⚠️ API Secret Veriff non configuré");
                return Ok(());
            }
        };

        info!("[KYCService] Vérification Veriff pour document ID={}", document_id);

        // Veriff utilise Basic Auth (api_key:api_secret)
        let auth = BASE64_STANDARD.encode(format!("{}:{}", api_key, api_secret));

        // Créer une session Veriff
        let session_payload = json!({
            "verification": {
                "callback": format!("{}/api/kyc/webhook/veriff", 
                    std::env::var("API_BASE_URL").unwrap_or_else(|_| "https://api.yukpomnang.com".to_string())),
                "person": {
                    "firstName": "User",
                    "lastName": submission.user_id.to_string()
                },
                "document": {
                    "type": match submission.document_type.as_str() {
                        "permis" => "DRIVING_LICENCE",
                        "cni" => "ID_CARD",
                        "passeport" => "PASSPORT",
                        _ => "ID_CARD"
                    },
                    "country": "CM" // Cameroun par défaut
                }
            }
        });

        let client = reqwest::Client::new();
        let session_response = client
            .post("https://stationapi.veriff.com/v1/sessions")
            .header("Authorization", format!("Basic {}", auth))
            .header("Content-Type", "application/json")
            .header("X-Auth-Client", api_key)
            .json(&session_payload)
            .send()
            .await
            .map_err(|e| {
                error!("[KYCService] Erreur création session Veriff: {}", e);
                AppError::Internal(format!("Erreur API Veriff: {}", e))
            })?;

        let session_data: serde_json::Value = session_response
            .json()
            .await
            .map_err(|e| {
                error!("[KYCService] Erreur parsing session Veriff: {}", e);
                AppError::Internal("Erreur parsing session".to_string())
            })?;

        let session_id = session_data["verification"]["id"]
            .as_str()
            .ok_or_else(|| AppError::Internal("ID session Veriff manquant".to_string()))?;

        let session_url = session_data["verification"]["url"]
            .as_str()
            .ok_or_else(|| AppError::Internal("URL session Veriff manquante".to_string()))?;

        // Mettre à jour metadata
        sqlx::query(
            r#"
            UPDATE user_documents
            SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb
            WHERE id = $2
            "#
        )
        .bind(json!({
            "veriff_session_id": session_id,
            "veriff_session_url": session_url,
            "veriff_status": "initiated",
            "submitted_at": chrono::Utc::now()
        }))
        .bind(document_id)
        .execute(&*self.pool)
        .await
        .map_err(|e| {
            error!("[KYCService] Erreur mise à jour metadata: {}", e);
            AppError::Internal("Erreur mise à jour metadata".to_string())
        })?;

        info!("[KYCService] ✅ Session Veriff créée: session_id={}", session_id);
        // Note: L'utilisateur sera redirigé vers session_url, puis webhook recevra le résultat
        Ok(())
    }

    /// Vérifier un document via Persona API
    async fn verify_with_persona(
        &self,
        document_id: i32,
        submission: &DocumentSubmission,
    ) -> AppResult<()> {
        let api_key = match &self.persona_api_key {
            Some(key) => key,
            None => {
                warn!("[KYCService] ⚠️ API Key Persona non configurée");
                return Ok(());
            }
        };

        info!("[KYCService] Vérification Persona pour document ID={}", document_id);

        // Persona utilise Bearer token
        let client = reqwest::Client::new();

        // Créer une inquiry (vérification)
        let inquiry_payload = json!({
            "reference_id": format!("user_{}", submission.user_id),
            "inquiry_template_id": "default", // TODO: Configurer template selon document_type
            "account_id": format!("user_{}", submission.user_id),
            "fields": {
                "name-first": "User",
                "name-last": submission.user_id.to_string()
            }
        });

        let inquiry_response = client
            .post("https://withpersona.com/api/v1/inquiries")
            .header("Authorization", format!("Bearer {}", api_key))
            .header("Key-Inflection", "snake_case")
            .header("Content-Type", "application/json")
            .json(&inquiry_payload)
            .send()
            .await
            .map_err(|e| {
                error!("[KYCService] Erreur création inquiry Persona: {}", e);
                AppError::Internal(format!("Erreur API Persona: {}", e))
            })?;

        let inquiry_data: serde_json::Value = inquiry_response
            .json()
            .await
            .map_err(|e| {
                error!("[KYCService] Erreur parsing inquiry Persona: {}", e);
                AppError::Internal("Erreur parsing inquiry".to_string())
            })?;

        let inquiry_id = inquiry_data["data"]["id"]
            .as_str()
            .ok_or_else(|| AppError::Internal("ID inquiry Persona manquant".to_string()))?;

        // Mettre à jour metadata
        sqlx::query(
            r#"
            UPDATE user_documents
            SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb
            WHERE id = $2
            "#
        )
        .bind(json!({
            "persona_inquiry_id": inquiry_id,
            "persona_status": "initiated",
            "submitted_at": chrono::Utc::now()
        }))
        .bind(document_id)
        .execute(&*self.pool)
        .await
        .map_err(|e| {
            error!("[KYCService] Erreur mise à jour metadata: {}", e);
            AppError::Internal("Erreur mise à jour metadata".to_string())
        })?;

        info!("[KYCService] ✅ Inquiry Persona créée: inquiry_id={}", inquiry_id);
        // Note: L'utilisateur complétera l'inquiry via SDK Persona, puis webhook recevra le résultat
        Ok(())
    }

    /// ✅ NOUVEAU 2025-01-29: Analyser un document avec IA (OCR + extraction données)
    /// Utilise le système IA existant (AppIA + IntelligentImageAnalysisService)
    async fn analyze_document_with_ai(
        &self,
        document_url: &str,
        document_type: &str,
        app_ia: &Arc<AppIA>,
    ) -> AppResult<serde_json::Value> {
        info!("[KYCService] 🔍 Début analyse IA pour document type={}", document_type);

        // Construire le prompt spécialisé selon le type de document
        let prompt = self.build_kyc_analysis_prompt(document_type);

        // Préparer l'image (supporter URL ou base64)
        let image_input = if document_url.starts_with("http://") || document_url.starts_with("https://") {
            // URL directe - l'IA peut la traiter directement
            vec![document_url.to_string()]
        } else if document_url.starts_with("data:image") {
            // Data URI - extraire le base64
            vec![document_url.to_string()]
        } else {
            // Base64 pur - ajouter le préfixe
            vec![format!("data:image/jpeg;base64,{}", document_url)]
        };

        // Appel IA multimodal (analyse image + OCR)
        let (model_name, response_text, tokens_used) = app_ia
            .predict_multimodal(&prompt, Some(image_input))
            .await
            .map_err(|e| {
                error!("[KYCService] Erreur appel IA: {}", e);
                AppError::Internal(format!("Erreur analyse IA: {}", e))
            })?;

        info!("[KYCService] ✅ Analyse IA terminée (modèle={}, tokens={})", model_name, tokens_used);

        // Parser la réponse JSON
        let analysis_result: serde_json::Value = serde_json::from_str(&response_text)
            .map_err(|e| {
                error!("[KYCService] Erreur parsing JSON IA: {}", e);
                AppError::Internal(format!("Réponse IA invalide: {}", e))
            })?;

        // Enrichir avec métadonnées
        let enriched_result = json!({
            "document_type": document_type,
            "model_used": model_name,
            "tokens_used": tokens_used,
            "analysis_timestamp": chrono::Utc::now(),
            "extracted_data": analysis_result,
        });

        Ok(enriched_result)
    }

    /// ✅ Construire le prompt spécialisé pour analyse KYC selon le type de document
    fn build_kyc_analysis_prompt(&self, document_type: &str) -> String {
        let type_instructions = match document_type {
            "permis" => r#"
TYPE: Permis de conduire
EXTRAIRE OBLIGATOIREMENT:
- Numéro de permis (format: lettres + chiffres)
- Nom complet du titulaire
- Date de naissance
- Date de délivrance
- Date d'expiration
- Catégories de véhicules autorisées
- Lieu de délivrance
- Photo du titulaire (présente/absente)
- Signature (présente/absente)

VÉRIFICATIONS:
- Document authentique (filigranes, hologrammes, sécurité)
- Cohérence des dates (expiration > délivrance)
- Lisibilité du texte
- Qualité de la photo"#,

            "cni" => r#"
TYPE: Carte Nationale d'Identité
EXTRAIRE OBLIGATOIREMENT:
- Numéro de CNI
- Nom complet
- Prénom(s)
- Date de naissance
- Lieu de naissance
- Nationalité
- Sexe
- Taille
- Adresse
- Date de délivrance
- Date d'expiration
- Photo du titulaire (présente/absente)
- Signature (présente/absente)

VÉRIFICATIONS:
- Document authentique (sécurités visibles)
- Cohérence des dates
- Photo correspond au document
- Texte lisible"#,

            "assurance" => r#"
TYPE: Assurance véhicule
EXTRAIRE OBLIGATOIREMENT:
- Numéro de police d'assurance
- Nom de la compagnie d'assurance
- Nom du titulaire
- Numéro d'immatriculation du véhicule
- Date de début de couverture
- Date d'expiration
- Type de couverture (tiers, tous risques, etc.)
- Montant de la prime

VÉRIFICATIONS:
- Document valide (non expiré)
- Cohérence des dates
- Informations complètes
- Authenticité (logo, cachets)"#,

            "passeport" => r#"
TYPE: Passeport
EXTRAIRE OBLIGATOIREMENT:
- Numéro de passeport
- Nom complet
- Prénom(s)
- Date de naissance
- Lieu de naissance
- Nationalité
- Sexe
- Date de délivrance
- Date d'expiration
- Autorité de délivrance
- Photo du titulaire (présente/absente)
- Signature (présente/absente)

VÉRIFICATIONS:
- Document authentique (sécurités, filigranes)
- Cohérence des dates
- Photo de qualité
- Pages de données lisibles"#,

            "carte_grise" => r#"
TYPE: Carte Grise (Certificat d'immatriculation)
EXTRAIRE OBLIGATOIREMENT:
- Numéro d'immatriculation
- Nom du propriétaire
- Adresse du propriétaire
- Marque du véhicule
- Type de véhicule
- Numéro de série (VIN)
- Date de première immatriculation
- Puissance fiscale
- Type de carburant
- Date de délivrance

VÉRIFICATIONS:
- Document authentique
- Cohérence des informations
- Lisibilité complète
- Cachets officiels présents"#,

            _ => r#"
TYPE: Document d'identité général
EXTRAIRE:
- Tous les textes visibles
- Numéros d'identification
- Dates importantes
- Informations personnelles
- Sécurités visibles"#,
        };

        format!(
            r#"Tu es un expert en vérification de documents d'identité pour la plateforme Yukpomnang (Afrique - CEMAC).

OBJECTIF: Analyser ce document {} et extraire TOUTES les informations pertinentes pour vérification KYC.

{}

INSTRUCTIONS CRITIQUES:
1. Effectue une OCR COMPLÈTE de tous les textes visibles
2. Extrais TOUTES les informations structurées
3. Vérifie l'authenticité (sécurités, filigranes, hologrammes)
4. Détecte les anomalies ou incohérences
5. Évalue la qualité et la lisibilité
6. Calcule un score de confiance (0.0 à 1.0)

FORMAT DE SORTIE (JSON STRICT - PAS DE MARKDOWN):
{{
    "document_number": "Numéro extrait ou null",
    "full_name": "Nom complet extrait",
    "birth_date": "Date de naissance (YYYY-MM-DD) ou null",
    "expiry_date": "Date d'expiration (YYYY-MM-DD) ou null",
    "issue_date": "Date de délivrance (YYYY-MM-DD) ou null",
    "extracted_fields": {{
        "champ1": "valeur1",
        "champ2": "valeur2"
    }},
    "authenticity_checks": {{
        "has_security_features": true/false,
        "has_photo": true/false,
        "has_signature": true/false,
        "watermarks_detected": true/false,
        "holograms_detected": true/false
    }},
    "quality_assessment": {{
        "readability_score": 0.0-1.0,
        "image_quality": "excellent/good/fair/poor",
        "text_clarity": "excellent/good/fair/poor"
    }},
    "anomalies_detected": [
        "anomalie1",
        "anomalie2"
    ],
    "confidence_score": 0.0-1.0,
    "is_valid": true/false,
    "recommendation": "approved/rejected/review_required",
    "rejection_reason": "Raison si rejeté, null sinon"
}}

IMPORTANT: 
- Retourne UNIQUEMENT le JSON, sans texte avant ou après
- Si une information n'est pas lisible, utilise null
- Le confidence_score doit refléter la certitude globale de l'analyse
- is_valid = true seulement si le document semble authentique ET lisible"#,
            document_type, type_instructions
        )
    }
}

