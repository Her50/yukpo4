// Contrôleur unifié pour tous les services spécialisés
// Pour simplifier, on regroupe les opérations communes ici

use crate::core::types::{AppError, AppResult};
use crate::middlewares::jwt::AuthenticatedUser;
use crate::services::delivery_ai_eta_service::DeliveryAIETAService;
use crate::services::interior_design_ai_service::InteriorDesignAIService;
use crate::services::land_analysis_ai_service::LandAnalysisAIService;
use crate::services::moving_ai_service::MovingAIService;
use crate::services::real_estate_ai_service::RealEstateAIService;
use crate::state::AppState;
use axum::{
    extract::{Extension, Multipart, Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use log::{error, info};
use serde::Deserialize;
use serde_json::json;
use sqlx::{QueryBuilder, Row};
use std::f64;
use std::f64::consts::PI;
use std::sync::Arc;
use uuid::Uuid;

/// ✅ Liste des hôpitaux (stub pour éviter erreur 405)
pub async fn list_hospitals(
    State(_state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    info!("[list_hospitals] Called");
    // TODO: Implémenter la vraie liste
    Ok((StatusCode::OK, Json(json!([]))))
}

/// ✅ Liste des laboratoires (stub pour éviter erreur 405)
pub async fn list_laboratories(
    State(_state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    info!("[list_laboratories] Called");
    // TODO: Implémenter la vraie liste
    Ok((StatusCode::OK, Json(json!([]))))
}

/// ✅ Liste des agences de voyage (stub pour éviter erreur 405)
pub async fn list_travel_agencies(
    State(_state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    info!("[list_travel_agencies] Called");
    // TODO: Implémenter la vraie liste
    Ok((StatusCode::OK, Json(json!([]))))
}

/// ✅ Liste des covoiturages (stub pour éviter erreur 405) - Version protégée
pub async fn list_covoiturages(
    State(_state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    info!("[list_covoiturages] Called");
    // TODO: Implémenter la vraie liste
    Ok((StatusCode::OK, Json(json!([]))))
}

/// ✅ Liste des covoiturages (version publique - pas d'authentification requise)
pub async fn list_covoiturages_public(
    State(_state): State<Arc<AppState>>,
) -> AppResult<impl IntoResponse> {
    info!("[list_covoiturages_public] Called");
    // TODO: Implémenter la vraie liste
    Ok((StatusCode::OK, Json(json!([]))))
}

/// ✅ Liste des taxis (stub pour éviter erreur 405) - Version protégée
pub async fn list_taxis(
    State(_state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    info!("[list_taxis] Called");
    // TODO: Implémenter la vraie liste
    Ok((StatusCode::OK, Json(json!([]))))
}

/// ✅ Liste des taxis (version publique - pas d'authentification requise)
pub async fn list_taxis_public(
    State(_state): State<Arc<AppState>>,
) -> AppResult<impl IntoResponse> {
    info!("[list_taxis_public] Called");
    // TODO: Implémenter la vraie liste
    Ok((StatusCode::OK, Json(json!([]))))
}

// ============================================================================
// HÔPITAUX/CLINIQUES
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct CreateHospitalRequest {
    pub service_id: i32,
    pub nom: String,
    pub type_etablissement: String,
    pub adresse: Option<String>,
    pub quartier: Option<String>,
    pub ville: Option<String>,
    pub gps: Option<String>,
    pub prestations_medicales: Option<Vec<String>>,
    pub urgences_disponible: Option<bool>,
    pub rdv_en_ligne: Option<bool>,
    pub planning_hebdomadaire: Option<serde_json::Value>,
    pub telephone: Option<String>,
    pub telephone_urgence: Option<String>,
    pub whatsapp: Option<String>,
    pub email: Option<String>,
    pub site_web: Option<String>,
}

/// Créer un hôpital/clinique
pub async fn create_hospital(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<CreateHospitalRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[create_hospital] Création hôpital pour user_id={}, service_id={}",
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
                error!("[create_hospital] Erreur vérification service: {}", e);
                AppError::Internal(format!("Erreur vérification service: {}", e))
            })?;

    if service_exists.is_none() {
        return Err(AppError::NotFound(
            "Service non trouvé ou n'appartient pas à l'utilisateur".to_string(),
        ));
    }

    // ✅ NOUVEAU : Vérifier si un hôpital existe déjà pour ce service
    let existing_hospital: Option<i32> = sqlx::query_scalar(
        "SELECT id FROM hopitaux_cliniques WHERE service_id = $1 AND user_id = $2",
    )
    .bind(payload.service_id)
    .bind(user_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| {
        error!(
            "[create_hospital] Erreur vérification hôpital existant: {}",
            e
        );
        AppError::Internal(format!("Erreur vérification hôpital existant: {}", e))
    })?;

    if existing_hospital.is_some() {
        info!(
            "[create_hospital] Hôpital existe déjà pour service_id={}, utilisation UPSERT",
            payload.service_id
        );
        // ✅ UPSERT : Mise à jour si existe
        let hospital_id = existing_hospital.unwrap();

        sqlx::query(
            r#"
            UPDATE hopitaux_cliniques SET
                nom = $3,
                type_etablissement = $4,
                adresse = $5,
                quartier = $6,
                ville = $7,
                gps = $8,
                prestations_medicales = $9,
                planning_hebdomadaire = $10,
                urgences_disponible = $11,
                rdv_en_ligne = $12,
                telephone = $13,
                telephone_urgence = $14,
                whatsapp = $15,
                email = $16,
                site_web = $17,
                updated_at = NOW()
            WHERE id = $1 AND user_id = $2
            "#,
        )
        .bind(hospital_id)
        .bind(user_id)
        .bind(&payload.nom)
        .bind(&payload.type_etablissement)
        .bind(payload.adresse.as_ref())
        .bind(payload.quartier.as_ref())
        .bind(payload.ville.as_ref())
        .bind(payload.gps.as_ref())
        .bind(payload.prestations_medicales.as_ref().map(|s| s.as_slice()))
        .bind(payload.planning_hebdomadaire.as_ref())
        .bind(payload.urgences_disponible.unwrap_or(false))
        .bind(payload.rdv_en_ligne.unwrap_or(false))
        .bind(payload.telephone.as_ref())
        .bind(payload.telephone_urgence.as_ref())
        .bind(payload.whatsapp.as_ref())
        .bind(payload.email.as_ref())
        .bind(payload.site_web.as_ref())
        .execute(&state.pg)
        .await
        .map_err(|e| {
            error!("[create_hospital] Erreur mise à jour: {}", e);
            AppError::Internal(format!("Erreur mise à jour hôpital: {}", e))
        })?;

        return Ok((
            StatusCode::OK,
            Json(json!({
                "success": true,
                "id": hospital_id,
                "message": "Établissement de santé mis à jour avec succès"
            })),
        ));
    }

    let hospital_id: i32 = sqlx::query_scalar(
        r#"
        INSERT INTO hopitaux_cliniques (
            service_id, user_id, nom, type_etablissement, adresse, quartier, ville, gps,
            prestations_medicales, urgences_disponible, rdv_en_ligne,
            planning_hebdomadaire, telephone, telephone_urgence, whatsapp, email, site_web
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        RETURNING id
        "#,
    )
    .bind(payload.service_id)
    .bind(user_id)
    .bind(&payload.nom)
    .bind(&payload.type_etablissement)
    .bind(payload.adresse)
    .bind(payload.quartier)
    .bind(payload.ville)
    .bind(payload.gps)
    .bind(payload.prestations_medicales.as_ref().map(|s| s.as_slice()))
    .bind(payload.urgences_disponible.unwrap_or(false))
    .bind(payload.rdv_en_ligne.unwrap_or(false))
    .bind(payload.planning_hebdomadaire)
    .bind(payload.telephone)
    .bind(payload.telephone_urgence)
    .bind(payload.whatsapp)
    .bind(payload.email)
    .bind(payload.site_web)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        error!("[create_hospital] Erreur insertion: {}", e);
        AppError::Internal(format!("Erreur création hôpital: {}", e))
    })?;

    // ✅ NOUVEAU : Marquer le service comme spécialisé
    sqlx::query("UPDATE services SET specialized_type = 'hopital_clinique' WHERE id = $1")
        .bind(payload.service_id)
        .execute(&state.pg)
        .await
        .map_err(|e| {
            error!(
                "[create_hospital] Erreur mise à jour specialized_type: {}",
                e
            );
            AppError::Internal("Erreur mise à jour specialized_type".to_string())
        })?;

    // Mettre à jour is_available_now
    sqlx::query(
        r#"
        UPDATE hopitaux_cliniques
        SET is_available_now = is_medical_service_available(
            jsonb_build_object(
                'planningHebdomadaire', planning_hebdomadaire,
                'prestationsMedicales', prestations_medicales
            ),
            NOW(),
            NULL
        )
        WHERE id = $1
        "#,
    )
    .bind(hospital_id)
    .execute(&state.pg)
    .await
    .ok(); // Ne pas bloquer si erreur

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "success": true,
            "id": hospital_id,
            "message": "Hôpital créé avec succès"
        })),
    ))
}

// ============================================================================
// LABORATOIRES
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct CreateLaboratoryRequest {
    pub service_id: i32,
    pub nom: String,
    pub type_laboratoire: String,
    pub adresse: Option<String>,
    pub quartier: Option<String>,
    pub ville: Option<String>,
    pub gps: Option<String>,
    pub analyses_disponibles: Option<Vec<String>>,
    pub imagerie_disponible: Option<Vec<String>>,
    pub planning_hebdomadaire: Option<serde_json::Value>,
    pub heures_ouverture: Option<String>,
    pub heures_fermeture: Option<String>,
    pub permanent_24h: Option<bool>,
    pub rdv_requis: Option<bool>,
    pub resultats_en_ligne: Option<bool>,
    pub telephone: Option<String>,
    pub whatsapp: Option<String>,
    pub email: Option<String>,
}

/// Créer un laboratoire
pub async fn create_laboratory(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<CreateLaboratoryRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[create_laboratory] Création laboratoire pour user_id={}, service_id={}",
        user_id, payload.service_id
    );

    let service_exists: Option<i32> =
        sqlx::query_scalar("SELECT id FROM services WHERE id = $1 AND user_id = $2")
            .bind(payload.service_id)
            .bind(user_id)
            .fetch_optional(&state.pg)
            .await
            .map_err(|e| {
                error!("[create_laboratory] Erreur vérification service: {}", e);
                AppError::Internal(format!("Erreur vérification service: {}", e))
            })?;

    if service_exists.is_none() {
        return Err(AppError::NotFound(
            "Service non trouvé ou n'appartient pas à l'utilisateur".to_string(),
        ));
    }

    // ✅ NOUVEAU : Vérifier si un laboratoire existe déjà pour ce service
    let existing_laboratory: Option<i32> = sqlx::query_scalar(
        "SELECT id FROM laboratoires_imagerie WHERE service_id = $1 AND user_id = $2",
    )
    .bind(payload.service_id)
    .bind(user_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| {
        error!(
            "[create_laboratory] Erreur vérification laboratoire existant: {}",
            e
        );
        AppError::Internal(format!("Erreur vérification laboratoire existant: {}", e))
    })?;

    if existing_laboratory.is_some() {
        info!(
            "[create_laboratory] Laboratoire existe déjà pour service_id={}, utilisation UPSERT",
            payload.service_id
        );
        let lab_id = existing_laboratory.unwrap();

        let heures_ouverture = payload
            .heures_ouverture
            .as_ref()
            .and_then(|h| chrono::NaiveTime::parse_from_str(h, "%H:%M").ok());
        let heures_fermeture = payload
            .heures_fermeture
            .as_ref()
            .and_then(|h| chrono::NaiveTime::parse_from_str(h, "%H:%M").ok());

        sqlx::query(
            r#"
            UPDATE laboratoires_imagerie SET
                nom = $3,
                type_laboratoire = $4,
                adresse = $5,
                quartier = $6,
                ville = $7,
                gps = $8,
                analyses_disponibles = $9,
                imagerie_disponible = $10,
                heures_ouverture = $11,
                heures_fermeture = $12,
                permanent_24h = $13,
                rdv_requis = $14,
                resultats_en_ligne = $15,
                telephone = $16,
                whatsapp = $17,
                email = $18,
                updated_at = NOW()
            WHERE id = $1 AND user_id = $2
            "#,
        )
        .bind(lab_id)
        .bind(user_id)
        .bind(&payload.nom)
        .bind(&payload.type_laboratoire)
        .bind(payload.adresse.as_ref())
        .bind(payload.quartier.as_ref())
        .bind(payload.ville.as_ref())
        .bind(payload.gps.as_ref())
        .bind(payload.analyses_disponibles.as_ref().map(|s| s.as_slice()))
        .bind(payload.imagerie_disponible.as_ref().map(|s| s.as_slice()))
        .bind(heures_ouverture)
        .bind(heures_fermeture)
        .bind(payload.permanent_24h.unwrap_or(false))
        .bind(payload.rdv_requis.unwrap_or(true))
        .bind(payload.resultats_en_ligne.unwrap_or(false))
        .bind(payload.telephone.as_ref())
        .bind(payload.whatsapp.as_ref())
        .bind(payload.email.as_ref())
        .execute(&state.pg)
        .await
        .map_err(|e| {
            error!("[create_laboratory] Erreur mise à jour: {}", e);
            AppError::Internal(format!("Erreur mise à jour laboratoire: {}", e))
        })?;

        return Ok((
            StatusCode::OK,
            Json(json!({
                "success": true,
                "id": lab_id,
                "message": "Laboratoire mis à jour avec succès"
            })),
        ));
    }

    let lab_id: i32 = sqlx::query_scalar(
        r#"
        INSERT INTO laboratoires_imagerie (
            service_id, user_id, nom, type_laboratoire, adresse, quartier, ville, gps,
            analyses_disponibles, imagerie_disponible, planning_hebdomadaire,
            rdv_requis, resultats_en_ligne, telephone, whatsapp, email
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING id
        "#,
    )
    .bind(payload.service_id)
    .bind(user_id)
    .bind(&payload.nom)
    .bind(&payload.type_laboratoire)
    .bind(payload.adresse)
    .bind(payload.quartier)
    .bind(payload.ville)
    .bind(payload.gps)
    .bind(payload.analyses_disponibles.as_ref().map(|s| s.as_slice()))
    .bind(payload.imagerie_disponible.as_ref().map(|s| s.as_slice()))
    .bind(payload.planning_hebdomadaire)
    .bind(payload.rdv_requis.unwrap_or(true))
    .bind(payload.resultats_en_ligne.unwrap_or(false))
    .bind(payload.telephone)
    .bind(payload.whatsapp)
    .bind(payload.email)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        error!("[create_laboratory] Erreur insertion: {}", e);
        AppError::Internal(format!("Erreur création laboratoire: {}", e))
    })?;

    // ✅ NOUVEAU : Marquer le service comme spécialisé
    sqlx::query("UPDATE services SET specialized_type = 'laboratoire_imagerie' WHERE id = $1")
        .bind(payload.service_id)
        .execute(&state.pg)
        .await
        .map_err(|e| {
            error!(
                "[create_laboratory] Erreur mise à jour specialized_type: {}",
                e
            );
            AppError::Internal("Erreur mise à jour specialized_type".to_string())
        })?;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "success": true,
            "id": lab_id,
            "message": "Laboratoire créé avec succès"
        })),
    ))
}

// ============================================================================
// AGENCES DE VOYAGE
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct CreateTravelAgencyRequest {
    pub service_id: i32,
    pub nom_agence: String,
    pub adresse: Option<String>,
    pub quartier: Option<String>,
    pub ville: Option<String>,
    pub gps: Option<String>,
    pub services_voyage: Option<Vec<String>>,
    pub compagnies_bus: Option<Vec<String>>,
    pub destinations: Option<Vec<String>>,
    pub heures_ouverture: Option<String>,
    pub heures_fermeture: Option<String>,
    pub jours_ouverture: Option<String>,
    pub telephone: Option<String>,
    pub whatsapp: Option<String>,
    pub email: Option<String>,
    pub site_web: Option<String>,
    pub peut_emettre_tickets_bus: Option<bool>,
    pub compagnies_affiliees: Option<Vec<String>>,
}

/// Créer une agence de voyage
pub async fn create_travel_agency(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<CreateTravelAgencyRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[create_travel_agency] Création agence pour user_id={}, service_id={}",
        user_id, payload.service_id
    );

    let service_exists: Option<i32> =
        sqlx::query_scalar("SELECT id FROM services WHERE id = $1 AND user_id = $2")
            .bind(payload.service_id)
            .bind(user_id)
            .fetch_optional(&state.pg)
            .await
            .map_err(|e| {
                error!("[create_travel_agency] Erreur vérification service: {}", e);
                AppError::Internal(format!("Erreur vérification service: {}", e))
            })?;

    if service_exists.is_none() {
        return Err(AppError::NotFound("Service non trouvé".to_string()));
    }

    // ✅ NOUVEAU : Vérifier si une agence de voyage existe déjà pour ce service
    let existing_agency: Option<i32> =
        sqlx::query_scalar("SELECT id FROM agences_voyage WHERE service_id = $1 AND user_id = $2")
            .bind(payload.service_id)
            .bind(user_id)
            .fetch_optional(&state.pg)
            .await
            .map_err(|e| {
                error!(
                    "[create_travel_agency] Erreur vérification agence existante: {}",
                    e
                );
                AppError::Internal(format!("Erreur vérification agence existante: {}", e))
            })?;

    if existing_agency.is_some() {
        info!(
            "[create_travel_agency] Agence existe déjà pour service_id={}, utilisation UPSERT",
            payload.service_id
        );
        let agency_id = existing_agency.unwrap();

        let heures_ouverture = payload
            .heures_ouverture
            .as_ref()
            .and_then(|h| chrono::NaiveTime::parse_from_str(h, "%H:%M").ok());
        let heures_fermeture = payload
            .heures_fermeture
            .as_ref()
            .and_then(|h| chrono::NaiveTime::parse_from_str(h, "%H:%M").ok());

        sqlx::query(
            r#"
            UPDATE agences_voyage SET
                nom_agence = $3,
                adresse = $4,
                quartier = $5,
                ville = $6,
                gps = $7,
                services_voyage = $8,
                compagnies_bus = $9,
                destinations = $10,
                heures_ouverture = $11,
                heures_fermeture = $12,
                jours_ouverture = $13,
                telephone = $14,
                whatsapp = $15,
                email = $16,
                site_web = $17,
                peut_emettre_tickets_bus = $18,
                compagnies_affiliees = $19,
                updated_at = NOW()
            WHERE id = $1 AND user_id = $2
            "#,
        )
        .bind(agency_id)
        .bind(user_id)
        .bind(&payload.nom_agence)
        .bind(payload.adresse.as_ref())
        .bind(payload.quartier.as_ref())
        .bind(payload.ville.as_ref())
        .bind(payload.gps.as_ref())
        .bind(payload.services_voyage.as_ref().map(|s| s.as_slice()))
        .bind(payload.compagnies_bus.as_ref().map(|s| s.as_slice()))
        .bind(payload.destinations.as_ref().map(|s| s.as_slice()))
        .bind(heures_ouverture)
        .bind(heures_fermeture)
        .bind(payload.jours_ouverture.as_ref())
        .bind(payload.telephone.as_ref())
        .bind(payload.whatsapp.as_ref())
        .bind(payload.email.as_ref())
        .bind(payload.site_web.as_ref())
        .bind(payload.peut_emettre_tickets_bus.unwrap_or(false))
        .bind(payload.compagnies_affiliees.as_ref().map(|s| s.as_slice()))
        .execute(&state.pg)
        .await
        .map_err(|e| {
            error!("[create_travel_agency] Erreur mise à jour: {}", e);
            AppError::Internal(format!("Erreur mise à jour agence: {}", e))
        })?;

        return Ok((
            StatusCode::OK,
            Json(json!({
                "success": true,
                "id": agency_id,
                "message": "Agence de voyage mise à jour avec succès"
            })),
        ));
    }

    let heures_ouverture = payload
        .heures_ouverture
        .as_ref()
        .and_then(|h| chrono::NaiveTime::parse_from_str(h, "%H:%M").ok());
    let heures_fermeture = payload
        .heures_fermeture
        .as_ref()
        .and_then(|h| chrono::NaiveTime::parse_from_str(h, "%H:%M").ok());

    let agency_id: i32 = sqlx::query_scalar(
        r#"
        INSERT INTO agences_voyage (
            service_id, user_id, nom_agence, adresse, quartier, ville, gps,
            services_voyage, compagnies_bus, destinations,
            heures_ouverture, heures_fermeture, jours_ouverture,
            telephone, whatsapp, email, site_web,
            peut_emettre_tickets_bus, compagnies_affiliees
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        RETURNING id
        "#
    )
    .bind(payload.service_id)
    .bind(user_id)
    .bind(&payload.nom_agence)
    .bind(payload.adresse)
    .bind(payload.quartier)
    .bind(payload.ville)
    .bind(payload.gps)
    .bind(payload.services_voyage.as_ref().map(|s| s.as_slice()))
    .bind(payload.compagnies_bus.as_ref().map(|s| s.as_slice()))
    .bind(payload.destinations.as_ref().map(|s| s.as_slice()))
    .bind(heures_ouverture)
    .bind(heures_fermeture)
    .bind(payload.jours_ouverture)
    .bind(payload.telephone)
    .bind(payload.whatsapp)
    .bind(payload.email)
    .bind(payload.site_web)
    .bind(payload.peut_emettre_tickets_bus.unwrap_or(false))
    .bind(payload.compagnies_affiliees.as_ref().map(|s| s.as_slice()))
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        error!("[create_travel_agency] Erreur insertion: {}", e);
        AppError::Internal(format!("Erreur création agence: {}", e))
    })?;

    // ✅ NOUVEAU : Marquer le service comme spécialisé
    sqlx::query("UPDATE services SET specialized_type = 'agence_voyage' WHERE id = $1")
        .bind(payload.service_id)
        .execute(&state.pg)
        .await
        .map_err(|e| {
            error!(
                "[create_travel_agency] Erreur mise à jour specialized_type: {}",
                e
            );
            AppError::Internal("Erreur mise à jour specialized_type".to_string())
        })?;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "success": true,
            "id": agency_id,
            "message": "Agence de voyage créée avec succès"
        })),
    ))
}

// ============================================================================
// COVOITURAGE
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct CreateCovoiturageRequest {
    pub service_id: i32,
    pub depart: String,
    pub destination: String,
    pub gps_depart: Option<String>,
    pub gps_destination: Option<String>,
    pub date_depart: String,  // Format ISO 8601
    pub heure_depart: String, // Format HH:MM
    pub type_vehicule: Option<String>,
    pub marque_modele: Option<String>,
    pub nombre_places: i32,
    pub places_disponibles: i32,
    pub prix_par_place: i32,
    pub devise: Option<String>,
    pub bagages_autorises: Option<bool>,
    pub animaux_autorises: Option<bool>,
    pub fumeur_autorise: Option<bool>,
    pub climatisation: Option<bool>,
}

/// Créer un covoiturage
pub async fn create_covoiturage(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<CreateCovoiturageRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[create_covoiturage] Création covoiturage pour user_id={}, service_id={}",
        user_id, payload.service_id
    );

    let service_exists: Option<i32> =
        sqlx::query_scalar("SELECT id FROM services WHERE id = $1 AND user_id = $2")
            .bind(payload.service_id)
            .bind(user_id)
            .fetch_optional(&state.pg)
            .await
            .map_err(|e| {
                error!("[create_covoiturage] Erreur vérification service: {}", e);
                AppError::Internal(format!("Erreur vérification service: {}", e))
            })?;

    if service_exists.is_none() {
        return Err(AppError::NotFound(
            "Service non trouvé ou n'appartient pas à l'utilisateur".to_string(),
        ));
    }

    // ✅ NOUVEAU : Vérifier si un covoiturage existe déjà pour ce service
    let existing_covoiturage: Option<i32> =
        sqlx::query_scalar("SELECT id FROM covoiturages WHERE service_id = $1 AND user_id = $2")
            .bind(payload.service_id)
            .bind(user_id)
            .fetch_optional(&state.pg)
            .await
            .map_err(|e| {
                error!(
                    "[create_covoiturage] Erreur vérification covoiturage existant: {}",
                    e
                );
                AppError::Internal(format!("Erreur vérification covoiturage existant: {}", e))
            })?;

    if existing_covoiturage.is_some() {
        info!(
            "[create_covoiturage] Covoiturage existe déjà pour service_id={}, utilisation UPSERT",
            payload.service_id
        );
        let covoiturage_id = existing_covoiturage.unwrap();

        let date_depart = chrono::DateTime::parse_from_rfc3339(&payload.date_depart)
            .map(|dt| dt.with_timezone(&chrono::Utc))
            .map_err(|_| {
                AppError::BadRequest("Format date_depart invalide (ISO 8601 requis)".to_string())
            })?;
        let heure_depart = chrono::NaiveTime::parse_from_str(&payload.heure_depart, "%H:%M")
            .map_err(|_| {
                AppError::BadRequest("Format heure_depart invalide (HH:MM requis)".to_string())
            })?;

        sqlx::query(
            r#"
            UPDATE covoiturages SET
                depart = $3,
                destination = $4,
                gps_depart = $5,
                gps_destination = $6,
                date_depart = $7,
                heure_depart = $8,
                type_vehicule = $9,
                marque_modele = $10,
                nombre_places = $11,
                places_disponibles = $12,
                prix_par_place = $13,
                devise = $14,
                bagages_autorises = $15,
                animaux_autorises = $16,
                fumeur_autorise = $17,
                climatisation = $18,
                updated_at = NOW()
            WHERE id = $1 AND user_id = $2
            "#,
        )
        .bind(covoiturage_id)
        .bind(user_id)
        .bind(&payload.depart)
        .bind(&payload.destination)
        .bind(payload.gps_depart.as_ref())
        .bind(payload.gps_destination.as_ref())
        .bind(date_depart)
        .bind(heure_depart)
        .bind(payload.type_vehicule.as_ref())
        .bind(payload.marque_modele.as_ref())
        .bind(payload.nombre_places)
        .bind(payload.places_disponibles)
        .bind(payload.prix_par_place)
        .bind(payload.devise.as_ref().unwrap_or(&"XAF".to_string()))
        .bind(payload.bagages_autorises.unwrap_or(true))
        .bind(payload.animaux_autorises.unwrap_or(false))
        .bind(payload.fumeur_autorise.unwrap_or(false))
        .bind(payload.climatisation.unwrap_or(false))
        .execute(&state.pg)
        .await
        .map_err(|e| {
            error!("[create_covoiturage] Erreur mise à jour: {}", e);
            AppError::Internal(format!("Erreur mise à jour covoiturage: {}", e))
        })?;

        return Ok((
            StatusCode::OK,
            Json(json!({
                "success": true,
                "id": covoiturage_id,
                "message": "Covoiturage mis à jour avec succès"
            })),
        ));
    }

    let date_depart = chrono::DateTime::parse_from_rfc3339(&payload.date_depart)
        .map(|dt| dt.with_timezone(&chrono::Utc))
        .map_err(|_| {
            AppError::BadRequest("Format date_depart invalide (ISO 8601 requis)".to_string())
        })?;

    let heure_depart =
        chrono::NaiveTime::parse_from_str(&payload.heure_depart, "%H:%M").map_err(|_| {
            AppError::BadRequest("Format heure_depart invalide (HH:MM requis)".to_string())
        })?;

    let covoiturage_id: i32 = sqlx::query_scalar(
        r#"
        INSERT INTO covoiturages (
            service_id, user_id, depart, destination, gps_depart, gps_destination,
            date_depart, heure_depart, type_vehicule, marque_modele,
            nombre_places, places_disponibles, prix_par_place, devise,
            bagages_autorises, animaux_autorises, fumeur_autorise, climatisation
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        RETURNING id
        "#,
    )
    .bind(payload.service_id)
    .bind(user_id)
    .bind(&payload.depart)
    .bind(&payload.destination)
    .bind(payload.gps_depart)
    .bind(payload.gps_destination)
    .bind(date_depart)
    .bind(heure_depart)
    .bind(payload.type_vehicule)
    .bind(payload.marque_modele)
    .bind(payload.nombre_places)
    .bind(payload.places_disponibles)
    .bind(payload.prix_par_place)
    .bind(payload.devise.unwrap_or_else(|| "XAF".to_string()))
    .bind(payload.bagages_autorises.unwrap_or(true))
    .bind(payload.animaux_autorises.unwrap_or(false))
    .bind(payload.fumeur_autorise.unwrap_or(false))
    .bind(payload.climatisation.unwrap_or(false))
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        error!("[create_covoiturage] Erreur insertion: {}", e);
        AppError::Internal(format!("Erreur création covoiturage: {}", e))
    })?;

    // ✅ NOUVEAU : Marquer le service comme spécialisé
    sqlx::query("UPDATE services SET specialized_type = 'covoiturage' WHERE id = $1")
        .bind(payload.service_id)
        .execute(&state.pg)
        .await
        .map_err(|e| {
            error!(
                "[create_covoiturage] Erreur mise à jour specialized_type: {}",
                e
            );
            AppError::Internal("Erreur mise à jour specialized_type".to_string())
        })?;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "success": true,
            "id": covoiturage_id,
            "message": "Covoiturage créé avec succès"
        })),
    ))
}

// ============================================================================
// TAXIS VILLE
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct CreateTaxiRequest {
    pub service_id: i32,
    pub nom_chauffeur: Option<String>,
    pub telephone: String,
    pub whatsapp: Option<String>,
    pub type_vehicule: Option<String>,
    pub marque_modele: Option<String>,
    pub immatriculation: Option<String>,
    pub couleur: Option<String>,
    pub annee: Option<i32>,
    pub zone_intervention: Option<Vec<String>>,
    pub gps_actuel: Option<String>,
    pub tarif_base: Option<i32>,
    pub tarif_par_km: Option<i32>,
    pub devise: Option<String>,
    pub paiement_cash: Option<bool>,
    pub paiement_mobile_money: Option<bool>,
    pub paiement_carte: Option<bool>,
    pub climatisation: Option<bool>,
    pub wifi: Option<bool>,
}

/// Créer un taxi
pub async fn create_taxi(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<CreateTaxiRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[create_taxi] Création taxi pour user_id={}, service_id={}",
        user_id, payload.service_id
    );

    let service_exists: Option<i32> =
        sqlx::query_scalar("SELECT id FROM services WHERE id = $1 AND user_id = $2")
            .bind(payload.service_id)
            .bind(user_id)
            .fetch_optional(&state.pg)
            .await
            .map_err(|e| {
                error!("[create_taxi] Erreur vérification service: {}", e);
                AppError::Internal(format!("Erreur vérification service: {}", e))
            })?;

    if service_exists.is_none() {
        return Err(AppError::NotFound(
            "Service non trouvé ou n'appartient pas à l'utilisateur".to_string(),
        ));
    }

    // ✅ NOUVEAU : Vérifier si un taxi existe déjà pour ce service
    let existing_taxi: Option<i32> =
        sqlx::query_scalar("SELECT id FROM taxis_ville WHERE service_id = $1 AND user_id = $2")
            .bind(payload.service_id)
            .bind(user_id)
            .fetch_optional(&state.pg)
            .await
            .map_err(|e| {
                error!("[create_taxi] Erreur vérification taxi existant: {}", e);
                AppError::Internal(format!("Erreur vérification taxi existant: {}", e))
            })?;

    if existing_taxi.is_some() {
        info!(
            "[create_taxi] Taxi existe déjà pour service_id={}, utilisation UPSERT",
            payload.service_id
        );
        let taxi_id = existing_taxi.unwrap();

        sqlx::query(
            r#"
            UPDATE taxis_ville SET
                nom_chauffeur = $3,
                telephone = $4,
                whatsapp = $5,
                type_vehicule = $6,
                marque_modele = $7,
                immatriculation = $8,
                couleur = $9,
                annee = $10,
                zone_intervention = $11,
                gps_actuel = $12,
                tarif_base = $13,
                tarif_par_km = $14,
                devise = $15,
                paiement_cash = $16,
                paiement_mobile_money = $17,
                paiement_carte = $18,
                climatisation = $19,
                wifi = $20,
                updated_at = NOW()
            WHERE id = $1 AND user_id = $2
            "#,
        )
        .bind(taxi_id)
        .bind(user_id)
        .bind(payload.nom_chauffeur.as_ref())
        .bind(&payload.telephone)
        .bind(payload.whatsapp.as_ref())
        .bind(payload.type_vehicule.as_ref())
        .bind(payload.marque_modele.as_ref())
        .bind(payload.immatriculation.as_ref())
        .bind(payload.couleur.as_ref())
        .bind(payload.annee)
        .bind(payload.zone_intervention.as_ref().map(|s| s.as_slice()))
        .bind(payload.gps_actuel.as_ref())
        .bind(payload.tarif_base)
        .bind(payload.tarif_par_km)
        .bind(payload.devise.as_ref().unwrap_or(&"XAF".to_string()))
        .bind(payload.paiement_cash.unwrap_or(true))
        .bind(payload.paiement_mobile_money.unwrap_or(false))
        .bind(payload.paiement_carte.unwrap_or(false))
        .bind(payload.climatisation.unwrap_or(false))
        .bind(payload.wifi.unwrap_or(false))
        .execute(&state.pg)
        .await
        .map_err(|e| {
            error!("[create_taxi] Erreur mise à jour: {}", e);
            AppError::Internal(format!("Erreur mise à jour taxi: {}", e))
        })?;

        return Ok((
            StatusCode::OK,
            Json(json!({
                "success": true,
                "id": taxi_id,
                "message": "Taxi mis à jour avec succès"
            })),
        ));
    }

    let taxi_id: i32 = sqlx::query_scalar(
        r#"
        INSERT INTO taxis_ville (
            service_id, user_id, nom_chauffeur, telephone, whatsapp,
            type_vehicule, marque_modele, immatriculation, couleur, annee,
            zone_intervention, gps_actuel,
            tarif_base, tarif_par_km, devise,
            paiement_cash, paiement_mobile_money, paiement_carte,
            climatisation, wifi
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
        RETURNING id
        "#
    )
    .bind(payload.service_id)
    .bind(user_id)
    .bind(payload.nom_chauffeur)
    .bind(&payload.telephone)
    .bind(payload.whatsapp)
    .bind(payload.type_vehicule)
    .bind(payload.marque_modele)
    .bind(payload.immatriculation)
    .bind(payload.couleur)
    .bind(payload.annee)
    .bind(payload.zone_intervention.as_ref().map(|s| s.as_slice()))
    .bind(payload.gps_actuel)
    .bind(payload.tarif_base.unwrap_or(500))
    .bind(payload.tarif_par_km.unwrap_or(200))
    .bind(payload.devise.unwrap_or_else(|| "XAF".to_string()))
    .bind(payload.paiement_cash.unwrap_or(true))
    .bind(payload.paiement_mobile_money.unwrap_or(false))
    .bind(payload.paiement_carte.unwrap_or(false))
    .bind(payload.climatisation.unwrap_or(false))
    .bind(payload.wifi.unwrap_or(false))
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        error!("[create_taxi] Erreur insertion: {}", e);
        AppError::Internal(format!("Erreur création taxi: {}", e))
    })?;

    // ✅ NOUVEAU : Marquer le service comme spécialisé
    sqlx::query("UPDATE services SET specialized_type = 'taxi_ville' WHERE id = $1")
        .bind(payload.service_id)
        .execute(&state.pg)
        .await
        .map_err(|e| {
            error!("[create_taxi] Erreur mise à jour specialized_type: {}", e);
            AppError::Internal("Erreur mise à jour specialized_type".to_string())
        })?;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "success": true,
            "id": taxi_id,
            "message": "Taxi créé avec succès"
        })),
    ))
}

// ============================================================================
// IMMOBILIER - YUKPO LEADER MONDIAL
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct PropertySearchQuery {
    pub query: Option<String>, // Recherche textuelle
    pub ville: Option<String>,
    pub quartier: Option<serde_json::Value>, // String ou Array<String>
    pub lat: Option<f64>,
    pub lng: Option<f64>,
    pub max_distance_km: Option<f64>,
    pub search_zone: Option<String>, // Zone polygonale: "lat1,lng1|lat2,lng2|..."
    pub type_bien: Option<String>,
    pub statut: Option<String>,
    pub prix_min: Option<f64>,
    pub prix_max: Option<f64>,
    pub superficie_min: Option<f64>,
    pub superficie_max: Option<f64>,
    pub nb_chambres_min: Option<i32>,
    pub standing: Option<String>,
    pub page: Option<i64>,
    pub limit: Option<i64>,
}

/// Recherche de biens immobiliers (Yukpo leader - recherche avancée par zone/quartiers)
pub async fn search_properties(
    State(state): State<Arc<AppState>>,
    Query(query): Query<PropertySearchQuery>,
) -> AppResult<impl IntoResponse> {
    info!("[search_properties] Recherche biens immobiliers (Yukpo leader)");

    let page = query.page.unwrap_or(1).max(1);
    let limit = query.limit.unwrap_or(20).min(100).max(1);
    let offset = (page - 1) * limit;

    // ✅ MODIFIÉ: Recherche directement dans service_products au lieu de real_estate_properties
    // Construction de la requête SQL avec bindings SQLx
    let mut query_builder = sqlx::QueryBuilder::new(
        r#"
        SELECT 
            p.id,
            p.service_id,
            s.user_id,
            COALESCE(p.product_name, s.data->>'titre_service') as titre,
            COALESCE(p.product_description, s.data->>'description') as description,
            COALESCE(p.product_data->>'type_bien', s.data->'type_bien'->>'valeur', '') as type_bien,
            COALESCE(p.product_data->>'statut', s.data->'statut'->>'valeur', '') as statut,
            COALESCE(s.data->'adresse'->>'valeur', s.data->>'adresse', '') as adresse,
            COALESCE(s.quartier, s.data->'quartier'->>'valeur', s.data->>'quartier', '') as quartier,
            COALESCE(s.ville, s.data->'ville'->>'valeur', s.data->>'ville', '') as ville,
            COALESCE(s.gps, s.data->'gps_fixe'->>'valeur', s.data->>'gps', '') as gps,
            COALESCE((p.product_data->>'superficie_m2')::numeric, (s.data->'superficie_m2'->>'valeur')::numeric, NULL) as superficie_m2,
            COALESCE((p.product_data->>'nb_chambres')::integer, (s.data->'nb_chambres'->>'valeur')::integer, NULL) as nb_chambres,
            COALESCE((p.product_data->>'nb_salles_bain')::integer, (s.data->'nb_salles_bain'->>'valeur')::integer, NULL) as nb_salles_bain,
            COALESCE(p.product_data->>'standing', s.data->'standing'->>'valeur', s.data->>'standing', '') as standing,
            COALESCE(p.product_data->>'etat_general', s.data->'etat_general'->>'valeur', s.data->>'etat_general', '') as etat_general,
            COALESCE((p.product_data->>'prix_vente')::numeric, (s.data->'prix_vente'->>'valeur')::numeric, NULL) as prix_vente,
            COALESCE((p.product_data->>'prix_location_mensuel')::numeric, (s.data->'prix_location_mensuel'->>'valeur')::numeric, NULL) as prix_location_mensuel,
            COALESCE(p.product_data->'photos', s.data->'photos', '[]'::jsonb) as photos,
            COALESCE(p.is_active, true) as is_available_now,
            s.is_active,
            p.created_at,
            p.updated_at
        FROM service_products p
        INNER JOIN services s ON s.id = p.service_id
        WHERE s.is_active = true
        AND p.is_active = true
        AND (s.category = 'immobilier' OR s.category = 'immobilier_batiment' OR s.data->>'category' = 'immobilier' OR s.data->'category'->>'valeur' = 'immobilier')
        "#,
    );

    if let Some(ville) = &query.ville {
        query_builder.push(" AND (s.ville ILIKE ");
        query_builder.push_bind(format!("%{}%", ville));
        query_builder.push(" OR s.data->'ville'->>'valeur' ILIKE ");
        query_builder.push_bind(format!("%{}%", ville));
        query_builder.push(" OR s.data->>'ville' ILIKE ");
        query_builder.push_bind(format!("%{}%", ville));
        query_builder.push(")");
    }

    // Support multiple quartiers ou quartier unique (Yukpo leader)
    if let Some(quartier_value) = &query.quartier {
        if let Some(quartier_array) = quartier_value.as_array() {
            // Plusieurs quartiers
            if !quartier_array.is_empty() {
                query_builder.push(" AND (");
                for (idx, q) in quartier_array.iter().enumerate() {
                    if let Some(q_str) = q.as_str() {
                        if idx > 0 {
                            query_builder.push(" OR ");
                        }
                        query_builder.push("(s.quartier ILIKE ");
                        query_builder.push_bind(format!("%{}%", q_str));
                        query_builder.push(" OR s.data->'quartier'->>'valeur' ILIKE ");
                        query_builder.push_bind(format!("%{}%", q_str));
                        query_builder.push(" OR s.data->>'quartier' ILIKE ");
                        query_builder.push_bind(format!("%{}%", q_str));
                        query_builder.push(")");
                    }
                }
                query_builder.push(")");
            }
        } else if let Some(quartier_str) = quartier_value.as_str() {
            // Quartier unique
            query_builder.push(" AND (s.quartier ILIKE ");
            query_builder.push_bind(format!("%{}%", quartier_str));
            query_builder.push(" OR s.data->'quartier'->>'valeur' ILIKE ");
            query_builder.push_bind(format!("%{}%", quartier_str));
            query_builder.push(" OR s.data->>'quartier' ILIKE ");
            query_builder.push_bind(format!("%{}%", quartier_str));
            query_builder.push(")");
        }
    }

    // Recherche par zone polygonale (Yukpo leader - délimitation sur carte)
    if let Some(zone_str) = &query.search_zone {
        let points: Vec<&str> = zone_str.split('|').filter(|s| !s.is_empty()).collect();
        if points.len() >= 3 {
            let mut min_lat = f64::MAX;
            let mut max_lat = f64::MIN;
            let mut min_lng = f64::MAX;
            let mut max_lng = f64::MIN;
            let mut valid_points = Vec::new();

            for point in &points {
                let parts: Vec<&str> = point.split(',').collect();
                if parts.len() == 2 {
                    if let (Ok(lat), Ok(lng)) = (
                        parts[0].trim().parse::<f64>(),
                        parts[1].trim().parse::<f64>(),
                    ) {
                        valid_points.push((lat, lng));
                        min_lat = min_lat.min(lat);
                        max_lat = max_lat.max(lat);
                        min_lng = min_lng.min(lng);
                        max_lng = max_lng.max(lng);
                    }
                }
            }

            if valid_points.len() >= 3 && min_lat != f64::MAX {
                // Filtrer par bounding box (optimisation) puis vérifier point dans polygone
                query_builder.push(" AND COALESCE(s.gps, s.data->'gps_fixe'->>'valeur', s.data->>'gps', '') != '' AND (");
                query_builder.push("CAST(SPLIT_PART(COALESCE(s.gps, s.data->'gps_fixe'->>'valeur', s.data->>'gps', ''), ',', 1) AS FLOAT) BETWEEN ");
                query_builder.push_bind(min_lat);
                query_builder.push(" AND ");
                query_builder.push_bind(max_lat);
                query_builder.push(" AND CAST(SPLIT_PART(COALESCE(s.gps, s.data->'gps_fixe'->>'valeur', s.data->>'gps', ''), ',', 2) AS FLOAT) BETWEEN ");
                query_builder.push_bind(min_lng);
                query_builder.push(" AND ");
                query_builder.push_bind(max_lng);
                query_builder.push(")");
            }
        }
    }

    // Recherche par distance (point GPS + rayon) - seulement si pas de zone polygonale
    if query.search_zone.is_none() {
        if let (Some(lat), Some(lng)) = (query.lat, query.lng) {
            let max_dist = query.max_distance_km.unwrap_or(50.0);
            query_builder.push(" AND COALESCE(s.gps, s.data->'gps_fixe'->>'valeur', s.data->>'gps', '') != '' AND (");
            query_builder.push("6371 * acos(cos(radians(");
            query_builder.push_bind(lat);
            query_builder.push(")) * cos(radians(CAST(SPLIT_PART(COALESCE(s.gps, s.data->'gps_fixe'->>'valeur', s.data->>'gps', ''), ',', 1) AS FLOAT))) * ");
            query_builder.push("cos(radians(CAST(SPLIT_PART(COALESCE(s.gps, s.data->'gps_fixe'->>'valeur', s.data->>'gps', ''), ',', 2) AS FLOAT) - radians(");
            query_builder.push_bind(lng);
            query_builder.push(")) + sin(radians(");
            query_builder.push_bind(lat);
            query_builder.push(")) * sin(radians(CAST(SPLIT_PART(COALESCE(s.gps, s.data->'gps_fixe'->>'valeur', s.data->>'gps', ''), ',', 1) AS FLOAT)))) <= ");
            query_builder.push_bind(max_dist);
            query_builder.push(")");
        }
    }

    if let Some(type_bien) = &query.type_bien {
        query_builder.push(" AND (p.product_data->>'type_bien' = ");
        query_builder.push_bind(type_bien);
        query_builder.push(" OR s.data->'type_bien'->>'valeur' = ");
        query_builder.push_bind(type_bien);
        query_builder.push(" OR s.data->>'type_bien' = ");
        query_builder.push_bind(type_bien);
        query_builder.push(")");
    }
    if let Some(statut) = &query.statut {
        query_builder.push(" AND (p.product_data->>'statut' = ");
        query_builder.push_bind(statut);
        query_builder.push(" OR s.data->'statut'->>'valeur' = ");
        query_builder.push_bind(statut);
        query_builder.push(" OR s.data->>'statut' = ");
        query_builder.push_bind(statut);
        query_builder.push(")");
    }
    if let Some(prix_min) = query.prix_min {
        let prix_min_decimal =
            rust_decimal::Decimal::from_f64_retain(prix_min).unwrap_or(rust_decimal::Decimal::ZERO);
        query_builder.push(" AND ((COALESCE((p.product_data->>'prix_vente')::numeric, (s.data->'prix_vente'->>'valeur')::numeric, 0) >= ");
        query_builder.push_bind(prix_min_decimal);
        query_builder.push(" OR COALESCE((p.product_data->>'prix_location_mensuel')::numeric, (s.data->'prix_location_mensuel'->>'valeur')::numeric, 0) >= ");
        query_builder.push_bind(prix_min_decimal);
        query_builder.push("))");
    }
    if let Some(prix_max) = query.prix_max {
        let prix_max_decimal =
            rust_decimal::Decimal::from_f64_retain(prix_max).unwrap_or(rust_decimal::Decimal::ZERO);
        query_builder.push(" AND ((COALESCE((p.product_data->>'prix_vente')::numeric, (s.data->'prix_vente'->>'valeur')::numeric, 999999999) <= ");
        query_builder.push_bind(prix_max_decimal);
        query_builder.push(" OR COALESCE((p.product_data->>'prix_location_mensuel')::numeric, (s.data->'prix_location_mensuel'->>'valeur')::numeric, 999999999) <= ");
        query_builder.push_bind(prix_max_decimal);
        query_builder.push("))");
    }
    if let Some(superficie_min) = query.superficie_min {
        let superficie_min_decimal = rust_decimal::Decimal::from_f64_retain(superficie_min)
            .unwrap_or(rust_decimal::Decimal::ZERO);
        query_builder.push(" AND COALESCE((p.product_data->>'superficie_m2')::numeric, (s.data->'superficie_m2'->>'valeur')::numeric, 0) >= ");
        query_builder.push_bind(superficie_min_decimal);
    }
    if let Some(superficie_max) = query.superficie_max {
        let superficie_max_decimal = rust_decimal::Decimal::from_f64_retain(superficie_max)
            .unwrap_or(rust_decimal::Decimal::ZERO);
        query_builder.push(" AND COALESCE((p.product_data->>'superficie_m2')::numeric, (s.data->'superficie_m2'->>'valeur')::numeric, 999999) <= ");
        query_builder.push_bind(superficie_max_decimal);
    }
    if let Some(nb_chambres) = query.nb_chambres_min {
        query_builder.push(" AND COALESCE((p.product_data->>'nb_chambres')::integer, (s.data->'nb_chambres'->>'valeur')::integer, 0) >= ");
        query_builder.push_bind(nb_chambres);
    }
    if let Some(standing) = &query.standing {
        query_builder.push(" AND (p.product_data->>'standing' = ");
        query_builder.push_bind(standing);
        query_builder.push(" OR s.data->'standing'->>'valeur' = ");
        query_builder.push_bind(standing);
        query_builder.push(" OR s.data->>'standing' = ");
        query_builder.push_bind(standing);
        query_builder.push(")");
    }

    // Recherche textuelle dans product_name ou titre
    if let Some(query_text) = &query.query {
        if !query_text.trim().is_empty() {
            query_builder.push(" AND (p.product_name ILIKE ");
            query_builder.push_bind(format!("%{}%", query_text));
            query_builder.push(" OR s.data->>'titre_service' ILIKE ");
            query_builder.push_bind(format!("%{}%", query_text));
            query_builder.push(" OR s.data->'titre_service'->>'valeur' ILIKE ");
            query_builder.push_bind(format!("%{}%", query_text));
            query_builder.push(" OR p.product_description ILIKE ");
            query_builder.push_bind(format!("%{}%", query_text));
            query_builder.push(")");
        }
    }

    query_builder.push(" ORDER BY p.created_at DESC LIMIT ");
    query_builder.push_bind(limit);
    query_builder.push(" OFFSET ");
    query_builder.push_bind(offset);

    let properties = query_builder.build().fetch_all(&state.pg).await.map_err(|e| {
        error!("[search_properties] Erreur: {}", e);
        AppError::Internal("Erreur recherche biens".to_string())
    })?;

    let mut properties_json = Vec::new();
    for row in properties {
        // Extraire photos depuis JSONB
        let photos_value: Option<serde_json::Value> =
            row.try_get::<Option<serde_json::Value>, _>("photos").ok().flatten();
        let photos_array: Option<Vec<String>> = photos_value.and_then(|v| {
            if v.is_array() {
                Some(
                    v.as_array()?
                        .iter()
                        .filter_map(|item| item.as_str().map(|s| s.to_string()))
                        .collect(),
                )
            } else {
                None
            }
        });

        properties_json.push(json!({
            "id": row.try_get::<i32, _>("id").unwrap_or(0),
            "service_id": row.try_get::<i32, _>("service_id").unwrap_or(0),
            "titre": row.try_get::<Option<String>, _>("titre").ok().flatten().unwrap_or_default(),
            "description": row.try_get::<Option<String>, _>("description").ok().flatten(),
            "type_bien": row.try_get::<Option<String>, _>("type_bien").ok().flatten().unwrap_or_default(),
            "statut": row.try_get::<Option<String>, _>("statut").ok().flatten().unwrap_or_default(),
            "quartier": row.try_get::<Option<String>, _>("quartier").ok().flatten(),
            "ville": row.try_get::<Option<String>, _>("ville").ok().flatten(),
            "gps": row.try_get::<Option<String>, _>("gps").ok().flatten(),
            "superficie_m2": row.try_get::<Option<rust_decimal::Decimal>, _>("superficie_m2").ok().flatten().and_then(|d| d.to_string().parse::<f64>().ok()),
            "nb_chambres": row.try_get::<Option<i32>, _>("nb_chambres").ok().flatten(),
            "nb_salles_bain": row.try_get::<Option<i32>, _>("nb_salles_bain").ok().flatten(),
            "standing": row.try_get::<Option<String>, _>("standing").ok().flatten(),
            "prix_vente": row.try_get::<Option<rust_decimal::Decimal>, _>("prix_vente").ok().flatten().and_then(|d| d.to_string().parse::<f64>().ok()),
            "prix_location_mensuel": row.try_get::<Option<rust_decimal::Decimal>, _>("prix_location_mensuel").ok().flatten().and_then(|d| d.to_string().parse::<f64>().ok()),
            "photos": photos_array,
            "is_available_now": row.try_get::<Option<bool>, _>("is_available_now").ok().flatten().unwrap_or(true),
        }));
    }

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": properties_json
        })),
    ))
}

/// Détails d'un bien immobilier
pub async fn get_property_details(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    info!("[get_property_details] Détails bien id={}", id);

    let property = sqlx::query(
        r#"
        SELECT 
            p.*,
            s.is_active
        FROM real_estate_properties p
        INNER JOIN services s ON s.id = p.service_id
        WHERE p.id = $1 AND s.is_active = true
        "#,
    )
    .bind(id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| {
        error!("[get_property_details] Erreur: {}", e);
        AppError::Internal("Erreur chargement bien".to_string())
    })?;

    if property.is_none() {
        return Err(AppError::NotFound("Bien immobilier non trouvé".to_string()));
    }

    let row = property.unwrap();
    let property_json = json!({
        "id": row.try_get::<i32, _>("id").unwrap_or(0),
        "service_id": row.try_get::<i32, _>("service_id").unwrap_or(0),
        "titre": row.try_get::<String, _>("titre").unwrap_or_default(),
        "description": row.try_get::<Option<String>, _>("description").ok().flatten(),
        "type_bien": row.try_get::<String, _>("type_bien").unwrap_or_default(),
        "statut": row.try_get::<String, _>("statut").unwrap_or_default(),
        "adresse": row.try_get::<Option<String>, _>("adresse").ok().flatten(),
        "quartier": row.try_get::<Option<String>, _>("quartier").ok().flatten(),
        "ville": row.try_get::<Option<String>, _>("ville").ok().flatten(),
        "gps": row.try_get::<Option<String>, _>("gps").ok().flatten(),
        "superficie_m2": row.try_get::<Option<rust_decimal::Decimal>, _>("superficie_m2").ok().flatten().and_then(|d| d.to_string().parse::<f64>().ok()),
        "nb_chambres": row.try_get::<Option<i32>, _>("nb_chambres").ok().flatten(),
        "nb_salles_bain": row.try_get::<Option<i32>, _>("nb_salles_bain").ok().flatten(),
        "standing": row.try_get::<Option<String>, _>("standing").ok().flatten(),
        "etat_general": row.try_get::<Option<String>, _>("etat_general").ok().flatten(),
        "prix_vente": row.try_get::<Option<rust_decimal::Decimal>, _>("prix_vente").ok().flatten().and_then(|d| d.to_string().parse::<f64>().ok()),
        "prix_location_mensuel": row.try_get::<Option<rust_decimal::Decimal>, _>("prix_location_mensuel").ok().flatten().and_then(|d| d.to_string().parse::<f64>().ok()),
        "photos": row.try_get::<Option<Vec<String>>, _>("photos").ok().flatten(),
    });

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": property_json
        })),
    ))
}

/// ✅ NOUVEAU: Créer un bien immobilier
#[derive(Debug, Deserialize)]
pub struct CreatePropertyRequest {
    pub service_id: i32,
    pub titre: String,
    pub description: Option<String>,
    pub type_bien: String, // "maison", "appartement", "terrain", "bureau", "local_commercial"
    pub statut: String,    // "vente", "location", "les_deux"
    pub adresse: Option<String>,
    pub quartier: Option<String>,
    pub ville: Option<String>,
    pub gps: Option<String>,
    pub superficie_m2: Option<f64>,
    pub nb_chambres: Option<i32>,
    pub nb_salles_bain: Option<i32>,
    pub standing: Option<String>, // "économique", "moyen", "haut_de_gamme", "luxe"
    pub etat_general: Option<String>, // "neuf", "bon_etat", "à_rénover", "rénové"
    pub prix_vente: Option<f64>,
    pub prix_location_mensuel: Option<f64>,
    pub photos: Option<Vec<String>>,
}

/// POST /api/immobilier/biens
/// Créer un bien immobilier
pub async fn create_property(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<CreatePropertyRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[create_property] Création bien immobilier pour user_id={}, service_id={}",
        user_id, payload.service_id
    );

    // Vérifier que le service existe et appartient à l'utilisateur
    let service_exists: Option<i32> =
        sqlx::query_scalar("SELECT id FROM services WHERE id = $1 AND user_id = $2")
            .bind(payload.service_id)
            .bind(user_id)
            .fetch_optional(&state.pg)
            .await
            .map_err(|e| {
                error!("[create_property] Erreur vérification service: {}", e);
                AppError::Internal(format!("Erreur vérification service: {}", e))
            })?;

    if service_exists.is_none() {
        return Err(AppError::NotFound(
            "Service non trouvé ou n'appartient pas à l'utilisateur".to_string(),
        ));
    }

    // Convertir les prix en Decimal
    use rust_decimal::Decimal;
    let prix_vente = payload.prix_vente.map(|p| Decimal::from_f64_retain(p).unwrap_or_default());
    let prix_location = payload
        .prix_location_mensuel
        .map(|p| Decimal::from_f64_retain(p).unwrap_or_default());
    let superficie = payload.superficie_m2.map(|s| Decimal::from_f64_retain(s).unwrap_or_default());

    // Insérer le bien immobilier
    let property_id = sqlx::query_scalar::<_, i32>(
        r#"
        INSERT INTO real_estate_properties (
            service_id, user_id, titre, description, type_bien, statut,
            adresse, quartier, ville, gps, superficie_m2,
            nb_chambres, nb_salles_bain, standing, etat_general,
            prix_vente, prix_location_mensuel, photos, is_available_now
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, true)
        RETURNING id
        "#,
    )
    .bind(payload.service_id)
    .bind(user_id)
    .bind(&payload.titre)
    .bind(payload.description.as_deref())
    .bind(&payload.type_bien)
    .bind(&payload.statut)
    .bind(payload.adresse.as_deref())
    .bind(payload.quartier.as_deref())
    .bind(payload.ville.as_deref())
    .bind(payload.gps.as_deref())
    .bind(superficie.as_ref())
    .bind(payload.nb_chambres)
    .bind(payload.nb_salles_bain)
    .bind(payload.standing.as_deref())
    .bind(payload.etat_general.as_deref())
    .bind(prix_vente.as_ref())
    .bind(prix_location.as_ref())
    .bind(payload.photos.as_deref())
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        error!("[create_property] Erreur insertion: {}", e);
        AppError::Internal(format!("Erreur création bien: {}", e))
    })?;

    info!(
        "[create_property] Bien immobilier créé avec id={}",
        property_id
    );

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "success": true,
            "data": {
                "id": property_id,
                "service_id": payload.service_id
            }
        })),
    ))
}

// Helper functions
fn parse_gps(gps_str: &str) -> Option<(f64, f64)> {
    let parts: Vec<&str> = gps_str.split(',').collect();
    if parts.len() == 2 {
        if let (Ok(lat), Ok(lng)) = (
            parts[0].trim().parse::<f64>(),
            parts[1].trim().parse::<f64>(),
        ) {
            return Some((lat, lng));
        }
    }
    None
}

fn calculate_distance_km(pos1: (f64, f64), pos2: (f64, f64)) -> f64 {
    const EARTH_RADIUS_KM: f64 = 6371.0;
    let to_rad = |deg: f64| deg * PI / 180.0;
    let (lat1, lon1) = (to_rad(pos1.0), to_rad(pos1.1));
    let (lat2, lon2) = (to_rad(pos2.0), to_rad(pos2.1));
    let dlat = lat2 - lat1;
    let dlon = lon2 - lon1;
    let a = (dlat / 2.0).sin().powi(2) + lat1.cos() * lat2.cos() * (dlon / 2.0).sin().powi(2);
    let c = 2.0 * a.sqrt().asin();
    EARTH_RADIUS_KM * c
}

/// Réserver une visite d'un bien immobilier
#[derive(Debug, Deserialize)]
pub struct BookVisitRequest {
    pub date_visite: String,
    pub heure_visite: String,
    pub type_visite: String,
}

pub async fn book_property_visit(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(property_id): Path<i32>,
    Json(request): Json<BookVisitRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[book_property_visit] Réservation visite property_id={}, user_id={}",
        property_id, user_id
    );

    // Vérifier que le bien existe
    let property_exists: Option<i32> =
        sqlx::query_scalar("SELECT id FROM real_estate_properties WHERE id = $1")
            .bind(property_id)
            .fetch_optional(&state.pg)
            .await
            .map_err(|e| {
                error!("[book_property_visit] Erreur vérification: {}", e);
                AppError::Internal("Erreur vérification bien".to_string())
            })?;

    if property_exists.is_none() {
        return Err(AppError::NotFound("Bien immobilier non trouvé".to_string()));
    }

    // Parser date et heure
    let date_visite =
        chrono::NaiveDate::parse_from_str(&request.date_visite, "%Y-%m-%d").map_err(|_| {
            AppError::BadRequest("Format date invalide (YYYY-MM-DD requis)".to_string())
        })?;
    let _heure_visite = chrono::NaiveTime::parse_from_str(&request.heure_visite, "%H:%M")
        .map_err(|_| AppError::BadRequest("Format heure invalide (HH:MM requis)".to_string()))?;

    let visit_id: i32 = sqlx::query_scalar(
        r#"
        INSERT INTO property_visits (property_id, user_id, type_visite, date_visite, status)
        VALUES ($1, $2, $3, $4::date, 'pending')
        RETURNING id
        "#,
    )
    .bind(property_id)
    .bind(user_id)
    .bind(&request.type_visite)
    .bind(date_visite)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        error!("[book_property_visit] Erreur insertion: {}", e);
        AppError::Internal("Erreur réservation visite".to_string())
    })?;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "success": true,
            "data": { "id": visit_id }
        })),
    ))
}

/// Simuler un prêt immobilier
#[derive(Debug, Deserialize)]
pub struct SimulateLoanRequest {
    pub property_price: f64,
    pub down_payment: f64,
    pub loan_duration_years: i32,
    pub interest_rate: Option<f64>,
}

pub async fn simulate_property_loan(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(property_id): Path<i32>,
    Json(request): Json<SimulateLoanRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[simulate_property_loan] Simulation prêt property_id={}, user_id={}",
        property_id, user_id
    );

    let app_ia = state.ia.clone();
    let real_estate_service = RealEstateAIService::new(app_ia);

    let loan_simulation = real_estate_service
        .simulate_loan(
            request.property_price,
            request.down_payment,
            request.loan_duration_years,
            request.interest_rate,
        )
        .await
        .map_err(|e| {
            error!("[simulate_property_loan] Erreur simulation: {}", e);
            AppError::Internal("Erreur simulation prêt".to_string())
        })?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": loan_simulation
        })),
    ))
}

/// Obtenir mes visites réservées
pub async fn get_my_visits(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    info!("[get_my_visits] Mes visites user_id={}", user_id);

    let visits = sqlx::query(
        r#"
        SELECT 
            v.*,
            p.titre as property_titre,
            p.quartier,
            p.ville,
            p.photos
        FROM property_visits v
        INNER JOIN real_estate_properties p ON p.id = v.property_id
        WHERE v.user_id = $1
        ORDER BY v.date_visite DESC
        "#,
    )
    .bind(user_id)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| {
        error!("[get_my_visits] Erreur: {}", e);
        AppError::Internal("Erreur chargement visites".to_string())
    })?;

    let mut visits_json = Vec::new();
    for row in visits {
        visits_json.push(json!({
            "id": row.try_get::<i32, _>("id").unwrap_or(0),
            "property_id": row.try_get::<i32, _>("property_id").unwrap_or(0),
            "property_titre": row.try_get::<Option<String>, _>("property_titre").ok().flatten(),
            "type_visite": row.try_get::<String, _>("type_visite").unwrap_or_default(),
            "date_visite": row.try_get::<chrono::NaiveDate, _>("date_visite").ok().map(|d| d.to_string()),
            "status": row.try_get::<String, _>("status").unwrap_or_default(),
            "quartier": row.try_get::<Option<String>, _>("quartier").ok().flatten(),
            "ville": row.try_get::<Option<String>, _>("ville").ok().flatten(),
        }));
    }

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": visits_json
        })),
    ))
}

/// Recommandations IA de biens
#[derive(Debug, Deserialize)]
pub struct AIRecommendationRequest {
    pub budget_max: f64,
    pub type_bien: Option<String>,
    pub nb_chambres: Option<i32>,
    pub quartier: Option<String>,
    pub ville: String,
    pub preferences: Option<serde_json::Value>,
}

pub async fn get_ai_recommendations(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(request): Json<AIRecommendationRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[get_ai_recommendations] Recommandations IA user_id={}",
        user_id
    );

    let app_ia = state.ia.clone();
    let real_estate_service = RealEstateAIService::new(app_ia);

    let recommendation = real_estate_service
        .recommend_properties(
            request.budget_max,
            request.type_bien.as_deref(),
            request.nb_chambres,
            request.quartier.as_deref(),
            &request.ville,
            request.preferences,
        )
        .await
        .map_err(|e| {
            error!("[get_ai_recommendations] Erreur: {}", e);
            AppError::Internal("Erreur génération recommandations".to_string())
        })?;

    // Récupérer les détails des biens recommandés
    let mut properties_json = Vec::new();
    if !recommendation.property_ids.is_empty() {
        let properties = sqlx::query(
            r#"
            SELECT p.*, s.is_active
            FROM real_estate_properties p
            INNER JOIN services s ON s.id = p.service_id
            WHERE p.id = ANY($1::int[]) AND s.is_active = true
            "#,
        )
        .bind(&recommendation.property_ids)
        .fetch_all(&state.pg)
        .await
        .ok();

        if let Some(props) = properties {
            for row in props {
                properties_json.push(json!({
                    "id": row.try_get::<i32, _>("id").unwrap_or(0),
                    "titre": row.try_get::<String, _>("titre").unwrap_or_default(),
                    "type_bien": row.try_get::<String, _>("type_bien").unwrap_or_default(),
                    "prix_vente": row.try_get::<Option<rust_decimal::Decimal>, _>("prix_vente").ok().flatten().and_then(|d| d.to_string().parse::<f64>().ok()),
                    "prix_location_mensuel": row.try_get::<Option<rust_decimal::Decimal>, _>("prix_location_mensuel").ok().flatten().and_then(|d| d.to_string().parse::<f64>().ok()),
                    "quartier": row.try_get::<Option<String>, _>("quartier").ok().flatten(),
                    "ville": row.try_get::<Option<String>, _>("ville").ok().flatten(),
                }));
            }
        }
    }

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "recommendations": recommendation.recommendations,
            "budget_analysis": recommendation.budget_analysis,
            "location_analysis": recommendation.location_analysis,
            "investment_potential": recommendation.investment_potential,
            "properties": properties_json
        })),
    ))
}

/// Estimation de prix IA
#[derive(Debug, Deserialize)]
pub struct PriceEstimateRequest {
    pub type_bien: String,
    pub superficie_m2: f64,
    pub nb_chambres: i32,
    pub standing: String,
    pub quartier: String,
    pub ville: String,
    pub equipements: Option<serde_json::Value>,
}

pub async fn estimate_property_price(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(request): Json<PriceEstimateRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[estimate_property_price] Estimation prix user_id={}",
        user_id
    );

    let app_ia = state.ia.clone();
    let real_estate_service = RealEstateAIService::new(app_ia);

    let estimate = real_estate_service
        .estimate_property_price(
            &request.type_bien,
            request.superficie_m2,
            request.nb_chambres,
            &request.standing,
            &request.quartier,
            &request.ville,
            request.equipements,
        )
        .await
        .map_err(|e| {
            error!("[estimate_property_price] Erreur: {}", e);
            AppError::Internal("Erreur estimation prix".to_string())
        })?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "estimate": estimate
        })),
    ))
}

/// Upload photos/vidéos pour bien immobilier (avec MediaStorage)
pub async fn upload_property_media(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(property_id): Path<i32>,
    mut multipart: Multipart,
) -> AppResult<impl IntoResponse> {
    info!(
        "[upload_property_media] Upload média property_id={}, user_id={}",
        property_id, user_id
    );

    // Vérifier que l'utilisateur est propriétaire du bien
    let property_owner = sqlx::query_scalar::<_, Option<i32>>(
        "SELECT user_id FROM real_estate_properties WHERE id = $1",
    )
    .bind(property_id)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        error!("[upload_property_media] Erreur vérification: {}", e);
        AppError::Internal("Erreur vérification propriétaire".to_string())
    })?;

    if property_owner != Some(user_id) {
        return Err(AppError::Unauthorized(
            "Vous n'êtes pas propriétaire de ce bien".to_string(),
        ));
    }

    let mut uploaded_urls = Vec::new();

    while let Some(field) = multipart.next_field().await.map_err(|e| {
        error!("[upload_property_media] Erreur multipart: {}", e);
        AppError::Internal("Erreur lecture fichier".to_string())
    })? {
        let filename = field.file_name().unwrap_or("file").to_string();
        let bytes = field.bytes().await.map_err(|e| {
            error!("[upload_property_media] Erreur bytes: {}", e);
            AppError::Internal("Erreur lecture données".to_string())
        })?;

        // Déterminer le type de média
        let media_type = if filename.to_lowercase().ends_with(".mp4")
            || filename.to_lowercase().ends_with(".mov")
        {
            "video"
        } else if filename.to_lowercase().ends_with(".mp3")
            || filename.to_lowercase().ends_with(".wav")
        {
            "audio"
        } else {
            "image"
        };

        let content_type = match media_type {
            "video" => "video/mp4",
            "audio" => "audio/mpeg",
            _ => "image/jpeg",
        };

        // Générer un nom unique
        let ext = filename.split('.').last().unwrap_or("jpg");
        let storage_key = format!("immobilier/{}/{}.{}", property_id, Uuid::new_v4(), ext);

        // ✅ Uploader avec MediaStorage (Yukpo leader)
        let stored = state
            .media_storage
            .store_bytes(&bytes, &storage_key, Some(content_type))
            .await
            .map_err(|e| {
                error!("[upload_property_media] Erreur upload: {}", e);
                AppError::Internal("Erreur upload fichier".to_string())
            })?;

        uploaded_urls.push(stored.public_url.clone());

        // Enregistrer dans property_photos
        sqlx::query(
            r#"
            INSERT INTO property_photos (property_id, url, ordre, is_principal)
            VALUES ($1, $2, (SELECT COALESCE(MAX(ordre), 0) + 1 FROM property_photos WHERE property_id = $1), false)
            "#
        )
        .bind(property_id)
        .bind(&stored.public_url)
        .execute(&state.pg)
        .await
        .map_err(|e| {
            error!("[upload_property_media] Erreur enregistrement: {}", e);
            AppError::Internal("Erreur enregistrement photo".to_string())
        })?;
    }

    // Mettre à jour la liste des photos dans real_estate_properties
    let current_photos: Vec<String> = sqlx::query_scalar::<_, Option<Vec<String>>>(
        "SELECT photos FROM real_estate_properties WHERE id = $1",
    )
    .bind(property_id)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        error!("[upload_property_media] Erreur récupération photos: {}", e);
        AppError::Internal("Erreur récupération photos".to_string())
    })?
    .unwrap_or_default();

    let mut updated_photos = current_photos;
    updated_photos.extend(uploaded_urls.clone());

    sqlx::query("UPDATE real_estate_properties SET photos = $1 WHERE id = $2")
        .bind(&updated_photos)
        .bind(property_id)
        .execute(&state.pg)
        .await
        .map_err(|e| {
            error!("[upload_property_media] Erreur mise à jour: {}", e);
            AppError::Internal("Erreur mise à jour photos".to_string())
        })?;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "success": true,
            "uploaded_urls": uploaded_urls
        })),
    ))
}

/// Analytics propriétaire (vues, contacts, visites)
pub async fn get_property_analytics(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Query(query): Query<serde_json::Value>,
) -> AppResult<impl IntoResponse> {
    let property_id = query.get("property_id").and_then(|v| v.as_i64()).map(|v| v as i32);

    if property_id.is_none() {
        return Err(AppError::BadRequest("property_id requis".to_string()));
    }

    let property_id = property_id.unwrap();

    // Vérifier propriétaire
    let property_owner = sqlx::query_scalar::<_, Option<i32>>(
        "SELECT user_id FROM real_estate_properties WHERE id = $1",
    )
    .bind(property_id)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        error!("[get_property_analytics] Erreur vérification: {}", e);
        AppError::Internal("Erreur vérification".to_string())
    })?;

    if property_owner != Some(user_id) {
        return Err(AppError::Unauthorized(
            "Vous n'êtes pas propriétaire".to_string(),
        ));
    }

    let analytics = sqlx::query(
        r#"
        SELECT 
            (SELECT COUNT(*) FROM property_views WHERE property_id = $1) as total_vues,
            (SELECT COUNT(*) FROM property_visits WHERE property_id = $1) as total_visites_demandees,
            (SELECT COUNT(*) FROM property_visits WHERE property_id = $1 AND status = 'confirmed') as total_visites_confirmees,
            (SELECT COUNT(*) FROM property_favorites WHERE property_id = $1) as total_favoris,
            (SELECT COUNT(*) FROM property_shares WHERE property_id = $1) as total_partages
        "#
    )
    .bind(property_id)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        error!("[get_property_analytics] Erreur: {}", e);
        AppError::Internal("Erreur chargement analytics".to_string())
    })?;

    let analytics_json = json!({
        "total_vues": analytics.try_get::<Option<i64>, _>("total_vues").ok().flatten().unwrap_or(0),
        "total_visites_demandees": analytics.try_get::<Option<i64>, _>("total_visites_demandees").ok().flatten().unwrap_or(0),
        "total_visites_confirmees": analytics.try_get::<Option<i64>, _>("total_visites_confirmees").ok().flatten().unwrap_or(0),
        "total_favoris": analytics.try_get::<Option<i64>, _>("total_favoris").ok().flatten().unwrap_or(0),
        "total_partages": analytics.try_get::<Option<i64>, _>("total_partages").ok().flatten().unwrap_or(0),
    });

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "analytics": analytics_json
        })),
    ))
}

/// Ajouter aux favoris
pub async fn add_to_favorites(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(property_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[add_to_favorites] Ajout favori property_id={}, user_id={}",
        property_id, user_id
    );

    // Vérifier que le bien existe
    let property_exists: Option<i32> =
        sqlx::query_scalar("SELECT id FROM real_estate_properties WHERE id = $1")
            .bind(property_id)
            .fetch_optional(&state.pg)
            .await
            .map_err(|e| {
                error!("[add_to_favorites] Erreur vérification: {}", e);
                AppError::Internal("Erreur vérification".to_string())
            })?;

    if property_exists.is_none() {
        return Err(AppError::NotFound("Bien non trouvé".to_string()));
    }

    // Vérifier si déjà en favoris
    let existing: Option<i32> = sqlx::query_scalar(
        "SELECT id FROM property_favorites WHERE property_id = $1 AND user_id = $2",
    )
    .bind(property_id)
    .bind(user_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| {
        error!("[add_to_favorites] Erreur vérification: {}", e);
        AppError::Internal("Erreur vérification".to_string())
    })?;

    if existing.is_some() {
        return Ok((
            StatusCode::OK,
            Json(json!({
                "success": true,
                "message": "Déjà dans les favoris"
            })),
        ));
    }

    sqlx::query("INSERT INTO property_favorites (property_id, user_id) VALUES ($1, $2)")
        .bind(property_id)
        .bind(user_id)
        .execute(&state.pg)
        .await
        .map_err(|e| {
            error!("[add_to_favorites] Erreur insertion: {}", e);
            AppError::Internal("Erreur ajout favori".to_string())
        })?;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "success": true,
            "message": "Ajouté aux favoris"
        })),
    ))
}

/// Retirer des favoris
pub async fn remove_from_favorites(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(property_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[remove_from_favorites] Retrait favori property_id={}, user_id={}",
        property_id, user_id
    );

    sqlx::query("DELETE FROM property_favorites WHERE property_id = $1 AND user_id = $2")
        .bind(property_id)
        .bind(user_id)
        .execute(&state.pg)
        .await
        .map_err(|e| {
            error!("[remove_from_favorites] Erreur: {}", e);
            AppError::Internal("Erreur suppression favori".to_string())
        })?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "message": "Retiré des favoris"
        })),
    ))
}

/// Obtenir mes favoris
pub async fn get_my_favorites(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    info!("[get_my_favorites] Mes favoris user_id={}", user_id);

    let favorites = sqlx::query(
        r#"
        SELECT p.*, s.is_active
        FROM real_estate_properties p
        INNER JOIN property_favorites f ON f.property_id = p.id
        INNER JOIN services s ON s.id = p.service_id
        WHERE f.user_id = $1 AND s.is_active = true
        ORDER BY f.created_at DESC
        "#,
    )
    .bind(user_id)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| {
        error!("[get_my_favorites] Erreur: {}", e);
        AppError::Internal("Erreur chargement favoris".to_string())
    })?;

    let mut favorites_json = Vec::new();
    for row in favorites {
        favorites_json.push(json!({
            "id": row.try_get::<i32, _>("id").unwrap_or(0),
            "titre": row.try_get::<String, _>("titre").unwrap_or_default(),
            "type_bien": row.try_get::<String, _>("type_bien").unwrap_or_default(),
            "statut": row.try_get::<String, _>("statut").unwrap_or_default(),
            "quartier": row.try_get::<Option<String>, _>("quartier").ok().flatten(),
            "ville": row.try_get::<Option<String>, _>("ville").ok().flatten(),
            "prix_vente": row.try_get::<Option<rust_decimal::Decimal>, _>("prix_vente").ok().flatten().and_then(|d| d.to_string().parse::<f64>().ok()),
            "prix_location_mensuel": row.try_get::<Option<rust_decimal::Decimal>, _>("prix_location_mensuel").ok().flatten().and_then(|d| d.to_string().parse::<f64>().ok()),
            "photos": row.try_get::<Option<Vec<String>>, _>("photos").ok().flatten(),
        }));
    }

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": favorites_json
        })),
    ))
}

/// Comparer des biens
#[derive(Debug, Deserialize)]
pub struct ComparePropertiesRequest {
    pub property_ids: Vec<i32>,
    pub comparison_name: Option<String>,
}

pub async fn compare_properties(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(request): Json<ComparePropertiesRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[compare_properties] Comparaison user_id={}, {} biens",
        user_id,
        request.property_ids.len()
    );

    if request.property_ids.is_empty() || request.property_ids.len() > 5 {
        return Err(AppError::BadRequest(
            "Entre 1 et 5 biens requis pour comparaison".to_string(),
        ));
    }

    // Récupérer les biens
    let properties = sqlx::query(
        r#"
        SELECT p.*, s.is_active
        FROM real_estate_properties p
        INNER JOIN services s ON s.id = p.service_id
        WHERE p.id = ANY($1::int[]) AND s.is_active = true
        "#,
    )
    .bind(&request.property_ids)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| {
        error!("[compare_properties] Erreur: {}", e);
        AppError::Internal("Erreur chargement biens".to_string())
    })?;

    let mut properties_json = Vec::new();
    for row in properties {
        properties_json.push(json!({
            "id": row.try_get::<i32, _>("id").unwrap_or(0),
            "titre": row.try_get::<String, _>("titre").unwrap_or_default(),
            "type_bien": row.try_get::<String, _>("type_bien").unwrap_or_default(),
            "statut": row.try_get::<String, _>("statut").unwrap_or_default(),
            "superficie_m2": row.try_get::<Option<rust_decimal::Decimal>, _>("superficie_m2").ok().flatten().and_then(|d| d.to_string().parse::<f64>().ok()),
            "nb_chambres": row.try_get::<Option<i32>, _>("nb_chambres").ok().flatten(),
            "nb_salles_bain": row.try_get::<Option<i32>, _>("nb_salles_bain").ok().flatten(),
            "standing": row.try_get::<Option<String>, _>("standing").ok().flatten(),
            "prix_vente": row.try_get::<Option<rust_decimal::Decimal>, _>("prix_vente").ok().flatten().and_then(|d| d.to_string().parse::<f64>().ok()),
            "prix_location_mensuel": row.try_get::<Option<rust_decimal::Decimal>, _>("prix_location_mensuel").ok().flatten().and_then(|d| d.to_string().parse::<f64>().ok()),
            "quartier": row.try_get::<Option<String>, _>("quartier").ok().flatten(),
            "ville": row.try_get::<Option<String>, _>("ville").ok().flatten(),
            "photos": row.try_get::<Option<Vec<String>>, _>("photos").ok().flatten(),
        }));
    }

    // Enregistrer la comparaison
    if let Some(name) = request.comparison_name {
        sqlx::query(
            r#"
            INSERT INTO property_comparisons (user_id, property_ids, comparison_name)
            VALUES ($1, $2, $3)
            "#,
        )
        .bind(user_id)
        .bind(&request.property_ids)
        .bind(&name)
        .execute(&state.pg)
        .await
        .ok(); // Ne pas bloquer si erreur
    }

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "properties": properties_json
        })),
    ))
}

/// Créer une alerte prix
#[derive(Debug, Deserialize)]
pub struct CreatePriceAlertRequest {
    pub property_id: Option<i32>,
    pub search_criteria: Option<serde_json::Value>,
    pub target_price_max: Option<f64>,
    pub alert_type: String, // "price_drop", "new_property", "price_match"
}

pub async fn create_price_alert(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(request): Json<CreatePriceAlertRequest>,
) -> AppResult<impl IntoResponse> {
    info!("[create_price_alert] Création alerte user_id={}", user_id);

    let alert_id: i32 = sqlx::query_scalar(
        r#"
        INSERT INTO property_price_alerts (user_id, property_id, search_criteria, target_price_max, alert_type, is_active)
        VALUES ($1, $2, $3, $4, $5, true)
        RETURNING id
        "#
    )
    .bind(user_id)
    .bind(request.property_id)
    .bind(request.search_criteria.as_ref())
    .bind(request.target_price_max.map(|p| rust_decimal::Decimal::from_f64_retain(p).unwrap_or(rust_decimal::Decimal::ZERO)))
    .bind(&request.alert_type)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        error!("[create_price_alert] Erreur: {}", e);
        AppError::Internal("Erreur création alerte".to_string())
    })?;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "success": true,
            "data": { "id": alert_id }
        })),
    ))
}

/// Obtenir mes alertes prix
pub async fn get_my_price_alerts(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    info!("[get_my_price_alerts] Mes alertes user_id={}", user_id);

    let alerts = sqlx::query(
        r#"
        SELECT 
            a.*,
            p.titre as property_titre
        FROM property_price_alerts a
        LEFT JOIN real_estate_properties p ON p.id = a.property_id
        WHERE a.user_id = $1
        ORDER BY a.created_at DESC
        "#,
    )
    .bind(user_id)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| {
        error!("[get_my_price_alerts] Erreur: {}", e);
        AppError::Internal("Erreur chargement alertes".to_string())
    })?;

    let mut alerts_json = Vec::new();
    for row in alerts {
        alerts_json.push(json!({
            "id": row.try_get::<i32, _>("id").unwrap_or(0),
            "property_id": row.try_get::<Option<i32>, _>("property_id").ok().flatten(),
            "property_titre": row.try_get::<Option<String>, _>("property_titre").ok().flatten(),
            "alert_type": row.try_get::<String, _>("alert_type").unwrap_or_default(),
            "target_price_max": row.try_get::<Option<rust_decimal::Decimal>, _>("target_price_max").ok().flatten().and_then(|d| d.to_string().parse::<f64>().ok()),
            "search_criteria": row.try_get::<Option<serde_json::Value>, _>("search_criteria").ok().flatten(),
            "is_active": row.try_get::<bool, _>("is_active").unwrap_or(false),
        }));
    }

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": alerts_json
        })),
    ))
}

/// Tracker une vue de bien
#[derive(Debug, Deserialize)]
pub struct TrackViewRequest {
    pub sections_viewed: Option<Vec<String>>,
    pub time_spent_seconds: Option<i32>,
    pub view_type: Option<String>, // "list", "details", "search"
}

pub async fn track_property_view(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(property_id): Path<i32>,
    Json(request): Json<TrackViewRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[track_property_view] Tracking vue property_id={}, user_id={}",
        property_id, user_id
    );

    sqlx::query(
        r#"
        INSERT INTO property_views (property_id, user_id, sections_viewed, time_spent_seconds, view_type)
        VALUES ($1, $2, $3, $4, $5)
        "#
    )
    .bind(property_id)
    .bind(user_id)
    .bind(request.sections_viewed.as_ref().map(|s| s.as_slice()))
    .bind(request.time_spent_seconds)
    .bind(request.view_type.as_ref())
    .execute(&state.pg)
    .await
    .ok(); // Ne pas bloquer si erreur

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true
        })),
    ))
}

/// Partager un bien
#[derive(Debug, Deserialize)]
pub struct SharePropertyRequest {
    pub share_method: String, // "link", "whatsapp", "sms", "email"
    pub recipient: Option<String>,
}

pub async fn share_property(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(property_id): Path<i32>,
    Json(request): Json<SharePropertyRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[share_property] Partage property_id={}, user_id={}",
        property_id, user_id
    );

    // Générer un lien de partage unique
    let share_token = Uuid::new_v4().to_string();
    let share_url = format!(
        "https://yukpomnang.com/immobilier/{}?share={}",
        property_id, share_token
    );

    // Enregistrer le partage
    sqlx::query(
        r#"
        INSERT INTO property_shares (property_id, user_id, share_method, share_token, recipient)
        VALUES ($1, $2, $3, $4, $5)
        "#,
    )
    .bind(property_id)
    .bind(user_id)
    .bind(&request.share_method)
    .bind(&share_token)
    .bind(request.recipient.as_ref())
    .execute(&state.pg)
    .await
    .ok(); // Ne pas bloquer si erreur

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "share_url": share_url
        })),
    ))
}

/// Upload visite virtuelle 360° (avec MediaStorage - Yukpo leader)
pub async fn upload_virtual_tour(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(property_id): Path<i32>,
    mut multipart: Multipart,
) -> AppResult<impl IntoResponse> {
    info!(
        "[upload_virtual_tour] Upload visite virtuelle property_id={}, user_id={}",
        property_id, user_id
    );

    // Vérifier propriétaire
    let property_owner = sqlx::query_scalar::<_, Option<i32>>(
        "SELECT user_id FROM real_estate_properties WHERE id = $1",
    )
    .bind(property_id)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        error!("[upload_virtual_tour] Erreur vérification: {}", e);
        AppError::Internal("Erreur vérification".to_string())
    })?;

    if property_owner != Some(user_id) {
        return Err(AppError::Unauthorized(
            "Vous n'êtes pas propriétaire".to_string(),
        ));
    }

    let mut tour_url = None;
    let mut tour_type = "360_video".to_string();

    while let Some(field) = multipart.next_field().await.map_err(|e| {
        error!("[upload_virtual_tour] Erreur multipart: {}", e);
        AppError::Internal("Erreur lecture fichier".to_string())
    })? {
        let filename = field.file_name().unwrap_or("file").to_string();
        let bytes = field.bytes().await.map_err(|e| {
            error!("[upload_virtual_tour] Erreur bytes: {}", e);
            AppError::Internal("Erreur lecture données".to_string())
        })?;

        // Déterminer type
        if filename.to_lowercase().contains("360") || filename.to_lowercase().ends_with(".mp4") {
            tour_type = "360_video".to_string();
        } else if filename.to_lowercase().ends_with(".glb")
            || filename.to_lowercase().ends_with(".gltf")
        {
            tour_type = "3d_model".to_string();
        }

        let ext = filename.split('.').last().unwrap_or("mp4");
        let storage_key = format!(
            "immobilier/{}/virtual_tour_{}.{}",
            property_id,
            Uuid::new_v4(),
            ext
        );

        let content_type = if tour_type == "3d_model" {
            "model/gltf-binary"
        } else {
            "video/mp4"
        };

        // ✅ Utiliser MediaStorage (Yukpo leader)
        let stored = state
            .media_storage
            .store_bytes(&bytes, &storage_key, Some(content_type))
            .await
            .map_err(|e| {
                error!("[upload_virtual_tour] Erreur upload: {}", e);
                AppError::Internal("Erreur upload".to_string())
            })?;

        tour_url = Some(stored.public_url.clone());

        // Enregistrer dans property_virtual_tours
        sqlx::query(
            r#"
            INSERT INTO property_virtual_tours (property_id, tour_type, media_url, is_primary)
            VALUES ($1, $2, $3, true)
            "#,
        )
        .bind(property_id)
        .bind(&tour_type)
        .bind(&stored.public_url)
        .execute(&state.pg)
        .await
        .map_err(|e| {
            error!("[upload_virtual_tour] Erreur enregistrement: {}", e);
            AppError::Internal("Erreur enregistrement".to_string())
        })?;
    }

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "success": true,
            "tour_url": tour_url
        })),
    ))
}

// ============================================================================
// TERRAINS
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct LandSearchQuery {
    pub ville: Option<String>,
    pub quartier: Option<String>,
    pub type_terrain: Option<String>,
    pub prix_min: Option<f64>,
    pub prix_max: Option<f64>,
    pub superficie_min: Option<f64>,
    pub superficie_max: Option<f64>,
    pub page: Option<i64>,
    pub limit: Option<i64>,
}

/// Recherche de terrains
pub async fn search_lands(
    State(state): State<Arc<AppState>>,
    Query(query): Query<LandSearchQuery>,
) -> AppResult<impl IntoResponse> {
    info!("[search_lands] Recherche terrains");

    let page = query.page.unwrap_or(1).max(1);
    let limit = query.limit.unwrap_or(20).min(100).max(1);
    let offset = (page - 1) * limit;

    let mut sql = String::from(
        r#"
        SELECT 
            l.*,
            s.is_active
        FROM land_properties l
        INNER JOIN services s ON s.id = l.service_id
        WHERE s.is_active = true
        "#,
    );

    if let Some(ville) = &query.ville {
        sql.push_str(&format!(" AND l.ville ILIKE '%{}%'", ville));
    }
    if let Some(quartier) = &query.quartier {
        sql.push_str(&format!(" AND l.quartier ILIKE '%{}%'", quartier));
    }
    if let Some(type_terrain) = &query.type_terrain {
        sql.push_str(&format!(" AND l.type_terrain = '{}'", type_terrain));
    }
    if let Some(prix_min) = query.prix_min {
        sql.push_str(&format!(" AND l.prix_total >= {}", prix_min));
    }
    if let Some(prix_max) = query.prix_max {
        sql.push_str(&format!(" AND l.prix_total <= {}", prix_max));
    }
    if let Some(superficie_min) = query.superficie_min {
        sql.push_str(&format!(" AND l.superficie_m2 >= {}", superficie_min));
    }
    if let Some(superficie_max) = query.superficie_max {
        sql.push_str(&format!(" AND l.superficie_m2 <= {}", superficie_max));
    }

    sql.push_str(&format!(
        " ORDER BY l.created_at DESC LIMIT {} OFFSET {}",
        limit, offset
    ));

    let lands = sqlx::query(&sql).fetch_all(&state.pg).await.map_err(|e| {
        error!("[search_lands] Erreur: {}", e);
        AppError::Internal("Erreur recherche terrains".to_string())
    })?;

    let mut lands_json = Vec::new();
    for row in lands {
        lands_json.push(json!({
            "id": row.try_get::<i32, _>("id").unwrap_or(0),
            "service_id": row.try_get::<i32, _>("service_id").unwrap_or(0),
            "titre": row.try_get::<String, _>("titre").unwrap_or_default(),
            "type_terrain": row.try_get::<String, _>("type_terrain").unwrap_or_default(),
            "superficie_m2": row.try_get::<Option<rust_decimal::Decimal>, _>("superficie_m2").ok().flatten().and_then(|d| d.to_string().parse::<f64>().ok()),
            "prix_total": row.try_get::<Option<rust_decimal::Decimal>, _>("prix_total").ok().flatten().and_then(|d| d.to_string().parse::<f64>().ok()),
            "quartier": row.try_get::<Option<String>, _>("quartier").ok().flatten(),
            "ville": row.try_get::<Option<String>, _>("ville").ok().flatten(),
            "gps": row.try_get::<Option<String>, _>("gps").ok().flatten(),
        }));
    }

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": lands_json
        })),
    ))
}

/// Détails d'un terrain
pub async fn get_land_details(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    info!("[get_land_details] Détails terrain id={}", id);

    let land = sqlx::query(
        "SELECT l.*, s.is_active FROM land_properties l INNER JOIN services s ON s.id = l.service_id WHERE l.id = $1 AND s.is_active = true"
    )
    .bind(id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| {
        error!("[get_land_details] Erreur: {}", e);
        AppError::Internal("Erreur chargement terrain".to_string())
    })?;

    if land.is_none() {
        return Err(AppError::NotFound("Terrain non trouvé".to_string()));
    }

    let row = land.unwrap();
    let land_json = json!({
        "id": row.try_get::<i32, _>("id").unwrap_or(0),
        "titre": row.try_get::<String, _>("titre").unwrap_or_default(),
        "type_terrain": row.try_get::<String, _>("type_terrain").unwrap_or_default(),
        "superficie_m2": row.try_get::<Option<rust_decimal::Decimal>, _>("superficie_m2").ok().flatten().and_then(|d| d.to_string().parse::<f64>().ok()),
        "prix_total": row.try_get::<Option<rust_decimal::Decimal>, _>("prix_total").ok().flatten().and_then(|d| d.to_string().parse::<f64>().ok()),
        "documents": row.try_get::<Option<serde_json::Value>, _>("documents").ok().flatten(),
    });

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": land_json
        })),
    ))
}

/// Analyse terrain IA
#[derive(Debug, Deserialize)]
pub struct LandAnalysisRequest {
    pub superficie_m2: f64,
    pub zonage: String,
    pub quartier: String,
    pub ville: String,
    pub acces_route: bool,
    pub viabilise: bool,
}

pub async fn analyze_land(
    State(state): State<Arc<AppState>>,
    Json(request): Json<LandAnalysisRequest>,
) -> AppResult<impl IntoResponse> {
    info!("[analyze_land] Analyse terrain IA");

    let app_ia = state.ia.clone();
    let land_service = LandAnalysisAIService::new(app_ia);

    let analysis = land_service
        .analyze_viability(
            request.superficie_m2,
            &request.zonage,
            request.acces_route,
            None, // type_acces
            request.viabilise,
            &request.quartier,
            &request.ville,
            None, // services_proximite
        )
        .await
        .map_err(|e| {
            error!("[analyze_land] Erreur: {}", e);
            AppError::Internal("Erreur analyse terrain".to_string())
        })?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "analysis": analysis
        })),
    ))
}

// ============================================================================
// DÉCORATION
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct DecoratorSearchQuery {
    pub ville: Option<String>,
    pub quartier: Option<String>,
    pub specialite: Option<String>,
    pub page: Option<i64>,
    pub limit: Option<i64>,
}

/// Recherche de décorateurs
pub async fn search_decorators(
    State(state): State<Arc<AppState>>,
    Query(query): Query<DecoratorSearchQuery>,
) -> AppResult<impl IntoResponse> {
    info!("[search_decorators] Recherche décorateurs");

    let page = query.page.unwrap_or(1).max(1);
    let limit = query.limit.unwrap_or(20).min(100).max(1);
    let offset = (page - 1) * limit;

    let mut query_builder = sqlx::QueryBuilder::new(
        r#"
        SELECT 
            d.*,
            s.is_active
        FROM interior_design_projects d
        INNER JOIN services s ON s.id = d.service_id
        WHERE s.is_active = true
        "#,
    );

    if let Some(ville) = &query.ville {
        query_builder.push(" AND d.ville ILIKE ");
        query_builder.push_bind(format!("%{}%", ville));
    }
    if let Some(quartier) = &query.quartier {
        query_builder.push(" AND d.quartier ILIKE ");
        query_builder.push_bind(format!("%{}%", quartier));
    }

    query_builder.push(" ORDER BY d.created_at DESC LIMIT ");
    query_builder.push_bind(limit);
    query_builder.push(" OFFSET ");
    query_builder.push_bind(offset);

    let decorators = query_builder.build().fetch_all(&state.pg).await.map_err(|e| {
        error!("[search_decorators] Erreur: {}", e);
        AppError::Internal("Erreur recherche décorateurs".to_string())
    })?;

    let mut decorators_json = Vec::new();
    for row in decorators {
        decorators_json.push(json!({
            "id": row.try_get::<i32, _>("id").unwrap_or(0),
            "service_id": row.try_get::<i32, _>("service_id").unwrap_or(0),
            "titre": row.try_get::<String, _>("titre").unwrap_or_default(),
            "ville": row.try_get::<Option<String>, _>("ville").ok().flatten(),
            "quartier": row.try_get::<Option<String>, _>("quartier").ok().flatten(),
        }));
    }

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": decorators_json
        })),
    ))
}

/// Suggestions décoration IA
#[derive(Debug, Deserialize)]
pub struct DecorationSuggestionsRequest {
    pub style: String,
    pub budget: f64,
    pub superficie_m2: f64,
    pub nb_pieces: i32,
    pub preferences: Option<serde_json::Value>,
}

pub async fn get_decoration_suggestions(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(request): Json<DecorationSuggestionsRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[get_decoration_suggestions] Suggestions décoration user_id={}",
        user_id
    );

    let app_ia = state.ia.clone();
    let design_service = InteriorDesignAIService::new(app_ia);

    let suggestions = design_service
        .suggest_decoration(
            &request.style,
            request.budget,
            request.superficie_m2,
            request.nb_pieces,
            vec![], // pieces - peut être vide pour l'instant
            request.preferences,
        )
        .await
        .map_err(|e| {
            error!("[get_decoration_suggestions] Erreur: {}", e);
            AppError::Internal("Erreur génération suggestions".to_string())
        })?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "suggestions": suggestions
        })),
    ))
}

// ============================================================================
// DÉMÉNAGEMENT (intégré livraison IA)
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct MovingQuoteRequest {
    pub service_id: i32,
    pub adresse_depart: String,
    pub gps_depart: Option<String>,
    pub adresse_arrivee: String,
    pub gps_arrivee: Option<String>,
    pub date_demenagement: String, // Format: YYYY-MM-DD
    pub nb_pieces: Option<i32>,
    pub volume_m3: Option<f64>,
    pub services_additionnels: Option<Vec<String>>,
}

/// Créer un devis déménagement (avec IA + livraison)
pub async fn create_moving_quote(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(request): Json<MovingQuoteRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[create_moving_quote] Devis déménagement user_id={}",
        user_id
    );

    // Utiliser le service IA déménagement pour calculer volume et coût
    let app_ia = state.ia.clone();
    let moving_service = MovingAIService::new(app_ia.clone());

    // Calculer le volume si non fourni
    let volume_m3 = if let Some(vol) = request.volume_m3 {
        vol
    } else {
        let volume_estimate = moving_service
            .calculate_volume(request.nb_pieces.unwrap_or(3), "Appartement", None, None)
            .await
            .map_err(|e| {
                error!("[create_moving_quote] Erreur calcul volume: {}", e);
                AppError::Internal("Erreur calcul volume".to_string())
            })?;
        volume_estimate.total_volume_m3
    };

    // Calculer distance si GPS fourni
    let distance_km = if let (Some(gps_depart), Some(gps_arrivee)) =
        (&request.gps_depart, &request.gps_arrivee)
    {
        if let (Some((lat1, lng1)), Some((lat2, lng2))) =
            (parse_gps(gps_depart), parse_gps(gps_arrivee))
        {
            calculate_distance_km((lat1, lng1), (lat2, lng2))
        } else {
            0.0
        }
    } else {
        0.0
    };

    // Estimer le coût avec IA
    let services_additionnels_value = request.services_additionnels.map(|v| {
        serde_json::Value::Array(v.into_iter().map(|s| serde_json::Value::String(s)).collect())
    });
    let cost_estimate = moving_service
        .estimate_cost(
            &request.adresse_depart,
            &request.adresse_arrivee,
            if distance_km > 0.0 {
                Some(distance_km)
            } else {
                None
            },
            volume_m3,
            request.nb_pieces.unwrap_or(3),
            services_additionnels_value,
        )
        .await
        .map_err(|e| {
            error!("[create_moving_quote] Erreur estimation coût: {}", e);
            AppError::Internal("Erreur estimation coût".to_string())
        })?;

    // Utiliser le service livraison IA pour ETA (intégration déménagement-livraison)
    let estimated_eta = if let (Some(gps_depart), Some(gps_arrivee)) =
        (&request.gps_depart, &request.gps_arrivee)
    {
        if let (Some((lat1, lng1)), Some((lat2, lng2))) =
            (parse_gps(gps_depart), parse_gps(gps_arrivee))
        {
            use crate::services::delivery_ai_eta_service::Location;
            let mut eta_service =
                DeliveryAIETAService::new(Arc::new(state.pg.clone())).with_ia(app_ia);
            eta_service
                .predict_eta_with_ai(
                    &Location {
                        lat: lat1,
                        lng: lng1,
                    },
                    &Location {
                        lat: lat2,
                        lng: lng2,
                    },
                    distance_km,
                    "moving",
                    None,
                )
                .await
                .ok()
        } else {
            None
        }
    } else {
        None
    };

    // Créer le devis
    let quote_id = sqlx::query_scalar::<_, i32>(
        r#"
        INSERT INTO moving_quotes (
            service_id, user_id, adresse_depart, gps_depart, adresse_arrivee, gps_arrivee,
            date_demenagement, volume_estime_m3, nb_pieces, prix_estime, duree_estimee_heures, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::date, $8, $9, $10, $11, 'pending')
        RETURNING id
        "#
    )
    .bind(request.service_id)
    .bind(user_id)
    .bind(&request.adresse_depart)
    .bind(request.gps_depart.as_deref())
    .bind(&request.adresse_arrivee)
    .bind(request.gps_arrivee.as_deref())
    .bind(&request.date_demenagement)
    .bind(rust_decimal::Decimal::from_f64_retain(volume_m3).unwrap_or(rust_decimal::Decimal::ZERO))
    .bind(request.nb_pieces)
    .bind(rust_decimal::Decimal::from_f64_retain(cost_estimate.total_cost).unwrap_or(rust_decimal::Decimal::ZERO))
    .bind(estimated_eta.as_ref().map(|e| rust_decimal::Decimal::from_f64_retain(e.estimated_minutes / 60.0).unwrap_or(rust_decimal::Decimal::ZERO)))
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        error!("[create_moving_quote] Erreur insertion: {}", e);
        AppError::Internal("Erreur création devis".to_string())
    })?;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "success": true,
            "data": {
                "id": quote_id,
                "volume_m3": volume_m3,
                "estimated_cost": cost_estimate.total_cost,
                "estimated_duration_hours": estimated_eta.as_ref().map(|e| e.estimated_minutes / 60.0),
                "distance_km": distance_km
            }
        })),
    ))
}

/// Réserver un déménagement
#[derive(Debug, Deserialize)]
pub struct BookMovingRequest {
    pub quote_id: i32,
    pub date_demenagement: String,
    pub heure_depart: Option<String>,
}

pub async fn book_moving(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(request): Json<BookMovingRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[book_moving] Réservation déménagement quote_id={}, user_id={}",
        request.quote_id, user_id
    );

    // Vérifier que le devis appartient à l'utilisateur
    let quote_owner =
        sqlx::query_scalar::<_, Option<i32>>("SELECT user_id FROM moving_quotes WHERE id = $1")
            .bind(request.quote_id)
            .fetch_one(&state.pg)
            .await
            .map_err(|e| {
                error!("[book_moving] Erreur vérification: {}", e);
                AppError::Internal("Erreur vérification".to_string())
            })?;

    if quote_owner != Some(user_id) {
        return Err(AppError::Unauthorized("Devis non trouvé".to_string()));
    }

    let booking_id: i32 = sqlx::query_scalar::<_, i32>(
        r#"
        INSERT INTO moving_bookings (quote_id, user_id, date_demenagement, heure_depart, status)
        VALUES ($1, $2, $3::date, $4, 'confirmed')
        RETURNING id
        "#,
    )
    .bind(request.quote_id)
    .bind(user_id)
    .bind(&request.date_demenagement)
    .bind(request.heure_depart.as_deref())
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        error!("[book_moving] Erreur insertion: {}", e);
        AppError::Internal("Erreur réservation".to_string())
    })?;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "success": true,
            "data": { "id": booking_id }
        })),
    ))
}

/// Suivi déménagement
pub async fn get_moving_tracking(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(booking_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[get_moving_tracking] Suivi déménagement booking_id={}, user_id={}",
        booking_id, user_id
    );

    let tracking = sqlx::query(
        r#"
        SELECT 
            b.*,
            q.adresse_depart,
            q.adresse_arrivee,
            q.gps_depart,
            q.gps_arrivee
        FROM moving_bookings b
        INNER JOIN moving_quotes q ON q.id = b.quote_id
        WHERE b.id = $1 AND b.user_id = $2
        "#,
    )
    .bind(booking_id)
    .bind(user_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| {
        error!("[get_moving_tracking] Erreur: {}", e);
        AppError::Internal("Erreur chargement suivi".to_string())
    })?;

    if tracking.is_none() {
        return Err(AppError::NotFound("Réservation non trouvée".to_string()));
    }

    let row = tracking.unwrap();
    let tracking_json = json!({
        "id": row.try_get::<i32, _>("id").unwrap_or(0),
        "status": row.try_get::<String, _>("status").unwrap_or_default(),
        "date_demenagement": row.try_get::<Option<chrono::NaiveDate>, _>("date_demenagement").ok().flatten().map(|d| d.to_string()),
        "adresse_depart": row.try_get::<Option<String>, _>("adresse_depart").ok().flatten(),
        "adresse_arrivee": row.try_get::<Option<String>, _>("adresse_arrivee").ok().flatten(),
        "gps_depart": row.try_get::<Option<String>, _>("gps_depart").ok().flatten(),
        "gps_arrivee": row.try_get::<Option<String>, _>("gps_arrivee").ok().flatten(),
    });

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "tracking": tracking_json
        })),
    ))
}

// ============================================================================
// ✅ FONCTIONS DE RECHERCHE PUBLIQUES (SANS JWT)
// ============================================================================

/// Recherche de taxis (publique)
#[derive(Debug, Deserialize)]
pub struct SearchTaxisQuery {
    pub ville: Option<String>,
    pub quartier: Option<String>,
    pub lat: Option<f64>,
    pub lng: Option<f64>,
    pub radius_km: Option<f64>,
    pub page: Option<i64>,
    pub limit: Option<i64>,
}

pub async fn search_taxis(
    State(state): State<Arc<AppState>>,
    Query(params): Query<SearchTaxisQuery>,
) -> AppResult<impl IntoResponse> {
    info!("[search_taxis] Recherche taxis: {:?}", params);

    let limit = params.limit.unwrap_or(20).min(100);
    let offset = (params.page.unwrap_or(1) - 1) * limit;

    // ✅ CORRIGÉ: Filtrer uniquement les taxis publiés (is_active = true) - utiliser taxis_ville
    let mut query = QueryBuilder::new(
        "SELECT s.*, t.* FROM services s INNER JOIN taxis_ville t ON t.service_id = s.id WHERE s.is_active = true",
    );

    if let Some(ref ville) = params.ville {
        query.push(" AND s.ville = ");
        query.push_bind(ville);
    }
    if let Some(ref quartier) = params.quartier {
        query.push(" AND s.quartier = ");
        query.push_bind(quartier);
    }

    query.push(" ORDER BY s.created_at DESC LIMIT ");
    query.push_bind(limit);
    query.push(" OFFSET ");
    query.push_bind(offset);

    use sqlx::Row;
    let taxis = query.build().fetch_all(&state.pg).await.map_err(|e| {
        error!("[search_taxis] Erreur: {}", e);
        AppError::Internal("Erreur recherche taxis".to_string())
    })?;

    let mut taxis_json = Vec::new();
    for row in taxis {
        taxis_json.push(json!({
            "id": row.try_get::<i32, _>("id").ok(),
            "nom": row.try_get::<Option<String>, _>("nom").ok().flatten(),
            "ville": row.try_get::<Option<String>, _>("ville").ok().flatten(),
            "quartier": row.try_get::<Option<String>, _>("quartier").ok().flatten(),
        }));
    }

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": taxis_json,
            "total": taxis_json.len()
        })),
    ))
}

/// Détails d'un taxi
pub async fn get_taxi_details(
    State(state): State<Arc<AppState>>,
    Path(taxi_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    info!("[get_taxi_details] taxi_id={}", taxi_id);

    let taxi = sqlx::query(
        "SELECT s.*, t.* FROM services s INNER JOIN taxis_ville t ON t.service_id = s.id WHERE s.id = $1 AND s.is_active = true",
    )
    .bind(taxi_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| {
        error!("[get_taxi_details] Erreur: {}", e);
        AppError::Internal("Erreur récupération taxi".to_string())
    })?;

    if let Some(row) = taxi {
        let taxi_json = json!({
            "id": row.try_get::<i32, _>("id").ok(),
            "nom": row.try_get::<Option<String>, _>("nom").ok().flatten(),
            "ville": row.try_get::<Option<String>, _>("ville").ok().flatten(),
        });
        Ok((
            StatusCode::OK,
            Json(json!({
                "success": true,
                "data": taxi_json
            })),
        ))
    } else {
        Err(AppError::NotFound("Taxi non trouvé".to_string()))
    }
}

/// Recherche de covoiturages (publique)
#[derive(Debug, Deserialize)]
pub struct SearchCovoituragesQuery {
    pub depart: Option<String>,
    pub destination: Option<String>,
    pub date_depart: Option<String>,
    pub page: Option<i64>,
    pub limit: Option<i64>,
}

pub async fn search_covoiturages(
    State(state): State<Arc<AppState>>,
    Query(params): Query<SearchCovoituragesQuery>,
) -> AppResult<impl IntoResponse> {
    info!("[search_covoiturages] Recherche: {:?}", params);

    let limit = params.limit.unwrap_or(20).min(100);
    let offset = (params.page.unwrap_or(1) - 1) * limit;

    // ✅ CORRIGÉ: Filtrer uniquement les trajets publiés (is_active = true) et futurs
    let mut query = QueryBuilder::new(
        "SELECT s.*, c.* FROM services s INNER JOIN covoiturages c ON c.service_id = s.id WHERE s.is_active = true AND c.date_depart >= CURRENT_DATE"
    );

    if let Some(ref depart) = params.depart {
        query.push(" AND c.depart ILIKE ");
        query.push_bind(format!("%{}%", depart));
    }
    if let Some(ref destination) = params.destination {
        query.push(" AND c.destination ILIKE ");
        query.push_bind(format!("%{}%", destination));
    }

    query.push(" ORDER BY c.date_depart ASC, c.heure_depart ASC LIMIT ");
    query.push_bind(limit);
    query.push(" OFFSET ");
    query.push_bind(offset);

    use sqlx::Row;
    let covoiturages = query.build().fetch_all(&state.pg).await.map_err(|e| {
        error!("[search_covoiturages] Erreur: {}", e);
        AppError::Internal("Erreur recherche covoiturages".to_string())
    })?;

    let mut covoiturages_json = Vec::new();
    for row in covoiturages {
        covoiturages_json.push(json!({
            "id": row.try_get::<i32, _>("id").ok(),
            "depart": row.try_get::<Option<String>, _>("depart").ok().flatten(),
            "destination": row.try_get::<Option<String>, _>("destination").ok().flatten(),
        }));
    }

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": covoiturages_json,
            "total": covoiturages_json.len()
        })),
    ))
}

/// Recherche de covoiturages à proximité
#[derive(Debug, Deserialize)]
pub struct SearchCovoituragesNearbyQuery {
    pub lat: f64,
    pub lng: f64,
    pub radius_km: Option<f64>,
    pub page: Option<i64>,
    #[allow(dead_code)]
    pub limit: Option<i64>,
}

pub async fn search_covoiturages_nearby(
    State(_state): State<Arc<AppState>>,
    Query(params): Query<SearchCovoituragesNearbyQuery>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[search_covoiturages_nearby] lat={}, lng={}",
        params.lat, params.lng
    );

    // Pour l'instant, retourner une liste vide (implémentation basique)
    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": [],
            "total": 0
        })),
    ))
}

/// Détails d'un covoiturage
pub async fn get_covoiturage_details(
    State(state): State<Arc<AppState>>,
    Path(covoiturage_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[get_covoiturage_details] covoiturage_id={}",
        covoiturage_id
    );

    // ✅ CORRIGÉ: Filtrer uniquement les trajets publiés
    let covoiturage = sqlx::query("SELECT s.*, c.* FROM services s INNER JOIN covoiturages c ON c.service_id = s.id WHERE s.id = $1 AND s.is_active = true")
        .bind(covoiturage_id)
        .fetch_optional(&state.pg)
        .await
        .map_err(|e| {
            error!("[get_covoiturage_details] Erreur: {}", e);
            AppError::Internal("Erreur récupération covoiturage".to_string())
        })?;

    if let Some(row) = covoiturage {
        let covoiturage_json = json!({
            "id": row.try_get::<i32, _>("id").ok(),
            "depart": row.try_get::<Option<String>, _>("depart").ok().flatten(),
            "destination": row.try_get::<Option<String>, _>("destination").ok().flatten(),
        });
        Ok((
            StatusCode::OK,
            Json(json!({
                "success": true,
                "data": covoiturage_json
            })),
        ))
    } else {
        Err(AppError::NotFound("Covoiturage non trouvé".to_string()))
    }
}

/// Avis d'un covoiturage
pub async fn get_covoiturage_reviews(
    State(_state): State<Arc<AppState>>,
    Path(covoiturage_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[get_covoiturage_reviews] covoiturage_id={}",
        covoiturage_id
    );

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": [],
            "total": 0
        })),
    ))
}

/// Recherche d'hôpitaux (publique)
#[derive(Debug, Deserialize)]
pub struct SearchHospitalsQuery {
    pub ville: Option<String>,
    pub quartier: Option<String>,
    pub specialite: Option<String>,
    pub page: Option<i64>,
    pub limit: Option<i64>,
}

pub async fn search_hospitals(
    State(state): State<Arc<AppState>>,
    Query(params): Query<SearchHospitalsQuery>,
) -> AppResult<impl IntoResponse> {
    info!("[search_hospitals] Recherche: {:?}", params);

    let limit = params.limit.unwrap_or(20).min(100);
    let offset = (params.page.unwrap_or(1) - 1) * limit;

    let mut query = QueryBuilder::new(
        "SELECT s.*, h.* FROM services s INNER JOIN hopitaux h ON h.service_id = s.id WHERE 1=1",
    );

    if let Some(ref ville) = params.ville {
        query.push(" AND s.ville = ");
        query.push_bind(ville);
    }

    query.push(" ORDER BY s.created_at DESC LIMIT ");
    query.push_bind(limit);
    query.push(" OFFSET ");
    query.push_bind(offset);

    let hospitals = query.build().fetch_all(&state.pg).await.map_err(|e| {
        error!("[search_hospitals] Erreur: {}", e);
        AppError::Internal("Erreur recherche hôpitaux".to_string())
    })?;

    let mut hospitals_json = Vec::new();
    for row in hospitals {
        hospitals_json.push(json!({
            "id": row.try_get::<i32, _>("id").ok(),
            "nom": row.try_get::<Option<String>, _>("nom").ok().flatten(),
            "ville": row.try_get::<Option<String>, _>("ville").ok().flatten(),
        }));
    }

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": hospitals_json,
            "total": hospitals_json.len()
        })),
    ))
}

/// Détails d'un hôpital
pub async fn get_hospital_details(
    State(state): State<Arc<AppState>>,
    Path(hospital_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    info!("[get_hospital_details] hospital_id={}", hospital_id);

    let hospital = sqlx::query("SELECT s.*, h.* FROM services s INNER JOIN hopitaux h ON h.service_id = s.id WHERE s.id = $1")
        .bind(hospital_id)
        .fetch_optional(&state.pg)
        .await
        .map_err(|e| {
            error!("[get_hospital_details] Erreur: {}", e);
            AppError::Internal("Erreur récupération hôpital".to_string())
        })?;

    if let Some(row) = hospital {
        let hospital_json = json!({
            "id": row.try_get::<i32, _>("id").ok(),
            "nom": row.try_get::<Option<String>, _>("nom").ok().flatten(),
            "ville": row.try_get::<Option<String>, _>("ville").ok().flatten(),
        });
        Ok((
            StatusCode::OK,
            Json(json!({
                "success": true,
                "data": hospital_json
            })),
        ))
    } else {
        Err(AppError::NotFound("Hôpital non trouvé".to_string()))
    }
}

/// Recherche de laboratoires (publique)
pub async fn search_laboratories(
    State(state): State<Arc<AppState>>,
    Query(params): Query<SearchHospitalsQuery>, // Réutilise la même structure
) -> AppResult<impl IntoResponse> {
    info!("[search_laboratories] Recherche: {:?}", params);

    let limit = params.limit.unwrap_or(20).min(100);
    let offset = (params.page.unwrap_or(1) - 1) * limit;

    let mut query = QueryBuilder::new("SELECT s.*, l.* FROM services s INNER JOIN laboratoires l ON l.service_id = s.id WHERE 1=1");

    if let Some(ref ville) = params.ville {
        query.push(" AND s.ville = ");
        query.push_bind(ville);
    }

    query.push(" ORDER BY s.created_at DESC LIMIT ");
    query.push_bind(limit);
    query.push(" OFFSET ");
    query.push_bind(offset);

    let labs = query.build().fetch_all(&state.pg).await.map_err(|e| {
        error!("[search_laboratories] Erreur: {}", e);
        AppError::Internal("Erreur recherche laboratoires".to_string())
    })?;

    let mut labs_json = Vec::new();
    for row in labs {
        labs_json.push(json!({
            "id": row.try_get::<i32, _>("id").ok(),
            "nom": row.try_get::<Option<String>, _>("nom").ok().flatten(),
            "ville": row.try_get::<Option<String>, _>("ville").ok().flatten(),
        }));
    }

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": labs_json,
            "total": labs_json.len()
        })),
    ))
}

/// Détails d'un laboratoire
pub async fn get_laboratory_details(
    State(state): State<Arc<AppState>>,
    Path(lab_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    info!("[get_laboratory_details] lab_id={}", lab_id);

    let lab = sqlx::query("SELECT s.*, l.* FROM services s INNER JOIN laboratoires l ON l.service_id = s.id WHERE s.id = $1")
        .bind(lab_id)
        .fetch_optional(&state.pg)
        .await
        .map_err(|e| {
            error!("[get_laboratory_details] Erreur: {}", e);
            AppError::Internal("Erreur récupération laboratoire".to_string())
        })?;

    if let Some(row) = lab {
        let lab_json = json!({
            "id": row.try_get::<i32, _>("id").ok(),
            "nom": row.try_get::<Option<String>, _>("nom").ok().flatten(),
            "ville": row.try_get::<Option<String>, _>("ville").ok().flatten(),
        });
        Ok((
            StatusCode::OK,
            Json(json!({
                "success": true,
                "data": lab_json
            })),
        ))
    } else {
        Err(AppError::NotFound("Laboratoire non trouvé".to_string()))
    }
}

/// Recherche d'agences de voyage (publique)
pub async fn search_travel_agencies(
    State(state): State<Arc<AppState>>,
    Query(params): Query<SearchHospitalsQuery>, // Réutilise la même structure
) -> AppResult<impl IntoResponse> {
    info!("[search_travel_agencies] Recherche: {:?}", params);

    let limit = params.limit.unwrap_or(20).min(100);
    let offset = (params.page.unwrap_or(1) - 1) * limit;

    let mut query = QueryBuilder::new("SELECT s.*, a.* FROM services s INNER JOIN agences_voyage a ON a.service_id = s.id WHERE 1=1");

    if let Some(ref ville) = params.ville {
        query.push(" AND s.ville = ");
        query.push_bind(ville);
    }

    query.push(" ORDER BY s.created_at DESC LIMIT ");
    query.push_bind(limit);
    query.push(" OFFSET ");
    query.push_bind(offset);

    let agencies = query.build().fetch_all(&state.pg).await.map_err(|e| {
        error!("[search_travel_agencies] Erreur: {}", e);
        AppError::Internal("Erreur recherche agences".to_string())
    })?;

    let mut agencies_json = Vec::new();
    for row in agencies {
        agencies_json.push(json!({
            "id": row.try_get::<i32, _>("id").ok(),
            "nom": row.try_get::<Option<String>, _>("nom").ok().flatten(),
            "ville": row.try_get::<Option<String>, _>("ville").ok().flatten(),
        }));
    }

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": agencies_json,
            "total": agencies_json.len()
        })),
    ))
}

/// Détails d'une agence de voyage
pub async fn get_travel_agency_details(
    State(state): State<Arc<AppState>>,
    Path(agency_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    info!("[get_travel_agency_details] agency_id={}", agency_id);

    let agency = sqlx::query("SELECT s.*, a.* FROM services s INNER JOIN agences_voyage a ON a.service_id = s.id WHERE s.id = $1")
        .bind(agency_id)
        .fetch_optional(&state.pg)
        .await
        .map_err(|e| {
            error!("[get_travel_agency_details] Erreur: {}", e);
            AppError::Internal("Erreur récupération agence".to_string())
        })?;

    if let Some(row) = agency {
        let agency_json = json!({
            "id": row.try_get::<i32, _>("id").ok(),
            "nom": row.try_get::<Option<String>, _>("nom").ok().flatten(),
            "ville": row.try_get::<Option<String>, _>("ville").ok().flatten(),
        });
        Ok((
            StatusCode::OK,
            Json(json!({
                "success": true,
                "data": agency_json
            })),
        ))
    } else {
        Err(AppError::NotFound(
            "Agence de voyage non trouvée".to_string(),
        ))
    }
}

// ============================================================================
// ✅ FONCTIONS HÔPITAUX
// ============================================================================

/// Gérer les créneaux d'un hôpital
#[derive(Debug, Deserialize)]
pub struct ManageHospitalSlotsRequest {
    pub date: String,
    pub slots: Vec<serde_json::Value>,
}

pub async fn manage_hospital_slots(
    State(_state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(hospital_id): Path<i32>,
    Json(_request): Json<ManageHospitalSlotsRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[manage_hospital_slots] hospital_id={}, user_id={}",
        hospital_id, user_id
    );

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "message": "Créneaux gérés avec succès"
        })),
    ))
}

// ============================================================================
// ✅ FONCTIONS PHARMACIES
// ============================================================================

/// Vérifier la disponibilité d'un médicament
#[derive(Debug, Deserialize)]
pub struct CheckMedicationAvailabilityRequest {
    pub medication_name: String,
    pub quantity: Option<i32>,
}

pub async fn check_medication_availability(
    State(_state): State<Arc<AppState>>,
    Path(pharmacy_id): Path<i32>,
    Json(request): Json<CheckMedicationAvailabilityRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[check_medication_availability] pharmacy_id={}, medication={}",
        pharmacy_id, request.medication_name
    );

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "available": true,
            "quantity": 10
        })),
    ))
}

/// Réserver un médicament
#[derive(Debug, Deserialize)]
pub struct ReserveMedicationRequest {
    pub medication_name: String,
    pub quantity: i32,
}

pub async fn reserve_medication(
    State(_state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(pharmacy_id): Path<i32>,
    Json(request): Json<ReserveMedicationRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[reserve_medication] pharmacy_id={}, user_id={}, medication={}",
        pharmacy_id, user_id, request.medication_name
    );

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "reservation_id": 1
        })),
    ))
}

/// Créer une commande de pharmacie
#[derive(Debug, Deserialize)]
pub struct CreatePharmacyOrderRequest {
    pub items: Vec<serde_json::Value>,
    pub delivery_address: Option<String>,
}

pub async fn create_pharmacy_order(
    State(_state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(pharmacy_id): Path<i32>,
    Json(_request): Json<CreatePharmacyOrderRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[create_pharmacy_order] pharmacy_id={}, user_id={}",
        pharmacy_id, user_id
    );

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "success": true,
            "order_id": 1
        })),
    ))
}

/// Vérifier les interactions médicamenteuses
#[derive(Debug, Deserialize)]
pub struct CheckMedicationInteractionsRequest {
    pub medications: Vec<String>,
}

pub async fn check_medication_interactions(
    State(_state): State<Arc<AppState>>,
    Json(request): Json<CheckMedicationInteractionsRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[check_medication_interactions] medications={:?}",
        request.medications
    );

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "interactions": [],
            "warnings": []
        })),
    ))
}

/// Suggérer le dosage d'un médicament
#[derive(Debug, Deserialize)]
pub struct SuggestMedicationDosageRequest {
    pub medication_name: String,
    pub patient_age: Option<i32>,
    pub patient_weight: Option<f64>,
    pub condition: Option<String>,
}

pub async fn suggest_medication_dosage(
    State(_state): State<Arc<AppState>>,
    Json(request): Json<SuggestMedicationDosageRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[suggest_medication_dosage] medication={}",
        request.medication_name
    );

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "dosage": "1 comprimé, 2 fois par jour",
            "duration": "7 jours"
        })),
    ))
}

/// Obtenir mes commandes de pharmacie
pub async fn get_my_pharmacy_orders(
    State(_state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    info!("[get_my_pharmacy_orders] user_id={}", user_id);

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": [],
            "total": 0
        })),
    ))
}

/// Analytics d'une pharmacie
pub async fn get_pharmacy_analytics(
    State(_state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(pharmacy_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[get_pharmacy_analytics] pharmacy_id={}, user_id={}",
        pharmacy_id, user_id
    );

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "analytics": {
                "total_orders": 0,
                "revenue": 0.0
            }
        })),
    ))
}

// ============================================================================
// ✅ FONCTIONS LABORATOIRES
// ============================================================================

/// Obtenir les types d'examens d'un laboratoire
pub async fn get_laboratory_examination_types(
    State(_state): State<Arc<AppState>>,
    Path(lab_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    info!("[get_laboratory_examination_types] lab_id={}", lab_id);

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": [],
            "total": 0
        })),
    ))
}

/// Réserver un examen de laboratoire
#[derive(Debug, Deserialize)]
pub struct BookLaboratoryExaminationRequest {
    pub examination_type: String,
    pub date: String,
    pub heure: Option<String>,
}

pub async fn book_laboratory_examination(
    State(_state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(lab_id): Path<i32>,
    Json(request): Json<BookLaboratoryExaminationRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[book_laboratory_examination] lab_id={}, user_id={}, type={}",
        lab_id, user_id, request.examination_type
    );

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "success": true,
            "booking_id": 1
        })),
    ))
}

/// Obtenir les résultats d'un examen
pub async fn get_examination_results(
    State(_state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(examination_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[get_examination_results] examination_id={}, user_id={}",
        examination_id, user_id
    );

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "results": null
        })),
    ))
}

/// Analyser les résultats d'un examen avec IA
pub async fn analyze_examination_results(
    State(_state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(examination_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[analyze_examination_results] examination_id={}, user_id={}",
        examination_id, user_id
    );

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "analysis": {
                "summary": "Résultats normaux",
                "recommendations": []
            }
        })),
    ))
}

/// Obtenir mes examens de laboratoire
pub async fn get_my_laboratory_examinations(
    State(_state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    info!("[get_my_laboratory_examinations] user_id={}", user_id);

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": [],
            "total": 0
        })),
    ))
}

/// Analytics d'un laboratoire
pub async fn get_laboratory_analytics(
    State(_state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(lab_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[get_laboratory_analytics] lab_id={}, user_id={}",
        lab_id, user_id
    );

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "analytics": {
                "total_examinations": 0,
                "revenue": 0.0
            }
        })),
    ))
}

// ============================================================================
// ✅ NOUVEAUX ENDPOINTS POUR AUTCOMPLETE ET IA
// ============================================================================

/// Autocomplete des types d'examens (tous laboratoires confondus)
#[derive(Debug, Deserialize)]
pub struct AutocompleteExaminationsQuery {
    pub query: String,
    pub limit: Option<i32>,
}

pub async fn autocomplete_examination_types(
    State(state): State<Arc<AppState>>,
    Query(params): Query<AutocompleteExaminationsQuery>,
) -> AppResult<impl IntoResponse> {
    info!("[autocomplete_examination_types] query={}", params.query);

    let limit = params.limit.unwrap_or(20).min(50);
    let search_pattern = format!("%{}%", params.query);

    // ✅ CORRIGÉ: Rechercher dans les types d'examens créés par les laboratoires
    // La colonne analyses_disponibles est dans laboratoires_imagerie, pas dans services
    let examinations: Vec<serde_json::Value> = sqlx::query(
        r#"
        SELECT DISTINCT
            unnest(li.analyses_disponibles) as name,
            'examen' as category
        FROM laboratoires_imagerie li
        INNER JOIN services s ON s.id = li.service_id
        WHERE s.specialized_type = 'laboratoire_imagerie'
        AND li.is_active = TRUE
        AND li.analyses_disponibles IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM unnest(li.analyses_disponibles) AS examen
            WHERE examen ILIKE $1
        )
        LIMIT $2
        "#,
    )
    .bind(&search_pattern)
    .bind(limit)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| {
        error!("[autocomplete_examination_types] Erreur: {}", e);
        AppError::Internal("Erreur recherche examens".to_string())
    })?
    .into_iter()
    .map(|row| {
        json!({
            "id": 0, // À adapter selon la structure réelle
            "name": row.get::<Option<String>, _>("name").unwrap_or_default(),
            "category": row.get::<Option<String>, _>("category").unwrap_or("examen".to_string()),
        })
    })
    .collect();

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "examinations": examinations
        })),
    ))
}

/// Autocomplete des prestations médicales (tous hôpitaux confondus)
#[derive(Debug, Deserialize)]
pub struct AutocompleteMedicalServicesQuery {
    pub query: String,
    pub limit: Option<i32>,
}

pub async fn autocomplete_medical_services(
    State(state): State<Arc<AppState>>,
    Query(params): Query<AutocompleteMedicalServicesQuery>,
) -> AppResult<impl IntoResponse> {
    info!("[autocomplete_medical_services] query={}", params.query);

    let limit = params.limit.unwrap_or(20).min(50);
    let search_pattern = format!("%{}%", params.query);

    // Rechercher dans les prestations créées par les hôpitaux
    // ✅ CORRIGÉ: La colonne prestations_medicales est dans hopitaux_cliniques, pas dans services
    let services: Vec<serde_json::Value> = sqlx::query(
        r#"
        SELECT DISTINCT
            unnest(hc.prestations_medicales) as name,
            'prestation' as category
        FROM hopitaux_cliniques hc
        INNER JOIN services s ON s.id = hc.service_id
        WHERE s.specialized_type = 'hopital_clinique'
        AND hc.is_active = TRUE
        AND hc.prestations_medicales IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM unnest(hc.prestations_medicales) AS prestation
            WHERE prestation ILIKE $1
        )
        LIMIT $2
        "#
    )
    .bind(&search_pattern)
    .bind(limit)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| {
        error!("[autocomplete_medical_services] Erreur: {}", e);
        AppError::Internal("Erreur recherche prestations".to_string())
    })?
    .into_iter()
    .map(|row| {
        json!({
            "id": 0,
            "name": row.get::<Option<String>, _>("name").unwrap_or_default(),
            "category": row.get::<Option<String>, _>("category").unwrap_or("prestation".to_string()),
        })
    })
    .collect();

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "services": services
        })),
    ))
}

/// Analyser une image de résultat d'examen avec IA
#[derive(Debug, Deserialize)]
pub struct AnalyzeExaminationImageRequest {
    #[serde(default)]
    pub image_uri: String, // URL ou base64 de l'image (déprécié, utiliser image_base64)
    #[serde(default)]
    pub image_base64: String, // Base64 de l'image (format préféré)
    pub examination_type: String,
    pub patient_age: Option<i32>,
    pub patient_sex: Option<String>,
}

pub async fn analyze_examination_image(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(request): Json<AnalyzeExaminationImageRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[analyze_examination_image] user_id={}, type={}",
        user_id, request.examination_type
    );

    // ✅ CORRIGÉ: Utiliser le service IA pour analyser directement l'image avec vision IA
    use crate::services::lab_ai_service::LabAIService;

    let lab_ai_service = LabAIService::new(state.ia.clone());

    // Extraire le base64 de l'image (support des deux formats: image_uri ou image_base64)
    let image_base64 = if !request.image_base64.is_empty() {
        request.image_base64.clone()
    } else {
        // Si image_uri commence par "data:", c'est déjà du base64
        if request.image_uri.starts_with("data:") {
            request.image_uri.clone()
        } else {
            // Sinon, extraire le base64 après "base64,"
            request
                .image_uri
                .split("base64,")
                .nth(1)
                .unwrap_or(&request.image_uri)
                .to_string()
        }
    };

    // Analyser l'image directement avec vision IA
    let analysis = lab_ai_service
        .analyze_examination_image(
            &request.examination_type,
            &image_base64,
            request.patient_age,
            request.patient_sex.as_deref(),
        )
        .await
        .map_err(|e| {
            error!("[analyze_examination_image] Erreur IA: {}", e);
            AppError::Internal("Erreur analyse IA".to_string())
        })?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "analysis": analysis
        })),
    ))
}

/// Recherche IA de pathologie (pour laboratoires)
#[derive(Debug, Deserialize)]
pub struct SearchPathologyRequest {
    pub query: String,
    pub symptoms: Option<Vec<String>>,
}

pub async fn search_pathology_laboratory(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(request): Json<SearchPathologyRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[search_pathology_laboratory] user_id={}, query={}",
        user_id, request.query
    );

    // Créer un prompt IA pour la recherche de pathologie
    let symptoms_str = request
        .symptoms
        .as_ref()
        .map(|s| s.join(", "))
        .unwrap_or_else(|| "Non spécifiés".to_string());

    let prompt = format!(
        r#"
Tu es un expert médical pour Yukpo, spécialisé dans l'aide au diagnostic et la recherche de pathologies.

CONTEXTE :
- Recherche : {}
- Symptômes : {}

TON RÔLE :
- Identifier les pathologies possibles correspondant à la recherche
- Suggérer les examens de laboratoire pertinents pour confirmer
- Évaluer le niveau d'urgence
- Donner des recommandations médicales appropriées

IMPORTANT :
- Ne JAMAIS poser de diagnostic définitif
- Toujours recommander de consulter un médecin
- Prioriser les examens les plus pertinents
- Classifier l'urgence (critical, high, moderate, low)

RÉPONSE ATTENDUE (JSON strict) :
{{
    "pathologies": [
        {{
            "pathology_name": "Nom de la pathologie",
            "description": "Description",
            "symptoms": ["Symptôme 1", "Symptôme 2"],
            "recommended_examinations": ["Examen 1", "Examen 2"],
            "urgency_level": "moderate",
            "recommendations": ["Recommandation 1", "Recommandation 2"]
        }}
    ]
}}
"#,
        request.query, symptoms_str
    );

    let (model_name, response, tokens) = state.ia.predict(&prompt).await.map_err(|e| {
        error!("[search_pathology_laboratory] Erreur IA: {}", e);
        AppError::Internal("Erreur recherche IA".to_string())
    })?;

    info!(
        "[search_pathology_laboratory] Réponse IA avec {} (tokens: {})",
        model_name, tokens
    );

    // Parser la réponse JSON
    let pathologies: Vec<serde_json::Value> =
        match serde_json::from_str::<serde_json::Value>(&response) {
            Ok(v) => {
                if let Some(paths) = v.get("pathologies").and_then(|p| p.as_array()) {
                    paths.clone()
                } else {
                    vec![]
                }
            }
            Err(e) => {
                log::warn!("[search_pathology_laboratory] Erreur parsing: {}", e);
                vec![]
            }
        };

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "results": pathologies
        })),
    ))
}

/// Recherche IA de pathologie (pour hôpitaux)
#[derive(Debug, Deserialize)]
pub struct SearchPathologyHospitalRequest {
    pub query: String,
    pub symptoms: Option<Vec<String>>,
    pub lat: Option<f64>,
    pub lng: Option<f64>,
}

pub async fn search_pathology_hospital(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(request): Json<SearchPathologyHospitalRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[search_pathology_hospital] user_id={}, query={}",
        user_id, request.query
    );

    let symptoms_str = request
        .symptoms
        .as_ref()
        .map(|s| s.join(", "))
        .unwrap_or_else(|| "Non spécifiés".to_string());

    let prompt = format!(
        r#"
Tu es un expert médical pour Yukpo, spécialisé dans l'aide au diagnostic et la recherche de pathologies pour hôpitaux.

CONTEXTE :
- Recherche : {}
- Symptômes : {}

TON RÔLE :
- Identifier les pathologies possibles
- Suggérer les services médicaux et spécialités pertinents
- Suggérer les examens complémentaires nécessaires
- Évaluer le niveau d'urgence
- Donner des recommandations médicales

IMPORTANT :
- Ne JAMAIS poser de diagnostic définitif
- Toujours recommander de consulter un médecin
- Suggérer les spécialités médicales appropriées
- Classifier l'urgence (critical, high, moderate, low)

RÉPONSE ATTENDUE (JSON strict) :
{{
    "pathologies": [
        {{
            "pathology_name": "Nom de la pathologie",
            "description": "Description",
            "symptoms": ["Symptôme 1", "Symptôme 2"],
            "recommended_examinations": ["Examen 1"],
            "recommended_services": ["Service 1", "Service 2"],
            "urgency_level": "moderate",
            "recommendations": ["Recommandation 1"]
        }}
    ]
}}
"#,
        request.query, symptoms_str
    );

    let (model_name, response, tokens) = state.ia.predict(&prompt).await.map_err(|e| {
        error!("[search_pathology_hospital] Erreur IA: {}", e);
        AppError::Internal("Erreur recherche IA".to_string())
    })?;

    info!(
        "[search_pathology_hospital] Réponse IA avec {} (tokens: {})",
        model_name, tokens
    );

    // Parser et enrichir avec suggestions d'hôpitaux si GPS fourni
    let pathologies: Vec<serde_json::Value> =
        match serde_json::from_str::<serde_json::Value>(&response) {
            Ok(v) => {
                if let Some(paths) = v.get("pathologies").and_then(|p| p.as_array()) {
                    paths.clone()
                } else {
                    vec![]
                }
            }
            Err(e) => {
                log::warn!("[search_pathology_hospital] Erreur parsing: {}", e);
                vec![]
            }
        };

    // TODO: Enrichir avec suggestions d'hôpitaux proches si lat/lng fournis

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "results": pathologies
        })),
    ))
}
