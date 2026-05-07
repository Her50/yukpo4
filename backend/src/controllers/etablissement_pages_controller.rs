// ✅ Contrôleur Pages Officielles Établissements
// Date : 2026-05-07
//
// Gère la page publique de chaque établissement (`/ecole/{slug}`) avec ses
// 10 blocs CMS (inscription, transport, cantine, perisco, internat, uniforme,
// calendrier, annonces, contacts, laureats) + intégration directe avec la
// Bourse du Livre via la table programmes_scolaires partagée.

use crate::core::types::{AppError, AppResult};
use crate::middlewares::jwt::AuthenticatedUser;
use crate::state::AppState;
use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use log::{info, warn};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;

// ============================================================================
// MODÈLES SÉRIALISÉS POUR LES RÉPONSES
// ============================================================================

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct EtablissementSummary {
    pub id: i32,
    pub nom_etablissement: String,
    pub slug: Option<String>,
    pub ville: Option<String>,
    pub quartier: Option<String>,
    pub logo_url: Option<String>,
    pub type_etablissement: Option<String>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct EtablissementPagePublic {
    pub id: i32,
    pub nom_etablissement: String,
    pub slug: Option<String>,
    pub ville: Option<String>,
    pub quartier: Option<String>,
    pub adresse: Option<String>,
    pub logo_url: Option<String>,
    pub banniere_url: Option<String>,
    pub description: Option<String>,
    pub type_etablissement: Option<String>,
    pub telephone: Option<String>,
    pub email: Option<String>,
    pub gps: Option<String>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct EtablissementBlocOut {
    pub id: i32,
    pub type_bloc: String,
    pub titre: Option<String>,
    pub contenu_json: Value,
    pub medias_urls: Option<Vec<String>>,
    pub position: i32,
    pub is_active: bool,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct EtablissementAnnonce {
    pub id: i32,
    pub titre: String,
    pub contenu: String,
    pub image_url: Option<String>,
    pub is_pinned: bool,
    pub published_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct EtablissementEvenement {
    pub id: i32,
    pub titre: String,
    pub description: Option<String>,
    pub type_event: Option<String>,
    pub date_debut: chrono::DateTime<chrono::Utc>,
    pub date_fin: Option<chrono::DateTime<chrono::Utc>>,
    pub classe_concernee: Option<String>,
}

// ============================================================================
// PAYLOADS DE REQUÊTE
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct SearchEtablissementsParams {
    pub q: String,
    #[serde(default = "default_limit")]
    pub limit: i64,
}

fn default_limit() -> i64 {
    10
}

#[derive(Debug, Deserialize)]
pub struct UpsertBlocPayload {
    pub titre: Option<String>,
    pub contenu_json: Value,
    pub medias_urls: Option<Vec<String>>,
    pub position: Option<i32>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct CreateAnnoncePayload {
    pub titre: String,
    pub contenu: String,
    pub image_url: Option<String>,
    pub is_pinned: Option<bool>,
    pub expires_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Deserialize)]
pub struct CreateEvenementPayload {
    pub titre: String,
    pub description: Option<String>,
    pub type_event: Option<String>,
    pub date_debut: chrono::DateTime<chrono::Utc>,
    pub date_fin: Option<chrono::DateTime<chrono::Utc>>,
    pub classe_concernee: Option<String>,
}

// ============================================================================
// ENDPOINTS PUBLICS — accessibles sans authentification
// ============================================================================

/// GET /api/v2/etablissements/search?q=cbg&limit=10
/// Autocomplete pour la barre de recherche école sur la home page parent.
pub async fn search_etablissements(
    State(state): State<Arc<AppState>>,
    Query(params): Query<SearchEtablissementsParams>,
) -> AppResult<impl IntoResponse> {
    let q = params.q.trim();
    if q.len() < 2 {
        return Ok((StatusCode::OK, Json(json!({ "results": [] }))));
    }
    let limit = params.limit.clamp(1, 25);

    let pattern = format!("%{}%", q);
    let rows = sqlx::query_as::<_, EtablissementSummary>(
        r#"
        SELECT
            e.id,
            e.nom_etablissement,
            e.slug,
            e.ville,
            e.quartier,
            e.logo_url,
            e.type_etablissement
        FROM etablissements_scolaires e
        WHERE
            e.page_status = 'published'
            AND (
                e.nom_etablissement ILIKE $1
                OR similarity(lower(e.nom_etablissement), lower($2)) > 0.2
                OR e.quartier ILIKE $1
            )
        ORDER BY
            similarity(lower(e.nom_etablissement), lower($2)) DESC NULLS LAST,
            e.nom_etablissement
        LIMIT $3
        "#,
    )
    .bind(&pattern)
    .bind(q)
    .bind(limit)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| AppError::Database(format!("search_etablissements: {}", e)))?;

    Ok((StatusCode::OK, Json(json!({ "results": rows }))))
}

/// GET /api/v2/ecole/{slug}
/// Page complète d'un établissement : infos générales + tous les blocs publiés
/// + annonces + événements + classes disponibles avec liste scolaire.
pub async fn get_ecole_publique(
    State(state): State<Arc<AppState>>,
    Path(slug): Path<String>,
) -> AppResult<impl IntoResponse> {
    info!("[get_ecole_publique] slug={}", slug);

    // 1. Établissement de base
    let etab = sqlx::query_as::<_, EtablissementPagePublic>(
        r#"
        SELECT
            id,
            nom_etablissement,
            slug,
            ville,
            quartier,
            adresse,
            logo_url,
            banniere_url,
            description,
            type_etablissement,
            telephone,
            email,
            ST_AsText(gps_coordinates) AS gps
        FROM etablissements_scolaires
        WHERE slug = $1 AND page_status = 'published'
        "#,
    )
    .bind(&slug)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| AppError::Database(format!("get_ecole_publique etab: {}", e)))?
    .ok_or_else(|| AppError::NotFound(format!("Établissement '{}' introuvable", slug)))?;

    // 2. Blocs CMS publiés
    let blocs = sqlx::query_as::<_, EtablissementBlocOut>(
        r#"
        SELECT id, type_bloc, titre, contenu_json, medias_urls, position, is_active
        FROM etablissement_blocs
        WHERE etablissement_id = $1 AND is_active = true
        ORDER BY position ASC, id ASC
        "#,
    )
    .bind(etab.id)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| AppError::Database(format!("get_ecole_publique blocs: {}", e)))?;

    // 3. Annonces récentes (max 20, non expirées)
    let annonces = sqlx::query_as::<_, EtablissementAnnonce>(
        r#"
        SELECT id, titre, contenu, image_url, is_pinned, published_at
        FROM etablissement_annonces
        WHERE etablissement_id = $1
          AND (expires_at IS NULL OR expires_at > NOW())
        ORDER BY is_pinned DESC, published_at DESC
        LIMIT 20
        "#,
    )
    .bind(etab.id)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| AppError::Database(format!("get_ecole_publique annonces: {}", e)))?;

    // 4. Événements à venir (90 prochains jours)
    let evenements = sqlx::query_as::<_, EtablissementEvenement>(
        r#"
        SELECT id, titre, description, type_event, date_debut, date_fin, classe_concernee
        FROM etablissement_evenements
        WHERE etablissement_id = $1
          AND is_active = true
          AND date_debut > NOW() - INTERVAL '7 days'
        ORDER BY date_debut ASC
        LIMIT 50
        "#,
    )
    .bind(etab.id)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| AppError::Database(format!("get_ecole_publique events: {}", e)))?;

    // 5. Classes disponibles (distincts dans programmes_scolaires)
    let classes_dispo = sqlx::query_scalar::<_, String>(
        r#"
        SELECT DISTINCT classe
        FROM programmes_scolaires
        WHERE etablissement_id = $1 AND is_active = true
        ORDER BY classe
        "#,
    )
    .bind(etab.id)
    .fetch_all(&state.pg)
    .await
    .unwrap_or_default();

    // 6. Incrément compteur visites (best-effort, ne bloque pas)
    let _ = sqlx::query(
        r#"
        INSERT INTO etablissement_visites(etablissement_id, date, visites)
        VALUES ($1, CURRENT_DATE, 1)
        ON CONFLICT (etablissement_id, date) DO UPDATE
            SET visites = etablissement_visites.visites + 1
        "#,
    )
    .bind(etab.id)
    .execute(&state.pg)
    .await;

    Ok((
        StatusCode::OK,
        Json(json!({
            "etablissement": etab,
            "blocs": blocs,
            "annonces": annonces,
            "evenements": evenements,
            "classes_disponibles": classes_dispo,
        })),
    ))
}

/// GET /api/v2/ecole/{slug}/classe/{classe}/programme
/// Liste scolaire d'une classe précise (manuels + fournitures depuis
/// programmes_scolaires filtrés par etablissement_id) — utilisée par le
/// chemin "Commander" depuis la page école.
pub async fn get_programme_classe_etablissement(
    State(state): State<Arc<AppState>>,
    Path((slug, classe)): Path<(String, String)>,
) -> AppResult<impl IntoResponse> {
    let etab_id: Option<i32> = sqlx::query_scalar(
        "SELECT id FROM etablissements_scolaires WHERE slug = $1 AND page_status = 'published'",
    )
    .bind(&slug)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| AppError::Database(format!("etab_id: {}", e)))?;

    let etab_id = etab_id
        .ok_or_else(|| AppError::NotFound(format!("Établissement '{}' introuvable", slug)))?;

    // Incrément clic commande
    let _ = sqlx::query(
        r#"
        INSERT INTO etablissement_visites(etablissement_id, date, clics_commande)
        VALUES ($1, CURRENT_DATE, 1)
        ON CONFLICT (etablissement_id, date) DO UPDATE
            SET clics_commande = etablissement_visites.clics_commande + 1
        "#,
    )
    .bind(etab_id)
    .execute(&state.pg)
    .await;

    // Récupération du programme (manuels + fournitures)
    let articles = sqlx::query(
        r#"
        SELECT
            id,
            titre_livre,
            auteur_livre,
            editeur_livre,
            matiere,
            classe,
            type,
            prix_officiel,
            devise,
            est_obligatoire,
            COALESCE(quantite_defaut, 1) AS quantite_defaut
        FROM programmes_scolaires
        WHERE etablissement_id = $1
          AND is_active = true
          AND classe ILIKE $2
        ORDER BY
            CASE type
                WHEN 'livre' THEN 1
                WHEN 'workbook' THEN 2
                WHEN 'cahier' THEN 3
                WHEN 'fourniture' THEN 4
                ELSE 5
            END,
            matiere,
            titre_livre
        "#,
    )
    .bind(etab_id)
    .bind(&classe)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| AppError::Database(format!("programme classe: {}", e)))?;

    use sqlx::Row;
    let items: Vec<Value> = articles
        .into_iter()
        .map(|row| {
            let prix: Option<rust_decimal::Decimal> = row.try_get("prix_officiel").ok().flatten();
            json!({
                "id": row.try_get::<i32, _>("id").ok(),
                "titre": row.try_get::<Option<String>, _>("titre_livre").ok().flatten(),
                "auteur": row.try_get::<Option<String>, _>("auteur_livre").ok().flatten(),
                "editeur": row.try_get::<Option<String>, _>("editeur_livre").ok().flatten(),
                "matiere": row.try_get::<Option<String>, _>("matiere").ok().flatten(),
                "classe": row.try_get::<Option<String>, _>("classe").ok().flatten(),
                "type": row.try_get::<Option<String>, _>("type").ok().flatten(),
                "prix_officiel": prix.and_then(|p| p.to_string().parse::<f64>().ok()),
                "devise": row.try_get::<Option<String>, _>("devise").ok().flatten().unwrap_or_else(|| "XAF".to_string()),
                "est_obligatoire": row.try_get::<Option<bool>, _>("est_obligatoire").ok().flatten().unwrap_or(true),
                "quantite_defaut": row.try_get::<i32, _>("quantite_defaut").unwrap_or(1),
                "source": "etablissement",
            })
        })
        .collect();

    Ok((
        StatusCode::OK,
        Json(json!({
            "slug": slug,
            "classe": classe,
            "etablissement_id": etab_id,
            "articles": items,
        })),
    ))
}

// ============================================================================
// ENDPOINTS ADMIN ÉTABLISSEMENT — authentification requise
// ============================================================================

/// Vérifie que l'utilisateur connecté est bien le gérant de l'établissement.
async fn require_etab_admin(
    state: &AppState,
    user_id: i32,
    etablissement_id: i32,
) -> AppResult<()> {
    let is_admin: bool = sqlx::query_scalar::<_, bool>(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM etablissements_scolaires
            WHERE id = $1 AND (gerant_user_id = $2 OR user_id = $2)
        )
        "#,
    )
    .bind(etablissement_id)
    .bind(user_id)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| AppError::Database(format!("require_etab_admin: {}", e)))?;

    if !is_admin {
        return Err(AppError::Forbidden(
            "Vous n'êtes pas administrateur de cet établissement".to_string(),
        ));
    }
    Ok(())
}

/// GET /api/v2/admin/etablissement/mes-etablissements
/// Liste les établissements gérés par l'utilisateur connecté.
pub async fn get_my_etablissements(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    let rows = sqlx::query(
        r#"
        SELECT
            id, nom_etablissement, slug, type_etablissement, ville, quartier,
            logo_url, banniere_url, page_status, page_published_at, qr_code_url,
            stats_views_30d
        FROM etablissements_scolaires
        WHERE gerant_user_id = $1 OR user_id = $1
        ORDER BY id DESC
        "#,
    )
    .bind(user_id)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| AppError::Database(format!("get_my_etablissements: {}", e)))?;

    use sqlx::Row;
    let etabs: Vec<Value> = rows
        .into_iter()
        .map(|r| {
            json!({
                "id": r.try_get::<i32, _>("id").ok(),
                "nom_etablissement": r.try_get::<String, _>("nom_etablissement").ok(),
                "slug": r.try_get::<Option<String>, _>("slug").ok().flatten(),
                "type_etablissement": r.try_get::<Option<String>, _>("type_etablissement").ok().flatten(),
                "ville": r.try_get::<Option<String>, _>("ville").ok().flatten(),
                "quartier": r.try_get::<Option<String>, _>("quartier").ok().flatten(),
                "logo_url": r.try_get::<Option<String>, _>("logo_url").ok().flatten(),
                "banniere_url": r.try_get::<Option<String>, _>("banniere_url").ok().flatten(),
                "page_status": r.try_get::<String, _>("page_status").ok(),
                "page_published_at": r.try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("page_published_at").ok().flatten(),
                "qr_code_url": r.try_get::<Option<String>, _>("qr_code_url").ok().flatten(),
                "stats_views_30d": r.try_get::<i32, _>("stats_views_30d").ok(),
            })
        })
        .collect();

    Ok((StatusCode::OK, Json(json!({ "etablissements": etabs }))))
}

/// GET /api/v2/admin/etablissement/{id}/blocs
/// Tous les blocs (publiés + brouillons) pour le gérant.
pub async fn get_blocs_admin(
    State(state): State<Arc<AppState>>,
    Path(etab_id): Path<i32>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    require_etab_admin(&state, user_id, etab_id).await?;

    let blocs = sqlx::query_as::<_, EtablissementBlocOut>(
        r#"
        SELECT id, type_bloc, titre, contenu_json, medias_urls, position, is_active
        FROM etablissement_blocs
        WHERE etablissement_id = $1
        ORDER BY position ASC, id ASC
        "#,
    )
    .bind(etab_id)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| AppError::Database(format!("get_blocs_admin: {}", e)))?;

    Ok((StatusCode::OK, Json(json!({ "blocs": blocs }))))
}

/// PUT /api/v2/admin/etablissement/{id}/bloc/{type_bloc}
/// Création ou mise à jour (UPSERT) d'un bloc CMS.
pub async fn upsert_bloc(
    State(state): State<Arc<AppState>>,
    Path((etab_id, type_bloc)): Path<(i32, String)>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,

    Json(payload): Json<UpsertBlocPayload>,
) -> AppResult<impl IntoResponse> {
    require_etab_admin(&state, user_id, etab_id).await?;

    // Validation du type_bloc
    const TYPES_VALIDES: [&str; 10] = [
        "inscription",
        "transport",
        "cantine",
        "perisco",
        "internat",
        "uniforme",
        "calendrier",
        "annonces",
        "contacts",
        "laureats",
    ];
    if !TYPES_VALIDES.contains(&type_bloc.as_str()) {
        return Err(AppError::BadRequest(format!(
            "Type de bloc invalide : '{}'. Attendu: {:?}",
            type_bloc, TYPES_VALIDES
        )));
    }

    let position = payload.position.unwrap_or(0);
    let is_active = payload.is_active.unwrap_or(true);
    let medias = payload.medias_urls.unwrap_or_default();

    let row = sqlx::query(
        r#"
        INSERT INTO etablissement_blocs
            (etablissement_id, type_bloc, titre, contenu_json, medias_urls,
             position, is_active, published_at, created_by, updated_by)
        VALUES
            ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, $8)
        ON CONFLICT (etablissement_id, type_bloc) DO UPDATE
        SET titre = EXCLUDED.titre,
            contenu_json = EXCLUDED.contenu_json,
            medias_urls = EXCLUDED.medias_urls,
            position = EXCLUDED.position,
            is_active = EXCLUDED.is_active,
            published_at = NOW(),
            updated_by = $8,
            updated_at = NOW()
        RETURNING id
        "#,
    )
    .bind(etab_id)
    .bind(&type_bloc)
    .bind(&payload.titre)
    .bind(&payload.contenu_json)
    .bind(&medias)
    .bind(position)
    .bind(is_active)
    .bind(user_id)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| AppError::Database(format!("upsert_bloc: {}", e)))?;

    use sqlx::Row;
    let bloc_id: i32 = row.try_get("id").unwrap_or(0);

    // Audit log (best-effort)
    let _ = sqlx::query(
        r#"
        INSERT INTO etablissement_blocs_audit
            (etablissement_id, type_bloc, action, user_id, diff_json)
        VALUES ($1, $2, 'update', $3, $4)
        "#,
    )
    .bind(etab_id)
    .bind(&type_bloc)
    .bind(user_id)
    .bind(json!({
        "titre": payload.titre,
        "contenu_json": payload.contenu_json,
        "is_active": is_active,
    }))
    .execute(&state.pg)
    .await;

    Ok((
        StatusCode::OK,
        Json(json!({ "ok": true, "bloc_id": bloc_id })),
    ))
}

/// POST /api/v2/admin/etablissement/{id}/publier
/// Publie la page établissement (passe en statut 'published' ou 'pending'
/// selon politique de modération).
pub async fn publier_page(
    State(state): State<Arc<AppState>>,
    Path(etab_id): Path<i32>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    require_etab_admin(&state, user_id, etab_id).await?;

    // Politique actuelle : publication directe (modération a posteriori).
    // En cas d'abus, YUKPO peut suspendre via l'endpoint dédié.
    let row = sqlx::query(
        r#"
        UPDATE etablissements_scolaires
        SET page_status = 'published',
            page_published_at = COALESCE(page_published_at, NOW()),
            updated_at = NOW()
        WHERE id = $1
        RETURNING slug, page_status
        "#,
    )
    .bind(etab_id)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| AppError::Database(format!("publier_page: {}", e)))?;

    use sqlx::Row;
    let slug: Option<String> = row.try_get("slug").ok().flatten();

    Ok((
        StatusCode::OK,
        Json(json!({
            "ok": true,
            "slug": slug,
            "url_publique": slug.as_ref().map(|s| format!("/ecole/{}", s)),
        })),
    ))
}

/// POST /api/v2/admin/etablissement/{id}/annonces
/// Publication d'une annonce sur le tableau d'affichage.
pub async fn create_annonce(
    State(state): State<Arc<AppState>>,
    Path(etab_id): Path<i32>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,

    Json(payload): Json<CreateAnnoncePayload>,
) -> AppResult<impl IntoResponse> {
    require_etab_admin(&state, user_id, etab_id).await?;

    if payload.titre.trim().is_empty() || payload.contenu.trim().is_empty() {
        return Err(AppError::BadRequest(
            "Le titre et le contenu sont requis".to_string(),
        ));
    }

    let row = sqlx::query(
        r#"
        INSERT INTO etablissement_annonces
            (etablissement_id, titre, contenu, image_url, is_pinned,
             expires_at, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
        "#,
    )
    .bind(etab_id)
    .bind(&payload.titre)
    .bind(&payload.contenu)
    .bind(&payload.image_url)
    .bind(payload.is_pinned.unwrap_or(false))
    .bind(payload.expires_at)
    .bind(user_id)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| AppError::Database(format!("create_annonce: {}", e)))?;

    use sqlx::Row;
    let annonce_id: i32 = row.try_get("id").unwrap_or(0);

    Ok((
        StatusCode::OK,
        Json(json!({ "ok": true, "annonce_id": annonce_id })),
    ))
}

/// DELETE /api/v2/admin/etablissement/{id}/annonces/{annonce_id}
pub async fn delete_annonce(
    State(state): State<Arc<AppState>>,
    Path((etab_id, annonce_id)): Path<(i32, i32)>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    require_etab_admin(&state, user_id, etab_id).await?;

    sqlx::query("DELETE FROM etablissement_annonces WHERE id = $1 AND etablissement_id = $2")
        .bind(annonce_id)
        .bind(etab_id)
        .execute(&state.pg)
        .await
        .map_err(|e| AppError::Database(format!("delete_annonce: {}", e)))?;

    Ok((StatusCode::OK, Json(json!({ "ok": true }))))
}

/// POST /api/v2/admin/etablissement/{id}/evenements
pub async fn create_evenement(
    State(state): State<Arc<AppState>>,
    Path(etab_id): Path<i32>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,

    Json(payload): Json<CreateEvenementPayload>,
) -> AppResult<impl IntoResponse> {
    require_etab_admin(&state, user_id, etab_id).await?;

    if payload.titre.trim().is_empty() {
        return Err(AppError::BadRequest("Le titre est requis".to_string()));
    }

    let row = sqlx::query(
        r#"
        INSERT INTO etablissement_evenements
            (etablissement_id, titre, description, type_event, date_debut,
             date_fin, classe_concernee, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
        "#,
    )
    .bind(etab_id)
    .bind(&payload.titre)
    .bind(&payload.description)
    .bind(&payload.type_event)
    .bind(payload.date_debut)
    .bind(payload.date_fin)
    .bind(&payload.classe_concernee)
    .bind(user_id)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| AppError::Database(format!("create_evenement: {}", e)))?;

    use sqlx::Row;
    let event_id: i32 = row.try_get("id").unwrap_or(0);

    Ok((
        StatusCode::OK,
        Json(json!({ "ok": true, "evenement_id": event_id })),
    ))
}

/// DELETE /api/v2/admin/etablissement/{id}/evenements/{event_id}
pub async fn delete_evenement(
    State(state): State<Arc<AppState>>,
    Path((etab_id, event_id)): Path<(i32, i32)>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    require_etab_admin(&state, user_id, etab_id).await?;

    sqlx::query("DELETE FROM etablissement_evenements WHERE id = $1 AND etablissement_id = $2")
        .bind(event_id)
        .bind(etab_id)
        .execute(&state.pg)
        .await
        .map_err(|e| AppError::Database(format!("delete_evenement: {}", e)))?;

    Ok((StatusCode::OK, Json(json!({ "ok": true }))))
}

// Endpoint bootstrap_promote_self supprimé après usage initial (2026-05-07).

/// POST /api/v2/admin/etablissement/{id}/claim
/// Permet à un utilisateur ADMIN (ou super_admin) de devenir gérant d'un
/// établissement existant pour effectuer les tests. Réservé aux admins.
pub async fn claim_etablissement(
    State(state): State<Arc<AppState>>,
    Path(etab_id): Path<i32>,
    Extension(AuthenticatedUser { id: user_id, role }): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    let role_lower = role.to_lowercase();
    if !["admin", "super_admin", "superadmin"].contains(&role_lower.as_str()) {
        return Err(AppError::Forbidden(
            "Seuls les administrateurs peuvent réclamer la gestion d'un établissement".to_string(),
        ));
    }

    let row = sqlx::query(
        r#"
        UPDATE etablissements_scolaires
        SET gerant_user_id = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING id, nom_etablissement, slug, page_status
        "#,
    )
    .bind(user_id)
    .bind(etab_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| AppError::Database(format!("claim_etablissement: {}", e)))?;

    let row =
        row.ok_or_else(|| AppError::NotFound(format!("Établissement #{} introuvable", etab_id)))?;

    use sqlx::Row;
    Ok((
        StatusCode::OK,
        Json(json!({
            "ok": true,
            "etablissement_id": row.try_get::<i32, _>("id").unwrap_or(0),
            "nom_etablissement": row.try_get::<String, _>("nom_etablissement").unwrap_or_default(),
            "slug": row.try_get::<Option<String>, _>("slug").ok().flatten(),
            "page_status": row.try_get::<String, _>("page_status").unwrap_or_default(),
        })),
    ))
}

/// POST /api/v2/admin/etablissement/create-demo
/// Crée un établissement de démo pour tests admin (avec slug auto + page brouillon).
/// Réservé aux admins.
#[derive(Debug, Deserialize)]
pub struct CreateDemoEtabPayload {
    pub nom_etablissement: String,
    pub ville: Option<String>,
    pub quartier: Option<String>,
    pub type_etablissement: Option<String>,
}

pub async fn create_demo_etablissement(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, role }): Extension<AuthenticatedUser>,
    Json(payload): Json<CreateDemoEtabPayload>,
) -> AppResult<impl IntoResponse> {
    let role_lower = role.to_lowercase();
    if !["admin", "super_admin", "superadmin"].contains(&role_lower.as_str()) {
        return Err(AppError::Forbidden(
            "Seuls les administrateurs peuvent créer un établissement de démo".to_string(),
        ));
    }

    if payload.nom_etablissement.trim().is_empty() {
        return Err(AppError::BadRequest("Le nom est requis".to_string()));
    }

    // Récupère le premier service de l'admin (FK obligatoire vers services)
    let service_id: Option<i32> =
        sqlx::query_scalar("SELECT id FROM services WHERE user_id = $1 ORDER BY id ASC LIMIT 1")
            .bind(user_id)
            .fetch_optional(&state.pg)
            .await
            .map_err(|e| AppError::Database(format!("create_demo find service: {}", e)))?;

    let service_id = service_id.ok_or_else(|| {
        AppError::BadRequest(
            "L'admin doit avoir au moins un service créé pour rattacher l'établissement de démo"
                .to_string(),
        )
    })?;

    let type_etab = payload.type_etablissement.clone().unwrap_or_else(|| "secondaire".to_string());
    let ville = payload.ville.clone().unwrap_or_else(|| "Douala".to_string());
    let quartier = payload.quartier.clone();

    let row = sqlx::query(
        r#"
        INSERT INTO etablissements_scolaires
            (service_id, user_id, gerant_user_id, nom_etablissement,
             type_etablissement, ville, quartier, page_status, page_published_at,
             slug, created_at, updated_at)
        VALUES ($1, $2, $2, $3, $4, $5, $6, 'published', NOW(),
                etab_slugify($3) || '-demo-' || extract(epoch from NOW())::bigint::text,
                NOW(), NOW())
        RETURNING id, slug, nom_etablissement
        "#,
    )
    .bind(service_id)
    .bind(user_id)
    .bind(&payload.nom_etablissement)
    .bind(&type_etab)
    .bind(&ville)
    .bind(&quartier)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| AppError::Database(format!("create_demo insert: {}", e)))?;

    use sqlx::Row;
    Ok((
        StatusCode::OK,
        Json(json!({
            "ok": true,
            "etablissement_id": row.try_get::<i32, _>("id").unwrap_or(0),
            "slug": row.try_get::<Option<String>, _>("slug").ok().flatten(),
            "nom_etablissement": row.try_get::<String, _>("nom_etablissement").unwrap_or_default(),
        })),
    ))
}

/// GET /api/v2/admin/etablissement/{id}/stats
/// Statistiques d'audience parents pour le dashboard école.
pub async fn get_stats(
    State(state): State<Arc<AppState>>,
    Path(etab_id): Path<i32>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    require_etab_admin(&state, user_id, etab_id).await?;

    let stats = sqlx::query(
        r#"
        SELECT
            COALESCE(SUM(visites), 0)::BIGINT AS total_visites,
            COALESCE(SUM(visiteurs_unq), 0)::BIGINT AS total_visiteurs_unq,
            COALESCE(SUM(clics_commande), 0)::BIGINT AS total_clics_commande,
            COALESCE(SUM(clics_infos), 0)::BIGINT AS total_clics_infos
        FROM etablissement_visites
        WHERE etablissement_id = $1
          AND date >= CURRENT_DATE - INTERVAL '30 days'
        "#,
    )
    .bind(etab_id)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| AppError::Database(format!("get_stats: {}", e)))?;

    use sqlx::Row;
    Ok((
        StatusCode::OK,
        Json(json!({
            "total_visites_30d": stats.try_get::<i64, _>("total_visites").unwrap_or(0),
            "total_visiteurs_unq_30d": stats.try_get::<i64, _>("total_visiteurs_unq").unwrap_or(0),
            "total_clics_commande_30d": stats.try_get::<i64, _>("total_clics_commande").unwrap_or(0),
            "total_clics_infos_30d": stats.try_get::<i64, _>("total_clics_infos").unwrap_or(0),
        })),
    ))
}
