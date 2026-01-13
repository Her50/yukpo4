// ✅ NOUVEAU: Contrôleur pour livres scolaires

use crate::core::types::{AppError, AppResult};
use crate::middlewares::jwt::AuthenticatedUser;
use crate::models::book_exchange::{
    BookMatchingRequest, CreateBookRecommendationRequest, PriceSuggestionRequest,
};
use crate::models::livre_scolaire::{
    CreateLivreScolaireRequest, SearchLivresScolairesRequest, UpdateLivreScolaireRequest,
};
use crate::services::book_exchange_ai_service::BookExchangeAIService;
use crate::services::livres_scolaires_service::LivresScolairesService as Service;
use crate::state::AppState;
use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use log::{error, info};
use serde::Deserialize;
use serde_json::json;
use sqlx;
use std::sync::Arc;

/// POST /api/livres-scolaires
/// Créer un livre scolaire
pub async fn create_livre_scolaire(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<CreateLivreScolaireRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[create_livre_scolaire] User ID: {}, Titre: {}",
        user_id, payload.titre
    );

    let service = Service::new(Arc::new(state.pg.clone()));
    let livre = service.create_livre_scolaire(user_id, payload).await?;

    Ok((
        StatusCode::CREATED,
        Json(json!({ "success": true, "livre": livre })),
    ))
}

/// GET /api/livres-scolaires/search
/// Rechercher des livres scolaires (publique)
pub async fn search_livres_scolaires(
    State(state): State<Arc<AppState>>,
    Query(params): Query<SearchLivresQuery>,
) -> AppResult<impl IntoResponse> {
    info!("[search_livres_scolaires] Recherche avec filtres");

    let request = SearchLivresScolairesRequest {
        classe_actuelle: params.classe_actuelle,
        classe_souhaitee: params.classe_souhaitee,
        matiere: params.matiere,
        niveau: params.niveau,
        etat_livre: params.etat_livre,
        ville: params.ville,
        quartier: params.quartier,
        gps_lat: params.gps_lat,
        gps_lon: params.gps_lon,
        rayon_km: params.rayon_km,
        limit: params.limit,
        offset: params.offset,
    };

    let service = Service::new(Arc::new(state.pg.clone()));
    let livres = service.search_livres_scolaires(request).await?;

    Ok(Json(json!({ "success": true, "livres": livres })))
}

#[derive(Debug, Deserialize)]
pub struct SearchLivresQuery {
    pub classe_actuelle: Option<String>,
    pub classe_souhaitee: Option<String>,
    pub matiere: Option<String>,
    pub niveau: Option<String>,
    pub etat_livre: Option<String>,
    pub ville: Option<String>,
    pub quartier: Option<String>,
    pub gps_lat: Option<f64>,
    pub gps_lon: Option<f64>,
    pub rayon_km: Option<f64>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

/// GET /api/livres-scolaires/:id
/// Obtenir les détails d'un livre scolaire (publique)
pub async fn get_livre_details(
    State(state): State<Arc<AppState>>,
    Path(livre_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    info!("[get_livre_details] Livre ID: {}", livre_id);

    let service = Service::new(Arc::new(state.pg.clone()));
    let livre = service.get_livre_details(livre_id).await?;

    Ok(Json(json!({ "success": true, "livre": livre })))
}

/// PUT /api/livres-scolaires/:id
/// Modifier un livre scolaire
pub async fn update_livre_scolaire(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(livre_id): Path<i32>,
    Json(payload): Json<UpdateLivreScolaireRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[update_livre_scolaire] User ID: {}, Livre ID: {}",
        user_id, livre_id
    );

    let service = Service::new(Arc::new(state.pg.clone()));
    let livre = service
        .update_livre_scolaire(livre_id, user_id, payload)
        .await?;

    Ok(Json(json!({ "success": true, "livre": livre })))
}

/// DELETE /api/livres-scolaires/:id
/// Supprimer un livre scolaire
pub async fn delete_livre_scolaire(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(livre_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[delete_livre_scolaire] User ID: {}, Livre ID: {}",
        user_id, livre_id
    );

    let service = Service::new(Arc::new(state.pg.clone()));
    service.delete_livre_scolaire(livre_id, user_id).await?;

    Ok(Json(
        json!({ "success": true, "message": "Livre supprimé avec succès" }),
    ))
}

/// POST /api/livres-scolaires/:id/upload-images
/// Upload d'images pour un livre (à implémenter avec le service de médias)
pub async fn upload_images(
    State(_state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: _user_id, .. }): Extension<AuthenticatedUser>,
    Path(_livre_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    // TODO: Implémenter upload d'images avec le service de médias existant
    Ok((
        axum::http::StatusCode::NOT_IMPLEMENTED,
        axum::Json(serde_json::json!({
            "error": "Upload d'images à implémenter"
        })),
    ))
}

/// POST /api/livres-scolaires/:id/upload-video
/// Upload de vidéo pour un livre (à implémenter avec le service de médias)
pub async fn upload_video(
    State(_state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: _user_id, .. }): Extension<AuthenticatedUser>,
    Path(_livre_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    // TODO: Implémenter upload de vidéo avec le service de médias existant
    Ok((
        axum::http::StatusCode::NOT_IMPLEMENTED,
        axum::Json(serde_json::json!({
            "error": "Upload de vidéo à implémenter"
        })),
    ))
}

/// GET /api/livres-scolaires/mes-livres
/// Obtenir les livres de l'utilisateur connecté
pub async fn get_mes_livres(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    info!("[get_mes_livres] User ID: {}", user_id);

    let service = Service::new(Arc::new(state.pg.clone()));
    let livres = service.get_mes_livres(user_id).await?;

    Ok(Json(json!({ "success": true, "livres": livres })))
}

/// PATCH /api/livres-scolaires/:id/availability
/// Mettre à jour la disponibilité d'un livre
pub async fn update_availability(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(livre_id): Path<i32>,
    Json(payload): Json<UpdateAvailabilityRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[update_availability] User ID: {}, Livre ID: {}, Available: {}",
        user_id, livre_id, payload.is_available
    );

    let service = Service::new(Arc::new(state.pg.clone()));
    let livre = service
        .update_livre_disponibilite(livre_id, user_id, payload.is_available)
        .await?;

    Ok(Json(json!({ "success": true, "livre": livre })))
}

#[derive(Debug, Deserialize)]
pub struct UpdateAvailabilityRequest {
    pub is_available: bool,
}

// ============================================================================
// ENDPOINTS IA - BOURSE DU LIVRE
// ============================================================================

/// POST /api/bourse-livre/ai/recommendations
/// Recommandations IA de livres
pub async fn ai_recommendations(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(request): Json<CreateBookRecommendationRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[ai_recommendations] User ID: {}, Classe: {} -> {}",
        user_id, request.classe_actuelle, request.classe_souhaitee
    );

    let ai_service = BookExchangeAIService::new(state.ia.clone());
    let recommendation = ai_service
        .generate_book_recommendations(
            &request.classe_actuelle,
            &request.classe_souhaitee,
            &request.matiere,
            request.niveau.as_deref(),
            request.ville.as_deref(),
        )
        .await?;

    Ok(Json(json!({
        "success": true,
        "recommendation": recommendation
    })))
}

/// POST /api/bourse-livre/ai/matching
/// Matching intelligent besoins/offres
pub async fn ai_matching(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: _user_id, .. }): Extension<AuthenticatedUser>,
    Json(request): Json<BookMatchingRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[ai_matching] Livre offert: {}, Livre souhaité: {}",
        request.livre_offert_id, request.livre_souhaite_id
    );

    let ai_service = BookExchangeAIService::new(state.ia.clone());
    let matching = ai_service
        .generate_book_matching(
            request.livre_offert_id,
            request.livre_souhaite_id,
            request.participant_id,
            request.distance_km,
            request.etat_livre_offert.as_deref(),
            request.etat_livre_souhaite.as_deref(),
        )
        .await?;

    Ok(Json(json!({
        "success": true,
        "matching": matching
    })))
}

/// GET /api/bourse-livre/price-suggestions
/// Suggestions prix basées sur marché
pub async fn price_suggestions(
    State(state): State<Arc<AppState>>,
    Query(request): Query<PriceSuggestionRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[price_suggestions] Livre ID: {}, Titre: {}",
        request.livre_id, request.titre
    );

    let ai_service = BookExchangeAIService::new(state.ia.clone());
    let suggestion = ai_service
        .generate_price_suggestions(
            request.livre_id,
            &request.titre,
            request.auteur.as_deref(),
            request.editeur.as_deref(),
            request.isbn.as_deref(),
            &request.classe,
            &request.matiere,
            &request.etat_livre,
            request.ville.as_deref(),
            request.prix_marche,
        )
        .await?;

    Ok(Json(json!({
        "success": true,
        "suggestion": suggestion
    })))
}

/// GET /api/bourse-livre/my-exchanges
/// Mes échanges (JWT)
pub async fn get_my_exchanges(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Query(params): Query<MyExchangesQuery>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[get_my_exchanges] User ID: {}, Statut: {:?}",
        user_id, params.statut
    );

    let statut_filter = params.statut.as_deref();
    let exchanges = if let Some(statut) = statut_filter {
        sqlx::query_as::<_, crate::models::book_exchange::BookExchange>(
            r#"
            SELECT * FROM book_exchanges
            WHERE (initiateur_id = $1 OR participant_id = $1)
            AND statut = $2
            ORDER BY created_at DESC
            LIMIT 50
            "#,
        )
        .bind(user_id)
        .bind(statut)
        .fetch_all(&state.pg)
        .await
    } else {
        sqlx::query_as::<_, crate::models::book_exchange::BookExchange>(
            r#"
            SELECT * FROM book_exchanges
            WHERE (initiateur_id = $1 OR participant_id = $1)
            ORDER BY created_at DESC
            LIMIT 50
            "#,
        )
        .bind(user_id)
        .fetch_all(&state.pg)
        .await
    }
    .map_err(|e| AppError::Internal(format!("Erreur récupération échanges: {}", e)))?;

    Ok(Json(json!({ "success": true, "exchanges": exchanges })))
}

#[derive(Debug, Deserialize)]
pub struct MyExchangesQuery {
    pub statut: Option<String>, // "en_attente", "accepte", "refuse", "complete"
}

/// GET /api/bourse-livre/analytics
/// Analytics prestataire (JWT)
pub async fn get_analytics(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Query(params): Query<AnalyticsQuery>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[get_analytics] User ID: {}, Livre ID: {:?}",
        user_id, params.livre_id
    );

    let livre_id_filter = params.livre_id;
    let analytics: Option<crate::models::book_exchange::BookAnalytics> =
        if let Some(livre_id) = livre_id_filter {
            sqlx::query_as::<_, crate::models::book_exchange::BookAnalytics>(
                r#"
            SELECT * FROM book_analytics
            WHERE user_id = $1 AND livre_id = $2
            ORDER BY periode_debut DESC
            LIMIT 1
            "#,
            )
            .bind(user_id)
            .bind(livre_id)
            .fetch_optional(&state.pg)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur récupération analytics: {}", e)))?
        } else {
            sqlx::query_as::<_, crate::models::book_exchange::BookAnalytics>(
                r#"
            SELECT * FROM book_analytics
            WHERE user_id = $1
            ORDER BY periode_debut DESC
            LIMIT 1
            "#,
            )
            .bind(user_id)
            .fetch_optional(&state.pg)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur récupération analytics: {}", e)))?
        };

    Ok(Json(json!({ "success": true, "analytics": analytics })))
}

#[derive(Debug, Deserialize)]
pub struct AnalyticsQuery {
    pub livre_id: Option<i32>,
}

// ============================================================================
// ✅ NOUVEAU: ANALYSE IA D'IMAGE DE LIVRE
// ============================================================================

/// POST /api/livres-scolaires/ai/analyze-image
/// Analyser une image de livre pour extraire les caractéristiques
#[derive(Debug, Deserialize)]
pub struct AnalyzeBookImageRequest {
    pub image_uri: String, // URL ou base64 de l'image
    pub user_lat: Option<f64>,
    pub user_lng: Option<f64>,
}

pub async fn analyze_book_image(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(request): Json<AnalyzeBookImageRequest>,
) -> AppResult<impl IntoResponse> {
    info!("[analyze_book_image] User ID: {}, Image URI fournie", user_id);

    // Créer un prompt IA pour analyser l'image et extraire les caractéristiques du livre
    let prompt = format!(
        r#"
Tu es un expert en reconnaissance de livres scolaires pour Yukpo.

CONTEXTE :
- Image de livre fournie par l'utilisateur
- Localisation utilisateur : lat={}, lng={}

TON RÔLE :
- Analyser l'image du livre scolaire
- Extraire TOUTES les caractéristiques visibles :
  * Titre du livre (exact)
  * Auteur(s)
  * Éditeur
  * ISBN (si visible)
  * Classe/niveau (ex: "6ème", "5ème", "Terminale")
  * Matière (Mathématiques, Français, etc.)
  * État visuel du livre (Neuf, Très bon, Bon, Acceptable)
  * Description de l'état (détails visibles : pages, couverture, etc.)

IMPORTANT :
- Sois précis dans l'extraction des informations
- Si une information n'est pas visible, indique "Non visible"
- Pour la classe, utilise les formats standards : "6ème", "5ème", "4ème", "3ème", "Seconde", "Première", "Terminale"
- Pour la matière, utilise les noms standards : "Mathématiques", "Français", "Anglais", "SVT", "Physique-Chimie", "Histoire-Géo", "Philosophie", etc.
- Pour l'état, évalue visuellement : "Neuf" (aucun signe d'usure), "Très bon" (légère usure), "Bon" (usure modérée), "Acceptable" (usure importante mais utilisable)

RÉPONSE ATTENDUE (JSON strict) :
{{
    "titre": "Titre exact du livre",
    "auteur": "Nom de l'auteur ou null si non visible",
    "editeur": "Nom de l'éditeur ou null si non visible",
    "isbn": "ISBN ou null si non visible",
    "classe_actuelle": "Classe actuelle de l'élève (ex: 6ème) ou null",
    "classe_souhaitee": "Classe souhaitée (ex: 5ème) ou null",
    "matiere": "Matière (ex: Mathématiques) ou null",
    "niveau": "Primaire, Collège ou Lycée ou null",
    "etat_livre": "Neuf, Très bon, Bon ou Acceptable",
    "description_etat": "Description détaillée de l'état visible",
    "confidence": 0.85,
    "notes": "Notes additionnelles sur l'analyse"
}}
"#,
        request.user_lat.unwrap_or(0.0),
        request.user_lng.unwrap_or(0.0)
    );

    // ✅ AMÉLIORÉ: Utiliser l'analyse multimodale pour analyser l'image
    // Extraire l'image base64 si c'est un data URI
    let image_base64 = if request.image_uri.starts_with("data:image") {
        // Extraire la partie base64 après la virgule (format: data:image/jpeg;base64,<base64_data>)
        if let Some(base64_part) = request.image_uri.split(',').nth(1) {
            base64_part.to_string()
        } else {
            // Si pas de virgule, utiliser l'URI complète
            request.image_uri.clone()
        }
    } else {
        // Si c'est une URL, on pourrait télécharger l'image, mais pour l'instant on utilise juste l'URI
        request.image_uri.clone()
    };
    
    let images = vec![image_base64];
    let (model_name, response, tokens) = state.ia.predict_multimodal(&prompt, Some(images)).await
        .map_err(|e| {
            error!("[analyze_book_image] Erreur IA multimodale: {}", e);
            AppError::Internal("Erreur analyse IA multimodale".to_string())
        })?;

    info!(
        "[analyze_book_image] Analyse effectuée avec {} (tokens: {})",
        model_name, tokens
    );

    // Parser la réponse JSON
    let book_info: serde_json::Value = match serde_json::from_str(&response) {
        Ok(v) => v,
        Err(e) => {
            log::warn!("[analyze_book_image] Erreur parsing JSON: {}", e);
            // Fallback avec structure minimale
            json!({
                "titre": "Livre scolaire",
                "auteur": null,
                "editeur": null,
                "isbn": null,
                "classe_actuelle": null,
                "classe_souhaitee": null,
                "matiere": null,
                "niveau": null,
                "etat_livre": "Bon",
                "description_etat": "État à vérifier",
                "confidence": 0.5,
                "notes": "Analyse partielle, vérification manuelle recommandée"
            })
        }
    };

    Ok(Json(json!({
        "success": true,
        "book_info": book_info,
        "image_uri": request.image_uri
    })))
}
