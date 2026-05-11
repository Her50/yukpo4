// ✅ WhatsApp Notification Service — Yukpo Bourse du Livre
// Date : 2026-05-11
//
// Stratégie :
//   1. Tous les events métier (match troc, crédit dispo, livraison, etc.)
//      appellent `enqueue_notification(...)` qui consigne dans
//      `whatsapp_notifications_queue`.
//   2. Le mode `deeplink` (par défaut) génère immédiatement un lien wa.me
//      stocké dans `deeplink_url`. Un admin/cron peut ensuite l'ouvrir
//      manuellement (clic depuis le dashboard Yukpo Librairie) ou un
//      worker headless via Puppeteer.
//   3. Le mode `api` (à activer plus tard, env `WHATSAPP_CLOUD_API_TOKEN`)
//      permet d'envoyer via Meta WhatsApp Cloud API directement.
//
// Les templates sont multi-lang (FR par défaut). On utilise un mini
// templating `{{var}}` plutôt qu'un moteur lourd pour rester minimal.

use serde_json::{json, Value};
use sqlx::PgPool;

/// Types d'événement supportés. Une variante = un message standard.
#[derive(Debug, Clone, Copy)]
pub enum WaEvent {
    /// Le livre déposé en troc a trouvé un match — crédit débloqué.
    TrocMatch,
    /// La chaîne de troc est validée — crédit définitivement engagé.
    TrocChain,
    /// Le crédit est disponible et utilisable sur la prochaine commande.
    CreditAvailable,
    /// Une commande a été créée — confirmation au parent.
    OrderCreated,
    /// Coursier en route vers le parent.
    OrderInDelivery,
    /// Saison troc qui s'ouvre — invitation à déposer ses vieux livres.
    SeasonOpenTroc,
    /// Saison achat qui s'ouvre — invitation à utiliser son crédit.
    SeasonOpenBuying,
}

impl WaEvent {
    fn as_str(&self) -> &'static str {
        match self {
            WaEvent::TrocMatch => "troc_match",
            WaEvent::TrocChain => "troc_chain",
            WaEvent::CreditAvailable => "credit_available",
            WaEvent::OrderCreated => "order_created",
            WaEvent::OrderInDelivery => "order_delivery",
            WaEvent::SeasonOpenTroc => "season_open_troc",
            WaEvent::SeasonOpenBuying => "season_open_buying",
        }
    }

    /// Template par défaut (FR). On garde court : un parent qui ouvre WA
    /// veut comprendre en 2 secondes. Pas d'emoji excessif.
    fn template_fr(&self) -> &'static str {
        match self {
            WaEvent::TrocMatch =>
                "Yukpo : votre livre « {{titre}} » a trouvé un acheteur. Crédit de {{credit}} XAF débloqué sur votre compte.",
            WaEvent::TrocChain =>
                "Yukpo : votre échange est validé. Crédit définitivement engagé sur votre prochaine commande.",
            WaEvent::CreditAvailable =>
                "Yukpo : vous avez {{credit}} XAF de crédit prêt à utiliser pour les fournitures de la rentrée.",
            WaEvent::OrderCreated =>
                "Yukpo : commande {{reference}} confirmée. Nous préparons votre livraison.",
            WaEvent::OrderInDelivery =>
                "Yukpo : votre coursier {{coursier}} est en route ({{adresse}}). Tenez le {{phone}} sous la main.",
            WaEvent::SeasonOpenTroc =>
                "Yukpo : c'est le moment d'envoyer photo de vos vieux livres pour les troquer. Crédit immédiat sur la rentrée.",
            WaEvent::SeasonOpenBuying =>
                "Yukpo : la rentrée arrive. Complétez la liste de votre enfant — votre crédit troc est prêt.",
        }
    }
}

/// Construit le message rendu en interpolant les vars {{x}} dans le template.
fn render_template(tpl: &str, vars: &Value) -> String {
    let mut out = tpl.to_string();
    if let Some(obj) = vars.as_object() {
        for (k, v) in obj {
            let placeholder = format!("{{{{{}}}}}", k);
            let val = v.as_str().map(|s| s.to_string()).unwrap_or_else(|| v.to_string());
            out = out.replace(&placeholder, &val);
        }
    }
    out
}

/// Nettoie un numéro de téléphone pour usage dans wa.me.
/// Accepte format local (Cameroun 6XX...) ou international (+237...).
fn clean_phone(raw: &str) -> String {
    let digits: String = raw.chars().filter(|c| c.is_ascii_digit()).collect();
    // Cameroun par défaut si 9 chiffres commençant par 6 ou 2
    if digits.len() == 9 && (digits.starts_with('6') || digits.starts_with('2')) {
        format!("237{}", digits)
    } else {
        digits
    }
}

/// Construit l'URL wa.me avec message pré-rempli.
fn build_deeplink(phone: &str, message: &str) -> String {
    let phone_clean = clean_phone(phone);
    let msg_enc = urlencoding::encode(message);
    format!("https://wa.me/{}?text={}", phone_clean, msg_enc)
}

/// Insère une notification dans la queue. Renvoie l'id ligne.
/// Si le numéro est invalide ou vide, on logge mais on ne lève PAS d'erreur
/// (on ne veut pas faire échouer le flow métier à cause d'une notif).
pub async fn enqueue_notification(
    pool: &PgPool,
    user_id: i32,
    event: WaEvent,
    template_vars: Value,
    related_livre_id: Option<i32>,
    related_commande_id: Option<uuid::Uuid>,
) -> Result<Option<i64>, sqlx::Error> {
    // 1. Récupérer le téléphone WhatsApp de l'utilisateur
    let phone: Option<String> = sqlx::query_scalar("SELECT phone FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_optional(pool)
        .await?
        .flatten();

    let phone = match phone {
        Some(p) if !p.trim().is_empty() => p,
        _ => {
            tracing::warn!(
                "[wa-notif] User {} sans téléphone — notif {} ignorée",
                user_id,
                event.as_str()
            );
            return Ok(None);
        }
    };

    let template_key = event.as_str().to_string();
    let rendered = render_template(event.template_fr(), &template_vars);
    let deeplink = build_deeplink(&phone, &rendered);

    let id: i64 = sqlx::query_scalar(
        r#"
        INSERT INTO whatsapp_notifications_queue
            (user_id, phone, event_type, template_key, template_vars,
             rendered_message, related_livre_id, related_commande_id,
             status, deeplink_url, delivery_mode)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9, 'deeplink')
        RETURNING id
        "#,
    )
    .bind(user_id)
    .bind(&phone)
    .bind(&template_key)
    .bind(&template_key)
    .bind(&template_vars)
    .bind(&rendered)
    .bind(related_livre_id)
    .bind(related_commande_id)
    .bind(&deeplink)
    .fetch_one(pool)
    .await?;

    tracing::info!(
        "[wa-notif] Enqueued notif #{} ({}) → user {} ({})",
        id,
        event.as_str(),
        user_id,
        phone
    );
    Ok(Some(id))
}

/// Helper pour les events les + courants (signature simplifiée).
pub async fn notify_troc_match(
    pool: &PgPool,
    user_id: i32,
    livre_id: i32,
    titre: &str,
    credit_xaf: f64,
) -> Result<Option<i64>, sqlx::Error> {
    enqueue_notification(
        pool,
        user_id,
        WaEvent::TrocMatch,
        json!({
            "titre": titre,
            "credit": format!("{:.0}", credit_xaf),
        }),
        Some(livre_id),
        None,
    )
    .await
}

pub async fn notify_credit_available(
    pool: &PgPool,
    user_id: i32,
    credit_xaf: f64,
) -> Result<Option<i64>, sqlx::Error> {
    enqueue_notification(
        pool,
        user_id,
        WaEvent::CreditAvailable,
        json!({
            "credit": format!("{:.0}", credit_xaf),
        }),
        None,
        None,
    )
    .await
}

pub async fn notify_troc_chain_failed(
    pool: &PgPool,
    user_id: i32,
    livre_id: i32,
) -> Result<Option<i64>, sqlx::Error> {
    enqueue_notification(
        pool,
        user_id,
        WaEvent::TrocChain,
        json!({}),
        Some(livre_id),
        None,
    )
    .await
}

pub async fn notify_book_expired(
    pool: &PgPool,
    user_id: i32,
    livre_id: i32,
) -> Result<Option<i64>, sqlx::Error> {
    // On reuse SeasonOpenTroc message ? non — texte dédié serait mieux.
    // Pour rester DRY on enqueue avec un event spécifique via enqueue_notification
    // directement (template_key custom). Mais ici on garde simple : pas de notif
    // dédiée pour l'expiration, le system in-app gère déjà.
    let _ = (pool, user_id, livre_id);
    Ok(None)
}

pub async fn notify_order_created(
    pool: &PgPool,
    user_id: i32,
    commande_id: uuid::Uuid,
    reference: &str,
) -> Result<Option<i64>, sqlx::Error> {
    enqueue_notification(
        pool,
        user_id,
        WaEvent::OrderCreated,
        json!({
            "reference": reference,
        }),
        None,
        Some(commande_id),
    )
    .await
}

// ============================================================================
// CONSUMER : envoi des notifications pending
// ============================================================================

#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct PendingNotification {
    pub id: i64,
    pub user_id: i32,
    pub phone: String,
    pub event_type: String,
    pub rendered_message: Option<String>,
    pub deeplink_url: Option<String>,
    pub attempts: i32,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

/// Récupère les notifs en attente (mode deeplink) — utilisé par le dashboard
/// admin pour qu'un opérateur clique sur chaque deeplink wa.me et envoie
/// manuellement, puis marque `mark_sent` après envoi.
pub async fn list_pending(
    pool: &PgPool,
    limit: i64,
) -> Result<Vec<PendingNotification>, sqlx::Error> {
    sqlx::query_as::<_, PendingNotification>(
        r#"
        SELECT id, user_id, phone, event_type, rendered_message, deeplink_url,
               attempts, created_at
        FROM whatsapp_notifications_queue
        WHERE status = 'pending'
        ORDER BY created_at ASC
        LIMIT $1
        "#,
    )
    .bind(limit)
    .fetch_all(pool)
    .await
}

pub async fn mark_sent(pool: &PgPool, id: i64) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        UPDATE whatsapp_notifications_queue
        SET status = 'sent', sent_at = NOW(), updated_at = NOW(),
            attempts = attempts + 1
        WHERE id = $1
        "#,
    )
    .bind(id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn mark_failed(pool: &PgPool, id: i64, error: &str) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        UPDATE whatsapp_notifications_queue
        SET status = 'failed', last_error = $2, updated_at = NOW(),
            attempts = attempts + 1
        WHERE id = $1
        "#,
    )
    .bind(id)
    .bind(error)
    .execute(pool)
    .await?;
    Ok(())
}

/// Envoie une notif via WhatsApp Cloud API (Meta). Disponible UNIQUEMENT si
/// la variable d'environnement `WHATSAPP_CLOUD_API_TOKEN` ET
/// `WHATSAPP_CLOUD_PHONE_ID` sont configurées. Sinon renvoie Ok(false) —
/// l'admin doit traiter manuellement via le deeplink.
pub async fn try_send_via_api(notif: &PendingNotification) -> Result<bool, String> {
    let token = match std::env::var("WHATSAPP_CLOUD_API_TOKEN") {
        Ok(v) if !v.is_empty() => v,
        _ => return Ok(false),
    };
    let phone_id = match std::env::var("WHATSAPP_CLOUD_PHONE_ID") {
        Ok(v) if !v.is_empty() => v,
        _ => return Ok(false),
    };

    let message = notif
        .rendered_message
        .as_deref()
        .ok_or_else(|| "Message rendu manquant".to_string())?;
    let phone_clean = clean_phone(&notif.phone);

    let client = reqwest::Client::new();
    let url = format!("https://graph.facebook.com/v18.0/{}/messages", phone_id);
    let body = json!({
        "messaging_product": "whatsapp",
        "to": phone_clean,
        "type": "text",
        "text": { "body": message },
    });

    let resp = client
        .post(&url)
        .bearer_auth(&token)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Erreur réseau Meta API : {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let txt = resp.text().await.unwrap_or_default();
        return Err(format!("HTTP {} : {}", status, txt));
    }
    Ok(true)
}

/// Worker autonome (à spawner depuis main.rs si on veut l'auto-send).
/// Boucle infinie : lit les pending, tente l'API si configurée, marque
/// sent ou failed. Si l'API n'est pas configurée, ne fait rien (les
/// deeplinks restent pour traitement manuel admin).
pub async fn run_auto_send_worker(pool: PgPool) {
    let api_configured = std::env::var("WHATSAPP_CLOUD_API_TOKEN")
        .map(|v| !v.is_empty())
        .unwrap_or(false);
    if !api_configured {
        tracing::info!(
            "[wa-notif-worker] WHATSAPP_CLOUD_API_TOKEN non configuré — worker auto-send désactivé, traitement manuel via dashboard admin."
        );
        return;
    }
    tracing::info!("[wa-notif-worker] Démarré, auto-send via Meta API actif.");
    let mut ticker = tokio::time::interval(std::time::Duration::from_secs(60));
    loop {
        ticker.tick().await;
        let pending = match list_pending(&pool, 50).await {
            Ok(v) => v,
            Err(e) => {
                tracing::warn!("[wa-notif-worker] list_pending error: {}", e);
                continue;
            }
        };
        for notif in pending {
            match try_send_via_api(&notif).await {
                Ok(true) => {
                    let _ = mark_sent(&pool, notif.id).await;
                    tracing::info!("[wa-notif-worker] ✅ Envoyé #{}", notif.id);
                }
                Ok(false) => {
                    // API non configurée → on sort de la boucle
                    return;
                }
                Err(e) => {
                    let _ = mark_failed(&pool, notif.id, &e).await;
                    tracing::warn!("[wa-notif-worker] ❌ #{} : {}", notif.id, e);
                }
            }
        }
    }
}
