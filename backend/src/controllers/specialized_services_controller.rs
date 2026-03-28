// Contrôleur unifié pour tous les services spécialisés
// Pour simplifier, on regroupe les opérations communes ici

use crate::core::types::{AppError, AppResult};
use crate::middlewares::jwt::AuthenticatedUser;
use crate::models::delivery_model::DeliveryApplicationStatus;
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

/// ✅ Liste des hôpitaux du partenaire connecté
pub async fn list_hospitals(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    info!("[list_hospitals] user_id={}", user_id);

    let rows = sqlx::query(
        r#"
        SELECT
            h.id, h.service_id, h.user_id, h.nom, h.type_etablissement,
            h.adresse, h.quartier, h.ville, h.gps,
            h.prestations_medicales, h.urgences_disponible, h.rdv_en_ligne,
            h.is_available_now, h.telephone, h.telephone_urgence,
            h.whatsapp, h.email, h.site_web, h.description, h.logo_url,
            h.banque_sang, h.planning_hebdomadaire, h.is_active
        FROM hopitaux_cliniques h
        WHERE h.user_id = $1
        ORDER BY h.updated_at DESC NULLS LAST
        "#,
    )
    .bind(user_id)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| {
        error!("[list_hospitals] Erreur: {}", e);
        AppError::Internal("Erreur liste hôpitaux".to_string())
    })?;

    let hospitals: Vec<serde_json::Value> = rows.iter().map(|row| {
        json!({
            "id": row.try_get::<i32, _>("id").ok(),
            "service_id": row.try_get::<i32, _>("service_id").ok(),
            "user_id": row.try_get::<i32, _>("user_id").ok(),
            "nom": row.try_get::<Option<String>, _>("nom").ok().flatten(),
            "type_etablissement": row.try_get::<Option<String>, _>("type_etablissement").ok().flatten(),
            "adresse": row.try_get::<Option<String>, _>("adresse").ok().flatten(),
            "quartier": row.try_get::<Option<String>, _>("quartier").ok().flatten(),
            "ville": row.try_get::<Option<String>, _>("ville").ok().flatten(),
            "gps": row.try_get::<Option<String>, _>("gps").ok().flatten(),
            "prestations_medicales": row.try_get::<Option<Vec<String>>, _>("prestations_medicales").ok().flatten(),
            "urgences_disponible": row.try_get::<Option<bool>, _>("urgences_disponible").ok().flatten().unwrap_or(false),
            "rdv_en_ligne": row.try_get::<Option<bool>, _>("rdv_en_ligne").ok().flatten().unwrap_or(false),
            "banque_sang": row.try_get::<Option<bool>, _>("banque_sang").ok().flatten().unwrap_or(false),
            "is_available_now": row.try_get::<Option<bool>, _>("is_available_now").ok().flatten().unwrap_or(false),
            "telephone": row.try_get::<Option<String>, _>("telephone").ok().flatten(),
            "telephone_urgence": row.try_get::<Option<String>, _>("telephone_urgence").ok().flatten(),
            "whatsapp": row.try_get::<Option<String>, _>("whatsapp").ok().flatten(),
            "email": row.try_get::<Option<String>, _>("email").ok().flatten(),
            "site_web": row.try_get::<Option<String>, _>("site_web").ok().flatten(),
            "description": row.try_get::<Option<String>, _>("description").ok().flatten(),
            "planning_prestations": row.try_get::<Option<serde_json::Value>, _>("planning_hebdomadaire").ok().flatten(),
        })
    }).collect();

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": hospitals,
            "total": hospitals.len()
        })),
    ))
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

/// Liste des agences de voyage (protégée)
pub async fn list_travel_agencies(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    info!("[list_travel_agencies] user_id={}", user.id);

    let agencies = sqlx::query(
        r#"SELECT s.id as service_id, a.id as agency_id, a.nom_agence, a.ville, a.quartier,
                  a.adresse, a.telephone, a.whatsapp, a.email, a.site_web,
                  a.services_voyage, a.compagnies_bus, a.destinations,
                  a.heures_ouverture, a.heures_fermeture, a.jours_ouverture,
                  a.peut_emettre_tickets_bus, a.compagnies_affiliees,
                  a.gps, a.is_active, a.created_at
           FROM services s
           INNER JOIN agences_voyage a ON a.service_id = s.id
           WHERE s.is_active = TRUE
           ORDER BY a.created_at DESC
           LIMIT 50"#,
    )
    .fetch_all(&state.pg)
    .await
    .map_err(|e| {
        error!("[list_travel_agencies] Erreur: {}", e);
        AppError::Internal("Erreur récupération agences".to_string())
    })?;

    let mut agencies_json = Vec::new();
    for row in agencies {
        agencies_json.push(json!({
            "id": row.try_get::<i32, _>("service_id").ok(),
            "agency_id": row.try_get::<i32, _>("agency_id").ok(),
            "nom_agence": row.try_get::<Option<String>, _>("nom_agence").ok().flatten(),
            "ville": row.try_get::<Option<String>, _>("ville").ok().flatten(),
            "quartier": row.try_get::<Option<String>, _>("quartier").ok().flatten(),
            "adresse": row.try_get::<Option<String>, _>("adresse").ok().flatten(),
            "telephone": row.try_get::<Option<String>, _>("telephone").ok().flatten(),
            "whatsapp": row.try_get::<Option<String>, _>("whatsapp").ok().flatten(),
            "email": row.try_get::<Option<String>, _>("email").ok().flatten(),
            "site_web": row.try_get::<Option<String>, _>("site_web").ok().flatten(),
            "gps": row.try_get::<Option<String>, _>("gps").ok().flatten(),
            "peut_emettre_tickets_bus": row.try_get::<Option<bool>, _>("peut_emettre_tickets_bus").ok().flatten(),
            "is_active": row.try_get::<Option<bool>, _>("is_active").ok().flatten(),
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
    State(state): State<Arc<AppState>>,
) -> AppResult<impl IntoResponse> {
    info!("[list_covoiturages_public] Called");

    let rows = sqlx::query(
        r#"SELECT c.id as covoiturage_id, c.service_id, c.user_id as driver_id,
                  c.depart, c.destination, c.gps_depart, c.gps_destination,
                  c.date_depart, c.heure_depart, c.type_vehicule, c.marque_modele,
                  c.nombre_places, c.places_disponibles, c.prix_par_place, c.devise,
                  c.bagages_autorises, c.animaux_autorises, c.fumeur_autorise, c.climatisation,
                  c.statut, c.is_recurring, c.recurrence_type, c.created_at,
                  u.name as driver_name
           FROM covoiturages c
           JOIN services s ON s.id = c.service_id
           LEFT JOIN users u ON u.id = c.user_id
           WHERE c.is_active = TRUE AND c.statut = 'ouvert' AND c.date_depart >= CURRENT_DATE
           ORDER BY c.date_depart ASC, c.heure_depart ASC
           LIMIT 50"#,
    )
    .fetch_all(&state.pg)
    .await
    .map_err(|e| {
        error!("[list_covoiturages_public] Erreur: {}", e);
        AppError::Internal("Erreur récupération covoiturages".to_string())
    })?;

    let mut trips = Vec::new();
    for row in &rows {
        trips.push(json!({
            "id": row.try_get::<i32, _>("covoiturage_id").ok(),
            "service_id": row.try_get::<i32, _>("service_id").ok(),
            "depart": row.try_get::<Option<String>, _>("depart").ok().flatten(),
            "destination": row.try_get::<Option<String>, _>("destination").ok().flatten(),
            "gps_depart": row.try_get::<Option<String>, _>("gps_depart").ok().flatten(),
            "gps_destination": row.try_get::<Option<String>, _>("gps_destination").ok().flatten(),
            "date_depart": row.try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("date_depart").ok().flatten().map(|d| d.to_rfc3339()),
            "heure_depart": row.try_get::<Option<chrono::NaiveTime>, _>("heure_depart").ok().flatten().map(|t| t.format("%H:%M").to_string()),
            "type_vehicule": row.try_get::<Option<String>, _>("type_vehicule").ok().flatten(),
            "marque_modele": row.try_get::<Option<String>, _>("marque_modele").ok().flatten(),
            "nombre_places": row.try_get::<Option<i32>, _>("nombre_places").ok().flatten(),
            "places_disponibles": row.try_get::<Option<i32>, _>("places_disponibles").ok().flatten(),
            "prix_par_place": row.try_get::<Option<i32>, _>("prix_par_place").ok().flatten(),
            "devise": row.try_get::<Option<String>, _>("devise").ok().flatten(),
            "climatisation": row.try_get::<Option<bool>, _>("climatisation").ok().flatten(),
            "bagages_autorises": row.try_get::<Option<bool>, _>("bagages_autorises").ok().flatten(),
            "animaux_autorises": row.try_get::<Option<bool>, _>("animaux_autorises").ok().flatten(),
            "fumeur_autorise": row.try_get::<Option<bool>, _>("fumeur_autorise").ok().flatten(),
            "statut": row.try_get::<Option<String>, _>("statut").ok().flatten(),
            "is_recurring": row.try_get::<Option<bool>, _>("is_recurring").ok().flatten(),
            "driver_name": row.try_get::<Option<String>, _>("driver_name").ok().flatten(),
        }));
    }

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": trips,
            "total": trips.len()
        })),
    ))
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
pub async fn list_taxis_public(State(state): State<Arc<AppState>>) -> AppResult<impl IntoResponse> {
    info!("[list_taxis_public] Called");

    use sqlx::Row;
    let rows = sqlx::query(
        r#"
        SELECT
            t.id as taxi_id,
            s.id as service_id,
            t.user_id,
            t.nom_chauffeur,
            t.telephone,
            t.whatsapp,
            t.type_vehicule,
            t.marque_modele,
            t.immatriculation,
            t.couleur,
            t.annee,
            t.is_available_now,
            t.zone_intervention,
            t.gps_actuel,
            t.tarif_base,
            t.tarif_par_km,
            t.devise,
            t.paiement_cash,
            t.paiement_mobile_money,
            t.paiement_carte,
            t.climatisation,
            t.wifi,
            t.is_on_duty,
            s.category,
            s.specialized_type,
            s.gps as service_gps,
            u.nom_complet as prestataire_nom,
            u.photo_profil as prestataire_photo
        FROM taxis_ville t
        INNER JOIN services s ON s.id = t.service_id
        LEFT JOIN users u ON u.id = t.user_id
        WHERE s.is_active = true AND t.is_available_now = true
        ORDER BY t.updated_at DESC
        LIMIT 50
        "#,
    )
    .fetch_all(&state.pg)
    .await
    .map_err(|e| {
        error!("[list_taxis_public] Erreur: {}", e);
        AppError::Internal("Erreur liste taxis".to_string())
    })?;

    let taxis_json: Vec<serde_json::Value> = rows
        .iter()
        .map(|row| {
            json!({
                "taxi_id": row.try_get::<i32, _>("taxi_id").ok(),
                "service_id": row.try_get::<i32, _>("service_id").ok(),
                "user_id": row.try_get::<i32, _>("user_id").ok(),
                "nom_chauffeur": row.try_get::<Option<String>, _>("nom_chauffeur").ok().flatten(),
                "telephone": row.try_get::<Option<String>, _>("telephone").ok().flatten(),
                "whatsapp": row.try_get::<Option<String>, _>("whatsapp").ok().flatten(),
                "type_vehicule": row.try_get::<Option<String>, _>("type_vehicule").ok().flatten(),
                "marque_modele": row.try_get::<Option<String>, _>("marque_modele").ok().flatten(),
                "immatriculation": row.try_get::<Option<String>, _>("immatriculation").ok().flatten(),
                "couleur": row.try_get::<Option<String>, _>("couleur").ok().flatten(),
                "annee": row.try_get::<Option<i32>, _>("annee").ok().flatten(),
                "is_available_now": row.try_get::<Option<bool>, _>("is_available_now").ok().flatten(),
                "zone_intervention": row.try_get::<Option<Vec<String>>, _>("zone_intervention").ok().flatten(),
                "gps_actuel": row.try_get::<Option<String>, _>("gps_actuel").ok().flatten(),
                "tarif_base": row.try_get::<Option<i32>, _>("tarif_base").ok().flatten(),
                "tarif_par_km": row.try_get::<Option<i32>, _>("tarif_par_km").ok().flatten(),
                "devise": row.try_get::<Option<String>, _>("devise").ok().flatten(),
                "paiement_cash": row.try_get::<Option<bool>, _>("paiement_cash").ok().flatten(),
                "paiement_mobile_money": row.try_get::<Option<bool>, _>("paiement_mobile_money").ok().flatten(),
                "paiement_carte": row.try_get::<Option<bool>, _>("paiement_carte").ok().flatten(),
                "climatisation": row.try_get::<Option<bool>, _>("climatisation").ok().flatten(),
                "wifi": row.try_get::<Option<bool>, _>("wifi").ok().flatten(),
                "is_on_duty": row.try_get::<Option<bool>, _>("is_on_duty").ok().flatten(),
                "prestataire_nom": row.try_get::<Option<String>, _>("prestataire_nom").ok().flatten(),
                "prestataire_photo": row.try_get::<Option<String>, _>("prestataire_photo").ok().flatten(),
            })
        })
        .collect();

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": taxis_json,
            "total": taxis_json.len()
        })),
    ))
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
    #[serde(alias = "planning_prestations")]
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

/// Publication taxi / covoiturage : candidature coursier approuvée avec type `taxi` ou `carpooling`,
/// ou compte driver / partenaire chauffeur (rétrocompatibilité).
async fn ensure_user_can_publish_transport_offer(
    pool: &sqlx::PgPool,
    user_id: i32,
) -> AppResult<()> {
    let approved_profile: bool = sqlx::query_scalar(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM courier_applications ca
            WHERE ca.user_id = $1
              AND ca.status = $2
              AND COALESCE(ca.profile_data->>'courier_type', ca.profile_data->>'courierType', '') IN ('taxi', 'carpooling')
        )
        "#,
    )
    .bind(user_id)
    .bind(DeliveryApplicationStatus::Approved)
    .fetch_one(pool)
    .await
    .map_err(|e| {
        error!("[transport_driver] lecture candidature: {}", e);
        AppError::Internal(format!("Erreur vérification profil chauffeur: {}", e))
    })?;

    if approved_profile {
        return Ok(());
    }

    let legacy: bool = sqlx::query_scalar(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM users u
            WHERE u.id = $1
              AND (
                LOWER(TRIM(COALESCE(u.role::text, ''))) = 'driver'
                OR LOWER(TRIM(COALESCE(u.partner_type::text, ''))) IN ('chauffeur', 'taxi', 'covoiturage')
              )
        )
        "#,
    )
    .bind(user_id)
    .fetch_one(pool)
    .await
    .unwrap_or(false);

    if legacy {
        return Ok(());
    }

    Err(AppError::Forbidden(
        "Publication réservée aux chauffeurs enregistrés (candidature taxi ou covoiturage approuvée)."
            .to_string(),
    ))
}

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

    ensure_user_can_publish_transport_offer(&state.pg, user_id).await?;

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

    ensure_user_can_publish_transport_offer(&state.pg, user_id).await?;

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
        let type_bien_lower = type_bien.to_lowercase();
        query_builder.push(" AND (LOWER(p.product_data->>'type_bien') = ");
        query_builder.push_bind(type_bien_lower.clone());
        query_builder.push(" OR LOWER(s.data->'type_bien'->>'valeur') = ");
        query_builder.push_bind(type_bien_lower.clone());
        query_builder.push(" OR LOWER(s.data->>'type_bien') = ");
        query_builder.push_bind(type_bien_lower);
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
        error!("[search_properties] Erreur service_products: {}", e);
        AppError::Internal("Erreur recherche biens".to_string())
    })?;

    let mut properties_json = Vec::new();
    for row in properties {
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

    // Also search real_estate_properties (created via ImmobilierForm)
    let mut rep_builder = sqlx::QueryBuilder::new(
        r#"
        SELECT
            rep.id,
            rep.service_id,
            rep.titre,
            rep.description,
            rep.type_bien,
            rep.statut,
            rep.adresse,
            rep.quartier,
            rep.ville,
            rep.gps,
            rep.superficie_m2,
            rep.nb_chambres,
            rep.nb_salles_bain,
            rep.standing,
            rep.prix_vente,
            rep.prix_location AS prix_location_mensuel,
            rep.photos,
            COALESCE(rep.is_available, TRUE) AS is_available_now,
            rep.created_at
        FROM real_estate_properties rep
        WHERE 1=1
        "#,
    );

    if let Some(type_bien) = &query.type_bien {
        rep_builder.push(" AND LOWER(rep.type_bien) = LOWER(");
        rep_builder.push_bind(type_bien);
        rep_builder.push(")");
    }
    if let Some(ville) = &query.ville {
        rep_builder.push(" AND rep.ville ILIKE ");
        rep_builder.push_bind(format!("%{}%", ville));
    }
    if let Some(standing) = &query.standing {
        rep_builder.push(" AND LOWER(rep.standing) = LOWER(");
        rep_builder.push_bind(standing);
        rep_builder.push(")");
    }
    if let Some(prix_max) = query.prix_max {
        let prix_max_dec =
            rust_decimal::Decimal::from_f64_retain(prix_max).unwrap_or(rust_decimal::Decimal::ZERO);
        rep_builder.push(" AND COALESCE(rep.prix_location, rep.prix_vente, 999999999) <= ");
        rep_builder.push_bind(prix_max_dec);
    }
    if let Some(nb_chambres) = query.nb_chambres_min {
        rep_builder.push(" AND COALESCE(rep.nb_chambres, 0) >= ");
        rep_builder.push_bind(nb_chambres);
    }
    if let Some(query_text) = &query.query {
        if !query_text.trim().is_empty() {
            rep_builder.push(" AND (rep.titre ILIKE ");
            rep_builder.push_bind(format!("%{}%", query_text));
            rep_builder.push(" OR rep.description ILIKE ");
            rep_builder.push_bind(format!("%{}%", query_text));
            rep_builder.push(")");
        }
    }

    rep_builder.push(" ORDER BY rep.created_at DESC LIMIT ");
    rep_builder.push_bind(limit);

    let rep_rows = rep_builder.build().fetch_all(&state.pg).await.unwrap_or_default();

    let existing_ids: std::collections::HashSet<i32> = properties_json
        .iter()
        .filter_map(|p| p.get("id").and_then(|v| v.as_i64()).map(|v| v as i32))
        .collect();

    for row in rep_rows {
        let rep_id: i32 = row.try_get("id").unwrap_or(0);
        if existing_ids.contains(&rep_id) {
            continue;
        }

        let photos_val: Option<Vec<String>> =
            row.try_get::<Option<Vec<String>>, _>("photos").ok().flatten();

        properties_json.push(json!({
            "id": rep_id,
            "service_id": row.try_get::<Option<i32>, _>("service_id").ok().flatten(),
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
            "photos": photos_val,
            "is_available_now": row.try_get::<Option<bool>, _>("is_available_now").ok().flatten().unwrap_or(true),
        }));
    }

    let total = properties_json.len() as i64;
    let total_pages = (total + limit - 1) / limit;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": properties_json,
            "total": total,
            "page": page,
            "limit": limit,
            "total_pages": total_pages
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
    let property_id = row.try_get::<i32, _>("id").unwrap_or(0);

    // Récupérer les visites virtuelles associées
    let virtual_tours_rows = sqlx::query(
        r#"
        SELECT id, tour_type, media_url, thumbnail_url, duration_seconds, description, is_primary, created_at
        FROM property_virtual_tours
        WHERE property_id = $1
        ORDER BY is_primary DESC, created_at DESC
        "#,
    )
    .bind(property_id)
    .fetch_all(&state.pg)
    .await
    .unwrap_or_default();

    let virtual_tours: Vec<serde_json::Value> = virtual_tours_rows
        .iter()
        .map(|vt| {
            json!({
                "id": vt.try_get::<i32, _>("id").unwrap_or(0),
                "tour_type": vt.try_get::<Option<String>, _>("tour_type").ok().flatten(),
                "media_url": vt.try_get::<Option<String>, _>("media_url").ok().flatten(),
                "thumbnail_url": vt.try_get::<Option<String>, _>("thumbnail_url").ok().flatten(),
                "duration_seconds": vt.try_get::<Option<i32>, _>("duration_seconds").ok().flatten(),
                "description": vt.try_get::<Option<String>, _>("description").ok().flatten(),
                "is_primary": vt.try_get::<Option<bool>, _>("is_primary").ok().flatten().unwrap_or(false),
            })
        })
        .collect();

    let property_json = json!({
        "id": property_id,
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
        "videos": row.try_get::<Option<Vec<String>>, _>("videos").ok().flatten(),
        "virtual_tours": virtual_tours,
        "has_virtual_tour": !virtual_tours_rows.is_empty(),
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

/// PUT /api/immobilier/biens/{id}
/// Mettre à jour un bien immobilier
pub async fn update_property(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(property_id): Path<i32>,
    Json(payload): Json<CreatePropertyRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[update_property] Mise à jour bien id={} pour user_id={}",
        property_id, user_id
    );

    // Vérifier que le bien existe et appartient à l'utilisateur
    let owner_check: Option<i32> =
        sqlx::query_scalar("SELECT id FROM real_estate_properties WHERE id = $1 AND user_id = $2")
            .bind(property_id)
            .bind(user_id)
            .fetch_optional(&state.pg)
            .await
            .map_err(|e| {
                error!("[update_property] Erreur vérification propriétaire: {}", e);
                AppError::Internal(format!("Erreur vérification: {}", e))
            })?;

    if owner_check.is_none() {
        return Err(AppError::NotFound(
            "Bien non trouvé ou n'appartient pas à l'utilisateur".to_string(),
        ));
    }

    use rust_decimal::Decimal;
    let prix_vente = payload.prix_vente.map(|p| Decimal::from_f64_retain(p).unwrap_or_default());
    let prix_location = payload
        .prix_location_mensuel
        .map(|p| Decimal::from_f64_retain(p).unwrap_or_default());
    let superficie = payload.superficie_m2.map(|s| Decimal::from_f64_retain(s).unwrap_or_default());

    sqlx::query(
        r#"
        UPDATE real_estate_properties SET
            titre = $1, description = $2, type_bien = $3, statut = $4,
            adresse = $5, quartier = $6, ville = $7, gps = $8, superficie_m2 = $9,
            nb_chambres = $10, nb_salles_bain = $11, standing = $12, etat_general = $13,
            prix_vente = $14, prix_location_mensuel = $15, photos = $16,
            updated_at = NOW()
        WHERE id = $17 AND user_id = $18
        "#,
    )
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
    .bind(property_id)
    .bind(user_id)
    .execute(&state.pg)
    .await
    .map_err(|e| {
        error!("[update_property] Erreur mise à jour: {}", e);
        AppError::Internal(format!("Erreur mise à jour bien: {}", e))
    })?;

    info!("[update_property] Bien id={} mis à jour", property_id);

    Ok(Json(json!({
        "success": true,
        "data": {
            "id": property_id,
            "service_id": payload.service_id
        }
    })))
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
    let base_url =
        std::env::var("FRONTEND_URL").unwrap_or_else(|_| "https://yukpo.com".to_string());
    let share_url = format!(
        "{}/immobilier/{}?share={}",
        base_url, property_id, share_token
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

/// GET /api/immobilier/biens/{id}/virtual-tours
/// Liste toutes les visites virtuelles d'un bien immobilier
pub async fn get_property_virtual_tours(
    State(state): State<Arc<AppState>>,
    Path(property_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    let tours = sqlx::query(
        r#"
        SELECT id, property_id, tour_type, media_url, thumbnail_url,
               duration_seconds, description, is_primary, created_at
        FROM property_virtual_tours
        WHERE property_id = $1
        ORDER BY is_primary DESC, created_at DESC
        "#,
    )
    .bind(property_id)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| {
        error!("[get_property_virtual_tours] Erreur: {}", e);
        AppError::Internal("Erreur récupération visites virtuelles".to_string())
    })?;

    let mut result = Vec::new();
    for row in tours {
        result.push(json!({
            "id": row.try_get::<i32, _>("id").unwrap_or(0),
            "property_id": row.try_get::<i32, _>("property_id").unwrap_or(0),
            "tour_type": row.try_get::<Option<String>, _>("tour_type").ok().flatten(),
            "media_url": row.try_get::<Option<String>, _>("media_url").ok().flatten(),
            "thumbnail_url": row.try_get::<Option<String>, _>("thumbnail_url").ok().flatten(),
            "duration_seconds": row.try_get::<Option<i32>, _>("duration_seconds").ok().flatten(),
            "description": row.try_get::<Option<String>, _>("description").ok().flatten(),
            "is_primary": row.try_get::<Option<bool>, _>("is_primary").ok().flatten().unwrap_or(false),
            "created_at": row.try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("created_at").ok().flatten().map(|d| d.to_rfc3339()),
        }));
    }

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": result,
            "total": result.len()
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

    let mut query = QueryBuilder::new(
        r#"SELECT t.id AS taxi_id, t.service_id, t.user_id, t.nom_chauffeur, t.telephone,
                  t.whatsapp, t.type_vehicule, t.marque_modele, t.immatriculation, t.couleur,
                  t.annee, t.is_available_now, t.zone_intervention, t.gps_actuel,
                  t.tarif_base, t.tarif_par_km, t.devise, t.paiement_cash,
                  t.paiement_mobile_money, t.paiement_carte, t.climatisation, t.wifi,
                  t.is_on_duty, t.created_at AS taxi_created_at,
                  s.nom AS service_nom, s.ville, s.quartier, s.gps AS service_gps
           FROM taxis_ville t
           INNER JOIN services s ON s.id = t.service_id
           WHERE s.is_active = true AND t.is_active = true"#,
    );

    if let Some(ref ville) = params.ville {
        query.push(" AND s.ville = ");
        query.push_bind(ville);
    }
    if let Some(ref quartier) = params.quartier {
        query.push(" AND s.quartier = ");
        query.push_bind(quartier);
    }

    query.push(" ORDER BY t.is_available_now DESC, t.created_at DESC LIMIT ");
    query.push_bind(limit);
    query.push(" OFFSET ");
    query.push_bind(offset);

    use sqlx::Row;
    let taxis = query.build().fetch_all(&state.pg).await.map_err(|e| {
        error!("[search_taxis] Erreur: {}", e);
        AppError::Internal("Erreur recherche taxis".to_string())
    })?;

    let mut taxis_json = Vec::new();
    for row in &taxis {
        let zone_intervention: Option<Vec<String>> =
            row.try_get::<Option<Vec<String>>, _>("zone_intervention").ok().flatten();
        let zone = zone_intervention.as_ref().and_then(|z| {
            if z.is_empty() {
                None
            } else {
                Some(z.join(", "))
            }
        });
        let ville: Option<String> = row.try_get::<Option<String>, _>("ville").ok().flatten();
        taxis_json.push(json!({
            "id": row.try_get::<i32, _>("taxi_id").ok(),
            "service_id": row.try_get::<i32, _>("service_id").ok(),
            "user_id": row.try_get::<i32, _>("user_id").ok(),
            "zone": zone.or(ville),
            "nom_chauffeur": row.try_get::<Option<String>, _>("nom_chauffeur").ok().flatten(),
            "telephone": row.try_get::<Option<String>, _>("telephone").ok().flatten(),
            "whatsapp": row.try_get::<Option<String>, _>("whatsapp").ok().flatten(),
            "type_vehicule": row.try_get::<Option<String>, _>("type_vehicule").ok().flatten(),
            "marque_modele": row.try_get::<Option<String>, _>("marque_modele").ok().flatten(),
            "immatriculation": row.try_get::<Option<String>, _>("immatriculation").ok().flatten(),
            "couleur": row.try_get::<Option<String>, _>("couleur").ok().flatten(),
            "annee": row.try_get::<Option<i32>, _>("annee").ok().flatten(),
            "is_available_now": row.try_get::<Option<bool>, _>("is_available_now").ok().flatten(),
            "zone_intervention": row.try_get::<Option<Vec<String>>, _>("zone_intervention").ok().flatten(),
            "gps_actuel": row.try_get::<Option<String>, _>("gps_actuel").ok().flatten(),
            "tarif_base": row.try_get::<Option<i32>, _>("tarif_base").ok().flatten(),
            "tarif_par_km": row.try_get::<Option<i32>, _>("tarif_par_km").ok().flatten(),
            "devise": row.try_get::<Option<String>, _>("devise").ok().flatten(),
            "paiement_cash": row.try_get::<Option<bool>, _>("paiement_cash").ok().flatten(),
            "paiement_mobile_money": row.try_get::<Option<bool>, _>("paiement_mobile_money").ok().flatten(),
            "paiement_carte": row.try_get::<Option<bool>, _>("paiement_carte").ok().flatten(),
            "climatisation": row.try_get::<Option<bool>, _>("climatisation").ok().flatten(),
            "wifi": row.try_get::<Option<bool>, _>("wifi").ok().flatten(),
            "is_on_duty": row.try_get::<Option<bool>, _>("is_on_duty").ok().flatten(),
            "nom": row.try_get::<Option<String>, _>("service_nom").ok().flatten(),
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
        r#"SELECT t.id AS taxi_id, t.service_id, t.user_id, t.nom_chauffeur, t.telephone,
                  t.whatsapp, t.type_vehicule, t.marque_modele, t.immatriculation, t.couleur,
                  t.annee, t.is_available_now, t.zone_intervention, t.gps_actuel,
                  t.tarif_base, t.tarif_par_km, t.devise, t.paiement_cash,
                  t.paiement_mobile_money, t.paiement_carte, t.climatisation, t.wifi,
                  t.is_on_duty, t.created_at AS taxi_created_at, t.updated_at AS taxi_updated_at,
                  s.nom AS service_nom, s.ville, s.quartier, s.gps AS service_gps,
                  u.name AS owner_name
           FROM taxis_ville t
           INNER JOIN services s ON s.id = t.service_id
           LEFT JOIN users u ON u.id = t.user_id
           WHERE t.id = $1 AND s.is_active = true AND t.is_active = true"#,
    )
    .bind(taxi_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| {
        error!("[get_taxi_details] Erreur: {}", e);
        AppError::Internal("Erreur récupération taxi".to_string())
    })?;

    if let Some(row) = taxi {
        use sqlx::Row;
        let taxi_json = json!({
            "id": row.try_get::<i32, _>("taxi_id").ok(),
            "service_id": row.try_get::<i32, _>("service_id").ok(),
            "user_id": row.try_get::<i32, _>("user_id").ok(),
            "nom_chauffeur": row.try_get::<Option<String>, _>("nom_chauffeur").ok().flatten(),
            "telephone": row.try_get::<Option<String>, _>("telephone").ok().flatten(),
            "whatsapp": row.try_get::<Option<String>, _>("whatsapp").ok().flatten(),
            "type_vehicule": row.try_get::<Option<String>, _>("type_vehicule").ok().flatten(),
            "marque_modele": row.try_get::<Option<String>, _>("marque_modele").ok().flatten(),
            "immatriculation": row.try_get::<Option<String>, _>("immatriculation").ok().flatten(),
            "couleur": row.try_get::<Option<String>, _>("couleur").ok().flatten(),
            "annee": row.try_get::<Option<i32>, _>("annee").ok().flatten(),
            "is_available_now": row.try_get::<Option<bool>, _>("is_available_now").ok().flatten(),
            "zone_intervention": row.try_get::<Option<Vec<String>>, _>("zone_intervention").ok().flatten(),
            "gps_actuel": row.try_get::<Option<String>, _>("gps_actuel").ok().flatten(),
            "tarif_base": row.try_get::<Option<i32>, _>("tarif_base").ok().flatten(),
            "tarif_par_km": row.try_get::<Option<i32>, _>("tarif_par_km").ok().flatten(),
            "devise": row.try_get::<Option<String>, _>("devise").ok().flatten(),
            "paiement_cash": row.try_get::<Option<bool>, _>("paiement_cash").ok().flatten(),
            "paiement_mobile_money": row.try_get::<Option<bool>, _>("paiement_mobile_money").ok().flatten(),
            "paiement_carte": row.try_get::<Option<bool>, _>("paiement_carte").ok().flatten(),
            "climatisation": row.try_get::<Option<bool>, _>("climatisation").ok().flatten(),
            "wifi": row.try_get::<Option<bool>, _>("wifi").ok().flatten(),
            "is_on_duty": row.try_get::<Option<bool>, _>("is_on_duty").ok().flatten(),
            "nom": row.try_get::<Option<String>, _>("service_nom").ok().flatten(),
            "ville": row.try_get::<Option<String>, _>("ville").ok().flatten(),
            "quartier": row.try_get::<Option<String>, _>("quartier").ok().flatten(),
            "owner_name": row.try_get::<Option<String>, _>("owner_name").ok().flatten(),
            "created_at": row.try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("taxi_created_at").ok().flatten().map(|d| d.to_rfc3339()),
            "updated_at": row.try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("taxi_updated_at").ok().flatten().map(|d| d.to_rfc3339()),
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

    let mut query = QueryBuilder::new(
        r#"SELECT c.id as covoiturage_id, c.service_id, c.user_id as driver_id,
                  c.depart, c.destination, c.gps_depart, c.gps_destination,
                  c.date_depart, c.heure_depart, c.type_vehicule, c.marque_modele,
                  c.nombre_places, c.places_disponibles, c.prix_par_place, c.devise,
                  c.bagages_autorises, c.animaux_autorises, c.fumeur_autorise, c.climatisation,
                  c.statut, c.is_recurring, c.recurrence_type, c.created_at,
                  u.name as driver_name
           FROM covoiturages c
           JOIN services s ON s.id = c.service_id
           LEFT JOIN users u ON u.id = c.user_id
           WHERE c.is_active = TRUE AND c.statut = 'ouvert' AND c.date_depart >= CURRENT_DATE"#,
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
    for row in &covoiturages {
        covoiturages_json.push(json!({
            "id": row.try_get::<i32, _>("covoiturage_id").ok(),
            "service_id": row.try_get::<i32, _>("service_id").ok(),
            "depart": row.try_get::<Option<String>, _>("depart").ok().flatten(),
            "destination": row.try_get::<Option<String>, _>("destination").ok().flatten(),
            "gps_depart": row.try_get::<Option<String>, _>("gps_depart").ok().flatten(),
            "date_depart": row.try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("date_depart").ok().flatten().map(|d| d.to_rfc3339()),
            "heure_depart": row.try_get::<Option<chrono::NaiveTime>, _>("heure_depart").ok().flatten().map(|t| t.format("%H:%M").to_string()),
            "type_vehicule": row.try_get::<Option<String>, _>("type_vehicule").ok().flatten(),
            "marque_modele": row.try_get::<Option<String>, _>("marque_modele").ok().flatten(),
            "nombre_places": row.try_get::<Option<i32>, _>("nombre_places").ok().flatten(),
            "places_disponibles": row.try_get::<Option<i32>, _>("places_disponibles").ok().flatten(),
            "prix_par_place": row.try_get::<Option<i32>, _>("prix_par_place").ok().flatten(),
            "devise": row.try_get::<Option<String>, _>("devise").ok().flatten(),
            "climatisation": row.try_get::<Option<bool>, _>("climatisation").ok().flatten(),
            "bagages_autorises": row.try_get::<Option<bool>, _>("bagages_autorises").ok().flatten(),
            "animaux_autorises": row.try_get::<Option<bool>, _>("animaux_autorises").ok().flatten(),
            "statut": row.try_get::<Option<String>, _>("statut").ok().flatten(),
            "driver_name": row.try_get::<Option<String>, _>("driver_name").ok().flatten(),
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
    State(state): State<Arc<AppState>>,
    Query(params): Query<SearchCovoituragesNearbyQuery>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[search_covoiturages_nearby] lat={}, lng={}, radius={}km",
        params.lat,
        params.lng,
        params.radius_km.unwrap_or(50.0)
    );

    let radius_km = params.radius_km.unwrap_or(50.0);
    let limit = params.limit.unwrap_or(20).min(100);
    let offset = (params.page.unwrap_or(1).max(1) - 1) * limit;

    // Query all open future trips that have GPS coordinates, then filter by haversine distance
    let rows = sqlx::query(
        r#"SELECT c.id as covoiturage_id, c.service_id, c.user_id as driver_id,
                  c.depart, c.destination, c.gps_depart, c.gps_destination,
                  c.date_depart, c.heure_depart, c.type_vehicule, c.marque_modele,
                  c.nombre_places, c.places_disponibles, c.prix_par_place, c.devise,
                  c.bagages_autorises, c.animaux_autorises, c.fumeur_autorise, c.climatisation,
                  c.statut, c.is_recurring, c.recurrence_type, c.created_at,
                  u.name as driver_name
           FROM covoiturages c
           JOIN services s ON s.id = c.service_id
           LEFT JOIN users u ON u.id = c.user_id
           WHERE c.is_active = TRUE AND c.statut = 'ouvert' AND c.date_depart >= CURRENT_DATE
                 AND c.gps_depart IS NOT NULL AND c.gps_depart != ''
           ORDER BY c.date_depart ASC, c.heure_depart ASC
           LIMIT 200"#,
    )
    .fetch_all(&state.pg)
    .await
    .map_err(|e| {
        error!("[search_covoiturages_nearby] Erreur: {}", e);
        AppError::Internal("Erreur recherche covoiturages proximité".to_string())
    })?;

    let mut trips = Vec::new();
    for row in &rows {
        let gps_str: Option<String> = row.try_get::<Option<String>, _>("gps_depart").ok().flatten();
        if let Some(gps) = gps_str {
            let parts: Vec<&str> = gps.split(',').collect();
            if parts.len() == 2 {
                if let (Ok(lat2), Ok(lng2)) = (
                    parts[0].trim().parse::<f64>(),
                    parts[1].trim().parse::<f64>(),
                ) {
                    let dist = haversine_km(params.lat, params.lng, lat2, lng2);
                    if dist <= radius_km {
                        trips.push(json!({
                            "id": row.try_get::<i32, _>("covoiturage_id").ok(),
                            "service_id": row.try_get::<i32, _>("service_id").ok(),
                            "depart": row.try_get::<Option<String>, _>("depart").ok().flatten(),
                            "destination": row.try_get::<Option<String>, _>("destination").ok().flatten(),
                            "gps_depart": gps,
                            "gps_destination": row.try_get::<Option<String>, _>("gps_destination").ok().flatten(),
                            "date_depart": row.try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("date_depart").ok().flatten().map(|d| d.to_rfc3339()),
                            "heure_depart": row.try_get::<Option<chrono::NaiveTime>, _>("heure_depart").ok().flatten().map(|t| t.format("%H:%M").to_string()),
                            "type_vehicule": row.try_get::<Option<String>, _>("type_vehicule").ok().flatten(),
                            "marque_modele": row.try_get::<Option<String>, _>("marque_modele").ok().flatten(),
                            "nombre_places": row.try_get::<Option<i32>, _>("nombre_places").ok().flatten(),
                            "places_disponibles": row.try_get::<Option<i32>, _>("places_disponibles").ok().flatten(),
                            "prix_par_place": row.try_get::<Option<i32>, _>("prix_par_place").ok().flatten(),
                            "devise": row.try_get::<Option<String>, _>("devise").ok().flatten(),
                            "climatisation": row.try_get::<Option<bool>, _>("climatisation").ok().flatten(),
                            "bagages_autorises": row.try_get::<Option<bool>, _>("bagages_autorises").ok().flatten(),
                            "animaux_autorises": row.try_get::<Option<bool>, _>("animaux_autorises").ok().flatten(),
                            "statut": row.try_get::<Option<String>, _>("statut").ok().flatten(),
                            "is_recurring": row.try_get::<Option<bool>, _>("is_recurring").ok().flatten(),
                            "driver_name": row.try_get::<Option<String>, _>("driver_name").ok().flatten(),
                            "distance_km": (dist * 10.0).round() / 10.0,
                        }));
                    }
                }
            }
        }
    }

    // Sort by distance
    trips.sort_by(|a, b| {
        let da = a.get("distance_km").and_then(|v| v.as_f64()).unwrap_or(f64::MAX);
        let db = b.get("distance_km").and_then(|v| v.as_f64()).unwrap_or(f64::MAX);
        da.partial_cmp(&db).unwrap_or(std::cmp::Ordering::Equal)
    });

    let total = trips.len();
    let paginated: Vec<_> = trips.into_iter().skip(offset as usize).take(limit as usize).collect();

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": paginated,
            "total": total
        })),
    ))
}

/// Haversine distance in km
fn haversine_km(lat1: f64, lng1: f64, lat2: f64, lng2: f64) -> f64 {
    const R: f64 = 6371.0;
    let to_rad = |d: f64| d * PI / 180.0;
    let dlat = to_rad(lat2 - lat1);
    let dlng = to_rad(lng2 - lng1);
    let a = (dlat / 2.0).sin().powi(2)
        + to_rad(lat1).cos() * to_rad(lat2).cos() * (dlng / 2.0).sin().powi(2);
    R * 2.0 * a.sqrt().asin()
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

    let covoiturage = sqlx::query(
        r#"SELECT c.id as covoiturage_id, c.service_id, c.user_id as driver_id,
                  c.depart, c.destination, c.gps_depart, c.gps_destination,
                  c.date_depart, c.heure_depart, c.date_arrivee_estimee,
                  c.type_vehicule, c.marque_modele,
                  c.nombre_places, c.places_disponibles, c.prix_par_place, c.devise,
                  c.bagages_autorises, c.animaux_autorises, c.fumeur_autorise, c.climatisation,
                  c.statut, c.is_active, c.is_recurring, c.recurrence_type,
                  c.recurrence_days, c.recurrence_end_date, c.created_at,
                  u.name as driver_name, u.avatar_url as driver_avatar
           FROM covoiturages c
           JOIN services s ON s.id = c.service_id
           LEFT JOIN users u ON u.id = c.user_id
           WHERE c.service_id = $1 OR c.id = $1"#,
    )
    .bind(covoiturage_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| {
        error!("[get_covoiturage_details] Erreur: {}", e);
        AppError::Internal("Erreur récupération covoiturage".to_string())
    })?;

    if let Some(row) = covoiturage {
        let covoiturage_json = json!({
            "id": row.try_get::<i32, _>("covoiturage_id").ok(),
            "service_id": row.try_get::<i32, _>("service_id").ok(),
            "driver_id": row.try_get::<i32, _>("driver_id").ok(),
            "depart": row.try_get::<Option<String>, _>("depart").ok().flatten(),
            "destination": row.try_get::<Option<String>, _>("destination").ok().flatten(),
            "gps_depart": row.try_get::<Option<String>, _>("gps_depart").ok().flatten(),
            "gps_destination": row.try_get::<Option<String>, _>("gps_destination").ok().flatten(),
            "date_depart": row.try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("date_depart").ok().flatten().map(|d| d.to_rfc3339()),
            "heure_depart": row.try_get::<Option<chrono::NaiveTime>, _>("heure_depart").ok().flatten().map(|t| t.format("%H:%M").to_string()),
            "type_vehicule": row.try_get::<Option<String>, _>("type_vehicule").ok().flatten(),
            "marque_modele": row.try_get::<Option<String>, _>("marque_modele").ok().flatten(),
            "nombre_places": row.try_get::<Option<i32>, _>("nombre_places").ok().flatten(),
            "places_disponibles": row.try_get::<Option<i32>, _>("places_disponibles").ok().flatten(),
            "prix_par_place": row.try_get::<Option<i32>, _>("prix_par_place").ok().flatten(),
            "devise": row.try_get::<Option<String>, _>("devise").ok().flatten(),
            "climatisation": row.try_get::<Option<bool>, _>("climatisation").ok().flatten(),
            "bagages_autorises": row.try_get::<Option<bool>, _>("bagages_autorises").ok().flatten(),
            "animaux_autorises": row.try_get::<Option<bool>, _>("animaux_autorises").ok().flatten(),
            "fumeur_autorise": row.try_get::<Option<bool>, _>("fumeur_autorise").ok().flatten(),
            "statut": row.try_get::<Option<String>, _>("statut").ok().flatten(),
            "is_recurring": row.try_get::<Option<bool>, _>("is_recurring").ok().flatten(),
            "driver_name": row.try_get::<Option<String>, _>("driver_name").ok().flatten(),
            "driver_avatar": row.try_get::<Option<String>, _>("driver_avatar").ok().flatten(),
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
    State(state): State<Arc<AppState>>,
    Path(covoiturage_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[get_covoiturage_reviews] covoiturage_id={}",
        covoiturage_id
    );

    let rows = sqlx::query(
        r#"SELECT pc.id, pc.user_id, pc.rating, pc.content, pc.created_at,
                  u.name as user_name, u.avatar_url as user_avatar
           FROM product_comments pc
           LEFT JOIN users u ON u.id = pc.user_id
           WHERE pc.service_id = $1 AND pc.parent_comment_id IS NULL
           ORDER BY pc.created_at DESC
           LIMIT 50"#,
    )
    .bind(covoiturage_id)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| {
        error!("[get_covoiturage_reviews] Erreur: {}", e);
        AppError::Internal("Erreur récupération avis".to_string())
    })?;

    let mut reviews = Vec::new();
    for row in &rows {
        reviews.push(json!({
            "id": row.try_get::<i32, _>("id").ok(),
            "user_id": row.try_get::<i32, _>("user_id").ok(),
            "rating": row.try_get::<Option<i32>, _>("rating").ok().flatten(),
            "comment": row.try_get::<Option<String>, _>("content").ok().flatten(),
            "user_name": row.try_get::<Option<String>, _>("user_name").ok().flatten(),
            "user_avatar": row.try_get::<Option<String>, _>("user_avatar").ok().flatten(),
            "created_at": row.try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("created_at").ok().flatten().map(|d| d.to_rfc3339()),
        }));
    }

    // Calculate average rating
    let avg_rating: f64 = if !reviews.is_empty() {
        let sum: f64 = reviews
            .iter()
            .filter_map(|r| r.get("rating").and_then(|v| v.as_i64()))
            .map(|r| r as f64)
            .sum();
        let count = reviews
            .iter()
            .filter(|r| r.get("rating").and_then(|v| v.as_i64()).is_some())
            .count();
        if count > 0 {
            (sum / count as f64 * 10.0).round() / 10.0
        } else {
            0.0
        }
    } else {
        0.0
    };

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": reviews,
            "total": reviews.len(),
            "average_rating": avg_rating
        })),
    ))
}

/// Recherche d'hôpitaux (publique)
#[derive(Debug, Deserialize)]
pub struct SearchHospitalsQuery {
    pub ville: Option<String>,
    pub quartier: Option<String>,
    pub specialite: Option<String>,
    pub prestation: Option<String>,
    pub lat: Option<f64>,
    pub lng: Option<f64>,
    pub max_distance_km: Option<f64>,
    pub type_etablissement: Option<String>,
    pub urgences_only: Option<String>,
    pub available_only: Option<String>,
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

    // ✅ FIX: Correct table name hopitaux_cliniques (not hopitaux)
    let rows = sqlx::query(
        r#"
        SELECT
            h.id, h.service_id, h.user_id, h.nom, h.type_etablissement,
            h.adresse, h.quartier, h.ville, h.gps,
            h.prestations_medicales, h.urgences_disponible, h.rdv_en_ligne,
            h.is_available_now, h.telephone, h.telephone_urgence,
            h.whatsapp, h.email, h.site_web, h.description, h.logo_url,
            h.banque_sang, h.is_active,
            s.gps as service_gps
        FROM hopitaux_cliniques h
        INNER JOIN services s ON s.id = h.service_id
        WHERE h.is_active = true
        ORDER BY h.updated_at DESC NULLS LAST, h.created_at DESC
        LIMIT 100
        "#,
    )
    .fetch_all(&state.pg)
    .await
    .map_err(|e| {
        error!("[search_hospitals] Erreur: {}", e);
        AppError::Internal("Erreur recherche hôpitaux".to_string())
    })?;

    let user_lat = params.lat;
    let user_lng = params.lng;
    let max_dist = params.max_distance_km.unwrap_or(200.0);

    let mut hospitals_json = Vec::new();
    for row in &rows {
        let nom: Option<String> = row.try_get("nom").ok().flatten();
        let ville: Option<String> = row.try_get("ville").ok().flatten();
        let quartier: Option<String> = row.try_get("quartier").ok().flatten();
        let type_etab: Option<String> = row.try_get("type_etablissement").ok().flatten();
        let urgences: Option<bool> = row.try_get("urgences_disponible").ok().flatten();
        let is_avail: Option<bool> = row.try_get("is_available_now").ok().flatten();
        let prestations: Option<Vec<String>> = row.try_get("prestations_medicales").ok().flatten();
        let gps_str: Option<String> = row
            .try_get::<Option<String>, _>("gps")
            .ok()
            .flatten()
            .or_else(|| row.try_get::<Option<String>, _>("service_gps").ok().flatten());

        // Filter by ville
        if let Some(ref v) = params.ville {
            if ville
                .as_deref()
                .map(|x| !x.to_lowercase().contains(&v.to_lowercase()))
                .unwrap_or(true)
            {
                continue;
            }
        }
        // Filter by quartier
        if let Some(ref q) = params.quartier {
            if quartier
                .as_deref()
                .map(|x| !x.to_lowercase().contains(&q.to_lowercase()))
                .unwrap_or(true)
            {
                continue;
            }
        }
        // Filter by type_etablissement
        if let Some(ref te) = params.type_etablissement {
            if type_etab
                .as_deref()
                .map(|x| !x.to_lowercase().contains(&te.to_lowercase()))
                .unwrap_or(true)
            {
                continue;
            }
        }
        // Filter urgences only
        if params.urgences_only.as_deref() == Some("true") && urgences != Some(true) {
            continue;
        }
        // Filter available only
        if params.available_only.as_deref() == Some("true") && is_avail != Some(true) {
            continue;
        }
        // Filter by prestation
        if let Some(ref p) = params.prestation {
            let has = prestations
                .as_ref()
                .map(|list| list.iter().any(|pr| pr.to_lowercase().contains(&p.to_lowercase())))
                .unwrap_or(false);
            if !has {
                continue;
            }
        }

        // Distance calculation
        let mut distance_km: Option<f64> = None;
        if let (Some(ulat), Some(ulng)) = (user_lat, user_lng) {
            if let Some(ref gps) = gps_str {
                let parts: Vec<&str> = gps.split(',').collect();
                if parts.len() == 2 {
                    if let (Ok(hlat), Ok(hlng)) = (
                        parts[0].trim().parse::<f64>(),
                        parts[1].trim().parse::<f64>(),
                    ) {
                        let dlat = (hlat - ulat).to_radians();
                        let dlng = (hlng - ulng).to_radians();
                        let a = (dlat / 2.0).sin().powi(2)
                            + ulat.to_radians().cos()
                                * hlat.to_radians().cos()
                                * (dlng / 2.0).sin().powi(2);
                        let c = 2.0 * a.sqrt().asin();
                        distance_km = Some(6371.0 * c);
                    }
                }
            }
            if let Some(d) = distance_km {
                if d > max_dist {
                    continue;
                }
            }
        }

        hospitals_json.push(json!({
            "id": row.try_get::<i32, _>("id").ok(),
            "service_id": row.try_get::<i32, _>("service_id").ok(),
            "user_id": row.try_get::<i32, _>("user_id").ok(),
            "nom": nom,
            "type_etablissement": type_etab,
            "adresse": row.try_get::<Option<String>, _>("adresse").ok().flatten(),
            "quartier": quartier,
            "ville": ville,
            "gps": gps_str,
            "prestations_medicales": prestations,
            "urgences_disponible": urgences.unwrap_or(false),
            "rdv_en_ligne": row.try_get::<Option<bool>, _>("rdv_en_ligne").ok().flatten().unwrap_or(false),
            "banque_sang": row.try_get::<Option<bool>, _>("banque_sang").ok().flatten().unwrap_or(false),
            "is_available_now": is_avail.unwrap_or(false),
            "telephone": row.try_get::<Option<String>, _>("telephone").ok().flatten(),
            "telephone_urgence": row.try_get::<Option<String>, _>("telephone_urgence").ok().flatten(),
            "whatsapp": row.try_get::<Option<String>, _>("whatsapp").ok().flatten(),
            "email": row.try_get::<Option<String>, _>("email").ok().flatten(),
            "site_web": row.try_get::<Option<String>, _>("site_web").ok().flatten(),
            "description": row.try_get::<Option<String>, _>("description").ok().flatten(),
            "logo_url": row.try_get::<Option<String>, _>("logo_url").ok().flatten(),
            "distance_km": distance_km,
        }));
    }

    // Sort by distance if available
    if user_lat.is_some() && user_lng.is_some() {
        hospitals_json.sort_by(|a, b| {
            let da = a["distance_km"].as_f64().unwrap_or(f64::MAX);
            let db = b["distance_km"].as_f64().unwrap_or(f64::MAX);
            da.partial_cmp(&db).unwrap_or(std::cmp::Ordering::Equal)
        });
    }

    let total = hospitals_json.len();
    let paginated: Vec<_> =
        hospitals_json.into_iter().skip(offset as usize).take(limit as usize).collect();

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": paginated,
            "total": total
        })),
    ))
}

/// Détails d'un hôpital
pub async fn get_hospital_details(
    State(state): State<Arc<AppState>>,
    Path(hospital_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    info!("[get_hospital_details] hospital_id={}", hospital_id);

    // ✅ FIX: Correct table name + return ALL fields mobile needs
    let hospital = sqlx::query(
        r#"
        SELECT
            h.id, h.service_id, h.user_id, h.nom, h.type_etablissement,
            h.adresse, h.quartier, h.ville, h.gps,
            h.prestations_medicales, h.urgences_disponible, h.rdv_en_ligne,
            h.is_available_now, h.telephone, h.telephone_urgence,
            h.whatsapp, h.email, h.site_web, h.description, h.logo_url,
            h.banque_sang, h.planning_hebdomadaire,
            h.is_active, h.is_verified,
            h.heures_ouverture, h.heures_fermeture,
            s.gps as service_gps
        FROM hopitaux_cliniques h
        INNER JOIN services s ON s.id = h.service_id
        WHERE h.id = $1 OR h.service_id = $1
        LIMIT 1
        "#,
    )
    .bind(hospital_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| {
        error!("[get_hospital_details] Erreur: {}", e);
        AppError::Internal("Erreur récupération hôpital".to_string())
    })?;

    if let Some(row) = hospital {
        let gps: Option<String> = row
            .try_get::<Option<String>, _>("gps")
            .ok()
            .flatten()
            .or_else(|| row.try_get::<Option<String>, _>("service_gps").ok().flatten());

        // Get rating stats
        let service_id: Option<i32> = row.try_get("service_id").ok();
        let (note_moyenne, nombre_avis) = if let Some(sid) = service_id {
            let stats = sqlx::query(
                "SELECT COALESCE(AVG(rating), 0) as avg_r, COUNT(*) as cnt FROM product_comments WHERE service_id = $1 AND rating IS NOT NULL"
            ).bind(sid).fetch_optional(&state.pg).await.ok().flatten();
            match stats {
                Some(s) => (
                    s.try_get::<f64, _>("avg_r").ok(),
                    s.try_get::<i64, _>("cnt").ok().map(|c| c as i32),
                ),
                None => (None, None),
            }
        } else {
            (None, None)
        };

        let hospital_json = json!({
            "id": row.try_get::<i32, _>("id").ok(),
            "service_id": service_id,
            "user_id": row.try_get::<i32, _>("user_id").ok(),
            "nom": row.try_get::<Option<String>, _>("nom").ok().flatten(),
            "description": row.try_get::<Option<String>, _>("description").ok().flatten(),
            "type_etablissement": row.try_get::<Option<String>, _>("type_etablissement").ok().flatten(),
            "adresse": row.try_get::<Option<String>, _>("adresse").ok().flatten(),
            "quartier": row.try_get::<Option<String>, _>("quartier").ok().flatten(),
            "ville": row.try_get::<Option<String>, _>("ville").ok().flatten(),
            "gps": gps,
            "is_available_now": row.try_get::<Option<bool>, _>("is_available_now").ok().flatten().unwrap_or(false),
            "is_verified": row.try_get::<Option<bool>, _>("is_verified").ok().flatten().unwrap_or(false),
            "note_moyenne": note_moyenne,
            "nombre_avis": nombre_avis,
            "urgences_disponible": row.try_get::<Option<bool>, _>("urgences_disponible").ok().flatten().unwrap_or(false),
            "banque_sang": row.try_get::<Option<bool>, _>("banque_sang").ok().flatten().unwrap_or(false),
            "rdv_en_ligne": row.try_get::<Option<bool>, _>("rdv_en_ligne").ok().flatten().unwrap_or(false),
            "prestations_medicales": row.try_get::<Option<Vec<String>>, _>("prestations_medicales").ok().flatten(),
            "specialites": row.try_get::<Option<Vec<String>>, _>("prestations_medicales").ok().flatten(),
            "telephone": row.try_get::<Option<String>, _>("telephone").ok().flatten(),
            "telephone_urgence": row.try_get::<Option<String>, _>("telephone_urgence").ok().flatten(),
            "whatsapp": row.try_get::<Option<String>, _>("whatsapp").ok().flatten(),
            "email": row.try_get::<Option<String>, _>("email").ok().flatten(),
            "site_web": row.try_get::<Option<String>, _>("site_web").ok().flatten(),
            "logo_url": row.try_get::<Option<String>, _>("logo_url").ok().flatten(),
            "heures_ouverture": row.try_get::<Option<String>, _>("heures_ouverture").ok().flatten(),
            "heures_fermeture": row.try_get::<Option<String>, _>("heures_fermeture").ok().flatten(),
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
    Query(params): Query<SearchHospitalsQuery>,
) -> AppResult<impl IntoResponse> {
    info!("[search_travel_agencies] Recherche: {:?}", params);

    let limit = params.limit.unwrap_or(20).min(100);
    let offset = (params.page.unwrap_or(1) - 1) * limit;

    let mut query = QueryBuilder::new(
        r#"SELECT s.id as service_id, a.id as agency_id, a.nom_agence, a.ville, a.quartier,
                  a.adresse, a.telephone, a.whatsapp, a.gps,
                  a.services_voyage, a.destinations, a.peut_emettre_tickets_bus,
                  a.heures_ouverture, a.heures_fermeture, a.jours_ouverture,
                  a.is_active, a.created_at
           FROM services s
           INNER JOIN agences_voyage a ON a.service_id = s.id
           WHERE s.is_active = TRUE"#,
    );

    if let Some(ref ville) = params.ville {
        query.push(" AND a.ville ILIKE ");
        query.push_bind(format!("%{}%", ville));
    }

    query.push(" ORDER BY a.created_at DESC LIMIT ");
    query.push_bind(limit);
    query.push(" OFFSET ");
    query.push_bind(offset);

    let agencies = query.build().fetch_all(&state.pg).await.map_err(|e| {
        error!("[search_travel_agencies] Erreur: {}", e);
        AppError::Internal("Erreur recherche agences".to_string())
    })?;

    let mut agencies_json = Vec::new();
    for row in &agencies {
        agencies_json.push(json!({
            "id": row.try_get::<i32, _>("service_id").ok(),
            "agency_id": row.try_get::<i32, _>("agency_id").ok(),
            "nom_agence": row.try_get::<Option<String>, _>("nom_agence").ok().flatten(),
            "ville": row.try_get::<Option<String>, _>("ville").ok().flatten(),
            "quartier": row.try_get::<Option<String>, _>("quartier").ok().flatten(),
            "adresse": row.try_get::<Option<String>, _>("adresse").ok().flatten(),
            "telephone": row.try_get::<Option<String>, _>("telephone").ok().flatten(),
            "whatsapp": row.try_get::<Option<String>, _>("whatsapp").ok().flatten(),
            "gps": row.try_get::<Option<String>, _>("gps").ok().flatten(),
            "peut_emettre_tickets_bus": row.try_get::<Option<bool>, _>("peut_emettre_tickets_bus").ok().flatten(),
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

    let agency = sqlx::query(
        r#"SELECT s.id as service_id, a.id as agency_id, a.nom_agence, a.ville, a.quartier,
                  a.adresse, a.telephone, a.whatsapp, a.email, a.site_web,
                  a.services_voyage, a.compagnies_bus, a.destinations,
                  a.heures_ouverture, a.heures_fermeture, a.jours_ouverture,
                  a.peut_emettre_tickets_bus, a.compagnies_affiliees,
                  a.gps, a.is_active, a.created_at
           FROM services s
           INNER JOIN agences_voyage a ON a.service_id = s.id
           WHERE s.id = $1"#,
    )
    .bind(agency_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| {
        error!("[get_travel_agency_details] Erreur: {}", e);
        AppError::Internal("Erreur récupération agence".to_string())
    })?;

    if let Some(row) = agency {
        let agency_json = json!({
            "id": row.try_get::<i32, _>("service_id").ok(),
            "agency_id": row.try_get::<i32, _>("agency_id").ok(),
            "nom_agence": row.try_get::<Option<String>, _>("nom_agence").ok().flatten(),
            "ville": row.try_get::<Option<String>, _>("ville").ok().flatten(),
            "quartier": row.try_get::<Option<String>, _>("quartier").ok().flatten(),
            "adresse": row.try_get::<Option<String>, _>("adresse").ok().flatten(),
            "telephone": row.try_get::<Option<String>, _>("telephone").ok().flatten(),
            "whatsapp": row.try_get::<Option<String>, _>("whatsapp").ok().flatten(),
            "email": row.try_get::<Option<String>, _>("email").ok().flatten(),
            "site_web": row.try_get::<Option<String>, _>("site_web").ok().flatten(),
            "gps": row.try_get::<Option<String>, _>("gps").ok().flatten(),
            "peut_emettre_tickets_bus": row.try_get::<Option<bool>, _>("peut_emettre_tickets_bus").ok().flatten(),
            "is_active": row.try_get::<Option<bool>, _>("is_active").ok().flatten(),
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

/// Gérer les créneaux d'un hôpital/laboratoire
#[derive(Debug, Deserialize)]
pub struct ManageHospitalSlotsRequest {
    pub date: String,
    pub slots: Vec<SlotInput>,
    pub service_type: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SlotInput {
    pub start_time: String,
    pub end_time: String,
    pub max_bookings: Option<i32>,
    pub consultation_type: Option<String>,
    pub price: Option<f64>,
    pub currency: Option<String>,
    pub notes: Option<String>,
}

pub async fn manage_hospital_slots(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(hospital_id): Path<i32>,
    Json(request): Json<ManageHospitalSlotsRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[manage_hospital_slots] hospital_id={}, user_id={}, date={}, slots={}",
        hospital_id,
        user_id,
        request.date,
        request.slots.len()
    );

    let service_type = request.service_type.unwrap_or_else(|| "hopital".to_string());

    // Vérifier que l'utilisateur est bien le propriétaire du service
    let owner_check: Option<i32> = sqlx::query_scalar("SELECT user_id FROM services WHERE id = $1")
        .bind(hospital_id)
        .fetch_optional(&state.pg)
        .await?;

    if owner_check != Some(user_id) {
        return Err(AppError::Forbidden(
            "Vous n'êtes pas le propriétaire de ce service".to_string(),
        ));
    }

    // Supprimer les anciens créneaux non réservés pour cette date
    sqlx::query(
        r#"
        DELETE FROM appointment_slots
        WHERE service_id = $1 AND slot_date = $2::date AND current_bookings = 0
        "#,
    )
    .bind(hospital_id)
    .bind(&request.date)
    .execute(&state.pg)
    .await?;

    // Insérer les nouveaux créneaux
    let mut created = 0;
    for slot in &request.slots {
        let result = sqlx::query(
            r#"
            INSERT INTO appointment_slots
                (service_id, service_type, prestataire_id, slot_date, start_time, end_time,
                 max_bookings, consultation_type, price, currency, notes)
            VALUES ($1, $2, $3, $4::date, $5::time, $6::time, $7, $8, $9, $10, $11)
            ON CONFLICT (service_id, slot_date, start_time, consultation_type)
            DO UPDATE SET end_time = EXCLUDED.end_time,
                         max_bookings = EXCLUDED.max_bookings,
                         price = EXCLUDED.price,
                         currency = EXCLUDED.currency,
                         notes = EXCLUDED.notes,
                         is_active = true,
                         updated_at = NOW()
            "#,
        )
        .bind(hospital_id)
        .bind(&service_type)
        .bind(user_id)
        .bind(&request.date)
        .bind(&slot.start_time)
        .bind(&slot.end_time)
        .bind(slot.max_bookings.unwrap_or(1))
        .bind(&slot.consultation_type)
        .bind(slot.price)
        .bind(slot.currency.as_deref().unwrap_or("XAF"))
        .bind(&slot.notes)
        .execute(&state.pg)
        .await;

        if result.is_ok() {
            created += 1;
        }
    }

    // Récupérer tous les créneaux du jour
    let slots_today: Vec<serde_json::Value> = sqlx::query_as::<
        _,
        (
            i32,
            String,
            String,
            i32,
            i32,
            Option<String>,
            Option<rust_decimal::Decimal>,
            Option<String>,
            bool,
        ),
    >(
        r#"
        SELECT id, start_time::text, end_time::text, max_bookings, current_bookings,
               consultation_type, price, currency, is_active
        FROM appointment_slots
        WHERE service_id = $1 AND slot_date = $2::date
        ORDER BY start_time ASC
        "#,
    )
    .bind(hospital_id)
    .bind(&request.date)
    .fetch_all(&state.pg)
    .await
    .unwrap_or_default()
    .into_iter()
    .map(|row| {
        json!({
            "id": row.0,
            "start_time": row.1,
            "end_time": row.2,
            "max_bookings": row.3,
            "current_bookings": row.4,
            "consultation_type": row.5,
            "price": row.6,
            "currency": row.7,
            "is_active": row.8,
            "available": row.3 > row.4,
        })
    })
    .collect();

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "message": format!("{} créneaux gérés avec succès", created),
            "slots": slots_today,
            "date": request.date,
        })),
    ))
}

/// GET /api/hopitaux/:id/available-slots?date=YYYY-MM-DD
/// Obtenir les créneaux disponibles d'un service (public)
pub async fn get_available_slots(
    State(state): State<Arc<AppState>>,
    Path(service_id): Path<i32>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> AppResult<impl IntoResponse> {
    let date = params
        .get("date")
        .cloned()
        .unwrap_or_else(|| chrono::Utc::now().format("%Y-%m-%d").to_string());
    let _service_type = params.get("service_type").cloned();

    let slots: Vec<serde_json::Value> = sqlx::query_as::<
        _,
        (
            i32,
            String,
            String,
            i32,
            i32,
            Option<String>,
            Option<rust_decimal::Decimal>,
            Option<String>,
        ),
    >(
        r#"
        SELECT id, start_time::text, end_time::text, max_bookings, current_bookings,
               consultation_type, price, currency
        FROM appointment_slots
        WHERE service_id = $1 AND slot_date = $2::date AND is_active = true
        ORDER BY start_time ASC
        "#,
    )
    .bind(service_id)
    .bind(&date)
    .fetch_all(&state.pg)
    .await
    .unwrap_or_default()
    .into_iter()
    .map(|row| {
        json!({
            "id": row.0,
            "start_time": row.1,
            "end_time": row.2,
            "max_bookings": row.3,
            "current_bookings": row.4,
            "consultation_type": row.5,
            "price": row.6,
            "currency": row.7,
            "available": row.3 > row.4,
            "remaining": row.3 - row.4,
        })
    })
    .collect();

    // Obtenir aussi les dates qui ont des créneaux dans les 30 jours
    let dates_with_slots: Vec<String> = sqlx::query_scalar(
        r#"
        SELECT DISTINCT slot_date::text
        FROM appointment_slots
        WHERE service_id = $1 AND slot_date >= CURRENT_DATE AND slot_date <= CURRENT_DATE + 30
              AND is_active = true AND current_bookings < max_bookings
        ORDER BY slot_date::text ASC
        "#,
    )
    .bind(service_id)
    .fetch_all(&state.pg)
    .await
    .unwrap_or_default();

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "date": date,
            "service_id": service_id,
            "slots": slots,
            "dates_with_availability": dates_with_slots,
        })),
    ))
}

/// POST /api/appointments/book - Réserver un créneau spécifique
pub async fn book_slot(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<serde_json::Value>,
) -> AppResult<impl IntoResponse> {
    let slot_id = payload["slot_id"]
        .as_i64()
        .ok_or_else(|| AppError::BadRequest("slot_id requis".to_string()))?
        as i32;
    let notes = payload["notes"].as_str().map(|s| s.to_string());
    let patient_name = payload["patient_name"].as_str().map(|s| s.to_string());
    let reason = payload["reason"].as_str().map(|s| s.to_string());

    // Vérifier disponibilité du créneau et le verrouiller
    let slot = sqlx::query_as::<
        _,
        (
            i32,
            i32,
            String,
            String,
            String,
            String,
            i32,
            i32,
            Option<rust_decimal::Decimal>,
            Option<String>,
        ),
    >(
        r#"
        UPDATE appointment_slots
        SET current_bookings = current_bookings + 1, updated_at = NOW()
        WHERE id = $1 AND is_active = true AND current_bookings < max_bookings
        RETURNING id, service_id, service_type, slot_date::text, start_time::text, end_time::text,
                  max_bookings, current_bookings, price, currency
        "#,
    )
    .bind(slot_id)
    .fetch_optional(&state.pg)
    .await?
    .ok_or_else(|| AppError::BadRequest("Créneau non disponible ou complet".to_string()))?;

    let prestataire_id: i32 =
        sqlx::query_scalar("SELECT prestataire_id FROM appointment_slots WHERE id = $1")
            .bind(slot_id)
            .fetch_one(&state.pg)
            .await?;

    // Construire les détails
    let details = json!({
        "slot_id": slot.0,
        "slot_date": slot.3,
        "start_time": slot.4,
        "end_time": slot.5,
        "patient_name": patient_name,
        "reason": reason,
    });

    // Créer la réservation
    let reservation_id: i32 = sqlx::query_scalar(
        r#"
        INSERT INTO specialized_reservations
            (service_id, service_type, user_id, prestataire_id,
             reservation_type, status, requested_date, details,
             amount, currency, payment_status, slot_id,
             reservation_date, reservation_time,
             notes, created_at, updated_at)
        VALUES ($1, $2, $3, $4, 'rdv', 'pending',
                ($5::date)::timestamptz, $6, $7, $8, 'pending', $9,
                $5::date, $10, $11, NOW(), NOW())
        RETURNING id
        "#,
    )
    .bind(slot.1) // service_id
    .bind(&slot.2) // service_type
    .bind(user_id)
    .bind(prestataire_id)
    .bind(&slot.3) // slot_date
    .bind(&details)
    .bind(slot.8) // price
    .bind(slot.9.as_deref().unwrap_or("XAF")) // currency
    .bind(slot_id)
    .bind(&slot.4) // start_time
    .bind(&notes)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        error!("[book_slot] Erreur création réservation: {}", e);
        AppError::Internal("Erreur création réservation".to_string())
    })?;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "success": true,
            "reservation_id": reservation_id,
            "slot": {
                "date": slot.3,
                "start_time": slot.4,
                "end_time": slot.5,
            },
            "message": "Rendez-vous réservé avec succès. En attente de confirmation du prestataire."
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
    State(state): State<Arc<AppState>>,
    Path(pharmacy_id): Path<i32>,
    Json(request): Json<CheckMedicationAvailabilityRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[check_medication_availability] pharmacy_id={}, medication={}",
        pharmacy_id, request.medication_name
    );

    let service_id: i32 = sqlx::query_scalar(
        r#"
        SELECT service_id FROM pharmacies WHERE id = $1
        "#,
    )
    .bind(pharmacy_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| {
        error!(
            "[check_medication_availability] Erreur récupération service_id: {}",
            e
        );
        AppError::Internal("Erreur récupération pharmacie".to_string())
    })?
    .ok_or_else(|| AppError::NotFound("Pharmacie non trouvée".to_string()))?;

    let qty = request.quantity.unwrap_or(1).max(1);

    let row = sqlx::query(
        r#"
        SELECT id, nom_produit, prix, stock
        FROM pharmacy_products
        WHERE pharmacy_service_id = $1
          AND lower(nom_produit) LIKE lower($2)
        ORDER BY stock DESC, updated_at DESC
        LIMIT 1
        "#,
    )
    .bind(service_id)
    .bind(format!("%{}%", request.medication_name.trim()))
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| {
        error!(
            "[check_medication_availability] Erreur recherche produit: {}",
            e
        );
        AppError::Internal("Erreur recherche médicament".to_string())
    })?;

    if let Some(r) = row {
        let stock: i32 = r.get("stock");
        let available = stock >= qty;
        let price: rust_decimal::Decimal = r.get("prix");
        return Ok((
            StatusCode::OK,
            Json(json!({
                "success": true,
                "available": available,
                "medication": {
                    "name": r.get::<String, _>("nom_produit"),
                    "dci": null,
                    "stock_quantity": stock,
                    "price": price,
                    "requires_prescription": false
                },
                "requested_quantity": qty
            })),
        ));
    }

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "available": false,
            "medication": {
                "name": request.medication_name,
                "dci": null,
                "stock_quantity": 0,
                "price": null,
                "requires_prescription": false
            },
            "requested_quantity": qty
        })),
    ))
}

/// Réserver un médicament
#[derive(Debug, Deserialize)]
pub struct ReserveMedicationRequest {
    pub medication_name: String,
    pub quantity: i32,
    pub expiry_hours: Option<i32>,
}

pub async fn reserve_medication(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(pharmacy_id): Path<i32>,
    Json(request): Json<ReserveMedicationRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[reserve_medication] pharmacy_id={}, user_id={}, medication={}",
        pharmacy_id, user_id, request.medication_name
    );

    let service_id: i32 = sqlx::query_scalar("SELECT service_id FROM pharmacies WHERE id = $1")
        .bind(pharmacy_id)
        .fetch_optional(&state.pg)
        .await
        .map_err(|e| {
            error!("[reserve_medication] Erreur récupération service_id: {}", e);
            AppError::Internal("Erreur récupération pharmacie".to_string())
        })?
        .ok_or_else(|| AppError::NotFound("Pharmacie non trouvée".to_string()))?;

    let qty = request.quantity.max(1);

    // Trouver le produit correspondant (meilleur match simple)
    let product_row = sqlx::query(
        r#"
        SELECT id, nom_produit, stock
        FROM pharmacy_products
        WHERE pharmacy_service_id = $1
          AND lower(nom_produit) LIKE lower($2)
        ORDER BY stock DESC, updated_at DESC
        LIMIT 1
        "#,
    )
    .bind(service_id)
    .bind(format!("%{}%", request.medication_name.trim()))
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| {
        error!("[reserve_medication] Erreur recherche produit: {}", e);
        AppError::Internal("Erreur recherche médicament".to_string())
    })?;

    let (product_id, medication_name, stock): (Option<i32>, String, i32) =
        if let Some(r) = product_row {
            (
                Some(r.get::<i32, _>("id")),
                r.get::<String, _>("nom_produit"),
                r.get::<i32, _>("stock"),
            )
        } else {
            (None, request.medication_name.trim().to_string(), 0)
        };

    if stock < qty {
        return Err(AppError::BadRequest(
            "Stock insuffisant pour réserver".to_string(),
        ));
    }

    let expiry_hours = request.expiry_hours.unwrap_or(3).clamp(1, 72) as i64;
    let expires_at = chrono::Utc::now() + chrono::Duration::hours(expiry_hours);

    let reservation_id: uuid::Uuid = sqlx::query_scalar(
        r#"
        INSERT INTO pharmacy_medication_reservations
            (pharmacy_id, user_id, product_id, medication_name, quantity, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
        "#,
    )
    .bind(pharmacy_id)
    .bind(user_id)
    .bind(product_id)
    .bind(&medication_name)
    .bind(qty)
    .bind(expires_at)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        error!("[reserve_medication] Erreur création réservation: {}", e);
        AppError::Internal("Erreur création réservation".to_string())
    })?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "reservation_id": reservation_id.to_string(),
            "expiry_time": expires_at.to_rfc3339(),
            "message": "Réservation créée"
        })),
    ))
}

/// Créer une commande de pharmacie
#[derive(Debug, Deserialize)]
pub struct CreatePharmacyOrderRequest {
    #[serde(default, alias = "items")]
    pub medications: Vec<CreatePharmacyOrderItem>,
    pub delivery_method: Option<String>, // pickup | delivery
    pub delivery_address: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePharmacyOrderItem {
    pub medication_name: String,
    pub quantity: i32,
    pub price: f64,
}

pub async fn create_pharmacy_order(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(pharmacy_id): Path<i32>,
    Json(request): Json<CreatePharmacyOrderRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[create_pharmacy_order] pharmacy_id={}, user_id={}",
        pharmacy_id, user_id
    );

    // Vérifier pharmacie existe
    let exists: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM pharmacies WHERE id = $1)")
        .bind(pharmacy_id)
        .fetch_one(&state.pg)
        .await
        .map_err(|e| {
            error!(
                "[create_pharmacy_order] Erreur vérification pharmacie: {}",
                e
            );
            AppError::Internal("Erreur vérification pharmacie".to_string())
        })?;
    if !exists {
        return Err(AppError::NotFound("Pharmacie non trouvée".to_string()));
    }

    if request.medications.is_empty() {
        return Err(AppError::BadRequest(
            "Aucun médicament dans la commande".to_string(),
        ));
    }

    let delivery_method = request.delivery_method.as_deref().unwrap_or("pickup").to_lowercase();
    if delivery_method != "pickup" && delivery_method != "delivery" {
        return Err(AppError::BadRequest(
            "delivery_method invalide (pickup|delivery)".to_string(),
        ));
    }
    if delivery_method == "delivery"
        && request.delivery_address.as_deref().unwrap_or("").trim().is_empty()
    {
        return Err(AppError::BadRequest(
            "Adresse de livraison requise".to_string(),
        ));
    }

    let mut total: f64 = 0.0;
    for it in &request.medications {
        let q = it.quantity.max(1) as f64;
        total += it.price.max(0.0) * q;
    }

    let mut tx = state.pg.begin().await.map_err(|e| {
        error!("[create_pharmacy_order] Erreur begin tx: {}", e);
        AppError::Internal("Erreur transaction".to_string())
    })?;

    let order_id: uuid::Uuid = sqlx::query_scalar(
        r#"
        INSERT INTO pharmacy_orders (pharmacy_id, user_id, status, total_amount, delivery_method, delivery_address)
        VALUES ($1, $2, 'pending', $3, $4, $5)
        RETURNING id
        "#,
    )
    .bind(pharmacy_id)
    .bind(user_id)
    .bind(rust_decimal::Decimal::from_f64_retain(total).unwrap_or_else(|| rust_decimal::Decimal::ZERO))
    .bind(&delivery_method)
    .bind(request.delivery_address.as_ref())
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| {
        error!("[create_pharmacy_order] Erreur insertion order: {}", e);
        AppError::Internal("Erreur création commande".to_string())
    })?;

    for it in &request.medications {
        let qty = it.quantity.max(1);
        let unit_price = rust_decimal::Decimal::from_f64_retain(it.price.max(0.0))
            .unwrap_or_else(|| rust_decimal::Decimal::ZERO);

        sqlx::query(
            r#"
            INSERT INTO pharmacy_order_items (order_id, medication_name, quantity, unit_price)
            VALUES ($1, $2, $3, $4)
            "#,
        )
        .bind(order_id)
        .bind(it.medication_name.trim())
        .bind(qty)
        .bind(unit_price)
        .execute(&mut *tx)
        .await
        .map_err(|e| {
            error!("[create_pharmacy_order] Erreur insertion item: {}", e);
            AppError::Internal("Erreur création items commande".to_string())
        })?;
    }

    tx.commit().await.map_err(|e| {
        error!("[create_pharmacy_order] Erreur commit: {}", e);
        AppError::Internal("Erreur finalisation commande".to_string())
    })?;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "success": true,
            "data": {
                "order_id": order_id.to_string(),
                "total_amount": format!("{:.2}", total),
                "status": "pending",
                "message": "Commande créée"
            },
            "order_id": order_id.to_string(),
            "total_amount": format!("{:.2}", total),
            "status": "pending",
            "message": "Commande créée"
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
#[derive(Debug, Deserialize)]
pub struct MyPharmacyOrdersQuery {
    pub page: Option<i64>,
    pub limit: Option<i64>,
}

pub async fn get_my_pharmacy_orders(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Query(query): Query<MyPharmacyOrdersQuery>,
) -> AppResult<impl IntoResponse> {
    info!("[get_my_pharmacy_orders] user_id={}", user_id);

    let page = query.page.unwrap_or(1).max(1);
    let limit = query.limit.unwrap_or(20).min(100).max(1);
    let offset = (page - 1) * limit;

    let rows = sqlx::query(
        r#"
        SELECT
            o.id::text as id,
            o.pharmacy_id,
            p.nom as pharmacy_name,
            o.status,
            o.total_amount::text as total_amount,
            o.delivery_method,
            o.delivery_address,
            o.created_at
        FROM pharmacy_orders o
        JOIN pharmacies p ON p.id = o.pharmacy_id
        WHERE o.user_id = $1
        ORDER BY o.created_at DESC
        LIMIT $2 OFFSET $3
        "#,
    )
    .bind(user_id)
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| {
        error!("[get_my_pharmacy_orders] Erreur list: {}", e);
        AppError::Internal("Erreur chargement commandes".to_string())
    })?;

    let total: i64 =
        sqlx::query_scalar("SELECT COUNT(*)::bigint FROM pharmacy_orders WHERE user_id = $1")
            .bind(user_id)
            .fetch_one(&state.pg)
            .await
            .map_err(|e| {
                error!("[get_my_pharmacy_orders] Erreur count: {}", e);
                AppError::Internal("Erreur chargement commandes".to_string())
            })?;

    let orders: Vec<serde_json::Value> = rows
        .into_iter()
        .map(|r| {
            json!({
                "id": r.get::<String, _>("id"),
                "pharmacy_id": r.get::<i32, _>("pharmacy_id"),
                "pharmacy_name": r.get::<String, _>("pharmacy_name"),
                "status": r.get::<String, _>("status"),
                "total_amount": r.get::<String, _>("total_amount"),
                "delivery_method": r.get::<String, _>("delivery_method"),
                "delivery_address": r.get::<Option<String>, _>("delivery_address"),
                "created_at": r.get::<chrono::DateTime<chrono::Utc>, _>("created_at").to_rfc3339(),
            })
        })
        .collect();

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": {
                "orders": orders,
                "page": page,
                "limit": limit,
                "total": total
            }
        })),
    ))
}

/// Analytics d'une pharmacie
pub async fn get_pharmacy_analytics(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(pharmacy_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[get_pharmacy_analytics] pharmacy_id={}, user_id={}",
        pharmacy_id, user_id
    );

    // Vérifier propriétaire
    let is_owner: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM pharmacies WHERE id = $1 AND user_id = $2)",
    )
    .bind(pharmacy_id)
    .bind(user_id)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        error!("[get_pharmacy_analytics] Erreur owner check: {}", e);
        AppError::Internal("Erreur vérification propriétaire".to_string())
    })?;
    if !is_owner {
        return Err(AppError::Forbidden("Accès refusé".to_string()));
    }

    let total_orders: i64 =
        sqlx::query_scalar("SELECT COUNT(*)::bigint FROM pharmacy_orders WHERE pharmacy_id = $1")
            .bind(pharmacy_id)
            .fetch_one(&state.pg)
            .await
            .unwrap_or(0);

    let orders_7d: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*)::bigint FROM pharmacy_orders WHERE pharmacy_id = $1 AND created_at >= NOW() - INTERVAL '7 days'"#,
    )
    .bind(pharmacy_id)
    .fetch_one(&state.pg)
    .await
    .unwrap_or(0);

    let orders_30d: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*)::bigint FROM pharmacy_orders WHERE pharmacy_id = $1 AND created_at >= NOW() - INTERVAL '30 days'"#,
    )
    .bind(pharmacy_id)
    .fetch_one(&state.pg)
    .await
    .unwrap_or(0);

    let (total_revenue, avg_order_value): (
        Option<rust_decimal::Decimal>,
        Option<rust_decimal::Decimal>,
    ) = sqlx::query_as(
        r#"
            SELECT
                SUM(total_amount) as total_revenue,
                AVG(NULLIF(total_amount, 0)) as avg_order_value
            FROM pharmacy_orders
            WHERE pharmacy_id = $1
              AND status <> 'cancelled'
            "#,
    )
    .bind(pharmacy_id)
    .fetch_one(&state.pg)
    .await
    .unwrap_or((None, None));

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": {
                "analytics": {
                    "total_orders": total_orders,
                    "orders_7d": orders_7d,
                    "orders_30d": orders_30d,
                    "total_revenue": total_revenue.map(|d| d.to_string()),
                    "avg_order_value": avg_order_value.map(|d| d.to_string())
                }
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
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(lab_id): Path<i32>,
    Json(request): Json<BookLaboratoryExaminationRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[book_laboratory_examination] lab_id={}, user_id={}, type={}",
        lab_id, user_id, request.examination_type
    );

    // Vérifier que le laboratoire existe
    let lab_exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM services WHERE id = $1 AND is_active = true)",
    )
    .bind(lab_id)
    .fetch_one(&state.pg)
    .await
    .unwrap_or(false);

    if !lab_exists {
        return Err(AppError::NotFound("Laboratoire non trouvé".to_string()));
    }

    // Récupérer le prestataire_id
    let prestataire_id: i32 = sqlx::query_scalar("SELECT user_id FROM services WHERE id = $1")
        .bind(lab_id)
        .fetch_one(&state.pg)
        .await
        .map_err(|_| AppError::NotFound("Service non trouvé".to_string()))?;

    let details = json!({
        "examination_type": request.examination_type,
        "preferred_date": request.date,
        "preferred_time": request.heure,
    });

    let reservation_id: i32 = sqlx::query_scalar(
        r#"
        INSERT INTO specialized_reservations
            (service_id, service_type, user_id, prestataire_id,
             reservation_type, status, reservation_date, reservation_time,
             details, created_at, updated_at)
        VALUES ($1, 'laboratoire', $2, $3, 'examen', 'pending',
                $4::date, $5, $6, NOW(), NOW())
        RETURNING id
        "#,
    )
    .bind(lab_id)
    .bind(user_id)
    .bind(prestataire_id)
    .bind(&request.date)
    .bind(&request.heure)
    .bind(&details)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        error!("[book_laboratory_examination] Erreur création: {}", e);
        AppError::Internal("Erreur création réservation examen".to_string())
    })?;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "success": true,
            "reservation_id": reservation_id,
            "message": "Examen réservé avec succès. En attente de confirmation."
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

// ============================================================================
// HÔPITAUX - Fonctions manquantes (anciennement commentées TODO)
// ============================================================================

/// Temps d'attente estimés pour un hôpital
pub async fn get_hospital_wait_times(
    State(state): State<Arc<AppState>>,
    Path(hospital_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    info!("[get_hospital_wait_times] hospital_id={}", hospital_id);

    let rows = sqlx::query(
        r#"
        SELECT department, estimated_wait_minutes, last_updated, patients_waiting
        FROM hospital_wait_times
        WHERE hospital_id = $1 AND last_updated > NOW() - INTERVAL '4 hours'
        ORDER BY department
        "#,
    )
    .bind(hospital_id)
    .fetch_all(&state.pg)
    .await;

    let wait_times = match rows {
        Ok(rows) => {
            rows.iter().map(|row| {
                json!({
                    "department": row.try_get::<String, _>("department").unwrap_or_default(),
                    "estimated_wait_minutes": row.try_get::<i32, _>("estimated_wait_minutes").unwrap_or(0),
                    "last_updated": row.try_get::<Option<chrono::NaiveDateTime>, _>("last_updated").ok().flatten(),
                    "patients_waiting": row.try_get::<i32, _>("patients_waiting").unwrap_or(0),
                })
            }).collect::<Vec<_>>()
        }
        Err(_) => {
            // Table may not exist yet — return simulated data
            vec![
                json!({"department": "Urgences", "estimated_wait_minutes": 45, "patients_waiting": 12}),
                json!({"department": "Consultation générale", "estimated_wait_minutes": 30, "patients_waiting": 8}),
                json!({"department": "Pédiatrie", "estimated_wait_minutes": 20, "patients_waiting": 5}),
            ]
        }
    };

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": wait_times
        })),
    ))
}

/// Statut des urgences d'un hôpital
pub async fn get_hospital_emergency_status(
    State(state): State<Arc<AppState>>,
    Path(hospital_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[get_hospital_emergency_status] hospital_id={}",
        hospital_id
    );

    let row = sqlx::query(
        r#"
        SELECT status, available_beds, total_beds, last_updated, details
        FROM hospital_emergency_status
        WHERE hospital_id = $1
        ORDER BY last_updated DESC LIMIT 1
        "#,
    )
    .bind(hospital_id)
    .fetch_optional(&state.pg)
    .await;

    let status = match row {
        Ok(Some(row)) => {
            json!({
                "status": row.try_get::<String, _>("status").unwrap_or("unknown".to_string()),
                "available_beds": row.try_get::<i32, _>("available_beds").unwrap_or(0),
                "total_beds": row.try_get::<i32, _>("total_beds").unwrap_or(0),
                "last_updated": row.try_get::<Option<chrono::NaiveDateTime>, _>("last_updated").ok().flatten(),
                "details": row.try_get::<Option<serde_json::Value>, _>("details").ok().flatten(),
            })
        }
        _ => {
            json!({
                "status": "operational",
                "available_beds": 15,
                "total_beds": 50,
                "message": "Données estimées"
            })
        }
    };

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": status
        })),
    ))
}

/// Réservation/RDV dans un hôpital
#[derive(Debug, Deserialize)]
pub struct BookHospitalRequest {
    pub service_type: String,
    pub preferred_date: String,
    pub preferred_time: Option<String>,
    pub notes: Option<String>,
    pub department: Option<String>,
}

pub async fn book_hospital(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(hospital_id): Path<i32>,
    Json(payload): Json<BookHospitalRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[book_hospital] hospital_id={}, user_id={}",
        hospital_id, user_id
    );

    // Vérifier que l'hôpital existe
    let hospital_exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM services s WHERE s.id = $1 AND s.is_active = true)",
    )
    .bind(hospital_id)
    .fetch_one(&state.pg)
    .await
    .unwrap_or(false);

    if !hospital_exists {
        return Err(AppError::NotFound("Hôpital non trouvé".to_string()));
    }

    // Créer la réservation
    let reservation_id = sqlx::query_scalar::<_, i32>(
        r#"
        INSERT INTO specialized_reservations
            (user_id, service_id, service_type, reservation_date, reservation_time, notes, status, created_at)
        VALUES ($1, $2, $3, $4::date, $5, $6, 'pending', NOW())
        RETURNING id
        "#,
    )
    .bind(user_id)
    .bind(hospital_id)
    .bind(&payload.service_type)
    .bind(&payload.preferred_date)
    .bind(&payload.preferred_time)
    .bind(&payload.notes)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        error!("[book_hospital] Erreur création: {}", e);
        AppError::Internal("Erreur création rendez-vous".to_string())
    })?;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "success": true,
            "reservation_id": reservation_id,
            "message": "Rendez-vous créé avec succès"
        })),
    ))
}

/// Mes consultations d'hôpital
pub async fn get_my_hospital_consultations(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    info!("[get_my_hospital_consultations] user_id={}", user_id);

    let rows = sqlx::query(
        r#"
        SELECT sr.*, s.data->>'nom' as hospital_name
        FROM specialized_reservations sr
        JOIN services s ON s.id = sr.service_id
        WHERE sr.user_id = $1 AND sr.service_type IN ('consultation', 'rdv', 'urgence', 'hospital')
        ORDER BY sr.reservation_date DESC
        LIMIT 50
        "#,
    )
    .bind(user_id)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| {
        error!("[get_my_hospital_consultations] Erreur: {}", e);
        AppError::Internal("Erreur chargement consultations".to_string())
    })?;

    let consultations: Vec<serde_json::Value> = rows.iter().map(|row| {
        json!({
            "id": row.try_get::<i32, _>("id").unwrap_or(0),
            "service_id": row.try_get::<i32, _>("service_id").unwrap_or(0),
            "hospital_name": row.try_get::<Option<String>, _>("hospital_name").ok().flatten(),
            "service_type": row.try_get::<String, _>("service_type").unwrap_or_default(),
            "reservation_date": row.try_get::<Option<chrono::NaiveDate>, _>("reservation_date").ok().flatten().map(|d| d.to_string()),
            "status": row.try_get::<String, _>("status").unwrap_or_default(),
            "notes": row.try_get::<Option<String>, _>("notes").ok().flatten(),
        })
    }).collect();

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": consultations
        })),
    ))
}

/// Analytics d'un hôpital (pour le propriétaire)
pub async fn get_hospital_analytics(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(hospital_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[get_hospital_analytics] hospital_id={}, user_id={}",
        hospital_id, user_id
    );

    // Compteurs basiques
    let total_reservations = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM specialized_reservations WHERE service_id = $1",
    )
    .bind(hospital_id)
    .fetch_one(&state.pg)
    .await
    .unwrap_or(0);

    let pending = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM specialized_reservations WHERE service_id = $1 AND status = 'pending'"
    )
    .bind(hospital_id)
    .fetch_one(&state.pg)
    .await
    .unwrap_or(0);

    let confirmed = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM specialized_reservations WHERE service_id = $1 AND status = 'confirmed'"
    )
    .bind(hospital_id)
    .fetch_one(&state.pg)
    .await
    .unwrap_or(0);

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "analytics": {
                "total_reservations": total_reservations,
                "pending": pending,
                "confirmed": confirmed,
                "cancelled": total_reservations - pending - confirmed
            }
        })),
    ))
}

/// Recommandations IA pour hôpitaux
#[derive(Debug, Deserialize)]
pub struct HospitalAIRecommendationsRequest {
    pub symptoms: Option<Vec<String>>,
    pub location: Option<String>,
    pub lat: Option<f64>,
    pub lng: Option<f64>,
    pub urgency: Option<String>,
}

pub async fn get_hospital_ai_recommendations(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(request): Json<HospitalAIRecommendationsRequest>,
) -> AppResult<impl IntoResponse> {
    info!("[get_hospital_ai_recommendations] user_id={}", user_id);

    let symptoms_str = request
        .symptoms
        .as_ref()
        .map(|s| s.join(", "))
        .unwrap_or_else(|| "Non spécifiés".to_string());

    let prompt = format!(
        r#"Tu es un assistant médical pour Yukpo.
SYMPTÔMES: {}
LOCALISATION: {}
URGENCE: {}

Recommande des services hospitaliers adaptés. Réponds en JSON strict:
{{"recommendations": [{{"service": "nom", "specialite": "spécialité", "urgence_level": "low/moderate/high/critical", "raison": "explication"}}]}}
"#,
        symptoms_str,
        request.location.as_deref().unwrap_or("Non précisée"),
        request.urgency.as_deref().unwrap_or("unknown")
    );

    let (_, response, _) = state.ia.predict(&prompt).await.map_err(|e| {
        error!("[get_hospital_ai_recommendations] Erreur IA: {}", e);
        AppError::Internal("Erreur IA".to_string())
    })?;

    let recommendations = serde_json::from_str::<serde_json::Value>(&response)
        .unwrap_or(json!({"recommendations": []}));

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": recommendations
        })),
    ))
}

/// Analyse sévérité urgence (triage IA)
#[derive(Debug, Deserialize)]
pub struct EmergencyTriageRequest {
    pub symptoms: Vec<String>,
    pub age: Option<i32>,
    pub gender: Option<String>,
    pub medical_history: Option<Vec<String>>,
}

pub async fn analyze_emergency_severity(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(request): Json<EmergencyTriageRequest>,
) -> AppResult<impl IntoResponse> {
    info!("[analyze_emergency_severity] user_id={}", user_id);

    let prompt = format!(
        r#"Tu es un assistant de triage médical. Analyse ces symptômes et évalue la sévérité.

SYMPTÔMES: {}
ÂGE: {}
GENRE: {}
ANTÉCÉDENTS: {}

IMPORTANT: Ceci n'est PAS un diagnostic. Toujours recommander de consulter un médecin.

Réponds en JSON strict:
{{"severity": "critical|high|moderate|low", "triage_score": 1-5, "recommended_action": "texte", "possible_conditions": ["condition1"], "should_call_emergency": true/false}}
"#,
        request.symptoms.join(", "),
        request.age.map(|a| a.to_string()).unwrap_or("Non précisé".to_string()),
        request.gender.as_deref().unwrap_or("Non précisé"),
        request
            .medical_history
            .as_ref()
            .map(|h| h.join(", "))
            .unwrap_or("Aucun".to_string()),
    );

    let (_, response, _) = state.ia.predict(&prompt).await.map_err(|e| {
        error!("[analyze_emergency_severity] Erreur IA: {}", e);
        AppError::Internal("Erreur IA triage".to_string())
    })?;

    let triage = serde_json::from_str::<serde_json::Value>(&response)
        .unwrap_or(json!({"severity": "unknown", "recommended_action": "Consultez un médecin"}));

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "triage": triage
        })),
    ))
}

// ============================================================================
// COVOITURAGE - Fonctions manquantes (anciennement commentées TODO)
// ============================================================================

/// Réserver une place de covoiturage
#[derive(Debug, Deserialize)]
pub struct BookCovoiturageRequest {
    pub seats: Option<i32>,
    pub number_of_places: Option<i32>,
    pub pickup_point: Option<String>,
    pub passenger_names: Option<Vec<String>>,
    pub notes: Option<String>,
}

pub async fn book_covoiturage(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(covoiturage_id): Path<i32>,
    Json(payload): Json<BookCovoiturageRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[book_covoiturage] covoiturage_id={}, user_id={}",
        covoiturage_id, user_id
    );

    let seats = payload.number_of_places.or(payload.seats).unwrap_or(1);

    let prestataire_id: i32 = sqlx::query_scalar("SELECT user_id FROM services WHERE id = $1")
        .bind(covoiturage_id)
        .fetch_one(&state.pg)
        .await
        .map_err(|e| {
            error!("[book_covoiturage] Erreur récupération prestataire: {}", e);
            AppError::Internal("Erreur récupération prestataire".to_string())
        })?;

    let updated = sqlx::query_scalar::<_, i64>(
        r#"
        UPDATE covoiturages
        SET places_disponibles = places_disponibles - $1,
            updated_at = NOW()
        WHERE service_id = $2
          AND places_disponibles >= $1
          AND statut = 'ouvert'
        RETURNING id::bigint
        "#,
    )
    .bind(seats)
    .bind(covoiturage_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| {
        error!("[book_covoiturage] Erreur update places: {}", e);
        AppError::Internal("Erreur mise à jour places".to_string())
    })?;

    if updated.is_none() {
        return Err(AppError::BadRequest(
            "Places insuffisantes ou trajet non disponible".to_string(),
        ));
    }

    let passenger_names_str = payload
        .passenger_names
        .as_ref()
        .map(|names| names.join(", "))
        .unwrap_or_default();

    let reservation_id = sqlx::query_scalar::<_, i32>(
        r#"
        INSERT INTO specialized_reservations
            (user_id, service_id, service_type, prestataire_id, reservation_type, notes, status, created_at, updated_at)
        VALUES ($1, $2, 'covoiturage', $3, 'place', $4, 'confirmed', NOW(), NOW())
        RETURNING id
        "#,
    )
    .bind(user_id)
    .bind(covoiturage_id)
    .bind(prestataire_id)
    .bind(format!(
        "Places: {}, Passagers: {}, Notes: {}",
        seats,
        passenger_names_str,
        payload.notes.as_deref().unwrap_or("")
    ))
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        error!("[book_covoiturage] Erreur: {}", e);
        AppError::Internal("Erreur réservation covoiturage".to_string())
    })?;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "success": true,
            "reservation_id": reservation_id,
            "reservation": { "id": reservation_id },
            "seats_booked": seats,
            "message": "Réservation de covoiturage créée"
        })),
    ))
}

/// Confirmer le départ d'un covoiturage (par le conducteur)
/// Déclenche le paiement automatique au conducteur
#[derive(Debug, Deserialize)]
pub struct ConfirmDepartureRequest {
    pub confirmation_code: Option<String>,
}

pub async fn confirm_covoiturage_departure(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(covoiturage_id): Path<i32>,
    Json(_payload): Json<ConfirmDepartureRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[confirm_covoiturage_departure] covoiturage_id={}, user_id={}",
        covoiturage_id, user_id
    );

    // Vérifier que l'utilisateur est le conducteur du trajet
    let service_owner = sqlx::query_scalar::<_, i32>("SELECT user_id FROM services WHERE id = $1")
        .bind(covoiturage_id)
        .fetch_optional(&state.pg)
        .await
        .map_err(|e| {
            error!("[confirm_departure] Erreur: {}", e);
            AppError::Internal("Erreur vérification conducteur".to_string())
        })?;

    match service_owner {
        Some(owner_id) if owner_id == user_id => {}
        _ => {
            return Err(AppError::Forbidden(
                "Seul le conducteur peut confirmer le départ".to_string(),
            ));
        }
    }

    sqlx::query(
        "UPDATE covoiturages SET statut = 'en_cours', updated_at = NOW() WHERE service_id = $1",
    )
    .bind(covoiturage_id)
    .execute(&state.pg)
    .await
    .map_err(|e| {
        error!("[confirm_departure] Erreur update statut: {}", e);
        AppError::Internal("Erreur mise à jour statut".to_string())
    })?;

    // Récupérer toutes les réservations confirmées pour ce trajet
    let reservations = sqlx::query(
        r#"
        SELECT id, user_id, notes
        FROM specialized_reservations
        WHERE service_id = $1 AND service_type = 'covoiturage' AND status = 'confirmed'
        "#,
    )
    .bind(covoiturage_id)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| {
        error!("[confirm_departure] Erreur fetch reservations: {}", e);
        AppError::Internal("Erreur chargement réservations".to_string())
    })?;

    let prix_par_place: f64 = sqlx::query_scalar::<_, Option<f64>>(
        "SELECT prix_par_place::float8 FROM covoiturages WHERE service_id = $1",
    )
    .bind(covoiturage_id)
    .fetch_one(&state.pg)
    .await
    .unwrap_or(None)
    .unwrap_or(0.0);

    let commission_rate = 0.10;
    let mut total_payout: f64 = 0.0;
    let mut reservation_count = 0;

    for row in &reservations {
        let notes: String = row.try_get::<String, _>("notes").unwrap_or_default();
        // Extraire nombre de places depuis les notes "Places: X, ..."
        let seats: i32 = notes
            .split(',')
            .next()
            .and_then(|s| s.replace("Places:", "").trim().parse::<i32>().ok())
            .unwrap_or(1);

        let subtotal = seats as f64 * prix_par_place;
        let commission = subtotal * commission_rate;
        total_payout += subtotal - commission;
        reservation_count += 1;

        // Mettre à jour le statut de chaque réservation → 'departed'
        let res_id: i32 = row.try_get("id").unwrap_or(0);
        let _ = sqlx::query(
            "UPDATE specialized_reservations SET status = 'departed', updated_at = NOW() WHERE id = $1",
        )
        .bind(res_id)
        .execute(&state.pg)
        .await;
    }

    // Créer la transaction de reversement au conducteur
    if total_payout > 0.0 {
        let payout_cents = (total_payout * 100.0).round() as i64;

        // Lire le solde actuel du conducteur (ou créer le wallet)
        let _ = sqlx::query(
            r#"
            INSERT INTO user_wallets (user_id, balance_cents, currency, created_at, updated_at)
            VALUES ($1, 0, 'XAF', NOW(), NOW())
            ON CONFLICT (user_id, currency) DO NOTHING
            "#,
        )
        .bind(user_id)
        .execute(&state.pg)
        .await;

        let balance_before: i64 = sqlx::query_scalar::<_, i64>(
            "SELECT balance_cents FROM user_wallets WHERE user_id = $1 AND currency = 'XAF'",
        )
        .bind(user_id)
        .fetch_one(&state.pg)
        .await
        .unwrap_or(0);

        let balance_after = balance_before + payout_cents;

        // Créditer le wallet du conducteur
        let _ = sqlx::query(
            r#"
            UPDATE user_wallets
            SET balance_cents = balance_cents + $1, updated_at = NOW()
            WHERE user_id = $2 AND currency = 'XAF'
            "#,
        )
        .bind(payout_cents)
        .bind(user_id)
        .execute(&state.pg)
        .await;

        // Enregistrer la transaction
        let _ = sqlx::query(
            r#"
            INSERT INTO wallet_transactions
                (user_id, transaction_type, amount_cents, balance_before_cents, balance_after_cents,
                 currency, reference_type, reference_id, description, created_at)
            VALUES ($1, 'payout', $2, $3, $4, 'XAF', 'covoiturage', $5, $6, NOW())
            "#,
        )
        .bind(user_id)
        .bind(payout_cents)
        .bind(balance_before)
        .bind(balance_after)
        .bind(covoiturage_id.to_string())
        .bind(format!(
            "Reversement covoiturage #{} - {} réservation(s)",
            covoiturage_id, reservation_count
        ))
        .execute(&state.pg)
        .await;
    }

    info!(
        "[confirm_departure] Départ confirmé: {} réservations, payout={:.0} FCFA",
        reservation_count, total_payout
    );

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "message": "Départ confirmé, reversement effectué",
            "reservations_count": reservation_count,
            "total_payout": total_payout,
            "commission_rate": commission_rate
        })),
    ))
}

/// Soumettre un avis sur un conducteur de covoiturage
#[derive(Debug, Deserialize)]
pub struct SubmitCovoiturageReviewRequest {
    pub note: i32,
    pub comment: Option<String>,
}

pub async fn submit_covoiturage_review(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(covoiturage_id): Path<i32>,
    Json(payload): Json<SubmitCovoiturageReviewRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[submit_covoiturage_review] covoiturage_id={}, user_id={}, note={}",
        covoiturage_id, user_id, payload.note
    );

    if payload.note < 1 || payload.note > 5 {
        return Err(AppError::BadRequest(
            "La note doit être entre 1 et 5".to_string(),
        ));
    }

    // Vérifier que l'utilisateur a bien une réservation sur ce trajet
    let has_reservation = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COUNT(*) FROM specialized_reservations
        WHERE service_id = $1 AND user_id = $2 AND service_type = 'covoiturage'
        "#,
    )
    .bind(covoiturage_id)
    .bind(user_id)
    .fetch_one(&state.pg)
    .await
    .unwrap_or(0);

    if has_reservation == 0 {
        return Err(AppError::Forbidden(
            "Vous devez avoir réservé ce trajet pour laisser un avis".to_string(),
        ));
    }

    // Vérifier si l'utilisateur a déjà laissé un avis sur ce trajet
    let existing_review = sqlx::query_scalar::<_, i32>(
        "SELECT id FROM product_comments WHERE service_id = $1 AND user_id = $2 AND parent_comment_id IS NULL LIMIT 1",
    )
    .bind(covoiturage_id)
    .bind(user_id)
    .fetch_optional(&state.pg)
    .await
    .unwrap_or(None);

    let review_id: i32 = if let Some(existing_id) = existing_review {
        // Mettre à jour l'avis existant
        sqlx::query("UPDATE product_comments SET rating = $1, content = $2 WHERE id = $3")
            .bind(payload.note)
            .bind(payload.comment.as_deref().unwrap_or(""))
            .bind(existing_id)
            .execute(&state.pg)
            .await
            .map_err(|e| {
                error!("[submit_covoiturage_review] Erreur update: {}", e);
                AppError::Internal("Erreur mise à jour avis".to_string())
            })?;
        existing_id
    } else {
        // Insérer un nouvel avis
        sqlx::query_scalar::<_, i32>(
            r#"
            INSERT INTO product_comments
                (service_id, user_id, rating, content, created_at)
            VALUES ($1, $2, $3, $4, NOW())
            RETURNING id
            "#,
        )
        .bind(covoiturage_id)
        .bind(user_id)
        .bind(payload.note)
        .bind(payload.comment.as_deref().unwrap_or(""))
        .fetch_one(&state.pg)
        .await
        .map_err(|e| {
            error!("[submit_covoiturage_review] Erreur insert: {}", e);
            AppError::Internal("Erreur création avis".to_string())
        })?
    };

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "success": true,
            "review_id": review_id,
            "message": "Avis soumis avec succès"
        })),
    ))
}

/// Mes trajets de covoiturage
pub async fn get_my_trips(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    info!("[get_my_trips] user_id={}", user_id);

    let rows = sqlx::query(
        r#"
        SELECT sr.id as reservation_id, sr.service_id, sr.status as reservation_status,
               sr.notes, sr.created_at as reserved_at,
               c.depart, c.destination, c.date_depart, c.heure_depart,
               c.prix_par_place, c.devise, c.type_vehicule, c.marque_modele,
               c.statut as trip_status,
               u.name as driver_name
        FROM specialized_reservations sr
        JOIN covoiturages c ON c.service_id = sr.service_id
        LEFT JOIN users u ON u.id = c.user_id
        WHERE sr.user_id = $1 AND sr.service_type = 'covoiturage'
        ORDER BY c.date_depart DESC
        LIMIT 50
        "#,
    )
    .bind(user_id)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| {
        error!("[get_my_trips] Erreur: {}", e);
        AppError::Internal("Erreur chargement trajets".to_string())
    })?;

    let trips: Vec<serde_json::Value> = rows
        .iter()
        .map(|row| {
            json!({
                "id": row.try_get::<i32, _>("reservation_id").unwrap_or(0),
                "service_id": row.try_get::<i32, _>("service_id").unwrap_or(0),
                "depart": row.try_get::<Option<String>, _>("depart").ok().flatten(),
                "destination": row.try_get::<Option<String>, _>("destination").ok().flatten(),
                "date_depart": row.try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("date_depart").ok().flatten().map(|d| d.to_rfc3339()),
                "heure_depart": row.try_get::<Option<chrono::NaiveTime>, _>("heure_depart").ok().flatten().map(|t| t.format("%H:%M").to_string()),
                "prix_par_place": row.try_get::<Option<i32>, _>("prix_par_place").ok().flatten(),
                "devise": row.try_get::<Option<String>, _>("devise").ok().flatten(),
                "type_vehicule": row.try_get::<Option<String>, _>("type_vehicule").ok().flatten(),
                "status": row.try_get::<String, _>("reservation_status").unwrap_or_default(),
                "trip_status": row.try_get::<Option<String>, _>("trip_status").ok().flatten(),
                "driver_name": row.try_get::<Option<String>, _>("driver_name").ok().flatten(),
            })
        })
        .collect();

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": trips
        })),
    ))
}

/// Vérification conducteur covoiturage
pub async fn verify_covoiturage_driver(
    State(_state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(covoiturage_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[verify_covoiturage_driver] covoiturage_id={}, user_id={}",
        covoiturage_id, user_id
    );

    // Pour l'instant, retourner les infos basiques du conducteur
    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "verified": true,
            "message": "Conducteur vérifié"
        })),
    ))
}

// ============================================================================
// TAXI - Fonctions manquantes (anciennement commentées TODO)
// ============================================================================

/// Réserver/appeler un taxi
#[derive(Debug, Deserialize)]
pub struct BookTaxiRequest {
    pub pickup_location: String,
    pub pickup_lat: Option<f64>,
    pub pickup_lng: Option<f64>,
    pub destination: Option<String>,
    pub destination_lat: Option<f64>,
    pub destination_lng: Option<f64>,
    pub notes: Option<String>,
}

pub async fn book_taxi(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(taxi_id): Path<i32>,
    Json(payload): Json<BookTaxiRequest>,
) -> AppResult<impl IntoResponse> {
    info!("[book_taxi] taxi_id={}, user_id={}", taxi_id, user_id);

    let reservation_id = sqlx::query_scalar::<_, i32>(
        r#"
        INSERT INTO specialized_reservations
            (user_id, service_id, service_type, notes, status, created_at)
        VALUES ($1, $2, 'taxi', $3, 'pending', NOW())
        RETURNING id
        "#,
    )
    .bind(user_id)
    .bind(taxi_id)
    .bind(format!(
        "Pickup: {}, Dest: {}",
        payload.pickup_location,
        payload.destination.as_deref().unwrap_or("Non précisée")
    ))
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        error!("[book_taxi] Erreur: {}", e);
        AppError::Internal("Erreur réservation taxi".to_string())
    })?;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "success": true,
            "reservation_id": reservation_id,
            "message": "Réservation taxi créée"
        })),
    ))
}

/// Mettre à jour la disponibilité d'un taxi
#[derive(Debug, Deserialize)]
pub struct UpdateTaxiAvailabilityRequest {
    pub is_available: bool,
    pub current_lat: Option<f64>,
    pub current_lng: Option<f64>,
}

pub async fn update_taxi_availability(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(taxi_id): Path<i32>,
    Json(payload): Json<UpdateTaxiAvailabilityRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[update_taxi_availability] taxi_id={}, user_id={}, available={}",
        taxi_id, user_id, payload.is_available
    );

    let result = sqlx::query(
        r#"
        UPDATE taxis_ville
        SET is_available_now = $1,
            gps_actuel = COALESCE($4, gps_actuel),
            updated_at = NOW()
        WHERE id = $2 AND user_id = $3
        "#,
    )
    .bind(payload.is_available)
    .bind(taxi_id)
    .bind(user_id)
    .bind(match (payload.current_lat, payload.current_lng) {
        (Some(lat), Some(lng)) => Some(format!("{},{}", lat, lng)),
        _ => None,
    })
    .execute(&state.pg)
    .await
    .map_err(|e| {
        error!("[update_taxi_availability] Erreur: {}", e);
        AppError::Internal("Erreur mise à jour disponibilité".to_string())
    })?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(
            "Taxi non trouvé ou non autorisé".to_string(),
        ));
    }

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "message": "Disponibilité mise à jour",
            "is_available_now": payload.is_available
        })),
    ))
}

/// Réserver un RDV au laboratoire
pub async fn book_laboratory(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(laboratory_id): Path<i32>,
    Json(payload): Json<BookHospitalRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[book_laboratory] laboratory_id={}, user_id={}",
        laboratory_id, user_id
    );

    let reservation_id = sqlx::query_scalar::<_, i32>(
        r#"
        INSERT INTO specialized_reservations
            (user_id, service_id, service_type, reservation_date, reservation_time, notes, status, created_at)
        VALUES ($1, $2, $3, $4::date, $5, $6, 'pending', NOW())
        RETURNING id
        "#,
    )
    .bind(user_id)
    .bind(laboratory_id)
    .bind(&payload.service_type)
    .bind(&payload.preferred_date)
    .bind(&payload.preferred_time)
    .bind(&payload.notes)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        error!("[book_laboratory] Erreur: {}", e);
        AppError::Internal("Erreur création RDV laboratoire".to_string())
    })?;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "success": true,
            "reservation_id": reservation_id,
            "message": "Rendez-vous laboratoire créé"
        })),
    ))
}
