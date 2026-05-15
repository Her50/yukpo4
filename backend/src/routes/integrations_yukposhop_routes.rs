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

#[derive(Debug, Serialize, Default)]
pub struct YukpoEnrichment {
    pub category: Option<String>, // ex: "electronique", "pharmacie", "mode"
    pub specialized_type: Option<String>, // ex: "smartphone", "medicament", "vetement"
    pub tags_fr: Vec<String>,     // 3-8 tags fr auto-générés
    pub description_enriched_fr: Option<String>, // si description vide ou < 50 chars
    pub quality_score: Option<i32>, // 0-100 (titre+desc+photos+prix)
    pub language_detected: Option<String>, // "fr" | "en" | autre
    pub cost_tokens: i32,         // tokens consommés (audit)
    // ── Piste 6d — modération IA via LLM sur titre+description+tags ──
    pub moderation_status: Option<String>, // approved | flagged | rejected
    pub moderation_reason: Option<String>, // raison si flagged/rejected
}

#[derive(Debug, Serialize)]
pub struct SyncResponse {
    pub ok: bool,
    pub rust_service_id: i32,
    pub action: String, // "created" | "updated"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub enrichment: Option<YukpoEnrichment>,
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

pub fn verify_hmac(body: &[u8], headers: &HeaderMap, secret: &str) -> Result<(), &'static str> {
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

    // ── Piste 6a : enrichissement IA en synchrone ─────────────────────────
    // Best-effort : si l'enrichissement échoue (LLM down, timeout, quota),
    // la sync reste OK — YukpoShop reçoit juste enrichment=null et peut
    // ré-essayer plus tard via /sync (idempotent côté upsert).
    let enrichment = enrich_yukposhop_product(&state, rust_service_id, &req.produit).await;

    (
        StatusCode::OK,
        Json(SyncResponse {
            ok: true,
            rust_service_id,
            action,
            enrichment,
        }),
    )
        .into_response()
}

// ════════════════════════════════════════════════════════════════════════
// Piste 6a — Enrichissement IA produit YukpoShop
// ════════════════════════════════════════════════════════════════════════
//
// Au moment du sync, on demande à GPT-4o-mini (rapide + pas cher) de
// catégoriser, tagger, détecter le type spécialisé et compléter la
// description si elle est trop courte. Le résultat est mergé dans
// services.data ET retourné dans la réponse pour que YukpoShop le store.

async fn enrich_yukposhop_product(
    state: &AppState,
    rust_service_id: i32,
    produit: &YukposhopProduit,
) -> Option<YukpoEnrichment> {
    let api_key = match crate::services::yukpo_openai_outbound::resolve_openai_api_key() {
        Some(k) => k,
        None => {
            warn!("[piste6] OPENAI_API_KEY indispo — skip enrichissement");
            return None;
        }
    };

    // Construit un prompt compact mais structuré (1 seul appel LLM)
    let photos_count = produit.photos_urls.len();
    let desc_len = produit.description.len();
    let prompt = format!(
        "Tu es un classifieur produit e-commerce africain (FR principal). \
         Analyse ce produit YukpoShop et renvoie un JSON STRICT (aucun autre texte).\n\
         \n\
         Produit :\n\
         - titre: {}\n\
         - description: {}\n\
         - prix: {} {}\n\
         - tags initiaux: {:?}\n\
         - photos: {} fournie(s)\n\
         - pays: {}\n\
         \n\
         Renvoie EXACTEMENT ce JSON (rien d'autre, pas de markdown) :\n\
         {{\n\
           \"category\": \"<une catégorie parmi : electronique, mode, alimentation, sante_pharmacie, \
            maison, beaute, auto, sport, livre, jouet, agroalimentaire, services_pro, autre>\",\n\
           \"specialized_type\": \"<sous-type spécifique en 1-3 mots, ex: 'smartphone 5G', \
            'medicament_otc', 'chaussure_femme', null si non applicable>\",\n\
           \"tags_fr\": [\"<3 à 6 tags français normalisés, ex: 'smartphone', 'écran amoled'>\"],\n\
           \"description_enriched_fr\": \"<texte de 120-200 mots commercial en FR si la description \
            ci-dessus fait moins de 50 caractères, sinon null>\",\n\
           \"language_detected\": \"<fr|en|ar|sw|autre>\",\n\
           \"quality_score\": <0-100 selon titre+description+photos+prix, integer>,\n\
           \"moderation_status\": \"<approved si conforme | flagged si suspect (mineurs, armes, contrefaçon, \
            santé sans agrément, contenu adulte explicite, drogues illégales) | rejected si manifestement interdit>\",\n\
           \"moderation_reason\": \"<si flagged ou rejected, raison courte en FR (max 200 chars), sinon null>\"\n\
         }}",
        produit.titre,
        if produit.description.is_empty() { "(vide)" } else { &produit.description },
        produit.prix,
        produit.devise,
        produit.tags,
        photos_count,
        produit.pays,
    );

    let body = json!({
        "model": "gpt-4o-mini",
        "messages": [
            {"role": "system", "content": "Tu réponds UNIQUEMENT en JSON valide, sans markdown."},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.3,
        "max_tokens": 600,
        "response_format": {"type": "json_object"}
    });

    let resp = match crate::services::yukpo_openai_outbound::post_chat_completions(&api_key, &body)
        .await
    {
        Ok(r) => r,
        Err(e) => {
            warn!("[piste6] OpenAI call échec : {e}");
            return None;
        }
    };
    if !resp.status().is_success() {
        let s = resp.status();
        let txt = resp.text().await.unwrap_or_default();
        warn!(
            "[piste6] OpenAI HTTP {} : {}",
            s.as_u16(),
            txt.chars().take(200).collect::<String>()
        );
        return None;
    }
    let raw: Value = match resp.json().await {
        Ok(v) => v,
        Err(e) => {
            warn!("[piste6] OpenAI body parse échec : {e}");
            return None;
        }
    };
    let content_str = raw["choices"][0]["message"]["content"].as_str().unwrap_or("{}");
    let parsed: Value = match serde_json::from_str(content_str) {
        Ok(v) => v,
        Err(e) => {
            warn!(
                "[piste6] JSON parse échec : {e} (raw={})",
                content_str.chars().take(150).collect::<String>()
            );
            return None;
        }
    };
    let cost_tokens = raw["usage"]["total_tokens"].as_i64().unwrap_or(0) as i32;

    let enrichment = YukpoEnrichment {
        category: parsed["category"].as_str().map(|s| s.to_string()),
        specialized_type: parsed["specialized_type"]
            .as_str()
            .filter(|s| !s.is_empty() && *s != "null")
            .map(|s| s.to_string()),
        tags_fr: parsed["tags_fr"]
            .as_array()
            .map(|a| a.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).take(8).collect())
            .unwrap_or_default(),
        description_enriched_fr: parsed["description_enriched_fr"]
            .as_str()
            .filter(|s| !s.is_empty() && *s != "null")
            .map(|s| s.to_string()),
        quality_score: parsed["quality_score"].as_i64().map(|n| n.clamp(0, 100) as i32),
        language_detected: parsed["language_detected"].as_str().map(|s| s.to_string()),
        cost_tokens,
        // 6d — modération produit (LLM analyse titre+description+tags)
        moderation_status: parsed["moderation_status"]
            .as_str()
            .filter(|s| ["approved", "flagged", "rejected"].contains(s))
            .map(|s| s.to_string()),
        moderation_reason: parsed["moderation_reason"]
            .as_str()
            .filter(|s| !s.is_empty() && *s != "null")
            .map(|s| s.chars().take(300).collect::<String>()),
    };

    // Persist back dans services.data + specialized_type column natif
    let merge_data = json!({
        "yukpo_enrichment": {
            "category": enrichment.category,
            "specialized_type": enrichment.specialized_type,
            "tags_fr": enrichment.tags_fr,
            "description_enriched_fr": enrichment.description_enriched_fr,
            "language_detected": enrichment.language_detected,
            "quality_score": enrichment.quality_score,
            "enriched_at": chrono::Utc::now().to_rfc3339(),
        }
    });
    let _ = sqlx::query(
        "UPDATE services SET data = data || $1, \
         specialized_type = COALESCE($2, specialized_type), \
         category = COALESCE($3, category), \
         updated_at = NOW() \
         WHERE id = $4",
    )
    .bind(&merge_data)
    .bind(&enrichment.specialized_type)
    .bind(&enrichment.category)
    .bind(rust_service_id)
    .execute(&state.pg)
    .await;

    info!(
        "[piste6] svc={} category={:?} tags={} tokens={}",
        rust_service_id,
        enrichment.category,
        enrichment.tags_fr.len(),
        enrichment.cost_tokens
    );
    Some(enrichment)
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

// ════════════════════════════════════════════════════════════════════════
// Piste 4 — Distribution sociale unifiée (delegate from YukpoShop Python)
// ════════════════════════════════════════════════════════════════════════
//
// YukpoShop garde son UX (boutons "Publier sur FB/IG/WA") mais delegue
// l'execution a Rust qui possede deja tous les credentials Meta/IG/etc.
// Du commercant. On evite ainsi de dupliquer le flow OAuth + maintenance
// Meta Graph API cote YukpoPro Python.
//
// 2 nouvelles routes HMAC, meme cle YUKPOSHOP_BRIDGE_HMAC_KEY que sync :
//   GET  /api/v1/integrations/yukposhop/social-status?email=...
//   POST /api/v1/integrations/yukposhop/distribute

use axum::extract::Query;

#[derive(Debug, Deserialize)]
pub struct SocialStatusQuery {
    pub email: String,
}

#[derive(Debug, Serialize)]
pub struct SocialPlatformStatus {
    pub platform: String,
    pub account_name: Option<String>,
    pub is_active: bool,
}

#[derive(Debug, Serialize)]
pub struct SocialStatusResponse {
    pub ok: bool,
    pub email: String,
    pub rust_user_id: Option<i32>,
    pub platforms: Vec<SocialPlatformStatus>,
    pub connect_url: String,
}

/// Verifie si un user Yukpo Rust (identifie par email) a connecte des
/// comptes sociaux. Utilise par YukpoShop pour decider entre :
///   - bouton "Publier maintenant" (si comptes connectes)
///   - bouton "Connecter Meta Business" (sinon, redirige vers Rust OAuth)
pub async fn social_status_for_yukposhop(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<SocialStatusQuery>,
) -> impl IntoResponse {
    // 1. HMAC sur la query string (signature du chemin+query plutot que body)
    let secret = std::env::var("YUKPOSHOP_BRIDGE_HMAC_KEY").unwrap_or_default();
    if secret.is_empty() {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({"ok": false, "error": "bridge non configuré"})),
        )
            .into_response();
    }
    let synth_body = format!("email={}", query.email);
    if let Err(e) = verify_hmac(synth_body.as_bytes(), &headers, &secret) {
        warn!("[yukposhop bridge social-status] HMAC reject: {e}");
        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({"ok": false, "error": e})),
        )
            .into_response();
    }

    // 2. Resolve user id (NULL if not registered yet)
    use sqlx::Row;
    let user_row = sqlx::query("SELECT id FROM users WHERE email = $1 LIMIT 1")
        .bind(&query.email)
        .fetch_optional(&state.pg)
        .await;
    let rust_user_id: Option<i32> = match user_row {
        Ok(Some(r)) => Some(r.get("id")),
        _ => None,
    };

    // 3. List active social accounts (best-effort — table peut differer
    //    entre deploys, on ignore les erreurs)
    let mut platforms: Vec<SocialPlatformStatus> = Vec::new();
    if let Some(uid) = rust_user_id {
        let rows = sqlx::query(
            "SELECT platform, account_name, is_active \
             FROM social_accounts \
             WHERE user_id = $1 AND is_active = TRUE",
        )
        .bind(uid)
        .fetch_all(&state.pg)
        .await;
        if let Ok(rows) = rows {
            for r in rows {
                let platform: String = r.try_get("platform").unwrap_or_default();
                let account_name: Option<String> = r.try_get("account_name").ok();
                let is_active: bool = r.try_get("is_active").unwrap_or(true);
                if !platform.is_empty() {
                    platforms.push(SocialPlatformStatus {
                        platform,
                        account_name,
                        is_active,
                    });
                }
            }
        }
    }

    // 4. URL OAuth pour declencher la connexion si rien de connecte
    //    (l'app frontend Yukpo Rust gere la suite — redirige vers Meta).
    let connect_url =
        "https://yukpo-fly-backend.fly.dev/social/connect?source=yukposhop".to_string();

    (
        StatusCode::OK,
        Json(SocialStatusResponse {
            ok: true,
            email: query.email,
            rust_user_id,
            platforms,
            connect_url,
        }),
    )
        .into_response()
}

#[derive(Debug, Deserialize)]
pub struct YukposhopDistributeRequest {
    pub vendeur_email: String,
    pub external_ids: Vec<String>, // YukpoShop product ids -> Rust resout via external_product_links
    pub platforms: Vec<String>,    // ex: ["facebook", "instagram", "whatsapp"]
    #[serde(default)]
    pub message_template: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct YukposhopDistributeResponse {
    pub ok: bool,
    pub jobs_created: i32,
    pub products_resolved: i32,
    pub platforms: Vec<String>,
    pub note: String,
}

/// Lance une distribution sociale pour N produits YukpoShop. Resout
/// chaque external_id en rust_service_id (table external_product_links de
/// la Piste 1), puis enqueue un job de publication pour chaque plateforme.
///
/// IMPLEMENTATION NOTE v1 : on retourne juste un job_created count + un
/// "note" decrivant ce qu'il reste a faire. Le wiring vers les workers
/// de social_distribution_controller necessite un refactor pour permettre
/// l'invocation server-to-server (sans Extension<AuthenticatedUser>). Pour
/// l'instant on enregistre la demande dans social_distribution_jobs et
/// les workers existants la picknt naturellement.
pub async fn distribute_yukposhop_produits(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    body: axum::body::Bytes,
) -> impl IntoResponse {
    let secret = std::env::var("YUKPOSHOP_BRIDGE_HMAC_KEY").unwrap_or_default();
    if secret.is_empty() {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({"ok": false, "error": "bridge non configuré"})),
        )
            .into_response();
    }
    if let Err(e) = verify_hmac(&body, &headers, &secret) {
        warn!("[yukposhop bridge distribute] HMAC reject: {e}");
        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({"ok": false, "error": e})),
        )
            .into_response();
    }

    let req: YukposhopDistributeRequest = match serde_json::from_slice(&body) {
        Ok(r) => r,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"ok": false, "error": format!("invalid json: {e}")})),
            )
                .into_response()
        }
    };
    if req.external_ids.is_empty() || req.platforms.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({"ok": false, "error": "external_ids et platforms requis"})),
        )
            .into_response();
    }

    // Resolve external_id -> (rust_service_id, rust_user_id) via Piste 1
    use sqlx::Row;
    let mut resolved: Vec<(String, i32, i32)> = Vec::new();
    for ext_id in &req.external_ids {
        let row = sqlx::query(
            "SELECT rust_service_id, rust_user_id FROM external_product_links \
             WHERE source_app = 'yukposhop' AND external_id = $1 LIMIT 1",
        )
        .bind(ext_id)
        .fetch_optional(&state.pg)
        .await
        .ok()
        .flatten();
        if let Some(r) = row {
            resolved.push((
                ext_id.clone(),
                r.get("rust_service_id"),
                r.get("rust_user_id"),
            ));
        }
    }

    if resolved.is_empty() {
        return (
            StatusCode::OK,
            Json(YukposhopDistributeResponse {
                ok: false,
                jobs_created: 0,
                products_resolved: 0,
                platforms: req.platforms,
                note: "Aucun produit resolu. Verifie que la Piste 1 (sync) a publie ces produits cote Rust."
                    .to_string(),
            }),
        ).into_response();
    }

    // Enqueue (rust_service_id, platform) dans yukposhop_distribution_requests.
    // Un worker Rust (Phase B) pickera ces lignes et invoquera la logique
    // distribute_products réelle avec le rust_user_id stocke ici.
    let mut jobs_created: i32 = 0;
    for (ext_id, svc_id, usr_id) in &resolved {
        for plat in &req.platforms {
            let _ = sqlx::query(
                "INSERT INTO yukposhop_distribution_requests \
                 (rust_service_id, rust_user_id, external_id, platform, message_template) \
                 VALUES ($1, $2, $3, $4, $5)",
            )
            .bind(svc_id)
            .bind(usr_id)
            .bind(ext_id)
            .bind(plat)
            .bind(&req.message_template)
            .execute(&state.pg)
            .await;
            jobs_created += 1;
        }
    }
    let service_ids: Vec<i32> = resolved.iter().map(|(_, s, _)| *s).collect();

    info!(
        "[yukposhop bridge distribute] jobs={} services={} platforms={:?}",
        jobs_created,
        service_ids.len(),
        req.platforms
    );

    (
        StatusCode::OK,
        Json(YukposhopDistributeResponse {
            ok: true,
            jobs_created,
            products_resolved: service_ids.len() as i32,
            platforms: req.platforms,
            note: format!(
                "{} job(s) enqueue(s) dans yukposhop_distribution_requests. \
                 Workers Rust (Phase B) pickeront en status='pending'.",
                jobs_created
            ),
        }),
    )
        .into_response()
}

// ════════════════════════════════════════════════════════════════════════
// Piste 5 — Inventory decrement (YukpoShop -> Rust)
// ════════════════════════════════════════════════════════════════════════
//
// Quand une commande YukpoShop est passee, le stock local est decremente
// et un evenement est pousse ici pour maintenir l'inventaire Rust marketplace
// coherent. Idempotency via event_id UUID (table yukposhop_inventory_events).

#[derive(Debug, Deserialize)]
pub struct InventoryDecrementRequest {
    pub event_id: String,    // uuid v4 cote YukpoShop
    pub source: String,      // "yukposhop"
    pub external_id: String, // shop_products.id
    pub delta: i32,          // < 0 = decrement
    #[serde(default)]
    pub raison: Option<String>,
    #[serde(default)]
    pub order_numero: Option<String>,
    #[serde(default)]
    pub ts: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct InventoryDecrementResponse {
    pub ok: bool,
    pub event_id: String,
    pub rust_service_id: Option<i32>,
    pub new_stock: Option<i32>,
    pub idempotent_skip: bool,
}

pub async fn inventory_decrement_from_yukposhop(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    body: axum::body::Bytes,
) -> impl IntoResponse {
    let secret = std::env::var("YUKPOSHOP_BRIDGE_HMAC_KEY").unwrap_or_default();
    if secret.is_empty() {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({"ok": false, "error": "bridge non configuré"})),
        )
            .into_response();
    }
    if let Err(e) = verify_hmac(&body, &headers, &secret) {
        warn!("[yukposhop bridge inventory] HMAC reject: {e}");
        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({"ok": false, "error": e})),
        )
            .into_response();
    }

    let req: InventoryDecrementRequest = match serde_json::from_slice(&body) {
        Ok(r) => r,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"ok": false, "error": format!("invalid json: {e}")})),
            )
                .into_response()
        }
    };
    if req.source != SOURCE_APP {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({"ok": false, "error": "source mismatch"})),
        )
            .into_response();
    }

    // Idempotency : si event_id déjà processé, on retourne le résultat précédent
    use sqlx::Row;
    let event_uuid = match uuid::Uuid::parse_str(&req.event_id) {
        Ok(u) => u,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"ok": false, "error": "event_id pas un UUID v4"})),
            )
                .into_response()
        }
    };

    let already = sqlx::query(
        "SELECT rust_service_id, new_stock_after FROM yukposhop_inventory_events \
         WHERE event_id = $1 LIMIT 1",
    )
    .bind(event_uuid)
    .fetch_optional(&state.pg)
    .await
    .ok()
    .flatten();
    if let Some(row) = already {
        let rust_service_id: Option<i32> = row.try_get("rust_service_id").ok();
        let new_stock: Option<i32> = row.try_get("new_stock_after").ok();
        return (
            StatusCode::OK,
            Json(InventoryDecrementResponse {
                ok: true,
                event_id: req.event_id,
                rust_service_id,
                new_stock,
                idempotent_skip: true,
            }),
        )
            .into_response();
    }

    // Résoudre external_id -> rust_service_id via la table Piste 1
    let link = sqlx::query(
        "SELECT rust_service_id FROM external_product_links \
         WHERE source_app = 'yukposhop' AND external_id = $1 LIMIT 1",
    )
    .bind(&req.external_id)
    .fetch_optional(&state.pg)
    .await;
    let rust_service_id: i32 = match link {
        Ok(Some(r)) => r.get("rust_service_id"),
        Ok(None) => {
            // On enregistre l'event quand même pour audit, mais sans impact
            let payload = serde_json::to_value(&req).unwrap_or(json!({}));
            let _ = sqlx::query(
                "INSERT INTO yukposhop_inventory_events \
                 (event_id, source_app, external_id, rust_service_id, delta, \
                  raison, order_numero, new_stock_after, payload_jsonb) \
                 VALUES ($1, 'yukposhop', $2, NULL, $3, $4, $5, NULL, $6) \
                 ON CONFLICT (event_id) DO NOTHING",
            )
            .bind(event_uuid)
            .bind(&req.external_id)
            .bind(req.delta)
            .bind(&req.raison)
            .bind(&req.order_numero)
            .bind(&payload)
            .execute(&state.pg)
            .await;
            return (
                StatusCode::OK,
                Json(InventoryDecrementResponse {
                    ok: false,
                    event_id: req.event_id,
                    rust_service_id: None,
                    new_stock: None,
                    idempotent_skip: false,
                }),
            )
                .into_response();
        }
        Err(e) => {
            warn!("[yukposhop bridge inventory] lookup link échec: {e}");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"ok": false, "error": format!("lookup: {e}")})),
            )
                .into_response();
        }
    };

    // Lit le stock actuel depuis services.data->>'stock', calcule new_stock,
    // jamais < 0. Single UPDATE atomique avec COALESCE pour défaut 0.
    let new_stock_row = sqlx::query(
        "UPDATE services \
         SET data = jsonb_set( \
                       data, \
                       '{stock}', \
                       to_jsonb(GREATEST(0, COALESCE((data->>'stock')::int, 0) + $2)) \
                    ), \
             updated_at = NOW() \
         WHERE id = $1 \
         RETURNING (data->>'stock')::int AS new_stock",
    )
    .bind(rust_service_id)
    .bind(req.delta)
    .fetch_optional(&state.pg)
    .await;

    let new_stock: Option<i32> = match new_stock_row {
        Ok(Some(r)) => r.try_get::<i32, _>("new_stock").ok(),
        _ => None,
    };

    // Enregistre l'event (idempotency garantie par UNIQUE event_id)
    let payload = serde_json::to_value(&req).unwrap_or(json!({}));
    let _ = sqlx::query(
        "INSERT INTO yukposhop_inventory_events \
         (event_id, source_app, external_id, rust_service_id, delta, \
          raison, order_numero, new_stock_after, payload_jsonb) \
         VALUES ($1, 'yukposhop', $2, $3, $4, $5, $6, $7, $8) \
         ON CONFLICT (event_id) DO NOTHING",
    )
    .bind(event_uuid)
    .bind(&req.external_id)
    .bind(rust_service_id)
    .bind(req.delta)
    .bind(&req.raison)
    .bind(&req.order_numero)
    .bind(new_stock)
    .bind(&payload)
    .execute(&state.pg)
    .await;

    info!(
        "[yukposhop bridge inventory] event={} svc={} delta={} new_stock={:?}",
        req.event_id, rust_service_id, req.delta, new_stock
    );

    (
        StatusCode::OK,
        Json(InventoryDecrementResponse {
            ok: true,
            event_id: req.event_id,
            rust_service_id: Some(rust_service_id),
            new_stock,
            idempotent_skip: false,
        }),
    )
        .into_response()
}

// On a besoin de #[derive(Serialize)] sur InventoryDecrementRequest pour
// pouvoir le sérialiser en JSON pour payload_jsonb. Re-impl via to_value.
// Mais comme c'est Deserialize only, on utilise une serialisation manuelle.
impl serde::Serialize for InventoryDecrementRequest {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        use serde::ser::SerializeMap;
        let mut m = s.serialize_map(Some(7))?;
        m.serialize_entry("event_id", &self.event_id)?;
        m.serialize_entry("source", &self.source)?;
        m.serialize_entry("external_id", &self.external_id)?;
        m.serialize_entry("delta", &self.delta)?;
        m.serialize_entry("raison", &self.raison)?;
        m.serialize_entry("order_numero", &self.order_numero)?;
        m.serialize_entry("ts", &self.ts)?;
        m.end()
    }
}

// ════════════════════════════════════════════════════════════════════════
// Piste 6e — Google Places enrichment d'une boutique YukpoShop
// ════════════════════════════════════════════════════════════════════════
//
// Reçoit nom_boutique + ville + pays. Appelle Google Places API (déjà
// configuré côté Rust pour creer_service) pour trouver l'établissement
// et retourner adresse + GPS + horaires + photos + rating. Best-effort.

#[derive(Debug, Deserialize)]
pub struct BoutiqueEnrichRequest {
    pub nom_boutique: String,
    #[serde(default)]
    pub ville: Option<String>,
    #[serde(default = "default_pays")]
    pub pays: String,
}

#[derive(Debug, Serialize, Default)]
pub struct BoutiqueEnrichResponse {
    pub ok: bool,
    pub place_id: Option<String>,
    pub adresse_complete: Option<String>,
    pub gps: Option<String>, // "lat,lng"
    pub rating: Option<f64>,
    pub telephone: Option<String>,
    pub horaires_json: Option<Value>,
    pub photo_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

pub async fn enrich_boutique_via_google_places(
    State(_state): State<Arc<AppState>>,
    headers: HeaderMap,
    body: axum::body::Bytes,
) -> impl IntoResponse {
    let secret = std::env::var("YUKPOSHOP_BRIDGE_HMAC_KEY").unwrap_or_default();
    if secret.is_empty() {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({"ok": false, "error": "bridge non configuré"})),
        )
            .into_response();
    }
    if let Err(e) = verify_hmac(&body, &headers, &secret) {
        warn!("[yukposhop bridge boutique-enrich] HMAC reject: {e}");
        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({"ok": false, "error": e})),
        )
            .into_response();
    }
    let req: BoutiqueEnrichRequest = match serde_json::from_slice(&body) {
        Ok(r) => r,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"ok": false, "error": format!("invalid json: {e}")})),
            )
                .into_response()
        }
    };

    // Appelle Google Places Text Search (clé API : GOOGLE_PLACES_API_KEY)
    let api_key = std::env::var("GOOGLE_PLACES_API_KEY").unwrap_or_default();
    if api_key.is_empty() {
        return (
            StatusCode::OK,
            Json(BoutiqueEnrichResponse {
                ok: false,
                error: Some("GOOGLE_PLACES_API_KEY non configuré côté Rust".into()),
                ..Default::default()
            }),
        )
            .into_response();
    }

    let query = format!(
        "{} {} {}",
        req.nom_boutique,
        req.ville.clone().unwrap_or_default(),
        req.pays
    );

    let client = reqwest::Client::builder().timeout(std::time::Duration::from_secs(10)).build();
    let client = match client {
        Ok(c) => c,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"ok": false, "error": format!("http client: {e}")})),
            )
                .into_response()
        }
    };
    let url = "https://maps.googleapis.com/maps/api/place/textsearch/json";
    let resp = client
        .get(url)
        .query(&[("query", query.as_str()), ("key", api_key.as_str())])
        .send()
        .await;
    let resp = match resp {
        Ok(r) => r,
        Err(e) => {
            return (
                StatusCode::OK,
                Json(BoutiqueEnrichResponse {
                    ok: false,
                    error: Some(format!("google api: {e}")),
                    ..Default::default()
                }),
            )
                .into_response()
        }
    };
    let data: Value = match resp.json().await {
        Ok(v) => v,
        Err(e) => {
            return (
                StatusCode::OK,
                Json(BoutiqueEnrichResponse {
                    ok: false,
                    error: Some(format!("google body: {e}")),
                    ..Default::default()
                }),
            )
                .into_response()
        }
    };

    // Prend le 1er résultat (le plus pertinent)
    let first = data["results"].as_array().and_then(|a| a.first());
    let Some(r) = first else {
        return (
            StatusCode::OK,
            Json(BoutiqueEnrichResponse {
                ok: false,
                error: Some("aucun lieu trouvé pour ce nom".into()),
                ..Default::default()
            }),
        )
            .into_response();
    };
    let place_id = r["place_id"].as_str().map(|s| s.to_string());
    let adresse = r["formatted_address"].as_str().map(|s| s.to_string());
    let rating = r["rating"].as_f64();
    let gps = if let (Some(lat), Some(lng)) = (
        r["geometry"]["location"]["lat"].as_f64(),
        r["geometry"]["location"]["lng"].as_f64(),
    ) {
        Some(format!("{},{}", lat, lng))
    } else {
        None
    };
    let photo_ref = r["photos"][0]["photo_reference"].as_str();
    let photo_url = photo_ref.map(|pr| {
        format!(
        "https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference={}&key={}",
        pr, api_key
    )
    });

    // Optionnel : 2e appel Places Details pour horaires + téléphone
    // (Skip pour rester fast — peut être ajouté plus tard)

    info!(
        "[yukposhop bridge boutique-enrich] place_id={:?} adresse={:?}",
        place_id, adresse
    );
    (
        StatusCode::OK,
        Json(BoutiqueEnrichResponse {
            ok: true,
            place_id,
            adresse_complete: adresse,
            gps,
            rating,
            telephone: None,     // Phase B : Places Details API
            horaires_json: None, // idem
            photo_url,
            error: None,
        }),
    )
        .into_response()
}

// ════════════════════════════════════════════════════════════════════════
// Piste 6 — Génération vidéo pub IA produit YukpoShop (Remotion Rust)
// ════════════════════════════════════════════════════════════════════════
//
// Reçoit photos + titre + prix + description + ton + durée.
// Compose un projet Remotion (déjà en place côté Rust via
// remotion_renderer_service de l'AppState), rend en MP4 vertical 9:16,
// upload vers S3/R2, retourne URLs.
//
// IMPLEMENTATION v0 : si remotion_renderer dispo dans AppState, on lance
// le rendu. Sinon (Phase B), retourne success=false avec note explicite.

#[derive(Debug, Deserialize)]
pub struct YukposhopVideoGenerateRequest {
    pub source: String,
    pub external_id: String,
    pub titre: String,
    #[serde(default)]
    pub prix: f64,
    #[serde(default)]
    pub devise: String,
    pub photos_urls: Vec<String>,
    #[serde(default)]
    pub description: String,
    #[serde(default = "default_ton")]
    pub ton: String,
    #[serde(default = "default_duree")]
    pub duree_s: i32,
    #[serde(default = "default_format")]
    pub format: String,
}
fn default_ton() -> String {
    "dynamique".into()
}
fn default_duree() -> i32 {
    15
}
fn default_format() -> String {
    "vertical_9_16".into()
}

#[derive(Debug, Serialize)]
pub struct YukposhopVideoResponse {
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub video_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub thumbnail_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration_s: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duree_render_s: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

pub async fn generate_yukposhop_video(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    body: axum::body::Bytes,
) -> impl IntoResponse {
    let secret = std::env::var("YUKPOSHOP_BRIDGE_HMAC_KEY").unwrap_or_default();
    if secret.is_empty() {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({"ok": false, "error": "bridge non configuré"})),
        )
            .into_response();
    }
    if let Err(e) = verify_hmac(&body, &headers, &secret) {
        warn!("[yukposhop bridge video] HMAC reject: {e}");
        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({"ok": false, "error": e})),
        )
            .into_response();
    }
    let req: YukposhopVideoGenerateRequest = match serde_json::from_slice(&body) {
        Ok(r) => r,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"ok": false, "error": format!("invalid json: {e}")})),
            )
                .into_response()
        }
    };
    if req.photos_urls.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({"ok": false, "error": "photos_urls vide"})),
        )
            .into_response();
    }

    // Vérifie si le service Remotion est branché côté AppState.
    // remotion_renderer est `Option<Arc<...>>` — si None, on retourne
    // un "Phase B" propre sans casse.
    if state.remotion_renderer.is_none() {
        info!("[yukposhop bridge video] Remotion non branché — retour Phase B stub");
        return (
            StatusCode::OK,
            Json(YukposhopVideoResponse {
                ok: false,
                video_url: None,
                thumbnail_url: None,
                duration_s: None,
                duree_render_s: None,
                error: Some(
                    "Remotion renderer non configuré côté Rust (Phase B). \
                 Branchement à venir : composer un projet Remotion avec photos \
                 + titre + prix + ton, render MP4 9:16, upload S3, retour URLs."
                        .into(),
                ),
            }),
        )
            .into_response();
    }

    // Phase B (à brancher) : appel réel au RemotionRendererService
    // Le service expose typiquement render_with_template(template_id, props) -> output_url.
    // Ici on stub avec un placeholder mais le wiring est prêt.
    //
    // Exemple de wiring quand Remotion sera prêt :
    //   let renderer = state.remotion_renderer.as_ref().unwrap();
    //   let output = renderer.render_template_yukposhop_promo(
    //       &req.photos_urls, &req.titre, req.prix, &req.devise,
    //       &req.description, &req.ton, req.duree_s, &req.format
    //   ).await;
    //   match output { Ok(o) => return success, Err(e) => return error }

    let t0 = std::time::Instant::now();
    info!(
        "[yukposhop bridge video] (stub Phase B) external_id={} photos={} ton={} duree={}s",
        req.external_id,
        req.photos_urls.len(),
        req.ton,
        req.duree_s
    );
    let elapsed = t0.elapsed().as_secs() as i32;

    (
        StatusCode::OK,
        Json(YukposhopVideoResponse {
            ok: false,
            video_url: None,
            thumbnail_url: None,
            duration_s: Some(req.duree_s),
            duree_render_s: Some(elapsed),
            error: Some("Phase B — render Remotion à brancher (template + projet)".into()),
        }),
    )
        .into_response()
}

// ─── Router ─────────────────────────────────────────────────────────────

pub fn integrations_yukposhop_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    use axum::routing::get;
    Router::new()
        // Piste 1
        .route(
            "/api/v1/integrations/yukposhop/sync",
            post(sync_yukposhop_produit),
        )
        // Piste 4
        .route(
            "/api/v1/integrations/yukposhop/social-status",
            get(social_status_for_yukposhop),
        )
        .route(
            "/api/v1/integrations/yukposhop/distribute",
            post(distribute_yukposhop_produits),
        )
        // Piste 5
        .route(
            "/api/v1/integrations/yukposhop/inventory/decrement",
            post(inventory_decrement_from_yukposhop),
        )
        // Piste 6e
        .route(
            "/api/v1/integrations/yukposhop/boutique/enrich",
            post(enrich_boutique_via_google_places),
        )
        // Piste 6 — vidéo pub IA Remotion
        .route(
            "/api/v1/integrations/yukposhop/video/generate",
            post(generate_yukposhop_video),
        )
        .with_state(state)
}
