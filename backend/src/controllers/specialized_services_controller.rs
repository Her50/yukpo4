// Contrôleur unifié pour tous les services spécialisés
// Pour simplifier, on regroupe les opérations communes ici

use crate::core::types::{AppError, AppResult};
use crate::middlewares::jwt::AuthenticatedUser;
use crate::state::AppState;
use axum::{
    extract::{Extension, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use log::{error, info};
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;

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

/// ✅ Liste des covoiturages (stub pour éviter erreur 405)
pub async fn list_covoiturages(
    State(_state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    info!("[list_covoiturages] Called");
    // TODO: Implémenter la vraie liste
    Ok((StatusCode::OK, Json(json!([]))))
}

/// ✅ Liste des taxis (stub pour éviter erreur 405)
pub async fn list_taxis(
    State(_state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    info!("[list_taxis] Called");
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
    info!("[create_hospital] Création hôpital pour user_id={}, service_id={}", user_id, payload.service_id);

    // Vérifier que le service appartient à l'utilisateur
    let service_exists: Option<i32> = sqlx::query_scalar(
        "SELECT id FROM services WHERE id = $1 AND user_id = $2"
    )
    .bind(payload.service_id)
    .bind(user_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| {
        error!("[create_hospital] Erreur vérification service: {}", e);
        AppError::Internal(format!("Erreur vérification service: {}", e))
    })?;

    if service_exists.is_none() {
        return Err(AppError::NotFound("Service non trouvé ou n'appartient pas à l'utilisateur".to_string()));
    }

    // ✅ NOUVEAU : Vérifier si un hôpital existe déjà pour ce service
    let existing_hospital: Option<i32> = sqlx::query_scalar(
        "SELECT id FROM hopitaux_cliniques WHERE service_id = $1 AND user_id = $2"
    )
    .bind(payload.service_id)
    .bind(user_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| {
        error!("[create_hospital] Erreur vérification hôpital existant: {}", e);
        AppError::Internal(format!("Erreur vérification hôpital existant: {}", e))
    })?;

    if existing_hospital.is_some() {
        info!("[create_hospital] Hôpital existe déjà pour service_id={}, utilisation UPSERT", payload.service_id);
        // ✅ UPSERT : Mise à jour si existe
        let hospital_id = existing_hospital.unwrap();
        
        // Construire planning_prestations depuis payload
        let planning_prestations_json = payload.planning_prestations.as_ref()
            .map(|p| serde_json::to_value(p).ok())
            .flatten();

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
                planning_prestations = $10,
                urgences_disponible = $11,
                rdv_en_ligne = $12,
                telephone = $13,
                telephone_urgence = $14,
                whatsapp = $15,
                email = $16,
                site_web = $17,
                updated_at = NOW()
            WHERE id = $1 AND user_id = $2
            "#
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
        .bind(planning_prestations_json.as_ref())
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

        return Ok((StatusCode::OK, Json(json!({
            "success": true,
            "id": hospital_id,
            "message": "Établissement de santé mis à jour avec succès"
        }))));
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
        "#
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
    sqlx::query(
        "UPDATE services SET specialized_type = 'hopital_clinique' WHERE id = $1"
    )
    .bind(payload.service_id)
    .execute(&state.pg)
    .await
    .map_err(|e| {
        error!("[create_hospital] Erreur mise à jour specialized_type: {}", e);
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
        "#
    )
    .bind(hospital_id)
    .execute(&state.pg)
    .await
    .ok(); // Ne pas bloquer si erreur

    Ok((StatusCode::CREATED, Json(json!({
        "success": true,
        "id": hospital_id,
        "message": "Hôpital créé avec succès"
    }))))
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
    info!("[create_laboratory] Création laboratoire pour user_id={}, service_id={}", user_id, payload.service_id);

    let service_exists: Option<i32> = sqlx::query_scalar(
        "SELECT id FROM services WHERE id = $1 AND user_id = $2"
    )
    .bind(payload.service_id)
    .bind(user_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| {
        error!("[create_laboratory] Erreur vérification service: {}", e);
        AppError::Internal(format!("Erreur vérification service: {}", e))
    })?;

    if service_exists.is_none() {
        return Err(AppError::NotFound("Service non trouvé ou n'appartient pas à l'utilisateur".to_string()));
    }

    // ✅ NOUVEAU : Vérifier si un laboratoire existe déjà pour ce service
    let existing_laboratory: Option<i32> = sqlx::query_scalar(
        "SELECT id FROM laboratoires_imagerie WHERE service_id = $1 AND user_id = $2"
    )
    .bind(payload.service_id)
    .bind(user_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| {
        error!("[create_laboratory] Erreur vérification laboratoire existant: {}", e);
        AppError::Internal(format!("Erreur vérification laboratoire existant: {}", e))
    })?;

    if existing_laboratory.is_some() {
        info!("[create_laboratory] Laboratoire existe déjà pour service_id={}, utilisation UPSERT", payload.service_id);
        let lab_id = existing_laboratory.unwrap();
        
        let heures_ouverture = payload.heures_ouverture
            .and_then(|h| chrono::NaiveTime::parse_from_str(&h, "%H:%M").ok());
        let heures_fermeture = payload.heures_fermeture
            .and_then(|h| chrono::NaiveTime::parse_from_str(&h, "%H:%M").ok());

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
            "#
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

        return Ok((StatusCode::OK, Json(json!({
            "success": true,
            "id": lab_id,
            "message": "Laboratoire mis à jour avec succès"
        }))));
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
        "#
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
    sqlx::query(
        "UPDATE services SET specialized_type = 'laboratoire_imagerie' WHERE id = $1"
    )
    .bind(payload.service_id)
    .execute(&state.pg)
    .await
    .map_err(|e| {
        error!("[create_laboratory] Erreur mise à jour specialized_type: {}", e);
        AppError::Internal("Erreur mise à jour specialized_type".to_string())
    })?;

    Ok((StatusCode::CREATED, Json(json!({
        "success": true,
        "id": lab_id,
        "message": "Laboratoire créé avec succès"
    }))))
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
    info!("[create_travel_agency] Création agence pour user_id={}, service_id={}", user_id, payload.service_id);

    let service_exists: Option<i32> = sqlx::query_scalar(
        "SELECT id FROM services WHERE id = $1 AND user_id = $2"
    )
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
    let existing_agency: Option<i32> = sqlx::query_scalar(
        "SELECT id FROM agences_voyage WHERE service_id = $1 AND user_id = $2"
    )
    .bind(payload.service_id)
    .bind(user_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| {
        error!("[create_travel_agency] Erreur vérification agence existante: {}", e);
        AppError::Internal(format!("Erreur vérification agence existante: {}", e))
    })?;

    if existing_agency.is_some() {
        info!("[create_travel_agency] Agence existe déjà pour service_id={}, utilisation UPSERT", payload.service_id);
        let agency_id = existing_agency.unwrap();
        
        let heures_ouverture = payload.heures_ouverture
            .and_then(|h| chrono::NaiveTime::parse_from_str(&h, "%H:%M").ok());
        let heures_fermeture = payload.heures_fermeture
            .and_then(|h| chrono::NaiveTime::parse_from_str(&h, "%H:%M").ok());

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
            "#
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

        return Ok((StatusCode::OK, Json(json!({
            "success": true,
            "id": agency_id,
            "message": "Agence de voyage mise à jour avec succès"
        }))));
    }

    let heures_ouverture = payload.heures_ouverture
        .and_then(|h| chrono::NaiveTime::parse_from_str(&h, "%H:%M").ok());
    let heures_fermeture = payload.heures_fermeture
        .and_then(|h| chrono::NaiveTime::parse_from_str(&h, "%H:%M").ok());

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
    sqlx::query(
        "UPDATE services SET specialized_type = 'agence_voyage' WHERE id = $1"
    )
    .bind(payload.service_id)
    .execute(&state.pg)
    .await
    .map_err(|e| {
        error!("[create_travel_agency] Erreur mise à jour specialized_type: {}", e);
        AppError::Internal("Erreur mise à jour specialized_type".to_string())
    })?;

    Ok((StatusCode::CREATED, Json(json!({
        "success": true,
        "id": agency_id,
        "message": "Agence de voyage créée avec succès"
    }))))
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
    pub date_depart: String, // Format ISO 8601
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
    info!("[create_covoiturage] Création covoiturage pour user_id={}, service_id={}", user_id, payload.service_id);

    let service_exists: Option<i32> = sqlx::query_scalar(
        "SELECT id FROM services WHERE id = $1 AND user_id = $2"
    )
    .bind(payload.service_id)
    .bind(user_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| {
        error!("[create_covoiturage] Erreur vérification service: {}", e);
        AppError::Internal(format!("Erreur vérification service: {}", e))
    })?;

    if service_exists.is_none() {
        return Err(AppError::NotFound("Service non trouvé ou n'appartient pas à l'utilisateur".to_string()));
    }

    // ✅ NOUVEAU : Vérifier si un covoiturage existe déjà pour ce service
    let existing_covoiturage: Option<i32> = sqlx::query_scalar(
        "SELECT id FROM covoiturages WHERE service_id = $1 AND user_id = $2"
    )
    .bind(payload.service_id)
    .bind(user_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| {
        error!("[create_covoiturage] Erreur vérification covoiturage existant: {}", e);
        AppError::Internal(format!("Erreur vérification covoiturage existant: {}", e))
    })?;

    if existing_covoiturage.is_some() {
        info!("[create_covoiturage] Covoiturage existe déjà pour service_id={}, utilisation UPSERT", payload.service_id);
        let covoiturage_id = existing_covoiturage.unwrap();
        
        let date_depart = chrono::DateTime::parse_from_rfc3339(&payload.date_depart)
            .map(|dt| dt.with_timezone(&chrono::Utc))
            .map_err(|_| AppError::BadRequest("Format date_depart invalide (ISO 8601 requis)".to_string()))?;
        let heure_depart = chrono::NaiveTime::parse_from_str(&payload.heure_depart, "%H:%M")
            .map_err(|_| AppError::BadRequest("Format heure_depart invalide (HH:MM requis)".to_string()))?;

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
            "#
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

        return Ok((StatusCode::OK, Json(json!({
            "success": true,
            "id": covoiturage_id,
            "message": "Covoiturage mis à jour avec succès"
        }))));
    }

    let date_depart = chrono::DateTime::parse_from_rfc3339(&payload.date_depart)
        .map(|dt| dt.with_timezone(&chrono::Utc))
        .map_err(|_| AppError::BadRequest("Format date_depart invalide (ISO 8601 requis)".to_string()))?;

    let heure_depart = chrono::NaiveTime::parse_from_str(&payload.heure_depart, "%H:%M")
        .map_err(|_| AppError::BadRequest("Format heure_depart invalide (HH:MM requis)".to_string()))?;

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
        "#
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
    sqlx::query(
        "UPDATE services SET specialized_type = 'covoiturage' WHERE id = $1"
    )
    .bind(payload.service_id)
    .execute(&state.pg)
    .await
    .map_err(|e| {
        error!("[create_covoiturage] Erreur mise à jour specialized_type: {}", e);
        AppError::Internal("Erreur mise à jour specialized_type".to_string())
    })?;

    Ok((StatusCode::CREATED, Json(json!({
        "success": true,
        "id": covoiturage_id,
        "message": "Covoiturage créé avec succès"
    }))))
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
    info!("[create_taxi] Création taxi pour user_id={}, service_id={}", user_id, payload.service_id);

    let service_exists: Option<i32> = sqlx::query_scalar(
        "SELECT id FROM services WHERE id = $1 AND user_id = $2"
    )
    .bind(payload.service_id)
    .bind(user_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| {
        error!("[create_taxi] Erreur vérification service: {}", e);
        AppError::Internal(format!("Erreur vérification service: {}", e))
    })?;

    if service_exists.is_none() {
        return Err(AppError::NotFound("Service non trouvé ou n'appartient pas à l'utilisateur".to_string()));
    }

    // ✅ NOUVEAU : Vérifier si un taxi existe déjà pour ce service
    let existing_taxi: Option<i32> = sqlx::query_scalar(
        "SELECT id FROM taxis_ville WHERE service_id = $1 AND user_id = $2"
    )
    .bind(payload.service_id)
    .bind(user_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| {
        error!("[create_taxi] Erreur vérification taxi existant: {}", e);
        AppError::Internal(format!("Erreur vérification taxi existant: {}", e))
    })?;

    if existing_taxi.is_some() {
        info!("[create_taxi] Taxi existe déjà pour service_id={}, utilisation UPSERT", payload.service_id);
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
            "#
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

        return Ok((StatusCode::OK, Json(json!({
            "success": true,
            "id": taxi_id,
            "message": "Taxi mis à jour avec succès"
        }))));
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
    sqlx::query(
        "UPDATE services SET specialized_type = 'taxi_ville' WHERE id = $1"
    )
    .bind(payload.service_id)
    .execute(&state.pg)
    .await
    .map_err(|e| {
        error!("[create_taxi] Erreur mise à jour specialized_type: {}", e);
        AppError::Internal("Erreur mise à jour specialized_type".to_string())
    })?;

    Ok((StatusCode::CREATED, Json(json!({
        "success": true,
        "id": taxi_id,
        "message": "Taxi créé avec succès"
    }))))
}

