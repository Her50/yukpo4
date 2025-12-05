// ✅ Service pour gestion conférences et lives scolaires

use crate::core::types::{AppError, AppResult};
use crate::models::orientation_scolaire::{
    ConferenceLiveScolaire, CreateConferenceRequest, SearchConferencesRequest,
};
use crate::state::AppState;
use crate::utils::livekit;
use log::{error, info, warn};
use sqlx::PgPool;
use std::sync::Arc;
use uuid::Uuid;

pub struct ConferencesLivesService {
    pool: Arc<PgPool>,
    state: Arc<AppState>,
}

impl ConferencesLivesService {
    pub fn new(pool: Arc<PgPool>, state: Arc<AppState>) -> Self {
        Self { pool, state }
    }

    /// Créer une conférence avec LiveKit
    pub async fn create_conference(
        &self,
        user_id: i32,
        request: CreateConferenceRequest,
    ) -> AppResult<ConferenceLiveScolaire> {
        info!(
            "[CONFERENCES_LIVES] Création conférence: user_id={}, etablissement_id={}",
            user_id, request.etablissement_id
        );

        // Générer un nom de room unique
        let room_name = format!(
            "conf-{}-{}",
            request.etablissement_id,
            Uuid::new_v4().to_string().replace("-", "")
        );

        // Générer le token LiveKit
        let room_token = self.generate_room_token(&room_name, user_id).await?;

        // Récupérer l'URL LiveKit depuis la config
        let livekit_url = std::env::var("LIVEKIT_URL")
            .unwrap_or_else(|_| "wss://yukpo-livekit.livekit.cloud".to_string());

        let conference = sqlx::query_as::<_, ConferenceLiveScolaire>(
            r#"
            INSERT INTO conferences_lives_scolaires (
                etablissement_id, user_id, titre, description, type_conference,
                date_programmee, duree_estimee, is_live, room_name, room_token,
                livekit_url, nombre_participants, nombre_max_participants,
                is_active, is_annule
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            RETURNING *
            "#,
        )
        .bind(request.etablissement_id)
        .bind(user_id)
        .bind(request.titre)
        .bind(request.description)
        .bind(request.type_conference)
        .bind(request.date_programmee)
        .bind(request.duree_estimee)
        .bind(true) // is_live
        .bind(&room_name)
        .bind(&room_token)
        .bind(&livekit_url)
        .bind(0) // nombre_participants initial
        .bind(request.nombre_max_participants)
        .bind(true) // is_active
        .bind(false) // is_annule
        .fetch_one(&*self.pool)
        .await
        .map_err(|e| {
            error!("[CONFERENCES_LIVES] Erreur création: {}", e);
            AppError::Internal(format!("Erreur création conférence: {}", e))
        })?;

        // Invalider le cache des conférences programmées
        self.invalidate_cache_programmees().await;

        info!(
            "[CONFERENCES_LIVES] ✅ Conférence créée: id={}, room={}",
            conference.id, room_name
        );
        Ok(conference)
    }

    /// Lister les conférences programmées (à venir)
    pub async fn list_conferences_programmees(
        &self,
        page: Option<i64>,
        limit: Option<i64>,
    ) -> AppResult<(Vec<ConferenceLiveScolaire>, i64)> {
        // Vérifier le cache
        let cache_key = "orientation:conferences:programmees";
        if let Ok(Some(cached)) =
            crate::utils::redis_helper::get_with_retry(&self.state.redis_client, cache_key).await
        {
            if let Ok(result) = serde_json::from_str::<(Vec<ConferenceLiveScolaire>, i64)>(&cached)
            {
                return Ok(result);
            }
        }

        let page = page.unwrap_or(1).max(1);
        let limit = limit.unwrap_or(20).min(100).max(1);
        let offset = (page - 1) * limit;
        let now = chrono::Utc::now();

        let conferences = sqlx::query_as::<_, ConferenceLiveScolaire>(
            r#"
            SELECT * FROM conferences_lives_scolaires
            WHERE is_active = true AND is_annule = false AND date_programmee >= $1
            ORDER BY date_programmee ASC
            LIMIT $2 OFFSET $3
            "#,
        )
        .bind(now)
        .bind(limit)
        .bind(offset)
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| {
            error!("[CONFERENCES_LIVES] Erreur list programmées: {}", e);
            AppError::Internal(format!("Erreur liste conférences programmées: {}", e))
        })?;

        let total: i64 = sqlx::query_scalar(
            "SELECT COUNT(*)::bigint FROM conferences_lives_scolaires WHERE is_active = true AND is_annule = false AND date_programmee >= $1"
        )
        .bind(now)
        .fetch_one(&*self.pool)
        .await
        .map_err(|e| {
            error!("[CONFERENCES_LIVES] Erreur count: {}", e);
            AppError::Internal(format!("Erreur count conférences: {}", e))
        })?;

        let result = (conferences, total);

        // Mettre en cache (TTL 5 minutes)
        if let Ok(json_str) = serde_json::to_string(&result) {
            let _ = crate::utils::redis_helper::set_with_retry(
                &self.state.redis_client,
                cache_key,
                &json_str,
                300, // 5 minutes
            )
            .await;
        }

        Ok(result)
    }

    /// Obtenir les détails d'une conférence avec room token
    pub async fn get_conference_details(
        &self,
        conference_id: i32,
    ) -> AppResult<ConferenceLiveScolaire> {
        let conference = sqlx::query_as::<_, ConferenceLiveScolaire>(
            "SELECT * FROM conferences_lives_scolaires WHERE id = $1 AND is_active = true",
        )
        .bind(conference_id)
        .fetch_optional(&*self.pool)
        .await
        .map_err(|e| {
            error!("[CONFERENCES_LIVES] Erreur get details: {}", e);
            AppError::Internal(format!("Erreur récupération conférence: {}", e))
        })?
        .ok_or_else(|| AppError::NotFound("Conférence non trouvée".to_string()))?;

        Ok(conference)
    }

    /// Rejoindre une conférence live (génère un nouveau token pour le participant)
    pub async fn join_conference(
        &self,
        conference_id: i32,
        user_id: i32,
    ) -> AppResult<(ConferenceLiveScolaire, String)> {
        info!(
            "[CONFERENCES_LIVES] Join conférence: user_id={}, conference_id={}",
            user_id, conference_id
        );

        let conference = self.get_conference_details(conference_id).await?;

        // Vérifier que la conférence n'est pas annulée
        if conference.is_annule {
            return Err(AppError::BadRequest(
                "La conférence a été annulée".to_string(),
            ));
        }

        // Vérifier le nombre maximum de participants
        if let Some(max_participants) = conference.nombre_max_participants {
            if conference.nombre_participants >= max_participants {
                return Err(AppError::BadRequest(
                    "Nombre maximum de participants atteint".to_string(),
                ));
            }
        }

        // Vérifier que la conférence est programmée (ou en cours)
        let now = chrono::Utc::now();
        if conference.date_programmee > now {
            // La conférence n'a pas encore commencé, mais on peut permettre la connexion
            // (certains systèmes permettent de rejoindre avant)
        }

        // Générer un token pour le participant
        let participant_token = self
            .generate_participant_token(conference.room_name.as_deref().unwrap_or(""), user_id)
            .await?;

        // Incrémenter le nombre de participants
        let _ = sqlx::query(
            "UPDATE conferences_lives_scolaires SET nombre_participants = nombre_participants + 1 WHERE id = $1"
        )
        .bind(conference_id)
        .execute(&*self.pool)
        .await;

        Ok((conference, participant_token))
    }

    /// Rechercher des conférences
    pub async fn search_conferences(
        &self,
        request: SearchConferencesRequest,
    ) -> AppResult<(Vec<ConferenceLiveScolaire>, i64)> {
        let page = request.page.unwrap_or(1).max(1);
        let limit = request.limit.unwrap_or(20).min(100).max(1);
        let offset = (page - 1) * limit;

        let mut query = sqlx::QueryBuilder::new(
            "SELECT * FROM conferences_lives_scolaires WHERE is_active = true",
        );

        if let Some(etablissement_id) = request.etablissement_id {
            query.push(" AND etablissement_id = ");
            query.push_bind(etablissement_id);
        }

        if let Some(type_conference) = &request.type_conference {
            query.push(" AND type_conference = ");
            query.push_bind(type_conference);
        }

        if let Some(date_min) = request.date_min {
            query.push(" AND date_programmee >= ");
            query.push_bind(date_min);
        }

        if let Some(date_max) = request.date_max {
            query.push(" AND date_programmee <= ");
            query.push_bind(date_max);
        }

        if request.actives_seulement.unwrap_or(false) {
            let now = chrono::Utc::now();
            query.push(" AND date_programmee >= ");
            query.push_bind(now);
            query.push(" AND is_annule = false");
        }

        query.push(" ORDER BY date_programmee ASC");
        query.push(" LIMIT ");
        query.push_bind(limit);
        query.push(" OFFSET ");
        query.push_bind(offset);

        let conferences = query
            .build_query_as::<ConferenceLiveScolaire>()
            .fetch_all(&*self.pool)
            .await
            .map_err(|e| {
                error!("[CONFERENCES_LIVES] Erreur search: {}", e);
                AppError::Internal(format!("Erreur recherche conférences: {}", e))
            })?;

        // Count query
        let mut count_query = sqlx::QueryBuilder::new(
            "SELECT COUNT(*)::bigint FROM conferences_lives_scolaires WHERE is_active = true",
        );

        if let Some(etablissement_id) = request.etablissement_id {
            count_query.push(" AND etablissement_id = ");
            count_query.push_bind(etablissement_id);
        }

        if let Some(type_conference) = &request.type_conference {
            count_query.push(" AND type_conference = ");
            count_query.push_bind(type_conference);
        }

        if let Some(date_min) = request.date_min {
            count_query.push(" AND date_programmee >= ");
            count_query.push_bind(date_min);
        }

        if let Some(date_max) = request.date_max {
            count_query.push(" AND date_programmee <= ");
            count_query.push_bind(date_max);
        }

        if request.actives_seulement.unwrap_or(false) {
            let now = chrono::Utc::now();
            count_query.push(" AND date_programmee >= ");
            count_query.push_bind(now);
            count_query.push(" AND is_annule = false");
        }

        let total: i64 = count_query
            .build_query_scalar()
            .fetch_one(&*self.pool)
            .await
            .map_err(|e| {
                error!("[CONFERENCES_LIVES] Erreur count: {}", e);
                AppError::Internal(format!("Erreur count conférences: {}", e))
            })?;

        Ok((conferences, total))
    }

    /// Générer un token de room pour le créateur (avec permissions complètes)
    async fn generate_room_token(&self, room_name: &str, user_id: i32) -> Result<String, AppError> {
        let api_key = std::env::var("LIVEKIT_API_KEY")
            .map_err(|_| AppError::Internal("LIVEKIT_API_KEY non configuré".to_string()))?;
        let api_secret = std::env::var("LIVEKIT_API_SECRET")
            .map_err(|_| AppError::Internal("LIVEKIT_API_SECRET non configuré".to_string()))?;

        self.create_access_token(
            &api_key,
            &api_secret,
            room_name,
            &format!("host-{}", user_id),
            true, // can_publish pour le créateur
        )
    }

    /// Générer un token de participant (permissions limitées)
    async fn generate_participant_token(
        &self,
        room_name: &str,
        user_id: i32,
    ) -> Result<String, AppError> {
        let api_key = std::env::var("LIVEKIT_API_KEY")
            .map_err(|_| AppError::Internal("LIVEKIT_API_KEY non configuré".to_string()))?;
        let api_secret = std::env::var("LIVEKIT_API_SECRET")
            .map_err(|_| AppError::Internal("LIVEKIT_API_SECRET non configuré".to_string()))?;

        self.create_access_token(
            &api_key,
            &api_secret,
            room_name,
            &format!("participant-{}", user_id),
            false, // can_publish = false pour les participants (viewers seulement)
        )
    }

    /// Créer un token d'accès LiveKit avec permissions spécifiques
    fn create_access_token(
        &self,
        api_key: &str,
        api_secret: &str,
        room_name: &str,
        identity: &str,
        can_publish: bool,
    ) -> Result<String, AppError> {
        use chrono::{Duration, Utc};
        use jsonwebtoken::{encode, Algorithm, EncodingKey, Header};
        use serde::Serialize;

        #[derive(Debug, Serialize)]
        struct LiveKitClaims {
            iss: String,
            sub: String,
            exp: usize,
            video: LiveKitVideoGrant,
        }

        #[derive(Debug, Serialize)]
        struct LiveKitVideoGrant {
            room: String,
            #[serde(rename = "roomJoin")]
            room_join: bool,
            #[serde(rename = "canPublish")]
            can_publish: bool,
            #[serde(rename = "canSubscribe")]
            can_subscribe: bool,
            #[serde(rename = "canPublishData")]
            can_publish_data: bool,
        }

        let header = Header::new(Algorithm::HS256);
        let exp = Utc::now() + Duration::hours(4);

        let claims = LiveKitClaims {
            iss: api_key.to_string(),
            sub: identity.to_string(),
            exp: exp.timestamp() as usize,
            video: LiveKitVideoGrant {
                room: room_name.to_string(),
                room_join: true,
                can_publish,
                can_subscribe: true,
                can_publish_data: can_publish,
            },
        };

        let token = encode(
            &header,
            &claims,
            &EncodingKey::from_secret(api_secret.as_bytes()),
        )
        .map_err(|err| AppError::Internal(format!("Erreur génération token LiveKit: {}", err)))?;

        Ok(token)
    }

    /// Invalider le cache des conférences programmées
    async fn invalidate_cache_programmees(&self) {
        let key = "orientation:conferences:programmees";
        let _ = crate::utils::redis_helper::del_with_retry(&self.state.redis_client, key).await;
    }
}
