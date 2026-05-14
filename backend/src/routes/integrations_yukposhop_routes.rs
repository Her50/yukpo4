//! Piste 1 — Bridge YukpoShop -> Yukpo Rust marketplace.
//!
//! Reçoit les produits publiés par YukpoShop (YukpoPro Python via FastAPI)
//! et les upsert dans la table `services` pour bénéficier de la recherche
//! native + matching IA + GPS-géolocalisation.
//!
//! Authentification :
//!   - Header X-Yukpo-Signature : HMAC-SHA256 base64 du body
//!   - Header X-Yukpo-Timestamp : timestamp UNIX (anti-replay 5 min)
//!   - Secret partagé `YUKPOSHOP_BRIDGE_HMAC_KEY` (env var Fly secret)
//!
//! Idempotency : la clé (source_app, external_id) dans la table
//! `external_product_links` permet à Rust d'upsert plutôt que dupliquer
//! quand le même produit est re-pushé.

use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::post,
    Json, Router,
};
use base64::Engine;
use hmac::{Hmac, Mac};
use log::{info, warn};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::Sha256;
use std::sync::Arc;

use crate::state::AppState;

const REPLAY_WINDOW_S: i64 = 300; // 5 min anti-replay
const SOURCE_APP: &str = "yukposhop";

// ─── Schemas ─────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct YukposhopVendeur {
    pub email: String,
    #[serde(default)]
    pub nom_affiche: Option<String>,
    #[serde(default)]
    pub boutique_slug: Option<String>,
    #[serde(default)]
    pub boutique_url: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct YukposhopProduit {
    pub titre: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub prix: f64,
    #[serde(default = "default_devise")]
    pub devise: String,
    #[serde(default)]
    pub stock: i32,
    #[serde(default)]
    pub photos_urls: Vec<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    pub slug: String,
    #[serde(default)]
    pub categorie: Option<String>,
    #[serde(default = "default_pays")]
    pub pays: String,
}

fn default_devise() -> String {
    "XAF".into()
}
fn default_pays() -> String {
    "CM".into()
}

#[derive(Debug, Deserialize)]
pub struct YukposhopRetour {
    #[serde(default)]
    pub url_storefront: Option<String>,
    #[serde(default)]
    pub whatsapp_contact: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct YukposhopSyncRequest {
    pub schema_version: i32,
    pub source: String,
    pub external_id: String,
    #[serde(default)]
    pub external_updated_at: Option<String>,
    pub vendeur: YukposhopVendeur,
    pub produit: YukposhopProduit,
    #[serde(default)]
    pub retour_au_marchand: Option<YukposhopRetour>,
}

#[derive(Debug, Serialize)]
pub struct SyncResponse {
    pub ok: bool,
    pub rust_service_id: i32,
    pub action: String, // "created" | "updated"
}

// ─── HMAC verification ──────────────────────────────────────────────────

/// Comparaison constant-time pour signatures (anti-timing attack).
fn const_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut diff = 0u8;
    for (x, y) in a.iter().zip(b.iter()) {
        diff |= x ^ y;
    }
    diff == 0
}

fn verify_hmac(body: &[u8], headers: &HeaderMap, secret: &str) -> Result<(), &'static str> {
    let sig_b64 = headers
        .get("x-yukpo-signature")
        .and_then(|v| v.to_str().ok())
        .ok_or("missing X-Yukpo-Signature")?;
    let ts = headers
        .get("x-yukpo-timestamp")
        .and_then(|v| v.to_str().ok())
        .ok_or("missing X-Yukpo-Timestamp")?;

    // Anti-replay : timestamp doit être dans une fenêtre de ±5 min
    let ts_int: i64 = ts.parse().map_err(|_| "invalid timestamp")?;
    let now = chrono::Utc::now().timestamp();
    if (now - ts_int).abs() > REPLAY_WINDOW_S {
        return Err("timestamp out of replay window");
    }

    // Compute expected signature: HMAC-SHA256(timestamp + "." + body)
    let key_bytes = base64::engine::general_purpose::STANDARD
        .decode(secret)
        .unwrap_or_else(|_| secret.as_bytes().to_vec());
    let mut mac = <Hmac<Sha256> as Mac>::new_from_slice(&key_bytes).map_err(|_| "bad hmac key")?;
    mac.update(ts.as_bytes());
    mac.update(b".");
    mac.update(body);
    let expected_b64 =
        base64::engine::general_purpose::STANDARD.encode(mac.finalize().into_bytes());

    if !const_time_eq(expected_b64.as_bytes(), sig_b64.as_bytes()) {
        return Err("HMAC mismatch");
    }
    Ok(())
}

// ─── Handler ────────────────────────────────────────────────────────────

pub async fn sync_yukposhop_produit(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    body: axum::body::Bytes,
) -> impl IntoResponse {
    // 1. Verify HMAC
    let secret = std::env::var("YUKPOSHOP_BRIDGE_HMAC_KEY").unwrap_or_default();
    if secret.is_empty() {
        warn!("[yukposhop bridge] YUKPOSHOP_BRIDGE_HMAC_KEY non configuré — refus");
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({"ok": false, "error": "bridge non configuré côté serveur"})),
        )
            .into_response();
    }
    if let Err(e) = verify_hmac(&body, &headers, &secret) {
        warn!("[yukposhop bridge] HMAC reject: {e}");
        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({"ok": false, "error": e})),
        )
            .into_response();
    }

    // 2. Parse JSON
    let req: YukposhopSyncRequest = match serde_json::from_slice(&body) {
        Ok(r) => r,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"ok": false, "error": format!("invalid json: {e}")})),
            )
                .into_response();
        }
    };
    if req.source != SOURCE_APP {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({"ok": false, "error": "source mismatch"})),
        )
            .into_response();
    }

    // 3. Resolve or create user
    let user_id = match resolve_or_create_user(&state.pg, &req.vendeur).await {
        Ok(id) => id,
        Err(e) => {
            warn!("[yukposhop bridge] user resolve error: {e}");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"ok": false, "error": format!("user resolve: {e}")})),
            )
                .into_response();
        }
    };

    // 4. Compose data JSONB pour services
    let storefront_url = req.retour_au_marchand.as_ref().and_then(|r| r.url_storefront.clone());
    let wa_contact = req.retour_au_marchand.as_ref().and_then(|r| r.whatsapp_contact.clone());
    let data: Value = json!({
        "titre":            req.produit.titre,
        "description":      req.produit.description,
        "prix":             req.produit.prix,
        "devise":           req.produit.devise,
        "stock":            req.produit.stock,
        "photos_urls":      req.produit.photos_urls,
        "tags":             req.produit.tags,
        "pays":             req.produit.pays,
        "type_produit":     "ecommerce",
        "boutique_url":     storefront_url,
        "whatsapp_contact": wa_contact,
        "vendeur_email":    req.vendeur.email,
        "vendeur_nom":      req.vendeur.nom_affiche,
        "external_source":  SOURCE_APP,
        "external_id":      req.external_id,
    });

    // 5. Upsert via external_product_links
    //
    // On utilise sqlx::query() runtime (pas le macro query!()) car la table
    // external_product_links est créée par la migration 0014 du 2026-05-14
    // et n'est pas dans le cache .sqlx/ offline au moment de la compilation.
    // Quand `cargo sqlx prepare` aura été lancé sur une DB à jour, on pourra
    // basculer en macros pour bénéficier du type-checking.
    let existing_row = sqlx::query(
        "SELECT rust_service_id FROM external_product_links \
         WHERE source_app = $1 AND external_id = $2",
    )
    .bind(SOURCE_APP)
    .bind(&req.external_id)
    .fetch_optional(&state.pg)
    .await;

    let (rust_service_id, action) = match existing_row {
        Ok(Some(row)) => {
            use sqlx::Row;
            let existing_service_id: i32 = row.get("rust_service_id");
            // UPDATE existing service
            let _ = sqlx::query(
                "UPDATE services SET data = $1, is_active = TRUE, \
                 embedding_status = 'pending', updated_at = NOW() \
                 WHERE id = $2",
            )
            .bind(&data)
            .bind(existing_service_id)
            .execute(&state.pg)
            .await;
            let _ = sqlx::query(
                "UPDATE external_product_links SET payload_jsonb = $1, updated_at = NOW() \
                 WHERE source_app = $2 AND external_id = $3",
            )
            .bind(&data)
            .bind(SOURCE_APP)
            .bind(&req.external_id)
            .execute(&state.pg)
            .await;
            (existing_service_id, "updated".to_string())
        }
        Ok(None) => {
            // INSERT new service
            let new_id_row = sqlx::query(
                "INSERT INTO services (user_id, data, is_active, embedding_status, category) \
                 VALUES ($1, $2, TRUE, 'pending', 'ecommerce') RETURNING id",
            )
            .bind(user_id)
            .bind(&data)
            .fetch_one(&state.pg)
            .await;
            let new_id: i32 = match new_id_row {
                Ok(r) => {
                    use sqlx::Row;
                    r.get("id")
                }
                Err(e) => {
                    warn!("[yukposhop bridge] insert service échec: {e}");
                    return (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(json!({"ok": false, "error": format!("insert service: {e}")})),
                    )
                        .into_response();
                }
            };
            let _ = sqlx::query(
                "INSERT INTO external_product_links \
                 (source_app, external_id, rust_service_id, rust_user_id, payload_jsonb, schema_version) \
                 VALUES ($1, $2, $3, $4, $5, $6)",
            )
            .bind(SOURCE_APP)
            .bind(&req.external_id)
            .bind(new_id)
            .bind(user_id)
            .bind(&data)
            .bind(req.schema_version)
            .execute(&state.pg)
            .await;
            (new_id, "created".to_string())
        }
        Err(e) => {
            warn!("[yukposhop bridge] lookup échec: {e}");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"ok": false, "error": format!("lookup: {e}")})),
            )
                .into_response();
        }
    };

    info!(
        "[yukposhop bridge] {} service_id={} external_id={} user_id={}",
        action, rust_service_id, req.external_id, user_id
    );

    (
        StatusCode::OK,
        Json(SyncResponse {
            ok: true,
            rust_service_id,
            action,
        }),
    )
        .into_response()
}

async fn resolve_or_create_user(
    pool: &sqlx::PgPool,
    vendeur: &YukposhopVendeur,
) -> Result<i32, sqlx::Error> {
    use sqlx::Row;
    // Look up by email (runtime query — voir commentaire plus haut)
    let existing = sqlx::query("SELECT id FROM users WHERE email = $1 LIMIT 1")
        .bind(&vendeur.email)
        .fetch_optional(pool)
        .await?;
    if let Some(row) = existing {
        return Ok(row.get("id"));
    }

    // Create stub user. Les colonnes NOT NULL sans default sont remplies
    // avec des valeurs neutres (le user pourra compléter via dashboard).
    let nom = vendeur.nom_affiche.clone().unwrap_or_else(|| "Marchand YukpoShop".to_string());
    let row = sqlx::query(
        "INSERT INTO users \
         (email, password_hash, role, nom_complet, is_provider, \
          token_price_user, token_price_provider, commission_pct, preferred_lang) \
         VALUES ($1, '!locked-yukposhop!', 'provider', $2, TRUE, \
                 0.0, 0.0, 0.0, 'fr') \
         RETURNING id",
    )
    .bind(&vendeur.email)
    .bind(&nom)
    .fetch_one(pool)
    .await?;
    let new_id: i32 = row.get("id");
    info!(
        "[yukposhop bridge] user créé (email={}, id={})",
        vendeur.email, new_id
    );
    Ok(new_id)
}

// ─── Router ─────────────────────────────────────────────────────────────

pub fn integrations_yukposhop_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route(
            "/api/v1/integrations/yukposhop/sync",
            post(sync_yukposhop_produit),
        )
        .with_state(state)
}
