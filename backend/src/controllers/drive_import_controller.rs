// ✅ Import permanent via lien Drive / cloud pour partenaires
//
// Flux :
//   1. Partenaire partage un lien Google Drive / Dropbox / URL directe (.csv)
//   2. On convertit le lien en URL de téléchargement direct
//   3. On télécharge et parse le CSV → on upsert les produits
//   4. Un scheduler tourne toutes les heures et re-déclenche les liens actifs selon
//      leur schedule (hourly / daily / weekly)
//
// URLs supportées :
//   - Google Drive share : drive.google.com/file/d/{ID}/view
//   - Google Sheets      : docs.google.com/spreadsheets/d/{ID}/edit
//   - Dropbox            : dropbox.com/s/.../file.csv?dl=0
//   - OneDrive embed     : 1drv.ms/... (lien direct fourni par le partenaire)
//   - URL directe        : toute URL se terminant par .csv (fallback)

use crate::core::types::{AppError, AppResult};
use crate::middlewares::jwt::AuthenticatedUser;
use crate::state::AppState;
use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::Deserialize;
use serde_json::json;
use sqlx::Row;
use std::sync::Arc;

// ─── Structures de requête ─────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct SaveImportLinkRequest {
    /// service_type : 'pharmacie' | 'supermarche' | 'ecommerce'
    pub service_type: String,
    pub service_id: i32,
    /// Lien original communiqué par le partenaire
    pub drive_url: String,
    /// 'manual' | 'hourly' | 'daily' | 'weekly'
    pub sync_schedule: Option<String>,
    /// Heure UTC pour la sync daily/weekly (0-23)
    pub sync_hour: Option<i32>,
    /// Jour de semaine pour weekly (0=dim, 6=sam)
    pub sync_day_of_week: Option<i32>,
    /// Libellé optionnel (ex: "Catalogue médicaments")
    pub label: Option<String>,
}

// ─── Conversion URL ────────────────────────────────────────────────────────

/// Transforme un lien de partage cloud en URL de téléchargement direct.
pub fn convert_to_download_url(raw_url: &str) -> Result<String, String> {
    let url = raw_url.trim();

    // ── Google Drive file share ──────────────────────────────────────────────
    // https://drive.google.com/file/d/{ID}/view?...
    if url.contains("drive.google.com/file/d/") {
        if let Some(after) = url.split("/file/d/").nth(1) {
            let file_id = after.split('/').next().unwrap_or("").split('?').next().unwrap_or("");
            if !file_id.is_empty() {
                return Ok(format!(
                    "https://drive.google.com/uc?export=download&confirm=t&id={}",
                    file_id
                ));
            }
        }
        return Err("ID Google Drive introuvable dans le lien".to_string());
    }

    // ── Google Drive open ────────────────────────────────────────────────────
    // https://drive.google.com/open?id={ID}
    if url.contains("drive.google.com/open") {
        if let Some(id_param) = url.split("id=").nth(1) {
            let file_id = id_param.split('&').next().unwrap_or("");
            if !file_id.is_empty() {
                return Ok(format!(
                    "https://drive.google.com/uc?export=download&confirm=t&id={}",
                    file_id
                ));
            }
        }
        return Err("ID Google Drive introuvable".to_string());
    }

    // ── Google Sheets (export CSV) ───────────────────────────────────────────
    // https://docs.google.com/spreadsheets/d/{ID}/edit...
    if url.contains("docs.google.com/spreadsheets/d/") {
        if let Some(after) = url.split("/spreadsheets/d/").nth(1) {
            let sheet_id = after.split('/').next().unwrap_or("").split('?').next().unwrap_or("");
            if !sheet_id.is_empty() {
                return Ok(format!(
                    "https://docs.google.com/spreadsheets/d/{}/export?format=csv",
                    sheet_id
                ));
            }
        }
        return Err("ID Google Sheets introuvable".to_string());
    }

    // ── Dropbox ──────────────────────────────────────────────────────────────
    // https://www.dropbox.com/s/.../file.csv?dl=0
    if url.contains("dropbox.com") {
        let converted = if url.contains("?dl=0") {
            url.replace("?dl=0", "?dl=1")
        } else if url.contains("&dl=0") {
            url.replace("&dl=0", "&dl=1")
        } else if !url.contains("dl=1") {
            if url.contains('?') {
                format!("{}&dl=1", url)
            } else {
                format!("{}?dl=1", url)
            }
        } else {
            url.to_string()
        };
        return Ok(converted);
    }

    // ── URL directe (csv / xlsx) ─────────────────────────────────────────────
    if url.ends_with(".csv")
        || url.ends_with(".CSV")
        || url.ends_with(".xlsx")
        || url.ends_with(".XLSX")
        || url.contains(".csv?")
        || url.contains(".xlsx?")
    {
        return Ok(url.to_string());
    }

    // ── Fallback : on tente quand même de télécharger ────────────────────────
    if url.starts_with("http://") || url.starts_with("https://") {
        return Ok(url.to_string());
    }

    Err(format!("URL non reconnue : {}", url))
}

// ─── Téléchargement + parsing CSV ──────────────────────────────────────────

#[derive(Debug)]
pub struct ParsedProduct {
    pub nom: String,
    pub prix: f64,
    pub stock: i32,
    pub unite: Option<String>,
    pub categorie: Option<String>,
    pub description: Option<String>,
}

/// Télécharge le fichier depuis l'URL et parse les lignes CSV.
/// Format attendu (headers en 1ère ligne, séparateur ; ou , ou tab) :
///   nom;prix;stock;unite;categorie;description
/// ou bien :
///   nom,prix,stock,unite,categorie
pub async fn download_and_parse_csv(download_url: &str) -> Result<Vec<ParsedProduct>, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .redirect(reqwest::redirect::Policy::limited(5))
        .user_agent("YukpoApp/1.0")
        .build()
        .map_err(|e| format!("Erreur création client HTTP: {}", e))?;

    let resp = client
        .get(download_url)
        .send()
        .await
        .map_err(|e| format!("Erreur téléchargement: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!(
            "Erreur HTTP {}: impossible de télécharger le fichier",
            resp.status()
        ));
    }

    let text = resp.text().await.map_err(|e| format!("Erreur lecture contenu: {}", e))?;

    parse_csv_text(&text)
}

fn parse_csv_text(text: &str) -> Result<Vec<ParsedProduct>, String> {
    let mut lines = text.lines().peekable();

    // Détecter le séparateur depuis la première ligne
    let first_line = lines.peek().unwrap_or(&"").to_string();
    let sep = detect_separator(&first_line);

    // Lire headers
    let headers: Vec<String> = lines
        .next()
        .map(|l| l.split(sep).map(|s| s.trim().to_lowercase().to_string()).collect())
        .unwrap_or_default();

    if headers.is_empty() {
        return Err("Fichier vide ou header absent".to_string());
    }

    // Trouver les indices des colonnes attendues (tolerant aux variantes)
    let col_nom = find_col(
        &headers,
        &[
            "nom",
            "name",
            "nom_produit",
            "produit",
            "médicament",
            "medicament",
            "article",
        ],
    );
    let col_prix = find_col(&headers, &["prix", "price", "tarif", "cout", "coût"]);
    let col_stock = find_col(&headers, &["stock", "quantite", "quantité", "qty", "qte"]);
    let col_unite = find_col(&headers, &["unite", "unité", "unit", "conditionnement"]);
    let col_cat = find_col(
        &headers,
        &["categorie", "catégorie", "category", "cat", "type"],
    );
    let col_desc = find_col(&headers, &["description", "desc", "details", "détails"]);

    let nom_idx = col_nom.ok_or("Colonne 'nom' manquante dans le CSV")?;

    let mut products = Vec::new();
    for line in lines {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let cols: Vec<&str> = line.split(sep).collect();
        let nom = cols.get(nom_idx).map(|s| s.trim()).unwrap_or("").to_string();
        if nom.is_empty() {
            continue;
        }

        let prix = col_prix
            .and_then(|i| cols.get(i))
            .and_then(|s| s.trim().replace(',', ".").parse::<f64>().ok())
            .unwrap_or(0.0);

        let stock = col_stock
            .and_then(|i| cols.get(i))
            .and_then(|s| s.trim().parse::<f64>().ok())
            .map(|f| f as i32)
            .unwrap_or(0);

        let unite = col_unite
            .and_then(|i| cols.get(i))
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());

        let categorie = col_cat
            .and_then(|i| cols.get(i))
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());

        let description = col_desc
            .and_then(|i| cols.get(i))
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());

        products.push(ParsedProduct {
            nom,
            prix,
            stock,
            unite,
            categorie,
            description,
        });
    }

    Ok(products)
}

fn detect_separator(line: &str) -> char {
    let counts = [
        (';', line.chars().filter(|c| *c == ';').count()),
        (',', line.chars().filter(|c| *c == ',').count()),
        ('\t', line.chars().filter(|c| *c == '\t').count()),
    ];
    counts.iter().max_by_key(|(_, c)| *c).map(|(s, _)| *s).unwrap_or(';')
}

fn find_col(headers: &[String], candidates: &[&str]) -> Option<usize> {
    for cand in candidates {
        if let Some(idx) = headers.iter().position(|h| h.as_str() == *cand) {
            return Some(idx);
        }
    }
    None
}

// ─── Upsert produits dans la table cible ──────────────────────────────────

pub async fn upsert_products_for_service(
    pg: &sqlx::PgPool,
    service_type: &str,
    service_id: i32,
    products: &[ParsedProduct],
) -> Result<usize, String> {
    let mut count = 0usize;

    match service_type {
        "pharmacie" => {
            for p in products {
                let prix = rust_decimal::Decimal::try_from(p.prix).unwrap_or_default();
                sqlx::query(
                    r#"
                    INSERT INTO pharmacy_products (pharmacy_service_id, nom_produit, prix, stock, disponible, unite, categorie, updated_at)
                    VALUES ($1, $2, $3, $4, ($4 > 0), $5, $6, NOW())
                    ON CONFLICT (pharmacy_service_id, nom_produit)
                    DO UPDATE SET
                        prix = EXCLUDED.prix,
                        stock = EXCLUDED.stock,
                        disponible = (EXCLUDED.stock > 0),
                        unite = COALESCE(EXCLUDED.unite, pharmacy_products.unite),
                        categorie = COALESCE(EXCLUDED.categorie, pharmacy_products.categorie),
                        updated_at = NOW()
                    "#,
                )
                .bind(service_id)
                .bind(&p.nom)
                .bind(prix)
                .bind(p.stock)
                .bind(p.unite.as_deref())
                .bind(p.categorie.as_deref())
                .execute(pg)
                .await
                .map_err(|e| format!("Erreur upsert pharmacie: {}", e))?;
                count += 1;
            }
        }
        "supermarche" | "ecommerce" => {
            for p in products {
                let prix = rust_decimal::Decimal::try_from(p.prix).unwrap_or_default();
                sqlx::query(
                    r#"
                    INSERT INTO service_products (service_id, nom, prix, stock, est_disponible, description, categorie, updated_at)
                    VALUES ($1, $2, $3, $4, ($4 > 0), $5, $6, NOW())
                    ON CONFLICT (service_id, nom)
                    DO UPDATE SET
                        prix = EXCLUDED.prix,
                        stock = EXCLUDED.stock,
                        est_disponible = (EXCLUDED.stock > 0),
                        description = COALESCE(EXCLUDED.description, service_products.description),
                        categorie = COALESCE(EXCLUDED.categorie, service_products.categorie),
                        updated_at = NOW()
                    "#,
                )
                .bind(service_id)
                .bind(&p.nom)
                .bind(prix)
                .bind(p.stock)
                .bind(p.description.as_deref())
                .bind(p.categorie.as_deref())
                .execute(pg)
                .await
                .map_err(|e| format!("Erreur upsert service_products: {}", e))?;
                count += 1;
            }
        }
        other => return Err(format!("service_type inconnu: {}", other)),
    }

    Ok(count)
}

// ─── Exécution d'un import (appelé manuellement ou par le scheduler) ───────

pub async fn run_import_for_link(
    pg: &sqlx::PgPool,
    link_id: i32,
    download_url: &str,
    service_type: &str,
    service_id: i32,
) -> Result<usize, String> {
    // Marquer "en cours"
    let _ = sqlx::query(
        "UPDATE partner_import_links SET last_sync_status = 'running', updated_at = NOW() WHERE id = $1",
    )
    .bind(link_id)
    .execute(pg)
    .await;

    // Télécharger + parser
    let products = match download_and_parse_csv(download_url).await {
        Ok(p) => p,
        Err(e) => {
            let _ = sqlx::query(
                "UPDATE partner_import_links SET last_sync_status = 'error', last_sync_at = NOW(), last_sync_error = $1, updated_at = NOW() WHERE id = $2",
            )
            .bind(&e)
            .bind(link_id)
            .execute(pg)
            .await;
            return Err(e);
        }
    };

    // Upsert
    let count = match upsert_products_for_service(pg, service_type, service_id, &products).await {
        Ok(c) => c,
        Err(e) => {
            let _ = sqlx::query(
                "UPDATE partner_import_links SET last_sync_status = 'error', last_sync_at = NOW(), last_sync_error = $1, updated_at = NOW() WHERE id = $2",
            )
            .bind(&e)
            .bind(link_id)
            .execute(pg)
            .await;
            return Err(e);
        }
    };

    // Succès
    let _ = sqlx::query(
        r#"
        UPDATE partner_import_links
        SET last_sync_status = 'success',
            last_sync_at = NOW(),
            last_sync_count = $1,
            last_sync_error = NULL,
            updated_at = NOW()
        WHERE id = $2
        "#,
    )
    .bind(count as i32)
    .bind(link_id)
    .execute(pg)
    .await;

    log::info!(
        "[drive_import] Link #{}: {} produits importés pour {} service_id={}",
        link_id,
        count,
        service_type,
        service_id
    );

    Ok(count)
}

// ─── Handlers HTTP ─────────────────────────────────────────────────────────

/// POST /api/partner/import-links
/// Enregistre un lien Drive + planification pour un partenaire.
pub async fn save_import_link(
    State(state): State<Arc<AppState>>,
    Extension(crate::middlewares::jwt::AuthenticatedUser { id: user_id, .. }): Extension<
        crate::middlewares::jwt::AuthenticatedUser,
    >,
    Json(payload): Json<SaveImportLinkRequest>,
) -> AppResult<impl IntoResponse> {
    if payload.drive_url.trim().is_empty() {
        return Err(AppError::BadRequest("drive_url requis".to_string()));
    }
    let valid_types = ["pharmacie", "supermarche", "ecommerce"];
    if !valid_types.contains(&payload.service_type.as_str()) {
        return Err(AppError::BadRequest(
            "service_type invalide (pharmacie|supermarche|ecommerce)".to_string(),
        ));
    }

    let download_url = convert_to_download_url(&payload.drive_url)
        .map_err(|e| AppError::BadRequest(format!("Lien non reconnu : {}", e)))?;

    let sync_schedule = payload.sync_schedule.as_deref().unwrap_or("daily");
    let valid_schedules = ["manual", "hourly", "daily", "weekly"];
    if !valid_schedules.contains(&sync_schedule) {
        return Err(AppError::BadRequest(
            "sync_schedule invalide (manual|hourly|daily|weekly)".to_string(),
        ));
    }

    let sync_hour = payload.sync_hour.unwrap_or(3).clamp(0, 23);
    let sync_day_of_week = payload.sync_day_of_week.unwrap_or(1).clamp(0, 6);

    // Détecter format
    let file_format = if download_url.contains("format=csv") || download_url.ends_with(".csv") {
        "csv"
    } else if download_url.ends_with(".xlsx") {
        "xlsx"
    } else {
        "csv" // défaut
    };

    let row = sqlx::query(
        r#"
        INSERT INTO partner_import_links
            (user_id, service_type, service_id, drive_url, download_url, file_format,
             sync_schedule, sync_hour, sync_day_of_week, label, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, NOW(), NOW())
        RETURNING id
        "#,
    )
    .bind(user_id)
    .bind(&payload.service_type)
    .bind(payload.service_id)
    .bind(&payload.drive_url)
    .bind(&download_url)
    .bind(file_format)
    .bind(sync_schedule)
    .bind(sync_hour)
    .bind(sync_day_of_week)
    .bind(payload.label.as_deref())
    .fetch_one(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur insertion lien: {}", e)))?;

    let link_id: i32 = row.get("id");

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "success": true,
            "link_id": link_id,
            "download_url": download_url,
            "sync_schedule": sync_schedule,
            "message": "Lien enregistré. La synchronisation démarrera automatiquement selon le planning."
        })),
    ))
}

/// GET /api/partner/import-links
/// Liste les liens Drive du partenaire connecté.
pub async fn list_import_links(
    State(state): State<Arc<AppState>>,
    Extension(crate::middlewares::jwt::AuthenticatedUser { id: user_id, .. }): Extension<
        crate::middlewares::jwt::AuthenticatedUser,
    >,
) -> AppResult<impl IntoResponse> {
    let rows = sqlx::query(
        r#"
        SELECT id, service_type, service_id, drive_url, download_url, file_format,
               sync_schedule, sync_hour, sync_day_of_week, label, is_active,
               last_sync_at, last_sync_status, last_sync_count, last_sync_error,
               created_at
        FROM partner_import_links
        WHERE user_id = $1
        ORDER BY created_at DESC
        "#,
    )
    .bind(user_id)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur liste liens: {}", e)))?;

    let links: Vec<serde_json::Value> = rows
        .iter()
        .map(|r| {
            json!({
                "id": r.get::<i32, _>("id"),
                "service_type": r.get::<String, _>("service_type"),
                "service_id": r.get::<i32, _>("service_id"),
                "drive_url": r.get::<String, _>("drive_url"),
                "file_format": r.get::<String, _>("file_format"),
                "sync_schedule": r.get::<String, _>("sync_schedule"),
                "sync_hour": r.get::<i32, _>("sync_hour"),
                "label": r.get::<Option<String>, _>("label"),
                "is_active": r.get::<bool, _>("is_active"),
                "last_sync_at": r.get::<Option<chrono::DateTime<chrono::Utc>>, _>("last_sync_at"),
                "last_sync_status": r.get::<Option<String>, _>("last_sync_status"),
                "last_sync_count": r.get::<Option<i32>, _>("last_sync_count"),
                "last_sync_error": r.get::<Option<String>, _>("last_sync_error"),
                "created_at": r.get::<chrono::DateTime<chrono::Utc>, _>("created_at"),
            })
        })
        .collect();

    Ok((
        StatusCode::OK,
        Json(json!({ "success": true, "links": links, "count": links.len() })),
    ))
}

/// DELETE /api/partner/import-links/:id
pub async fn delete_import_link(
    State(state): State<Arc<AppState>>,
    Extension(crate::middlewares::jwt::AuthenticatedUser { id: user_id, .. }): Extension<
        crate::middlewares::jwt::AuthenticatedUser,
    >,
    Path(link_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    let affected = sqlx::query("DELETE FROM partner_import_links WHERE id = $1 AND user_id = $2")
        .bind(link_id)
        .bind(user_id)
        .execute(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur suppression: {}", e)))?
        .rows_affected();

    if affected == 0 {
        return Err(AppError::NotFound(
            "Lien introuvable ou non autorisé".to_string(),
        ));
    }

    Ok((
        StatusCode::OK,
        Json(json!({ "success": true, "message": "Lien supprimé" })),
    ))
}

/// PATCH /api/partner/import-links/:id/toggle
/// Active ou désactive un lien.
pub async fn toggle_import_link(
    State(state): State<Arc<AppState>>,
    Extension(crate::middlewares::jwt::AuthenticatedUser { id: user_id, .. }): Extension<
        crate::middlewares::jwt::AuthenticatedUser,
    >,
    Path(link_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    let row = sqlx::query(
        "UPDATE partner_import_links SET is_active = NOT is_active, updated_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING is_active",
    )
    .bind(link_id)
    .bind(user_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur toggle: {}", e)))?
    .ok_or_else(|| AppError::NotFound("Lien introuvable".to_string()))?;

    let is_active: bool = row.get("is_active");
    Ok((
        StatusCode::OK,
        Json(json!({ "success": true, "is_active": is_active })),
    ))
}

/// POST /api/partner/import-links/:id/sync
/// Déclenche manuellement un import immédiat.
pub async fn manual_sync_import_link(
    State(state): State<Arc<AppState>>,
    Extension(crate::middlewares::jwt::AuthenticatedUser { id: user_id, .. }): Extension<
        crate::middlewares::jwt::AuthenticatedUser,
    >,
    Path(link_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    let row = sqlx::query(
        "SELECT id, download_url, service_type, service_id FROM partner_import_links WHERE id = $1 AND user_id = $2",
    )
    .bind(link_id)
    .bind(user_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur chargement lien: {}", e)))?
    .ok_or_else(|| AppError::NotFound("Lien introuvable ou non autorisé".to_string()))?;

    let download_url: String = row.get("download_url");
    let service_type: String = row.get("service_type");
    let service_id: i32 = row.get("service_id");

    let pg = state.pg.clone();
    let dl = download_url.clone();
    let st = service_type.clone();

    // Lancer en arrière-plan pour ne pas bloquer la réponse HTTP
    tokio::spawn(async move {
        let _ = run_import_for_link(&pg, link_id, &dl, &st, service_id).await;
    });

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "message": "Import lancé en arrière-plan. Vérifiez le statut dans quelques secondes.",
            "download_url": download_url,
        })),
    ))
}
