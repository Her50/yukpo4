// Service de publication réelle sur Facebook via Graph API v19.0
//
// Fonctionnalités couvertes :
//  1. Post sur Page Facebook (texte + lien ou photo + légende)
//  2. Upload photo produit vers la Page
//  3. Sync catalogue produits → Facebook Commerce Manager (= WhatsApp Catalog auto)
//  4. Récupération page_access_token depuis user token
//
// Prérequis Meta App Review (à soumettre sur developers.facebook.com) :
//   - pages_manage_posts       → poster sur une Page
//   - pages_read_engagement    → lire les stats
//   - instagram_content_publish → publier sur Instagram lié
//   - catalog_management       → sync catalogue Commerce Manager

use reqwest::Client;
use serde::{Deserialize, Serialize};

use crate::core::types::{AppError, AppResult};

const GRAPH_BASE: &str = "https://graph.facebook.com/v19.0";

// ─────────────────────────────────────────────────────────────────────────────
// Publication sur Page Facebook
// ─────────────────────────────────────────────────────────────────────────────

/// Publie un produit sur une Page Facebook.
/// Si une image est disponible, elle est uploadée et jointe au post.
/// Sinon un post texte + lien est créé.
pub async fn post_product_to_page(
    http: &Client,
    page_access_token: &str,
    page_id: &str,
    caption: &str,
    link: &str,
    image_url: Option<&str>,
) -> AppResult<String> {
    if let Some(img) = image_url {
        if !img.is_empty() {
            return upload_photo_post(http, page_access_token, page_id, img, caption).await;
        }
    }
    post_link(http, page_access_token, page_id, caption, link).await
}

/// POST /{page_id}/photos — photo uploadée par URL + légende
async fn upload_photo_post(
    http: &Client,
    access_token: &str,
    page_id: &str,
    image_url: &str,
    caption: &str,
) -> AppResult<String> {
    #[derive(Deserialize)]
    struct Resp {
        id: String,
        post_id: Option<String>,
    }

    let resp: Resp = http
        .post(format!("{}/{}/photos", GRAPH_BASE, page_id))
        .form(&[
            ("url", image_url),
            ("caption", caption),
            ("access_token", access_token),
        ])
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("[FB photo] réseau: {e}")))?
        .error_for_status()
        .map_err(|e| {
            AppError::Internal(format!(
                "[FB photo] statut HTTP: {e}. Vérifiez que pages_manage_posts est approuvé."
            ))
        })?
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("[FB photo] parse JSON: {e}")))?;

    // L'API retourne id (photo) et post_id (le vrai post) — on préfère post_id
    Ok(resp.post_id.unwrap_or(resp.id))
}

/// POST /{page_id}/feed — post texte + lien uniquement
async fn post_link(
    http: &Client,
    access_token: &str,
    page_id: &str,
    message: &str,
    link: &str,
) -> AppResult<String> {
    #[derive(Deserialize)]
    struct Resp {
        id: String,
    }

    let resp: Resp = http
        .post(format!("{}/{}/feed", GRAPH_BASE, page_id))
        .form(&[
            ("message", message),
            ("link", link),
            ("access_token", access_token),
        ])
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("[FB feed] réseau: {e}")))?
        .error_for_status()
        .map_err(|e| {
            AppError::Internal(format!(
                "[FB feed] statut HTTP: {e}. Vérifiez que pages_manage_posts est approuvé."
            ))
        })?
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("[FB feed] parse JSON: {e}")))?;

    Ok(resp.id)
}

// ─────────────────────────────────────────────────────────────────────────────
// Récupération page_access_token
// ─────────────────────────────────────────────────────────────────────────────

/// Récupère le page_access_token d'une page spécifique
/// depuis le user_access_token (GET /me/accounts).
pub async fn get_page_token(
    http: &Client,
    user_access_token: &str,
    page_id: &str,
) -> AppResult<Option<String>> {
    #[derive(Deserialize)]
    struct PageEntry {
        id: String,
        access_token: String,
    }
    #[derive(Deserialize)]
    struct AccountsResp {
        data: Vec<PageEntry>,
    }

    let resp: AccountsResp = http
        .get(format!("{}/me/accounts", GRAPH_BASE))
        .query(&[("access_token", user_access_token)])
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("[FB accounts] réseau: {e}")))?
        .error_for_status()
        .map_err(|e| AppError::Internal(format!("[FB accounts] HTTP: {e}")))?
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("[FB accounts] parse: {e}")))?;

    Ok(resp.data.into_iter().find(|p| p.id == page_id).map(|p| p.access_token))
}

/// Retourne la première page managée par cet utilisateur
pub async fn get_first_page(
    http: &Client,
    user_access_token: &str,
) -> AppResult<Option<FacebookPage>> {
    #[derive(Deserialize)]
    struct AccountsResp {
        data: Vec<FacebookPage>,
    }

    let resp: AccountsResp = http
        .get(format!("{}/me/accounts", GRAPH_BASE))
        .query(&[("access_token", user_access_token)])
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("[FB first_page] réseau: {e}")))?
        .error_for_status()
        .map_err(|e| AppError::Internal(format!("[FB first_page] HTTP: {e}")))?
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("[FB first_page] parse: {e}")))?;

    Ok(resp.data.into_iter().next())
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct FacebookPage {
    pub id: String,
    pub name: String,
    pub access_token: String,
    pub category: Option<String>,
}

// ─────────────────────────────────────────────────────────────────────────────
// Sync catalogue → Facebook Commerce Manager
// (Le catalogue FB est automatiquement synchronisé avec WhatsApp Business)
// ─────────────────────────────────────────────────────────────────────────────

/// Synchronise un batch de produits vers un catalogue Facebook Commerce Manager.
/// La même opération met à jour le catalogue WhatsApp Business (lié automatiquement).
///
/// catalog_id : trouvé dans business.facebook.com → Data Sources → Catalogues
pub async fn sync_catalog_batch(
    http: &Client,
    catalog_id: &str,
    user_access_token: &str,
    products: &[CatalogProduct],
) -> AppResult<CatalogSyncResult> {
    if products.is_empty() {
        return Ok(CatalogSyncResult {
            synced: 0,
            errors: vec![],
        });
    }

    // Limiter à 5 000 items par appel (limite Meta)
    let chunks: Vec<&[CatalogProduct]> = products.chunks(4999).collect();
    let mut total_synced = 0usize;
    let mut all_errors: Vec<String> = vec![];

    for chunk in chunks {
        let requests: Vec<serde_json::Value> = chunk
            .iter()
            .map(|p| {
                let mut data = serde_json::json!({
                    "name":         p.name,
                    "description":  p.description.as_deref().unwrap_or(&p.name),
                    "price":        format!("{:.0}", (p.price * 100.0) as i64), // centimes
                    "currency":     "XAF",
                    "availability": if p.in_stock { "in stock" } else { "out of stock" },
                    "condition":    "new",
                    "url":          p.product_url,
                    "brand":        p.store_name.as_deref().unwrap_or(""),
                });

                if let Some(img) = &p.image_url {
                    if !img.is_empty() {
                        data["image_url"] = serde_json::Value::String(img.clone());
                    }
                }
                if let Some(sale) = p.sale_price {
                    data["sale_price"] =
                        serde_json::Value::String(format!("{:.0}", (sale * 100.0) as i64));
                    data["sale_price_currency"] = serde_json::Value::String("XAF".to_string());
                }

                serde_json::json!({
                    "method":      "CREATE_OR_UPDATE",
                    "retailer_id": format!("YKP-{}", p.id),
                    "data":        data,
                })
            })
            .collect();

        #[derive(Deserialize)]
        struct BatchResp {
            handles: Option<Vec<String>>,
        }
        #[derive(Deserialize)]
        struct ErrorResp {
            error: Option<FbError>,
        }
        #[derive(Deserialize)]
        struct FbError {
            message: String,
        }

        let body = serde_json::json!({ "allow_upsert": true, "requests": requests });

        let raw = http
            .post(format!("{}/{}/items_batch", GRAPH_BASE, catalog_id))
            .query(&[("access_token", user_access_token)])
            .json(&body)
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("[FB catalog] réseau: {e}")))?
            .error_for_status()
            .map_err(|e| AppError::Internal(format!("[FB catalog] HTTP: {e}")))?
            .text()
            .await
            .map_err(|e| AppError::Internal(format!("[FB catalog] text: {e}")))?;

        // Vérifier erreur applicative Meta
        if let Ok(err_resp) = serde_json::from_str::<ErrorResp>(&raw) {
            if let Some(err) = err_resp.error {
                all_errors.push(err.message);
                continue;
            }
        }

        let batch_resp: BatchResp =
            serde_json::from_str(&raw).unwrap_or(BatchResp { handles: None });

        total_synced += batch_resp.handles.map(|h| h.len()).unwrap_or(chunk.len());
    }

    Ok(CatalogSyncResult {
        synced: total_synced,
        errors: all_errors,
    })
}

/// Récupère le catalog_id associé à un Business Manager
pub async fn get_catalog_id(
    http: &Client,
    business_id: &str,
    user_access_token: &str,
) -> AppResult<Option<String>> {
    #[derive(Deserialize)]
    struct Cat {
        id: String,
    }
    #[derive(Deserialize)]
    struct CatResp {
        data: Vec<Cat>,
    }

    let resp: CatResp = http
        .get(format!(
            "{}/{}/owned_product_catalogs",
            GRAPH_BASE, business_id
        ))
        .query(&[("access_token", user_access_token)])
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("[FB catalog_id] réseau: {e}")))?
        .error_for_status()
        .map_err(|e| AppError::Internal(format!("[FB catalog_id] HTTP: {e}")))?
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("[FB catalog_id] parse: {e}")))?;

    Ok(resp.data.into_iter().next().map(|c| c.id))
}

// ─────────────────────────────────────────────────────────────────────────────
// Types publics
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CatalogProduct {
    pub id: i32,
    pub name: String,
    pub description: Option<String>,
    pub price: f64,
    pub sale_price: Option<f64>,
    pub image_url: Option<String>,
    pub product_url: String,
    pub store_name: Option<String>,
    pub in_stock: bool,
}

#[derive(Debug)]
pub struct CatalogSyncResult {
    pub synced: usize,
    pub errors: Vec<String>,
}
