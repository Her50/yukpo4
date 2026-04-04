// Worker de distribution produits multi-canaux
//
// Ce service tourne en background (tokio::spawn) et traite les jobs en attente
// dans la table `product_distribution_jobs` toutes les 60 secondes.
//
// Dispatch réel par plateforme :
//   facebook   → facebook_publisher_service::post_product_to_page()
//   instagram  → instagram_publisher_service::publish_product_image()
//   whatsapp   → génère un lien wa.me avec le message pré-formaté (pas d'API broadcast)
//   google_shopping → feed XML auto (aucun job actif, le feed est une URL statique)
//   jumia      → export CSV auto (idem, pas de job actif)

use std::sync::Arc;

use log::{error, info, warn};
use reqwest::Client;
use sqlx::Row;

use crate::{
    core::types::AppError,
    services::{
        facebook_publisher_service::{self, CatalogProduct},
        instagram_publisher_service, meta_token_service,
    },
    state::AppState,
};

const WORKER_INTERVAL_SECS: u64 = 60;
const MAX_JOBS_PER_TICK: i64 = 20;
const MAX_ATTEMPTS: i32 = 3;

// ─────────────────────────────────────────────────────────────────────────────
// Démarrage du worker
// ─────────────────────────────────────────────────────────────────────────────

pub fn start_product_distribution_worker(state: Arc<AppState>) {
    tokio::spawn(async move {
        info!(
            "[ProductDistribution] Worker démarré (intervalle {}s)",
            WORKER_INTERVAL_SECS
        );
        loop {
            tokio::time::sleep(tokio::time::Duration::from_secs(WORKER_INTERVAL_SECS)).await;
            if let Err(e) = process_due_jobs(state.clone()).await {
                error!("[ProductDistribution] Erreur tick: {e:?}");
            }
        }
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Traitement des jobs dus
// ─────────────────────────────────────────────────────────────────────────────

async fn process_due_jobs(state: Arc<AppState>) -> Result<(), AppError> {
    let jobs = sqlx::query(
        r#"SELECT id, user_id, service_id, product_id, platform, caption, product_url, attempt
           FROM product_distribution_jobs
           WHERE status = 'queued'
             AND scheduled_for <= NOW()
             AND attempt < $1
           ORDER BY scheduled_for ASC
           LIMIT $2
           FOR UPDATE SKIP LOCKED"#,
    )
    .bind(MAX_ATTEMPTS)
    .bind(MAX_JOBS_PER_TICK)
    .fetch_all(&state.pg)
    .await
    .map_err(AppError::from)?;

    if jobs.is_empty() {
        return Ok(());
    }

    info!("[ProductDistribution] {} job(s) à traiter", jobs.len());

    let http = Client::new();

    for job in &jobs {
        let job_id: i32 = job.try_get("id").unwrap_or(0);
        let user_id: i32 = job.try_get("user_id").unwrap_or(0);
        let service_id: i32 = job.try_get("service_id").unwrap_or(0);
        let product_id: i32 = job.try_get("product_id").unwrap_or(0);
        let platform: String = job.try_get("platform").unwrap_or_default();
        let caption: String = job.try_get("caption").unwrap_or_default();
        let product_url: String = job.try_get("product_url").unwrap_or_default();

        // Marquer en processing
        let _ = sqlx::query(
            "UPDATE product_distribution_jobs SET status='processing', attempt=attempt+1, updated_at=NOW() WHERE id=$1"
        )
        .bind(job_id)
        .execute(&state.pg)
        .await;

        // Charger l'image du produit
        let image_url = load_product_image(&state, service_id, product_id).await;

        // Dispatcher vers la bonne plateforme
        let result = dispatch(
            &state,
            &http,
            job_id,
            user_id,
            &platform,
            &caption,
            &product_url,
            image_url.as_deref(),
        )
        .await;

        match result {
            Ok(external_id) => {
                let _ = sqlx::query(
                    r#"UPDATE product_distribution_jobs
                       SET status='completed', external_post_id=$1, updated_at=NOW()
                       WHERE id=$2"#,
                )
                .bind(&external_id)
                .bind(job_id)
                .execute(&state.pg)
                .await;
                info!(
                    "[ProductDistribution] ✅ job={job_id} plateforme={platform} post={external_id}"
                );
            }
            Err(e) => {
                let err_msg = format!("{e:?}");
                let attempt: i32 = job.try_get("attempt").unwrap_or(0) + 1;
                // Si on a atteint MAX_ATTEMPTS → failed définitif, sinon re-queue
                let new_status = if attempt >= MAX_ATTEMPTS {
                    "failed"
                } else {
                    "queued"
                };

                let _ = sqlx::query(
                    r#"UPDATE product_distribution_jobs
                       SET status=$1, error_message=$2, updated_at=NOW()
                       WHERE id=$3"#,
                )
                .bind(new_status)
                .bind(&err_msg)
                .bind(job_id)
                .execute(&state.pg)
                .await;

                if new_status == "failed" {
                    error!("[ProductDistribution] ❌ job={job_id} plateforme={platform} FAILED: {err_msg}");
                } else {
                    warn!("[ProductDistribution] ⚠️ job={job_id} plateforme={platform} retry ({attempt}/{MAX_ATTEMPTS}): {err_msg}");
                }
            }
        }
    }

    Ok(())
}

// ─────────────────────────────────────────────────────────────────────────────
// Dispatch par plateforme
// ─────────────────────────────────────────────────────────────────────────────

async fn dispatch(
    state: &Arc<AppState>,
    http: &Client,
    _job_id: i32,
    user_id: i32,
    platform: &str,
    caption: &str,
    product_url: &str,
    image_url: Option<&str>,
) -> Result<String, AppError> {
    match platform {
        "facebook" => {
            dispatch_facebook(state, http, user_id, caption, product_url, image_url).await
        }
        "instagram" => dispatch_instagram(state, http, user_id, caption, image_url).await,
        "whatsapp" => {
            // WhatsApp: on génère le lien wa.me — aucune API à appeler côté serveur.
            // La vraie publication se fait via le bot WhatsApp Business (scope séparé).
            // Pour l'instant on crée un external_id symbolique indiquant que le
            // message est prêt à être envoyé manuellement ou via webhook.
            let wa_link = format!("https://wa.me/?text={}", urlencoding::encode(caption));
            Ok(format!("whatsapp_link:{}", wa_link))
        }
        unknown => Err(AppError::BadRequest(format!(
            "Plateforme inconnue: {unknown}. Plateformes supportées: facebook, instagram, whatsapp."
        ))),
    }
}

async fn dispatch_facebook(
    state: &Arc<AppState>,
    http: &Client,
    user_id: i32,
    caption: &str,
    product_url: &str,
    image_url: Option<&str>,
) -> Result<String, AppError> {
    // 1. Charger et valider le token
    let token = meta_token_service::load_valid_token(&state.pg, http, user_id, "facebook").await?;

    // 2. Extraire le page_id et page_access_token depuis le metadata
    let page_id = meta_token_service::extract_first_page_id(&token.metadata).ok_or_else(|| {
        AppError::BadRequest(
            "Aucune Page Facebook trouvée. Reconnectez votre compte Facebook \
                 dans Diffusion → Plateformes."
                .into(),
        )
    })?;

    // 3. Récupérer le page_access_token depuis le metadata stocké
    //    (il est enregistré lors du callback OAuth — facebook_callback dans product_distribution_controller)
    let page_token = meta_token_service::extract_page_access_token(&token.metadata, &page_id)
        .unwrap_or_else(|| {
            // Fallback: utiliser le user token (moins idéal mais peut fonctionner)
            token.access_token.clone()
        });

    // 4. Publier
    let post_id = facebook_publisher_service::post_product_to_page(
        http,
        &page_token,
        &page_id,
        caption,
        product_url,
        image_url,
    )
    .await?;

    Ok(post_id)
}

async fn dispatch_instagram(
    state: &Arc<AppState>,
    http: &Client,
    user_id: i32,
    caption: &str,
    image_url: Option<&str>,
) -> Result<String, AppError> {
    // Instagram nécessite obligatoirement une image
    let img = image_url.ok_or_else(|| {
        AppError::BadRequest(
            "Instagram nécessite une image. Ce produit n'a pas d'image associée.".into(),
        )
    })?;

    // 1. Charger le token Facebook (Instagram est lié via la Page FB)
    let token = meta_token_service::load_valid_token(&state.pg, http, user_id, "facebook").await?;

    let page_id = meta_token_service::extract_first_page_id(&token.metadata).ok_or_else(|| {
        AppError::BadRequest(
            "Aucune Page Facebook trouvée. Instagram Business doit être lié à une Page Facebook."
                .into(),
        )
    })?;

    let page_token = meta_token_service::extract_page_access_token(&token.metadata, &page_id)
        .unwrap_or_else(|| token.access_token.clone());

    // 2. Récupérer l'ig_user_id
    let ig_user_id =
        instagram_publisher_service::get_ig_business_account_id(http, &page_id, &page_token)
            .await?
            .ok_or_else(|| {
                AppError::BadRequest(
                    "Aucun compte Instagram Business lié à cette Page Facebook. \
                     Connectez un compte Instagram Business dans Meta Business Suite."
                        .into(),
                )
            })?;

    // 3. Publier
    let media_id = instagram_publisher_service::publish_product_image(
        http,
        &ig_user_id,
        &page_token,
        img,
        caption,
    )
    .await?;

    Ok(media_id)
}

// ─────────────────────────────────────────────────────────────────────────────
// Sync catalogue complet (Facebook Commerce Manager → WhatsApp auto)
// ─────────────────────────────────────────────────────────────────────────────

/// Synchronise tous les produits actifs d'un service vers le catalogue Facebook.
/// Déclenché manuellement via POST /api/social/catalog/sync ou automatiquement.
pub async fn sync_full_catalog(
    state: Arc<AppState>,
    user_id: i32,
    service_id: i32,
) -> Result<CatalogSyncSummary, AppError> {
    let http = Client::new();

    // 1. Charger le token
    let token = meta_token_service::load_valid_token(&state.pg, &http, user_id, "facebook").await?;

    // 2. Obtenir le catalog_id (stocké dans metadata ou à chercher via API)
    let catalog_id = meta_token_service::extract_catalog_id(&token.metadata).ok_or_else(|| {
        AppError::BadRequest(
            "catalog_id non configuré. Renseignez votre Catalog ID Facebook dans \
             Diffusion → Plateformes → Facebook → Paramètres avancés."
                .into(),
        )
    })?;

    // 3. Charger les produits depuis la DB
    let rows = sqlx::query(
        r#"SELECT
               p.id,
               p.name,
               p.description,
               p.price,
               p.promotional_price,
               p.image_url,
               p.stock,
               p.is_promotion,
               s.data->>'nom'  AS store_name
           FROM service_products p
           JOIN services s ON s.id = p.service_id
           WHERE p.service_id = $1
             AND p.is_active = true
           ORDER BY p.id
           LIMIT 5000"#,
    )
    .bind(service_id)
    .fetch_all(&state.pg)
    .await
    .map_err(AppError::from)?;

    let yukpo_base = "https://yukpomnang.com";
    let products: Vec<CatalogProduct> = rows
        .iter()
        .map(|r| {
            let id: i32 = r.try_get("id").unwrap_or(0);
            let price: f64 = r.try_get("price").unwrap_or(0.0);
            let promo: Option<f64> = r.try_get("promotional_price").ok().flatten();
            let stock: Option<i32> = r.try_get("stock").ok().flatten();
            CatalogProduct {
                id,
                name: r.try_get("name").unwrap_or_default(),
                description: r.try_get("description").ok().flatten(),
                price,
                sale_price: if r.try_get("is_promotion").unwrap_or(false) {
                    promo
                } else {
                    None
                },
                image_url: r.try_get("image_url").ok().flatten(),
                product_url: format!(
                    "{}/product/{}?serviceId={}&utm_source=facebook_catalog&utm_campaign=yukpo",
                    yukpo_base, id, service_id
                ),
                store_name: r.try_get("store_name").ok().flatten(),
                in_stock: stock.map(|s| s > 0).unwrap_or(true),
            }
        })
        .collect();

    let total = products.len();

    // 4. Sync vers Facebook Commerce Manager
    let result = facebook_publisher_service::sync_catalog_batch(
        &http,
        &catalog_id,
        &token.access_token,
        &products,
    )
    .await?;

    info!(
        "[ProductDistribution] Sync catalogue: {}/{} produits, {} erreurs",
        result.synced,
        total,
        result.errors.len()
    );

    Ok(CatalogSyncSummary {
        total_products: total,
        synced: result.synced,
        errors: result.errors,
        catalog_id,
    })
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async fn load_product_image(
    state: &Arc<AppState>,
    service_id: i32,
    product_id: i32,
) -> Option<String> {
    let row = sqlx::query("SELECT image_url FROM service_products WHERE id=$1 AND service_id=$2")
        .bind(product_id)
        .bind(service_id)
        .fetch_optional(&state.pg)
        .await
        .ok()
        .flatten()?;

    row.try_get::<Option<String>, _>("image_url")
        .ok()
        .flatten()
        .filter(|s| !s.is_empty())
}

#[derive(Debug, serde::Serialize)]
pub struct CatalogSyncSummary {
    pub total_products: usize,
    pub synced: usize,
    pub errors: Vec<String>,
    pub catalog_id: String,
}
