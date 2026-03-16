// ✅ V2: Contrôleur Bourse du Livre - Sessions d'upload, analyse recto-verso,
// paquets coursier, commissions, dons

use crate::core::types::{AppError, AppResult};
use crate::middlewares::jwt::AuthenticatedUser;
use crate::models::livre_scolaire::{
    calculer_montant_net, calculer_valeur_livre, generer_reference_paquet, BookDeliveryPackage,
    BookDonationRequest, BookUploadSession, CreateDonationRequestPayload,
    CreateProgrammeScolaireRequest, CreateUploadSessionRequest, ProgrammeScolaire,
};
use crate::services::book_exchange_ai_service::BookExchangeAIService;
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
use std::sync::Arc;
use uuid::Uuid;

// ============================================================================
// SESSIONS D'UPLOAD PROGRESSIVE
// ============================================================================

/// POST /api/bourse-livre/v2/sessions
/// Créer une session d'upload (GPS obligatoire)
pub async fn create_upload_session(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<CreateUploadSessionRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[create_upload_session] User ID: {}, GPS: {}",
        user_id, payload.gps_recuperation
    );

    if payload.gps_recuperation.is_empty() {
        return Err(AppError::BadRequest(
            "La localisation GPS est obligatoire avant d'envoyer des livres".to_string(),
        ));
    }

    let session_id = Uuid::new_v4().to_string();
    let mode = payload.mode_listing_defaut.as_deref().unwrap_or("troc");

    let session = sqlx::query_as::<_, BookUploadSession>(
        r#"
        INSERT INTO book_upload_sessions (id, user_id, gps_recuperation, adresse_recuperation, mode_listing_defaut, statut)
        VALUES ($1, $2, $3, $4, $5, 'en_cours')
        RETURNING *
        "#,
    )
    .bind(&session_id)
    .bind(user_id)
    .bind(&payload.gps_recuperation)
    .bind(&payload.adresse_recuperation)
    .bind(mode)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur création session: {}", e)))?;

    Ok((
        StatusCode::CREATED,
        Json(json!({ "success": true, "session": session })),
    ))
}

/// GET /api/bourse-livre/v2/sessions/:id
/// Obtenir le statut et récap d'une session d'upload
pub async fn get_upload_session(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(session_id): Path<String>,
) -> AppResult<impl IntoResponse> {
    let session = sqlx::query_as::<_, BookUploadSession>(
        "SELECT * FROM book_upload_sessions WHERE id = $1 AND user_id = $2",
    )
    .bind(&session_id)
    .bind(user_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur récupération session: {}", e)))?
    .ok_or_else(|| AppError::NotFound("Session non trouvée".to_string()))?;

    // Récupérer les livres de cette session
    let livres = sqlx::query_as::<_, crate::models::livre_scolaire::LivreScolaire>(
        "SELECT * FROM livres_scolaires WHERE upload_session_id = $1 ORDER BY created_at ASC",
    )
    .bind(&session_id)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur récupération livres session: {}", e)))?;

    Ok(Json(json!({
        "success": true,
        "session": session,
        "livres": livres
    })))
}

/// POST /api/bourse-livre/v2/sessions/:id/finalize
/// Finaliser une session d'upload (choisir mode troc/vente/don pour chaque livre)
#[derive(Debug, Deserialize)]
pub struct FinalizeSessionRequest {
    pub livres_modes: Vec<LivreModeSetting>, // mode par livre
}

#[derive(Debug, Deserialize)]
pub struct LivreModeSetting {
    pub livre_id: i32,
    pub mode_listing: String, // 'troc', 'vente', 'don'
}

pub async fn finalize_upload_session(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(session_id): Path<String>,
    Json(payload): Json<FinalizeSessionRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[finalize_upload_session] User ID: {}, Session: {}, {} livres",
        user_id,
        session_id,
        payload.livres_modes.len()
    );

    // Vérifier la session
    let _session = sqlx::query_as::<_, BookUploadSession>(
        "SELECT * FROM book_upload_sessions WHERE id = $1 AND user_id = $2 AND statut = 'en_cours'",
    )
    .bind(&session_id)
    .bind(user_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur vérification session: {}", e)))?
    .ok_or_else(|| AppError::NotFound("Session non trouvée ou déjà finalisée".to_string()))?;

    // Mettre à jour chaque livre avec son mode
    for lm in &payload.livres_modes {
        let situation = if lm.mode_listing == "troc" {
            "offre_demande"
        } else {
            "offre"
        };

        sqlx::query(
            r#"UPDATE livres_scolaires 
            SET mode_listing = $1, situation_troc = $2, is_available = true
            WHERE id = $3 AND user_id = $4 AND upload_session_id = $5
            AND etat_classification != 'rejete'"#,
        )
        .bind(&lm.mode_listing)
        .bind(situation)
        .bind(lm.livre_id)
        .bind(user_id)
        .bind(&session_id)
        .execute(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur MAJ livre {}: {}", lm.livre_id, e)))?;
    }

    // Mettre à jour la session
    sqlx::query(
        "UPDATE book_upload_sessions SET statut = 'termine', date_validation = NOW() WHERE id = $1",
    )
    .bind(&session_id)
    .execute(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur finalisation session: {}", e)))?;

    Ok(Json(
        json!({ "success": true, "message": "Session finalisée avec succès" }),
    ))
}

// ============================================================================
// HELPERS: UPLOAD IMAGES S3-CDN + EXTRACTION BASE64
// ============================================================================

/// Extrait la partie base64 d'un data URI ou retourne la chaîne telle quelle
fn extract_base64(data_uri: &str) -> String {
    if data_uri.starts_with("data:image") {
        if let Some(base64_part) = data_uri.split(',').nth(1) {
            return base64_part.to_string();
        }
    }
    data_uri.to_string()
}

/// Upload une image de livre (base64 ou data URI) vers le S3-CDN
/// Retourne l'URL publique CDN, ou une erreur si l'upload échoue
async fn upload_book_image_to_cdn(
    media_storage: &std::sync::Arc<crate::services::media_storage_service::MediaStorageService>,
    image_data: &str,
    storage_key: &str,
) -> Result<String, String> {
    // Extraire le base64 pur
    let base64_data = extract_base64(image_data);

    // Décoder base64 en bytes
    use base64::Engine;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(&base64_data)
        .map_err(|e| format!("Erreur décodage base64: {}", e))?;

    if bytes.is_empty() {
        return Err("Image base64 vide".to_string());
    }

    // Upload vers S3-CDN via le service média
    let result = media_storage
        .store_bytes(&bytes, storage_key, Some("image/jpeg"))
        .await
        .map_err(|e| format!("Erreur upload S3: {}", e))?;

    Ok(result.public_url)
}

// ============================================================================
// ANALYSE RECTO-VERSO PROGRESSIVE
// ============================================================================

/// POST /api/bourse-livre/v2/analyze-recto-verso
/// Analyser un livre via ses photos recto-verso avec IA
#[derive(Debug, Deserialize)]
pub struct AnalyzeRectoVersoRequest {
    pub image_recto: String, // Base64 ou data URI
    pub image_verso: String, // Base64 ou data URI
    pub session_id: String,
    pub user_lat: Option<f64>,
    pub user_lng: Option<f64>,
}

pub async fn analyze_recto_verso(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(request): Json<AnalyzeRectoVersoRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[analyze_recto_verso] User ID: {}, Session: {}",
        user_id, request.session_id
    );

    // Vérifier que la session existe et appartient à l'utilisateur
    let session = sqlx::query_as::<_, BookUploadSession>(
        "SELECT * FROM book_upload_sessions WHERE id = $1 AND user_id = $2 AND statut = 'en_cours'",
    )
    .bind(&request.session_id)
    .bind(user_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur vérification session: {}", e)))?
    .ok_or_else(|| AppError::NotFound("Session non trouvée ou terminée".to_string()))?;

    // Extraire base64 des images
    let recto_b64 = extract_base64(&request.image_recto);
    let verso_b64 = extract_base64(&request.image_verso);

    // Charger les programmes scolaires pour le matching
    let programmes: Vec<ProgrammeScolaire> = sqlx::query_as::<_, ProgrammeScolaire>(
        "SELECT * FROM programmes_scolaires WHERE is_active = true LIMIT 200",
    )
    .fetch_all(&state.pg)
    .await
    .unwrap_or_default();

    let programmes_json = serde_json::to_string(
        &programmes
            .iter()
            .map(|p| {
                json!({
                    "id": p.id,
                    "titre": p.titre_livre,
                    "classe": p.classe,
                    "matiere": p.matiere,
                    "auteur": p.auteur_livre,
                    "isbn": p.isbn_livre
                })
            })
            .collect::<Vec<_>>(),
    )
    .unwrap_or_else(|_| "[]".to_string());

    // Analyser avec l'IA
    let ai_service = BookExchangeAIService::new(state.ia.clone());
    let analysis = ai_service
        .analyze_book_recto_verso(
            &recto_b64,
            &verso_b64,
            request.user_lat,
            request.user_lng,
            &programmes_json,
        )
        .await?;

    // Calculer la valorisation
    let (valeur_calculee, ratio) = if let Some(prix) = analysis.prix_detecte {
        calculer_valeur_livre(prix, &analysis.etat_classification)
    } else {
        (0.0, 0.0)
    };

    // Déterminer etat_livre compatible avec l'ancien système
    let etat_livre = match analysis.etat_classification.as_str() {
        "bon" => "Très bon",
        "acceptable" => "Acceptable",
        "rejete" => "Acceptable", // On stocke quand même, marqué rejete via etat_classification
        _ => "Bon",
    };

    // ✅ Upload images vers S3-CDN au lieu de stocker base64 brut en PostgreSQL
    let upload_id = Uuid::new_v4().to_string();
    let recto_url = upload_book_image_to_cdn(
        &state.media_storage,
        &request.image_recto,
        &format!("livres/{}/recto_{}.jpg", user_id, upload_id),
    )
    .await
    .unwrap_or_else(|e| {
        error!(
            "[analyze_recto_verso] Erreur upload recto CDN: {}, fallback base64",
            e
        );
        request.image_recto.clone()
    });
    let verso_url = upload_book_image_to_cdn(
        &state.media_storage,
        &request.image_verso,
        &format!("livres/{}/verso_{}.jpg", user_id, upload_id),
    )
    .await
    .unwrap_or_else(|e| {
        error!(
            "[analyze_recto_verso] Erreur upload verso CDN: {}, fallback base64",
            e
        );
        request.image_verso.clone()
    });

    info!(
        "[analyze_recto_verso] Images uploadées CDN: recto={}, verso={}",
        if recto_url.starts_with("http") {
            "CDN"
        } else {
            "base64-fallback"
        },
        if verso_url.starts_with("http") {
            "CDN"
        } else {
            "base64-fallback"
        }
    );

    // Créer le livre dans la base
    let livre = sqlx::query_as::<_, crate::models::livre_scolaire::LivreScolaire>(
        r#"
        INSERT INTO livres_scolaires (
            user_id, titre, auteur, editeur, isbn,
            classe_actuelle, classe_souhaitee, matiere, niveau,
            etat_livre, description_etat,
            image_recto, image_verso, images_urls,
            gps, ville,
            mode_listing, prix_detecte, devise_detectee,
            valeur_calculee, ratio_etat, etat_classification,
            programme_scolaire_id, est_au_programme, programme_match_details,
            ia_analysis_status, ia_analysis_result, ia_confidence,
            situation_troc, upload_session_id,
            is_available, is_active
        )
        VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9,
            $10, $11,
            $12, $13, $14,
            $15, $16,
            $17, $18, $19,
            $20, $21, $22,
            $23, $24, $25,
            'done', $26, $27,
            $28, $29,
            false, true
        )
        RETURNING *
        "#,
    )
    .bind(user_id)
    .bind(analysis.titre.as_deref().unwrap_or("Livre scolaire"))
    .bind(&analysis.auteur)
    .bind(&analysis.editeur)
    .bind(&analysis.isbn)
    .bind(analysis.classe_actuelle.as_deref().unwrap_or(""))
    .bind(analysis.classe_souhaitee.as_deref().unwrap_or(""))
    .bind(analysis.matiere.as_deref().unwrap_or(""))
    .bind(&analysis.niveau)
    .bind(etat_livre)
    .bind(&analysis.etat_description)
    .bind(&recto_url)
    .bind(&verso_url)
    .bind::<&[String]>(&[]) // images_urls vide, on utilise recto/verso
    .bind(&session.gps_recuperation)
    .bind::<Option<&str>>(None) // ville sera déduite du GPS
    // ✅ $17: mode_listing — Terminale: forcer 'vente' (pas de classe supérieure → pas de troc)
    .bind({
        let classe_act = analysis.classe_actuelle.as_deref().unwrap_or("");
        let is_terminale =
            crate::services::book_exchange_ai_service::is_classe_terminale(classe_act);
        if is_terminale {
            info!("[analyze_recto_verso] Classe Terminale détectée → mode_listing=vente forcé");
            "vente".to_string()
        } else {
            session.mode_listing_defaut.as_deref().unwrap_or("troc").to_string()
        }
    })
    .bind(
        analysis
            .prix_detecte
            .map(|p| rust_decimal::Decimal::from_f64_retain(p).unwrap_or_default()),
    )
    .bind(analysis.devise_detectee.as_deref().unwrap_or("XAF"))
    .bind(rust_decimal::Decimal::from_f64_retain(valeur_calculee).unwrap_or_default())
    .bind(rust_decimal::Decimal::from_f64_retain(ratio).unwrap_or_default())
    .bind(&analysis.etat_classification)
    .bind(analysis.programme_scolaire_id)
    .bind(analysis.est_au_programme)
    .bind(json!({ "details": analysis.programme_match_details, "notes": analysis.notes }))
    .bind(json!(analysis))
    .bind(rust_decimal::Decimal::from_f64_retain(analysis.confidence).unwrap_or_default())
    // $28: situation_troc — 'offre' pour vente/don/Terminale, 'offre_demande' pour troc
    .bind({
        let classe_act = analysis.classe_actuelle.as_deref().unwrap_or("");
        let is_terminale =
            crate::services::book_exchange_ai_service::is_classe_terminale(classe_act);
        let mode = if is_terminale {
            "vente"
        } else {
            session.mode_listing_defaut.as_deref().unwrap_or("troc")
        };
        if mode == "troc" {
            "offre_demande"
        } else {
            "offre"
        }
    })
    .bind(&request.session_id)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        error!("[analyze_recto_verso] Erreur création livre: {}", e);
        AppError::Internal(format!("Erreur création livre analysé: {}", e))
    })?;

    // Mettre à jour les compteurs de la session
    let is_rejected = analysis.etat_classification == "rejete";
    sqlx::query(
        r#"UPDATE book_upload_sessions SET 
            total_livres = total_livres + 1,
            livres_analyses = livres_analyses + 1,
            livres_acceptes = livres_acceptes + CASE WHEN $2 THEN 0 ELSE 1 END,
            livres_rejetes = livres_rejetes + CASE WHEN $2 THEN 1 ELSE 0 END,
            valeur_totale = COALESCE(valeur_totale, 0) + $3
        WHERE id = $1"#,
    )
    .bind(&request.session_id)
    .bind(is_rejected)
    .bind(rust_decimal::Decimal::from_f64_retain(valeur_calculee).unwrap_or_default())
    .execute(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur MAJ session: {}", e)))?;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "success": true,
            "livre": livre,
            "analysis": analysis,
            "valeur_calculee": valeur_calculee,
            "ratio_etat": ratio,
            "etat_classification": analysis.etat_classification,
            "is_rejected": is_rejected
        })),
    ))
}

// ============================================================================
// PROGRAMMES SCOLAIRES (Admin)
// ============================================================================

/// POST /api/bourse-livre/v2/admin/programmes
pub async fn create_programme_scolaire(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<CreateProgrammeScolaireRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[create_programme_scolaire] Admin ID: {}, Titre: {}",
        user_id, payload.titre_livre
    );

    let programme = sqlx::query_as::<_, ProgrammeScolaire>(
        r#"
        INSERT INTO programmes_scolaires (
            pays, systeme_educatif, niveau, classe, matiere,
            titre_livre, auteur_livre, editeur_livre, isbn_livre,
            annee_scolaire, est_obligatoire, keywords, prix_officiel,
            created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *
        "#,
    )
    .bind(payload.pays.as_deref().unwrap_or("Cameroun"))
    .bind(payload.systeme_educatif.as_deref().unwrap_or("francophone"))
    .bind(&payload.niveau)
    .bind(&payload.classe)
    .bind(&payload.matiere)
    .bind(&payload.titre_livre)
    .bind(&payload.auteur_livre)
    .bind(&payload.editeur_livre)
    .bind(&payload.isbn_livre)
    .bind(&payload.annee_scolaire)
    .bind(payload.est_obligatoire.unwrap_or(true))
    .bind(payload.keywords.as_deref().unwrap_or(&[]))
    .bind(
        payload
            .prix_officiel
            .map(|p| rust_decimal::Decimal::from_f64_retain(p).unwrap_or_default()),
    )
    .bind(user_id)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur création programme: {}", e)))?;

    Ok((
        StatusCode::CREATED,
        Json(json!({ "success": true, "programme": programme })),
    ))
}

/// GET /api/bourse-livre/v2/programmes
#[derive(Debug, Deserialize)]
pub struct ProgrammesQuery {
    pub classe: Option<String>,
    pub matiere: Option<String>,
    pub niveau: Option<String>,
    pub pays: Option<String>,
}

pub async fn get_programmes_scolaires(
    State(state): State<Arc<AppState>>,
    Query(params): Query<ProgrammesQuery>,
) -> AppResult<impl IntoResponse> {
    let mut conditions = vec!["is_active = true".to_string()];
    let mut param_idx = 1;

    if params.classe.is_some() {
        conditions.push(format!("classe = ${}", param_idx));
        param_idx += 1;
    }
    if params.matiere.is_some() {
        conditions.push(format!("matiere = ${}", param_idx));
        param_idx += 1;
    }
    if params.niveau.is_some() {
        conditions.push(format!("niveau = ${}", param_idx));
        param_idx += 1;
    }
    if params.pays.is_some() {
        conditions.push(format!("pays = ${}", param_idx));
        // param_idx += 1; // unused after this
    }

    let sql = format!(
        "SELECT * FROM programmes_scolaires WHERE {} ORDER BY classe, matiere",
        conditions.join(" AND ")
    );

    let mut query = sqlx::query_as::<_, ProgrammeScolaire>(&sql);
    if let Some(classe) = &params.classe {
        query = query.bind(classe);
    }
    if let Some(matiere) = &params.matiere {
        query = query.bind(matiere);
    }
    if let Some(niveau) = &params.niveau {
        query = query.bind(niveau);
    }
    if let Some(pays) = &params.pays {
        query = query.bind(pays);
    }

    let programmes = match query.fetch_all(&state.pg).await {
        Ok(p) => p,
        Err(e) => {
            tracing::warn!(
                "[get_programmes_scolaires] DB error (table may not exist yet): {}",
                e
            );
            vec![]
        }
    };

    Ok(Json(json!({ "success": true, "programmes": programmes })))
}

// ============================================================================
// PAQUETS LIVRAISON COURSIER
// ============================================================================

/// POST /api/bourse-livre/v2/packages
/// Créer un paquet de livraison pour un échange/vente
#[derive(Debug, Deserialize)]
pub struct CreatePackageRequest {
    pub destinataire_id: i32,
    pub destinataire_gps: Option<String>,
    pub destinataire_adresse: Option<String>,
    pub expediteur_gps: Option<String>,
    pub expediteur_adresse: Option<String>,
    pub livre_ids: Vec<i32>,
    pub troc_ids: Option<Vec<i32>>,
}

pub async fn create_delivery_package(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<CreatePackageRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[create_delivery_package] User ID: {}, {} livres vers user {}",
        user_id,
        payload.livre_ids.len(),
        payload.destinataire_id
    );

    // Récupérer les livres et calculer la valeur totale
    let mut livres_json = Vec::new();
    let mut valeur_totale = 0.0f64;

    for livre_id in &payload.livre_ids {
        let livre = sqlx::query_as::<_, crate::models::livre_scolaire::LivreScolaire>(
            "SELECT * FROM livres_scolaires WHERE id = $1 AND user_id = $2",
        )
        .bind(livre_id)
        .bind(user_id)
        .fetch_optional(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur récupération livre: {}", e)))?
        .ok_or_else(|| AppError::NotFound(format!("Livre {} non trouvé", livre_id)))?;

        let valeur: f64 =
            livre.valeur_calculee.and_then(|v| v.to_string().parse().ok()).unwrap_or(0.0);

        livres_json.push(json!({
            "livre_id": livre.id,
            "titre": livre.titre,
            "valeur": valeur,
            "mode": livre.mode_listing
        }));

        valeur_totale += valeur;
    }

    let reference = generer_reference_paquet();
    let commission = valeur_totale * crate::models::livre_scolaire::TAUX_COMMISSION_APP;

    let package = sqlx::query_as::<_, BookDeliveryPackage>(
        r#"
        INSERT INTO book_delivery_packages (
            reference, destinataire_id, destinataire_gps, destinataire_adresse,
            expediteur_id, expediteur_gps, expediteur_adresse,
            livres, nombre_livres, troc_ids,
            valeur_totale, commission_app, statut
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'a_constituer')
        RETURNING *
        "#,
    )
    .bind(&reference)
    .bind(payload.destinataire_id)
    .bind(&payload.destinataire_gps)
    .bind(&payload.destinataire_adresse)
    .bind(user_id)
    .bind(&payload.expediteur_gps)
    .bind(&payload.expediteur_adresse)
    .bind(json!(livres_json))
    .bind(payload.livre_ids.len() as i32)
    .bind(payload.troc_ids.as_ref().map(|ids| json!(ids)))
    .bind(rust_decimal::Decimal::from_f64_retain(valeur_totale).unwrap_or_default())
    .bind(rust_decimal::Decimal::from_f64_retain(commission).unwrap_or_default())
    .fetch_one(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur création paquet: {}", e)))?;

    // ✅ Persister les commissions pour chaque livre du paquet
    for livre_info in &livres_json {
        let livre_id = livre_info.get("livre_id").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
        let valeur = livre_info.get("valeur").and_then(|v| v.as_f64()).unwrap_or(0.0);
        if valeur > 0.0 {
            let commission_livre = valeur * crate::models::livre_scolaire::TAUX_COMMISSION_APP;
            let reversement = valeur - commission_livre;
            if let Err(e) = record_book_commission(
                &state.pg,
                livre_id,
                Some(package.id),
                Some(user_id),
                Some(payload.destinataire_id),
                "troc",
                valeur,
                commission_livre,
                reversement,
            )
            .await
            {
                error!(
                    "[create_delivery_package] Erreur commission livre {}: {}",
                    livre_id, e
                );
            }
        }
    }

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "success": true,
            "package": package,
            "reference": reference,
            "valeur_totale": valeur_totale,
            "commission": commission
        })),
    ))
}

/// GET /api/bourse-livre/v2/packages/my
/// Mes paquets (en tant qu'expéditeur ou destinataire)
pub async fn get_my_packages(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    let packages = sqlx::query_as::<_, BookDeliveryPackage>(
        r#"
        SELECT * FROM book_delivery_packages
        WHERE destinataire_id = $1 OR expediteur_id = $1
        ORDER BY created_at DESC
        LIMIT 50
        "#,
    )
    .bind(user_id)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur récupération paquets: {}", e)))?;

    Ok(Json(json!({ "success": true, "packages": packages })))
}

/// GET /api/bourse-livre/v2/packages/courier
/// Paquets pour un coursier (à récupérer/livrer)
pub async fn get_courier_packages(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: courier_id, .. }): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    let packages = sqlx::query_as::<_, BookDeliveryPackage>(
        r#"
        SELECT * FROM book_delivery_packages
        WHERE coursier_id = $1 AND statut IN ('constitue', 'en_route')
        ORDER BY created_at ASC
        "#,
    )
    .bind(courier_id)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur récupération paquets coursier: {}", e)))?;

    Ok(Json(json!({ "success": true, "packages": packages })))
}

/// GET /api/bourse-livre/v2/packages/:id/detail
/// Détail complet d'un paquet pour le coursier: livres avec images, infos utilisateurs, itinéraire clair
pub async fn get_package_detail_for_courier(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(package_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    // Récupérer le paquet
    let package = sqlx::query_as::<_, BookDeliveryPackage>(
        "SELECT * FROM book_delivery_packages WHERE id = $1",
    )
    .bind(package_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur récupération paquet: {}", e)))?
    .ok_or_else(|| AppError::NotFound("Paquet non trouvé".to_string()))?;

    // Vérifier accès: coursier assigné, expéditeur ou destinataire
    let is_authorized = package.coursier_id == Some(user_id)
        || package.expediteur_id == user_id
        || package.destinataire_id == user_id;
    if !is_authorized {
        return Err(AppError::Forbidden("Accès refusé à ce paquet".to_string()));
    }

    // Récupérer infos expéditeur
    let expediteur_info =
        sqlx::query("SELECT id, nom, prenom, telephone, photo_url FROM users WHERE id = $1")
            .bind(package.expediteur_id)
            .fetch_optional(&state.pg)
            .await
            .ok()
            .flatten();

    // Récupérer infos destinataire
    let destinataire_info =
        sqlx::query("SELECT id, nom, prenom, telephone, photo_url FROM users WHERE id = $1")
            .bind(package.destinataire_id)
            .fetch_optional(&state.pg)
            .await
            .ok()
            .flatten();

    // Enrichir les livres avec images depuis la DB (au cas où le JSON livres n'a pas les images)
    let mut livres_enrichis = Vec::new();
    if let Some(livres_array) = package.livres.as_array() {
        for livre_json in livres_array {
            let livre_id = livre_json.get("livre_id").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
            if livre_id > 0 {
                if let Ok(Some(livre_db)) =
                    sqlx::query_as::<_, crate::models::livre_scolaire::LivreScolaire>(
                        "SELECT * FROM livres_scolaires WHERE id = $1",
                    )
                    .bind(livre_id)
                    .fetch_optional(&state.pg)
                    .await
                {
                    livres_enrichis.push(json!({
                        "livre_id": livre_db.id,
                        "titre": livre_db.titre,
                        "auteur": livre_db.auteur,
                        "matiere": livre_db.matiere,
                        "classe_actuelle": livre_db.classe_actuelle,
                        "classe_souhaitee": livre_db.classe_souhaitee,
                        "etat_livre": livre_db.etat_livre,
                        "image_recto": livre_db.image_recto,
                        "image_verso": livre_db.image_verso,
                        "valeur": livre_db.valeur_calculee,
                        "mode": livre_db.mode_listing
                    }));
                } else {
                    livres_enrichis.push(livre_json.clone());
                }
            } else {
                livres_enrichis.push(livre_json.clone());
            }
        }
    }

    // Construire les infos utilisateurs pour le coursier
    let format_user = |row: &sqlx::postgres::PgRow| -> serde_json::Value {
        use sqlx::Row;
        json!({
            "id": row.get::<i32, _>("id"),
            "nom": row.try_get::<String, _>("nom").ok().unwrap_or_default(),
            "prenom": row.try_get::<String, _>("prenom").ok().unwrap_or_default(),
            "telephone": row.try_get::<String, _>("telephone").ok().unwrap_or_default(),
            "photo_url": row.try_get::<String, _>("photo_url").ok()
        })
    };

    // Construire l'itinéraire clair pour le coursier
    let itineraire_coursier = json!({
        "etape_1_pickup": {
            "action": "RÉCUPÉRER le(s) livre(s)",
            "chez": expediteur_info.as_ref().map(|r| format_user(r)),
            "gps": package.expediteur_gps,
            "adresse": package.expediteur_adresse,
            "instructions": package.expediteur_instructions,
            "livres_a_recuperer": livres_enrichis.len()
        },
        "etape_2_dropoff": {
            "action": "LIVRER le(s) livre(s)",
            "chez": destinataire_info.as_ref().map(|r| format_user(r)),
            "gps": package.destinataire_gps,
            "adresse": package.destinataire_adresse,
            "instructions": package.destinataire_instructions
        }
    });

    Ok(Json(json!({
        "success": true,
        "package": {
            "id": package.id,
            "reference": package.reference,
            "statut": package.statut,
            "nombre_livres": package.nombre_livres,
            "valeur_totale": package.valeur_totale,
            "frais_livraison": package.frais_livraison,
            "devise": package.devise.as_deref().unwrap_or("XAF"),
            "eta_minutes": package.eta_minutes,
            "distance_metres": package.distance_totale_metres,
            "created_at": package.created_at,
        },
        "livres": livres_enrichis,
        "expediteur": expediteur_info.as_ref().map(|r| format_user(r)),
        "destinataire": destinataire_info.as_ref().map(|r| format_user(r)),
        "itineraire_coursier": itineraire_coursier,
        "troc_ids": package.troc_ids
    })))
}

/// PATCH /api/bourse-livre/v2/packages/:id/status
/// Mettre à jour le statut d'un paquet (coursier)
#[derive(Debug, Deserialize)]
pub struct UpdatePackageStatusRequest {
    pub statut: String, // 'constitue', 'en_route', 'livre', 'confirme'
}

pub async fn update_package_status(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(package_id): Path<i32>,
    Json(payload): Json<UpdatePackageStatusRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[update_package_status] User: {}, Package: {}, Status: {}",
        user_id, package_id, payload.statut
    );

    let date_field = match payload.statut.as_str() {
        "constitue" => "date_constitution",
        "livre" => "date_livraison",
        "confirme" => "date_confirmation",
        _ => "",
    };

    let sql = if !date_field.is_empty() {
        format!(
            "UPDATE book_delivery_packages SET statut = $1, {} = NOW() WHERE id = $2 RETURNING *",
            date_field
        )
    } else {
        "UPDATE book_delivery_packages SET statut = $1 WHERE id = $2 RETURNING *".to_string()
    };

    let package = sqlx::query_as::<_, BookDeliveryPackage>(&sql)
        .bind(&payload.statut)
        .bind(package_id)
        .fetch_optional(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur MAJ paquet: {}", e)))?
        .ok_or_else(|| AppError::NotFound("Paquet non trouvé".to_string()))?;

    // ✅ PHASE 3: Si constitué, déclencher automatiquement le dispatch (matching coursier)
    if payload.statut == "constitue" && package.delivery_uuid.is_none() {
        if package.expediteur_gps.is_some() && package.destinataire_gps.is_some() {
            info!(
                "[update_package_status] Auto-dispatch paquet {} vers système de livraison",
                package_id
            );
            // Mettre matching_status à 'searching' immédiatement
            sqlx::query(
                "UPDATE book_delivery_packages SET matching_status = 'searching' WHERE id = $1",
            )
            .bind(package_id)
            .execute(&state.pg)
            .await
            .ok();

            // Calculer itinéraire et frais
            let parse_gps = |gps: &str| -> Option<(f64, f64)> {
                let parts: Vec<&str> = gps.split(',').collect();
                if parts.len() == 2 {
                    Some((parts[0].trim().parse().ok()?, parts[1].trim().parse().ok()?))
                } else {
                    None
                }
            };
            if let (Some((exp_lat, exp_lng)), Some((dest_lat, dest_lng))) = (
                package.expediteur_gps.as_deref().and_then(parse_gps),
                package.destinataire_gps.as_deref().and_then(parse_gps),
            ) {
                let distance_m = crate::services::delivery_service::haversine_distance(
                    (exp_lat, exp_lng),
                    (dest_lat, dest_lng),
                );
                let eta_min = ((distance_m / 1000.0) / 25.0 * 60.0).max(15.0) as i32;
                let frais = package
                    .frais_livraison
                    .and_then(|f| f.to_string().parse::<f64>().ok())
                    .unwrap_or_else(|| (distance_m / 1000.0 * 500.0).max(1000.0));

                let itineraire = json!([
                    {"type":"pickup","gps":format!("{},{}", exp_lat, exp_lng),"adresse":package.expediteur_adresse,"user_id":package.expediteur_id,"ordre":1},
                    {"type":"dropoff","gps":format!("{},{}", dest_lat, dest_lng),"adresse":package.destinataire_adresse,"user_id":package.destinataire_id,"ordre":2}
                ]);

                sqlx::query(
                    "UPDATE book_delivery_packages SET itineraire = $1, eta_minutes = $2, distance_totale_metres = $3, frais_livraison = COALESCE(frais_livraison, $4) WHERE id = $5"
                )
                .bind(&itineraire)
                .bind(eta_min)
                .bind(distance_m as i32)
                .bind(rust_decimal::Decimal::from_f64_retain(frais))
                .bind(package_id)
                .execute(&state.pg)
                .await
                .ok();
            }
        } else {
            info!(
                "[update_package_status] GPS manquant pour auto-dispatch paquet {}",
                package_id
            );
        }
    }

    // ✅ Si confirmé: créditer le coursier et marquer les commissions comme reversées
    if payload.statut == "confirme" {
        // Créditer le coursier avec les frais de livraison (moins commission 20%)
        if let Some(coursier_id) = package.coursier_id {
            let frais = package
                .frais_livraison
                .and_then(|f| f.to_string().parse::<f64>().ok())
                .unwrap_or(0.0);
            if frais > 0.0 {
                let delivery_commission_rate = std::env::var("YUKPO_DELIVERY_COMMISSION_RATE")
                    .ok()
                    .and_then(|v| v.parse::<f64>().ok())
                    .unwrap_or(0.20);
                let commission_livraison = frais * delivery_commission_rate;
                let net_coursier = frais - commission_livraison;
                match credit_book_wallet(
                    &state.pg,
                    coursier_id,
                    net_coursier,
                    &format!("Reversement livraison paquet {}", package.reference),
                )
                .await
                {
                    Ok(_) => info!(
                        "[update_package_status] ✅ Coursier {} crédité {} XAF pour paquet {}",
                        coursier_id, net_coursier as i64, package.reference
                    ),
                    Err(e) => error!(
                        "[update_package_status] Erreur crédit coursier {}: {}",
                        coursier_id, e
                    ),
                }

                // ✅ Traçabilité: enregistrer la commission LIVRAISON séparément
                // (distincte de la commission LIVRE qui est de type 'troc' ou 'vente')
                if let Err(e) = record_book_commission(
                    &state.pg,
                    0,
                    Some(package_id),
                    None,
                    Some(coursier_id),
                    "commission_livraison",
                    frais,
                    commission_livraison,
                    net_coursier,
                )
                .await
                {
                    error!(
                        "[update_package_status] Erreur enregistrement commission livraison: {}",
                        e
                    );
                }
            }
        }
        // Marquer les commissions comme reversées
        if let Err(e) = mark_commissions_paid(&state.pg, Some(package_id), None).await {
            error!("[update_package_status] Erreur MAJ commissions: {}", e);
        }
    }

    Ok(Json(json!({ "success": true, "package": package })))
}

// ============================================================================
// DONS DE LIVRES
// ============================================================================

/// POST /api/bourse-livre/v2/donations/request
pub async fn request_donation(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<CreateDonationRequestPayload>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[request_donation] User: {}, Livre: {}",
        user_id, payload.livre_id
    );

    // Vérifier que le livre est en mode don
    let livre = sqlx::query_as::<_, crate::models::livre_scolaire::LivreScolaire>(
        "SELECT * FROM livres_scolaires WHERE id = $1 AND mode_listing = 'don' AND is_available = true",
    )
    .bind(payload.livre_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur vérification livre: {}", e)))?
    .ok_or_else(|| AppError::NotFound("Livre non disponible pour don".to_string()))?;

    if livre.user_id == user_id {
        return Err(AppError::BadRequest(
            "Vous ne pouvez pas demander votre propre livre en don".to_string(),
        ));
    }

    let donation = sqlx::query_as::<_, BookDonationRequest>(
        r#"
        INSERT INTO book_donation_requests (demandeur_id, livre_id, motif, justificatif_url)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        "#,
    )
    .bind(user_id)
    .bind(payload.livre_id)
    .bind(&payload.motif)
    .bind(&payload.justificatif_url)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur création demande de don: {}", e)))?;

    Ok((
        StatusCode::CREATED,
        Json(json!({ "success": true, "donation_request": donation })),
    ))
}

/// GET /api/bourse-livre/v2/donations/my
pub async fn get_my_donation_requests(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    let requests = sqlx::query_as::<_, BookDonationRequest>(
        "SELECT * FROM book_donation_requests WHERE demandeur_id = $1 ORDER BY created_at DESC",
    )
    .bind(user_id)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur récupération demandes: {}", e)))?;

    Ok(Json(
        json!({ "success": true, "donation_requests": requests }),
    ))
}

// ============================================================================
// CALCUL NET POUR ÉCHANGE
// ============================================================================

/// POST /api/bourse-livre/v2/calculate-net
/// Calculer le montant net à payer pour un échange
#[derive(Debug, Deserialize)]
pub struct CalculateNetRequest {
    pub livres_recus_ids: Vec<i32>,
    pub livres_donnes_ids: Vec<i32>,
    pub frais_livraison: Option<f64>,
}

pub async fn calculate_net_amount(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: _user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<CalculateNetRequest>,
) -> AppResult<impl IntoResponse> {
    let mut valeur_recus = 0.0f64;
    for livre_id in &payload.livres_recus_ids {
        let row: Option<(Option<rust_decimal::Decimal>,)> =
            sqlx::query_as("SELECT valeur_calculee FROM livres_scolaires WHERE id = $1")
                .bind(livre_id)
                .fetch_optional(&state.pg)
                .await
                .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?;

        if let Some((Some(val),)) = row {
            valeur_recus += val.to_string().parse::<f64>().unwrap_or(0.0);
        }
    }

    let mut valeur_donnes = 0.0f64;
    for livre_id in &payload.livres_donnes_ids {
        let row: Option<(Option<rust_decimal::Decimal>,)> =
            sqlx::query_as("SELECT valeur_calculee FROM livres_scolaires WHERE id = $1")
                .bind(livre_id)
                .fetch_optional(&state.pg)
                .await
                .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?;

        if let Some((Some(val),)) = row {
            valeur_donnes += val.to_string().parse::<f64>().unwrap_or(0.0);
        }
    }

    let frais = payload.frais_livraison.unwrap_or(0.0);
    let (montant_net, commission) = calculer_montant_net(valeur_recus, valeur_donnes, frais);

    Ok(Json(json!({
        "success": true,
        "valeur_livres_recus": valeur_recus,
        "valeur_livres_donnes": valeur_donnes,
        "commission": commission,
        "frais_livraison": frais,
        "montant_net_a_payer": montant_net,
        "devise": "XAF",
        "detail": format!(
            "({} + {} + {}) - {} = {} XAF",
            valeur_recus as i64, commission as i64, frais as i64, valeur_donnes as i64, montant_net as i64
        )
    })))
}

// ============================================================================
// UPLOAD FICHIER PROGRAMME SCOLAIRE (ADMIN)
// ============================================================================

/// POST /api/bourse-livre/v2/admin/programmes/upload
/// Upload un fichier PDF/Excel/Image de programme scolaire + extraction IA
pub async fn upload_programme_file(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: admin_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<crate::models::livre_scolaire::UploadProgrammeFileRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[upload_programme_file] Admin ID: {}, Fichier: {}, Période: {}",
        admin_id, payload.fichier_nom, payload.periode_academique
    );

    // Valider le type de fichier
    let valid_types = ["pdf", "excel", "image"];
    if !valid_types.contains(&payload.fichier_type.as_str()) {
        return Err(AppError::BadRequest(format!(
            "Type de fichier invalide: {}. Types acceptés: pdf, excel, image",
            payload.fichier_type
        )));
    }

    // Parser les dates de validité
    let date_debut = payload
        .date_debut_validite
        .as_deref()
        .and_then(|d| chrono::NaiveDate::parse_from_str(d, "%Y-%m-%d").ok());
    let date_fin = payload
        .date_fin_validite
        .as_deref()
        .and_then(|d| chrono::NaiveDate::parse_from_str(d, "%Y-%m-%d").ok());

    // Créer l'entrée programme en statut 'extracting'
    let programme_row = sqlx::query_as::<_, ProgrammeScolaire>(
        r#"
        INSERT INTO programmes_scolaires (
            pays, systeme_educatif, niveau, classe, matiere, titre_livre,
            annee_scolaire, est_obligatoire, is_active, created_by,
            fichier_url, fichier_type, fichier_nom,
            periode_academique, date_debut_validite, date_fin_validite,
            extraction_status
        )
        VALUES (
            COALESCE($1, 'Cameroun'), COALESCE($2, 'francophone'),
            $3, COALESCE($4, 'Toutes'), '-', 'Programme uploadé',
            $5, true, true, $6,
            'pending_storage', $7, $8,
            $9, $10, $11,
            'extracting'
        )
        RETURNING *
        "#,
    )
    .bind(&payload.pays)
    .bind(&payload.systeme_educatif)
    .bind(&payload.niveau)
    .bind(&payload.classe)
    .bind(&payload.periode_academique)
    .bind(admin_id)
    .bind(&payload.fichier_type)
    .bind(&payload.fichier_nom)
    .bind(&payload.periode_academique)
    .bind(date_debut)
    .bind(date_fin)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        error!("[upload_programme_file] Erreur INSERT: {}", e);
        AppError::Internal(format!("Erreur création programme: {}", e))
    })?;

    let programme_id = programme_row.id;

    // Lancer l'extraction IA
    let ai_service = BookExchangeAIService::new(state.ia.clone());
    let extraction_result = ai_service
        .extract_programme_from_file(
            &payload.fichier_base64,
            &payload.fichier_type,
            &payload.niveau,
            &payload.periode_academique,
            payload.classe.as_deref(),
        )
        .await;

    match extraction_result {
        Ok(result) => {
            let livres_json = serde_json::to_value(&result.livres).unwrap_or_default();
            let result_json = serde_json::to_value(&result).unwrap_or_default();

            // Mettre à jour avec les résultats
            sqlx::query(
                r#"
                UPDATE programmes_scolaires
                SET extraction_status = 'done',
                    extraction_result = $1,
                    livres_extraits = $2,
                    nombre_livres_extraits = $3
                WHERE id = $4
                "#,
            )
            .bind(&result_json)
            .bind(&livres_json)
            .bind(result.nombre_total)
            .bind(programme_id)
            .execute(&state.pg)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur MAJ extraction: {}", e)))?;

            // Créer automatiquement des entrées individuelles pour chaque livre extrait
            for livre in &result.livres {
                let _ = sqlx::query(
                    r#"
                    INSERT INTO programmes_scolaires (
                        pays, systeme_educatif, niveau, classe, matiere, titre_livre,
                        auteur_livre, editeur_livre, isbn_livre,
                        annee_scolaire, est_obligatoire, prix_officiel, is_active, created_by,
                        periode_academique, date_debut_validite, date_fin_validite,
                        extraction_status
                    )
                    VALUES (
                        COALESCE($1, 'Cameroun'), COALESCE($2, 'francophone'),
                        $3, COALESCE($4, $5), COALESCE($6, '-'), $7,
                        $8, $9, $10,
                        $11, COALESCE($12, true), $13, true, $14,
                        $15, $16, $17, 'done'
                    )
                    ON CONFLICT DO NOTHING
                    "#,
                )
                .bind(&payload.pays)
                .bind(&payload.systeme_educatif)
                .bind(&payload.niveau)
                .bind(&livre.classe)
                .bind(&payload.classe)
                .bind(&livre.matiere)
                .bind(&livre.titre)
                .bind(&livre.auteur)
                .bind(&livre.editeur)
                .bind(&livre.isbn)
                .bind(&payload.periode_academique)
                .bind(livre.est_obligatoire)
                .bind(livre.prix_officiel.map(rust_decimal::Decimal::from_f64_retain))
                .bind(admin_id)
                .bind(&payload.periode_academique)
                .bind(date_debut)
                .bind(date_fin)
                .execute(&state.pg)
                .await;
            }

            info!(
                "[upload_programme_file] ✅ {} livres extraits du programme {}",
                result.nombre_total, programme_id
            );

            Ok((
                StatusCode::CREATED,
                Json(json!({
                    "success": true,
                    "programme_id": programme_id,
                    "extraction": result,
                    "message": format!("{} livres extraits et ajoutés au programme", result.nombre_total)
                })),
            ))
        }
        Err(e) => {
            // Marquer l'extraction en erreur
            let _ = sqlx::query(
                "UPDATE programmes_scolaires SET extraction_status = 'error' WHERE id = $1",
            )
            .bind(programme_id)
            .execute(&state.pg)
            .await;

            error!("[upload_programme_file] Erreur extraction IA: {}", e);
            Ok((
                StatusCode::CREATED,
                Json(json!({
                    "success": true,
                    "programme_id": programme_id,
                    "extraction": null,
                    "message": "Programme créé mais extraction IA échouée. Réessayez ou ajoutez les livres manuellement."
                })),
            ))
        }
    }
}

// ============================================================================
// MATCHING IA LIVRE ↔ PROGRAMME (avec date)
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct MatchProgrammeRequest {
    pub livre_id: i32,
    pub date_troc: Option<String>, // ISO date, défaut = aujourd'hui
}

/// POST /api/bourse-livre/v2/match-programme
/// Matcher un livre avec le bon programme scolaire en tenant compte de la date
pub async fn match_livre_programme(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: _user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<MatchProgrammeRequest>,
) -> AppResult<impl IntoResponse> {
    info!("[match_livre_programme] Livre ID: {}", payload.livre_id);

    // Récupérer le livre
    let livre = sqlx::query_as::<_, crate::models::livre_scolaire::LivreScolaire>(
        "SELECT * FROM livres_scolaires WHERE id = $1",
    )
    .bind(payload.livre_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?
    .ok_or_else(|| AppError::NotFound("Livre non trouvé".to_string()))?;

    let date_troc = payload
        .date_troc
        .unwrap_or_else(|| chrono::Utc::now().format("%Y-%m-%d").to_string());

    // Récupérer les programmes actifs
    let programmes = sqlx::query_as::<_, ProgrammeScolaire>(
        r#"
        SELECT * FROM programmes_scolaires
        WHERE is_active = true
        AND extraction_status = 'done'
        ORDER BY periode_academique DESC
        LIMIT 200
        "#,
    )
    .fetch_all(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?;

    let programmes_json = serde_json::to_string(&programmes).unwrap_or_else(|_| "[]".to_string());

    // Utiliser l'IA pour matcher
    let ai_service = BookExchangeAIService::new(state.ia.clone());
    let match_result = ai_service
        .match_livre_to_programme(
            &livre.titre,
            livre.auteur.as_deref(),
            &livre.classe_actuelle,
            &livre.matiere,
            &date_troc,
            &programmes_json,
        )
        .await?;

    // Si match trouvé, mettre à jour le livre
    if match_result.matched {
        if let Some(prog_id) = match_result.programme_scolaire_id {
            sqlx::query(
                r#"
                UPDATE livres_scolaires
                SET est_au_programme = true,
                    programme_scolaire_id = $1,
                    programme_match_details = $2
                WHERE id = $3
                "#,
            )
            .bind(prog_id)
            .bind(&match_result.reasoning)
            .bind(payload.livre_id)
            .execute(&state.pg)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur MAJ: {}", e)))?;
        }
    }

    Ok(Json(json!({
        "success": true,
        "matching": match_result,
        "livre_id": payload.livre_id,
        "date_troc": date_troc
    })))
}

// ============================================================================
// ACHAT DIRECT (sans échange)
// ============================================================================

/// POST /api/bourse-livre/v2/purchases
/// Acheter un livre directement sans avoir de livres à échanger
pub async fn create_book_purchase(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser {
        id: acheteur_id, ..
    }): Extension<AuthenticatedUser>,
    Json(payload): Json<crate::models::livre_scolaire::CreateBookPurchaseRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[create_book_purchase] Acheteur: {}, Livre: {}",
        acheteur_id, payload.livre_id
    );

    // Récupérer le livre et vérifier qu'il est en vente
    let livre = sqlx::query_as::<_, crate::models::livre_scolaire::LivreScolaire>(
        "SELECT * FROM livres_scolaires WHERE id = $1 AND is_active = true AND is_available = true",
    )
    .bind(payload.livre_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?
    .ok_or_else(|| AppError::NotFound("Livre non trouvé ou indisponible".to_string()))?;

    // Vérifier que le livre est en mode vente
    let mode = livre.mode_listing.as_deref().unwrap_or("troc");
    if mode != "vente" && mode != "troc" {
        return Err(AppError::BadRequest(
            "Ce livre n'est pas disponible à l'achat. Mode actuel: ".to_string() + mode,
        ));
    }

    // Vérifier que l'acheteur n'est pas le vendeur
    if livre.user_id == acheteur_id {
        return Err(AppError::BadRequest(
            "Vous ne pouvez pas acheter votre propre livre".to_string(),
        ));
    }

    // Calculer le prix
    let prix_achat = livre
        .valeur_calculee
        .map(|v| v.to_string().parse::<f64>().unwrap_or(0.0))
        .unwrap_or_else(|| {
            livre
                .prix_detecte
                .map(|p| p.to_string().parse::<f64>().unwrap_or(0.0))
                .unwrap_or(0.0)
        });

    if prix_achat <= 0.0 {
        return Err(AppError::BadRequest(
            "Le prix du livre n'a pas été déterminé. Analyse IA requise.".to_string(),
        ));
    }

    let taux_commission = crate::models::livre_scolaire::TAUX_COMMISSION_APP;
    let commission = prix_achat * taux_commission;
    let montant_vendeur = prix_achat - commission;

    // ✅ Calcul automatique des frais de livraison via distance GPS (haversine)
    // Formule: distance_km * 500 XAF, minimum 1000 XAF, 0 si pas de GPS
    let frais_livraison = {
        let vendeur_gps = livre.gps.as_deref().unwrap_or("");
        let acheteur_gps = payload.gps_livraison.as_deref().unwrap_or("");

        if !vendeur_gps.is_empty() && !acheteur_gps.is_empty() {
            // Parser les coordonnées GPS "lat,lng"
            let parse_gps = |gps: &str| -> Option<(f64, f64)> {
                let parts: Vec<&str> = gps.split(',').collect();
                if parts.len() == 2 {
                    Some((parts[0].trim().parse().ok()?, parts[1].trim().parse().ok()?))
                } else {
                    None
                }
            };

            match (parse_gps(vendeur_gps), parse_gps(acheteur_gps)) {
                (Some(pos_vendeur), Some(pos_acheteur)) => {
                    let distance_km = crate::services::delivery_service::haversine_distance(
                        pos_vendeur,
                        pos_acheteur,
                    );
                    let cost = (distance_km * 500.0).max(1000.0);
                    info!(
                        "[create_book_purchase] Frais livraison calculés: {:.0} XAF (distance: {:.1} km)",
                        cost, distance_km
                    );
                    cost
                }
                _ => {
                    info!(
                        "[create_book_purchase] GPS invalide, frais livraison par défaut: 1000 XAF"
                    );
                    1000.0 // Minimum par défaut si GPS invalide
                }
            }
        } else {
            info!("[create_book_purchase] Pas de GPS, frais livraison: 0 (à calculer au dépôt)");
            0.0 // Sera calculé lors de la création du paquet livraison
        }
    };

    let montant_total = prix_achat + frais_livraison;

    let mode_livraison = payload.mode_livraison.as_deref().unwrap_or("depot_seulement");

    // Créer l'achat
    let purchase = sqlx::query_as::<_, crate::models::livre_scolaire::BookPurchase>(
        r#"
        INSERT INTO book_purchases (
            acheteur_id, livre_id, vendeur_id,
            prix_achat, commission_app, montant_vendeur,
            frais_livraison, montant_total, devise,
            mode_livraison, adresse_livraison, gps_livraison,
            paiement_methode, statut
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'XAF', $9, $10, $11, $12, 'en_attente')
        RETURNING *
        "#,
    )
    .bind(acheteur_id)
    .bind(payload.livre_id)
    .bind(livre.user_id)
    .bind(rust_decimal::Decimal::from_f64_retain(prix_achat))
    .bind(rust_decimal::Decimal::from_f64_retain(commission))
    .bind(rust_decimal::Decimal::from_f64_retain(montant_vendeur))
    .bind(rust_decimal::Decimal::from_f64_retain(frais_livraison))
    .bind(rust_decimal::Decimal::from_f64_retain(montant_total))
    .bind(mode_livraison)
    .bind(&payload.adresse_livraison)
    .bind(&payload.gps_livraison)
    .bind(&payload.paiement_methode)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        error!("[create_book_purchase] Erreur INSERT: {}", e);
        AppError::Internal(format!("Erreur création achat: {}", e))
    })?;

    info!(
        "[create_book_purchase] ✅ Achat créé: id={}, montant_total={} XAF",
        purchase.id, montant_total as i64
    );

    // ✅ Débiter le wallet de l'acheteur
    let paiement_statut = match debit_book_wallet(
        &state.pg,
        acheteur_id,
        montant_total,
        &format!("Achat livre #{} - {}", purchase.id, livre.titre),
    )
    .await
    {
        Ok(_) => {
            info!(
                "[create_book_purchase] ✅ Wallet débité {} XAF pour achat #{}",
                montant_total as i64, purchase.id
            );
            "paye"
        }
        Err(e) => {
            error!(
                "[create_book_purchase] ⚠️ Débit wallet échoué: {}. Achat en attente de paiement.",
                e
            );
            "en_attente"
        }
    };

    // Mettre à jour le statut de paiement
    sqlx::query("UPDATE book_purchases SET paiement_statut = $1 WHERE id = $2")
        .bind(paiement_statut)
        .bind(purchase.id)
        .execute(&state.pg)
        .await
        .ok();

    // ✅ Enregistrer la commission dans book_exchange_commissions
    if let Err(e) = record_book_commission(
        &state.pg,
        payload.livre_id,
        None,
        Some(livre.user_id),
        Some(acheteur_id),
        "vente",
        prix_achat,
        commission,
        montant_vendeur,
    )
    .await
    {
        error!(
            "[create_book_purchase] Erreur enregistrement commission: {}",
            e
        );
    }

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "success": true,
            "purchase": purchase,
            "paiement_statut": paiement_statut,
            "breakdown": {
                "prix_livre": prix_achat,
                "commission_app": commission,
                "montant_vendeur": montant_vendeur,
                "frais_livraison": frais_livraison,
                "montant_total": montant_total,
                "devise": "XAF"
            }
        })),
    ))
}

/// GET /api/bourse-livre/v2/purchases/my
/// Mes achats directs
pub async fn get_my_purchases(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    let purchases = sqlx::query_as::<_, crate::models::livre_scolaire::BookPurchase>(
        r#"
        SELECT * FROM book_purchases
        WHERE acheteur_id = $1 OR vendeur_id = $1
        ORDER BY created_at DESC
        LIMIT 50
        "#,
    )
    .bind(user_id)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?;

    Ok(Json(json!({ "success": true, "purchases": purchases })))
}

/// PATCH /api/bourse-livre/v2/purchases/:id/status
/// Confirmer paiement ou MAJ statut d'un achat
#[derive(Debug, Deserialize)]
pub struct UpdatePurchaseStatusRequest {
    pub statut: String, // 'confirme', 'en_livraison', 'livre', 'annule'
    pub paiement_reference: Option<String>,
}

pub async fn update_purchase_status(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(purchase_id): Path<i32>,
    Json(payload): Json<UpdatePurchaseStatusRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[update_purchase_status] User: {}, Purchase: {}, New status: {}",
        user_id, purchase_id, payload.statut
    );

    let valid_statuts = ["confirme", "en_livraison", "livre", "annule"];
    if !valid_statuts.contains(&payload.statut.as_str()) {
        return Err(AppError::BadRequest(format!(
            "Statut invalide: {}",
            payload.statut
        )));
    }

    let purchase = sqlx::query_as::<_, crate::models::livre_scolaire::BookPurchase>(
        r#"
        UPDATE book_purchases
        SET statut = $1,
            paiement_reference = COALESCE($2, paiement_reference),
            paiement_statut = CASE WHEN $1 = 'confirme' THEN 'paye' ELSE paiement_statut END
        WHERE id = $3 AND (acheteur_id = $4 OR vendeur_id = $4)
        RETURNING *
        "#,
    )
    .bind(&payload.statut)
    .bind(&payload.paiement_reference)
    .bind(purchase_id)
    .bind(user_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?
    .ok_or_else(|| AppError::NotFound("Achat non trouvé".to_string()))?;

    // Si livré, marquer le livre comme non disponible
    if payload.statut == "livre" {
        sqlx::query("UPDATE livres_scolaires SET is_available = false WHERE id = $1")
            .bind(purchase.livre_id)
            .execute(&state.pg)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur MAJ livre: {}", e)))?;

        // ✅ Créditer le vendeur avec son montant net
        if let Some(vendeur_id) = purchase.vendeur_id {
            let montant_vendeur = purchase
                .montant_vendeur
                .and_then(|m| m.to_string().parse::<f64>().ok())
                .unwrap_or(0.0);
            if montant_vendeur > 0.0 {
                match credit_book_wallet(
                    &state.pg,
                    vendeur_id,
                    montant_vendeur,
                    &format!("Reversement vente livre - Achat #{}", purchase_id),
                )
                .await
                {
                    Ok(_) => info!(
                        "[update_purchase_status] ✅ Vendeur {} crédité {} XAF pour achat #{}",
                        vendeur_id, montant_vendeur as i64, purchase_id
                    ),
                    Err(e) => error!(
                        "[update_purchase_status] Erreur crédit vendeur {}: {}",
                        vendeur_id, e
                    ),
                }
            }
        }

        // ✅ Marquer les commissions comme reversées
        if let Err(e) = mark_commissions_paid(&state.pg, None, Some(purchase.livre_id)).await {
            error!("[update_purchase_status] Erreur MAJ commission: {}", e);
        }
    }

    Ok(Json(json!({ "success": true, "purchase": purchase })))
}

// ============================================================================
// LIVRAISON DÉPÔT-SEULEMENT (coursier dépose sans récupérer)
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct CreateDepotOnlyPackageRequest {
    pub purchase_id: i32, // Lié à un achat direct
    pub gps_depot: String,
    pub adresse_depot: Option<String>,
    pub notes_coursier: Option<String>,
}

/// POST /api/bourse-livre/v2/packages/depot-only
/// Créer un paquet dépôt-seulement (pas de livres à récupérer, juste dépôt)
pub async fn create_depot_only_package(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<CreateDepotOnlyPackageRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[create_depot_only_package] User: {}, Purchase: {}",
        user_id, payload.purchase_id
    );

    // Vérifier que l'achat existe
    let purchase = sqlx::query_as::<_, crate::models::livre_scolaire::BookPurchase>(
        "SELECT * FROM book_purchases WHERE id = $1 AND (acheteur_id = $2 OR vendeur_id = $2)",
    )
    .bind(payload.purchase_id)
    .bind(user_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?
    .ok_or_else(|| AppError::NotFound("Achat non trouvé".to_string()))?;

    let reference = generer_reference_paquet();

    let package = sqlx::query_as::<_, BookDeliveryPackage>(
        r#"
        INSERT INTO book_delivery_packages (
            reference, expediteur_id, destinataire_id,
            livre_ids, gps_recuperation, gps_livraison,
            adresse_livraison, statut, nombre_livres,
            type_livraison, purchase_id, notes_coursier
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'a_constituer', 1, 'depot_seulement', $8, $9)
        RETURNING *
        "#,
    )
    .bind(&reference)
    .bind(purchase.vendeur_id) // L'expéditeur est le vendeur
    .bind(purchase.acheteur_id) // Le destinataire est l'acheteur
    .bind(serde_json::json!([purchase.livre_id]))
    .bind(&payload.gps_depot)
    .bind(&purchase.gps_livraison)
    .bind(&payload.adresse_depot)
    .bind(payload.purchase_id)
    .bind(&payload.notes_coursier)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        error!("[create_depot_only_package] Erreur: {}", e);
        AppError::Internal(format!("Erreur création paquet: {}", e))
    })?;

    // Lier le paquet à l'achat
    sqlx::query("UPDATE book_purchases SET package_id = $1 WHERE id = $2")
        .bind(package.id)
        .bind(payload.purchase_id)
        .execute(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?;

    info!(
        "[create_depot_only_package] ✅ Paquet dépôt-seulement créé: ref={}",
        reference
    );

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "success": true,
            "package": package,
            "type": "depot_seulement",
            "message": "Le coursier déposera le(s) livre(s) sans rien récupérer"
        })),
    ))
}

// ============================================================================
// HELPERS: WALLET & COMMISSIONS BOURSE DU LIVRE
// ============================================================================

/// Débiter le wallet d'un utilisateur pour un achat de livre
/// amount_xaf: montant en XAF (converti en centimes pour tokens_balance)
async fn debit_book_wallet(
    pool: &sqlx::PgPool,
    user_id: i32,
    amount_xaf: f64,
    reason: &str,
) -> AppResult<i64> {
    let amount_cents = (amount_xaf * 100.0) as i64;
    if amount_cents <= 0 {
        return Ok(0);
    }

    let mut tx = pool.begin().await.map_err(|e| AppError::Internal(format!("TX begin: {}", e)))?;

    let current: i64 = sqlx::query_scalar::<_, i64>(
        "SELECT COALESCE(tokens_balance, 0) FROM users WHERE id = $1 FOR UPDATE",
    )
    .bind(user_id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| AppError::Internal(format!("Wallet read: {}", e)))?;

    if current < amount_cents {
        return Err(AppError::BadRequest(format!(
            "Solde insuffisant. Solde: {} XAF, Requis: {} XAF",
            current / 100,
            amount_xaf as i64
        )));
    }

    let new_balance = current - amount_cents;
    sqlx::query("UPDATE users SET tokens_balance = $2 WHERE id = $1")
        .bind(user_id)
        .bind(new_balance)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Internal(format!("Wallet debit: {}", e)))?;

    tx.commit().await.map_err(|e| AppError::Internal(format!("TX commit: {}", e)))?;

    info!(
        "[BookWallet] Débit {} XAF user {} - {}. Solde: {} XAF",
        amount_xaf as i64,
        user_id,
        reason,
        new_balance / 100
    );
    Ok(new_balance)
}

/// Créditer le wallet d'un utilisateur (reversement vendeur/coursier)
async fn credit_book_wallet(
    pool: &sqlx::PgPool,
    user_id: i32,
    amount_xaf: f64,
    reason: &str,
) -> AppResult<i64> {
    let amount_cents = (amount_xaf * 100.0) as i64;
    if amount_cents <= 0 {
        return Ok(0);
    }

    let mut tx = pool.begin().await.map_err(|e| AppError::Internal(format!("TX begin: {}", e)))?;

    let current: i64 = sqlx::query_scalar::<_, i64>(
        "SELECT COALESCE(tokens_balance, 0) FROM users WHERE id = $1 FOR UPDATE",
    )
    .bind(user_id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| AppError::Internal(format!("Wallet read: {}", e)))?;

    let new_balance = current + amount_cents;
    sqlx::query("UPDATE users SET tokens_balance = $2 WHERE id = $1")
        .bind(user_id)
        .bind(new_balance)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Internal(format!("Wallet credit: {}", e)))?;

    tx.commit().await.map_err(|e| AppError::Internal(format!("TX commit: {}", e)))?;

    info!(
        "[BookWallet] Crédit {} XAF user {} - {}. Solde: {} XAF",
        amount_xaf as i64,
        user_id,
        reason,
        new_balance / 100
    );
    Ok(new_balance)
}

/// Enregistrer une commission dans book_exchange_commissions
async fn record_book_commission(
    pool: &sqlx::PgPool,
    livre_id: i32,
    package_id: Option<i32>,
    vendeur_id: Option<i32>,
    acheteur_id: Option<i32>,
    type_transaction: &str,
    valeur_livre: f64,
    montant_commission: f64,
    montant_reversement: f64,
) -> AppResult<i32> {
    let id: i32 = sqlx::query_scalar::<_, i32>(
        r#"
        INSERT INTO book_exchange_commissions (
            livre_id, package_id, vendeur_id, acheteur_id,
            type_transaction, valeur_livre, taux_commission,
            montant_commission, montant_reversement_vendeur, devise,
            reversement_statut
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'XAF', 'en_attente')
        RETURNING id
        "#,
    )
    .bind(livre_id)
    .bind(package_id)
    .bind(vendeur_id)
    .bind(acheteur_id)
    .bind(type_transaction)
    .bind(rust_decimal::Decimal::from_f64_retain(valeur_livre).unwrap_or_default())
    .bind(
        rust_decimal::Decimal::from_f64_retain(crate::models::livre_scolaire::TAUX_COMMISSION_APP)
            .unwrap_or_default(),
    )
    .bind(rust_decimal::Decimal::from_f64_retain(montant_commission).unwrap_or_default())
    .bind(rust_decimal::Decimal::from_f64_retain(montant_reversement).unwrap_or_default())
    .fetch_one(pool)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur commission: {}", e)))?;

    info!(
        "[BookCommission] id={}, livre={}, type={}, commission={} XAF",
        id, livre_id, type_transaction, montant_commission as i64
    );
    Ok(id)
}

// ============================================================================
// PHASE 3: PARCOURIR LIVRES PAR CLASSE (ACHAT SANS TROC)
// ============================================================================

/// GET /api/bourse-livre/v2/browse-by-class
/// Parcourir les livres disponibles par classe, avec images et filtres
/// Permet à un utilisateur de sélectionner des livres à acheter sans avoir de livres à troquer
#[derive(Debug, Deserialize)]
pub struct BrowseByClassQuery {
    pub classe: Option<String>,       // "6ème", "5ème", etc.
    pub matiere: Option<String>,      // "Mathématiques", etc.
    pub niveau: Option<String>,       // "Primaire", "Collège", "Lycée"
    pub mode_listing: Option<String>, // "vente", "troc", "don" — filtre le mode
    pub ville: Option<String>,
    pub search: Option<String>, // recherche texte libre (titre, auteur)
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

pub async fn browse_books_by_class(
    State(state): State<Arc<AppState>>,
    Query(params): Query<BrowseByClassQuery>,
) -> AppResult<impl IntoResponse> {
    let limit = params.limit.unwrap_or(50).min(100);
    let offset = params.offset.unwrap_or(0);

    // ✅ Redis cache: clé basée sur les paramètres de recherche
    let cache_key = format!(
        "bourse_livre:browse:{}:{}:{}:{}:{}:{}:{}",
        params.classe.as_deref().unwrap_or("all"),
        params.matiere.as_deref().unwrap_or("all"),
        params.niveau.as_deref().unwrap_or("all"),
        params.mode_listing.as_deref().unwrap_or("all"),
        params.ville.as_deref().unwrap_or("all"),
        limit,
        offset
    );

    // Tenter le cache Redis via CacheService
    if let Ok(Some(cached)) = state.cache_service.get::<serde_json::Value>(&cache_key).await {
        info!("[browse_books_by_class] Cache hit: {}", cache_key);
        return Ok(Json(cached));
    }

    // Construire la requête SQL dynamique
    let mut conditions = vec![
        "is_available = true".to_string(),
        "is_active = true".to_string(),
    ];
    let mut bind_idx = 1u32;
    let mut binds: Vec<String> = Vec::new();

    if let Some(ref classe) = params.classe {
        conditions.push(format!("classe_actuelle = ${}", bind_idx));
        binds.push(classe.clone());
        bind_idx += 1;
    }
    if let Some(ref matiere) = params.matiere {
        conditions.push(format!("matiere = ${}", bind_idx));
        binds.push(matiere.clone());
        bind_idx += 1;
    }
    if let Some(ref niveau) = params.niveau {
        conditions.push(format!("niveau = ${}", bind_idx));
        binds.push(niveau.clone());
        bind_idx += 1;
    }
    if let Some(ref mode) = params.mode_listing {
        conditions.push(format!("mode_listing = ${}", bind_idx));
        binds.push(mode.clone());
        bind_idx += 1;
    }
    if let Some(ref ville) = params.ville {
        conditions.push(format!("ville ILIKE ${}", bind_idx));
        binds.push(format!("%{}%", ville));
        bind_idx += 1;
    }
    if let Some(ref search) = params.search {
        conditions.push(format!("(titre ILIKE ${0} OR auteur ILIKE ${0})", bind_idx));
        binds.push(format!("%{}%", search));
        #[allow(unused_assignments)]
        {
            bind_idx += 1;
        }
    }

    let where_clause = conditions.join(" AND ");
    let sql = format!(
        r#"SELECT id, titre, auteur, editeur, isbn, classe_actuelle, classe_souhaitee,
           matiere, niveau, etat_livre, etat_classification, description_etat,
           image_recto, image_verso,
           mode_listing, valeur_calculee, prix_detecte, devise_detectee,
           est_au_programme, programme_scolaire_id, ville, gps,
           created_at, user_id
           FROM livres_scolaires
           WHERE {}
           ORDER BY est_au_programme DESC NULLS LAST, created_at DESC
           LIMIT {} OFFSET {}"#,
        where_clause, limit, offset
    );

    // Exécuter avec les binds dynamiques
    let mut query = sqlx::query(&sql);
    for b in &binds {
        query = query.bind(b);
    }

    let rows = query
        .fetch_all(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur recherche livres: {}", e)))?;

    // Compter le total
    let count_sql = format!(
        "SELECT COUNT(*) as total FROM livres_scolaires WHERE {}",
        where_clause
    );
    let mut count_query = sqlx::query_scalar::<_, i64>(&count_sql);
    for b in &binds {
        count_query = count_query.bind(b);
    }
    let total = count_query.fetch_one(&state.pg).await.unwrap_or(0);

    // Lister les classes disponibles pour le filtre
    let classes_disponibles: Vec<String> = sqlx::query_scalar::<_, String>(
        "SELECT DISTINCT classe_actuelle FROM livres_scolaires WHERE is_available = true AND is_active = true ORDER BY classe_actuelle"
    )
    .fetch_all(&state.pg)
    .await
    .unwrap_or_default();

    // Formater les résultats avec images
    let livres: Vec<serde_json::Value> = rows
        .iter()
        .map(|row| {
            use sqlx::Row;
            json!({
                "id": row.get::<i32, _>("id"),
                "titre": row.get::<String, _>("titre"),
                "auteur": row.try_get::<String, _>("auteur").ok(),
                "editeur": row.try_get::<String, _>("editeur").ok(),
                "isbn": row.try_get::<String, _>("isbn").ok(),
                "classe_actuelle": row.get::<String, _>("classe_actuelle"),
                "classe_souhaitee": row.get::<String, _>("classe_souhaitee"),
                "matiere": row.get::<String, _>("matiere"),
                "niveau": row.try_get::<String, _>("niveau").ok(),
                "etat_livre": row.get::<String, _>("etat_livre"),
                "etat_classification": row.try_get::<String, _>("etat_classification").ok(),
                "description_etat": row.try_get::<String, _>("description_etat").ok(),
                "image_recto": row.try_get::<String, _>("image_recto").ok(),
                "image_verso": row.try_get::<String, _>("image_verso").ok(),
                "mode_listing": row.try_get::<String, _>("mode_listing").ok(),
                "valeur_calculee": row.try_get::<rust_decimal::Decimal, _>("valeur_calculee").ok(),
                "prix_detecte": row.try_get::<rust_decimal::Decimal, _>("prix_detecte").ok(),
                "devise": row.try_get::<String, _>("devise_detectee").ok().unwrap_or_else(|| "XAF".to_string()),
                "est_au_programme": row.try_get::<bool, _>("est_au_programme").ok(),
                "programme_scolaire_id": row.try_get::<i32, _>("programme_scolaire_id").ok(),
                "ville": row.try_get::<String, _>("ville").ok(),
                "user_id": row.get::<i32, _>("user_id"),
            })
        })
        .collect();

    let response = json!({
        "success": true,
        "livres": livres,
        "total": total,
        "limit": limit,
        "offset": offset,
        "classes_disponibles": classes_disponibles,
        "filtres_appliques": {
            "classe": params.classe,
            "matiere": params.matiere,
            "niveau": params.niveau,
            "mode_listing": params.mode_listing,
            "ville": params.ville,
            "search": params.search
        }
    });

    // Sauvegarder en cache Redis (TTL 5 minutes) via CacheService
    let _ = state
        .cache_service
        .set_with_ttl(&cache_key, &response, std::time::Duration::from_secs(300))
        .await;

    Ok(Json(response))
}

/// GET /api/bourse-livre/v2/classes-programmes
/// Retourne les classes avec le nombre de livres disponibles et au programme
pub async fn get_classes_with_programmes(
    State(state): State<Arc<AppState>>,
) -> AppResult<impl IntoResponse> {
    // Cache Redis via CacheService
    let cache_key = "bourse_livre:classes_programmes";
    if let Ok(Some(cached)) = state.cache_service.get::<serde_json::Value>(cache_key).await {
        info!("[get_classes_with_programmes] Cache hit");
        return Ok(Json(cached));
    }

    let rows = sqlx::query(
        r#"SELECT classe_actuelle as classe,
           COUNT(*) as total_livres,
           COUNT(*) FILTER (WHERE est_au_programme = true) as au_programme,
           COUNT(*) FILTER (WHERE mode_listing = 'vente') as en_vente,
           COUNT(*) FILTER (WHERE mode_listing = 'troc') as en_troc,
           COUNT(*) FILTER (WHERE mode_listing = 'don') as en_don
           FROM livres_scolaires
           WHERE is_available = true AND is_active = true AND classe_actuelle != ''
           GROUP BY classe_actuelle
           ORDER BY classe_actuelle"#,
    )
    .fetch_all(&state.pg)
    .await
    .unwrap_or_default();

    let classes: Vec<serde_json::Value> = rows
        .iter()
        .map(|row| {
            use sqlx::Row;
            let classe: String = row.get("classe");
            let niveau =
                crate::services::book_exchange_ai_service::compute_niveau_from_classe(&classe);
            json!({
                "classe": classe,
                "niveau": niveau,
                "total_livres": row.get::<i64, _>("total_livres"),
                "au_programme": row.get::<i64, _>("au_programme"),
                "en_vente": row.get::<i64, _>("en_vente"),
                "en_troc": row.get::<i64, _>("en_troc"),
                "en_don": row.get::<i64, _>("en_don"),
            })
        })
        .collect();

    let response = json!({
        "success": true,
        "classes": classes
    });

    // Sauvegarder en cache Redis (TTL 10 minutes) via CacheService
    let _ = state
        .cache_service
        .set_with_ttl(cache_key, &response, std::time::Duration::from_secs(600))
        .await;

    Ok(Json(response))
}

// ============================================================================
// PHASE 3: PONT VERS SYSTÈME DE LIVRAISON INTELLIGENT
// ============================================================================

/// POST /api/bourse-livre/v2/packages/:id/dispatch
/// Déclenche le matching coursier via le système de livraison intelligent
pub async fn dispatch_book_package(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(package_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[dispatch_book_package] User: {}, Package: {}",
        user_id, package_id
    );

    let package = sqlx::query_as::<_, BookDeliveryPackage>(
        "SELECT * FROM book_delivery_packages WHERE id = $1 AND (expediteur_id = $2 OR destinataire_id = $2)",
    )
    .bind(package_id)
    .bind(user_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?;

    let package = match package {
        Some(p) => p,
        None => {
            // Fallback: chercher sans filtre user (admin peut dispatcher)
            sqlx::query_as::<_, BookDeliveryPackage>(
                "SELECT * FROM book_delivery_packages WHERE id = $1",
            )
            .bind(package_id)
            .fetch_optional(&state.pg)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?
            .ok_or_else(|| AppError::NotFound("Paquet non trouvé".to_string()))?
        }
    };

    if package.statut != "constitue" && package.statut != "a_constituer" {
        return Err(AppError::BadRequest(
            "Le paquet doit être au statut 'constitué' ou 'à constituer' pour être dispatché"
                .to_string(),
        ));
    }

    // E2: VALIDATION BESOIN — vérifier que tous les paquets du destinataire sont constitués
    let troc_service = crate::services::troc_intelligent_service::TrocIntelligentService::new(
        Arc::new(state.pg.clone()),
    );

    let (is_ready, validation_msg, _) =
        troc_service.validate_need_fulfillment(package.destinataire_id).await?;

    if !is_ready {
        return Err(AppError::BadRequest(format!(
            "Impossible de dispatcher: {}. Tous les paquets du besoin doivent être constitués avant le dispatch coursier.",
            validation_msg
        )));
    }

    // Parser les coordonnées GPS
    let parse_gps = |gps: &str| -> Option<(f64, f64)> {
        let parts: Vec<&str> = gps.split(',').collect();
        if parts.len() == 2 {
            Some((parts[0].trim().parse().ok()?, parts[1].trim().parse().ok()?))
        } else {
            None
        }
    };

    let expediteur_pos = package.expediteur_gps.as_deref().and_then(parse_gps);
    let destinataire_pos = package.destinataire_gps.as_deref().and_then(parse_gps);

    if expediteur_pos.is_none() || destinataire_pos.is_none() {
        return Err(AppError::BadRequest(
            "Coordonnées GPS manquantes pour l'expéditeur ou le destinataire".to_string(),
        ));
    }

    let (exp_lat, exp_lng) = expediteur_pos.unwrap();
    let (dest_lat, dest_lng) = destinataire_pos.unwrap();

    // E3: ROUTE OPTIMISÉE — récupérer TOUS les paquets non-dispatchés
    // pour les mêmes utilisateurs, afin que le coursier ne revienne pas
    let all_user_packages = troc_service
        .get_all_packages_for_user(package.destinataire_id)
        .await
        .unwrap_or_default();

    // Calculer l'itinéraire optimisé si plusieurs paquets
    let itineraire = if all_user_packages.len() > 1 {
        let optimized = troc_service
            .compute_optimized_route(&all_user_packages)
            .await
            .unwrap_or_default();
        json!(optimized)
    } else {
        json!([
            {
                "type": "pickup",
                "gps": format!("{},{}", exp_lat, exp_lng),
                "adresse": package.expediteur_adresse,
                "user_id": package.expediteur_id,
                "ordre": 1,
                "instructions": package.expediteur_instructions
            },
            {
                "type": "dropoff",
                "gps": format!("{},{}", dest_lat, dest_lng),
                "adresse": package.destinataire_adresse,
                "user_id": package.destinataire_id,
                "ordre": 2,
                "instructions": package.destinataire_instructions
            }
        ])
    };

    // Calculer la distance et l'ETA
    let distance_m = crate::services::delivery_service::haversine_distance(
        (exp_lat, exp_lng),
        (dest_lat, dest_lng),
    );
    let eta_min = ((distance_m / 1000.0) / 25.0 * 60.0).max(15.0) as i32; // ~25 km/h en ville

    // Calculer les frais de livraison si pas encore fait
    let frais_livraison = package
        .frais_livraison
        .and_then(|f| f.to_string().parse::<f64>().ok())
        .unwrap_or_else(|| (distance_m / 1000.0 * 500.0).max(1000.0));

    // Créer la livraison dans le système intelligent
    let delivery_uuid = Uuid::new_v4();
    let metadata = json!({
        "source": "bourse_livre_v2",
        "book_package_id": package.id,
        "book_package_reference": package.reference,
        "nombre_livres": package.nombre_livres,
        "type": "book_delivery",
        "itineraire": itineraire,
        "creneau_expediteur": {
            "debut": package.creneau_expediteur_debut,
            "fin": package.creneau_expediteur_fin,
        },
        "creneau_destinataire": {
            "debut": package.creneau_destinataire_debut,
            "fin": package.creneau_destinataire_fin,
        }
    });

    // Insérer dans la table deliveries du système intelligent
    let delivery_insert = sqlx::query_scalar::<_, Uuid>(
        r#"
        INSERT INTO deliveries (
            id, creator_id, status,
            pickup_address, pickup_location,
            dropoff_address, dropoff_location,
            distance_meters, metadata, created_at, updated_at
        )
        VALUES (
            $1, $2, 'pending'::delivery_status,
            $3, ST_SetSRID(ST_MakePoint($4::double precision, $5::double precision), 4326)::geography,
            $6, ST_SetSRID(ST_MakePoint($7::double precision, $8::double precision), 4326)::geography,
            $9, $10, NOW(), NOW()
        )
        RETURNING id
        "#,
    )
    .bind(delivery_uuid)
    .bind(user_id)
    .bind(package.expediteur_adresse.as_deref().unwrap_or("Expéditeur livres"))
    .bind(exp_lng)
    .bind(exp_lat)
    .bind(package.destinataire_adresse.as_deref().unwrap_or("Destinataire livres"))
    .bind(dest_lng)
    .bind(dest_lat)
    .bind(distance_m as i32)
    .bind(&metadata)
    .fetch_one(&state.pg)
    .await;

    match delivery_insert {
        Ok(did) => {
            info!(
                "[dispatch_book_package] ✅ Delivery {} créée pour paquet {}",
                did, package.reference
            );

            // Mettre à jour le paquet avec le delivery_uuid et les infos calculées
            sqlx::query(
                r#"
                UPDATE book_delivery_packages
                SET delivery_uuid = $1, matching_status = 'searching',
                    frais_livraison = $2, itineraire = $3,
                    eta_minutes = $4, distance_totale_metres = $5,
                    statut = CASE WHEN statut = 'a_constituer' THEN 'constitue' ELSE statut END,
                    date_constitution = COALESCE(date_constitution, NOW()),
                    updated_at = NOW()
                WHERE id = $6
                "#,
            )
            .bind(did)
            .bind(rust_decimal::Decimal::from_f64_retain(frais_livraison))
            .bind(&itineraire)
            .bind(eta_min)
            .bind(distance_m as i32)
            .bind(package_id)
            .execute(&state.pg)
            .await
            .ok();

            // Envoyer notification aux expéditeur et destinataire
            let _ = sqlx::query(
                r#"INSERT INTO push_notifications (user_id, title, body, data, created_at)
                VALUES ($1, 'Coursier en recherche', 'Un coursier est recherché pour votre paquet de livres ' || $2, $3, NOW())"#,
            )
            .bind(package.expediteur_id)
            .bind(&package.reference)
            .bind(json!({"type": "book_package_dispatched", "package_id": package_id}))
            .execute(&state.pg)
            .await;

            let _ = sqlx::query(
                r#"INSERT INTO push_notifications (user_id, title, body, data, created_at)
                VALUES ($1, 'Livres en préparation', 'Un paquet de livres est en cours de préparation pour vous', $2, NOW())"#,
            )
            .bind(package.destinataire_id)
            .bind(json!({"type": "book_package_incoming", "package_id": package_id}))
            .execute(&state.pg)
            .await;

            Ok(Json(json!({
                "success": true,
                "delivery_uuid": did,
                "matching_status": "searching",
                "itineraire": itineraire,
                "eta_minutes": eta_min,
                "distance_metres": distance_m as i32,
                "frais_livraison": frais_livraison,
            })))
        }
        Err(e) => {
            error!("[dispatch_book_package] Erreur création delivery: {}", e);
            // Mettre le matching_status à 'pending' pour retry
            sqlx::query(
                "UPDATE book_delivery_packages SET matching_status = 'pending' WHERE id = $1",
            )
            .bind(package_id)
            .execute(&state.pg)
            .await
            .ok();
            Err(AppError::Internal(format!("Erreur dispatch: {}", e)))
        }
    }
}

/// PATCH /api/bourse-livre/v2/packages/:id/availability
/// Mettre à jour les créneaux de disponibilité
#[derive(Debug, Deserialize)]
pub struct UpdateAvailabilityRequest {
    pub creneau_debut: Option<String>,
    pub creneau_fin: Option<String>,
    pub instructions: Option<String>,
    pub role: String, // "expediteur" ou "destinataire"
}

pub async fn update_package_availability(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(package_id): Path<i32>,
    Json(payload): Json<UpdateAvailabilityRequest>,
) -> AppResult<impl IntoResponse> {
    let (debut_col, fin_col, instr_col) = match payload.role.as_str() {
        "expediteur" => (
            "creneau_expediteur_debut",
            "creneau_expediteur_fin",
            "expediteur_instructions",
        ),
        "destinataire" => (
            "creneau_destinataire_debut",
            "creneau_destinataire_fin",
            "destinataire_instructions",
        ),
        _ => {
            return Err(AppError::BadRequest(
                "Role doit être 'expediteur' ou 'destinataire'".to_string(),
            ))
        }
    };

    let sql = format!(
        "UPDATE book_delivery_packages SET {} = $1, {} = $2, {} = $3, updated_at = NOW() WHERE id = $4 AND ({} = $5 OR {} = $5) RETURNING id",
        debut_col, fin_col, instr_col,
        if payload.role == "expediteur" { "expediteur_id" } else { "destinataire_id" },
        if payload.role == "expediteur" { "expediteur_id" } else { "destinataire_id" },
    );

    let debut = payload
        .creneau_debut
        .as_deref()
        .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
        .map(|dt| dt.with_timezone(&chrono::Utc));
    let fin = payload
        .creneau_fin
        .as_deref()
        .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
        .map(|dt| dt.with_timezone(&chrono::Utc));

    let result = sqlx::query_scalar::<_, i32>(&sql)
        .bind(debut)
        .bind(fin)
        .bind(&payload.instructions)
        .bind(package_id)
        .bind(user_id)
        .fetch_optional(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur MAJ disponibilité: {}", e)))?;

    match result {
        Some(_) => Ok(Json(
            json!({"success": true, "message": "Créneaux mis à jour"}),
        )),
        None => Err(AppError::NotFound(
            "Paquet non trouvé ou non autorisé".to_string(),
        )),
    }
}

// ============================================================================
// DASHBOARDS LIVRES SCOLAIRES
// ============================================================================

/// GET /api/bourse-livre/v2/courier/dashboard
/// Dashboard coursier pour les paquets de livres
pub async fn courier_book_dashboard(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    // Paquets assignés au coursier (actifs)
    let mes_paquets = sqlx::query_as::<_, BookDeliveryPackage>(
        r#"
        SELECT * FROM book_delivery_packages
        WHERE coursier_id = $1 AND statut IN ('constitue', 'en_route')
        ORDER BY
            CASE WHEN statut = 'en_route' THEN 0 ELSE 1 END,
            created_at ASC
        "#,
    )
    .bind(user_id)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?;

    // Paquets disponibles dans la zone du coursier (pas encore assignés)
    // Utilise le GPS du coursier pour trouver les paquets proches
    let paquets_disponibles = sqlx::query_as::<_, BookDeliveryPackage>(
        r#"
        SELECT * FROM book_delivery_packages
        WHERE coursier_id IS NULL
            AND statut = 'constitue'
            AND matching_status IN ('searching', 'no_courier')
        ORDER BY created_at ASC
        LIMIT 20
        "#,
    )
    .fetch_all(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?;

    // Stats coursier livres
    let stats = sqlx::query_as::<_, (i64, i64, i64)>(
        r#"
        SELECT
            COUNT(*) FILTER (WHERE statut IN ('constitue', 'en_route')) as actifs,
            COUNT(*) FILTER (WHERE statut = 'confirme') as completes,
            COUNT(*) FILTER (WHERE statut = 'livre') as livres
        FROM book_delivery_packages
        WHERE coursier_id = $1
        "#,
    )
    .bind(user_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur stats: {}", e)))?
    .unwrap_or((0, 0, 0));

    // Gains totaux livres
    let gains: Option<f64> = sqlx::query_scalar(
        r#"
        SELECT COALESCE(SUM(
            COALESCE(frais_livraison::float8, 0) * 0.80
        ), 0)
        FROM book_delivery_packages
        WHERE coursier_id = $1 AND statut IN ('livre', 'confirme')
        "#,
    )
    .bind(user_id)
    .fetch_optional(&state.pg)
    .await
    .ok()
    .flatten();

    Ok(Json(json!({
        "success": true,
        "mes_paquets": mes_paquets,
        "paquets_disponibles": paquets_disponibles,
        "stats": {
            "actifs": stats.0,
            "completes": stats.1,
            "livres": stats.2,
            "gains_totaux_xaf": gains.unwrap_or(0.0) as i64,
        }
    })))
}

/// POST /api/bourse-livre/v2/courier/accept/:package_id
/// Coursier accepte un paquet de livres disponible
pub async fn courier_accept_book_package(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(package_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[courier_accept_book_package] Coursier {} accepte paquet {}",
        user_id, package_id
    );

    // Vérifier que le paquet est disponible
    let result = sqlx::query_scalar::<_, i32>(
        r#"
        UPDATE book_delivery_packages
        SET coursier_id = $1, matching_status = 'matched', updated_at = NOW()
        WHERE id = $2 AND coursier_id IS NULL AND statut = 'constitue'
        RETURNING id
        "#,
    )
    .bind(user_id)
    .bind(package_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?;

    match result {
        Some(_) => {
            info!(
                "[courier_accept_book_package] ✅ Coursier {} assigné au paquet {}",
                user_id, package_id
            );

            // Notifier expéditeur et destinataire
            let package = sqlx::query_as::<_, BookDeliveryPackage>(
                "SELECT * FROM book_delivery_packages WHERE id = $1",
            )
            .bind(package_id)
            .fetch_optional(&state.pg)
            .await
            .ok()
            .flatten();

            if let Some(pkg) = &package {
                let _ = sqlx::query(
                    "INSERT INTO push_notifications (user_id, title, body, data, created_at) VALUES ($1, 'Coursier trouvé !', 'Un coursier a accepté votre paquet de livres', $2, NOW())",
                )
                .bind(pkg.expediteur_id)
                .bind(json!({"type": "book_courier_matched", "package_id": package_id}))
                .execute(&state.pg)
                .await;

                let _ = sqlx::query(
                    "INSERT INTO push_notifications (user_id, title, body, data, created_at) VALUES ($1, 'Livres en chemin !', 'Un coursier va récupérer vos livres', $2, NOW())",
                )
                .bind(pkg.destinataire_id)
                .bind(json!({"type": "book_courier_matched", "package_id": package_id}))
                .execute(&state.pg)
                .await;
            }

            Ok(Json(json!({
                "success": true,
                "message": "Paquet accepté",
                "package": package,
            })))
        }
        None => Err(AppError::BadRequest(
            "Paquet non disponible ou déjà pris".to_string(),
        )),
    }
}

/// GET /api/bourse-livre/v2/user/book-dashboard
/// Dashboard utilisateur pour ses livres (à envoyer, à recevoir, achats)
pub async fn user_book_dashboard(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    // Paquets à envoyer (je suis expéditeur)
    let paquets_a_envoyer = sqlx::query_as::<_, BookDeliveryPackage>(
        r#"
        SELECT * FROM book_delivery_packages
        WHERE expediteur_id = $1 AND statut NOT IN ('confirme', 'annule')
        ORDER BY created_at DESC
        LIMIT 20
        "#,
    )
    .bind(user_id)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?;

    // Paquets à recevoir (je suis destinataire)
    let paquets_a_recevoir = sqlx::query_as::<_, BookDeliveryPackage>(
        r#"
        SELECT * FROM book_delivery_packages
        WHERE destinataire_id = $1 AND statut NOT IN ('confirme', 'annule')
        ORDER BY
            CASE WHEN statut = 'en_route' THEN 0
                 WHEN statut = 'constitue' THEN 1
                 ELSE 2 END,
            created_at DESC
        LIMIT 20
        "#,
    )
    .bind(user_id)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?;

    // Mes achats en cours
    let achats_en_cours = sqlx::query_as::<_, crate::models::livre_scolaire::BookPurchase>(
        r#"
        SELECT * FROM book_purchases
        WHERE (acheteur_id = $1 OR vendeur_id = $1)
            AND statut NOT IN ('livre', 'annule')
        ORDER BY created_at DESC
        LIMIT 20
        "#,
    )
    .bind(user_id)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?;

    // Historique complété
    let historique = sqlx::query_as::<_, BookDeliveryPackage>(
        r#"
        SELECT * FROM book_delivery_packages
        WHERE (expediteur_id = $1 OR destinataire_id = $1) AND statut IN ('confirme', 'livre')
        ORDER BY date_confirmation DESC NULLS LAST
        LIMIT 10
        "#,
    )
    .bind(user_id)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?;

    // Stats utilisateur
    let total_envoyes: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM book_delivery_packages WHERE expediteur_id = $1 AND statut = 'confirme'",
    )
    .bind(user_id)
    .fetch_one(&state.pg)
    .await
    .unwrap_or(0);

    let total_recus: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM book_delivery_packages WHERE destinataire_id = $1 AND statut = 'confirme'",
    )
    .bind(user_id)
    .fetch_one(&state.pg)
    .await
    .unwrap_or(0);

    Ok(Json(json!({
        "success": true,
        "paquets_a_envoyer": paquets_a_envoyer,
        "paquets_a_recevoir": paquets_a_recevoir,
        "achats_en_cours": achats_en_cours,
        "historique": historique,
        "stats": {
            "total_envoyes": total_envoyes,
            "total_recus": total_recus,
            "en_cours_envoi": paquets_a_envoyer.len(),
            "en_cours_reception": paquets_a_recevoir.len(),
        }
    })))
}

// ============================================================================
// CONSTITUTION INTELLIGENTE DES PAQUETS
// ============================================================================

/// POST /api/bourse-livre/v2/packages/build-intelligent
/// Constituer intelligemment les paquets pour l'utilisateur connecté.
/// Regroupe par couple (expéditeur → destinataire) à partir des trocs complétés non-packagés.
pub async fn build_intelligent_packages(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[build_intelligent_packages] Constitution paquets pour user {}",
        user_id
    );

    let troc_service = crate::services::troc_intelligent_service::TrocIntelligentService::new(
        Arc::new(state.pg.clone()),
    );

    let packages = troc_service.build_intelligent_packages(user_id).await?;

    Ok(Json(json!({
        "success": true,
        "packages_crees": packages.len(),
        "packages": packages,
        "message": if packages.is_empty() {
            "Aucun troc complété en attente de packaging"
        } else {
            "Paquets constitués avec succès"
        }
    })))
}

/// POST /api/bourse-livre/v2/packages/build-all
/// (Admin) Constituer les paquets pour TOUS les utilisateurs ayant des trocs non-packagés.
pub async fn build_all_pending_packages(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[build_all_pending_packages] Constitution batch déclenchée par user {}",
        user_id
    );

    // Vérifier que l'utilisateur est admin
    let is_admin: bool =
        sqlx::query_scalar("SELECT COALESCE(role = 'admin', false) FROM users WHERE id = $1")
            .bind(user_id)
            .fetch_one(&state.pg)
            .await
            .unwrap_or(false);

    if !is_admin {
        return Err(AppError::Forbidden(
            "Seul un administrateur peut déclencher la constitution batch".to_string(),
        ));
    }

    let troc_service = crate::services::troc_intelligent_service::TrocIntelligentService::new(
        Arc::new(state.pg.clone()),
    );

    let packages = troc_service.build_all_pending_packages().await?;

    Ok(Json(json!({
        "success": true,
        "packages_crees": packages.len(),
        "packages": packages,
    })))
}

// ============================================================================
// VALIDATION BESOIN & ROUTE OPTIMISÉE
// ============================================================================

/// GET /api/bourse-livre/v2/packages/validate-need
/// Vérifie que tous les paquets liés au besoin de l'utilisateur sont constitués
/// avant de permettre le dispatch coursier.
pub async fn validate_need_fulfillment(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[validate_need_fulfillment] Validation besoin pour user {}",
        user_id
    );

    let troc_service = crate::services::troc_intelligent_service::TrocIntelligentService::new(
        Arc::new(state.pg.clone()),
    );

    let (is_ready, message, details) = troc_service.validate_need_fulfillment(user_id).await?;

    Ok(Json(json!({
        "success": true,
        "is_ready_for_dispatch": is_ready,
        "message": message,
        "details": details,
    })))
}

/// POST /api/bourse-livre/v2/packages/optimized-route
/// Calcule la route optimisée pour un ensemble de paquets (coursier visite chaque user 1 seule fois).
/// Body: { "package_ids": [1, 2, 3] }
#[derive(Debug, Deserialize)]
pub struct OptimizedRouteRequest {
    pub package_ids: Vec<i32>,
}

pub async fn compute_optimized_route(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(body): Json<OptimizedRouteRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[compute_optimized_route] User: {}, {} paquets",
        user_id,
        body.package_ids.len()
    );

    let troc_service = crate::services::troc_intelligent_service::TrocIntelligentService::new(
        Arc::new(state.pg.clone()),
    );

    let waypoints = troc_service.compute_optimized_route(&body.package_ids).await?;

    Ok(Json(json!({
        "success": true,
        "waypoints": waypoints,
        "total_stops": waypoints.len(),
        "message": format!("{} arrêts optimisés pour {} paquets", waypoints.len(), body.package_ids.len()),
    })))
}

/// GET /api/bourse-livre/v2/packages/user-packages
/// Retourne tous les paquets non-dispatchés impliquant l'utilisateur
/// (pour que le coursier puisse tout prendre en un seul passage)
pub async fn get_all_packages_for_user(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    let troc_service = crate::services::troc_intelligent_service::TrocIntelligentService::new(
        Arc::new(state.pg.clone()),
    );

    let package_ids = troc_service.get_all_packages_for_user(user_id).await?;

    Ok(Json(json!({
        "success": true,
        "package_ids": package_ids,
        "total": package_ids.len(),
    })))
}

// ============================================================================
// V3: CHAÎNE DAG — ENDPOINTS
// ============================================================================

/// POST /api/bourse-livre/v2/chains/create
/// Sauvegarde une chaîne trouvée par find_matching_chaine dans la DB.
#[derive(Debug, Deserialize)]
pub struct CreateChainRequest {
    pub participants: Vec<serde_json::Value>,
    pub transfers: Vec<serde_json::Value>,
    pub distance_totale_km: Option<f64>,
    pub score_proximite: Option<f64>,
}

pub async fn create_chain_from_matching(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(body): Json<CreateChainRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[create_chain] User {} crée chaîne, {} transferts",
        user_id,
        body.transfers.len()
    );

    let chaine_id: i32 = sqlx::query_scalar(
        r#"
        INSERT INTO chaines_troc_livres (
            participants, transfers, statut, score_proximite, distance_totale_km
        )
        VALUES ($1, $2, 'en_formation', $3, $4)
        RETURNING id
        "#,
    )
    .bind(serde_json::json!(body.participants))
    .bind(serde_json::json!(body.transfers))
    .bind(body.score_proximite)
    .bind(body.distance_totale_km)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur création chaîne: {}", e)))?;

    Ok(Json(json!({
        "success": true,
        "chaine_id": chaine_id,
        "statut": "en_formation",
    })))
}

/// POST /api/bourse-livre/v2/chains/{id}/finalize
/// Finalise la chaîne: désactive livres, crée paquets, calcule route.
pub async fn finalize_chain(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(chaine_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[finalize_chain] User {} finalise chaîne {}",
        user_id, chaine_id
    );

    let svc = crate::services::troc_intelligent_service::TrocIntelligentService::new(Arc::new(
        state.pg.clone(),
    ));
    let result = svc.finalize_chain(chaine_id).await?;

    Ok(Json(json!({
        "success": true,
        "data": result,
    })))
}

/// POST /api/bourse-livre/v2/packages/cancel-book
/// Le coursier annule un livre sur le terrain.
/// Body: { "package_id": 1, "livre_id": 2, "raison": "livre introuvable" }
pub async fn cancel_book_on_site(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser {
        id: coursier_id, ..
    }): Extension<AuthenticatedUser>,
    Json(body): Json<crate::models::troc_livre::BookCancellationRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[cancel_book_on_site] Coursier {} annule livre {} du paquet {}",
        coursier_id, body.livre_id, body.package_id
    );

    let svc = crate::services::troc_intelligent_service::TrocIntelligentService::new(Arc::new(
        state.pg.clone(),
    ));
    let result = svc.cancel_book_on_site(coursier_id, body).await?;

    Ok(Json(json!({
        "success": true,
        "data": result,
    })))
}

/// POST /api/bourse-livre/v2/chains/{id}/schedule
/// Génère le planning multi-jours pour une chaîne finalisée.
pub async fn build_delivery_schedule(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(chaine_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[build_delivery_schedule] User {} pour chaîne {}",
        user_id, chaine_id
    );

    let svc = crate::services::troc_intelligent_service::TrocIntelligentService::new(Arc::new(
        state.pg.clone(),
    ));
    let result = svc.build_delivery_schedule(chaine_id).await?;

    Ok(Json(json!({
        "success": true,
        "data": result,
    })))
}

/// GET /api/bourse-livre/v2/chains/{id}
/// Récupère les détails d'une chaîne (transfers, route, schedule, paquets).
pub async fn get_chain_details(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: _user_id, .. }): Extension<AuthenticatedUser>,
    Path(chaine_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    let chaine = sqlx::query_as::<_, crate::models::troc_livre::ChaineTrocLivre>(
        "SELECT * FROM chaines_troc_livres WHERE id = $1",
    )
    .bind(chaine_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?
    .ok_or_else(|| AppError::NotFound("Chaîne non trouvée".to_string()))?;

    Ok(Json(json!({
        "success": true,
        "chaine": {
            "id": chaine.id,
            "statut": chaine.statut,
            "reference": chaine.reference,
            "participants": chaine.participants,
            "transfers": chaine.transfers,
            "route_optimisee": chaine.route_optimisee,
            "delivery_schedule": chaine.delivery_schedule,
            "package_ids": chaine.package_ids,
            "nombre_vendeurs": chaine.nombre_vendeurs,
            "score_proximite": chaine.score_proximite,
            "distance_totale_km": chaine.distance_totale_km,
            "date_validation": chaine.date_validation,
            "created_at": chaine.created_at,
        }
    })))
}

/// Marquer les commissions comme reversées
async fn mark_commissions_paid(
    pool: &sqlx::PgPool,
    package_id: Option<i32>,
    livre_id: Option<i32>,
) -> AppResult<()> {
    if let Some(pkg_id) = package_id {
        sqlx::query(
            "UPDATE book_exchange_commissions SET reversement_statut = 'effectue', reversement_date = NOW() WHERE package_id = $1 AND reversement_statut = 'en_attente'",
        )
        .bind(pkg_id)
        .execute(pool)
        .await
        .map_err(|e| AppError::Internal(format!("MAJ commission: {}", e)))?;
    }
    if let Some(lid) = livre_id {
        sqlx::query(
            "UPDATE book_exchange_commissions SET reversement_statut = 'effectue', reversement_date = NOW() WHERE livre_id = $1 AND reversement_statut = 'en_attente'",
        )
        .bind(lid)
        .execute(pool)
        .await
        .map_err(|e| AppError::Internal(format!("MAJ commission: {}", e)))?;
    }
    Ok(())
}
