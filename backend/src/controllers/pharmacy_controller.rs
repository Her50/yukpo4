use crate::core::types::{AppError, AppResult};
use crate::middlewares::jwt::AuthenticatedUser;
use crate::services::specialized_services_validation;
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
use sqlx::FromRow;
use std::sync::Arc;

#[derive(Debug, Deserialize)]
pub struct ListPharmaciesQuery {
    pub status: Option<String>, // "active", "inactive", "all"
    pub page: Option<i64>,
    pub limit: Option<i64>,
}

/// ✅ Liste des pharmacies de l'utilisateur avec pagination et filtres
pub async fn list_pharmacies(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Query(query): Query<ListPharmaciesQuery>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[list_pharmacies] Appelé pour user_id={}, status={:?}",
        user_id, query.status
    );

    let page = query.page.unwrap_or(1).max(1);
    let limit = query.limit.unwrap_or(20).min(100).max(1);
    let offset = (page - 1) * limit;

    let status_condition = match query.status.as_deref() {
        Some("active") => "AND s.is_active = true",
        Some("inactive") => "AND s.is_active = false",
        _ => "",
    };

    // ✅ FIX 2026-04-08: LEFT JOIN + filtre sur p.user_id pour inclure les pharmacies
    // dont le service_id est NULL ou dont services.user_id diffère du partenaire.
    // Les partenaires validés sans avoir passé par create_pharmacy avaient un INNER JOIN silencieux.
    let sql = format!(
        r#"
        SELECT
            p.id,
            p.service_id,
            p.user_id,
            p.nom,
            p.adresse,
            p.quartier,
            p.ville,
            p.gps,
            p.jours_garde,
            p.heures_ouverture,
            p.heures_fermeture,
            p.permanent_24h,
            p.telephone,
            p.telephone_urgence,
            p.whatsapp,
            p.email,
            p.services,
            s.is_active,
            p.is_on_duty_now,
            p.created_at,
            p.updated_at
        FROM pharmacies p
        LEFT JOIN services s ON s.id = p.service_id
        WHERE p.user_id = $1 {}
        ORDER BY p.updated_at DESC
        LIMIT $2 OFFSET $3
        "#,
        status_condition
    );

    let pharmacies = sqlx::query_as::<_, Pharmacy>(&sql)
        .bind(user_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(&state.pg)
        .await
        .map_err(|e| {
            error!("[list_pharmacies] Erreur: {}", e);
            AppError::Internal(format!("Erreur chargement pharmacies: {}", e))
        })?;

    // Compter le total pour pagination
    let count_sql = format!(
        r#"
        SELECT COUNT(*)::bigint
        FROM pharmacies p
        LEFT JOIN services s ON s.id = p.service_id
        WHERE p.user_id = $1 {}
        "#,
        status_condition
    );

    let total: i64 = sqlx::query_scalar(&count_sql)
        .bind(user_id)
        .fetch_one(&state.pg)
        .await
        .map_err(|e| {
            error!("[list_pharmacies] Erreur count: {}", e);
            AppError::Internal(format!("Erreur count pharmacies: {}", e))
        })?;

    let total_pages = if total > 0 {
        ((total as f64) / (limit as f64)).ceil() as i64
    } else {
        0
    };

    info!(
        "[list_pharmacies] ✅ {} pharmacies trouvées pour user_id={}",
        pharmacies.len(),
        user_id
    );

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": pharmacies,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total,
                "total_pages": total_pages
            }
        })),
    ))
}

#[derive(Debug, Deserialize)]
pub struct CreatePharmacyRequest {
    pub service_id: i32,
    pub nom: String,
    pub adresse: Option<String>,
    pub quartier: Option<String>,
    pub ville: Option<String>,
    pub gps: Option<String>,
    pub jours_garde: Option<String>,
    pub heures_ouverture: Option<String>,
    pub heures_fermeture: Option<String>,
    pub permanent_24h: Option<bool>,
    pub telephone: Option<String>,
    pub telephone_urgence: Option<String>,
    pub whatsapp: Option<String>,
    pub email: Option<String>,
    pub services: Option<Vec<String>>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct Pharmacy {
    pub id: i32,
    pub service_id: i32,
    pub user_id: i32,
    pub nom: String,
    pub adresse: Option<String>,
    pub quartier: Option<String>,
    pub ville: Option<String>,
    pub gps: Option<String>,
    pub jours_garde: Option<String>,
    pub heures_ouverture: Option<chrono::NaiveTime>,
    pub heures_fermeture: Option<chrono::NaiveTime>,
    pub permanent_24h: bool,
    pub telephone: Option<String>,
    pub telephone_urgence: Option<String>,
    pub whatsapp: Option<String>,
    pub email: Option<String>,
    pub services: Option<Vec<String>>,
    pub is_active: bool,
    pub is_on_duty_now: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Deserialize)]
pub struct SearchPharmaciesQuery {
    pub query: Option<String>,
    pub gps_zone: Option<String>,
    pub radius_km: Option<i32>,
    pub ville: Option<String>,
    pub on_duty_only: Option<bool>,
}

/// Créer une pharmacie
pub async fn create_pharmacy(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<CreatePharmacyRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[create_pharmacy] Création pharmacie pour user_id={}, service_id={}",
        user_id, payload.service_id
    );

    // Vérifier que le service appartient à l'utilisateur
    let service_exists: Option<i32> =
        sqlx::query_scalar("SELECT id FROM services WHERE id = $1 AND user_id = $2")
            .bind(payload.service_id)
            .bind(user_id)
            .fetch_optional(&state.pg)
            .await
            .map_err(|e| {
                error!("[create_pharmacy] Erreur vérification service: {}", e);
                AppError::Internal(format!("Erreur vérification service: {}", e))
            })?;

    if service_exists.is_none() {
        return Err(AppError::NotFound(
            "Service non trouvé ou n'appartient pas à l'utilisateur".to_string(),
        ));
    }

    // ✅ NOUVEAU : Vérifier si une pharmacie existe déjà pour ce service
    let existing_pharmacy: Option<i32> =
        sqlx::query_scalar("SELECT id FROM pharmacies WHERE service_id = $1 AND user_id = $2")
            .bind(payload.service_id)
            .bind(user_id)
            .fetch_optional(&state.pg)
            .await
            .map_err(|e| {
                error!(
                    "[create_pharmacy] Erreur vérification pharmacie existante: {}",
                    e
                );
                AppError::Internal(format!("Erreur vérification pharmacie existante: {}", e))
            })?;

    if existing_pharmacy.is_some() {
        info!(
            "[create_pharmacy] Pharmacie existe déjà pour service_id={}, utilisation UPSERT",
            payload.service_id
        );
        // ✅ UPSERT : Mise à jour si existe, sinon création
        let pharmacy_id = existing_pharmacy.unwrap();

        // ✅ NOUVEAU: Validation stricte avant mise à jour
        // Valider GPS
        if let Some(ref gps) = payload.gps {
            specialized_services_validation::validate_gps_format(gps)?;
        }

        // Valider email
        if let Some(ref email) = payload.email {
            specialized_services_validation::validate_email_format(email)?;
        }

        // Valider heures d'ouverture/fermeture
        specialized_services_validation::validate_opening_hours(
            payload.heures_ouverture.as_deref(),
            payload.heures_fermeture.as_deref(),
            payload.permanent_24h.unwrap_or(false),
        )?;

        // Valider téléphone (optionnel)
        if let Some(ref phone) = payload.telephone {
            specialized_services_validation::validate_phone_format(phone)?;
        }
        if let Some(ref phone) = payload.telephone_urgence {
            specialized_services_validation::validate_phone_format(phone)?;
        }
        if let Some(ref phone) = payload.whatsapp {
            specialized_services_validation::validate_phone_format(phone)?;
        }

        let heures_ouverture = payload
            .heures_ouverture
            .and_then(|h| chrono::NaiveTime::parse_from_str(&h, "%H:%M").ok());
        let heures_fermeture = payload
            .heures_fermeture
            .and_then(|h| chrono::NaiveTime::parse_from_str(&h, "%H:%M").ok());

        sqlx::query(
            r#"
            UPDATE pharmacies SET
                nom = $3,
                adresse = $4,
                quartier = $5,
                ville = $6,
                gps = $7,
                jours_garde = $8,
                heures_ouverture = $9,
                heures_fermeture = $10,
                permanent_24h = $11,
                telephone = $12,
                telephone_urgence = $13,
                whatsapp = $14,
                email = $15,
                services = $16,
                updated_at = NOW()
            WHERE id = $1 AND user_id = $2
            "#,
        )
        .bind(pharmacy_id)
        .bind(user_id)
        .bind(&payload.nom)
        .bind(payload.adresse)
        .bind(payload.quartier)
        .bind(payload.ville)
        .bind(payload.gps)
        .bind(payload.jours_garde)
        .bind(heures_ouverture)
        .bind(heures_fermeture)
        .bind(payload.permanent_24h.unwrap_or(false))
        .bind(payload.telephone)
        .bind(payload.telephone_urgence)
        .bind(payload.whatsapp)
        .bind(payload.email)
        .bind(payload.services.as_ref().map(|s| s.as_slice()))
        .execute(&state.pg)
        .await
        .map_err(|e| {
            error!("[create_pharmacy] Erreur mise à jour: {}", e);
            AppError::Internal(format!("Erreur mise à jour pharmacie: {}", e))
        })?;

        return Ok((
            StatusCode::OK,
            Json(json!({
                "success": true,
                "id": pharmacy_id,
                "message": "Pharmacie mise à jour avec succès"
            })),
        ));
    }

    // ✅ NOUVEAU: Validation stricte avant insertion
    // Valider GPS
    if let Some(ref gps) = payload.gps {
        specialized_services_validation::validate_gps_format(gps)?;
    }

    // Valider email
    if let Some(ref email) = payload.email {
        specialized_services_validation::validate_email_format(email)?;
    }

    // Valider heures d'ouverture/fermeture
    specialized_services_validation::validate_opening_hours(
        payload.heures_ouverture.as_deref(),
        payload.heures_fermeture.as_deref(),
        payload.permanent_24h.unwrap_or(false),
    )?;

    // Valider téléphone (optionnel)
    if let Some(ref phone) = payload.telephone {
        specialized_services_validation::validate_phone_format(phone)?;
    }
    if let Some(ref phone) = payload.telephone_urgence {
        specialized_services_validation::validate_phone_format(phone)?;
    }
    if let Some(ref phone) = payload.whatsapp {
        specialized_services_validation::validate_phone_format(phone)?;
    }

    // Convertir heures_ouverture et heures_fermeture
    let heures_ouverture = payload
        .heures_ouverture
        .and_then(|h| chrono::NaiveTime::parse_from_str(&h, "%H:%M").ok());
    let heures_fermeture = payload
        .heures_fermeture
        .and_then(|h| chrono::NaiveTime::parse_from_str(&h, "%H:%M").ok());

    // Insérer la pharmacie
    let pharmacy_id: i32 = sqlx::query_scalar(
        r#"
        INSERT INTO pharmacies (
            service_id, user_id, nom, adresse, quartier, ville, gps,
            jours_garde, heures_ouverture, heures_fermeture, permanent_24h,
            telephone, telephone_urgence, whatsapp, email, services
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING id
        "#,
    )
    .bind(payload.service_id)
    .bind(user_id)
    .bind(&payload.nom)
    .bind(payload.adresse)
    .bind(payload.quartier)
    .bind(payload.ville)
    .bind(payload.gps)
    .bind(payload.jours_garde)
    .bind(heures_ouverture)
    .bind(heures_fermeture)
    .bind(payload.permanent_24h.unwrap_or(false))
    .bind(payload.telephone)
    .bind(payload.telephone_urgence)
    .bind(payload.whatsapp)
    .bind(payload.email)
    .bind(payload.services.as_ref().map(|s| s.as_slice()))
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        error!("[create_pharmacy] Erreur insertion: {}", e);
        AppError::Internal(format!("Erreur création pharmacie: {}", e))
    })?;

    // ✅ NOUVEAU : Marquer le service comme spécialisé
    sqlx::query("UPDATE services SET specialized_type = 'pharmacie' WHERE id = $1")
        .bind(payload.service_id)
        .execute(&state.pg)
        .await
        .map_err(|e| {
            error!(
                "[create_pharmacy] Erreur mise à jour specialized_type: {}",
                e
            );
            AppError::Internal("Erreur mise à jour specialized_type".to_string())
        })?;

    // Mettre à jour is_on_duty_now avec la fonction PostgreSQL
    sqlx::query(
        r#"
        UPDATE pharmacies
        SET is_on_duty_now = is_pharmacy_on_duty(
            jsonb_build_object(
                'joursGarde', jours_garde,
                'heuresOuverture', heures_ouverture::TEXT,
                'heuresFermeture', heures_fermeture::TEXT
            ),
            NOW()
        )
        WHERE id = $1
        "#,
    )
    .bind(pharmacy_id)
    .execute(&state.pg)
    .await
    .map_err(|e| {
        error!("[create_pharmacy] Erreur mise à jour is_on_duty_now: {}", e);
        AppError::Internal("Erreur mise à jour statut".to_string())
    })?;

    info!("[create_pharmacy] Pharmacie créée avec succès: id={}, service_id={} marqué comme spécialisé", pharmacy_id, payload.service_id);

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "success": true,
            "id": pharmacy_id,
            "message": "Pharmacie créée avec succès"
        })),
    ))
}

/// Rechercher des pharmacies
pub async fn search_pharmacies(
    Query(query): Query<SearchPharmaciesQuery>,
    State(state): State<Arc<AppState>>,
) -> AppResult<impl IntoResponse> {
    info!("[search_pharmacies] Recherche: {:?}", query);

    let search_query = query.query.as_deref().unwrap_or("");
    let on_duty_only = query.on_duty_only.unwrap_or(false);
    let _radius_km = query.radius_km.unwrap_or(50); // Réservé pour usage futur

    // Utiliser une requête SQL simple avec des conditions optionnelles
    let pharmacies = if !search_query.is_empty() {
        let pattern = format!("%{}%", search_query);
        let ville_pattern = query.ville.as_ref().map(|v| format!("%{}%", v));

        let mut sql = String::from(
            r#"
            SELECT 
                p.id, p.service_id, p.user_id, p.nom, p.adresse, p.quartier, p.ville, p.gps,
                p.jours_garde, p.heures_ouverture, p.heures_fermeture, p.permanent_24h,
                p.telephone, p.telephone_urgence, p.whatsapp, p.email, p.services,
                p.is_active, p.is_on_duty_now, p.created_at, p.updated_at
            FROM pharmacies p
            WHERE p.is_active = TRUE
            AND (p.nom ILIKE $1 OR p.quartier ILIKE $1 OR p.ville ILIKE $1 OR EXISTS (SELECT 1 FROM unnest(p.services) AS service WHERE service ILIKE $1))
            "#,
        );

        if on_duty_only {
            sql.push_str(" AND p.is_on_duty_now = TRUE");
        }

        if let Some(_) = &ville_pattern {
            sql.push_str(" AND p.ville ILIKE $2");
        }

        sql.push_str(" ORDER BY p.is_on_duty_now DESC, p.nom ASC LIMIT 50");

        let mut query_builder = sqlx::query_as::<_, Pharmacy>(&sql).bind(&pattern);
        if let Some(vp) = &ville_pattern {
            query_builder = query_builder.bind(vp);
        }

        query_builder.fetch_all(&state.pg).await.map_err(|e| {
            error!("[search_pharmacies] Erreur recherche: {}", e);
            AppError::Internal("Erreur recherche".to_string())
        })?
    } else {
        // Pas de recherche textuelle
        let mut sql = String::from(
            r#"
            SELECT 
                p.id, p.service_id, p.user_id, p.nom, p.adresse, p.quartier, p.ville, p.gps,
                p.jours_garde, p.heures_ouverture, p.heures_fermeture, p.permanent_24h,
                p.telephone, p.telephone_urgence, p.whatsapp, p.email, p.services,
                p.is_active, p.is_on_duty_now, p.created_at, p.updated_at
            FROM pharmacies p
            WHERE p.is_active = TRUE
            "#,
        );

        if on_duty_only {
            sql.push_str(" AND p.is_on_duty_now = TRUE");
        }

        if let Some(ville) = &query.ville {
            let pattern = format!("%{}%", ville);
            sql.push_str(" AND p.ville ILIKE $1");
            sql.push_str(" ORDER BY p.is_on_duty_now DESC, p.nom ASC LIMIT 50");

            sqlx::query_as::<_, Pharmacy>(&sql)
                .bind(&pattern)
                .fetch_all(&state.pg)
                .await
                .map_err(|e| {
                    error!("[search_pharmacies] Erreur recherche: {}", e);
                    AppError::Internal("Erreur recherche".to_string())
                })?
        } else {
            sql.push_str(" ORDER BY p.is_on_duty_now DESC, p.nom ASC LIMIT 50");

            sqlx::query_as::<_, Pharmacy>(&sql).fetch_all(&state.pg).await.map_err(|e| {
                error!("[search_pharmacies] Erreur recherche: {}", e);
                AppError::Internal("Erreur recherche".to_string())
            })?
        }
    };

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": pharmacies,
            "count": pharmacies.len()
        })),
    ))
}

/// Récupérer une pharmacie par ID
pub async fn get_pharmacy(
    Path(id): Path<i32>,
    State(state): State<Arc<AppState>>,
) -> AppResult<impl IntoResponse> {
    let pharmacy: Option<Pharmacy> = sqlx::query_as("SELECT * FROM pharmacies WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.pg)
        .await
        .map_err(|e| {
            error!("[get_pharmacy] Erreur: {}", e);
            AppError::Internal("Erreur récupération".to_string())
        })?;

    match pharmacy {
        Some(p) => Ok((
            StatusCode::OK,
            Json(json!({
                "success": true,
                "data": p
            })),
        )),
        None => Err(AppError::NotFound("Pharmacie non trouvée".to_string())),
    }
}

/// Récupérer les pharmacies de garde maintenant
pub async fn get_pharmacies_on_duty(
    State(state): State<Arc<AppState>>,
) -> AppResult<impl IntoResponse> {
    // Mettre à jour is_on_duty_now pour toutes les pharmacies
    sqlx::query(
        r#"
        UPDATE pharmacies
        SET is_on_duty_now = is_pharmacy_on_duty(
            jsonb_build_object(
                'joursGarde', jours_garde,
                'heuresOuverture', heures_ouverture::TEXT,
                'heuresFermeture', heures_fermeture::TEXT
            ),
            NOW()
        )
        WHERE is_active = TRUE
        "#,
    )
    .execute(&state.pg)
    .await
    .map_err(|e| {
        error!("[get_pharmacies_on_duty] Erreur mise à jour: {}", e);
        AppError::Internal("Erreur mise à jour".to_string())
    })?;

    let pharmacies: Vec<Pharmacy> = sqlx::query_as(
        "SELECT * FROM pharmacies WHERE is_active = TRUE AND is_on_duty_now = TRUE ORDER BY nom ASC"
    )
    .fetch_all(&state.pg)
    .await
    .map_err(|e| {
        error!("[get_pharmacies_on_duty] Erreur recherche: {}", e);
        AppError::Internal("Erreur recherche".to_string())
    })?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": pharmacies,
            "count": pharmacies.len()
        })),
    ))
}

// ─── SUCCURSALES ─────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateBranchRequest {
    pub nom: String,
    pub adresse: Option<String>,
    pub quartier: Option<String>,
    pub ville: Option<String>,
    pub gps: Option<String>,
    pub telephone: Option<String>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct PharmacyBranch {
    pub id: i32,
    pub pharmacy_id: i32,
    pub nom: String,
    pub adresse: Option<String>,
    pub quartier: Option<String>,
    pub ville: Option<String>,
    pub gps: Option<String>,
    pub telephone: Option<String>,
    pub is_active: bool,
}

/// GET /api/pharmacies/{id}/branches
pub async fn list_branches(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(pharmacy_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    // Vérifier propriété
    let owned: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM pharmacies WHERE id = $1 AND user_id = $2)",
    )
    .bind(pharmacy_id)
    .bind(user_id)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| AppError::Internal(e.to_string()))?;
    if !owned {
        return Err(AppError::Forbidden("Accès refusé".into()));
    }

    let branches: Vec<PharmacyBranch> = sqlx::query_as(
        "SELECT id, pharmacy_id, nom, adresse, quartier, ville, gps, telephone, is_active FROM pharmacy_branches WHERE pharmacy_id = $1 AND is_active = TRUE ORDER BY nom ASC"
    ).bind(pharmacy_id).fetch_all(&state.pg).await
    .map_err(|e| AppError::Internal(format!("Erreur chargement succursales: {}", e)))?;

    Ok(Json(json!({ "success": true, "branches": branches })))
}

/// POST /api/pharmacies/{id}/branches
pub async fn create_branch(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(pharmacy_id): Path<i32>,
    Json(payload): Json<CreateBranchRequest>,
) -> AppResult<impl IntoResponse> {
    let owned: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM pharmacies WHERE id = $1 AND user_id = $2)",
    )
    .bind(pharmacy_id)
    .bind(user_id)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| AppError::Internal(e.to_string()))?;
    if !owned {
        return Err(AppError::Forbidden("Accès refusé".into()));
    }

    let branch: PharmacyBranch = sqlx::query_as(
        r#"INSERT INTO pharmacy_branches (pharmacy_id, nom, adresse, quartier, ville, gps, telephone)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id, pharmacy_id, nom, adresse, quartier, ville, gps, telephone, is_active"#,
    )
    .bind(pharmacy_id).bind(&payload.nom).bind(payload.adresse)
    .bind(payload.quartier).bind(payload.ville).bind(payload.gps).bind(payload.telephone)
    .fetch_one(&state.pg).await
    .map_err(|e| AppError::Internal(format!("Erreur création succursale: {}", e)))?;

    Ok((
        StatusCode::CREATED,
        Json(json!({ "success": true, "branch": branch })),
    ))
}

/// PATCH /api/pharmacies/branches/{branch_id}
pub async fn update_branch(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(branch_id): Path<i32>,
    Json(payload): Json<CreateBranchRequest>,
) -> AppResult<impl IntoResponse> {
    let owned: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM pharmacy_branches b JOIN pharmacies p ON p.id = b.pharmacy_id WHERE b.id = $1 AND p.user_id = $2)"
    ).bind(branch_id).bind(user_id).fetch_one(&state.pg).await
    .map_err(|e| AppError::Internal(e.to_string()))?;
    if !owned {
        return Err(AppError::Forbidden("Accès refusé".into()));
    }

    sqlx::query(
        "UPDATE pharmacy_branches SET nom=$1, adresse=$2, quartier=$3, ville=$4, gps=$5, telephone=$6, updated_at=NOW() WHERE id=$7"
    )
    .bind(&payload.nom).bind(payload.adresse).bind(payload.quartier)
    .bind(payload.ville).bind(payload.gps).bind(payload.telephone).bind(branch_id)
    .execute(&state.pg).await
    .map_err(|e| AppError::Internal(format!("Erreur mise à jour succursale: {}", e)))?;

    Ok(Json(json!({ "success": true })))
}

/// DELETE /api/pharmacies/branches/{branch_id}
pub async fn delete_branch(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(branch_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    let owned: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM pharmacy_branches b JOIN pharmacies p ON p.id = b.pharmacy_id WHERE b.id = $1 AND p.user_id = $2)"
    ).bind(branch_id).bind(user_id).fetch_one(&state.pg).await
    .map_err(|e| AppError::Internal(e.to_string()))?;
    if !owned {
        return Err(AppError::Forbidden("Accès refusé".into()));
    }

    sqlx::query("UPDATE pharmacy_branches SET is_active = FALSE WHERE id = $1")
        .bind(branch_id)
        .execute(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur suppression succursale: {}", e)))?;

    Ok(Json(json!({ "success": true })))
}
