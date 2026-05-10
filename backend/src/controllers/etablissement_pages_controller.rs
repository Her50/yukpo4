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
    pub nom_abrege: Option<String>,
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
    /// Active l'expansion via IA (variantes orthographiques, sigles).
    /// Accepté en "1", "true", "yes", "on". Le front doit envoyer après
    /// debounce (≥ 300 ms) pour ne pas solliciter l'IA à chaque frappe.
    #[serde(default)]
    pub smart: Option<String>,
}

fn default_limit() -> i64 {
    10
}

fn truthy(s: &Option<String>) -> bool {
    matches!(
        s.as_deref().map(str::to_lowercase).as_deref(),
        Some("1") | Some("true") | Some("yes") | Some("on")
    )
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

/// GET /api/v2/etablissements/search?q=cbg&limit=10&smart=1
/// Autocomplete pour la barre de recherche école sur la home page parent.
///
/// Stratégie hybride :
///   1. pg_trgm tolérant aux fautes (unaccent + similarity) sur nom/sigle/quartier
///   2. Si `smart=1` ET q>=3 chars : on demande à l'IA d'élargir la requête
///      (variantes orthographiques, sigles, raccourcis populaires) — résultat
///      caché 1 h en Redis pour éviter de repayer pour les mêmes saisies.
///      Timeout court (1.5 s) avec fallback silencieux sur pg_trgm pur.
pub async fn search_etablissements(
    State(state): State<Arc<AppState>>,
    Query(params): Query<SearchEtablissementsParams>,
) -> AppResult<impl IntoResponse> {
    let q = params.q.trim();
    if q.len() < 2 {
        return Ok((StatusCode::OK, Json(json!({ "results": [] }))));
    }
    let limit = params.limit.clamp(1, 25);

    // Expansion LLM optionnelle (déclenchée par `?smart=1` côté front, après
    // debounce). Toujours sécurisée par un timeout + fallback graceful.
    let smart_enabled = truthy(&params.smart);
    let expansions: Vec<String> = if smart_enabled && q.chars().count() >= 3 {
        match tokio::time::timeout(
            std::time::Duration::from_millis(1500),
            expand_search_query_with_ia(q, &state),
        )
        .await
        {
            Ok(Ok(v)) => v,
            Ok(Err(e)) => {
                warn!(
                    "[search_etablissements] LLM expand failed (fallback pg_trgm): {}",
                    e
                );
                Vec::new()
            }
            Err(_) => {
                warn!("[search_etablissements] LLM expand timeout (fallback pg_trgm)");
                Vec::new()
            }
        }
    } else {
        Vec::new()
    };

    // Patterns ILIKE pour la requête + ses expansions LLM
    let mut patterns: Vec<String> = vec![format!("%{}%", q)];
    for e in &expansions {
        let trimmed = e.trim();
        if !trimmed.is_empty() && trimmed.len() <= 200 {
            patterns.push(format!("%{}%", trimmed));
        }
    }

    let rows = sqlx::query_as::<_, EtablissementSummary>(
        r#"
        SELECT
            e.id,
            e.nom_etablissement,
            e.nom_abrege,
            e.slug,
            e.ville,
            e.quartier,
            e.logo_url,
            e.type_etablissement
        FROM etablissements_scolaires e
        WHERE
            e.page_status = 'published'
            AND (
                -- Exact / prefix tolérant (avec unaccent quand l'extension est dispo)
                e.nom_etablissement ILIKE ANY($1)
                OR e.nom_abrege     ILIKE ANY($1)
                OR e.quartier       ILIKE ANY($1)
                -- Fuzzy match pg_trgm sur le nom complet
                OR similarity(lower(e.nom_etablissement), lower($2)) > 0.2
                -- Sigles : seuil plus haut car courts → faux positifs sinon
                OR similarity(lower(coalesce(e.nom_abrege, '')), lower($2)) > 0.4
            )
        ORDER BY
            -- Match exact sur le sigle = priorité absolue (ENAM, CBLG…)
            CASE WHEN lower(coalesce(e.nom_abrege, '')) = lower($2) THEN 0 ELSE 1 END,
            similarity(lower(e.nom_etablissement), lower($2)) DESC NULLS LAST,
            e.nom_etablissement
        LIMIT $3
        "#,
    )
    .bind(&patterns)
    .bind(q)
    .bind(limit)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| AppError::Database(format!("search_etablissements: {}", e)))?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "results": rows,
            "expansions": expansions,
        })),
    ))
}

/// Demande à l'IA des variantes orthographiques, sigles et raccourcis
/// populaires pour une requête utilisateur. Cache Redis 1 h pour amortir
/// le coût quand plusieurs parents tapent la même chose.
async fn expand_search_query_with_ia(query: &str, state: &AppState) -> Result<Vec<String>, String> {
    let cache_key = format!("etab_search_expand:v1:{}", query.to_lowercase());

    // 1. Lookup cache
    if let Some(pool) = &state.redis_pool {
        if let Ok(mut conn) = pool.get().await {
            if let Ok(cached) = deadpool_redis::redis::cmd("GET")
                .arg(&cache_key)
                .query_async::<_, String>(&mut *conn)
                .await
            {
                if let Ok(v) = serde_json::from_str::<Vec<String>>(&cached) {
                    return Ok(v);
                }
            }
        }
    }

    // 2. Appel IA — prompt minimal pour latence faible
    let prompt = format!(
        "Tu es un assistant de recherche d'écoles d'Afrique francophone et anglophone \
         (Cameroun, Côte d'Ivoire, Sénégal, Gabon, Congo, RDC, Bénin, Togo, Burkina, \
         Mali, Niger, Nigeria, Ghana). L'utilisateur recherche : « {} ». \
         Génère jusqu'à 5 variantes plausibles : orthographe alternative, sigle, \
         nom complet probable, raccourci populaire. Inclus la chaîne d'origine. \
         Réponds UNIQUEMENT par un JSON array de strings (pas de texte avant/après, \
         pas de markdown). Ex pour 'CBLG' → [\"CBLG\",\"Collège Bilingue La Gaieté\"]. \
         Ex pour 'lycee gen leclerc' → [\"Lycée Général Leclerc\",\"LGL\",\"Lycée Leclerc\"].",
        query
    );
    let (_model, response, _tokens) =
        state.ia.predict(&prompt).await.map_err(|e| format!("IA error: {:?}", e))?;

    // 3. Parse tolérant : on extrait le 1er array JSON
    let cleaned = strip_to_first_json_array(&response);
    let variants: Vec<String> = serde_json::from_str(&cleaned)
        .map_err(|e| format!("JSON parse error: {} (raw: {:.120})", e, response))?;

    // 4. Filtrage de sécurité : pas de strings absurdement longues, pas de doublons
    let mut out: Vec<String> = Vec::new();
    let q_lower = query.to_lowercase();
    for v in variants {
        let trimmed = v.trim();
        if trimmed.is_empty() || trimmed.chars().count() > 100 {
            continue;
        }
        let lc = trimmed.to_lowercase();
        if lc != q_lower && !out.iter().any(|x| x.to_lowercase() == lc) {
            out.push(trimmed.to_string());
        }
        if out.len() >= 6 {
            break;
        }
    }

    // 5. Cache 1 h
    if let Some(pool) = &state.redis_pool {
        if let Ok(mut conn) = pool.get().await {
            let json_payload = serde_json::to_string(&out).unwrap_or_else(|_| "[]".to_string());
            let _: Result<(), _> = deadpool_redis::redis::cmd("SETEX")
                .arg(&cache_key)
                .arg(3600)
                .arg(&json_payload)
                .query_async::<_, ()>(&mut *conn)
                .await;
        }
    }

    Ok(out)
}

/// Extrait la 1ère sous-chaîne JSON `[...]` équilibrée d'un texte (l'IA peut
/// préfixer/suffixer du markdown malgré l'instruction).
fn strip_to_first_json_array(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut start: Option<usize> = None;
    let mut depth: i32 = 0;
    let mut in_string = false;
    let mut escape = false;
    for (i, &b) in bytes.iter().enumerate() {
        if escape {
            escape = false;
            continue;
        }
        if in_string {
            if b == b'\\' {
                escape = true;
            } else if b == b'"' {
                in_string = false;
            }
            continue;
        }
        match b {
            b'"' => in_string = true,
            b'[' => {
                if start.is_none() {
                    start = Some(i);
                }
                depth += 1;
            }
            b']' => {
                depth -= 1;
                if depth == 0 {
                    if let Some(st) = start {
                        return s[st..=i].to_string();
                    }
                }
            }
            _ => {}
        }
    }
    s.to_string()
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
            id, nom_etablissement, nom_abrege, slug, type_etablissement,
            pays, ville, quartier, systeme_scolaire, cycles_offerts,
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
                "nom_abrege": r.try_get::<Option<String>, _>("nom_abrege").ok().flatten(),
                "slug": r.try_get::<Option<String>, _>("slug").ok().flatten(),
                "type_etablissement": r.try_get::<Option<String>, _>("type_etablissement").ok().flatten(),
                "pays": r.try_get::<Option<String>, _>("pays").ok().flatten(),
                "ville": r.try_get::<Option<String>, _>("ville").ok().flatten(),
                "quartier": r.try_get::<Option<String>, _>("quartier").ok().flatten(),
                "systeme_scolaire": r.try_get::<Option<String>, _>("systeme_scolaire").ok().flatten(),
                "cycles_offerts": r.try_get::<Option<Vec<String>>, _>("cycles_offerts").ok().flatten().unwrap_or_default(),
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

/// POST /api/v2/admin/etablissement/migrate
/// Force l'exécution de la migration des Pages Établissements (création
/// des colonnes slug, gerant_user_id, page_status etc. + tables CMS).
/// Réservé aux admins. Idempotent.
pub async fn migrate_etablissement_pages(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: _user_id, role }): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    let role_lower = role.to_lowercase();
    if !["admin", "super_admin", "superadmin"].contains(&role_lower.as_str()) {
        return Err(AppError::Forbidden(
            "Réservé aux administrateurs".to_string(),
        ));
    }

    // Activation extension unaccent (préalable nécessaire pour etab_slugify)
    let _ = sqlx::query("CREATE EXTENSION IF NOT EXISTS unaccent").execute(&state.pg).await;
    let _ = sqlx::query("CREATE EXTENSION IF NOT EXISTS pg_trgm").execute(&state.pg).await;

    // Fonction slugify
    sqlx::query(
        r#"
        CREATE OR REPLACE FUNCTION etab_slugify(input TEXT) RETURNS TEXT AS $$
        BEGIN
            RETURN lower(
                regexp_replace(
                    regexp_replace(
                        unaccent(coalesce(input, '')),
                        '[^a-zA-Z0-9]+', '-', 'g'
                    ),
                    '(^-+|-+$)', '', 'g'
                )
            );
        END;
        $$ LANGUAGE plpgsql IMMUTABLE
        "#,
    )
    .execute(&state.pg)
    .await
    .map_err(|e| AppError::Database(format!("etab_slugify: {}", e)))?;

    // Extension de etablissements_scolaires
    sqlx::query(
        r#"
        ALTER TABLE etablissements_scolaires
            ADD COLUMN IF NOT EXISTS slug TEXT,
            ADD COLUMN IF NOT EXISTS logo_url TEXT,
            ADD COLUMN IF NOT EXISTS banniere_url TEXT,
            ADD COLUMN IF NOT EXISTS description TEXT,
            ADD COLUMN IF NOT EXISTS gerant_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS page_status TEXT NOT NULL DEFAULT 'draft',
            ADD COLUMN IF NOT EXISTS page_published_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS qr_code_url TEXT,
            ADD COLUMN IF NOT EXISTS stats_views_30d INTEGER NOT NULL DEFAULT 0
        "#,
    )
    .execute(&state.pg)
    .await
    .map_err(|e| AppError::Database(format!("ALTER etablissements_scolaires: {}", e)))?;

    // Index uniques + GIN trigram
    let _ = sqlx::query(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_etablissements_slug_unique \
         ON etablissements_scolaires(slug) WHERE slug IS NOT NULL",
    )
    .execute(&state.pg)
    .await;
    let _ = sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_etablissements_gerant \
         ON etablissements_scolaires(gerant_user_id) WHERE gerant_user_id IS NOT NULL",
    )
    .execute(&state.pg)
    .await;
    let _ = sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_etablissements_nom_trgm \
         ON etablissements_scolaires USING GIN (nom_etablissement gin_trgm_ops)",
    )
    .execute(&state.pg)
    .await;

    // Backfill des slugs manquants
    sqlx::query(
        "UPDATE etablissements_scolaires SET slug = etab_slugify(nom_etablissement) || '-' || id::text WHERE slug IS NULL",
    )
    .execute(&state.pg)
    .await
    .map_err(|e| AppError::Database(format!("backfill slug: {}", e)))?;

    // Tables CMS
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS etablissement_blocs (
            id              SERIAL PRIMARY KEY,
            etablissement_id INTEGER NOT NULL REFERENCES etablissements_scolaires(id) ON DELETE CASCADE,
            type_bloc       TEXT NOT NULL,
            titre           TEXT,
            contenu_json    JSONB NOT NULL DEFAULT '{}'::jsonb,
            medias_urls     TEXT[] DEFAULT ARRAY[]::TEXT[],
            position        INTEGER NOT NULL DEFAULT 0,
            is_active       BOOLEAN NOT NULL DEFAULT true,
            published_at    TIMESTAMPTZ,
            created_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
            updated_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE(etablissement_id, type_bloc)
        )
        "#,
    )
    .execute(&state.pg)
    .await
    .map_err(|e| AppError::Database(format!("CREATE etablissement_blocs: {}", e)))?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS etablissement_blocs_audit (
            id              BIGSERIAL PRIMARY KEY,
            etablissement_id INTEGER NOT NULL,
            type_bloc       TEXT NOT NULL,
            action          TEXT NOT NULL,
            user_id         INTEGER REFERENCES users(id) ON DELETE SET NULL,
            diff_json       JSONB,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        "#,
    )
    .execute(&state.pg)
    .await
    .map_err(|e| AppError::Database(format!("CREATE etablissement_blocs_audit: {}", e)))?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS etablissement_annonces (
            id              SERIAL PRIMARY KEY,
            etablissement_id INTEGER NOT NULL REFERENCES etablissements_scolaires(id) ON DELETE CASCADE,
            titre           TEXT NOT NULL,
            contenu         TEXT NOT NULL,
            image_url       TEXT,
            is_pinned       BOOLEAN NOT NULL DEFAULT false,
            published_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            expires_at      TIMESTAMPTZ,
            created_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        "#,
    )
    .execute(&state.pg)
    .await
    .map_err(|e| AppError::Database(format!("CREATE etablissement_annonces: {}", e)))?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS etablissement_evenements (
            id              SERIAL PRIMARY KEY,
            etablissement_id INTEGER NOT NULL REFERENCES etablissements_scolaires(id) ON DELETE CASCADE,
            titre           TEXT NOT NULL,
            description     TEXT,
            type_event      TEXT,
            date_debut      TIMESTAMPTZ NOT NULL,
            date_fin        TIMESTAMPTZ,
            classe_concernee TEXT,
            is_active       BOOLEAN NOT NULL DEFAULT true,
            created_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        "#,
    )
    .execute(&state.pg)
    .await
    .map_err(|e| AppError::Database(format!("CREATE etablissement_evenements: {}", e)))?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS etablissement_visites (
            etablissement_id INTEGER NOT NULL REFERENCES etablissements_scolaires(id) ON DELETE CASCADE,
            date            DATE NOT NULL,
            visites         INTEGER NOT NULL DEFAULT 0,
            visiteurs_unq   INTEGER NOT NULL DEFAULT 0,
            clics_commande  INTEGER NOT NULL DEFAULT 0,
            clics_infos     INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (etablissement_id, date)
        )
        "#,
    )
    .execute(&state.pg)
    .await
    .map_err(|e| AppError::Database(format!("CREATE etablissement_visites: {}", e)))?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "ok": true,
            "message": "Migration Pages Établissements appliquée avec succès",
        })),
    ))
}

// ============================================================================
// IA EXTRACTION DES INFOS ÉTABLISSEMENT DEPUIS DES DOCUMENTS
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct IaExtractFichier {
    pub nom: String,
    pub file_type: Option<String>,
    pub base64: String,
}

#[derive(Debug, Deserialize)]
pub struct IaExtractPayload {
    pub fichiers: Vec<IaExtractFichier>,
    pub nom_etablissement_hint: Option<String>,
    #[serde(default)]
    pub annee_scolaire: Option<String>,
}

/// POST /api/v2/admin/etablissement/{id}/ia-extract
/// Le directeur upload 1+ documents → l'IA extrait toutes les infos →
/// les blocs CMS sont pré-remplis automatiquement, listes scolaires insérées
/// dans programmes_scolaires, événements + annonces enregistrés.
pub async fn ia_extract_etablissement(
    State(state): State<Arc<AppState>>,
    Path(etab_id): Path<i32>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<IaExtractPayload>,
) -> AppResult<impl IntoResponse> {
    require_etab_admin(&state, user_id, etab_id).await?;

    if payload.fichiers.is_empty() {
        return Err(AppError::BadRequest("Aucun fichier fourni".to_string()));
    }
    if payload.fichiers.len() > 12 {
        return Err(AppError::BadRequest(
            "Maximum 12 fichiers par extraction (limite IA)".to_string(),
        ));
    }

    let files_b64: Vec<String> = payload
        .fichiers
        .iter()
        .map(|f| {
            let s = &f.base64;
            if let Some(comma) = s.find(',') {
                if s[..comma].contains("base64") {
                    return s[(comma + 1)..].to_string();
                }
            }
            s.clone()
        })
        .collect();

    let nom_hint: String = if let Some(h) = payload.nom_etablissement_hint.as_ref() {
        h.clone()
    } else {
        sqlx::query_scalar::<_, String>(
            "SELECT nom_etablissement FROM etablissements_scolaires WHERE id = $1",
        )
        .bind(etab_id)
        .fetch_optional(&state.pg)
        .await
        .ok()
        .flatten()
        .unwrap_or_default()
    };

    let ia =
        crate::services::etablissement_ia_service::EtablissementIAService::new(state.ia.clone());
    let extraction = ia.extract_etablissement_info(&files_b64, Some(&nom_hint)).await?;

    // 1) Description + meta (nom_abrege, systeme_scolaire, cycles_offerts) auto-détectés
    let meta = &extraction.meta;
    let detected_nom_abrege = meta
        .get("nom_abrege")
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty());
    let detected_systeme = meta
        .get("systeme_scolaire")
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| matches!(*s, "francophone" | "anglophone" | "bilingue"));
    let detected_pays = meta
        .get("pays")
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| s.len() == 2);
    let detected_cycles: Vec<String> = meta
        .get("cycles_offerts")
        .and_then(|v| v.as_array())
        .map(|a| {
            a.iter()
                .filter_map(|x| x.as_str().map(str::to_string))
                .filter(|s| {
                    matches!(
                        s.as_str(),
                        "maternelle"
                            | "primaire"
                            | "college"
                            | "lycee"
                            | "technique"
                            | "professionnelle"
                            | "superieur"
                    )
                })
                .collect()
        })
        .unwrap_or_default();
    let detected_cycles_opt: Option<Vec<String>> = if detected_cycles.is_empty() {
        None
    } else {
        Some(detected_cycles)
    };

    let _ = sqlx::query(
        r#"
        UPDATE etablissements_scolaires
        SET description       = COALESCE($2, description),
            nom_abrege        = COALESCE($3, nom_abrege),
            systeme_scolaire  = COALESCE($4, systeme_scolaire),
            pays              = COALESCE($5, pays),
            cycles_offerts    = CASE
                                  WHEN $6::text[] IS NOT NULL AND array_length(cycles_offerts, 1) IS NULL
                                  THEN $6::text[]
                                  ELSE cycles_offerts
                                END,
            updated_at        = NOW()
        WHERE id = $1
        "#,
    )
    .bind(etab_id)
    .bind(extraction.description.as_deref().filter(|s| !s.trim().is_empty()))
    .bind(detected_nom_abrege)
    .bind(detected_systeme)
    .bind(detected_pays)
    .bind(detected_cycles_opt.as_deref())
    .execute(&state.pg)
    .await;

    // 2) Upsert blocs CMS éditoriaux
    let blocs_to_save: [(&str, &Value); 8] = [
        ("inscription", &extraction.inscription),
        ("transport", &extraction.transport),
        ("cantine", &extraction.cantine),
        ("perisco", &extraction.perisco),
        ("internat", &extraction.internat),
        ("uniforme", &extraction.uniforme),
        ("contacts", &extraction.contacts),
        ("laureats", &extraction.laureats),
    ];
    let mut blocs_saved = 0;
    for (type_bloc, contenu) in blocs_to_save {
        let json = contenu.clone();
        let is_empty = json.is_null()
            || matches!(&json, Value::Object(m) if m.values().all(|v| v.is_null()
                || (v.is_string() && v.as_str().unwrap_or("").is_empty())
                || (v.is_array() && v.as_array().unwrap().is_empty())));
        if is_empty {
            continue;
        }
        let _ = sqlx::query(
            r#"
            INSERT INTO etablissement_blocs
                (etablissement_id, type_bloc, contenu_json, is_active, published_at,
                 created_by, updated_by)
            VALUES ($1, $2, $3, true, NOW(), $4, $4)
            ON CONFLICT (etablissement_id, type_bloc) DO UPDATE
            SET contenu_json = EXCLUDED.contenu_json,
                is_active = true,
                published_at = NOW(),
                updated_by = $4,
                updated_at = NOW()
            "#,
        )
        .bind(etab_id)
        .bind(type_bloc)
        .bind(&json)
        .bind(user_id)
        .execute(&state.pg)
        .await;
        blocs_saved += 1;
    }

    // 3) Événements
    let mut events_saved = 0;
    for ev in &extraction.evenements {
        let titre = ev.get("titre").and_then(|v| v.as_str()).unwrap_or("").trim();
        if titre.is_empty() {
            continue;
        }
        let dt: Option<chrono::DateTime<chrono::Utc>> = ev
            .get("date_debut")
            .and_then(|v| v.as_str())
            .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
            .map(|d| d.with_timezone(&chrono::Utc));
        let dt = match dt {
            Some(d) => d,
            None => continue,
        };
        let dt_fin: Option<chrono::DateTime<chrono::Utc>> = ev
            .get("date_fin")
            .and_then(|v| v.as_str())
            .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
            .map(|d| d.with_timezone(&chrono::Utc));
        let _ = sqlx::query(
            r#"
            INSERT INTO etablissement_evenements
                (etablissement_id, titre, description, type_event, date_debut, date_fin,
                 classe_concernee, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            "#,
        )
        .bind(etab_id)
        .bind(titre)
        .bind(ev.get("description").and_then(|v| v.as_str()))
        .bind(ev.get("type_event").and_then(|v| v.as_str()))
        .bind(dt)
        .bind(dt_fin)
        .bind(ev.get("classe_concernee").and_then(|v| v.as_str()))
        .bind(user_id)
        .execute(&state.pg)
        .await;
        events_saved += 1;
    }

    // 4) Annonces
    let mut annonces_saved = 0;
    for an in &extraction.annonces {
        let titre = an.get("titre").and_then(|v| v.as_str()).unwrap_or("").trim();
        let contenu = an.get("contenu").and_then(|v| v.as_str()).unwrap_or("").trim();
        if titre.is_empty() || contenu.is_empty() {
            continue;
        }
        let _ = sqlx::query(
            r#"
            INSERT INTO etablissement_annonces
                (etablissement_id, titre, contenu, created_by)
            VALUES ($1, $2, $3, $4)
            "#,
        )
        .bind(etab_id)
        .bind(titre)
        .bind(contenu)
        .bind(user_id)
        .execute(&state.pg)
        .await;
        annonces_saved += 1;
    }

    // 5) Listes scolaires (programmes_scolaires)
    let annee = payload.annee_scolaire.clone().unwrap_or_else(|| "2026-2027".to_string());
    let mut articles_saved = 0;
    for liste in &extraction.listes_scolaires {
        let classe = liste.get("classe").and_then(|v| v.as_str()).unwrap_or("").trim();
        if classe.is_empty() {
            continue;
        }
        let articles = match liste.get("articles").and_then(|v| v.as_array()) {
            Some(a) => a,
            None => continue,
        };
        for art in articles {
            let titre = art.get("titre").and_then(|v| v.as_str()).unwrap_or("").trim();
            if titre.is_empty() {
                continue;
            }
            let prix: Option<f64> =
                art.get("prix_officiel").and_then(|v| v.as_f64()).or_else(|| {
                    art.get("prix_officiel").and_then(|v| v.as_str()).and_then(|s| s.parse().ok())
                });
            let prix_dec: Option<rust_decimal::Decimal> =
                prix.and_then(rust_decimal::Decimal::from_f64_retain);
            // Type IA — on accepte 'livre','workbook','cahier','fourniture','accessoire'
            let raw_type =
                art.get("type").and_then(|v| v.as_str()).unwrap_or("livre").to_lowercase();
            let type_article: &str = match raw_type.as_str() {
                "workbook" | "wb" | "cahier d'exercices" => "workbook",
                "cahier" => "cahier",
                "fourniture" | "supply" => "fourniture",
                "accessoire" | "accessory" | "kit" => "accessoire",
                _ => "livre",
            };
            // Pays + système préalablement détectés (sinon défaut 'CM' / 'francophone')
            let pays_bind = detected_pays.unwrap_or("CM");
            let systeme_bind: &str = detected_systeme
                .map(|s| {
                    if s == "anglophone" {
                        "anglophone"
                    } else {
                        "francophone"
                    }
                })
                .unwrap_or("francophone");
            let qte: i32 = art
                .get("quantite_defaut")
                .and_then(|v| v.as_i64())
                .map(|n| n as i32)
                .unwrap_or(1);
            let res = sqlx::query(
                r#"
                INSERT INTO programmes_scolaires
                    (etablissement_id, pays, systeme_educatif, niveau, classe, matiere,
                     titre_livre, auteur_livre, editeur_livre, type_article,
                     prix_officiel, devise, annee_scolaire,
                     est_obligatoire, quantite_defaut, is_active, created_at, updated_at,
                     created_by)
                SELECT $1, $2, $3, COALESCE($4, 'Secondaire'), $5, $6,
                       $7, $8, $9, $10, $11, 'XAF', $12, $13, $14, true, NOW(), NOW(), $15
                WHERE NOT EXISTS (
                    SELECT 1 FROM programmes_scolaires p
                    WHERE p.etablissement_id = $1
                      AND p.classe = $5
                      AND p.titre_livre = $7
                      AND p.annee_scolaire = $12
                      AND p.is_active = true
                )
                "#,
            )
            .bind(etab_id)
            .bind(pays_bind)
            .bind(systeme_bind)
            .bind(art.get("niveau").and_then(|v| v.as_str()))
            .bind(classe)
            .bind(art.get("matiere").and_then(|v| v.as_str()).unwrap_or(""))
            .bind(titre)
            .bind(art.get("auteur").and_then(|v| v.as_str()))
            .bind(art.get("editeur").and_then(|v| v.as_str()))
            .bind(type_article)
            .bind(prix_dec)
            .bind(&annee)
            .bind(art.get("est_obligatoire").and_then(|v| v.as_bool()).unwrap_or(true))
            .bind(qte)
            .bind(user_id)
            .execute(&state.pg)
            .await;
            if let Ok(r) = res {
                if r.rows_affected() > 0 {
                    articles_saved += 1;
                }
            }
        }
    }

    Ok((
        StatusCode::OK,
        Json(json!({
            "ok": true,
            "blocs_saved": blocs_saved,
            "events_saved": events_saved,
            "annonces_saved": annonces_saved,
            "articles_saved": articles_saved,
            "confidence": extraction.confidence,
            "notes": extraction.notes,
            "extraction": {
                "description": extraction.description,
                "meta": extraction.meta,
                "listes_scolaires_count": extraction.listes_scolaires.len(),
            },
        })),
    ))
}

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
    let is_admin = ["admin", "super_admin", "superadmin"].contains(&role_lower.as_str());

    // Self-service : ouvert aussi aux comptes partenaires de type
    // 'etablissementscolaire' afin qu'un directeur puisse déclarer son école.
    if !is_admin {
        let is_etab_partner: bool = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM users WHERE id = $1 AND COALESCE(partner_type, '') = 'etablissementscolaire')",
        )
        .bind(user_id)
        .fetch_one(&state.pg)
        .await
        .map_err(|e| AppError::Database(format!("check partner_type: {}", e)))?;

        if !is_etab_partner {
            return Err(AppError::Forbidden(
                "Réservé aux admins ou aux comptes partenaires de type 'etablissementscolaire'"
                    .to_string(),
            ));
        }
    }

    if payload.nom_etablissement.trim().is_empty() {
        return Err(AppError::BadRequest("Le nom est requis".to_string()));
    }

    // Récupère le premier service du user OU crée un service minimal si absent
    // (les comptes partenaires fraîchement créés peuvent ne pas en avoir).
    let service_id: Option<i32> =
        sqlx::query_scalar("SELECT id FROM services WHERE user_id = $1 ORDER BY id ASC LIMIT 1")
            .bind(user_id)
            .fetch_optional(&state.pg)
            .await
            .map_err(|e| AppError::Database(format!("create_demo find service: {}", e)))?;

    let service_id = match service_id {
        Some(id) => id,
        None => {
            let row = sqlx::query(
                r#"
                INSERT INTO services (user_id, data, created_at, updated_at)
                VALUES ($1, jsonb_build_object('titre', jsonb_build_object('value', $2)), NOW(), NOW())
                RETURNING id
                "#,
            )
            .bind(user_id)
            .bind(&payload.nom_etablissement)
            .fetch_one(&state.pg)
            .await
            .map_err(|e| AppError::Database(format!("create_demo new service: {}", e)))?;
            use sqlx::Row;
            row.try_get::<i32, _>("id").unwrap_or(0)
        }
    };

    let type_etab = payload.type_etablissement.clone().unwrap_or_else(|| "secondaire".to_string());
    let ville = payload.ville.clone().unwrap_or_else(|| "Douala".to_string());
    let quartier = payload.quartier.clone();

    // Génération d'un slug propre :
    // - Pour un partenaire qui déclare son école : slug lisible
    //   "college-bilingue-yukpo-yassa" (avec quartier si dispo). Si collision,
    //   on suffixe par l'id de l'établissement.
    // - Pour un admin qui crée une démo : suffixe "-demo-{timestamp}" pour
    //   éviter de polluer les vrais slugs.
    let slug_expr: &str = if is_admin {
        "etab_slugify($3) || '-demo-' || extract(epoch from NOW())::bigint::text"
    } else if quartier.is_some() {
        "etab_slugify($3 || '-' || $6::text)"
    } else {
        "etab_slugify($3 || '-' || $5::text)"
    };

    let sql = format!(
        r#"
        INSERT INTO etablissements_scolaires
            (service_id, user_id, gerant_user_id, nom_etablissement,
             type_etablissement, ville, quartier, page_status, page_published_at,
             slug, created_at, updated_at)
        VALUES ($1, $2, $2, $3, $4, $5, $6, 'published', NOW(),
                {slug_expr},
                NOW(), NOW())
        ON CONFLICT (slug) WHERE slug IS NOT NULL DO UPDATE
            SET nom_etablissement = EXCLUDED.nom_etablissement,
                updated_at = NOW()
        RETURNING id, slug, nom_etablissement
        "#
    );

    let row_result = sqlx::query(&sql)
        .bind(service_id)
        .bind(user_id)
        .bind(&payload.nom_etablissement)
        .bind(&type_etab)
        .bind(&ville)
        .bind(&quartier)
        .fetch_one(&state.pg)
        .await;

    // Si conflit (slug déjà pris malgré l'UPSERT), fallback : suffixer par l'id
    let row = match row_result {
        Ok(r) => r,
        Err(_) => sqlx::query(
            r#"
            INSERT INTO etablissements_scolaires
                (service_id, user_id, gerant_user_id, nom_etablissement,
                 type_etablissement, ville, quartier, page_status, page_published_at,
                 slug, created_at, updated_at)
            VALUES ($1, $2, $2, $3, $4, $5, $6, 'published', NOW(),
                    etab_slugify($3) || '-' || nextval('etablissements_scolaires_id_seq')::text,
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
        .map_err(|e| AppError::Database(format!("create insert: {}", e)))?,
    };

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
