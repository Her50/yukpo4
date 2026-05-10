// ✅ Contrôleur Listes scolaires (programmes) — espace admin établissement
// Date : 2026-05-10
//
// Couvre :
//   - PUT  /api/v2/admin/etablissement/{id}/config   → maj nom_abrege/systeme/cycles
//   - GET  /api/v2/admin/etablissement/{id}/programmes/preload-sources
//   - POST /api/v2/admin/etablissement/{id}/programmes/preload
//   - GET  /api/v2/admin/etablissement/{id}/programmes
//   - POST /api/v2/admin/etablissement/{id}/programmes      (upsert article)
//   - PATCH /api/v2/admin/etablissement/{id}/programmes/{prog_id}
//   - DELETE /api/v2/admin/etablissement/{id}/programmes/{prog_id}
//
// Le but : permettre au directeur d'école de saisir/charger sa liste scolaire
// rapidement (préchargement programme national, année précédente, ou copie
// depuis un autre établissement similaire) puis d'ajuster.

use crate::core::types::{AppError, AppResult};
use crate::middlewares::jwt::AuthenticatedUser;
use crate::state::AppState;
use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;

// ============================================================================
// Helpers
// ============================================================================

/// Vérifie que l'utilisateur est gérant de l'établissement (gerant_user_id ou user_id).
async fn require_admin(state: &AppState, user_id: i32, etab_id: i32) -> AppResult<()> {
    let ok: bool = sqlx::query_scalar::<_, bool>(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM etablissements_scolaires
            WHERE id = $1 AND (gerant_user_id = $2 OR user_id = $2)
        )
        "#,
    )
    .bind(etab_id)
    .bind(user_id)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| AppError::Database(format!("require_admin: {}", e)))?;
    if !ok {
        return Err(AppError::Forbidden(
            "Vous n'êtes pas administrateur de cet établissement".into(),
        ));
    }
    Ok(())
}

const ALLOWED_SYSTEMES: [&str; 3] = ["francophone", "anglophone", "bilingue"];

const ALLOWED_CYCLES: [&str; 7] = [
    "maternelle",
    "primaire",
    "college",
    "lycee",
    "technique",
    "professionnelle",
    "superieur",
];

const ALLOWED_TYPE_ARTICLE: [&str; 5] = ["livre", "workbook", "cahier", "fourniture", "accessoire"];

// ============================================================================
// Config établissement (nom_abrege, systeme_scolaire, cycles_offerts)
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct UpdateConfigPayload {
    pub nom_etablissement: Option<String>,
    pub nom_abrege: Option<String>,
    pub systeme_scolaire: Option<String>,
    pub cycles_offerts: Option<Vec<String>>,
    pub type_etablissement: Option<String>,
    pub pays: Option<String>,
    pub ville: Option<String>,
    pub quartier: Option<String>,
}

/// PUT /api/v2/admin/etablissement/{id}/config
pub async fn update_config(
    State(state): State<Arc<AppState>>,
    Path(etab_id): Path<i32>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<UpdateConfigPayload>,
) -> AppResult<impl IntoResponse> {
    require_admin(&state, user_id, etab_id).await?;

    if let Some(s) = &payload.systeme_scolaire {
        if !ALLOWED_SYSTEMES.contains(&s.as_str()) {
            return Err(AppError::BadRequest(format!(
                "systeme_scolaire invalide: '{}'. Attendu: {:?}",
                s, ALLOWED_SYSTEMES
            )));
        }
    }
    if let Some(cycles) = &payload.cycles_offerts {
        for c in cycles {
            if !ALLOWED_CYCLES.contains(&c.as_str()) {
                return Err(AppError::BadRequest(format!(
                    "Cycle inconnu: '{}'. Attendus: {:?}",
                    c, ALLOWED_CYCLES
                )));
            }
        }
    }

    sqlx::query(
        r#"
        UPDATE etablissements_scolaires
        SET nom_etablissement   = COALESCE($2, nom_etablissement),
            nom_abrege          = COALESCE($3, nom_abrege),
            systeme_scolaire    = COALESCE($4, systeme_scolaire),
            cycles_offerts      = COALESCE($5, cycles_offerts),
            type_etablissement  = COALESCE($6, type_etablissement),
            pays                = COALESCE($7, pays),
            ville               = COALESCE($8, ville),
            quartier            = COALESCE($9, quartier),
            updated_at          = NOW()
        WHERE id = $1
        "#,
    )
    .bind(etab_id)
    .bind(payload.nom_etablissement.as_deref())
    .bind(payload.nom_abrege.as_deref())
    .bind(payload.systeme_scolaire.as_deref())
    .bind(payload.cycles_offerts.as_deref())
    .bind(payload.type_etablissement.as_deref())
    .bind(payload.pays.as_deref())
    .bind(payload.ville.as_deref())
    .bind(payload.quartier.as_deref())
    .execute(&state.pg)
    .await
    .map_err(|e| AppError::Database(format!("update_config: {}", e)))?;

    Ok((StatusCode::OK, Json(json!({ "ok": true }))))
}

// ============================================================================
// Sources de préchargement de la liste scolaire
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct PreloadSourcesQuery {
    /// Année cible pour laquelle on cherche des sources. Sert à exclure
    /// l'année cible de la liste "années précédentes".
    pub target_annee: Option<String>,
}

#[derive(Debug, Serialize)]
struct SimilarEtab {
    id: i32,
    nom_etablissement: String,
    nom_abrege: Option<String>,
    ville: Option<String>,
    pays: String,
    systeme_scolaire: Option<String>,
    nb_articles: i64,
}

#[derive(Debug, Serialize)]
struct NationalSource {
    etablissement_id: i32,
    nom_etablissement: String,
    pays: String,
    nb_articles: i64,
}

#[derive(Debug, Serialize)]
struct PreloadSourcesResponse {
    /// Années pour lesquelles l'établissement a déjà saisi des programmes
    /// (hors année cible si fournie). Ordre : plus récente d'abord.
    previous_years: Vec<String>,
    /// Programme national officiel disponible pour le pays courant.
    national: Option<NationalSource>,
    /// Établissements similaires (même pays + système) ayant des programmes.
    similar_etabs: Vec<SimilarEtab>,
}

/// GET /api/v2/admin/etablissement/{id}/programmes/preload-sources?target_annee=2026-2027
pub async fn preload_sources(
    State(state): State<Arc<AppState>>,
    Path(etab_id): Path<i32>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Query(q): Query<PreloadSourcesQuery>,
) -> AppResult<impl IntoResponse> {
    require_admin(&state, user_id, etab_id).await?;

    // Récupère pays + systeme du courant pour matcher les établissements similaires
    let (pays, systeme): (Option<String>, Option<String>) = sqlx::query_as(
        r#"SELECT pays, systeme_scolaire FROM etablissements_scolaires WHERE id = $1"#,
    )
    .bind(etab_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| AppError::Database(format!("preload_sources: meta: {}", e)))?
    .unwrap_or((None, None));

    let pays_code = pays.unwrap_or_else(|| "CM".to_string());

    // 1. Années précédentes (chez le même établissement) — ordre desc
    use sqlx::Row;
    let target = q.target_annee.unwrap_or_default();
    let years_rows = sqlx::query(
        r#"
        SELECT DISTINCT annee_scolaire
        FROM programmes_scolaires
        WHERE etablissement_id = $1
          AND is_active = true
          AND annee_scolaire IS NOT NULL
          AND annee_scolaire <> ''
          AND ($2 = '' OR annee_scolaire <> $2)
        ORDER BY annee_scolaire DESC
        LIMIT 10
        "#,
    )
    .bind(etab_id)
    .bind(&target)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| AppError::Database(format!("preload_sources: years: {}", e)))?;

    let previous_years: Vec<String> = years_rows
        .into_iter()
        .filter_map(|r| r.try_get::<String, _>("annee_scolaire").ok())
        .collect();

    // 2. Programme national officiel pour le pays
    let national: Option<NationalSource> = sqlx::query(
        r#"
        SELECT e.id, e.nom_etablissement, e.pays,
               COALESCE((
                   SELECT COUNT(*)::bigint FROM programmes_scolaires p
                   WHERE p.etablissement_id = e.id AND p.is_active = true
               ), 0) AS nb_articles
        FROM etablissements_scolaires e
        WHERE e.pays = $1 AND e.is_national = true AND e.is_active = true
        LIMIT 1
        "#,
    )
    .bind(&pays_code)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| AppError::Database(format!("preload_sources: national: {}", e)))?
    .map(|r| NationalSource {
        etablissement_id: r.try_get("id").unwrap_or(0),
        nom_etablissement: r.try_get("nom_etablissement").unwrap_or_default(),
        pays: r.try_get("pays").unwrap_or_default(),
        nb_articles: r.try_get("nb_articles").unwrap_or(0),
    });

    // 3. Établissements similaires : même pays + même système (s'il existe),
    //    ayant déjà des programmes.
    let similar_rows = sqlx::query(
        r#"
        SELECT e.id, e.nom_etablissement, e.nom_abrege, e.ville, e.pays, e.systeme_scolaire,
               (SELECT COUNT(*)::bigint FROM programmes_scolaires p
                WHERE p.etablissement_id = e.id AND p.is_active = true) AS nb_articles
        FROM etablissements_scolaires e
        WHERE e.id <> $1
          AND e.is_active = true
          AND e.is_national = false
          AND e.pays = $2
          AND ($3::text IS NULL OR e.systeme_scolaire = $3 OR e.systeme_scolaire = 'bilingue')
          AND EXISTS (
              SELECT 1 FROM programmes_scolaires p
              WHERE p.etablissement_id = e.id AND p.is_active = true
          )
        ORDER BY nb_articles DESC, e.nom_etablissement ASC
        LIMIT 5
        "#,
    )
    .bind(etab_id)
    .bind(&pays_code)
    .bind(systeme.as_deref())
    .fetch_all(&state.pg)
    .await
    .map_err(|e| AppError::Database(format!("preload_sources: similar: {}", e)))?;

    let similar_etabs: Vec<SimilarEtab> = similar_rows
        .into_iter()
        .map(|r| SimilarEtab {
            id: r.try_get("id").unwrap_or(0),
            nom_etablissement: r.try_get("nom_etablissement").unwrap_or_default(),
            nom_abrege: r.try_get("nom_abrege").ok(),
            ville: r.try_get("ville").ok(),
            pays: r.try_get("pays").unwrap_or_default(),
            systeme_scolaire: r.try_get("systeme_scolaire").ok(),
            nb_articles: r.try_get("nb_articles").unwrap_or(0),
        })
        .collect();

    Ok((
        StatusCode::OK,
        Json(PreloadSourcesResponse {
            previous_years,
            national,
            similar_etabs,
        }),
    ))
}

// ============================================================================
// Préchargement
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct PreloadPayload {
    /// 'previous_year' | 'national' | 'etablissement'
    pub source: String,
    /// Si source = 'etablissement' : id de l'établissement source
    pub source_etab_id: Option<i32>,
    /// Si source = 'previous_year' : année source dans MON établissement
    pub source_annee: Option<String>,
    /// Année cible (obligatoire) — destination
    pub target_annee: String,
    /// Mode : 'merge' (n'écrase pas les articles existants — défaut) | 'replace'
    #[serde(default)]
    pub mode: Option<String>,
    /// Optionnel : restreindre à certaines classes (sinon toutes)
    pub classes: Option<Vec<String>>,
    /// Optionnel : restreindre à certains niveaux (ex: ['Primaire','Collège']).
    /// Évite de copier des classes hors des cycles offerts par l'établissement.
    pub niveaux: Option<Vec<String>>,
    /// Optionnel : restreindre à certains types ('livre','cahier',...)
    pub type_articles: Option<Vec<String>>,
}

#[derive(Debug, Serialize)]
pub struct PreloadResponse {
    pub copied: i64,
    pub skipped_existing: i64,
    pub source_total: i64,
}

/// POST /api/v2/admin/etablissement/{id}/programmes/preload
pub async fn preload(
    State(state): State<Arc<AppState>>,
    Path(etab_id): Path<i32>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<PreloadPayload>,
) -> AppResult<impl IntoResponse> {
    require_admin(&state, user_id, etab_id).await?;

    if payload.target_annee.trim().is_empty() {
        return Err(AppError::BadRequest("target_annee requis".into()));
    }

    let mode = payload.mode.as_deref().unwrap_or("merge");
    if mode != "merge" && mode != "replace" {
        return Err(AppError::BadRequest(
            "mode doit être 'merge' ou 'replace'".into(),
        ));
    }

    // Identifie la source (etablissement_id_source, annee_source)
    let (source_etab_id, source_annee): (Option<i32>, Option<String>) =
        match payload.source.as_str() {
            "previous_year" => {
                let annee = payload
                    .source_annee
                    .ok_or_else(|| AppError::BadRequest("source_annee requis".into()))?;
                (Some(etab_id), Some(annee))
            }
            "national" => {
                // Récupère le pays courant + l'établissement national
                let pays: String = sqlx::query_scalar::<_, String>(
                    r#"SELECT pays FROM etablissements_scolaires WHERE id = $1"#,
                )
                .bind(etab_id)
                .fetch_one(&state.pg)
                .await
                .map_err(|e| AppError::Database(format!("preload: pays: {}", e)))?;
                let nat_id: Option<i32> = sqlx::query_scalar::<_, i32>(
                    r#"SELECT id FROM etablissements_scolaires
                   WHERE pays = $1 AND is_national = true AND is_active = true LIMIT 1"#,
                )
                .bind(&pays)
                .fetch_optional(&state.pg)
                .await
                .map_err(|e| AppError::Database(format!("preload: nat_id: {}", e)))?;
                let nat_id = nat_id.ok_or_else(|| {
                    AppError::NotFound(format!(
                        "Aucun programme national actif pour le pays '{}'",
                        pays
                    ))
                })?;
                (Some(nat_id), payload.source_annee.clone())
            }
            "etablissement" => {
                let src = payload
                    .source_etab_id
                    .ok_or_else(|| AppError::BadRequest("source_etab_id requis".into()))?;
                (Some(src), payload.source_annee.clone())
            }
            other => {
                return Err(AppError::BadRequest(format!(
                    "source inconnue: '{}' (attendu: previous_year | national | etablissement)",
                    other
                )))
            }
        };

    // Compte la source
    let source_total: i64 = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COUNT(*)::bigint FROM programmes_scolaires
        WHERE etablissement_id = $1
          AND is_active = true
          AND ($2::text IS NULL OR annee_scolaire = $2)
          AND ($3::text[] IS NULL OR classe = ANY($3))
          AND ($4::text[] IS NULL OR type_article = ANY($4))
          AND ($5::text[] IS NULL OR niveau = ANY($5))
        "#,
    )
    .bind(source_etab_id)
    .bind(source_annee.as_deref())
    .bind(payload.classes.as_deref())
    .bind(payload.type_articles.as_deref())
    .bind(payload.niveaux.as_deref())
    .fetch_one(&state.pg)
    .await
    .map_err(|e| AppError::Database(format!("preload: source_total: {}", e)))?;

    if source_total == 0 {
        return Ok((
            StatusCode::OK,
            Json(PreloadResponse {
                copied: 0,
                skipped_existing: 0,
                source_total: 0,
            }),
        ));
    }

    let mut tx = state
        .pg
        .begin()
        .await
        .map_err(|e| AppError::Database(format!("preload: tx: {}", e)))?;

    // Mode replace : on désactive les programmes existants pour la cible
    if mode == "replace" {
        sqlx::query(
            r#"
            UPDATE programmes_scolaires
            SET is_active = false, updated_at = NOW()
            WHERE etablissement_id = $1
              AND annee_scolaire = $2
              AND is_active = true
            "#,
        )
        .bind(etab_id)
        .bind(&payload.target_annee)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("preload: replace clean: {}", e)))?;
    }

    // INSERT en bloc : copie source → cible, ne réécrit pas si déjà existant
    // (clé fonctionnelle : titre_livre + classe + matiere + type_article + annee_scolaire).
    let copied: i64 = sqlx::query_scalar::<_, i64>(
        r#"
        WITH inserted AS (
            INSERT INTO programmes_scolaires (
                pays, systeme_educatif, niveau, classe, matiere, titre_livre,
                auteur_livre, editeur_livre, isbn_livre, annee_scolaire,
                est_obligatoire, keywords, prix_officiel, devise,
                type_article, quantite_defaut,
                etablissement_id, created_by, is_active, created_at, updated_at
            )
            SELECT
                src.pays, src.systeme_educatif, src.niveau, src.classe, src.matiere, src.titre_livre,
                src.auteur_livre, src.editeur_livre, src.isbn_livre, $3,
                src.est_obligatoire, src.keywords, src.prix_officiel, src.devise,
                src.type_article, src.quantite_defaut,
                $2, $4, true, NOW(), NOW()
            FROM programmes_scolaires src
            WHERE src.etablissement_id = $1
              AND src.is_active = true
              AND ($5::text IS NULL OR src.annee_scolaire = $5)
              AND ($6::text[] IS NULL OR src.classe = ANY($6))
              AND ($7::text[] IS NULL OR src.type_article = ANY($7))
              AND ($8::text[] IS NULL OR src.niveau = ANY($8))
              AND NOT EXISTS (
                SELECT 1 FROM programmes_scolaires dst
                WHERE dst.etablissement_id = $2
                  AND dst.annee_scolaire = $3
                  AND dst.is_active = true
                  AND dst.classe IS NOT DISTINCT FROM src.classe
                  AND dst.matiere IS NOT DISTINCT FROM src.matiere
                  AND dst.titre_livre IS NOT DISTINCT FROM src.titre_livre
                  AND dst.type_article IS NOT DISTINCT FROM src.type_article
              )
            RETURNING 1
        )
        SELECT COUNT(*)::bigint FROM inserted
        "#,
    )
    .bind(source_etab_id)
    .bind(etab_id)
    .bind(&payload.target_annee)
    .bind(user_id)
    .bind(source_annee.as_deref())
    .bind(payload.classes.as_deref())
    .bind(payload.type_articles.as_deref())
    .bind(payload.niveaux.as_deref())
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| AppError::Database(format!("preload: insert: {}", e)))?;

    tx.commit()
        .await
        .map_err(|e| AppError::Database(format!("preload: commit: {}", e)))?;

    let skipped_existing = (source_total - copied).max(0);

    Ok((
        StatusCode::OK,
        Json(PreloadResponse {
            copied,
            skipped_existing,
            source_total,
        }),
    ))
}

// ============================================================================
// CRUD programmes admin
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct ListProgrammesQuery {
    pub annee: Option<String>,
    pub classe: Option<String>,
    pub type_article: Option<String>,
}

/// GET /api/v2/admin/etablissement/{id}/programmes?annee=YYYY-YYYY
pub async fn list_programmes(
    State(state): State<Arc<AppState>>,
    Path(etab_id): Path<i32>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Query(q): Query<ListProgrammesQuery>,
) -> AppResult<impl IntoResponse> {
    require_admin(&state, user_id, etab_id).await?;

    use sqlx::Row;
    let rows = sqlx::query(
        r#"
        SELECT id, niveau, classe, matiere, titre_livre,
               auteur_livre, editeur_livre, isbn_livre, annee_scolaire,
               est_obligatoire,
               prix_officiel::float8 AS prix_officiel,
               devise, type_article, quantite_defaut, systeme_educatif, pays
        FROM programmes_scolaires
        WHERE etablissement_id = $1
          AND is_active = true
          AND ($2::text IS NULL OR annee_scolaire = $2)
          AND ($3::text IS NULL OR classe = $3)
          AND ($4::text IS NULL OR type_article = $4)
        ORDER BY classe ASC, type_article ASC, matiere ASC, titre_livre ASC
        "#,
    )
    .bind(etab_id)
    .bind(q.annee.as_deref())
    .bind(q.classe.as_deref())
    .bind(q.type_article.as_deref())
    .fetch_all(&state.pg)
    .await
    .map_err(|e| AppError::Database(format!("list_programmes: {}", e)))?;

    let programmes: Vec<Value> = rows
        .into_iter()
        .map(|r| {
            json!({
                "id":              r.try_get::<i32, _>("id").ok(),
                "niveau":          r.try_get::<String, _>("niveau").ok(),
                "classe":          r.try_get::<String, _>("classe").ok(),
                "matiere":         r.try_get::<String, _>("matiere").ok(),
                "titre_livre":     r.try_get::<String, _>("titre_livre").ok(),
                "auteur_livre":    r.try_get::<Option<String>, _>("auteur_livre").ok().flatten(),
                "editeur_livre":   r.try_get::<Option<String>, _>("editeur_livre").ok().flatten(),
                "isbn_livre":      r.try_get::<Option<String>, _>("isbn_livre").ok().flatten(),
                "annee_scolaire":  r.try_get::<Option<String>, _>("annee_scolaire").ok().flatten(),
                "est_obligatoire": r.try_get::<Option<bool>, _>("est_obligatoire").ok().flatten(),
                "prix_officiel":   r.try_get::<Option<f64>, _>("prix_officiel").ok().flatten(),
                "devise":          r.try_get::<Option<String>, _>("devise").ok().flatten(),
                "type_article":    r.try_get::<String, _>("type_article").ok(),
                "quantite_defaut": r.try_get::<i32, _>("quantite_defaut").ok(),
                "systeme_educatif":r.try_get::<String, _>("systeme_educatif").ok(),
                "pays":            r.try_get::<Option<String>, _>("pays").ok().flatten(),
            })
        })
        .collect();

    Ok((StatusCode::OK, Json(json!({ "programmes": programmes }))))
}

#[derive(Debug, Deserialize)]
pub struct UpsertArticlePayload {
    pub niveau: String,
    pub classe: String,
    pub matiere: Option<String>,
    pub titre_livre: String,
    pub auteur_livre: Option<String>,
    pub editeur_livre: Option<String>,
    pub isbn_livre: Option<String>,
    pub annee_scolaire: String,
    pub est_obligatoire: Option<bool>,
    pub prix_officiel: Option<f64>,
    pub devise: Option<String>,
    pub type_article: Option<String>,
    pub quantite_defaut: Option<i32>,
    pub systeme_educatif: Option<String>,
    pub pays: Option<String>,
}

/// POST /api/v2/admin/etablissement/{id}/programmes
/// Crée un article de la liste scolaire pour l'établissement.
pub async fn create_article(
    State(state): State<Arc<AppState>>,
    Path(etab_id): Path<i32>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(p): Json<UpsertArticlePayload>,
) -> AppResult<impl IntoResponse> {
    require_admin(&state, user_id, etab_id).await?;

    let type_article = p.type_article.unwrap_or_else(|| "livre".to_string());
    if !ALLOWED_TYPE_ARTICLE.contains(&type_article.as_str()) {
        return Err(AppError::BadRequest(format!(
            "type_article invalide: '{}'. Attendu: {:?}",
            type_article, ALLOWED_TYPE_ARTICLE
        )));
    }

    let prix: Option<rust_decimal::Decimal> =
        p.prix_officiel.and_then(rust_decimal::Decimal::from_f64_retain);

    let id: i32 = sqlx::query_scalar::<_, i32>(
        r#"
        INSERT INTO programmes_scolaires (
            pays, systeme_educatif, niveau, classe, matiere, titre_livre,
            auteur_livre, editeur_livre, isbn_livre, annee_scolaire,
            est_obligatoire, prix_officiel, devise,
            type_article, quantite_defaut,
            etablissement_id, created_by, is_active, created_at, updated_at
        )
        VALUES (
            COALESCE($1, 'CM'), COALESCE($2, 'francophone'), $3, $4, $5, $6,
            $7, $8, $9, $10, COALESCE($11, true), $12, COALESCE($13, 'XAF'),
            $14, COALESCE($15, 1),
            $16, $17, true, NOW(), NOW()
        )
        RETURNING id
        "#,
    )
    .bind(p.pays.as_deref())
    .bind(p.systeme_educatif.as_deref())
    .bind(&p.niveau)
    .bind(&p.classe)
    .bind(p.matiere.as_deref().unwrap_or(""))
    .bind(&p.titre_livre)
    .bind(p.auteur_livre.as_deref())
    .bind(p.editeur_livre.as_deref())
    .bind(p.isbn_livre.as_deref())
    .bind(&p.annee_scolaire)
    .bind(p.est_obligatoire)
    .bind(prix)
    .bind(p.devise.as_deref())
    .bind(&type_article)
    .bind(p.quantite_defaut)
    .bind(etab_id)
    .bind(user_id)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| AppError::Database(format!("create_article: {}", e)))?;

    Ok((StatusCode::CREATED, Json(json!({ "id": id }))))
}

#[derive(Debug, Deserialize)]
pub struct PatchArticlePayload {
    pub niveau: Option<String>,
    pub classe: Option<String>,
    pub matiere: Option<String>,
    pub titre_livre: Option<String>,
    pub auteur_livre: Option<String>,
    pub editeur_livre: Option<String>,
    pub isbn_livre: Option<String>,
    pub annee_scolaire: Option<String>,
    pub est_obligatoire: Option<bool>,
    pub prix_officiel: Option<f64>,
    pub devise: Option<String>,
    pub type_article: Option<String>,
    pub quantite_defaut: Option<i32>,
}

/// PATCH /api/v2/admin/etablissement/{id}/programmes/{prog_id}
pub async fn patch_article(
    State(state): State<Arc<AppState>>,
    Path((etab_id, prog_id)): Path<(i32, i32)>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(p): Json<PatchArticlePayload>,
) -> AppResult<impl IntoResponse> {
    require_admin(&state, user_id, etab_id).await?;

    if let Some(t) = &p.type_article {
        if !ALLOWED_TYPE_ARTICLE.contains(&t.as_str()) {
            return Err(AppError::BadRequest(format!(
                "type_article invalide: '{}'",
                t
            )));
        }
    }

    let prix: Option<rust_decimal::Decimal> =
        p.prix_officiel.and_then(rust_decimal::Decimal::from_f64_retain);

    let res = sqlx::query(
        r#"
        UPDATE programmes_scolaires
        SET niveau          = COALESCE($3, niveau),
            classe          = COALESCE($4, classe),
            matiere         = COALESCE($5, matiere),
            titre_livre     = COALESCE($6, titre_livre),
            auteur_livre    = COALESCE($7, auteur_livre),
            editeur_livre   = COALESCE($8, editeur_livre),
            isbn_livre      = COALESCE($9, isbn_livre),
            annee_scolaire  = COALESCE($10, annee_scolaire),
            est_obligatoire = COALESCE($11, est_obligatoire),
            prix_officiel   = COALESCE($12, prix_officiel),
            devise          = COALESCE($13, devise),
            type_article    = COALESCE($14, type_article),
            quantite_defaut = COALESCE($15, quantite_defaut),
            updated_at      = NOW()
        WHERE id = $1 AND etablissement_id = $2 AND is_active = true
        "#,
    )
    .bind(prog_id)
    .bind(etab_id)
    .bind(p.niveau.as_deref())
    .bind(p.classe.as_deref())
    .bind(p.matiere.as_deref())
    .bind(p.titre_livre.as_deref())
    .bind(p.auteur_livre.as_deref())
    .bind(p.editeur_livre.as_deref())
    .bind(p.isbn_livre.as_deref())
    .bind(p.annee_scolaire.as_deref())
    .bind(p.est_obligatoire)
    .bind(prix)
    .bind(p.devise.as_deref())
    .bind(p.type_article.as_deref())
    .bind(p.quantite_defaut)
    .execute(&state.pg)
    .await
    .map_err(|e| AppError::Database(format!("patch_article: {}", e)))?;

    if res.rows_affected() == 0 {
        return Err(AppError::NotFound(format!(
            "Article {} introuvable pour cet établissement",
            prog_id
        )));
    }

    Ok((StatusCode::OK, Json(json!({ "ok": true }))))
}

/// DELETE /api/v2/admin/etablissement/{id}/programmes/{prog_id}
/// Soft delete : passe is_active=false.
pub async fn delete_article(
    State(state): State<Arc<AppState>>,
    Path((etab_id, prog_id)): Path<(i32, i32)>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    require_admin(&state, user_id, etab_id).await?;

    let res = sqlx::query(
        r#"
        UPDATE programmes_scolaires
        SET is_active = false, updated_at = NOW()
        WHERE id = $1 AND etablissement_id = $2 AND is_active = true
        "#,
    )
    .bind(prog_id)
    .bind(etab_id)
    .execute(&state.pg)
    .await
    .map_err(|e| AppError::Database(format!("delete_article: {}", e)))?;

    if res.rows_affected() == 0 {
        return Err(AppError::NotFound(format!(
            "Article {} introuvable",
            prog_id
        )));
    }
    Ok((StatusCode::OK, Json(json!({ "ok": true }))))
}
