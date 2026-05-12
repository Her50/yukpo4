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
            -- Programme national du pays (priorité 2)
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
