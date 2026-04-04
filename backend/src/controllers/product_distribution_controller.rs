// Contrôleur distribution produits multi-canaux
// Facebook OAuth, distribution catalogue, règles auto, feeds Google Shopping / CSV

use std::{env, sync::Arc};

use axum::{
    extract::{Json, Path, Query, State},
    http::{header, HeaderValue, StatusCode},
    response::{Html, IntoResponse, Response},
    Extension,
};
use chrono::{DateTime, Duration, Utc};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use urlencoding::encode;

use crate::{
    core::types::{AppError, AppResult},
    middlewares::jwt::AuthenticatedUser,
    services::{
        product_distribution_worker, product_feed_service,
        social_connector_service::{
            consume_oauth_state, create_oauth_state, upsert_social_account, SocialTokenPayload,
        },
    },
    state::AppState,
};

// ─────────────────────────────────────────────────────────────
// Facebook Page OAuth
// ─────────────────────────────────────────────────────────────

pub async fn facebook_authorize(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
) -> AppResult<Json<serde_json::Value>> {
    let app_id = env::var("FACEBOOK_APP_ID")
        .map_err(|_| AppError::Internal("FACEBOOK_APP_ID manquant".into()))?;
    let redirect_uri = env::var("FACEBOOK_REDIRECT_URI")
        .map_err(|_| AppError::Internal("FACEBOOK_REDIRECT_URI manquant".into()))?;

    let state_key = create_oauth_state(&state.redis_client, user.id).await?;

    // Scopes complets : Pages + Instagram + commentaires + messagerie + catalogue
    let scope = encode(
        "pages_manage_posts,pages_read_engagement,pages_show_list,\
         pages_manage_metadata,pages_manage_comments,pages_messaging,\
         instagram_content_publish,instagram_basic,instagram_manage_comments,\
         catalog_management,public_profile",
    );
    let extras = encode(r#"{"setup":{"channel":"IG_API_ONBOARDING"}}"#);
    let auth_url = format!(
        "https://www.facebook.com/v19.0/dialog/oauth\
         ?client_id={}&redirect_uri={}&scope={}&response_type=code&state={}&extras={}",
        encode(&app_id),
        encode(&redirect_uri),
        scope,
        encode(&state_key),
        extras,
    );

    Ok(Json(serde_json::json!({
        "authorization_url": auth_url,
        "info": "Cette connexion couvre Facebook ET Instagram automatiquement.",
    })))
}

pub async fn facebook_callback(
    State(state): State<Arc<AppState>>,
    Query(params): Query<OAuthCallbackParams>,
) -> AppResult<Html<String>> {
    if let Some(error) = params.error {
        return Ok(Html(oauth_error_page("Facebook", &error)));
    }

    let code = params.code.ok_or_else(|| AppError::BadRequest("Code OAuth manquant".into()))?;
    let state_key = params
        .state
        .ok_or_else(|| AppError::BadRequest("State OAuth manquant".into()))?;

    let user_id = consume_oauth_state(&state.redis_client, &state_key)
        .await?
        .ok_or_else(|| AppError::BadRequest("State invalide ou expiré".into()))?;

    let app_id = env::var("FACEBOOK_APP_ID")
        .map_err(|_| AppError::Internal("FACEBOOK_APP_ID manquant".into()))?;
    let app_secret = env::var("FACEBOOK_APP_SECRET")
        .map_err(|_| AppError::Internal("FACEBOOK_APP_SECRET manquant".into()))?;
    let redirect_uri = env::var("FACEBOOK_REDIRECT_URI")
        .map_err(|_| AppError::Internal("FACEBOOK_REDIRECT_URI manquant".into()))?;

    let http = Client::new();

    // Échange code → token utilisateur court
    let token_resp: FacebookTokenResponse = http
        .get("https://graph.facebook.com/v19.0/oauth/access_token")
        .query(&[
            ("client_id", app_id.as_str()),
            ("redirect_uri", redirect_uri.as_str()),
            ("client_secret", app_secret.as_str()),
            ("code", code.as_str()),
        ])
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;

    // Échange token court → token long (60 jours)
    let long_resp: FacebookTokenResponse = http
        .get("https://graph.facebook.com/v19.0/oauth/access_token")
        .query(&[
            ("grant_type", "fb_exchange_token"),
            ("client_id", app_id.as_str()),
            ("client_secret", app_secret.as_str()),
            ("fb_exchange_token", token_resp.access_token.as_str()),
        ])
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;

    // Découverte complète : Pages Facebook + Instagram liés, tokens individuels par Page
    let ecosystem =
        crate::services::social_connector_service::discover_and_save_facebook_ecosystem(
            state.clone(),
            user_id,
            &long_resp.access_token,
            None,
        )
        .await;

    match &ecosystem {
        Ok(r) => log::info!(
            "[FB] Ecosystem OK user={}: {} pages ({}), {} Instagram, page_créée={}",
            user_id,
            r.pages_connected,
            r.page_names.join(", "),
            r.instagram_connected,
            r.page_auto_created,
        ),
        Err(e) => {
            // Fallback : save token brut si discover échoue
            log::warn!("[FB] Discover échoué ({}), fallback token brut", e);
            let expires_at = long_resp.expires_in.map(|s| Utc::now() + Duration::seconds(s as i64));
            upsert_social_account(
                state.clone(),
                user_id,
                SocialTokenPayload {
                    platform: "facebook".to_string(),
                    account_handle: None,
                    access_token: long_resp.access_token.clone(),
                    refresh_token: None,
                    expires_at,
                    scope: long_resp.scope.clone(),
                    metadata: None,
                },
            )
            .await?;
        }
    }

    Ok(Html(oauth_success_page("Facebook & Instagram")))
}

// ─────────────────────────────────────────────────────────────
// Distribution produits
// ─────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct DistributeProductsRequest {
    pub service_id: i32,
    pub product_ids: Vec<i32>,
    pub platforms: Vec<String>,
    pub message_template: Option<String>,
    pub schedule_at: Option<DateTime<Utc>>,
}

pub async fn distribute_products(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<DistributeProductsRequest>,
) -> AppResult<Json<serde_json::Value>> {
    if payload.product_ids.is_empty() {
        return Err(AppError::BadRequest(
            "Sélectionnez au moins un produit".into(),
        ));
    }
    if payload.platforms.is_empty() {
        return Err(AppError::BadRequest(
            "Sélectionnez au moins une plateforme".into(),
        ));
    }

    // Vérifier que le service appartient bien à l'utilisateur
    let svc = sqlx::query(
        "SELECT id, data->>'nom' AS nom, data->>'name' AS name_alt
         FROM services WHERE id = $1 AND user_id = $2",
    )
    .bind(payload.service_id)
    .bind(user.id)
    .fetch_optional(&state.pg)
    .await
    .map_err(AppError::from)?;

    let svc = svc.ok_or_else(|| AppError::NotFound("Service non trouvé".into()))?;

    let service_name: String = {
        use sqlx::Row;
        svc.try_get::<Option<String>, _>("nom")
            .ok()
            .flatten()
            .or_else(|| svc.try_get::<Option<String>, _>("name_alt").ok().flatten())
            .unwrap_or_else(|| "Ma boutique".to_string())
    };

    // Charger les produits sélectionnés
    let products = sqlx::query(
        r#"SELECT id, name, price, category, description, image_url, stock,
                  is_promotion, promotional_price
           FROM service_products
           WHERE service_id = $1
             AND id = ANY($2)
             AND is_active = true"#,
    )
    .bind(payload.service_id)
    .bind(&payload.product_ids)
    .fetch_all(&state.pg)
    .await
    .map_err(AppError::from)?;

    if products.is_empty() {
        return Err(AppError::BadRequest("Aucun produit actif trouvé".into()));
    }

    use sqlx::Row;
    let yukpo_base = "https://yukpomnang.com";
    let mut jobs_created = 0i32;

    for product in &products {
        let product_id: i32 = product.try_get("id").unwrap_or(0);
        let name: String = product.try_get("name").unwrap_or_default();
        let price: f64 = product.try_get("price").unwrap_or(0.0);
        let is_promo: bool = product.try_get("is_promotion").unwrap_or(false);
        let promo_price: Option<f64> = product.try_get("promotional_price").ok().flatten();

        let price_display = if is_promo {
            if let Some(pp) = promo_price {
                format!("{} FCFA (promo !)", pp as i64)
            } else {
                format!("{} FCFA", price as i64)
            }
        } else {
            format!("{} FCFA", price as i64)
        };

        for platform in &payload.platforms {
            let product_url = format!(
                "{}/product/{}?serviceId={}&utm_source={}&utm_medium=auto_post\
                 &utm_campaign=yukpo_dist&utm_content={}",
                yukpo_base, product_id, payload.service_id, platform, product_id
            );

            let caption = match &payload.message_template {
                Some(tpl) => tpl
                    .replace("{nom}", &name)
                    .replace("{prix}", &price_display)
                    .replace("{boutique}", &service_name)
                    .replace("{url}", &product_url),
                None => format!(
                    "🛒 {} — {}\n📍 Disponible chez {}\n\n👉 Commander: {}\n\n\
                     #yukpo #supermarche #{}",
                    name,
                    price_display,
                    service_name,
                    product_url,
                    service_name.to_lowercase().replace(' ', "")
                ),
            };

            sqlx::query(
                r#"INSERT INTO product_distribution_jobs
                   (user_id, service_id, product_id, platform, caption, product_url,
                    status, scheduled_for, created_at, updated_at)
                   VALUES ($1, $2, $3, $4, $5, $6, 'queued', COALESCE($7, NOW()), NOW(), NOW())"#,
            )
            .bind(user.id)
            .bind(payload.service_id)
            .bind(product_id)
            .bind(platform)
            .bind(&caption)
            .bind(&product_url)
            .bind(payload.schedule_at)
            .execute(&state.pg)
            .await
            .map_err(AppError::from)?;

            jobs_created += 1;
        }
    }

    Ok(Json(serde_json::json!({
        "success": true,
        "jobs_created": jobs_created,
        "products_count": products.len(),
        "platforms": payload.platforms,
        "message": format!("{} publication(s) programmée(s) vers {}", jobs_created, payload.platforms.join(", ")),
    })))
}

// ─────────────────────────────────────────────────────────────
// Règles de distribution automatique
// ─────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct DistributionRules {
    pub auto_distribute: bool,
    pub frequency: String, // "daily" | "weekly"
    pub products_per_day: i32,
    pub schedule_hour: i32, // 0-23
    pub target_platforms: Vec<String>,
    pub filter: String, // "all" | "promotions" | "new"
}

pub async fn get_distribution_rules(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(service_id): Path<i32>,
) -> AppResult<Json<DistributionRules>> {
    let row =
        sqlx::query("SELECT rules FROM distribution_rules WHERE user_id = $1 AND service_id = $2")
            .bind(user.id)
            .bind(service_id)
            .fetch_optional(&state.pg)
            .await
            .map_err(AppError::from)?;

    if let Some(r) = row {
        use sqlx::Row;
        let rules_json: serde_json::Value = r.try_get("rules").unwrap_or(serde_json::json!({}));
        let rules: DistributionRules =
            serde_json::from_value(rules_json).unwrap_or_else(|_| default_rules());
        Ok(Json(rules))
    } else {
        Ok(Json(default_rules()))
    }
}

pub async fn update_distribution_rules(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(service_id): Path<i32>,
    Json(rules): Json<DistributionRules>,
) -> AppResult<Json<serde_json::Value>> {
    // Validation basique
    if rules.products_per_day < 1 || rules.products_per_day > 50 {
        return Err(AppError::BadRequest(
            "products_per_day doit être entre 1 et 50".into(),
        ));
    }
    if rules.schedule_hour > 23 {
        return Err(AppError::BadRequest(
            "schedule_hour doit être entre 0 et 23".into(),
        ));
    }

    let rules_json = serde_json::to_value(&rules).map_err(|e| AppError::Internal(e.to_string()))?;

    sqlx::query(
        r#"INSERT INTO distribution_rules (user_id, service_id, rules, created_at, updated_at)
           VALUES ($1, $2, $3, NOW(), NOW())
           ON CONFLICT (user_id, service_id)
           DO UPDATE SET rules = EXCLUDED.rules, updated_at = NOW()"#,
    )
    .bind(user.id)
    .bind(service_id)
    .bind(rules_json)
    .execute(&state.pg)
    .await
    .map_err(AppError::from)?;

    Ok(Json(serde_json::json!({ "success": true })))
}

// ─────────────────────────────────────────────────────────────
// Historique & analytics distribution
// ─────────────────────────────────────────────────────────────

pub async fn get_distribution_history(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(service_id): Path<i32>,
) -> AppResult<Json<serde_json::Value>> {
    let rows = sqlx::query(
        r#"SELECT
               platform,
               COUNT(*) AS total_posts,
               COUNT(*) FILTER (WHERE status = 'completed') AS completed,
               COUNT(*) FILTER (WHERE status = 'failed')    AS failed,
               COALESCE(SUM(clicks_back), 0)                AS total_clicks,
               MAX(created_at)                              AS last_post_at
           FROM product_distribution_jobs
           WHERE user_id = $1 AND service_id = $2
           GROUP BY platform
           ORDER BY total_posts DESC"#,
    )
    .bind(user.id)
    .bind(service_id)
    .fetch_all(&state.pg)
    .await
    .map_err(AppError::from)?;

    use sqlx::Row;
    let stats: Vec<serde_json::Value> = rows
        .iter()
        .map(|r| {
            serde_json::json!({
                "platform":     r.try_get::<String, _>("platform").unwrap_or_default(),
                "total_posts":  r.try_get::<i64, _>("total_posts").unwrap_or(0),
                "completed":    r.try_get::<i64, _>("completed").unwrap_or(0),
                "failed":       r.try_get::<i64, _>("failed").unwrap_or(0),
                "clicks_back":  r.try_get::<i64, _>("total_clicks").unwrap_or(0),
                "last_post_at": r.try_get::<Option<DateTime<Utc>>, _>("last_post_at")
                                 .ok()
                                 .flatten(),
            })
        })
        .collect();

    // Récents jobs (20 derniers)
    let recent = sqlx::query(
        r#"SELECT j.id, j.platform, j.status, j.caption,
                  j.product_url, j.clicks_back, j.created_at,
                  p.name AS product_name
           FROM product_distribution_jobs j
           LEFT JOIN service_products p ON p.id = j.product_id
           WHERE j.user_id = $1 AND j.service_id = $2
           ORDER BY j.created_at DESC
           LIMIT 20"#,
    )
    .bind(user.id)
    .bind(service_id)
    .fetch_all(&state.pg)
    .await
    .map_err(AppError::from)?;

    let recent_jobs: Vec<serde_json::Value> = recent
        .iter()
        .map(|r| {
            use sqlx::Row;
            serde_json::json!({
                "id":           r.try_get::<i32, _>("id").unwrap_or(0),
                "platform":     r.try_get::<String, _>("platform").unwrap_or_default(),
                "status":       r.try_get::<String, _>("status").unwrap_or_default(),
                "product_name": r.try_get::<Option<String>, _>("product_name").ok().flatten(),
                "clicks_back":  r.try_get::<i64, _>("clicks_back").unwrap_or(0),
                "created_at":   r.try_get::<Option<DateTime<Utc>>, _>("created_at").ok().flatten(),
            })
        })
        .collect();

    Ok(Json(serde_json::json!({
        "by_platform": stats,
        "recent_jobs": recent_jobs,
    })))
}

// ─────────────────────────────────────────────────────────────
// Tracking click retour UTM
// ─────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ClickTrackParams {
    pub job_id: Option<i32>,
    pub platform: Option<String>,
    pub product_id: Option<i32>,
    pub service_id: Option<i32>,
}

pub async fn track_distribution_click(
    State(state): State<Arc<AppState>>,
    Query(params): Query<ClickTrackParams>,
) -> impl IntoResponse {
    // Incrémenter clicks_back sur le job
    if let Some(job_id) = params.job_id {
        let _ = sqlx::query(
            "UPDATE product_distribution_jobs SET clicks_back = clicks_back + 1, updated_at = NOW() WHERE id = $1"
        )
        .bind(job_id)
        .execute(&state.pg)
        .await;
    }

    // Insérer record de tracking
    let _ = sqlx::query(
        r#"INSERT INTO distribution_click_tracking
           (product_distribution_job_id, platform, product_id, service_id, clicked_at)
           VALUES ($1, $2, $3, $4, NOW())"#,
    )
    .bind(params.job_id)
    .bind(params.platform.as_deref().unwrap_or("unknown"))
    .bind(params.product_id)
    .bind(params.service_id)
    .execute(&state.pg)
    .await;

    // Redirection vers Yukpo (deep link ou web)
    let product_url = match (params.product_id, params.service_id) {
        (Some(pid), Some(sid)) => {
            format!("https://yukpomnang.com/product/{}?serviceId={}", pid, sid)
        }
        _ => "https://yukpomnang.com".to_string(),
    };

    Response::builder()
        .status(StatusCode::FOUND)
        .header(
            header::LOCATION,
            HeaderValue::from_str(&product_url).unwrap(),
        )
        .body(axum::body::Body::empty())
        .unwrap()
}

// ─────────────────────────────────────────────────────────────
// Feeds produits (publics)
// ─────────────────────────────────────────────────────────────

pub async fn google_shopping_feed(
    State(state): State<Arc<AppState>>,
    Path(partner_id): Path<i32>,
) -> impl IntoResponse {
    match product_feed_service::generate_google_shopping_xml(&state.pg, partner_id).await {
        Ok(xml) => Response::builder()
            .status(StatusCode::OK)
            .header(
                header::CONTENT_TYPE,
                HeaderValue::from_static("application/rss+xml; charset=utf-8"),
            )
            .body(axum::body::Body::from(xml))
            .unwrap(),
        Err(e) => Response::builder()
            .status(StatusCode::INTERNAL_SERVER_ERROR)
            .body(axum::body::Body::from(format!("Erreur: {e:?}")))
            .unwrap(),
    }
}

pub async fn csv_export_feed(
    State(state): State<Arc<AppState>>,
    Path(partner_id): Path<i32>,
    Query(params): Query<CsvExportParams>,
) -> impl IntoResponse {
    let format = params.format.as_deref().unwrap_or("generic");
    match product_feed_service::generate_csv_export(&state.pg, partner_id, format).await {
        Ok(csv) => {
            let filename = format!("yukpo_produits_{}.csv", partner_id);
            Response::builder()
                .status(StatusCode::OK)
                .header(
                    header::CONTENT_TYPE,
                    HeaderValue::from_static("text/csv; charset=utf-8"),
                )
                .header(
                    header::CONTENT_DISPOSITION,
                    HeaderValue::from_str(&format!("attachment; filename=\"{}\"", filename))
                        .unwrap_or_else(|_| HeaderValue::from_static("attachment")),
                )
                .body(axum::body::Body::from(csv))
                .unwrap()
        }
        Err(e) => Response::builder()
            .status(StatusCode::INTERNAL_SERVER_ERROR)
            .body(axum::body::Body::from(format!("Erreur: {e:?}")))
            .unwrap(),
    }
}

// ─────────────────────────────────────────────────────────────
// Types internes
// ─────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct OAuthCallbackParams {
    pub code: Option<String>,
    pub state: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CsvExportParams {
    pub format: Option<String>, // "generic" | "jumia" | "google"
}

#[derive(Debug, Deserialize)]
struct FacebookTokenResponse {
    access_token: String,
    token_type: Option<String>,
    expires_in: Option<i64>,
    scope: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
struct FacebookPagesResponse {
    data: Vec<FacebookPage>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
struct FacebookPage {
    id: String,
    name: String,
    access_token: String,
    category: Option<String>,
}

fn default_rules() -> DistributionRules {
    DistributionRules {
        auto_distribute: false,
        frequency: "daily".to_string(),
        products_per_day: 5,
        schedule_hour: 18,
        target_platforms: vec!["facebook".to_string(), "whatsapp".to_string()],
        filter: "all".to_string(),
    }
}

fn oauth_success_page(platform: &str) -> String {
    format!(
        "<html><head><meta charset='utf-8'><title>Succès</title></head>\
         <body style=\"font-family:Arial;padding:32px;text-align:center;\">\
         <h2 style=\"color:#10B981\">✅ Connexion {platform} réussie !</h2>\
         <p>Vous pouvez revenir dans Yukpo.</p>\
         <script>setTimeout(function(){{window.close();}},2500);</script>\
         </body></html>"
    )
}

// ─────────────────────────────────────────────────────────────
// Sync catalogue complet → Facebook Commerce Manager (+ WhatsApp auto)
// ─────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CatalogSyncRequest {
    pub service_id: i32,
}

/// POST /api/social/catalog/sync
/// Synchronise tous les produits actifs du service vers le catalogue Facebook.
/// Le catalogue Facebook est automatiquement synchronisé avec WhatsApp Business.
pub async fn sync_catalog(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<CatalogSyncRequest>,
) -> AppResult<Json<serde_json::Value>> {
    let summary =
        product_distribution_worker::sync_full_catalog(state, user.id, payload.service_id).await?;

    Ok(Json(serde_json::json!({
        "success": true,
        "total_products": summary.total_products,
        "synced": summary.synced,
        "errors": summary.errors,
        "catalog_id": summary.catalog_id,
        "message": format!(
            "{} produit(s) synchronisés vers le catalogue Facebook (et WhatsApp Business automatiquement).",
            summary.synced
        ),
    })))
}

/// PUT /api/social/accounts/catalog-id
/// Permet au partenaire de renseigner son catalog_id Facebook depuis le mobile.
#[derive(Debug, Deserialize)]
pub struct UpdateCatalogIdRequest {
    pub catalog_id: String,
}

pub async fn update_catalog_id(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<UpdateCatalogIdRequest>,
) -> AppResult<Json<serde_json::Value>> {
    if payload.catalog_id.trim().is_empty() {
        return Err(AppError::BadRequest("catalog_id invalide".into()));
    }

    // Mettre à jour le metadata JSON pour ajouter le catalog_id
    let rows_updated = sqlx::query(
        r#"UPDATE social_accounts
           SET metadata = jsonb_set(
               COALESCE(metadata, '{}'),
               '{catalog_id}',
               $1::jsonb
           ),
           updated_at = NOW()
           WHERE user_id = $2 AND platform = 'facebook'"#,
    )
    .bind(serde_json::json!(payload.catalog_id))
    .bind(user.id)
    .execute(&state.pg)
    .await
    .map_err(AppError::from)?
    .rows_affected();

    if rows_affected_is_zero(rows_updated) {
        return Err(AppError::BadRequest(
            "Connectez d'abord votre compte Facebook avant de renseigner le catalog_id.".into(),
        ));
    }

    Ok(Json(serde_json::json!({
        "success": true,
        "catalog_id": payload.catalog_id,
        "message": "Catalog ID enregistré. Vous pouvez maintenant synchroniser votre catalogue.",
    })))
}

fn rows_affected_is_zero(n: u64) -> bool {
    n == 0
}

fn oauth_error_page(platform: &str, error: &str) -> String {
    format!(
        "<html><head><meta charset='utf-8'><title>Erreur</title></head>\
         <body style=\"font-family:Arial;padding:32px;text-align:center;\">\
         <h2 style=\"color:#EF4444\">❌ Connexion {platform} échouée</h2>\
         <p>{error}</p>\
         </body></html>"
    )
}
