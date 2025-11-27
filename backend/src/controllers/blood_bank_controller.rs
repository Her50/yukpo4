use crate::core::types::{AppError, AppResult};
use crate::middlewares::jwt::AuthenticatedUser;
use crate::state::AppState;
use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use log::{error, info};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::{FromRow, Row};
use std::sync::Arc;

#[derive(Debug, Deserialize)]
pub struct CreateBloodBankRequest {
    pub service_id: i32,
    pub hopital_id: Option<i32>, // Lien optionnel avec un hôpital
    pub nom: String,
    pub adresse: Option<String>,
    pub quartier: Option<String>,
    pub ville: Option<String>,
    pub gps: Option<String>,
    pub stocks_groupes_sanguins: Option<serde_json::Value>, // JSONB avec groupes et quantités
    pub accepte_dons: Option<bool>,
    pub accepte_demandes: Option<bool>,
    pub urgence_24h: Option<bool>,
    pub planning_hebdomadaire: Option<serde_json::Value>,
    pub horaires_dons: Option<Vec<String>>, // ["08:00", "17:00"]
    pub telephone: Option<String>,
    pub telephone_urgence: Option<String>,
    pub whatsapp: Option<String>,
    pub email: Option<String>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct BloodBank {
    pub id: i32,
    pub service_id: i32,
    pub user_id: i32,
    pub hopital_id: Option<i32>,
    pub nom: String,
    pub adresse: Option<String>,
    pub quartier: Option<String>,
    pub ville: Option<String>,
    pub gps: Option<String>,
    pub stocks_groupes_sanguins: serde_json::Value,
    pub accepte_dons: bool,
    pub accepte_demandes: bool,
    pub urgence_24h: bool,
    pub planning_hebdomadaire: Option<serde_json::Value>,
    pub horaires_dons: Option<Vec<chrono::NaiveTime>>,
    pub telephone: Option<String>,
    pub telephone_urgence: Option<String>,
    pub whatsapp: Option<String>,
    pub email: Option<String>,
    pub is_active: bool,
    pub is_available_now: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Deserialize)]
pub struct SearchBloodBanksQuery {
    pub query: Option<String>,
    pub gps_zone: Option<String>,
    pub radius_km: Option<i32>,
    pub groupe_sanguin: Option<String>, // "O+", "AB-", etc.
    pub urgence: Option<bool>,
    pub ville: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateStocksRequest {
    pub stocks_groupes_sanguins: serde_json::Value,
}

/// Créer une banque de sang
pub async fn create_blood_bank(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<CreateBloodBankRequest>,
) -> AppResult<impl IntoResponse> {
    info!("[create_blood_bank] Création banque de sang pour user_id={}, service_id={}", user_id, payload.service_id);

    // Vérifier que le service appartient à l'utilisateur
    let service_exists: Option<i32> = sqlx::query_scalar(
        "SELECT id FROM services WHERE id = $1 AND user_id = $2"
    )
    .bind(payload.service_id)
    .bind(user_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| {
        error!("[create_blood_bank] Erreur vérification service: {}", e);
        AppError::Internal(format!("Erreur vérification service: {}", e))
    })?;

    if service_exists.is_none() {
        return Err(AppError::NotFound("Service non trouvé ou n'appartient pas à l'utilisateur".to_string()));
    }

    // ✅ NOUVEAU : Vérifier si une banque de sang existe déjà pour ce service
    let existing_blood_bank: Option<i32> = sqlx::query_scalar(
        "SELECT id FROM banques_sang WHERE service_id = $1 AND user_id = $2"
    )
    .bind(payload.service_id)
    .bind(user_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| {
        error!("[create_blood_bank] Erreur vérification banque de sang existante: {}", e);
        AppError::Internal(format!("Erreur vérification banque de sang existante: {}", e))
    })?;

    if existing_blood_bank.is_some() {
        info!("[create_blood_bank] Banque de sang existe déjà pour service_id={}, utilisation UPSERT", payload.service_id);
        let blood_bank_id = existing_blood_bank.unwrap();
        
        let horaires_dons: Option<Vec<chrono::NaiveTime>> = payload.horaires_dons
            .map(|horaires| {
                horaires
                    .into_iter()
                    .filter_map(|h| chrono::NaiveTime::parse_from_str(&h, "%H:%M").ok())
                    .collect()
            });
        let stocks = payload.stocks_groupes_sanguins.unwrap_or_else(|| json!({}));

        sqlx::query(
            r#"
            UPDATE banques_sang SET
                hopital_id = $3,
                nom = $4,
                adresse = $5,
                quartier = $6,
                ville = $7,
                gps = $8,
                stocks_groupes_sanguins = $9,
                accepte_dons = $10,
                accepte_demandes = $11,
                urgence_24h = $12,
                planning_hebdomadaire = $13,
                horaires_dons = $14,
                telephone = $15,
                telephone_urgence = $16,
                whatsapp = $17,
                email = $18,
                updated_at = NOW()
            WHERE id = $1 AND user_id = $2
            "#
        )
        .bind(blood_bank_id)
        .bind(user_id)
        .bind(payload.hopital_id)
        .bind(&payload.nom)
        .bind(payload.adresse.as_ref())
        .bind(payload.quartier.as_ref())
        .bind(payload.ville.as_ref())
        .bind(payload.gps.as_ref())
        .bind(&stocks)
        .bind(payload.accepte_dons.unwrap_or(true))
        .bind(payload.accepte_demandes.unwrap_or(true))
        .bind(payload.urgence_24h.unwrap_or(false))
        .bind(payload.planning_hebdomadaire.as_ref())
        .bind(horaires_dons.as_ref())
        .bind(payload.telephone.as_ref())
        .bind(payload.telephone_urgence.as_ref())
        .bind(payload.whatsapp.as_ref())
        .bind(payload.email.as_ref())
        .execute(&state.pg)
        .await
        .map_err(|e| {
            error!("[create_blood_bank] Erreur mise à jour: {}", e);
            AppError::Internal(format!("Erreur mise à jour banque de sang: {}", e))
        })?;

        return Ok((StatusCode::OK, Json(json!({
            "success": true,
            "id": blood_bank_id,
            "message": "Banque de sang mise à jour avec succès"
        }))));
    }

    // Vérifier que hopital_id appartient à l'utilisateur si fourni
    if let Some(hopital_id) = payload.hopital_id {
        let hopital_exists: Option<i32> = sqlx::query_scalar(
            "SELECT id FROM hopitaux_cliniques WHERE id = $1 AND user_id = $2"
        )
        .bind(hopital_id)
        .bind(user_id)
        .fetch_optional(&state.pg)
        .await
        .map_err(|e| {
            error!("[create_blood_bank] Erreur vérification hôpital: {}", e);
            AppError::Internal(format!("Erreur vérification hôpital: {}", e))
        })?;

        if hopital_exists.is_none() {
            return Err(AppError::NotFound("Hôpital non trouvé ou n'appartient pas à l'utilisateur".to_string()));
        }
    }

    // Convertir horaires_dons en TIME[]
    let horaires_dons: Option<Vec<chrono::NaiveTime>> = payload.horaires_dons
        .map(|horaires| {
            horaires
                .into_iter()
                .filter_map(|h| chrono::NaiveTime::parse_from_str(&h, "%H:%M").ok())
                .collect()
        });

    // Stocks par défaut si non fourni
    let stocks = payload.stocks_groupes_sanguins.unwrap_or_else(|| json!({}));

    let blood_bank_id: i32 = sqlx::query_scalar(
        r#"
        INSERT INTO banques_sang (
            service_id, user_id, hopital_id, nom, adresse, quartier, ville, gps,
            stocks_groupes_sanguins, accepte_dons, accepte_demandes, urgence_24h,
            planning_hebdomadaire, horaires_dons, telephone, telephone_urgence, whatsapp, email
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        RETURNING id
        "#
    )
    .bind(payload.service_id)
    .bind(user_id)
    .bind(payload.hopital_id)
    .bind(&payload.nom)
    .bind(payload.adresse)
    .bind(payload.quartier)
    .bind(payload.ville)
    .bind(payload.gps)
    .bind(stocks)
    .bind(payload.accepte_dons.unwrap_or(true))
    .bind(payload.accepte_demandes.unwrap_or(true))
    .bind(payload.urgence_24h.unwrap_or(false))
    .bind(payload.planning_hebdomadaire)
    .bind(horaires_dons.as_ref().map(|h| h.as_slice()))
    .bind(payload.telephone)
    .bind(payload.telephone_urgence)
    .bind(payload.whatsapp)
    .bind(payload.email)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        error!("[create_blood_bank] Erreur insertion: {}", e);
        AppError::Internal(format!("Erreur création banque de sang: {}", e))
    })?;

    // ✅ NOUVEAU : Marquer le service comme spécialisé
    sqlx::query(
        "UPDATE services SET specialized_type = 'banque_sang' WHERE id = $1"
    )
    .bind(payload.service_id)
    .execute(&state.pg)
    .await
    .map_err(|e| {
        error!("[create_blood_bank] Erreur mise à jour specialized_type: {}", e);
        AppError::Internal("Erreur mise à jour specialized_type".to_string())
    })?;

    // Mettre à jour is_available_now avec la fonction PostgreSQL
    sqlx::query(
        r#"
        UPDATE banques_sang
        SET is_available_now = CASE 
            WHEN planning_hebdomadaire IS NOT NULL THEN
                is_medical_service_available(
                    jsonb_build_object('planningHebdomadaire', planning_hebdomadaire),
                    NOW(),
                    NULL
                )
            WHEN urgence_24h THEN TRUE
            ELSE TRUE
        END
        WHERE id = $1
        "#
    )
    .bind(blood_bank_id)
    .execute(&state.pg)
    .await
    .map_err(|e| {
        error!("[create_blood_bank] Erreur mise à jour disponibilité: {}", e);
        AppError::Internal("Erreur mise à jour disponibilité".to_string())
    })?;

    info!("[create_blood_bank] Banque de sang créée avec succès: id={}, service_id={} marqué comme spécialisé", blood_bank_id, payload.service_id);
    Ok((StatusCode::CREATED, Json(json!({"message": "Banque de sang créée avec succès", "id": blood_bank_id}))))
}

/// Rechercher des banques de sang
pub async fn search_blood_banks(
    State(state): State<Arc<AppState>>,
    Query(params): Query<SearchBloodBanksQuery>,
) -> AppResult<impl IntoResponse> {
    let query = params.query.as_deref().unwrap_or("");
    let user_gps = params.gps_zone;
    let radius = params.radius_km.unwrap_or(50);
    let groupe_sanguin = params.groupe_sanguin;
    let urgence = params.urgence.unwrap_or(false);

    let sql = r#"
        SELECT 
            banque_id as id,
            service_id,
            hopital_id,
            nom,
            adresse,
            quartier,
            ville,
            gps,
            telephone,
            telephone_urgence,
            whatsapp,
            stocks_groupes_sanguins,
            accepte_dons,
            accepte_demandes,
            urgence_24h,
            is_available_now,
            distance_km,
            relevance_score
        FROM search_banques_sang_with_moment($1, $2, $3, $4, $5, FALSE)
    "#;

    let rows = sqlx::query(sql)
        .bind(query)
        .bind(user_gps)
        .bind(radius)
        .bind(groupe_sanguin)
        .bind(urgence)
        .fetch_all(&state.pg)
        .await
        .map_err(|e| {
            error!("[search_blood_banks] Erreur recherche: {}", e);
            AppError::Internal("Erreur recherche banques de sang".to_string())
        })?;

    let mut results = Vec::new();
    for row in rows {
        results.push(json!({
            "id": row.get::<i32, _>("id"),
            "service_id": row.get::<i32, _>("service_id"),
            "hopital_id": row.get::<Option<i32>, _>("hopital_id"),
            "nom": row.get::<String, _>("nom"),
            "adresse": row.get::<Option<String>, _>("adresse"),
            "quartier": row.get::<Option<String>, _>("quartier"),
            "ville": row.get::<Option<String>, _>("ville"),
            "gps": row.get::<Option<String>, _>("gps"),
            "telephone": row.get::<Option<String>, _>("telephone"),
            "telephone_urgence": row.get::<Option<String>, _>("telephone_urgence"),
            "whatsapp": row.get::<Option<String>, _>("whatsapp"),
            "stocks_groupes_sanguins": row.get::<serde_json::Value, _>("stocks_groupes_sanguins"),
            "accepte_dons": row.get::<bool, _>("accepte_dons"),
            "accepte_demandes": row.get::<bool, _>("accepte_demandes"),
            "urgence_24h": row.get::<bool, _>("urgence_24h"),
            "is_available_now": row.get::<bool, _>("is_available_now"),
            "distance_km": row.get::<Option<f64>, _>("distance_km"),
            "relevance_score": row.get::<f64, _>("relevance_score"),
        }));
    }

    Ok((StatusCode::OK, Json(json!({"success": true, "data": results}))))
}

/// Obtenir une banque de sang par ID
pub async fn get_blood_bank(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    let blood_bank: Option<BloodBank> = sqlx::query_as::<_, BloodBank>(
        "SELECT * FROM banques_sang WHERE id = $1"
    )
    .bind(id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| {
        error!("[get_blood_bank] Erreur: {}", e);
        AppError::Internal("Erreur récupération banque de sang".to_string())
    })?;

    match blood_bank {
        Some(bb) => Ok((StatusCode::OK, Json(json!({"success": true, "data": bb})))),
        None => Err(AppError::NotFound("Banque de sang non trouvée".to_string())),
    }
}

/// Mettre à jour les stocks d'une banque de sang
pub async fn update_blood_bank_stocks(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(id): Path<i32>,
    Json(payload): Json<UpdateStocksRequest>,
) -> AppResult<impl IntoResponse> {
    // Vérifier que la banque de sang appartient à l'utilisateur
    let blood_bank_exists: Option<i32> = sqlx::query_scalar(
        "SELECT id FROM banques_sang WHERE id = $1 AND user_id = $2"
    )
    .bind(id)
    .bind(user_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| {
        error!("[update_blood_bank_stocks] Erreur vérification: {}", e);
        AppError::Internal("Erreur vérification".to_string())
    })?;

    if blood_bank_exists.is_none() {
        return Err(AppError::NotFound("Banque de sang non trouvée ou n'appartient pas à l'utilisateur".to_string()));
    }

    // Mettre à jour les stocks avec timestamp
    let now = chrono::Utc::now().to_rfc3339();
    let mut stocks = payload.stocks_groupes_sanguins;
    let stocks_with_timestamp = if let Some(stocks_obj) = stocks.as_object_mut() {
        // Ajouter/ mettre à jour derniere_maj pour chaque groupe
        for (_, stock_value) in stocks_obj.iter_mut() {
            if let Some(stock_obj) = stock_value.as_object_mut() {
                stock_obj.insert("derniere_maj".to_string(), json!(now));
            }
        }
        json!(stocks_obj)
    } else {
        stocks
    };

    sqlx::query(
        "UPDATE banques_sang SET stocks_groupes_sanguins = $1, updated_at = NOW() WHERE id = $2"
    )
    .bind(stocks_with_timestamp)
    .bind(id)
    .execute(&state.pg)
    .await
    .map_err(|e| {
        error!("[update_blood_bank_stocks] Erreur mise à jour: {}", e);
        AppError::Internal("Erreur mise à jour stocks".to_string())
    })?;

    Ok((StatusCode::OK, Json(json!({"message": "Stocks mis à jour avec succès"}))))
}

