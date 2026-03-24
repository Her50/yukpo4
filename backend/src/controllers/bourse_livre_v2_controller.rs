// ✅ V2: Contrôleur Bourse du Livre - Sessions d'upload, analyse recto-verso,
// paquets coursier, commissions, dons

use crate::core::types::{AppError, AppResult};
use crate::middlewares::jwt::AuthenticatedUser;
use crate::models::livre_scolaire::{
    calculer_montant_net, calculer_valeur_livre, generer_reference_paquet,
    infer_type_article_from_matiere, BookDeliveryPackage, BookDonationRequest, BookUploadSession,
    CreateDonationRequestPayload, CreateProgrammeScolaireRequest, CreateUploadSessionRequest,
    LivreExtraitProgramme, ProgrammeScolaire,
};
use crate::services::book_exchange_ai_service::BookExchangeAIService;
use crate::state::AppState;
use crate::utils::role_helpers::ensure_admin_role;
use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use log::{error, info, warn};
use serde::Deserialize;
use serde_json::json;
use std::collections::HashMap;
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

    // Invalider le cache après finalisation (livres rendus disponibles)
    invalidate_bourse_livre_cache(&state).await;

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

    // ✅ Limite 20 livres par session
    let current_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM livres_scolaires WHERE upload_session_id = $1")
            .bind(&request.session_id)
            .fetch_one(&state.pg)
            .await
            .unwrap_or(0);

    if current_count >= 20 {
        return Err(AppError::BadRequest(
            "Limite atteinte : maximum 20 livres par session d'upload.".to_string(),
        ));
    }

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
    let mut analysis = ai_service
        .analyze_book_recto_verso(
            &recto_b64,
            &verso_b64,
            request.user_lat,
            request.user_lng,
            &programmes_json,
        )
        .await?;

    // Prix sur couverture souvent illisible : compléter avec prix_officiel du programme si match
    BookExchangeAIService::enrich_prix_from_programmes_officiels(&mut analysis, &programmes);

    // Dernier filet de sécurité : si ni l'IA ni le matching programme n'ont trouvé de prix,
    // utiliser un barème de référence par niveau scolaire (prix catalogue moyen XAF)
    if analysis.prix_detecte.is_none() || analysis.prix_detecte == Some(0.0) {
        let niveau = analysis.niveau.as_deref().unwrap_or("").to_lowercase();
        let fallback_prix = if niveau.contains("maternelle")
            || niveau.contains("nursery")
            || niveau.contains("pre-primary")
        {
            1500.0
        } else if niveau.contains("primaire") || niveau.contains("primary") {
            2500.0
        } else if niveau.contains("collège")
            || niveau.contains("college")
            || niveau.contains("junior")
            || niveau.contains("jss")
            || niveau.contains("jhs")
        {
            4000.0
        } else if niveau.contains("lycée")
            || niveau.contains("lycee")
            || niveau.contains("senior")
            || niveau.contains("sss")
            || niveau.contains("shs")
            || niveau.contains("secondary")
        {
            5500.0
        } else if niveau.contains("université")
            || niveau.contains("universite")
            || niveau.contains("university")
        {
            8000.0
        } else {
            3500.0 // Valeur par défaut raisonnable
        };
        info!(
            "[analyze_recto_verso] Prix non détecté par l'IA ni par le programme — barème de référence appliqué: {} XAF (niveau: {:?})",
            fallback_prix, analysis.niveau
        );
        analysis.prix_detecte = Some(fallback_prix);
        let note = format!("prix_reference_bareme (niveau: {})", niveau);
        analysis.notes = Some(match analysis.notes.take() {
            Some(n) if !n.is_empty() => format!("{} | {}", n, note),
            _ => note,
        });
    }

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

    let upload_id = Uuid::new_v4().to_string();
    let recto_url = upload_book_image_to_cdn(
        &state.media_storage,
        &request.image_recto,
        &format!("livres/{}/recto_{}.jpg", user_id, upload_id),
    )
    .await
    .map_err(|e| {
        error!("[analyze_recto_verso] Erreur upload recto CDN: {}", e);
        AppError::Internal(format!("Erreur upload image recto: {}", e))
    })?;
    let verso_url = upload_book_image_to_cdn(
        &state.media_storage,
        &request.image_verso,
        &format!("livres/{}/verso_{}.jpg", user_id, upload_id),
    )
    .await
    .map_err(|e| {
        error!("[analyze_recto_verso] Erreur upload verso CDN: {}", e);
        AppError::Internal(format!("Erreur upload image verso: {}", e))
    })?;

    info!(
        "[analyze_recto_verso] Images uploadées CDN: recto={}, verso={}",
        &recto_url[..recto_url.len().min(80)],
        &verso_url[..verso_url.len().min(80)]
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

    // Invalider le cache après ajout d'un livre
    invalidate_bourse_livre_cache(&state).await;

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
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<CreateProgrammeScolaireRequest>,
) -> AppResult<impl IntoResponse> {
    ensure_admin_role(&user)?;
    let user_id = user.id;
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
    /// Si présent avec `classe` : fusionne programme établissement + référentiel national (Yukpo), l’établissement prime sur (matière, titre).
    pub etablissement_id: Option<i32>,
}

/// Référentiel national : lignes sans rattachement établissement.
fn merge_programmes_etablissement_puis_national(
    etablissement: Vec<ProgrammeScolaire>,
    national: Vec<ProgrammeScolaire>,
) -> Vec<ProgrammeScolaire> {
    let mut by_key: HashMap<(String, String), ProgrammeScolaire> = HashMap::new();
    for p in national {
        let k = (p.matiere.to_lowercase(), p.titre_livre.to_lowercase());
        by_key.entry(k).or_insert(p);
    }
    for p in etablissement {
        let k = (p.matiere.to_lowercase(), p.titre_livre.to_lowercase());
        by_key.insert(k, p);
    }
    let mut out: Vec<_> = by_key.into_values().collect();
    out.sort_by(|a, b| {
        a.classe
            .cmp(&b.classe)
            .then_with(|| a.matiere.cmp(&b.matiere))
            .then_with(|| a.titre_livre.cmp(&b.titre_livre))
    });
    out
}

pub async fn get_programmes_scolaires(
    State(state): State<Arc<AppState>>,
    Query(params): Query<ProgrammesQuery>,
) -> AppResult<impl IntoResponse> {
    let programmes = if params.classe.is_some() && params.etablissement_id.is_some() {
        let classe = params.classe.as_ref().unwrap().clone();
        let eid = params.etablissement_id.unwrap();

        let mut cond_etab = vec!["is_active = true".to_string(), "classe = $1".to_string()];
        cond_etab.push(format!("etablissement_id = ${}", 2));
        let mut p = 3;
        if params.matiere.is_some() {
            cond_etab.push(format!("matiere = ${}", p));
            p += 1;
        }
        if params.niveau.is_some() {
            cond_etab.push(format!("niveau = ${}", p));
        }
        let sql_etab = format!(
            "SELECT * FROM programmes_scolaires WHERE {} ORDER BY matiere, titre_livre",
            cond_etab.join(" AND ")
        );
        let mut q_etab = sqlx::query_as::<_, ProgrammeScolaire>(&sql_etab).bind(&classe).bind(eid);
        if let Some(m) = &params.matiere {
            q_etab = q_etab.bind(m);
        }
        if let Some(n) = &params.niveau {
            q_etab = q_etab.bind(n);
        }
        let etab_rows = q_etab.fetch_all(&state.pg).await.unwrap_or_default();

        let mut cond_nat = vec![
            "is_active = true".to_string(),
            "classe = $1".to_string(),
            "etablissement_id IS NULL".to_string(),
        ];
        let mut next = 2;
        if params.matiere.is_some() {
            cond_nat.push(format!("matiere = ${}", next));
            next += 1;
        }
        if params.niveau.is_some() {
            cond_nat.push(format!("niveau = ${}", next));
            next += 1;
        }
        if params.pays.is_some() {
            cond_nat.push(format!("pays = ${}", next));
        }
        let sql_nat = format!(
            "SELECT * FROM programmes_scolaires WHERE {} ORDER BY matiere, titre_livre",
            cond_nat.join(" AND ")
        );
        let mut q_nat = sqlx::query_as::<_, ProgrammeScolaire>(&sql_nat).bind(&classe);
        if let Some(m) = &params.matiere {
            q_nat = q_nat.bind(m);
        }
        if let Some(n) = &params.niveau {
            q_nat = q_nat.bind(n);
        }
        if let Some(p) = &params.pays {
            q_nat = q_nat.bind(p);
        }
        let nat_rows = q_nat.fetch_all(&state.pg).await.unwrap_or_default();

        merge_programmes_etablissement_puis_national(etab_rows, nat_rows)
    } else {
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

        match query.fetch_all(&state.pg).await {
            Ok(p) => p,
            Err(e) => {
                log::warn!(
                    "[get_programmes_scolaires] DB error (table may not exist yet): {}",
                    e
                );
                vec![]
            }
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
            "mode": livre.mode_listing,
            "matiere": livre.matiere,
            "type_article": infer_type_article_from_matiere(&livre.matiere)
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
                        "type_article": infer_type_article_from_matiere(&livre_db.matiere),
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
// ADMIN DONS — Gestion des demandes de don
// ============================================================================

/// GET /api/bourse-livre/v2/admin/donations
/// Liste toutes les demandes de don (admin uniquement)
pub async fn admin_list_donation_requests(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    ensure_admin_role(&user)?;
    let requests = sqlx::query_as::<_, BookDonationRequest>(
        r#"
        SELECT bdr.* FROM book_donation_requests bdr
        ORDER BY
            CASE bdr.statut WHEN 'en_attente' THEN 0 WHEN 'approuve' THEN 1 ELSE 2 END,
            bdr.created_at DESC
        LIMIT 200
        "#,
    )
    .fetch_all(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur admin donations: {}", e)))?;

    // Enrichir avec info livre + demandeur
    let mut enriched = Vec::new();
    for req in &requests {
        let livre_info: Option<(
            Option<String>,
            Option<String>,
            Option<String>,
            Option<String>,
        )> = sqlx::query_as(
            "SELECT titre, matiere, classe_actuelle, ville FROM livres_scolaires WHERE id = $1",
        )
        .bind(req.livre_id)
        .fetch_optional(&state.pg)
        .await
        .unwrap_or(None);

        let demandeur_name: Option<(Option<String>,)> =
            sqlx::query_as("SELECT full_name FROM users WHERE id = $1")
                .bind(req.demandeur_id)
                .fetch_optional(&state.pg)
                .await
                .unwrap_or(None);

        let donneur_name: Option<(Option<String>,)> = {
            let owner_id: Option<(Option<i32>,)> =
                sqlx::query_as("SELECT user_id FROM livres_scolaires WHERE id = $1")
                    .bind(req.livre_id)
                    .fetch_optional(&state.pg)
                    .await
                    .unwrap_or(None);
            if let Some((Some(uid),)) = owner_id {
                sqlx::query_as("SELECT full_name FROM users WHERE id = $1")
                    .bind(uid)
                    .fetch_optional(&state.pg)
                    .await
                    .unwrap_or(None)
            } else {
                None
            }
        };

        enriched.push(json!({
            "id": req.id,
            "demandeur_id": req.demandeur_id,
            "demandeur_nom": demandeur_name.and_then(|n| n.0).unwrap_or_default(),
            "livre_id": req.livre_id,
            "livre_titre": livre_info.as_ref().and_then(|l| l.0.as_deref()).unwrap_or("?"),
            "livre_matiere": livre_info.as_ref().and_then(|l| l.1.as_deref()).unwrap_or("?"),
            "livre_classe": livre_info.as_ref().and_then(|l| l.2.as_deref()).unwrap_or("?"),
            "livre_ville": livre_info.as_ref().and_then(|l| l.3.as_deref()).unwrap_or("?"),
            "donneur_nom": donneur_name.and_then(|n| n.0).unwrap_or_default(),
            "motif": req.motif,
            "justificatif_url": req.justificatif_url,
            "statut": req.statut,
            "created_at": req.created_at,
        }));
    }

    Ok(Json(json!({
        "success": true,
        "donation_requests": enriched,
        "total": enriched.len()
    })))
}

/// POST /api/bourse-livre/v2/admin/donations/:id/approve
/// Approuver une demande de don
#[derive(Debug, Deserialize)]
pub struct ApproveDonationPayload {
    pub note_admin: Option<String>,
}

pub async fn admin_approve_donation(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(donation_id): Path<i32>,
    Json(_payload): Json<ApproveDonationPayload>,
) -> AppResult<impl IntoResponse> {
    ensure_admin_role(&user)?;
    let admin_id = user.id;
    info!(
        "[admin_approve_donation] Admin: {}, Donation: {}",
        admin_id, donation_id
    );

    // Mettre à jour le statut
    let updated = sqlx::query_as::<_, BookDonationRequest>(
        r#"
        UPDATE book_donation_requests
        SET statut = 'approuve', updated_at = NOW()
        WHERE id = $1 AND statut = 'en_attente'
        RETURNING *
        "#,
    )
    .bind(donation_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur approbation don: {}", e)))?
    .ok_or_else(|| AppError::NotFound("Demande non trouvée ou déjà traitée".to_string()))?;

    // Marquer le livre comme indisponible (attribué au demandeur)
    let _ = sqlx::query("UPDATE livres_scolaires SET is_available = false WHERE id = $1")
        .bind(updated.livre_id)
        .execute(&state.pg)
        .await;

    // Notifier le demandeur (don approuvé)
    let _ = sqlx::query(
        r#"INSERT INTO notifications (user_id, type, title, body, data, created_at)
        VALUES ($1, 'donation_approved', 'Don approuvé !', 'Votre demande de don de livre a été approuvée. Le livre vous sera bientôt livré.', $2, NOW())"#,
    )
    .bind(updated.demandeur_id)
    .bind(json!({"donation_id": updated.id, "livre_id": updated.livre_id, "i18n_key": "donation_approved"}).to_string())
    .execute(&state.pg)
    .await;

    // Notifier le donneur (propriétaire du livre) que son livre a été attribué
    let donneur_id: Option<i32> =
        sqlx::query_scalar("SELECT user_id FROM livres_scolaires WHERE id = $1")
            .bind(updated.livre_id)
            .fetch_optional(&state.pg)
            .await
            .ok()
            .flatten();

    if let Some(donneur_id) = donneur_id {
        let _ = sqlx::query(
            r#"INSERT INTO notifications (user_id, type, title, body, data, created_at)
            VALUES ($1, 'donation_attributed', 'Livre attribué', 'Votre livre en don a été attribué à un demandeur. Merci pour votre générosité !', $2, NOW())"#,
        )
        .bind(donneur_id)
        .bind(json!({"donation_id": updated.id, "livre_id": updated.livre_id, "i18n_key": "donation_attributed"}).to_string())
        .execute(&state.pg)
        .await;
    }

    Ok(Json(json!({
        "success": true,
        "message": "Don approuvé avec succès",
        "donation_request": updated
    })))
}

/// POST /api/bourse-livre/v2/admin/donations/:id/reject
pub async fn admin_reject_donation(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(donation_id): Path<i32>,
    Json(_payload): Json<ApproveDonationPayload>,
) -> AppResult<impl IntoResponse> {
    ensure_admin_role(&user)?;
    let admin_id = user.id;
    info!(
        "[admin_reject_donation] Admin: {}, Donation: {}",
        admin_id, donation_id
    );

    let updated = sqlx::query_as::<_, BookDonationRequest>(
        r#"
        UPDATE book_donation_requests
        SET statut = 'refuse', updated_at = NOW()
        WHERE id = $1 AND statut = 'en_attente'
        RETURNING *
        "#,
    )
    .bind(donation_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur rejet don: {}", e)))?
    .ok_or_else(|| AppError::NotFound("Demande non trouvée ou déjà traitée".to_string()))?;

    // Notifier le demandeur (don refusé)
    let _ = sqlx::query(
        r#"INSERT INTO notifications (user_id, type, title, body, data, created_at)
        VALUES ($1, 'donation_rejected', 'Demande de don refusée', 'Votre demande de don de livre n''a pas été retenue. Vous pouvez consulter d''autres livres disponibles.', $2, NOW())"#,
    )
    .bind(updated.demandeur_id)
    .bind(json!({"donation_id": updated.id, "livre_id": updated.livre_id, "i18n_key": "donation_rejected"}).to_string())
    .execute(&state.pg)
    .await;

    Ok(Json(json!({
        "success": true,
        "message": "Demande de don refusée",
        "donation_request": updated
    })))
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

fn matiere_avec_type_article(l: &LivreExtraitProgramme) -> String {
    let base = l.matiere.clone().unwrap_or_else(|| "-".to_string());
    match l.type_article.as_deref().map(|s| s.to_lowercase()).as_deref() {
        Some("cahier") => format!("[Cahier] {}", base),
        Some("fourniture") | Some("fournitures") => format!("[Fourniture] {}", base),
        Some("livre") | None => base,
        Some(other) if !other.is_empty() && other != "livre" => format!("[{}] {}", other, base),
        _ => base,
    }
}

// ============================================================================
// UPLOAD FICHIER PROGRAMME SCOLAIRE (ADMIN)
// ============================================================================

/// POST /api/bourse-livre/v2/admin/programmes/upload
/// Upload un fichier PDF/Excel/Image de programme scolaire + extraction IA
pub async fn upload_programme_file(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<crate::models::livre_scolaire::UploadProgrammeFileRequest>,
) -> AppResult<impl IntoResponse> {
    ensure_admin_role(&user)?;
    let admin_id = user.id;
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
                let matiere_row = matiere_avec_type_article(livre);
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
                .bind(&matiere_row)
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
// SOUMISSION MANUELS SCOLAIRES ÉTABLISSEMENT (mobile — App IA / Yukpo)
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct SubmitProgrammeFichierIn {
    pub nom: String,
    #[serde(rename = "type")]
    pub file_type: String,
    pub base64: String,
}

#[derive(Debug, Deserialize)]
pub struct SubmitProgrammesEtablissementRequest {
    pub nom_etablissement: String,
    pub pays: Option<String>,
    pub ville: Option<String>,
    pub niveaux: Vec<String>,
    pub annee_scolaire: String,
    pub commentaire: Option<String>,
    pub gps_coords: Option<String>,
    pub gps_address: Option<String>,
    /// Si l'établissement existe déjà dans Yukpo (orientation).
    pub etablissement_id: Option<i32>,
    /// Rayon (km) pour cibler les librairies partenaires (défaut 75, max 300).
    #[serde(default)]
    pub notification_radius_km: Option<f64>,
    pub fichiers: Vec<SubmitProgrammeFichierIn>,
}

#[derive(sqlx::FromRow)]
struct PartnerGeoRow {
    id: i32,
    gps: Option<String>,
    etab_ville: Option<String>,
    book_ville: Option<String>,
}

/// Clé de comparaison ville : minuscules, sans accents (NFD + retrait des marques combinantes), espaces normalisés.
fn ville_key_for_match(s: &str) -> String {
    use unicode_normalization::UnicodeNormalization;
    s.trim()
        .nfd()
        .filter(|c| !unicode_normalization::char::is_combining_mark(*c))
        .collect::<String>()
        .to_lowercase()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn ville_matches_hint(partner_city: &str, hint: &str) -> bool {
    let a = ville_key_for_match(partner_city);
    let b = ville_key_for_match(hint);
    if a.is_empty() || b.is_empty() {
        return false;
    }
    a == b || a.contains(&b) || b.contains(&a)
}

fn parse_lat_lng_coords(s: &str) -> Option<(f64, f64)> {
    let parts: Vec<&str> = s.split(',').map(|p| p.trim()).filter(|p| !p.is_empty()).collect();
    if parts.len() >= 2 {
        let lat = parts[0].parse().ok()?;
        let lng = parts[1].parse().ok()?;
        return Some((lat, lng));
    }
    None
}

fn haversine_km(lat1: f64, lon1: f64, lat2: f64, lon2: f64) -> f64 {
    const R: f64 = 6371.0;
    let d_lat = (lat2 - lat1).to_radians();
    let d_lon = (lon2 - lon1).to_radians();
    let a = (d_lat / 2.0).sin().powi(2)
        + lat1.to_radians().cos() * lat2.to_radians().cos() * (d_lon / 2.0).sin().powi(2);
    let c = 2.0 * a.sqrt().atan2((1.0 - a).max(0.0).sqrt());
    R * c
}

/// Vérifie qu'une succursale est cohérente avec le matching courant (ville/rayon) du besoin.
fn succursale_matches_current_scope(
    target_gps: &Option<String>,
    target_address: &Option<String>,
    succursale_gps: &Option<String>,
    succursale_ville: &Option<String>,
    max_radius_km: f64,
) -> bool {
    if let (Some(tg), Some(sg)) = (target_gps.as_ref(), succursale_gps.as_ref()) {
        if let (Some((tlat, tlng)), Some((slat, slng))) =
            (parse_lat_lng_coords(tg), parse_lat_lng_coords(sg))
        {
            if haversine_km(tlat, tlng, slat, slng) <= max_radius_km {
                return true;
            }
        }
    }

    if let (Some(addr), Some(ville)) = (target_address.as_ref(), succursale_ville.as_ref()) {
        if ville_matches_hint(addr, ville) {
            return true;
        }
    }

    // Si aucune donnée exploitable (legacy), on ne bloque pas.
    target_gps.is_none() && target_address.is_none()
}

/// Un couple (gps, ville) issu du profil utilisateur, de `librairie_partners` ou de `librairie_lieux` (succursales).
fn partner_point_matches(
    ville_hint: Option<&str>,
    origin: Option<(f64, f64)>,
    radius_km: f64,
    gps: &Option<String>,
    ville: &Option<String>,
) -> bool {
    if let Some(hint) = ville_hint.filter(|h| !h.trim().is_empty()) {
        if let Some(v) = ville {
            if ville_matches_hint(v, hint) {
                return true;
            }
        }
    }
    if let Some((olat, olng)) = origin {
        if let Some(g) = gps {
            if let Some((lat, lng)) = parse_lat_lng_coords(g) {
                if haversine_km(olat, olng, lat, lng) <= radius_km {
                    return true;
                }
            }
        }
    }
    false
}

/// Librairies dans la même ville (établissement, annonce livre, fiche partenaire, **succursales**) ou dans le rayon GPS sur **un** des points ; sinon repli global.
async fn librairie_partner_ids_geo_filtered(
    pool: &sqlx::PgPool,
    ville_hint: Option<&str>,
    origin: Option<(f64, f64)>,
    radius_km: f64,
    fallback_limit: i64,
) -> Vec<i32> {
    let rows: Vec<PartnerGeoRow> = sqlx::query_as(
        r#"
        SELECT u.id, u.gps,
          (SELECT e.ville FROM etablissements_scolaires e WHERE e.user_id = u.id ORDER BY e.id DESC LIMIT 1) AS etab_ville,
          (SELECT ls.ville FROM livres_scolaires ls WHERE ls.user_id = u.id AND ls.ville IS NOT NULL AND TRIM(ls.ville) <> '' ORDER BY ls.id DESC LIMIT 1) AS book_ville
        FROM users u
        WHERE LOWER(COALESCE(u.partner_type, '')) IN ('librairie', 'libraire', 'livrescolaire', 'livre_scolaire')
        "#,
    )
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    if rows.is_empty() {
        return vec![];
    }

    let user_ids: Vec<i32> = rows.iter().map(|r| r.id).collect();

    let lp_points: Vec<(i32, Option<String>, Option<String>)> = sqlx::query_as(
        r#"SELECT user_id, gps, ville FROM librairie_partners WHERE user_id = ANY($1)"#,
    )
    .bind(&user_ids)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let lieu_points: Vec<(i32, Option<String>, Option<String>)> = sqlx::query_as(
        r#"
        SELECT lp.user_id, ll.gps, ll.ville
        FROM librairie_lieux ll
        INNER JOIN librairie_partners lp ON lp.id = ll.librairie_partner_id
        WHERE lp.user_id = ANY($1)
        "#,
    )
    .bind(&user_ids)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let mut extra: HashMap<i32, Vec<(Option<String>, Option<String>)>> = HashMap::new();
    for (uid, g, v) in lp_points.into_iter().chain(lieu_points.into_iter()) {
        extra.entry(uid).or_default().push((g, v));
    }

    let mut matched: Vec<i32> = Vec::new();
    for r in &rows {
        let mut pts: Vec<(Option<String>, Option<String>)> = vec![
            (r.gps.clone(), None),
            (None, r.etab_ville.clone()),
            (None, r.book_ville.clone()),
        ];
        if let Some(v) = extra.get(&r.id) {
            pts.extend(v.iter().cloned());
        }

        let hit = pts
            .iter()
            .any(|(g, v)| partner_point_matches(ville_hint, origin, radius_km, g, v));
        if hit {
            matched.push(r.id);
        }
    }

    if matched.is_empty() {
        rows.into_iter().map(|r| r.id).take(fallback_limit.max(0) as usize).collect()
    } else {
        matched.into_iter().take(120).collect()
    }
}

fn strip_data_url_base64(input: &str) -> (String, Option<String>) {
    if let Some(rest) = input.strip_prefix("data:") {
        if let Some((meta, b64)) = rest.split_once(',') {
            return (b64.to_string(), Some(meta.to_string()));
        }
    }
    (input.to_string(), None)
}

fn infer_file_type_from_client_and_mime(client: &str, meta: Option<&String>) -> &'static str {
    let c = client.to_lowercase();
    if c == "pdf" {
        return "pdf";
    }
    if c == "document" || c.contains("excel") || c.contains("sheet") {
        return "excel";
    }
    if c == "image" {
        return "image";
    }
    if let Some(m) = meta {
        let ml = m.to_lowercase();
        if ml.contains("pdf") {
            return "pdf";
        }
        if ml.contains("spreadsheet")
            || ml.contains("excel")
            || ml.contains("sheet")
            || ml.contains("ms-excel")
        {
            return "excel";
        }
    }
    "image"
}

/// POST /api/bourse-livre/v2/programmes-scolaires/submit
/// Établissement envoie PDF / Excel / images — extraction IA (AppIA) comme l'admin, rattachement optionnel `etablissement_id`.
pub async fn submit_programmes_scolaires_etablissement(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<SubmitProgrammesEtablissementRequest>,
) -> AppResult<impl IntoResponse> {
    if payload.fichiers.is_empty() {
        return Err(AppError::BadRequest("Aucun fichier fourni".to_string()));
    }
    if payload.niveaux.is_empty() {
        return Err(AppError::BadRequest(
            "Sélectionnez au moins un niveau".to_string(),
        ));
    }

    let niveau_label = payload.niveaux.join(", ");
    let periode = payload.annee_scolaire.clone();
    let pays = payload.pays.clone().unwrap_or_else(|| "Cameroun".to_string());
    let etab_id = payload.etablissement_id;

    let ai_service = BookExchangeAIService::new(state.ia.clone());
    let mut total_inserted = 0i32;
    let mut extractions = Vec::new();

    for f in &payload.fichiers {
        let (raw_b64, meta) = strip_data_url_base64(&f.base64);
        let file_kind = infer_file_type_from_client_and_mime(&f.file_type, meta.as_ref());

        let extraction = ai_service
            .extract_programme_from_file(&raw_b64, file_kind, &niveau_label, &periode, None)
            .await;

        let result = match extraction {
            Ok(r) => r,
            Err(e) => {
                warn!(
                    "[submit_programmes_etab] extraction fichier {}: {}",
                    f.nom, e
                );
                continue;
            }
        };

        extractions.push(json!({
            "fichier": f.nom,
            "nombre": result.nombre_total,
            "confidence": result.confidence,
        }));

        for livre in &result.livres {
            let matiere = matiere_avec_type_article(livre);
            let classe = livre.classe.clone().or_else(|| Some("Toutes".to_string())).unwrap();

            let prix = livre.prix_officiel.and_then(rust_decimal::Decimal::from_f64_retain);

            let ins = sqlx::query(
                r#"
                INSERT INTO programmes_scolaires (
                    pays, systeme_educatif, niveau, classe, matiere, titre_livre,
                    auteur_livre, editeur_livre, isbn_livre,
                    annee_scolaire, est_obligatoire, prix_officiel, is_active, created_by,
                    periode_academique, extraction_status, etablissement_id
                )
                VALUES (
                    $1, 'francophone', $2, $3, $4, $5,
                    $6, $7, $8,
                    $9, COALESCE($10, true), $11, true, $12,
                    $13, 'done', $14
                )
                ON CONFLICT DO NOTHING
                "#,
            )
            .bind(&pays)
            .bind(&niveau_label)
            .bind(&classe)
            .bind(&matiere)
            .bind(&livre.titre)
            .bind(&livre.auteur)
            .bind(&livre.editeur)
            .bind(&livre.isbn)
            .bind(&periode)
            .bind(livre.est_obligatoire)
            .bind(prix)
            .bind(user_id as i32)
            .bind(&periode)
            .bind(etab_id)
            .execute(&state.pg)
            .await;

            if let Ok(r) = ins {
                total_inserted += r.rows_affected() as i32;
            }
        }
    }

    if extractions.is_empty() {
        return Err(AppError::BadRequest(
            "Impossible d'analyser les fichiers (IA). Réessayez avec un PDF ou une image plus lisible."
                .to_string(),
        ));
    }

    // Notifications librairies (ville / rayon GPS) — si au moins une ligne insérée
    let notifications_librairies = if total_inserted > 0 {
        let nom_etab = payload.nom_etablissement.trim();
        let radius_km = payload.notification_radius_km.unwrap_or(75.0).clamp(5.0, 300.0);

        let mut ville_owned = payload.ville.clone();
        let mut origin = payload.gps_coords.as_deref().and_then(parse_lat_lng_coords);

        if let Some(eid) = etab_id {
            if let Ok(Some(row)) = sqlx::query_as::<_, (Option<String>, String)>(
                "SELECT gps, ville FROM etablissements_scolaires WHERE id = $1",
            )
            .bind(eid)
            .fetch_optional(&state.pg)
            .await
            {
                let (g, v) = row;
                if ville_owned.as_ref().map(|s| s.trim().is_empty()).unwrap_or(true) {
                    ville_owned = Some(v);
                }
                if origin.is_none() {
                    if let Some(ref gs) = g {
                        origin = parse_lat_lng_coords(gs);
                    }
                }
            }
        }

        let ville_hint = ville_owned.as_deref().filter(|s| !s.trim().is_empty());
        let lib_ids =
            librairie_partner_ids_geo_filtered(&state.pg, ville_hint, origin, radius_km, 120).await;

        let n = lib_ids.len();
        let filt_geo = ville_hint.is_some() || origin.is_some();

        for uid in lib_ids {
            let title = "Liste de manuels — Bourse du livre";
            let body = format!(
                "L'établissement « {} » a déposé une liste de manuels/fournitures ({}). Mettez à jour vos disponibilités (livres, cahiers…) dans Yukpo.",
                nom_etab, periode
            );
            let data = json!({
                "kind": "bourse_manuels_etablissement",
                "nom_etablissement": nom_etab,
                "annee_scolaire": periode,
                "ville": payload.ville,
                "i18n_key": "bourse_manuels_etablissement",
                "filtre_geographique": filt_geo,
                "rayon_km": radius_km,
                "succursales_librairies_incluses": true
            })
            .to_string();
            let _ = sqlx::query(
                r#"INSERT INTO notifications (user_id, type, title, body, data, created_at)
                   VALUES ($1, $2, $3, $4, $5, NOW())"#,
            )
            .bind(uid)
            .bind("bourse_manuels_etablissement")
            .bind(title)
            .bind(&body)
            .bind(&data)
            .execute(&state.pg)
            .await;
        }
        n
    } else {
        0
    };

    Ok(Json(json!({
        "success": true,
        "message": format!("{} ligne(s) enregistrée(s) dans le référentiel Yukpo (après extraction IA).", total_inserted),
        "lignes_inserees": total_inserted,
        "extractions": extractions,
        "notifications_librairies": notifications_librairies,
    })))
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
    if mode != "vente" && mode != "troc" && mode != "neuf" {
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

    // ✅ GPS obligatoire : l'acheteur DOIT préciser son lieu de livraison
    if payload.gps_livraison.as_deref().unwrap_or("").is_empty() {
        return Err(AppError::BadRequest(
            "Veuillez préciser votre lieu de livraison (GPS). Utilisez la carte pour sélectionner un emplacement précis.".to_string(),
        ));
    }

    // ✅ GPS obligatoire : le vendeur DOIT avoir un lieu de récupération (on doit aller chercher les livres)
    if livre.gps.as_deref().unwrap_or("").is_empty() {
        return Err(AppError::BadRequest(
            "Ce livre ne peut pas être acheté car le vendeur n'a pas précisé de lieu de récupération. Contactez le vendeur pour qu'il mette à jour la localisation de son livre.".to_string(),
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

    let paiement_methode_str = payload.paiement_methode.as_deref().unwrap_or("wallet");
    let mut payment_redirect_url: Option<String> = None;
    let mut payment_reference: Option<String> = None;

    let paiement_statut = match paiement_methode_str {
        "cash" => {
            info!(
                "[create_book_purchase] Paiement espèces pour achat #{}, collecte à la livraison",
                purchase.id
            );
            "en_attente_livraison"
        }
        "mobile_money" => {
            match debit_book_wallet(
                &state.pg,
                acheteur_id,
                montant_total,
                &format!("Achat livre #{} - {}", purchase.id, livre.titre),
            )
            .await
            {
                Ok(_) => {
                    info!(
                        "[create_book_purchase] Wallet débité {} XAF pour achat #{}",
                        montant_total as i64, purchase.id
                    );
                    "paye"
                }
                Err(_) => {
                    let ref_id =
                        format!("BK-PUR-{}-{}", purchase.id, chrono::Utc::now().timestamp());
                    payment_reference = Some(ref_id.clone());

                    let aggregator = crate::services::payment_aggregator::PaymentAggregator::new();
                    match aggregator
                        .initiate_payment(crate::services::payment_aggregator::InitPaymentRequest {
                            user_id: acheteur_id,
                            amount: montant_total as i64,
                            currency: "XAF".to_string(),
                            description: format!("Achat livre: {}", livre.titre),
                            customer_name: None,
                            customer_email: None,
                            channel:
                                crate::services::payment_aggregator::PayChannel::AllMobileMoney,
                            phone_number: None,
                            metadata: None,
                        })
                        .await
                    {
                        Ok(resp) => {
                            payment_redirect_url = resp.payment_url;
                            info!(
                                "[create_book_purchase] Paiement Mobile Money initié pour achat #{}",
                                purchase.id
                            );
                            "en_attente_paiement"
                        }
                        Err(e) => {
                            warn!("[create_book_purchase] Erreur initiation paiement: {}", e);
                            "en_attente_paiement"
                        }
                    }
                }
            }
        }
        _ => {
            match debit_book_wallet(
                &state.pg,
                acheteur_id,
                montant_total,
                &format!("Achat livre #{} - {}", purchase.id, livre.titre),
            )
            .await
            {
                Ok(_) => {
                    info!(
                        "[create_book_purchase] Wallet débité {} XAF pour achat #{}",
                        montant_total as i64, purchase.id
                    );
                    "paye"
                }
                Err(e) => {
                    error!("[create_book_purchase] Débit wallet échoué: {}", e);
                    "en_attente"
                }
            }
        }
    };

    sqlx::query(
        "UPDATE book_purchases SET paiement_statut = $1, paiement_reference = $2 WHERE id = $3",
    )
    .bind(paiement_statut)
    .bind(&payment_reference)
    .bind(purchase.id)
    .execute(&state.pg)
    .await
    .map_err(|e| {
        error!("[create_book_purchase] Erreur MAJ statut paiement: {}", e);
        AppError::Internal(format!("Erreur MAJ statut paiement: {}", e))
    })?;

    // Marquer le livre indisponible si paiement wallet réussi (éviter double vente)
    if paiement_statut == "paye" {
        if let Err(e) =
            sqlx::query("UPDATE livres_scolaires SET is_available = false WHERE id = $1")
                .bind(payload.livre_id)
                .execute(&state.pg)
                .await
        {
            error!(
                "[create_book_purchase] Erreur marquage livre indisponible: {}",
                e
            );
        }
    }

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

    // Invalider le cache après achat (livre potentiellement indisponible)
    invalidate_bourse_livre_cache(&state).await;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "success": true,
            "purchase": purchase,
            "paiement_statut": paiement_statut,
            "payment_redirect_url": payment_redirect_url,
            "payment_reference": payment_reference,
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

    // Si annulé, rembourser l'acheteur et remettre le livre disponible
    if payload.statut == "annule" {
        // Remettre le livre disponible
        if let Err(e) = sqlx::query("UPDATE livres_scolaires SET is_available = true WHERE id = $1")
            .bind(purchase.livre_id)
            .execute(&state.pg)
            .await
        {
            error!("[update_purchase_status] Erreur réactivation livre: {}", e);
        }

        // Rembourser l'acheteur si le paiement avait été effectué par wallet
        let paiement_statut_str = purchase.paiement_statut.as_deref().unwrap_or("");
        if paiement_statut_str == "paye" {
            let montant_total = purchase
                .montant_total
                .and_then(|m| m.to_string().parse::<f64>().ok())
                .unwrap_or(0.0);
            if montant_total > 0.0 {
                match credit_book_wallet(
                    &state.pg,
                    purchase.acheteur_id,
                    montant_total,
                    &format!("Remboursement achat annulé #{}", purchase_id),
                )
                .await
                {
                    Ok(_) => {
                        info!(
                            "[update_purchase_status] ✅ Acheteur {} remboursé {} XAF pour achat annulé #{}",
                            purchase.acheteur_id, montant_total as i64, purchase_id
                        );
                        // Mettre à jour le statut de paiement
                        let _ = sqlx::query(
                            "UPDATE book_purchases SET paiement_statut = 'rembourse' WHERE id = $1",
                        )
                        .bind(purchase_id)
                        .execute(&state.pg)
                        .await;
                    }
                    Err(e) => error!(
                        "[update_purchase_status] Erreur remboursement acheteur {}: {}",
                        purchase.acheteur_id, e
                    ),
                }
            }
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

    // Récupérer le vendeur_id (peut être NULL dans book_purchases)
    let vendeur_id = purchase.vendeur_id.unwrap_or(user_id);

    let package = sqlx::query_as::<_, BookDeliveryPackage>(
        r#"
        INSERT INTO book_delivery_packages (
            reference, expediteur_id, destinataire_id,
            livres, expediteur_gps, destinataire_gps,
            destinataire_adresse, statut, nombre_livres,
            expediteur_instructions
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'a_constituer', 1, $8)
        RETURNING *
        "#,
    )
    .bind(&reference)
    .bind(vendeur_id) // L'expéditeur est le vendeur
    .bind(purchase.acheteur_id) // Le destinataire est l'acheteur
    .bind(json!([{"livre_id": purchase.livre_id, "titre": "Livre acheté", "valeur": 0, "mode": "vente"}]))
    .bind(&payload.gps_depot)
    .bind(&purchase.gps_livraison)
    .bind(&payload.adresse_depot)
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
        "bourse_livre:browse:{}:{}:{}:{}:{}:{}:{}:{}",
        params.classe.as_deref().unwrap_or("all"),
        params.matiere.as_deref().unwrap_or("all"),
        params.niveau.as_deref().unwrap_or("all"),
        params.mode_listing.as_deref().unwrap_or("all"),
        params.ville.as_deref().unwrap_or("all"),
        params.search.as_deref().unwrap_or("all"),
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

    // Formater les résultats avec images (presigned URLs si nécessaire)
    let mut livres: Vec<serde_json::Value> = Vec::with_capacity(rows.len());
    for row in &rows {
        use sqlx::Row;
        let image_recto_raw: Option<String> = row.try_get::<String, _>("image_recto").ok();
        let image_verso_raw: Option<String> = row.try_get::<String, _>("image_verso").ok();

        // Générer des presigned URLs pour les images GCS (chemins relatifs)
        let image_recto_url = match &image_recto_raw {
            Some(path) if !path.is_empty() && !path.starts_with("http") => {
                state.media_storage.generate_presigned_url(path, 86400).await.ok()
            }
            other => other.clone(),
        };
        let image_verso_url = match &image_verso_raw {
            Some(path) if !path.is_empty() && !path.starts_with("http") => {
                state.media_storage.generate_presigned_url(path, 86400).await.ok()
            }
            other => other.clone(),
        };

        livres.push(json!({
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
            "image_recto": image_recto_url,
            "image_verso": image_verso_url,
            "mode_listing": row.try_get::<String, _>("mode_listing").ok(),
            "valeur_calculee": row.try_get::<rust_decimal::Decimal, _>("valeur_calculee").ok(),
            "prix_detecte": row.try_get::<rust_decimal::Decimal, _>("prix_detecte").ok(),
            "devise": row.try_get::<String, _>("devise_detectee").ok().unwrap_or_else(|| "XAF".to_string()),
            "est_au_programme": row.try_get::<bool, _>("est_au_programme").ok(),
            "programme_scolaire_id": row.try_get::<i32, _>("programme_scolaire_id").ok(),
            "ville": row.try_get::<String, _>("ville").ok(),
            "user_id": row.get::<i32, _>("user_id"),
        }));
    }

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
    let cache_key = "bourse_livre:classes_programmes_v2";
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

    use std::collections::BTreeMap;
    let mut merged: BTreeMap<String, serde_json::Value> = BTreeMap::new();

    for row in &rows {
        use sqlx::Row;
        let classe: String = row.get("classe");
        let niveau = crate::services::book_exchange_ai_service::compute_niveau_from_classe(&classe);
        merged.insert(
            classe.clone(),
            json!({
                "classe": classe,
                "niveau": niveau,
                "total_livres": row.get::<i64, _>("total_livres"),
                "au_programme": row.get::<i64, _>("au_programme"),
                "en_vente": row.get::<i64, _>("en_vente"),
                "en_troc": row.get::<i64, _>("en_troc"),
                "en_don": row.get::<i64, _>("en_don"),
                "entrees_programme": 0_i64,
            }),
        );
    }

    // Classes présentes dans le référentiel programmes officiels (même sans annonces sur la bourse)
    let prog_rows = sqlx::query(
        r#"SELECT classe,
                  MIN(niveau) AS niveau,
                  COUNT(*)::bigint AS entrees_programme
           FROM programmes_scolaires
           WHERE is_active = true
             AND classe IS NOT NULL
             AND TRIM(classe) != ''
           GROUP BY classe
           ORDER BY classe"#,
    )
    .fetch_all(&state.pg)
    .await
    .unwrap_or_default();

    for row in &prog_rows {
        use sqlx::Row;
        let classe: String = row.get("classe");
        let niveau_db: Option<String> = row.try_get("niveau").ok();
        let entrees: i64 = row.get::<i64, _>("entrees_programme");
        let niveau: String = match niveau_db {
            Some(ref s) if !s.trim().is_empty() => s.clone(),
            _ => crate::services::book_exchange_ai_service::compute_niveau_from_classe(&classe)
                .to_string(),
        };

        if let Some(existing) = merged.get_mut(&classe) {
            if let Some(obj) = existing.as_object_mut() {
                obj.insert("entrees_programme".to_string(), json!(entrees));
            }
        } else {
            merged.insert(
                classe.clone(),
                json!({
                    "classe": classe,
                    "niveau": niveau,
                    "total_livres": 0_i64,
                    "au_programme": 0_i64,
                    "en_vente": 0_i64,
                    "en_troc": 0_i64,
                    "en_don": 0_i64,
                    "entrees_programme": entrees,
                }),
            );
        }
    }

    let classes: Vec<serde_json::Value> = merged.into_values().collect();

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
    // Essayer avec PostGIS d'abord, fallback sans geography si PostGIS n'est pas installé
    let pickup_addr = package.expediteur_adresse.as_deref().unwrap_or("Expéditeur livres");
    let dropoff_addr = package.destinataire_adresse.as_deref().unwrap_or("Destinataire livres");

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
    .bind(pickup_addr)
    .bind(exp_lng)
    .bind(exp_lat)
    .bind(dropoff_addr)
    .bind(dest_lng)
    .bind(dest_lat)
    .bind(distance_m as i32)
    .bind(&metadata)
    .fetch_one(&state.pg)
    .await;

    // Fallback sans PostGIS si l'extension n'est pas installée
    let delivery_insert = match delivery_insert {
        ok @ Ok(_) => ok,
        Err(e) => {
            warn!(
                "[dispatch_book_package] PostGIS INSERT échoué ({}), tentative sans geography...",
                e
            );
            sqlx::query_scalar::<_, Uuid>(
                r#"
                INSERT INTO deliveries (
                    id, creator_id, status,
                    pickup_address, dropoff_address,
                    distance_meters, metadata, created_at, updated_at
                )
                VALUES ($1, $2, 'pending'::delivery_status, $3, $4, $5, $6, NOW(), NOW())
                RETURNING id
                "#,
            )
            .bind(delivery_uuid)
            .bind(user_id)
            .bind(pickup_addr)
            .bind(dropoff_addr)
            .bind(distance_m as i32)
            .bind(&metadata)
            .fetch_one(&state.pg)
            .await
        }
    };

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
    Extension(user): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    ensure_admin_role(&user)?;
    let user_id = user.id;
    info!(
        "[build_all_pending_packages] Constitution batch déclenchée par user {}",
        user_id
    );

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

    // Vérifier que l'utilisateur est bien le coursier assigné à ce paquet
    let assigned_courier: Option<i32> =
        sqlx::query_scalar("SELECT coursier_id FROM book_delivery_packages WHERE id = $1")
            .bind(body.package_id)
            .fetch_optional(&state.pg)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur vérification coursier: {}", e)))?
            .flatten();

    match assigned_courier {
        Some(cid) if cid != coursier_id => {
            return Err(AppError::Forbidden(
                "Vous n'êtes pas le coursier assigné à ce paquet".to_string(),
            ));
        }
        None => {
            return Err(AppError::Forbidden(
                "Aucun coursier n'est assigné à ce paquet".to_string(),
            ));
        }
        _ => {}
    }

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
/// Récupère les détails d'une chaîne avec paquets enrichis, QR codes, et livres par paquet.
/// Le coursier peut accéder aux QR codes directement depuis la vue chaîne.
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

    // Enrichir les paquets avec QR codes + livres détaillés
    let mut paquets_enrichis: Vec<serde_json::Value> = Vec::new();
    if let Some(ref pkg_ids_val) = chaine.package_ids {
        let pkg_ids: Vec<i32> = serde_json::from_value(pkg_ids_val.clone()).unwrap_or_default();

        for pkg_id in &pkg_ids {
            let pkg = sqlx::query_as::<_, BookDeliveryPackage>(
                "SELECT * FROM book_delivery_packages WHERE id = $1",
            )
            .bind(pkg_id)
            .fetch_optional(&state.pg)
            .await
            .ok()
            .flatten();

            if let Some(pkg) = pkg {
                // Récupérer le QR code existant pour ce paquet (pickup)
                let qr_pickup: Option<(String, String)> = sqlx::query_as(
                    "SELECT qr_code, qr_code_url FROM book_package_qr_codes WHERE package_id = $1 AND qr_type = 'pickup' AND status = 'pending' AND expires_at > NOW() LIMIT 1",
                )
                .bind(pkg_id)
                .fetch_optional(&state.pg)
                .await
                .ok()
                .flatten();

                let qr_delivery: Option<(String, String)> = sqlx::query_as(
                    "SELECT qr_code, qr_code_url FROM book_package_qr_codes WHERE package_id = $1 AND qr_type = 'delivery' AND status = 'pending' AND expires_at > NOW() LIMIT 1",
                )
                .bind(pkg_id)
                .fetch_optional(&state.pg)
                .await
                .ok()
                .flatten();

                // Info expéditeur et destinataire
                let exp_name: Option<String> =
                    sqlx::query_scalar("SELECT full_name FROM users WHERE id = $1")
                        .bind(pkg.expediteur_id)
                        .fetch_optional(&state.pg)
                        .await
                        .ok()
                        .flatten();

                let dest_name: Option<String> =
                    sqlx::query_scalar("SELECT full_name FROM users WHERE id = $1")
                        .bind(pkg.destinataire_id)
                        .fetch_optional(&state.pg)
                        .await
                        .ok()
                        .flatten();

                paquets_enrichis.push(json!({
                    "package_id": pkg.id,
                    "reference": pkg.reference,
                    "statut": pkg.statut,
                    "nombre_livres": pkg.nombre_livres,
                    "livres": pkg.livres,
                    "expediteur": {
                        "id": pkg.expediteur_id,
                        "nom": exp_name,
                        "gps": pkg.expediteur_gps,
                        "adresse": pkg.expediteur_adresse,
                    },
                    "destinataire": {
                        "id": pkg.destinataire_id,
                        "nom": dest_name,
                        "gps": pkg.destinataire_gps,
                        "adresse": pkg.destinataire_adresse,
                    },
                    "qr_pickup": qr_pickup.as_ref().map(|(code, url)| json!({"qr_code": code, "qr_code_url": url})),
                    "qr_delivery": qr_delivery.as_ref().map(|(code, url)| json!({"qr_code": code, "qr_code_url": url})),
                    "valeur_totale": pkg.valeur_totale,
                    "frais_livraison": pkg.frais_livraison,
                    "coursier_id": pkg.coursier_id,
                }));
            }
        }
    }

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
            "nombre_vendeurs": chaine.nombre_vendeurs,
            "score_proximite": chaine.score_proximite,
            "distance_totale_km": chaine.distance_totale_km,
            "date_validation": chaine.date_validation,
            "created_at": chaine.created_at,
        },
        "paquets": paquets_enrichis,
        "total_paquets": paquets_enrichis.len(),
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

// ============================================================================
// SUGGESTIONS INTELLIGENTES — Autocomplete multi-critères
// ============================================================================

/// GET /api/bourse-livre/v2/suggestions?classe=6ème
/// Retourne les matières disponibles, le nombre de livres, et les livres populaires pour une classe
#[derive(Debug, Deserialize)]
pub struct SuggestionsQuery {
    pub classe: Option<String>,
    pub matiere: Option<String>,
    pub query: Option<String>, // texte libre (titre/auteur)
}

pub async fn get_smart_suggestions(
    State(state): State<Arc<AppState>>,
    Query(params): Query<SuggestionsQuery>,
) -> AppResult<impl IntoResponse> {
    use sqlx::Row;

    let mut result = json!({ "success": true });

    // 1. Matières disponibles avec comptage pour la classe sélectionnée
    if let Some(ref classe) = params.classe {
        let matieres_rows = sqlx::query(
            r#"
            SELECT matiere, COUNT(*) as count,
                   COUNT(*) FILTER (WHERE mode_listing = 'troc') as troc_count,
                   COUNT(*) FILTER (WHERE mode_listing = 'vente') as vente_count,
                   COUNT(*) FILTER (WHERE mode_listing = 'don') as don_count
            FROM livres_scolaires
            WHERE classe_actuelle = $1 AND is_available = true AND is_active = true
                  AND matiere IS NOT NULL AND matiere != ''
            GROUP BY matiere
            ORDER BY count DESC
            "#,
        )
        .bind(classe)
        .fetch_all(&state.pg)
        .await
        .unwrap_or_default();

        let matieres: Vec<serde_json::Value> = matieres_rows
            .iter()
            .map(|r| {
                json!({
                    "matiere": r.get::<String, _>("matiere"),
                    "count": r.get::<i64, _>("count"),
                    "troc": r.get::<i64, _>("troc_count"),
                    "vente": r.get::<i64, _>("vente_count"),
                    "don": r.get::<i64, _>("don_count"),
                })
            })
            .collect();

        result["matieres_disponibles"] = json!(matieres);

        // Total livres pour cette classe
        let total: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM livres_scolaires WHERE classe_actuelle = $1 AND is_available = true AND is_active = true",
        )
        .bind(classe)
        .fetch_one(&state.pg)
        .await
        .unwrap_or(0);
        result["total_livres_classe"] = json!(total);
    }

    // 2. Livres populaires (top 10) pour classe + matière
    if params.classe.is_some() || params.matiere.is_some() {
        let mut where_parts = vec![
            "is_available = true".to_string(),
            "is_active = true".to_string(),
        ];
        let mut bind_idx = 1u32;
        let mut binds_vec: Vec<String> = Vec::new();

        if let Some(ref classe) = params.classe {
            where_parts.push(format!("classe_actuelle = ${}", bind_idx));
            binds_vec.push(classe.clone());
            bind_idx += 1;
        }
        if let Some(ref matiere) = params.matiere {
            where_parts.push(format!("matiere = ${}", bind_idx));
            binds_vec.push(matiere.clone());
            bind_idx += 1;
        }
        if let Some(ref q) = params.query {
            where_parts.push(format!("(titre ILIKE ${0} OR auteur ILIKE ${0})", bind_idx));
            binds_vec.push(format!("%{}%", q));
            #[allow(unused_assignments)]
            {
                bind_idx += 1;
            }
        }

        let top_sql = format!(
            "SELECT id, titre, auteur, matiere, classe_actuelle, etat_livre, mode_listing, valeur_calculee, est_au_programme \
             FROM livres_scolaires WHERE {} ORDER BY est_au_programme DESC NULLS LAST, valeur_calculee ASC NULLS LAST LIMIT 10",
            where_parts.join(" AND ")
        );

        let mut top_query = sqlx::query(&top_sql);
        for b in &binds_vec {
            top_query = top_query.bind(b);
        }

        let top_rows = top_query.fetch_all(&state.pg).await.unwrap_or_default();

        let top_livres: Vec<serde_json::Value> = top_rows.iter().map(|r| {
            json!({
                "id": r.get::<i32, _>("id"),
                "titre": r.get::<String, _>("titre"),
                "auteur": r.try_get::<String, _>("auteur").ok(),
                "matiere": r.get::<String, _>("matiere"),
                "classe_actuelle": r.get::<String, _>("classe_actuelle"),
                "etat_livre": r.get::<String, _>("etat_livre"),
                "mode_listing": r.try_get::<String, _>("mode_listing").ok(),
                "valeur_calculee": r.try_get::<rust_decimal::Decimal, _>("valeur_calculee").ok(),
                "est_au_programme": r.try_get::<bool, _>("est_au_programme").ok(),
            })
        }).collect();

        result["top_livres"] = json!(top_livres);
    }

    // 3. Classes disponibles globalement
    let classes: Vec<String> = sqlx::query_scalar(
        "SELECT DISTINCT classe_actuelle FROM livres_scolaires WHERE is_available = true AND is_active = true AND classe_actuelle != '' ORDER BY classe_actuelle",
    )
    .fetch_all(&state.pg)
    .await
    .unwrap_or_default();

    result["classes_disponibles"] = json!(classes);

    Ok(Json(result))
}

// ============================================================================
// LIVRES NEUFS — Catalogue partenaires libraires
// ============================================================================

/// Payload pour publier des livres neufs (libraire uniquement)
#[derive(Debug, Deserialize)]
pub struct PublishNewBooksPayload {
    pub livres: Vec<NewBookEntry>,
    pub gps: Option<String>,
    pub ville: Option<String>,
    pub quartier: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct NewBookEntry {
    pub programme_scolaire_id: Option<i32>,
    pub titre: String,
    pub auteur: Option<String>,
    pub editeur: Option<String>,
    pub isbn: Option<String>,
    pub classe: String,
    pub matiere: String,
    pub niveau: Option<String>,
    pub prix: f64,
    pub devise: Option<String>,
    pub stock: Option<i32>,
    pub image_url: Option<String>,
}

/// POST /api/bourse-livre/v2/libraire/publish
/// Permet à un partenaire libraire de publier des livres neufs en lot
pub async fn libraire_publish_new_books(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<PublishNewBooksPayload>,
) -> AppResult<impl IntoResponse> {
    // Vérifier que l'utilisateur est un partenaire libraire
    let partner: Option<(Option<String>,)> =
        sqlx::query_as("SELECT partner_type::text FROM delivery_partners WHERE user_id = $1")
            .bind(user.id)
            .fetch_optional(&state.pg)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?;

    let is_libraire = match &partner {
        Some((Some(pt),)) => pt == "libraire",
        _ => false,
    };

    // Admins can also publish
    let is_admin = crate::utils::role_helpers::is_admin_role(&user.role);

    if !is_libraire && !is_admin {
        return Err(AppError::Forbidden(
            "Seuls les partenaires libraires ou administrateurs peuvent publier des livres neufs"
                .into(),
        ));
    }

    if payload.livres.is_empty() {
        return Err(AppError::BadRequest("Aucun livre à publier".into()));
    }

    info!(
        "[libraire_publish] User: {}, {} livres à publier",
        user.id,
        payload.livres.len()
    );

    let mut published = Vec::new();
    let mut errors = Vec::new();

    for entry in &payload.livres {
        if entry.prix <= 0.0 {
            errors.push(json!({ "titre": entry.titre, "error": "Prix invalide" }));
            continue;
        }

        let result = sqlx::query_scalar::<_, i32>(
            r#"
            INSERT INTO livres_scolaires (
                user_id, titre, auteur, editeur, isbn,
                classe_actuelle, classe_souhaitee, matiere, niveau,
                etat_livre, etat_classification, mode_listing,
                prix_detecte, devise_detectee, valeur_calculee, ratio_etat,
                est_au_programme, programme_scolaire_id,
                image_recto, gps, ville, quartier,
                is_available, is_active,
                ia_analysis_status, situation_troc
            )
            VALUES (
                $1, $2, $3, $4, $5,
                $6, $6, $7, $8,
                'Neuf', 'bon', 'neuf',
                $9, $10, $9, 1.0,
                $11, $12,
                $13, $14, $15, $16,
                true, true,
                'done', 'offre'
            )
            RETURNING id
            "#,
        )
        .bind(user.id)
        .bind(&entry.titre)
        .bind(&entry.auteur)
        .bind(&entry.editeur)
        .bind(&entry.isbn)
        .bind(&entry.classe)
        .bind(&entry.matiere)
        .bind(&entry.niveau)
        .bind(entry.prix)
        .bind(entry.devise.as_deref().unwrap_or("XAF"))
        .bind(entry.programme_scolaire_id.is_some())
        .bind(entry.programme_scolaire_id)
        .bind(&entry.image_url)
        .bind(&payload.gps)
        .bind(&payload.ville)
        .bind(&payload.quartier)
        .fetch_one(&state.pg)
        .await;

        match result {
            Ok(id) => published.push(json!({ "id": id, "titre": entry.titre })),
            Err(e) => {
                error!("[libraire_publish] Erreur INSERT '{}': {}", entry.titre, e);
                errors.push(json!({ "titre": entry.titre, "error": e.to_string() }));
            }
        }
    }

    info!(
        "[libraire_publish] ✅ {} publiés, {} erreurs",
        published.len(),
        errors.len()
    );

    Ok(Json(json!({
        "success": true,
        "published": published,
        "errors": errors,
        "total_published": published.len(),
        "total_errors": errors.len()
    })))
}

/// GET /api/bourse-livre/v2/new-books
/// Catalogue des livres neufs — accessible publiquement
#[derive(Debug, Deserialize)]
pub struct NewBooksQuery {
    pub classe: Option<String>,
    pub matiere: Option<String>,
    pub niveau: Option<String>,
    pub ville: Option<String>,
    pub search: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

pub async fn browse_new_books(
    State(state): State<Arc<AppState>>,
    Query(params): Query<NewBooksQuery>,
) -> AppResult<impl IntoResponse> {
    let limit = params.limit.unwrap_or(50).min(100);
    let offset = params.offset.unwrap_or(0);

    let cache_key = format!(
        "bourse_livre:new:{}:{}:{}:{}:{}:{}",
        params.classe.as_deref().unwrap_or("all"),
        params.matiere.as_deref().unwrap_or("all"),
        params.niveau.as_deref().unwrap_or("all"),
        params.ville.as_deref().unwrap_or("all"),
        limit,
        offset
    );

    if let Ok(Some(cached)) = state.cache_service.get::<serde_json::Value>(&cache_key).await {
        return Ok(Json(cached));
    }

    let mut conditions = vec![
        "is_available = true".to_string(),
        "is_active = true".to_string(),
        "mode_listing = 'neuf'".to_string(),
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
        r#"SELECT ls.id, ls.titre, ls.auteur, ls.editeur, ls.isbn,
           ls.classe_actuelle, ls.matiere, ls.niveau,
           ls.prix_detecte as prix_neuf, ls.devise_detectee,
           ls.image_recto, ls.ville, ls.gps,
           ls.est_au_programme, ls.programme_scolaire_id,
           ls.created_at, ls.user_id,
           u.full_name as libraire_nom
           FROM livres_scolaires ls
           LEFT JOIN users u ON u.id = ls.user_id
           WHERE {}
           ORDER BY ls.est_au_programme DESC NULLS LAST, ls.created_at DESC
           LIMIT {} OFFSET {}"#,
        where_clause, limit, offset
    );

    let mut query = sqlx::query(&sql);
    for b in &binds {
        query = query.bind(b);
    }

    let rows = query
        .fetch_all(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?;

    let livres: Vec<serde_json::Value> = rows
        .iter()
        .map(|r| {
            use sqlx::Row;
            json!({
                "id": r.try_get::<i32, _>("id").ok(),
                "titre": r.try_get::<String, _>("titre").ok(),
                "auteur": r.try_get::<String, _>("auteur").ok(),
                "editeur": r.try_get::<String, _>("editeur").ok(),
                "isbn": r.try_get::<String, _>("isbn").ok(),
                "classe": r.try_get::<String, _>("classe_actuelle").ok(),
                "matiere": r.try_get::<String, _>("matiere").ok(),
                "niveau": r.try_get::<String, _>("niveau").ok(),
                "prix_neuf": r.try_get::<rust_decimal::Decimal, _>("prix_neuf").ok(),
                "devise": r.try_get::<String, _>("devise_detectee").ok(),
                "image": r.try_get::<String, _>("image_recto").ok(),
                "ville": r.try_get::<String, _>("ville").ok(),
                "est_au_programme": r.try_get::<bool, _>("est_au_programme").ok(),
                "libraire_nom": r.try_get::<String, _>("libraire_nom").ok(),
                "mode": "neuf",
            })
        })
        .collect();

    // Compter le total
    let count_sql = format!(
        "SELECT COUNT(*) FROM livres_scolaires WHERE {}",
        where_clause
    );
    let mut count_q = sqlx::query_scalar::<_, i64>(&count_sql);
    for b in &binds {
        count_q = count_q.bind(b);
    }
    let total = count_q.fetch_one(&state.pg).await.unwrap_or(0);

    let result = json!({
        "success": true,
        "livres": livres,
        "total": total,
        "limit": limit,
        "offset": offset
    });

    // Cache 5 min
    let _ = state.cache_service.set(&cache_key, &result).await;

    Ok(Json(result))
}

/// GET /api/bourse-livre/v2/compare-prices
/// Compare prix neufs vs occasion pour une classe/matière donnée
#[derive(Debug, Deserialize)]
pub struct ComparePricesQuery {
    pub classe: String,
    pub matiere: Option<String>,
}

pub async fn compare_prices(
    State(state): State<Arc<AppState>>,
    Query(params): Query<ComparePricesQuery>,
) -> AppResult<impl IntoResponse> {
    // Prix neufs (mode_listing = 'neuf')
    let neufs_sql = if params.matiere.is_some() {
        r#"SELECT titre, matiere, prix_detecte as prix, 'neuf' as source,
           editeur, auteur, est_au_programme, ville
           FROM livres_scolaires
           WHERE classe_actuelle = $1 AND matiere = $2
           AND mode_listing = 'neuf' AND is_available = true AND is_active = true
           ORDER BY est_au_programme DESC NULLS LAST, prix_detecte ASC
           LIMIT 20"#
    } else {
        r#"SELECT titre, matiere, prix_detecte as prix, 'neuf' as source,
           editeur, auteur, est_au_programme, ville
           FROM livres_scolaires
           WHERE classe_actuelle = $1
           AND mode_listing = 'neuf' AND is_available = true AND is_active = true
           ORDER BY est_au_programme DESC NULLS LAST, prix_detecte ASC
           LIMIT 20"#
    };

    let mut q_neufs = sqlx::query(neufs_sql).bind(&params.classe);
    if let Some(ref mat) = params.matiere {
        q_neufs = q_neufs.bind(mat);
    }
    let neufs_rows = q_neufs.fetch_all(&state.pg).await.unwrap_or_default();

    // Prix occasion (mode_listing IN ('vente', 'troc'))
    let occasion_sql = if params.matiere.is_some() {
        r#"SELECT titre, matiere, valeur_calculee as prix, mode_listing as source,
           etat_classification, etat_livre, auteur, ville
           FROM livres_scolaires
           WHERE classe_actuelle = $1 AND matiere = $2
           AND mode_listing IN ('vente', 'troc') AND is_available = true AND is_active = true
           ORDER BY valeur_calculee ASC
           LIMIT 20"#
    } else {
        r#"SELECT titre, matiere, valeur_calculee as prix, mode_listing as source,
           etat_classification, etat_livre, auteur, ville
           FROM livres_scolaires
           WHERE classe_actuelle = $1
           AND mode_listing IN ('vente', 'troc') AND is_available = true AND is_active = true
           ORDER BY valeur_calculee ASC
           LIMIT 20"#
    };

    let mut q_occ = sqlx::query(occasion_sql).bind(&params.classe);
    if let Some(ref mat) = params.matiere {
        q_occ = q_occ.bind(mat);
    }
    let occasion_rows = q_occ.fetch_all(&state.pg).await.unwrap_or_default();

    // Prix programme officiel
    let prog_sql = if params.matiere.is_some() {
        r#"SELECT titre_livre as titre, matiere, prix_officiel as prix, 'programme' as source,
           editeur_livre as editeur, auteur_livre as auteur, est_obligatoire
           FROM programmes_scolaires
           WHERE classe = $1 AND matiere = $2 AND is_active = true
           ORDER BY est_obligatoire DESC, titre_livre ASC"#
    } else {
        r#"SELECT titre_livre as titre, matiere, prix_officiel as prix, 'programme' as source,
           editeur_livre as editeur, auteur_livre as auteur, est_obligatoire
           FROM programmes_scolaires
           WHERE classe = $1 AND is_active = true
           ORDER BY est_obligatoire DESC, titre_livre ASC"#
    };

    let mut q_prog = sqlx::query(prog_sql).bind(&params.classe);
    if let Some(ref mat) = params.matiere {
        q_prog = q_prog.bind(mat);
    }
    let prog_rows = q_prog.fetch_all(&state.pg).await.unwrap_or_default();

    use sqlx::Row;

    let neufs: Vec<serde_json::Value> = neufs_rows
        .iter()
        .map(|r| {
            json!({
                "titre": r.try_get::<String, _>("titre").ok(),
                "matiere": r.try_get::<String, _>("matiere").ok(),
                "prix": r.try_get::<rust_decimal::Decimal, _>("prix").ok(),
                "source": "neuf",
                "editeur": r.try_get::<String, _>("editeur").ok(),
                "auteur": r.try_get::<String, _>("auteur").ok(),
                "est_au_programme": r.try_get::<bool, _>("est_au_programme").ok(),
                "ville": r.try_get::<String, _>("ville").ok(),
            })
        })
        .collect();

    let occasions: Vec<serde_json::Value> = occasion_rows
        .iter()
        .map(|r| {
            json!({
                "titre": r.try_get::<String, _>("titre").ok(),
                "matiere": r.try_get::<String, _>("matiere").ok(),
                "prix": r.try_get::<rust_decimal::Decimal, _>("prix").ok(),
                "source": r.try_get::<String, _>("source").ok(),
                "etat": r.try_get::<String, _>("etat_livre").ok(),
                "etat_classification": r.try_get::<String, _>("etat_classification").ok(),
                "auteur": r.try_get::<String, _>("auteur").ok(),
                "ville": r.try_get::<String, _>("ville").ok(),
            })
        })
        .collect();

    let programme: Vec<serde_json::Value> = prog_rows
        .iter()
        .map(|r| {
            json!({
                "titre": r.try_get::<String, _>("titre").ok(),
                "matiere": r.try_get::<String, _>("matiere").ok(),
                "prix_officiel": r.try_get::<rust_decimal::Decimal, _>("prix").ok(),
                "source": "programme",
                "editeur": r.try_get::<String, _>("editeur").ok(),
                "auteur": r.try_get::<String, _>("auteur").ok(),
                "est_obligatoire": r.try_get::<bool, _>("est_obligatoire").ok(),
            })
        })
        .collect();

    Ok(Json(json!({
        "success": true,
        "classe": params.classe,
        "matiere": params.matiere,
        "neufs": neufs,
        "occasions": occasions,
        "programme_officiel": programme,
        "resume": {
            "total_neufs": neufs.len(),
            "total_occasions": occasions.len(),
            "total_programme": programme.len(),
        }
    })))
}

// ============================================================================
// QR CODES POUR LIVRAISON DE LIVRES
// ============================================================================

/// POST /api/bourse-livre/v2/packages/:id/qr-generate
pub async fn generate_package_qr(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(package_id): Path<i32>,
    Json(payload): Json<GenerateQRRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[generate_package_qr] User: {}, Package: {}, Type: {}",
        user_id, package_id, payload.qr_type
    );

    if payload.qr_type != "pickup" && payload.qr_type != "delivery" {
        return Err(AppError::BadRequest(
            "qr_type must be 'pickup' or 'delivery'".to_string(),
        ));
    }

    let qr_service = crate::services::qr_code_service::QRCodeService::new(state.pg.clone());
    let qr_info = qr_service.generate_book_package_qr(package_id, &payload.qr_type).await?;

    Ok(Json(json!({ "success": true, "qr": qr_info })))
}

#[derive(Debug, Deserialize)]
pub struct GenerateQRRequest {
    pub qr_type: String,
}

/// POST /api/bourse-livre/v2/packages/qr-validate
pub async fn validate_package_qr(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<ValidateQRRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[validate_package_qr] User: {}, QR: {}",
        user_id, payload.qr_code
    );

    let qr_service = crate::services::qr_code_service::QRCodeService::new(state.pg.clone());
    let result = qr_service.validate_book_package_qr(&payload.qr_code, user_id).await?;

    Ok(Json(json!({ "success": true, "validation": result })))
}

#[derive(Debug, Deserialize)]
pub struct ValidateQRRequest {
    pub qr_code: String,
}

// ============================================================================
// WEBHOOK PAIEMENT ACHAT LIVRE (CinetPay / NotchPay callback)
// ============================================================================

/// POST /api/webhooks/book-purchase/:id
/// Callback de paiement pour les achats directs de livres
/// Route PUBLIQUE (pas de JWT — appelée par le prestataire de paiement)
#[derive(Debug, Deserialize)]
pub struct BookPurchaseWebhookPayload {
    pub status: Option<String>, // "ACCEPTED", "REFUSED", etc.
    pub transaction_id: Option<String>,
    pub amount: Option<i64>,
    pub currency: Option<String>,
    pub payment_method: Option<String>,
    // CinetPay-specific
    pub cpm_trans_status: Option<String>,
    pub cpm_trans_id: Option<String>,
    // NotchPay-specific
    pub reference: Option<String>,
}

pub async fn book_purchase_webhook(
    State(state): State<Arc<AppState>>,
    Path(purchase_id): Path<i32>,
    Json(payload): Json<BookPurchaseWebhookPayload>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[book_purchase_webhook] Purchase: {}, Status: {:?}, TransID: {:?}",
        purchase_id, payload.status, payload.transaction_id
    );

    // Déterminer si le paiement est accepté
    let is_accepted = payload
        .status
        .as_deref()
        .map(|s| s == "ACCEPTED" || s == "completed" || s == "successful")
        .unwrap_or(false)
        || payload
            .cpm_trans_status
            .as_deref()
            .map(|s| s == "ACCEPTED" || s == "00")
            .unwrap_or(false);

    let ref_id = payload
        .transaction_id
        .or(payload.cpm_trans_id)
        .or(payload.reference)
        .unwrap_or_default();

    if is_accepted {
        // Mettre à jour le statut du paiement
        let updated = sqlx::query_as::<_, crate::models::livre_scolaire::BookPurchase>(
            r#"
            UPDATE book_purchases
            SET paiement_statut = 'paye',
                paiement_reference = COALESCE($1, paiement_reference),
                statut = 'confirme',
                updated_at = NOW()
            WHERE id = $2 AND paiement_statut IN ('en_attente_paiement', 'en_attente')
            RETURNING *
            "#,
        )
        .bind(&ref_id)
        .bind(purchase_id)
        .fetch_optional(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur webhook MAJ: {}", e)))?;

        if let Some(purchase) = updated {
            info!(
                "[book_purchase_webhook] ✅ Paiement confirmé pour achat #{}, montant: {:?} XAF",
                purchase_id, purchase.montant_total
            );

            // Marquer le livre comme indisponible
            let _ = sqlx::query("UPDATE livres_scolaires SET is_available = false WHERE id = $1")
                .bind(purchase.livre_id)
                .execute(&state.pg)
                .await;

            // Notifier le vendeur
            if let Some(vendeur_id) = purchase.vendeur_id {
                let _ = sqlx::query(
                    r#"INSERT INTO notifications (user_id, type, title, body, data, created_at)
                    VALUES ($1, 'book_sold', 'Livre vendu !', 'Votre livre a été acheté. Préparez-le pour la livraison.', $2, NOW())"#,
                )
                .bind(vendeur_id)
                .bind(json!({"purchase_id": purchase_id, "livre_id": purchase.livre_id, "i18n_key": "book_sold"}).to_string())
                .execute(&state.pg)
                .await;
            }

            // Notifier l'acheteur
            let _ = sqlx::query(
                r#"INSERT INTO notifications (user_id, type, title, body, data, created_at)
                VALUES ($1, 'book_payment_confirmed', 'Paiement confirmé', 'Votre paiement a été confirmé. Le livre sera bientôt expédié.', $2, NOW())"#,
            )
            .bind(purchase.acheteur_id)
            .bind(json!({"purchase_id": purchase_id, "livre_id": purchase.livre_id, "i18n_key": "book_payment_confirmed"}).to_string())
            .execute(&state.pg)
            .await;
        }
    } else {
        // Paiement échoué
        let _ = sqlx::query(
            "UPDATE book_purchases SET paiement_statut = 'echoue', paiement_reference = $1 WHERE id = $2",
        )
        .bind(&ref_id)
        .bind(purchase_id)
        .execute(&state.pg)
        .await;

        warn!(
            "[book_purchase_webhook] ❌ Paiement échoué pour achat #{}: {:?}",
            purchase_id, payload.status
        );
    }

    Ok(Json(json!({ "success": true })))
}

// ============================================================================
// CHANGEMENT DE LIEU (récupération / livraison) PAR LES INTERVENANTS
// ============================================================================
//
// Chaque intervenant peut modifier SON lieu dans la chaîne:
//   - Vendeur/expéditeur → modifier le lieu de récupération
//   - Acheteur/destinataire → modifier le lieu de livraison
//   - Participant troc (offre) → modifier le lieu de récupération de ses livres
//   - Participant troc (demande) → modifier le lieu de livraison
// Le changement est autorisé UNIQUEMENT si le paquet n'est pas encore en_route.
// Après changement: recalcul frais livraison + notification à l'autre partie + coursier.

#[derive(Debug, Deserialize)]
pub struct UpdateLocationRequest {
    pub package_id: Option<i32>,
    pub purchase_id: Option<i32>,
    pub livre_id: Option<i32>,
    pub gps: String, // "lat,lng"
    pub adresse: Option<String>,
}

/// PATCH /api/bourse-livre/v2/update-location
/// Permet à un vendeur, acheteur ou participant troc de changer son lieu de récupération/livraison.
pub async fn update_delivery_location(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<UpdateLocationRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[update_delivery_location] User: {}, GPS: {}, pkg: {:?}, purchase: {:?}, livre: {:?}",
        user_id, payload.gps, payload.package_id, payload.purchase_id, payload.livre_id
    );

    if payload.gps.is_empty() || !payload.gps.contains(',') {
        return Err(AppError::BadRequest(
            "GPS invalide. Format attendu: lat,lng".to_string(),
        ));
    }

    let mut updated_count = 0;
    let mut notifications: Vec<(i32, String, String, serde_json::Value)> = Vec::new();

    // ── 1. Mise à jour sur un PAQUET de livraison ──
    if let Some(pkg_id) = payload.package_id {
        let pkg = sqlx::query_as::<_, BookDeliveryPackage>(
            "SELECT * FROM book_delivery_packages WHERE id = $1",
        )
        .bind(pkg_id)
        .fetch_optional(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?
        .ok_or_else(|| AppError::NotFound("Paquet non trouvé".to_string()))?;

        // Bloquer si déjà en_route ou livré
        if pkg.statut == "en_route" || pkg.statut == "livre" || pkg.statut == "confirme" {
            return Err(AppError::BadRequest(
                "Impossible de modifier le lieu : le paquet est déjà en cours de livraison."
                    .to_string(),
            ));
        }

        if pkg.expediteur_id == user_id {
            // Vendeur/expéditeur → modifier lieu de RÉCUPÉRATION
            sqlx::query(
                "UPDATE book_delivery_packages SET expediteur_gps = $1, expediteur_adresse = $2, updated_at = NOW() WHERE id = $3",
            )
            .bind(&payload.gps)
            .bind(&payload.adresse)
            .bind(pkg_id)
            .execute(&state.pg)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur MAJ lieu expéditeur: {}", e)))?;
            updated_count += 1;

            // Notifier le destinataire + coursier
            notifications.push((
                pkg.destinataire_id,
                "Lieu de récupération modifié".to_string(),
                format!("L'expéditeur a changé le lieu de récupération du paquet {}.", pkg.reference),
                json!({"type": "location_changed", "package_id": pkg_id, "role": "expediteur", "new_gps": payload.gps, "new_adresse": payload.adresse, "i18n_key": "location_changed_pickup"}),
            ));
            if let Some(cid) = pkg.coursier_id {
                notifications.push((
                    cid,
                    "Adresse de récupération modifiée".to_string(),
                    format!("Paquet {} : le lieu de récupération a changé. Vérifiez votre itinéraire.", pkg.reference),
                    json!({"type": "location_changed", "package_id": pkg_id, "role": "expediteur", "new_gps": payload.gps, "i18n_key": "courier_location_changed"}),
                ));
            }
        } else if pkg.destinataire_id == user_id {
            // Acheteur/destinataire → modifier lieu de LIVRAISON
            sqlx::query(
                "UPDATE book_delivery_packages SET destinataire_gps = $1, destinataire_adresse = $2, updated_at = NOW() WHERE id = $3",
            )
            .bind(&payload.gps)
            .bind(&payload.adresse)
            .bind(pkg_id)
            .execute(&state.pg)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur MAJ lieu destinataire: {}", e)))?;
            updated_count += 1;

            // Notifier l'expéditeur + coursier
            notifications.push((
                pkg.expediteur_id,
                "Lieu de livraison modifié".to_string(),
                format!("Le destinataire a changé le lieu de livraison du paquet {}.", pkg.reference),
                json!({"type": "location_changed", "package_id": pkg_id, "role": "destinataire", "new_gps": payload.gps, "new_adresse": payload.adresse, "i18n_key": "location_changed_delivery"}),
            ));
            if let Some(cid) = pkg.coursier_id {
                notifications.push((
                    cid,
                    "Adresse de livraison modifiée".to_string(),
                    format!("Paquet {} : le lieu de livraison a changé. Vérifiez votre itinéraire.", pkg.reference),
                    json!({"type": "location_changed", "package_id": pkg_id, "role": "destinataire", "new_gps": payload.gps, "i18n_key": "courier_location_changed"}),
                ));
            }
        } else {
            return Err(AppError::Forbidden(
                "Vous n'êtes ni l'expéditeur ni le destinataire de ce paquet.".to_string(),
            ));
        }

        // Recalculer les frais de livraison si les deux GPS sont disponibles
        let pkg_updated = sqlx::query_as::<_, BookDeliveryPackage>(
            "SELECT * FROM book_delivery_packages WHERE id = $1",
        )
        .bind(pkg_id)
        .fetch_optional(&state.pg)
        .await
        .ok()
        .flatten();

        if let Some(pkg_u) = pkg_updated {
            let parse_gps = |gps: &str| -> Option<(f64, f64)> {
                let parts: Vec<&str> = gps.split(',').collect();
                if parts.len() == 2 {
                    Some((parts[0].trim().parse().ok()?, parts[1].trim().parse().ok()?))
                } else {
                    None
                }
            };
            if let (Some(exp_pos), Some(dest_pos)) = (
                pkg_u.expediteur_gps.as_deref().and_then(parse_gps),
                pkg_u.destinataire_gps.as_deref().and_then(parse_gps),
            ) {
                let distance_m =
                    crate::services::delivery_service::haversine_distance(exp_pos, dest_pos);
                let new_frais = (distance_m / 1000.0 * 500.0).max(1000.0);
                let eta_min = ((distance_m / 1000.0) / 25.0 * 60.0).max(15.0) as i32;

                sqlx::query(
                    "UPDATE book_delivery_packages SET frais_livraison = $1, eta_minutes = $2, distance_totale_metres = $3, updated_at = NOW() WHERE id = $4",
                )
                .bind(rust_decimal::Decimal::from_f64_retain(new_frais))
                .bind(eta_min)
                .bind(distance_m as i32)
                .bind(pkg_id)
                .execute(&state.pg)
                .await
                .ok();

                info!(
                    "[update_delivery_location] Paquet {} : frais recalculés = {} XAF, distance = {} m",
                    pkg_id, new_frais as i64, distance_m as i32
                );
            }
        }
    }

    // ── 2. Mise à jour sur un ACHAT DIRECT ──
    if let Some(purchase_id) = payload.purchase_id {
        let purchase = sqlx::query_as::<_, crate::models::livre_scolaire::BookPurchase>(
            "SELECT * FROM book_purchases WHERE id = $1",
        )
        .bind(purchase_id)
        .fetch_optional(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?
        .ok_or_else(|| AppError::NotFound("Achat non trouvé".to_string()))?;

        if purchase.statut == "en_livraison" || purchase.statut == "livre" {
            return Err(AppError::BadRequest(
                "Impossible de modifier le lieu : l'achat est déjà en cours de livraison."
                    .to_string(),
            ));
        }

        if purchase.acheteur_id == user_id {
            // Acheteur → modifier lieu de livraison
            sqlx::query(
                "UPDATE book_purchases SET gps_livraison = $1, adresse_livraison = $2, updated_at = NOW() WHERE id = $3",
            )
            .bind(&payload.gps)
            .bind(&payload.adresse)
            .bind(purchase_id)
            .execute(&state.pg)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur MAJ lieu achat: {}", e)))?;
            updated_count += 1;

            if let Some(vid) = purchase.vendeur_id {
                notifications.push((
                    vid,
                    "Lieu de livraison modifié".to_string(),
                    format!("L'acheteur a changé son lieu de livraison pour l'achat #{}.", purchase_id),
                    json!({"type": "location_changed", "purchase_id": purchase_id, "role": "acheteur", "new_gps": payload.gps, "i18n_key": "location_changed_delivery"}),
                ));
            }
        } else if purchase.vendeur_id == Some(user_id) {
            // Vendeur → modifier lieu de récupération du livre
            // On met à jour le GPS du livre source
            sqlx::query(
                "UPDATE livres_scolaires SET gps = $1, ville = $2 WHERE id = $3 AND user_id = $4",
            )
            .bind(&payload.gps)
            .bind(&payload.adresse)
            .bind(purchase.livre_id)
            .bind(user_id)
            .execute(&state.pg)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur MAJ GPS livre: {}", e)))?;
            updated_count += 1;

            notifications.push((
                purchase.acheteur_id,
                "Lieu de récupération modifié".to_string(),
                format!("Le vendeur a changé le lieu de récupération pour l'achat #{}.", purchase_id),
                json!({"type": "location_changed", "purchase_id": purchase_id, "role": "vendeur", "new_gps": payload.gps, "i18n_key": "location_changed_pickup"}),
            ));
        } else {
            return Err(AppError::Forbidden(
                "Vous n'êtes ni l'acheteur ni le vendeur de cet achat.".to_string(),
            ));
        }
    }

    // ── 3. Mise à jour sur un LIVRE (participant troc) ──
    if let Some(livre_id) = payload.livre_id {
        let updated = sqlx::query_scalar::<_, i32>(
            "UPDATE livres_scolaires SET gps = $1, ville = $2, updated_at = NOW() WHERE id = $3 AND user_id = $4 RETURNING id",
        )
        .bind(&payload.gps)
        .bind(&payload.adresse)
        .bind(livre_id)
        .bind(user_id)
        .fetch_optional(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur MAJ GPS livre: {}", e)))?;

        if updated.is_none() {
            return Err(AppError::Forbidden(
                "Livre non trouvé ou vous n'en êtes pas le propriétaire.".to_string(),
            ));
        }
        updated_count += 1;

        // Mettre à jour le GPS sur TOUS les paquets non-expédiés où ce livre est impliqué
        let _ = sqlx::query(
            r#"UPDATE book_delivery_packages
            SET expediteur_gps = $1, expediteur_adresse = $2, updated_at = NOW()
            WHERE expediteur_id = $3 AND statut IN ('a_constituer', 'constitue')
            AND livres::text LIKE '%"livre_id":' || $4 || '%'"#,
        )
        .bind(&payload.gps)
        .bind(&payload.adresse)
        .bind(user_id)
        .bind(livre_id.to_string())
        .execute(&state.pg)
        .await;

        // Notifier les destinataires de paquets impactés
        let impacted_dests: Vec<(i32, String)> = sqlx::query_as(
            r#"SELECT DISTINCT destinataire_id, reference FROM book_delivery_packages
            WHERE expediteur_id = $1 AND statut IN ('a_constituer', 'constitue')"#,
        )
        .bind(user_id)
        .fetch_all(&state.pg)
        .await
        .unwrap_or_default();

        for (dest_id, pkg_ref) in &impacted_dests {
            notifications.push((
                *dest_id,
                "Lieu de récupération modifié".to_string(),
                format!("Le propriétaire du livre a changé son lieu pour le paquet {}.", pkg_ref),
                json!({"type": "location_changed", "livre_id": livre_id, "role": "proprietaire", "new_gps": payload.gps, "i18n_key": "location_changed_pickup"}),
            ));
        }

        invalidate_bourse_livre_cache(&state).await;
    }

    // ── Envoyer toutes les notifications ──
    for (target_user_id, title, body, data) in &notifications {
        let _ = sqlx::query(
            r#"INSERT INTO notifications (user_id, type, title, body, data, created_at)
            VALUES ($1, 'location_changed', $2, $3, $4, NOW())"#,
        )
        .bind(target_user_id)
        .bind(title)
        .bind(body)
        .bind(data.to_string())
        .execute(&state.pg)
        .await;
    }

    if updated_count == 0 {
        return Err(AppError::BadRequest(
            "Aucune mise à jour effectuée. Fournir package_id, purchase_id, ou livre_id."
                .to_string(),
        ));
    }

    info!(
        "[update_delivery_location] ✅ {} mise(s) à jour, {} notification(s) envoyée(s)",
        updated_count,
        notifications.len()
    );

    Ok(Json(json!({
        "success": true,
        "updated_count": updated_count,
        "notifications_sent": notifications.len(),
        "new_gps": payload.gps,
        "new_adresse": payload.adresse,
        "message": "Lieu mis à jour avec succès. Les parties concernées ont été notifiées."
    })))
}

// ============================================================================
// HELPER: INVALIDATION CACHE BOURSE DU LIVRE
// ============================================================================

/// Invalider les caches Redis liés à la bourse du livre
/// À appeler après toute modification de livres (création, update, suppression, achat, troc)
pub async fn invalidate_bourse_livre_cache(state: &AppState) {
    let _ = state.cache_service.delete_pattern("bourse_livre:browse:*").await;
    let _ = state.cache_service.delete("bourse_livre:classes_programmes").await;
    let _ = state.cache_service.delete("bourse_livre:classes_programmes_v2").await;
}

// ============================================================================
// ÉQUIPE LIBRAIRE — Gestion des membres d'équipe d'une librairie
// ============================================================================
//
// Rôles:
//   - owner     : propriétaire de la librairie (créé automatiquement)
//   - manager   : gestionnaire complet (CRUD équipe, voir stats, valider QR, préparer paquets)
//   - preparer  : préparateur (voir commandes, préparer paquets, scanner QR coursier)
//   - cashier   : caissier (scanner QR coursier, confirmer remise paquets uniquement)
//
// Fonctionnalités:
//   1. Inviter un membre par téléphone
//   2. Lister les membres de l'équipe
//   3. Modifier le rôle d'un membre
//   4. Retirer un membre
//   5. Scanner QR coursier (par un membre de l'équipe)
//   6. Voir les paquets à constituer (commandes en attente de préparation)
//   7. Notifications à toute l'équipe quand une nouvelle commande arrive

#[derive(Debug, Deserialize)]
pub struct InviteTeamMemberRequest {
    pub telephone: String,
    pub role: String, // "manager", "preparer", "cashier"
    pub nom: Option<String>,
}

/// POST /api/bourse-livre/v2/libraire/team/invite
/// Inviter un membre dans l'équipe de la librairie
pub async fn invite_team_member(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: owner_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<InviteTeamMemberRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[invite_team_member] Owner: {}, Tel: {}, Role: {}",
        owner_id, payload.telephone, payload.role
    );

    let valid_roles = ["manager", "preparer", "cashier"];
    if !valid_roles.contains(&payload.role.as_str()) {
        return Err(AppError::BadRequest(format!(
            "Rôle invalide: {}. Rôles acceptés: manager, preparer, cashier",
            payload.role
        )));
    }

    // Vérifier que l'appelant est owner ou manager de la librairie
    let is_authorized: bool = sqlx::query_scalar(
        r#"SELECT EXISTS(
            SELECT 1 FROM libraire_team_members
            WHERE user_id = $1 AND role IN ('owner', 'manager') AND is_active = true
        )"#,
    )
    .bind(owner_id)
    .fetch_one(&state.pg)
    .await
    .unwrap_or(false);

    if !is_authorized {
        return Err(AppError::Forbidden(
            "Vous devez être propriétaire ou gestionnaire de la librairie".to_string(),
        ));
    }

    // Trouver le librairie_id de l'appelant
    let librairie_id: i32 = sqlx::query_scalar(
        "SELECT librairie_id FROM libraire_team_members WHERE user_id = $1 AND is_active = true LIMIT 1",
    )
    .bind(owner_id)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur récupération librairie: {}", e)))?;

    // Chercher l'utilisateur par téléphone
    let invited_user: Option<(i32, Option<String>)> =
        sqlx::query_as("SELECT id, full_name FROM users WHERE telephone = $1 LIMIT 1")
            .bind(&payload.telephone)
            .fetch_optional(&state.pg)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur recherche utilisateur: {}", e)))?;

    let (invited_user_id, invited_name) = match invited_user {
        Some((id, name)) => (id, name.unwrap_or_default()),
        None => {
            return Err(AppError::NotFound(format!(
                "Aucun utilisateur trouvé avec le numéro {}. L'utilisateur doit d'abord créer un compte Yukpo.",
                payload.telephone
            )));
        }
    };

    // Vérifier si déjà membre
    let already_member: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM libraire_team_members WHERE librairie_id = $1 AND user_id = $2 AND is_active = true)",
    )
    .bind(librairie_id)
    .bind(invited_user_id)
    .fetch_one(&state.pg)
    .await
    .unwrap_or(false);

    if already_member {
        return Err(AppError::BadRequest(
            "Cet utilisateur est déjà membre de votre équipe".to_string(),
        ));
    }

    // Insérer le membre (ou réactiver si désactivé)
    let member_id: i32 = sqlx::query_scalar(
        r#"
        INSERT INTO libraire_team_members (librairie_id, user_id, role, nom_affiche, telephone, invited_by, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, true)
        ON CONFLICT (librairie_id, user_id) DO UPDATE
            SET role = $3, is_active = true, nom_affiche = COALESCE($4, libraire_team_members.nom_affiche), updated_at = NOW()
        RETURNING id
        "#,
    )
    .bind(librairie_id)
    .bind(invited_user_id)
    .bind(&payload.role)
    .bind(payload.nom.as_deref().unwrap_or(&invited_name))
    .bind(&payload.telephone)
    .bind(owner_id)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur ajout membre: {}", e)))?;

    // Notifier le nouveau membre
    let role_label = match payload.role.as_str() {
        "manager" => "gestionnaire",
        "preparer" => "préparateur de commandes",
        "cashier" => "caissier",
        _ => "membre",
    };
    let _ = sqlx::query(
        r#"INSERT INTO notifications (user_id, type, title, body, data, created_at)
        VALUES ($1, 'team_invite', 'Invitation équipe librairie', $2, $3, NOW())"#,
    )
    .bind(invited_user_id)
    .bind(format!(
        "Vous avez été ajouté comme {} dans une librairie Yukpo.",
        role_label
    ))
    .bind(
        json!({"librairie_id": librairie_id, "role": payload.role, "i18n_key": "team_invite"})
            .to_string(),
    )
    .execute(&state.pg)
    .await;

    info!(
        "[invite_team_member] ✅ Membre {} ajouté (id={}, role={}) à librairie {}",
        invited_user_id, member_id, payload.role, librairie_id
    );

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "success": true,
            "member": {
                "id": member_id,
                "user_id": invited_user_id,
                "nom": payload.nom.as_deref().unwrap_or(&invited_name),
                "telephone": payload.telephone,
                "role": payload.role,
                "librairie_id": librairie_id
            }
        })),
    ))
}

/// GET /api/bourse-livre/v2/libraire/team
/// Lister les membres de l'équipe
pub async fn list_team_members(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    // Récupérer le librairie_id du membre
    let librairie_id: Option<i32> = sqlx::query_scalar(
        "SELECT librairie_id FROM libraire_team_members WHERE user_id = $1 AND is_active = true LIMIT 1",
    )
    .bind(user_id)
    .fetch_optional(&state.pg)
    .await
    .ok()
    .flatten();

    let librairie_id = librairie_id
        .ok_or_else(|| AppError::Forbidden("Vous n'êtes membre d'aucune librairie".to_string()))?;

    let members = sqlx::query(
        r#"
        SELECT ltm.id, ltm.user_id, ltm.role, ltm.nom_affiche, ltm.telephone,
               ltm.is_active, ltm.created_at,
               u.full_name, u.photo_url
        FROM libraire_team_members ltm
        LEFT JOIN users u ON u.id = ltm.user_id
        WHERE ltm.librairie_id = $1 AND ltm.is_active = true
        ORDER BY
            CASE ltm.role WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 WHEN 'preparer' THEN 2 ELSE 3 END,
            ltm.created_at ASC
        "#,
    )
    .bind(librairie_id)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur liste membres: {}", e)))?;

    let members_json: Vec<serde_json::Value> = members
        .iter()
        .map(|row| {
            use sqlx::Row;
            json!({
                "id": row.get::<i32, _>("id"),
                "user_id": row.get::<i32, _>("user_id"),
                "role": row.get::<String, _>("role"),
                "nom": row.try_get::<String, _>("nom_affiche").ok().or_else(|| row.try_get::<String, _>("full_name").ok()),
                "telephone": row.try_get::<String, _>("telephone").ok(),
                "photo_url": row.try_get::<String, _>("photo_url").ok(),
                "created_at": row.get::<chrono::DateTime<chrono::Utc>, _>("created_at"),
            })
        })
        .collect();

    Ok(Json(json!({
        "success": true,
        "librairie_id": librairie_id,
        "members": members_json,
        "total": members_json.len()
    })))
}

/// PATCH /api/bourse-livre/v2/libraire/team/:member_id/role
/// Modifier le rôle d'un membre
#[derive(Debug, Deserialize)]
pub struct UpdateTeamRoleRequest {
    pub role: String,
}

pub async fn update_team_member_role(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: owner_id, .. }): Extension<AuthenticatedUser>,
    Path(member_id): Path<i32>,
    Json(payload): Json<UpdateTeamRoleRequest>,
) -> AppResult<impl IntoResponse> {
    let valid_roles = ["manager", "preparer", "cashier"];
    if !valid_roles.contains(&payload.role.as_str()) {
        return Err(AppError::BadRequest(format!(
            "Rôle invalide: {}",
            payload.role
        )));
    }

    // Vérifier que l'appelant est owner ou manager
    let caller_role: Option<String> = sqlx::query_scalar(
        "SELECT role FROM libraire_team_members WHERE user_id = $1 AND is_active = true LIMIT 1",
    )
    .bind(owner_id)
    .fetch_optional(&state.pg)
    .await
    .ok()
    .flatten();

    match caller_role.as_deref() {
        Some("owner") | Some("manager") => {}
        _ => {
            return Err(AppError::Forbidden(
                "Seul le propriétaire ou gestionnaire peut modifier les rôles".to_string(),
            ))
        }
    }

    // Empêcher de modifier le rôle du owner
    let target_role: Option<String> =
        sqlx::query_scalar("SELECT role FROM libraire_team_members WHERE id = $1")
            .bind(member_id)
            .fetch_optional(&state.pg)
            .await
            .ok()
            .flatten();

    if target_role.as_deref() == Some("owner") {
        return Err(AppError::BadRequest(
            "Impossible de modifier le rôle du propriétaire".to_string(),
        ));
    }

    sqlx::query("UPDATE libraire_team_members SET role = $1, updated_at = NOW() WHERE id = $2")
        .bind(&payload.role)
        .bind(member_id)
        .execute(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur MAJ rôle: {}", e)))?;

    Ok(Json(
        json!({"success": true, "message": format!("Rôle mis à jour: {}", payload.role)}),
    ))
}

/// DELETE /api/bourse-livre/v2/libraire/team/:member_id
/// Retirer un membre de l'équipe (soft delete)
pub async fn remove_team_member(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: owner_id, .. }): Extension<AuthenticatedUser>,
    Path(member_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    // Vérifier autorisation
    let caller_role: Option<String> = sqlx::query_scalar(
        "SELECT role FROM libraire_team_members WHERE user_id = $1 AND is_active = true LIMIT 1",
    )
    .bind(owner_id)
    .fetch_optional(&state.pg)
    .await
    .ok()
    .flatten();

    match caller_role.as_deref() {
        Some("owner") | Some("manager") => {}
        _ => return Err(AppError::Forbidden("Non autorisé".to_string())),
    }

    // Empêcher de retirer le owner
    let target_role: Option<String> =
        sqlx::query_scalar("SELECT role FROM libraire_team_members WHERE id = $1")
            .bind(member_id)
            .fetch_optional(&state.pg)
            .await
            .ok()
            .flatten();

    if target_role.as_deref() == Some("owner") {
        return Err(AppError::BadRequest(
            "Impossible de retirer le propriétaire".to_string(),
        ));
    }

    sqlx::query(
        "UPDATE libraire_team_members SET is_active = false, updated_at = NOW() WHERE id = $1",
    )
    .bind(member_id)
    .execute(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur retrait membre: {}", e)))?;

    Ok(Json(
        json!({"success": true, "message": "Membre retiré de l'équipe"}),
    ))
}

/// POST /api/bourse-livre/v2/libraire/team/scan-qr
/// Un membre de l'équipe scanne le QR code du coursier pour valider la remise des paquets
#[derive(Debug, Deserialize)]
pub struct TeamScanQRRequest {
    pub qr_code: String,
    pub package_ids: Option<Vec<i32>>,
}

pub async fn team_scan_courier_qr(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<TeamScanQRRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[team_scan_courier_qr] Team member {} scans QR: {}",
        user_id,
        &payload.qr_code[..payload.qr_code.len().min(20)]
    );

    // Vérifier que l'utilisateur est membre d'une librairie (tout rôle peut scanner)
    let member_info: Option<(i32, String)> = sqlx::query_as(
        "SELECT librairie_id, role FROM libraire_team_members WHERE user_id = $1 AND is_active = true LIMIT 1",
    )
    .bind(user_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur vérification membre: {}", e)))?;

    let (librairie_id, member_role) = member_info
        .ok_or_else(|| AppError::Forbidden("Vous n'êtes membre d'aucune librairie".to_string()))?;

    // Déléguer au service QR existant
    let qr_service = crate::services::qr_code_service::QRCodeService::new(state.pg.clone());
    let validation_result = qr_service.validate_book_package_qr(&payload.qr_code, user_id).await?;

    // Si des package_ids sont spécifiés, mettre à jour leur statut → 'en_route'
    if let Some(ref pkg_ids) = payload.package_ids {
        for pkg_id in pkg_ids {
            let _ = sqlx::query(
                r#"UPDATE book_delivery_packages
                SET statut = 'en_route', updated_at = NOW()
                WHERE id = $1 AND statut = 'constitue'"#,
            )
            .bind(pkg_id)
            .execute(&state.pg)
            .await;
        }
        info!(
            "[team_scan_courier_qr] {} paquets marqués 'en_route' par membre {} (role: {})",
            pkg_ids.len(),
            user_id,
            member_role
        );
    }

    // Logger l'action
    let _ = sqlx::query(
        r#"INSERT INTO notifications (user_id, type, title, body, data, created_at)
        VALUES ($1, 'team_qr_scan', 'QR scanné', 'Un membre de votre équipe a scanné un QR coursier', $2, NOW())"#,
    )
    .bind(user_id)
    .bind(json!({"librairie_id": librairie_id, "role": member_role, "qr_result": "validated", "i18n_key": "team_qr_scan"}).to_string())
    .execute(&state.pg)
    .await;

    Ok(Json(json!({
        "success": true,
        "validation": validation_result,
        "scanned_by": {
            "user_id": user_id,
            "role": member_role,
            "librairie_id": librairie_id
        },
        "packages_updated": payload.package_ids.as_ref().map(|ids| ids.len()).unwrap_or(0)
    })))
}

/// GET /api/bourse-livre/v2/libraire/team/pending-packages
/// Voir les paquets en attente de constitution pour cette librairie
/// Accessible à tout membre de l'équipe (preparer, manager, owner)
pub async fn get_pending_packages_for_team(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    // Vérifier membre
    let member_info: Option<(i32, String)> = sqlx::query_as(
        "SELECT librairie_id, role FROM libraire_team_members WHERE user_id = $1 AND is_active = true LIMIT 1",
    )
    .bind(user_id)
    .fetch_optional(&state.pg)
    .await
    .ok()
    .flatten();

    let (librairie_id, _role) = member_info
        .ok_or_else(|| AppError::Forbidden("Vous n'êtes membre d'aucune librairie".to_string()))?;

    // Trouver le user_id du propriétaire de la librairie
    let owner_user_id: Option<i32> = sqlx::query_scalar(
        "SELECT user_id FROM libraire_team_members WHERE librairie_id = $1 AND role = 'owner' AND is_active = true LIMIT 1",
    )
    .bind(librairie_id)
    .fetch_optional(&state.pg)
    .await
    .ok()
    .flatten();

    let owner_id = owner_user_id.unwrap_or(user_id);

    // Paquets à constituer (expéditeur = le propriétaire de la librairie OU les livres neufs vendus)
    let pending = sqlx::query_as::<_, BookDeliveryPackage>(
        r#"
        SELECT * FROM book_delivery_packages
        WHERE expediteur_id = $1
            AND statut = 'a_constituer'
            AND (claimed_by_user_id IS NULL OR claimed_by_user_id = $2)
        ORDER BY
            CASE WHEN statut = 'a_constituer' THEN 0 ELSE 1 END,
            created_at ASC
        LIMIT 50
        "#,
    )
    .bind(owner_id)
    .bind(user_id)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur paquets en attente: {}", e)))?;

    // Achats directs en attente de préparation
    let purchases_pending = sqlx::query_as::<_, crate::models::livre_scolaire::BookPurchase>(
        r#"
        SELECT * FROM book_purchases
        WHERE vendeur_id = $1
            AND statut IN ('confirme', 'en_attente', 'en_preparation')
            AND paiement_statut = 'paye'
            AND (claimed_by_user_id IS NULL OR claimed_by_user_id = $2)
        ORDER BY created_at ASC
        LIMIT 50
        "#,
    )
    .bind(owner_id)
    .bind(user_id)
    .fetch_all(&state.pg)
    .await
    .unwrap_or_default();

    // Succursales disponibles pour le picker côté équipe librairie.
    let lieux = sqlx::query_as::<_, (i32, String, Option<String>, Option<String>, Option<String>)>(
        r#"
        SELECT ll.id, ll.libelle, ll.gps, ll.ville, ll.adresse
        FROM librairie_lieux ll
        INNER JOIN librairie_partners lp ON lp.id = ll.librairie_partner_id
        WHERE lp.user_id = $1
        ORDER BY ll.id ASC
        "#,
    )
    .bind(owner_id)
    .fetch_all(&state.pg)
    .await
    .unwrap_or_default();

    // Stats rapides
    let a_constituer = pending.iter().filter(|p| p.statut == "a_constituer").count();
    let constitues = pending.iter().filter(|p| p.statut == "constitue").count();

    Ok(Json(json!({
        "success": true,
        "librairie_id": librairie_id,
        "packages": {
            "a_constituer": pending.iter().filter(|p| p.statut == "a_constituer").collect::<Vec<_>>(),
            "constitues": pending.iter().filter(|p| p.statut == "constitue").collect::<Vec<_>>(),
        },
        "purchases_pending": purchases_pending,
        "lieux": lieux
            .iter()
            .map(|(id, libelle, gps, ville, adresse)| {
                json!({
                    "id": id,
                    "libelle": libelle,
                    "gps": gps,
                    "ville": ville,
                    "adresse": adresse
                })
            })
            .collect::<Vec<_>>(),
        "stats": {
            "a_constituer": a_constituer,
            "prets_pour_coursier": constitues,
            "achats_a_preparer": purchases_pending.len()
        }
    })))
}

/// Helper interne: Notifier toute l'équipe d'une librairie
/// Appelé quand un nouveau paquet/achat arrive pour la librairie
pub async fn notify_libraire_team(
    pool: &sqlx::PgPool,
    librairie_id: i32,
    title: &str,
    body: &str,
    data: serde_json::Value,
) {
    // Récupérer tous les membres actifs (sauf cashier pour les notifications de commande)
    let members: Vec<(i32,)> = sqlx::query_as(
        r#"SELECT user_id FROM libraire_team_members
           WHERE librairie_id = $1 AND is_active = true AND role IN ('owner', 'manager', 'preparer')
        "#,
    )
    .bind(librairie_id)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    for (member_user_id,) in &members {
        let _ = sqlx::query(
            r#"INSERT INTO notifications (user_id, type, title, body, data, created_at)
            VALUES ($1, 'libraire_order', $2, $3, $4, NOW())"#,
        )
        .bind(member_user_id)
        .bind(title)
        .bind(body)
        .bind(data.to_string())
        .execute(pool)
        .await;
    }

    if !members.is_empty() {
        log::info!(
            "[notify_libraire_team] {} membres notifiés pour librairie {}",
            members.len(),
            librairie_id
        );
    }
}

// ============================================================================
// COURSIER: QR CONTEXTUEL PAR STOP
// ============================================================================
//
// Problème: un coursier a N paquets et N QR codes.
// Quand il arrive chez un libraire/utilisateur, il doit savoir quel QR montrer.
//
// Solution: endpoint qui retourne les paquets groupés par stop (expéditeur/destinataire),
// avec le QR code correspondant à chaque stop. Le coursier voit:
//   "Stop 1: Librairie Dupont → 3 paquets → [QR à montrer]"
//   "Stop 2: Jean Mbarga → 1 paquet → [QR à montrer]"

/// GET /api/bourse-livre/v2/courier/my-stops
/// Retourne l'itinéraire du coursier avec les QR codes contextuels par arrêt.
/// Chaque stop = un lieu (expéditeur ou destinataire) avec les paquets + QR associés.
pub async fn courier_get_my_stops(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: courier_id, .. }): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    info!("[courier_get_my_stops] Coursier: {}", courier_id);

    // Récupérer tous les paquets actifs du coursier
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
    .map_err(|e| AppError::Internal(format!("Erreur paquets coursier: {}", e)))?;

    if packages.is_empty() {
        return Ok(Json(json!({
            "success": true,
            "stops": [],
            "total_stops": 0,
            "message": "Aucun paquet actif"
        })));
    }

    // Grouper les paquets par stop (pickup chez expéditeur, puis delivery chez destinataire)
    // Un stop = un user_id unique qu'on visite
    use std::collections::HashMap;
    struct StopInfo {
        user_id: i32,
        stop_type: String, // "pickup" ou "delivery"
        gps: Option<String>,
        adresse: Option<String>,
        package_ids: Vec<i32>,
        package_refs: Vec<String>,
        livres_count: i32,
    }

    let mut stops_map: HashMap<(i32, String), StopInfo> = HashMap::new();

    for pkg in &packages {
        // Stop pickup (chez l'expéditeur)
        if pkg.statut == "constitue" {
            let key = (pkg.expediteur_id, "pickup".to_string());
            let stop = stops_map.entry(key).or_insert_with(|| StopInfo {
                user_id: pkg.expediteur_id,
                stop_type: "pickup".to_string(),
                gps: pkg.expediteur_gps.clone(),
                adresse: pkg.expediteur_adresse.clone(),
                package_ids: Vec::new(),
                package_refs: Vec::new(),
                livres_count: 0,
            });
            stop.package_ids.push(pkg.id);
            stop.package_refs.push(pkg.reference.clone());
            stop.livres_count += pkg.nombre_livres;
        }

        // Stop delivery (chez le destinataire)
        let key = (pkg.destinataire_id, "delivery".to_string());
        let stop = stops_map.entry(key).or_insert_with(|| StopInfo {
            user_id: pkg.destinataire_id,
            stop_type: "delivery".to_string(),
            gps: pkg.destinataire_gps.clone(),
            adresse: pkg.destinataire_adresse.clone(),
            package_ids: Vec::new(),
            package_refs: Vec::new(),
            livres_count: 0,
        });
        stop.package_ids.push(pkg.id);
        stop.package_refs.push(pkg.reference.clone());
        stop.livres_count += pkg.nombre_livres;
    }

    // Pour chaque stop, récupérer le QR code et les infos utilisateur
    let mut stops_json: Vec<serde_json::Value> = Vec::new();

    // Pickups d'abord, puis deliveries
    let mut stops_ordered: Vec<StopInfo> = stops_map.into_values().collect();
    stops_ordered.sort_by(|a, b| {
        let type_order = |t: &str| if t == "pickup" { 0 } else { 1 };
        type_order(&a.stop_type).cmp(&type_order(&b.stop_type))
    });

    for (idx, stop) in stops_ordered.iter().enumerate() {
        // Info utilisateur (nom, téléphone)
        let user_info =
            sqlx::query("SELECT id, full_name, telephone, photo_url FROM users WHERE id = $1")
                .bind(stop.user_id)
                .fetch_optional(&state.pg)
                .await
                .ok()
                .flatten();

        let user_json = user_info.as_ref().map(|row| {
            use sqlx::Row;
            json!({
                "id": row.get::<i32, _>("id"),
                "nom": row.try_get::<String, _>("full_name").ok(),
                "telephone": row.try_get::<String, _>("telephone").ok(),
                "photo_url": row.try_get::<String, _>("photo_url").ok(),
            })
        });

        // Récupérer OU générer le QR code pour ce stop
        // Un QR par (premier package_id, stop_type) — le QR couvre TOUS les paquets du stop
        let primary_pkg_id = stop.package_ids[0];
        let existing_qr: Option<(String, String)> = sqlx::query_as(
            "SELECT qr_code, qr_code_url FROM book_package_qr_codes WHERE package_id = $1 AND qr_type = $2 AND status = 'pending' AND expires_at > NOW() LIMIT 1",
        )
        .bind(primary_pkg_id)
        .bind(&stop.stop_type)
        .fetch_optional(&state.pg)
        .await
        .ok()
        .flatten();

        let (qr_code, qr_code_url) = if let Some((code, url)) = existing_qr {
            (code, url)
        } else {
            // Générer un nouveau QR pour ce stop
            let qr_service = crate::services::qr_code_service::QRCodeService::new(state.pg.clone());
            match qr_service.generate_book_package_qr(primary_pkg_id, &stop.stop_type).await {
                Ok(qr_info) => (qr_info.qr_code, qr_info.qr_code_url),
                Err(_) => ("".to_string(), "".to_string()),
            }
        };

        // Grouper les livres PAR PAQUET (référence) pour identification physique rapide
        // Chaque paquet = un sac/enveloppe physique étiqueté avec sa référence
        let mut paquets_detail: Vec<serde_json::Value> = Vec::new();
        for pkg_id in &stop.package_ids {
            let pkg = packages.iter().find(|p| p.id == *pkg_id);
            if let Some(pkg) = pkg {
                let livres_du_paquet: Vec<serde_json::Value> = pkg
                    .livres
                    .as_array()
                    .unwrap_or(&vec![])
                    .iter()
                    .map(|livre| {
                        json!({
                            "titre": livre.get("titre").and_then(|v| v.as_str()).unwrap_or("?"),
                            "matiere": livre.get("matiere").and_then(|v| v.as_str()),
                            "valeur": livre.get("valeur").and_then(|v| v.as_f64()),
                        })
                    })
                    .collect();

                paquets_detail.push(json!({
                    "package_id": pkg.id,
                    "reference": pkg.reference,
                    "nombre_livres": pkg.nombre_livres,
                    "statut": pkg.statut,
                    "succursale_label": pkg.succursale_label,
                    "livres": livres_du_paquet,
                }));
            }
        }

        // Liste plate de tous les livres (pour vue rapide)
        let livres_flat: Vec<serde_json::Value> = paquets_detail
            .iter()
            .flat_map(|p| {
                let pkg_ref = p.get("reference").and_then(|v| v.as_str()).unwrap_or("?");
                p.get("livres")
                    .and_then(|l| l.as_array())
                    .unwrap_or(&vec![])
                    .iter()
                    .map(move |livre| {
                        let mut l = livre.clone();
                        l.as_object_mut()
                            .map(|o| o.insert("package_ref".to_string(), json!(pkg_ref)));
                        l
                    })
                    .collect::<Vec<_>>()
            })
            .collect();

        stops_json.push(json!({
            "ordre": idx + 1,
            "stop_type": stop.stop_type,
            "action": if stop.stop_type == "pickup" { "RÉCUPÉRER les livres" } else { "LIVRER les livres" },
            "user": user_json,
            "gps": stop.gps,
            "adresse": stop.adresse,
            // Paquets groupés par référence (pour identification physique rapide)
            "paquets": paquets_detail,
            "package_ids": stop.package_ids,
            "package_refs": stop.package_refs,
            "livres_count": stop.livres_count,
            // Liste plate de tous les livres (rétrocompatibilité)
            "livres": livres_flat,
            "qr_code": qr_code,
            "qr_code_url": qr_code_url,
            "instruction": if stop.stop_type == "pickup" {
                let mut succursales: Vec<String> = paquets_detail
                    .iter()
                    .filter_map(|p| p.get("succursale_label").and_then(|v| v.as_str()))
                    .map(|s| s.to_string())
                    .collect();
                succursales.sort();
                succursales.dedup();
                let succ_txt = if succursales.is_empty() {
                    "".to_string()
                } else {
                    format!(" | Succursale(s): {}", succursales.join(", "))
                };
                format!("Montrez ce QR code à {} pour récupérer {} paquet(s) ({} livre(s)). Références: {}",
                    user_json.as_ref().and_then(|u| u.get("nom")).and_then(|n| n.as_str()).unwrap_or("l'expéditeur"),
                    stop.package_ids.len(),
                    stop.livres_count,
                    stop.package_refs.join(", ")) + &succ_txt
            } else {
                format!("Livrer {} paquet(s) ({} livre(s)) — Références: {}",
                    stop.package_ids.len(),
                    stop.livres_count,
                    stop.package_refs.join(", "))
            }
        }));
    }

    Ok(Json(json!({
        "success": true,
        "stops": stops_json,
        "total_stops": stops_json.len(),
        "total_packages": packages.len(),
        "message": format!("{} arrêts pour {} paquets", stops_json.len(), packages.len())
    })))
}

// ============================================================================
// ÉQUIPE LIBRAIRE: VALIDER UNE COMMANDE + VOIR DÉTAIL LIVRES POUR CONSTITUTION
// ============================================================================

/// POST /api/bourse-livre/v2/libraire/team/validate-order
/// Un membre de l'équipe valide une commande/paquet (marque comme "en préparation" ou "constitué")
#[derive(Debug, Deserialize)]
pub struct TeamValidateOrderRequest {
    pub package_id: Option<i32>,
    pub purchase_id: Option<i32>,
    pub action: String, // "en_preparation", "constitue", "pret", "liberer"
    pub librairie_lieu_id: Option<i32>,
    pub stock_disponible_succursale: Option<bool>,
}

pub async fn team_validate_order(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<TeamValidateOrderRequest>,
) -> AppResult<impl IntoResponse> {
    // Vérifier que c'est un membre d'équipe (owner, manager, ou preparer)
    let member_info: Option<(i32, String)> = sqlx::query_as(
        "SELECT librairie_id, role FROM libraire_team_members WHERE user_id = $1 AND is_active = true AND role IN ('owner', 'manager', 'preparer') LIMIT 1",
    )
    .bind(user_id)
    .fetch_optional(&state.pg)
    .await
    .ok()
    .flatten();

    let (librairie_id, role) = member_info.ok_or_else(|| {
        AppError::Forbidden("Non autorisé — rôle preparer minimum requis".to_string())
    })?;

    let valid_actions = ["en_preparation", "constitue", "pret", "liberer"];
    if !valid_actions.contains(&payload.action.as_str()) {
        return Err(AppError::BadRequest(format!(
            "Action invalide: {}. Actions: en_preparation, constitue, pret, liberer",
            payload.action
        )));
    }

    // Valider un paquet de livraison
    if let Some(pkg_id) = payload.package_id {
        let new_status = match payload.action.as_str() {
            "en_preparation" => "a_constituer",
            "constitue" | "pret" => "constitue",
            _ => "a_constituer",
        };
        let lock_state: Option<(Option<i32>, Option<i32>, String)> = sqlx::query_as(
            "SELECT claimed_by_librairie_id, claimed_by_user_id, statut FROM book_delivery_packages WHERE id = $1",
        )
        .bind(pkg_id)
        .fetch_optional(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur lecture verrou paquet: {}", e)))?;
        let (claimed_librairie, claimed_user, current_status) =
            lock_state.ok_or_else(|| AppError::NotFound("Paquet non trouvé".to_string()))?;

        if payload.action == "liberer" {
            if claimed_user != Some(user_id) {
                return Err(AppError::BadRequest(
                    "Seul le libraire qui a pris en charge ce paquet peut le libérer.".to_string(),
                ));
            }
            sqlx::query(
                r#"
                UPDATE book_delivery_packages
                SET claimed_by_librairie_id = NULL,
                    claimed_by_user_id = NULL,
                    released_at = NOW(),
                    updated_at = NOW()
                WHERE id = $1
                "#,
            )
            .bind(pkg_id)
            .execute(&state.pg)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur libération paquet: {}", e)))?;
            if current_status == "a_constituer" {
                notify_libraire_team(
                    &state.pg,
                    librairie_id,
                    "Commande disponible",
                    "Une commande a été libérée et redevient disponible pour traitement (éléments non validés uniquement).",
                    json!({
                        "event": "order_released_available",
                        "type": "package",
                        "package_id": pkg_id,
                        "only_non_validated_visible": true
                    }),
                )
                .await;
            }
            return Ok(Json(json!({
                "success": true,
                "type": "package",
                "id": pkg_id,
                "new_status": new_status,
                "validated_by": user_id,
                "role": role,
                "message": "Commande libérée: un autre libraire éligible peut reprendre les éléments non validés."
            })));
        }

        if let Some(other_user) = claimed_user {
            if other_user != user_id {
                return Err(AppError::BadRequest(
                    "Commande en cours de traitement par un autre libraire. Attendez sa libération."
                        .to_string(),
                ));
            }
        }
        if let Some(other_librairie) = claimed_librairie {
            if other_librairie != librairie_id {
                return Err(AppError::BadRequest(
                    "Commande verrouillée par une autre librairie du périmètre pour éviter les conflits."
                        .to_string(),
                ));
            }
        }
        if payload.action == "en_preparation" && current_status == "constitue" {
            return Err(AppError::BadRequest(
                "Ce paquet est déjà constitué. Les éléments validés ne peuvent plus être modifiés par un autre libraire."
                    .to_string(),
            ));
        }

        if matches!(
            payload.action.as_str(),
            "en_preparation" | "constitue" | "pret"
        ) {
            if matches!(payload.action.as_str(), "constitue" | "pret")
                && claimed_user != Some(user_id)
            {
                return Err(AppError::BadRequest(
                    "Passez d'abord la commande en préparation sur votre compte avant de la constituer."
                        .to_string(),
                ));
            }
            let lieu_id = payload.librairie_lieu_id.ok_or_else(|| {
                AppError::BadRequest(
                    "Sélectionnez la succursale concernée avant validation. Si cette succursale n'a pas le stock, ne validez pas la commande.".to_string(),
                )
            })?;
            let stock_ok = payload.stock_disponible_succursale == Some(true);
            if matches!(payload.action.as_str(), "constitue" | "pret") && !stock_ok {
                return Err(AppError::BadRequest(
                    "Stock indisponible sur la succursale sélectionnée: validation refusée. Choisissez une autre succursale ou laissez le statut en préparation.".to_string(),
                ));
            }

            let owner_user_id: i32 = sqlx::query_scalar(
                "SELECT user_id FROM libraire_team_members WHERE librairie_id = $1 AND role = 'owner' AND is_active = true LIMIT 1",
            )
            .bind(librairie_id)
            .fetch_optional(&state.pg)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur vérification owner librairie: {}", e)))?
            .ok_or_else(|| AppError::Forbidden("Owner librairie introuvable".to_string()))?;

            let lieu: Option<(String, Option<String>, Option<String>, Option<String>)> =
                sqlx::query_as(
                    r#"
                SELECT ll.libelle, ll.gps, ll.adresse, ll.ville
                FROM librairie_lieux ll
                INNER JOIN librairie_partners lp ON lp.id = ll.librairie_partner_id
                WHERE ll.id = $1 AND lp.user_id = $2
                LIMIT 1
                "#,
                )
                .bind(lieu_id)
                .bind(owner_user_id)
                .fetch_optional(&state.pg)
                .await
                .map_err(|e| {
                    AppError::Internal(format!("Erreur vérification succursale: {}", e))
                })?;

            let (succursale_label, succ_gps, succ_addr, succ_ville) = lieu.ok_or_else(|| {
                AppError::BadRequest(
                    "Succursale invalide pour cette librairie. Vérifiez la sélection avant validation."
                        .to_string(),
                )
            })?;

            // Contrainte de cohérence matching courant: la succursale doit rester dans le champ d'action (ville/rayon) du besoin.
            let package_scope: Option<(Option<String>, Option<String>)> = sqlx::query_as(
                "SELECT destinataire_gps, destinataire_adresse FROM book_delivery_packages WHERE id = $1",
            )
            .bind(pkg_id)
            .fetch_optional(&state.pg)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur lecture scope paquet: {}", e)))?;
            let (target_gps, target_addr) = package_scope.unwrap_or((None, None));
            if !succursale_matches_current_scope(
                &target_gps,
                &target_addr,
                &succ_gps,
                &succ_ville,
                80.0,
            ) {
                return Err(AppError::BadRequest(
                    "La succursale choisie est hors du matching courant (ville/rayon). Sélectionnez une succursale dans le champ d'action de la commande."
                        .to_string(),
                ));
            }

            let should_release = matches!(payload.action.as_str(), "constitue" | "pret");
            let updated = sqlx::query_scalar::<_, i32>(
                r#"
                UPDATE book_delivery_packages
                SET statut = $1,
                    date_constitution = CASE WHEN $1 = 'constitue' THEN NOW() ELSE date_constitution END,
                    librairie_lieu_id = $2,
                    succursale_label = $3,
                    stock_disponible_succursale = $4,
                    expediteur_gps = COALESCE($5, expediteur_gps),
                    expediteur_adresse = COALESCE($6, expediteur_adresse),
                    claimed_by_librairie_id = CASE WHEN $8 THEN NULL ELSE $9 END,
                    claimed_by_user_id = CASE WHEN $8 THEN NULL ELSE $10 END,
                    claimed_at = CASE WHEN $8 THEN claimed_at ELSE COALESCE(claimed_at, NOW()) END,
                    released_at = CASE WHEN $8 THEN NOW() ELSE NULL END,
                    updated_at = NOW()
                WHERE id = $7
                RETURNING id
                "#,
            )
            .bind(new_status)
            .bind(lieu_id)
            .bind(&succursale_label)
            .bind(stock_ok)
            .bind(succ_gps)
            .bind(succ_addr)
            .bind(pkg_id)
            .bind(should_release)
            .bind(librairie_id)
            .bind(user_id)
            .fetch_optional(&state.pg)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur MAJ paquet (succursale): {}", e)))?;

            if updated.is_none() {
                return Err(AppError::NotFound("Paquet non trouvé".to_string()));
            }

            return Ok(Json(json!({
                "success": true,
                "type": "package",
                "id": pkg_id,
                "new_status": new_status,
                "validated_by": user_id,
                "role": role,
                "librairie_lieu_id": lieu_id,
                "succursale_label": succursale_label,
                "message": if new_status == "a_constituer" {
                    "Commande affectée à la succursale (préparation en cours)."
                } else {
                    "Commande validée sur la succursale sélectionnée."
                }
            })));
        }

        let updated = sqlx::query_scalar::<_, i32>(
            "UPDATE book_delivery_packages SET statut = $1, date_constitution = CASE WHEN $1 = 'constitue' THEN NOW() ELSE date_constitution END, updated_at = NOW() WHERE id = $2 RETURNING id",
        )
        .bind(new_status)
        .bind(pkg_id)
        .fetch_optional(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur MAJ paquet: {}", e)))?;

        if updated.is_none() {
            return Err(AppError::NotFound("Paquet non trouvé".to_string()));
        }

        info!(
            "[team_validate_order] Membre {} (role:{}) → paquet {} marqué '{}'",
            user_id, role, pkg_id, new_status
        );

        return Ok(Json(json!({
            "success": true,
            "type": "package",
            "id": pkg_id,
            "new_status": new_status,
            "validated_by": user_id,
            "role": role,
            "message": "Commande mise en préparation."
        })));
    }

    // Valider un achat direct
    if let Some(purchase_id) = payload.purchase_id {
        let new_status = match payload.action.as_str() {
            "en_preparation" => "en_preparation",
            "constitue" | "pret" => "en_livraison",
            _ => "en_preparation",
        };
        let lock_state: Option<(Option<i32>, Option<i32>, String)> = sqlx::query_as(
            "SELECT claimed_by_librairie_id, claimed_by_user_id, statut FROM book_purchases WHERE id = $1",
        )
        .bind(purchase_id)
        .fetch_optional(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur lecture verrou achat: {}", e)))?;
        let (claimed_librairie, claimed_user, current_status) =
            lock_state.ok_or_else(|| AppError::NotFound("Achat non trouvé".to_string()))?;

        if payload.action == "liberer" {
            if claimed_user != Some(user_id) {
                return Err(AppError::BadRequest(
                    "Seul le libraire qui a pris en charge cette partie de commande peut la libérer."
                        .to_string(),
                ));
            }
            sqlx::query(
                r#"
                UPDATE book_purchases
                SET claimed_by_librairie_id = NULL,
                    claimed_by_user_id = NULL,
                    released_at = NOW(),
                    updated_at = NOW()
                WHERE id = $1
                "#,
            )
            .bind(purchase_id)
            .execute(&state.pg)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur libération achat: {}", e)))?;
            if current_status == "en_preparation"
                || current_status == "confirme"
                || current_status == "en_attente"
            {
                notify_libraire_team(
                    &state.pg,
                    librairie_id,
                    "Commande disponible",
                    "Une partie de commande a été libérée et redevient disponible pour traitement (éléments non validés uniquement).",
                    json!({
                        "event": "order_released_available",
                        "type": "purchase",
                        "purchase_id": purchase_id,
                        "only_non_validated_visible": true
                    }),
                )
                .await;
            }
            return Ok(Json(json!({
                "success": true,
                "type": "purchase",
                "id": purchase_id,
                "new_status": new_status,
                "validated_by": user_id,
                "role": role,
                "message": "Partie de commande libérée: un autre libraire éligible peut reprendre les éléments non validés."
            })));
        }
        if let Some(other_user) = claimed_user {
            if other_user != user_id {
                return Err(AppError::BadRequest(
                    "Cette partie de commande est en cours de traitement par un autre libraire."
                        .to_string(),
                ));
            }
        }
        if let Some(other_librairie) = claimed_librairie {
            if other_librairie != librairie_id {
                return Err(AppError::BadRequest(
                    "Cette partie de commande est verrouillée par une autre librairie du périmètre."
                        .to_string(),
                ));
            }
        }
        if payload.action == "en_preparation" && current_status == "en_livraison" {
            return Err(AppError::BadRequest(
                "Cette partie de commande est déjà validée pour livraison. Elle n'est plus modifiable."
                    .to_string(),
            ));
        }

        let lieu_id = payload.librairie_lieu_id.ok_or_else(|| {
            AppError::BadRequest(
                "Sélectionnez la succursale concernée avant validation. Si cette succursale n'a pas le stock, ne validez pas cette partie de commande.".to_string(),
            )
        })?;
        let stock_ok = payload.stock_disponible_succursale == Some(true);
        if matches!(payload.action.as_str(), "constitue" | "pret") && claimed_user != Some(user_id)
        {
            return Err(AppError::BadRequest(
                "Passez d'abord cette partie de commande en préparation sur votre compte avant validation."
                    .to_string(),
            ));
        }
        if matches!(payload.action.as_str(), "constitue" | "pret") && !stock_ok {
            return Err(AppError::BadRequest(
                "Stock indisponible sur la succursale sélectionnée: validation refusée pour cette partie de commande.".to_string(),
            ));
        }

        let owner_user_id: i32 = sqlx::query_scalar(
            "SELECT user_id FROM libraire_team_members WHERE librairie_id = $1 AND role = 'owner' AND is_active = true LIMIT 1",
        )
        .bind(librairie_id)
        .fetch_optional(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur vérification owner librairie: {}", e)))?
        .ok_or_else(|| AppError::Forbidden("Owner librairie introuvable".to_string()))?;

        let lieu: Option<(String, Option<String>, Option<String>)> = sqlx::query_as(
            r#"
            SELECT ll.libelle, ll.gps, ll.ville
            FROM librairie_lieux ll
            INNER JOIN librairie_partners lp ON lp.id = ll.librairie_partner_id
            WHERE ll.id = $1 AND lp.user_id = $2
            LIMIT 1
            "#,
        )
        .bind(lieu_id)
        .bind(owner_user_id)
        .fetch_optional(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur vérification succursale: {}", e)))?;

        let (succursale_label, succ_gps, succ_ville) = lieu.ok_or_else(|| {
            AppError::BadRequest(
                "Succursale invalide pour cette librairie. Vérifiez la sélection avant validation."
                    .to_string(),
            )
        })?;

        // Même contrainte de scope pour validation partielle d'une commande (purchase).
        let purchase_scope: Option<(Option<String>, Option<String>)> = sqlx::query_as(
            "SELECT gps_livraison, adresse_livraison FROM book_purchases WHERE id = $1",
        )
        .bind(purchase_id)
        .fetch_optional(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur lecture scope achat: {}", e)))?;
        let (target_gps, target_addr) = purchase_scope.unwrap_or((None, None));
        if !succursale_matches_current_scope(
            &target_gps,
            &target_addr,
            &succ_gps,
            &succ_ville,
            80.0,
        ) {
            return Err(AppError::BadRequest(
                "La succursale choisie est hors du matching courant (ville/rayon). Sélectionnez une succursale dans le champ d'action de cette partie de commande."
                    .to_string(),
            ));
        }

        let should_release = matches!(payload.action.as_str(), "constitue" | "pret");
        let updated = sqlx::query_scalar::<_, i32>(
            "UPDATE book_purchases SET statut = $1, librairie_lieu_id = $2, succursale_label = $3, stock_disponible_succursale = $4, claimed_by_librairie_id = CASE WHEN $5 THEN NULL ELSE $6 END, claimed_by_user_id = CASE WHEN $5 THEN NULL ELSE $7 END, claimed_at = CASE WHEN $5 THEN claimed_at ELSE COALESCE(claimed_at, NOW()) END, released_at = CASE WHEN $5 THEN NOW() ELSE NULL END, updated_at = NOW() WHERE id = $8 RETURNING id",
        )
        .bind(new_status)
        .bind(lieu_id)
        .bind(&succursale_label)
        .bind(stock_ok)
        .bind(should_release)
        .bind(librairie_id)
        .bind(user_id)
        .bind(purchase_id)
        .fetch_optional(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur MAJ achat: {}", e)))?;

        if updated.is_none() {
            return Err(AppError::NotFound("Achat non trouvé".to_string()));
        }

        info!(
            "[team_validate_order] Membre {} (role:{}) → achat {} marqué '{}'",
            user_id, role, purchase_id, new_status
        );

        return Ok(Json(json!({
            "success": true,
            "type": "purchase",
            "id": purchase_id,
            "new_status": new_status,
            "validated_by": user_id,
            "role": role,
            "librairie_lieu_id": lieu_id,
            "succursale_label": succursale_label,
            "message": if new_status == "en_preparation" {
                "Partie de commande affectée à la succursale (préparation en cours)."
            } else {
                "Partie de commande validée sur la succursale sélectionnée."
            }
        })));
    }

    Err(AppError::BadRequest(
        "Fournir package_id ou purchase_id".to_string(),
    ))
}

/// GET /api/bourse-livre/v2/libraire/team/package/:id/detail
/// Voir le détail complet d'un paquet pour la constitution physique
/// (liste des livres avec images, titres, matières, classes — pour les préparer physiquement)
pub async fn team_get_package_detail(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(package_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    // Vérifier membre d'équipe
    let member_info: Option<(i32,)> = sqlx::query_as(
        "SELECT librairie_id FROM libraire_team_members WHERE user_id = $1 AND is_active = true LIMIT 1",
    )
    .bind(user_id)
    .fetch_optional(&state.pg)
    .await
    .ok()
    .flatten();

    if member_info.is_none() {
        return Err(AppError::Forbidden(
            "Vous n'êtes membre d'aucune librairie".to_string(),
        ));
    }

    // Récupérer le paquet
    let package = sqlx::query_as::<_, BookDeliveryPackage>(
        "SELECT * FROM book_delivery_packages WHERE id = $1",
    )
    .bind(package_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?
    .ok_or_else(|| AppError::NotFound("Paquet non trouvé".to_string()))?;

    // Enrichir chaque livre avec infos complètes (images, auteur, état...)
    let mut livres_enrichis: Vec<serde_json::Value> = Vec::new();
    if let Some(arr) = package.livres.as_array() {
        for livre_json in arr {
            let livre_id = livre_json.get("livre_id").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
            if livre_id > 0 {
                if let Ok(Some(livre)) =
                    sqlx::query_as::<_, crate::models::livre_scolaire::LivreScolaire>(
                        "SELECT * FROM livres_scolaires WHERE id = $1",
                    )
                    .bind(livre_id)
                    .fetch_optional(&state.pg)
                    .await
                {
                    // Générer presigned URL pour les images
                    let recto_url = match &livre.image_recto {
                        Some(p) if !p.is_empty() && !p.starts_with("http") => {
                            state.media_storage.generate_presigned_url(p, 86400).await.ok()
                        }
                        other => other.clone(),
                    };
                    let verso_url = match &livre.image_verso {
                        Some(p) if !p.is_empty() && !p.starts_with("http") => {
                            state.media_storage.generate_presigned_url(p, 86400).await.ok()
                        }
                        other => other.clone(),
                    };

                    livres_enrichis.push(json!({
                        "livre_id": livre.id,
                        "titre": livre.titre,
                        "auteur": livre.auteur,
                        "editeur": livre.editeur,
                        "isbn": livre.isbn,
                        "matiere": livre.matiere,
                        "type_article": infer_type_article_from_matiere(&livre.matiere),
                        "classe_actuelle": livre.classe_actuelle,
                        "etat_livre": livre.etat_livre,
                        "etat_classification": livre.etat_classification,
                        "image_recto": recto_url,
                        "image_verso": verso_url,
                        "valeur": livre.valeur_calculee,
                        "mode": livre.mode_listing,
                    }));
                } else {
                    livres_enrichis.push(livre_json.clone());
                }
            }
        }
    }

    // Info destinataire
    let destinataire = sqlx::query("SELECT id, full_name, telephone FROM users WHERE id = $1")
        .bind(package.destinataire_id)
        .fetch_optional(&state.pg)
        .await
        .ok()
        .flatten();

    let dest_json = destinataire.as_ref().map(|row| {
        use sqlx::Row;
        json!({
            "id": row.get::<i32, _>("id"),
            "nom": row.try_get::<String, _>("full_name").ok(),
            "telephone": row.try_get::<String, _>("telephone").ok(),
        })
    });

    Ok(Json(json!({
        "success": true,
        "package": {
            "id": package.id,
            "reference": package.reference,
            "statut": package.statut,
            "librairie_lieu_id": package.librairie_lieu_id,
            "succursale_label": package.succursale_label,
            "stock_disponible_succursale": package.stock_disponible_succursale,
            "nombre_livres": package.nombre_livres,
            "valeur_totale": package.valeur_totale,
            "frais_livraison": package.frais_livraison,
            "devise": package.devise.as_deref().unwrap_or("XAF"),
            "created_at": package.created_at,
        },
        "livres": livres_enrichis,
        "destinataire": dest_json,
        "checklist": livres_enrichis.iter().map(|l| {
            json!({
                "titre": l.get("titre"),
                "matiere": l.get("matiere"),
                "classe": l.get("classe_actuelle"),
                "etat": l.get("etat_livre"),
                "a_verifier": true,
            })
        }).collect::<Vec<_>>(),
        "instructions": format!(
            "Préparez {} livre(s) pour le paquet {}. Vérifiez chaque livre de la checklist ci-dessous avant de marquer le paquet comme 'constitué'.",
            livres_enrichis.len(), package.reference
        )
    })))
}
