// ✅ Contrôleur Suggestions parent — UX « Ajouter manuellement »
// Date : 2026-05-10
//
// Au lieu de demander au parent de saisir des articles libres, on lui propose
// un tableau intelligent contextuel à sa classe + catégorie.
//
// Sources de données fusionnées (par priorité décroissante) :
//   1. Programmes scolaires de l'établissement partenaire choisi (si applicable)
//   2. Programme national officiel du pays (etab_id national CM, FR ou EN)
//   3. Accessoires populaires par classe (table accessoires_populaires_par_classe)
//
// Tri final par fréquence d'usage (occurrences) puis prix officiel.

use crate::core::types::{AppError, AppResult};
use crate::middlewares::jwt::AuthenticatedUser;
use crate::state::AppState;
use axum::{
    extract::{Extension, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;

#[derive(Debug, Deserialize)]
pub struct ArticlesSuggestedQuery {
    /// Classe du parent (ex: "6ème", "Form 1"). Obligatoire.
    pub classe: String,
    /// Groupe de types : "livres" (livre + workbook) ou "fournitures"
    /// (cahier + fourniture + accessoire). Défaut : "livres".
    #[serde(default)]
    pub type_groupe: Option<String>,
    /// Pays ISO-2. Défaut "CM".
    #[serde(default)]
    pub pays: Option<String>,
    /// Système éducatif "francophone" ou "anglophone". Optionnel —
    /// si absent, on prend les deux.
    #[serde(default)]
    pub systeme: Option<String>,
    /// ID établissement partenaire si choisi par le parent. Donne priorité
    /// aux articles saisis par cet établissement.
    #[serde(default)]
    pub etablissement_id: Option<i32>,
    /// Année scolaire. Défaut "2025-2026".
    #[serde(default)]
    pub annee_scolaire: Option<String>,
    #[serde(default = "default_limit")]
    pub limit: i64,
}

fn default_limit() -> i64 {
    50
}

/// GET /api/v2/parent/articles-suggested
pub async fn articles_suggested(
    State(state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthenticatedUser>,
    Query(q): Query<ArticlesSuggestedQuery>,
) -> AppResult<impl IntoResponse> {
    let classe = q.classe.trim();
    if classe.is_empty() {
        return Err(AppError::BadRequest("classe requise".into()));
    }
    let pays = q.pays.clone().unwrap_or_else(|| "CM".to_string());
    let annee = q.annee_scolaire.clone().unwrap_or_else(|| "2025-2026".to_string());
    let groupe = q.type_groupe.as_deref().unwrap_or("livres").to_lowercase();

    // Détermine les types_article SQL selon le groupe choisi
    let types_filter: Vec<&str> = match groupe.as_str() {
        "fournitures" => vec!["cahier", "fourniture", "accessoire"],
        _ => vec!["livre", "workbook"],
    };
    let types_filter_owned: Vec<String> = types_filter.iter().map(|s| s.to_string()).collect();

    use sqlx::Row;
    let mut items: Vec<serde_json::Value> = Vec::new();

    // ─── Source 1+2 : programmes_scolaires (établissement choisi + national)
    // On unifie les deux sources via UNION ALL et on dédoublonne par titre.
    //
    // ✅ Matching classe permissif : DB stocke "6ème", "CP", "Form 1"… mais le
    // frontend peut envoyer "6ème", "6ème TI", "6e", "6EME", etc. On compare
    // donc en lower(trim()) et on tolère que la valeur DB soit un préfixe de
    // la valeur reçue (cas "6ème TI" → matche "6ème"), tout en gardant le
    // matching strict en priorité.
    let rows = sqlx::query(
        r#"
        WITH sources AS (
            -- Programmes de l'établissement partenaire si fourni (priorité 1)
            SELECT id, niveau, classe, matiere, titre_livre, auteur_livre, editeur_livre,
                   isbn_livre, type_article, prix_officiel::float8 AS prix, devise,
                   COALESCE(quantite_defaut, 1) AS qte,
                   est_obligatoire, systeme_educatif,
                   1 AS priority
            FROM programmes_scolaires
            WHERE is_active = true
              AND (lower(trim(classe)) = lower(trim($1))
                   OR lower(trim($1)) LIKE lower(trim(classe)) || ' %')
              AND type_article = ANY($2)
              AND etablissement_id = $3
              AND ($4::text IS NULL OR systeme_educatif = $4)
            UNION ALL
            -- Programme national du pays — lié à un etab is_national (priorité 2)
            -- Convention MINEDUB (seed 20260512_002), MINESEC complet (20260510_007)
            SELECT p.id, p.niveau, p.classe, p.matiere, p.titre_livre, p.auteur_livre, p.editeur_livre,
                   p.isbn_livre, p.type_article, p.prix_officiel::float8 AS prix, p.devise,
                   COALESCE(p.quantite_defaut, 1) AS qte,
                   p.est_obligatoire, p.systeme_educatif,
                   2 AS priority
            FROM programmes_scolaires p
            JOIN etablissements_scolaires e ON e.id = p.etablissement_id
            WHERE p.is_active = true
              AND (lower(trim(p.classe)) = lower(trim($1))
                   OR lower(trim($1)) LIKE lower(trim(p.classe)) || ' %')
              AND p.type_article = ANY($2)
              AND e.is_national = true
              AND e.pays = $5
              AND ($4::text IS NULL OR p.systeme_educatif = $4)
              AND ($3::int IS NULL OR p.etablissement_id != $3)
            UNION ALL
            -- Programme national sans etab parent — etablissement_id IS NULL
            -- Convention MINESEC général (seed 20260424_003) et MINESEC technique
            -- (seed 20260512_003). Filtre par pays directement sur la colonne.
            SELECT id, niveau, classe, matiere, titre_livre, auteur_livre, editeur_livre,
                   isbn_livre, type_article, prix_officiel::float8 AS prix, devise,
                   COALESCE(quantite_defaut, 1) AS qte,
                   est_obligatoire, systeme_educatif,
                   2 AS priority
            FROM programmes_scolaires
            WHERE is_active = true
              AND etablissement_id IS NULL
              AND (lower(trim(classe)) = lower(trim($1))
                   OR lower(trim($1)) LIKE lower(trim(classe)) || ' %')
              AND type_article = ANY($2)
              AND pays = $5
              AND ($4::text IS NULL OR systeme_educatif = $4)
        )
        SELECT DISTINCT ON (lower(titre_livre), COALESCE(matiere,''), type_article)
               id, niveau, classe, matiere, titre_livre, auteur_livre, editeur_livre,
               isbn_livre, type_article, prix, devise, qte, est_obligatoire, systeme_educatif,
               priority
        FROM sources
        ORDER BY lower(titre_livre), COALESCE(matiere,''), type_article, priority ASC
        LIMIT $6
        "#,
    )
    .bind(classe)
    .bind(&types_filter_owned)
    .bind(q.etablissement_id)
    .bind(q.systeme.as_deref())
    .bind(&pays)
    .bind(q.limit)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| AppError::Database(format!("articles_suggested: programmes: {}", e)))?;

    for r in &rows {
        let priority: i32 = r.try_get("priority").unwrap_or(2);
        let frequency = if priority == 1 { 90 } else { 70 };
        items.push(json!({
            "source": if priority == 1 { "etablissement" } else { "national" },
            "type_article": r.try_get::<String, _>("type_article").ok(),
            "titre": r.try_get::<String, _>("titre_livre").ok(),
            "auteur": r.try_get::<Option<String>, _>("auteur_livre").ok().flatten(),
            "editeur": r.try_get::<Option<String>, _>("editeur_livre").ok().flatten(),
            "isbn": r.try_get::<Option<String>, _>("isbn_livre").ok().flatten(),
            "matiere": r.try_get::<Option<String>, _>("matiere").ok().flatten(),
            "niveau": r.try_get::<Option<String>, _>("niveau").ok().flatten(),
            "prix_officiel": r.try_get::<Option<f64>, _>("prix").ok().flatten(),
            "devise": r.try_get::<Option<String>, _>("devise").ok().flatten(),
            "quantite_defaut": r.try_get::<i32, _>("qte").unwrap_or(1),
            "est_obligatoire": r.try_get::<Option<bool>, _>("est_obligatoire").ok().flatten(),
            "systeme_educatif": r.try_get::<Option<String>, _>("systeme_educatif").ok().flatten(),
            "frequency_score": frequency,
        }));
    }

    // ─── Source 3 : accessoires populaires (uniquement pour fournitures)
    if groupe == "fournitures" {
        let pop_rows = sqlx::query(
            r#"
            SELECT id, nom, quantite_mediane,
                   prix_median::float8 AS prix_median,
                   gamme_defaut, occurrences, niveau
            FROM accessoires_populaires_par_classe
            WHERE pays = $1
              AND classe = $2
            ORDER BY occurrences DESC, nom ASC
            LIMIT $3
            "#,
        )
        .bind(&pays)
        .bind(classe)
        .bind(q.limit)
        .fetch_all(&state.pg)
        .await
        .ok()
        .unwrap_or_default();

        // Normalize occurrences vers un score 0-100 (max occurrences = 100)
        let max_occ = pop_rows
            .iter()
            .filter_map(|r| r.try_get::<i32, _>("occurrences").ok())
            .max()
            .unwrap_or(1)
            .max(1);
        for r in &pop_rows {
            let occ: i32 = r.try_get("occurrences").unwrap_or(0);
            let frequency = ((occ as f64 / max_occ as f64) * 70.0) as i32; // max 70 pour passer derrière les programmes officiels
            let titre: String = r.try_get("nom").unwrap_or_default();
            // Dédoublonnage avec items déjà ajoutés (programmes scolaires)
            let already = items.iter().any(|x| {
                x.get("titre")
                    .and_then(|v| v.as_str())
                    .map(|s| s.eq_ignore_ascii_case(&titre))
                    .unwrap_or(false)
            });
            if already {
                continue;
            }
            items.push(json!({
                "source": "populaire",
                "type_article": "fourniture",
                "titre": titre,
                "matiere": serde_json::Value::Null,
                "niveau": r.try_get::<Option<String>, _>("niveau").ok().flatten(),
                "prix_officiel": r.try_get::<Option<f64>, _>("prix_median").ok().flatten(),
                "devise": "XAF",
                "quantite_defaut": r.try_get::<Option<i32>, _>("quantite_mediane").ok().flatten().unwrap_or(1),
                "gamme_defaut": r.try_get::<Option<String>, _>("gamme_defaut").ok().flatten(),
                "frequency_score": frequency,
            }));
        }
    }

    // Tri final par frequency_score décroissant
    items.sort_by(|a, b| {
        let fa = a.get("frequency_score").and_then(|v| v.as_i64()).unwrap_or(0);
        let fb = b.get("frequency_score").and_then(|v| v.as_i64()).unwrap_or(0);
        fb.cmp(&fa)
    });

    let count = items.len();
    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "items": items,
            "count": count,
            "classe": classe,
            "type_groupe": groupe,
            "annee_scolaire": annee,
            "pays": pays,
        })),
    ))
}

// ============================================================================
// ✅ 2026-05-15 : Fournitures agrégées multi-classes
// ============================================================================
// Endpoint dédié à la nouvelle page CahiersAccessoiresPage.
// L'utilisateur déclare ses classes + nombre d'enfants par classe ; le backend
// agrège les cahiers/accessoires en sommant quantite_mediane × nb_enfants et
// renvoie un breakdown par classe pour transparence.

#[derive(Debug, Deserialize)]
pub struct ClasseAvecEnfants {
    pub classe: String,
    /// Nombre d'enfants dans cette classe (défaut 1 si absent).
    #[serde(default = "default_nb_enfants")]
    pub nb_enfants: i32,
}

fn default_nb_enfants() -> i32 {
    1
}

#[derive(Debug, Deserialize)]
pub struct FournituresAggregeesBody {
    /// Liste des classes du parent avec nb d'enfants. Au moins une obligatoire.
    pub classes: Vec<ClasseAvecEnfants>,
    /// Pays ISO-2. Défaut "CM".
    #[serde(default)]
    pub pays: Option<String>,
}

/// POST /api/v2/parent/fournitures-aggregees
///
/// Body : { classes: [{ classe, nb_enfants }], pays }
///
/// Pour chaque classe, on fetche `accessoires_populaires_par_classe`, on
/// dédoublonne par `nom_normalise`, et on somme `quantite_mediane × nb_enfants`.
/// Le breakdown par classe est conservé pour affichage transparent dans l'UI
/// (ex: "Cahier 200p Seyès — 17 unités (5 × 6ème, 8 × CE1, 4 × CP)").
pub async fn fournitures_aggregees(
    State(state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthenticatedUser>,
    Json(body): Json<FournituresAggregeesBody>,
) -> AppResult<impl IntoResponse> {
    if body.classes.is_empty() {
        return Err(AppError::BadRequest("Au moins une classe requise".into()));
    }
    let pays = body.pays.clone().unwrap_or_else(|| "CM".to_string());

    use sqlx::Row;
    use std::collections::BTreeMap;

    // Structure d'agrégation côté backend (BTreeMap pour ordre stable).
    #[derive(serde::Serialize, Clone)]
    struct ItemAgrege {
        nom: String,
        nom_normalise: String,
        gamme_defaut: Option<String>,
        prix_median: Option<f64>,
        devise: Option<String>,
        occurrences_total: i64,
        /// Quantité totale = somme (quantite_mediane * nb_enfants) sur toutes les classes
        quantite_totale: i64,
        /// Breakdown par classe : [{ classe, quantite_par_enfant, nb_enfants, sous_total }]
        breakdown: Vec<BreakdownClasse>,
    }
    #[derive(serde::Serialize, Clone)]
    struct BreakdownClasse {
        classe: String,
        quantite_par_enfant: i32,
        nb_enfants: i32,
        sous_total: i32,
    }

    let mut agg: BTreeMap<String, ItemAgrege> = BTreeMap::new();

    for c in &body.classes {
        let nb = c.nb_enfants.max(1);
        let classe_trim = c.classe.trim();
        if classe_trim.is_empty() {
            continue;
        }
        let rows = sqlx::query(
            r#"SELECT id, nom, nom_normalise, gamme_defaut,
                      prix_median::float8 AS prix_median,
                      devise,
                      quantite_mediane,
                      occurrences
               FROM accessoires_populaires_par_classe
               WHERE pays = $1
                 AND classe = $2
               ORDER BY occurrences DESC, nom"#,
        )
        .bind(&pays)
        .bind(classe_trim)
        .fetch_all(&state.pg)
        .await
        .unwrap_or_default();

        for r in &rows {
            let nom: String = r.try_get("nom").unwrap_or_default();
            let nom_norm: String = r
                .try_get::<Option<String>, _>("nom_normalise")
                .ok()
                .flatten()
                .unwrap_or_else(|| nom.to_lowercase());
            let qte_med: i32 =
                r.try_get::<Option<i32>, _>("quantite_mediane").ok().flatten().unwrap_or(1);
            let occ: i32 = r.try_get("occurrences").unwrap_or(0);
            let sous_total = qte_med * nb;

            let entry = agg.entry(nom_norm.clone()).or_insert_with(|| ItemAgrege {
                nom: nom.clone(),
                nom_normalise: nom_norm.clone(),
                gamme_defaut: r.try_get::<Option<String>, _>("gamme_defaut").ok().flatten(),
                prix_median: r.try_get::<Option<f64>, _>("prix_median").ok().flatten(),
                devise: r.try_get::<Option<String>, _>("devise").ok().flatten(),
                occurrences_total: 0,
                quantite_totale: 0,
                breakdown: Vec::new(),
            });
            entry.occurrences_total += occ as i64;
            entry.quantite_totale += sous_total as i64;
            entry.breakdown.push(BreakdownClasse {
                classe: classe_trim.to_string(),
                quantite_par_enfant: qte_med,
                nb_enfants: nb,
                sous_total,
            });
        }
    }

    // Tri final par occurrences cumulées décroissantes (les plus fréquents en haut)
    let mut items: Vec<ItemAgrege> = agg.into_values().collect();
    items.sort_by(|a, b| {
        b.occurrences_total.cmp(&a.occurrences_total).then_with(|| a.nom.cmp(&b.nom))
    });

    let total_articles = items.len();
    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "items": items,
            "count": total_articles,
            "classes_input": body.classes.iter().map(|c| json!({
                "classe": c.classe,
                "nb_enfants": c.nb_enfants
            })).collect::<Vec<_>>(),
            "pays": pays,
        })),
    ))
}

#[derive(Debug, Deserialize)]
pub struct ArticlesSearchQuery {
    pub q: String,
    #[serde(default)]
    pub type_groupe: Option<String>,
    #[serde(default)]
    pub pays: Option<String>,
    #[serde(default = "default_search_limit")]
    pub limit: i64,
}

fn default_search_limit() -> i64 {
    20
}

/// GET /api/v2/parent/articles-search
///
/// Recherche d'articles **cross-classes** par mot-clé pour le bouton
/// « + Ajouter manuellement » dans la modale Suggestions. Contrairement à
/// `articles_suggested` qui restreint à une classe donnée, ici on cherche
/// dans toute la base de programmes (national + établissements) + accessoires
/// populaires du pays, filtré par groupe livres/fournitures.
///
/// Réponse identique en shape à `articles_suggested` (champ `items`).
pub async fn articles_search(
    State(state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthenticatedUser>,
    Query(q): Query<ArticlesSearchQuery>,
) -> AppResult<impl IntoResponse> {
    let needle = q.q.trim();
    if needle.len() < 2 {
        return Ok((
            StatusCode::OK,
            Json(json!({ "success": true, "items": [], "count": 0 })),
        ));
    }
    let pays = q.pays.clone().unwrap_or_else(|| "CM".to_string());
    let groupe = q.type_groupe.as_deref().unwrap_or("livres").to_lowercase();
    let types_filter: Vec<String> = match groupe.as_str() {
        "fournitures" => vec![
            "cahier".to_string(),
            "fourniture".to_string(),
            "accessoire".to_string(),
        ],
        _ => vec!["livre".to_string(), "workbook".to_string()],
    };
    // Pattern ILIKE — case+accent (limite : ILIKE ne supprime pas les accents,
    // donc on s'appuie sur `unaccent` si l'extension est dispo, sinon ILIKE direct).
    let pattern = format!("%{}%", needle.to_lowercase());

    use sqlx::Row;
    let rows = sqlx::query(
        r#"
        SELECT DISTINCT ON (lower(titre_livre), COALESCE(matiere,''), type_article)
               id, niveau, classe, matiere, titre_livre, auteur_livre, editeur_livre,
               isbn_livre, type_article, prix_officiel::float8 AS prix, devise,
               COALESCE(quantite_defaut, 1) AS qte,
               est_obligatoire, systeme_educatif
        FROM programmes_scolaires
        WHERE is_active = true
          AND type_article = ANY($1)
          AND pays = $2
          AND (lower(titre_livre) LIKE $3
               OR lower(COALESCE(matiere,'')) LIKE $3
               OR lower(COALESCE(auteur_livre,'')) LIKE $3
               OR lower(COALESCE(editeur_livre,'')) LIKE $3)
        ORDER BY lower(titre_livre), COALESCE(matiere,''), type_article
        LIMIT $4
        "#,
    )
    .bind(&types_filter)
    .bind(&pays)
    .bind(&pattern)
    .bind(q.limit)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| AppError::Database(format!("articles_search: {}", e)))?;

    let mut items: Vec<serde_json::Value> = Vec::new();
    for r in &rows {
        items.push(json!({
            "source": "national",
            "type_article": r.try_get::<String, _>("type_article").ok(),
            "titre": r.try_get::<String, _>("titre_livre").ok(),
            "auteur": r.try_get::<Option<String>, _>("auteur_livre").ok().flatten(),
            "editeur": r.try_get::<Option<String>, _>("editeur_livre").ok().flatten(),
            "isbn": r.try_get::<Option<String>, _>("isbn_livre").ok().flatten(),
            "matiere": r.try_get::<Option<String>, _>("matiere").ok().flatten(),
            "niveau": r.try_get::<Option<String>, _>("niveau").ok().flatten(),
            "classe": r.try_get::<Option<String>, _>("classe").ok().flatten(),
            "prix_officiel": r.try_get::<Option<f64>, _>("prix").ok().flatten(),
            "devise": r.try_get::<Option<String>, _>("devise").ok().flatten(),
            "quantite_defaut": r.try_get::<i32, _>("qte").unwrap_or(1),
            "est_obligatoire": r.try_get::<Option<bool>, _>("est_obligatoire").ok().flatten(),
        }));
    }

    // Source 2 : accessoires_populaires_par_classe pour le groupe fournitures
    if groupe == "fournitures" {
        let pop_rows = sqlx::query(
            r#"
            SELECT id, nom, quantite_mediane, prix_median::float8 AS prix_median,
                   gamme_defaut, classe, niveau
            FROM accessoires_populaires_par_classe
            WHERE pays = $1
              AND lower(nom) LIKE $2
            ORDER BY occurrences DESC, nom ASC
            LIMIT $3
            "#,
        )
        .bind(&pays)
        .bind(&pattern)
        .bind(q.limit)
        .fetch_all(&state.pg)
        .await
        .ok()
        .unwrap_or_default();
        for r in &pop_rows {
            let titre: String = r.try_get("nom").unwrap_or_default();
            let already = items.iter().any(|x| {
                x.get("titre")
                    .and_then(|v| v.as_str())
                    .map(|s| s.eq_ignore_ascii_case(&titre))
                    .unwrap_or(false)
            });
            if already {
                continue;
            }
            items.push(json!({
                "source": "populaire",
                "type_article": "fourniture",
                "titre": titre,
                "matiere": serde_json::Value::Null,
                "classe": r.try_get::<Option<String>, _>("classe").ok().flatten(),
                "niveau": r.try_get::<Option<String>, _>("niveau").ok().flatten(),
                "prix_officiel": r.try_get::<Option<f64>, _>("prix_median").ok().flatten(),
                "devise": "XAF",
                "quantite_defaut": r.try_get::<Option<i32>, _>("quantite_mediane").ok().flatten().unwrap_or(1),
                "gamme_defaut": r.try_get::<Option<String>, _>("gamme_defaut").ok().flatten(),
            }));
        }
    }

    let count = items.len();
    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "items": items,
            "count": count,
            "query": needle,
            "type_groupe": groupe,
            "pays": pays,
        })),
    ))
}

// ============================================================================
// ✅ 2026-05-15 : Onboarding lieu de livraison + WhatsApp persistants
// ============================================================================
// Au 1er login, le user remplit son lieu de livraison (autocomplete Photon)
// + confirme/édite son numéro WhatsApp. Une fois sauvegardé, l'app ne demande
// plus jamais ces infos (ni de GPS in-flow pour le troc / commande).

#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct UserDeliveryInfo {
    pub delivery_location_text: Option<String>,
    pub delivery_location_lat: Option<f64>,
    pub delivery_location_lng: Option<f64>,
    pub delivery_location_saved_at: Option<chrono::DateTime<chrono::Utc>>,
    /// Numéro WhatsApp principal (= colonne `phone` de users)
    pub whatsapp_number_primary: Option<String>,
    pub whatsapp_number_secondary: Option<String>,
}

/// GET /api/users/me/delivery-info
pub async fn get_delivery_info(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    let info: UserDeliveryInfo = sqlx::query_as(
        r#"SELECT
              delivery_location_text,
              delivery_location_lat,
              delivery_location_lng,
              delivery_location_saved_at,
              phone AS whatsapp_number_primary,
              whatsapp_number_secondary
           FROM users
           WHERE id = $1"#,
    )
    .bind(user.id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| AppError::Database(format!("get_delivery_info: {}", e)))?
    .ok_or_else(|| AppError::NotFound("Utilisateur introuvable".into()))?;

    // Booléen pratique pour le frontend : sait-on déjà où livrer ?
    let onboarding_done =
        info.delivery_location_text.is_some() && info.delivery_location_saved_at.is_some();

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "onboarding_done": onboarding_done,
            "delivery_location_text": info.delivery_location_text,
            "delivery_location_lat": info.delivery_location_lat,
            "delivery_location_lng": info.delivery_location_lng,
            "delivery_location_saved_at": info.delivery_location_saved_at,
            "whatsapp_number_primary": info.whatsapp_number_primary,
            "whatsapp_number_secondary": info.whatsapp_number_secondary,
        })),
    ))
}

#[derive(Debug, serde::Deserialize)]
pub struct PutDeliveryInfoBody {
    pub delivery_location_text: String,
    pub delivery_location_lat: Option<f64>,
    pub delivery_location_lng: Option<f64>,
    pub whatsapp_number_primary: Option<String>,
    pub whatsapp_number_secondary: Option<String>,
}

/// PUT /api/users/me/delivery-info
///
/// Persiste le lieu de livraison choisi par l'user (autocomplete Photon →
/// texte + lat + lng). Met aussi à jour le WhatsApp principal/secondaire.
/// Source de vérité pour le matching troc (proximité géographique) et
/// l'organisation des livraisons côté coursier.
pub async fn put_delivery_info(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(body): Json<PutDeliveryInfoBody>,
) -> AppResult<impl IntoResponse> {
    let text = body.delivery_location_text.trim();
    if text.is_empty() {
        return Err(AppError::BadRequest(
            "Le lieu de livraison est obligatoire.".into(),
        ));
    }
    if text.len() > 500 {
        return Err(AppError::BadRequest(
            "Le lieu de livraison est trop long (max 500 caractères).".into(),
        ));
    }

    // Normalise les numéros WhatsApp (suppression des espaces, garde +, chiffres)
    let normalize_phone =
        |s: &str| -> String { s.chars().filter(|c| c.is_ascii_digit() || *c == '+').collect() };
    let whatsapp_primary = body.whatsapp_number_primary.as_deref().map(|s| normalize_phone(s));
    let whatsapp_secondary = body.whatsapp_number_secondary.as_deref().map(|s| normalize_phone(s));

    sqlx::query(
        r#"UPDATE users
           SET delivery_location_text = $2,
               delivery_location_lat = $3,
               delivery_location_lng = $4,
               delivery_location_saved_at = NOW(),
               phone = COALESCE($5, phone),
               whatsapp_number_secondary = $6,
               updated_at = NOW()
           WHERE id = $1"#,
    )
    .bind(user.id)
    .bind(text)
    .bind(body.delivery_location_lat)
    .bind(body.delivery_location_lng)
    .bind(whatsapp_primary.as_deref().filter(|s| !s.is_empty()))
    .bind(whatsapp_secondary.as_deref().filter(|s| !s.is_empty()))
    .execute(&state.pg)
    .await
    .map_err(|e| AppError::Database(format!("put_delivery_info: {}", e)))?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "delivery_location_saved_at": chrono::Utc::now(),
        })),
    ))
}
