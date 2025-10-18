// Service de push notifications (Expo Push Notifications)
use sqlx::PgPool;
use serde::{Deserialize, Serialize};
use reqwest::Client;
use log::{info, error, warn};

#[derive(Debug, Serialize, Deserialize)]
pub struct PushMessage {
    pub to: String, // Expo push token
    pub title: String,
    pub body: String,
    pub data: Option<serde_json::Value>,
    pub sound: Option<String>,
    pub badge: Option<i32>,
    pub priority: Option<String>,
    
    // ✅ NOUVEAU: Paramètres pour les appels
    #[serde(skip_serializing_if = "Option::is_none")]
    pub channel_id: Option<String>, // Canal Android pour les appels
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category_id: Option<String>, // Catégorie pour iOS/Android
    
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "ttl")]
    pub time_to_live: Option<i32>, // Durée de vie de la notification (secondes)
    
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "mutableContent")]
    pub mutable_content: Option<bool>, // Pour iOS: notification modifiable
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PushResponse {
    pub status: String,
    pub id: Option<String>,
}

/// Enregistrer un token push pour un utilisateur
pub async fn register_push_token(
    pool: &PgPool,
    user_id: i32,
    push_token: String,
    device_type: String,
    device_id: Option<String>,
) -> Result<i32, sqlx::Error> {
    info!("[PushService] Enregistrement token push pour user {}: {}", user_id, &push_token[..20]);
    
    // Vérifier si le token existe déjà
    let existing: Option<(i32,)> = sqlx::query_as(
        r#"
        SELECT id FROM user_push_tokens
        WHERE push_token = $1
        "#
    )
    .bind(&push_token)
    .fetch_optional(pool)
    .await?;
    
    if let Some(row) = existing {
        // Mettre à jour le token existant
        sqlx::query(
            r#"
            UPDATE user_push_tokens
            SET user_id = $1, device_type = $2, device_id = $3, is_active = TRUE, last_used_at = CURRENT_TIMESTAMP
            WHERE push_token = $4
            "#
        )
        .bind(user_id)
        .bind(&device_type)
        .bind(&device_id)
        .bind(&push_token)
        .execute(pool)
        .await?;
        
        info!("[PushService] ✅ Token push mis à jour: {}", row.0);
        Ok(row.0)
    } else {
        // Insérer un nouveau token
        let result: (i32,) = sqlx::query_as(
            r#"
            INSERT INTO user_push_tokens (user_id, push_token, device_type, device_id, is_active)
            VALUES ($1, $2, $3, $4, TRUE)
            RETURNING id
            "#
        )
        .bind(user_id)
        .bind(&push_token)
        .bind(&device_type)
        .bind(&device_id)
        .fetch_one(pool)
        .await?;
        
        info!("[PushService] ✅ Nouveau token push enregistré: {}", result.0);
        Ok(result.0)
    }
}

/// Récupérer tous les tokens push actifs d'un utilisateur
pub async fn get_user_push_tokens(
    pool: &PgPool,
    user_id: i32,
) -> Result<Vec<String>, sqlx::Error> {
    let tokens: Vec<(String,)> = sqlx::query_as(
        r#"
        SELECT push_token
        FROM user_push_tokens
        WHERE user_id = $1 AND is_active = TRUE
        ORDER BY last_used_at DESC
        "#
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;
    
    let result: Vec<String> = tokens.into_iter().map(|t| t.0).collect();
    info!("[PushService] {} tokens actifs pour user {}", result.len(), user_id);
    Ok(result)
}

/// Envoyer une push notification via Expo Push Notifications
pub async fn send_push_notification(
    pool: &PgPool,
    user_id: i32,
    title: String,
    body: String,
    data: Option<serde_json::Value>,
    sound: Option<String>,
) -> Result<usize, Box<dyn std::error::Error>> {
    info!("[PushService] Envoi push notification à user {}: {}", user_id, title);
    
    // Récupérer les tokens push de l'utilisateur
    let tokens = get_user_push_tokens(pool, user_id).await?;
    
    if tokens.is_empty() {
        warn!("[PushService] Aucun token push pour user {}", user_id);
        return Ok(0);
    }
    
    let client = Client::new();
    let mut success_count = 0;
    let total_tokens = tokens.len(); // ✅ Sauvegarder la longueur avant la boucle
    
    // Envoyer à tous les tokens
    for token in &tokens { // ✅ Itérer sur référence pour éviter le move
        let message = PushMessage {
            to: token.clone(),
            title: title.clone(),
            body: body.clone(),
            data: data.clone(),
            sound: sound.clone().or(Some("default".to_string())),
            badge: Some(1),
            priority: Some("high".to_string()),
        };
        
        // API Expo Push Notifications
        let response = client
            .post("https://exp.host/--/api/v2/push/send")
            .header("Accept", "application/json")
            .header("Content-Type", "application/json")
            .json(&message)
            .send()
            .await;
        
        match response {
            Ok(resp) => {
                if resp.status().is_success() {
                    info!("[PushService] ✅ Push envoyé avec succès au token {}", &token[..20]);
                    success_count += 1;
                } else {
                    error!("[PushService] ❌ Erreur push ({}): {:?}", resp.status(), resp.text().await);
                }
            }
            Err(e) => {
                error!("[PushService] ❌ Erreur réseau push: {}", e);
            }
        }
    }
    
    info!("[PushService] ✅ {} notifications push envoyées sur {} tokens", success_count, total_tokens);
    Ok(success_count)
}

/// Envoyer une notification d'appel entrant avec PRIORITÉ MAXIMALE
/// ✅ AMÉLIORÉ: Notifications optimisées pour réveiller l'app même si elle est fermée
pub async fn send_call_notification(
    pool: &PgPool,
    recipient_user_id: i32,
    caller_name: String,
    call_type: String, // 'audio' ou 'video'
    service_id: Option<i32>,
) -> Result<usize, Box<dyn std::error::Error>> {
    info!("[PushService] 📞 Envoi notification d'appel HAUTE PRIORITÉ à user {} de {}", recipient_user_id, caller_name);
    
    let title = format!("📞 Appel {} entrant", if call_type == "video" { "vidéo" } else { "audio" });
    let body = format!("{} vous appelle", caller_name);
    
    // ✅ NOUVEAU: Data enrichie pour les appels
    let data = serde_json::json!({
        "type": "incoming_call",
        "call_type": call_type,
        "caller_name": caller_name,
        "service_id": service_id,
        "timestamp": chrono::Utc::now().to_rfc3339(),
        // Paramètres pour réveiller l'app
        "experienceId": "@hernandezlele/yukpomnang-mobile-new", // Project ID Expo
        "categoryId": "call", // Catégorie appel
    });
    
    // ✅ AMÉLIORATION: Utiliser la fonction spécialisée pour les appels
    send_high_priority_call_notification(
        pool,
        recipient_user_id,
        title,
        body,
        data,
        call_type,
    ).await
}

/// ✅ NOUVELLE FONCTION: Envoyer une notification d'appel avec configuration optimale
async fn send_high_priority_call_notification(
    pool: &PgPool,
    user_id: i32,
    title: String,
    body: String,
    data: serde_json::Value,
    call_type: String,
) -> Result<usize, Box<dyn std::error::Error>> {
    info!("[PushService] 📞 Envoi HIGH PRIORITY call notification à user {}", user_id);
    
    // Récupérer les tokens push de l'utilisateur
    let tokens = get_user_push_tokens(pool, user_id).await?;
    
    if tokens.is_empty() {
        warn!("[PushService] ⚠️ Aucun token push pour user {}", user_id);
        return Ok(0);
    }
    
    let client = Client::new();
    let mut success_count = 0;
    let total_tokens = tokens.len();
    
    // ✅ Configuration spéciale pour les appels
    let is_video = call_type == "video";
    
    // Envoyer à tous les tokens
    for token in &tokens {
        let message = PushMessage {
            to: token.clone(),
            title: title.clone(),
            body: body.clone(),
            data: Some(data.clone()),
            
            // ✅ Son spécifique pour les appels
            sound: Some("call_ringtone".to_string()),
            
            // ✅ Badge pour attirer l'attention
            badge: Some(1),
            
            // ✅ PRIORITÉ MAXIMALE pour réveiller l'app
            priority: Some("high".to_string()),
            
            // ✅ Canal Android spécial pour les appels (défini côté mobile)
            channel_id: Some("calls".to_string()),
            
            // ✅ Catégorie pour identifier le type de notification
            category_id: Some(if is_video { "video_call" } else { "audio_call" }.to_string()),
            
            // ✅ TTL court pour les appels (30 secondes)
            // Si l'utilisateur ne répond pas dans 30s, la notification expire
            time_to_live: Some(30),
            
            // ✅ Contenu modifiable pour iOS (permet d'ajouter des actions)
            mutable_content: Some(true),
        };
        
        info!("[PushService] 📤 Envoi HIGH PRIORITY à token {} (canal: calls, TTL: 30s)", &token[..20]);
        
        // API Expo Push Notifications
        let response = client
            .post("https://exp.host/--/api/v2/push/send")
            .header("Accept", "application/json")
            .header("Accept-Encoding", "gzip, deflate")
            .header("Content-Type", "application/json")
            .json(&message)
            .send()
            .await;
        
        match response {
            Ok(resp) => {
                if resp.status().is_success() {
                    info!("[PushService] ✅ Push HIGH PRIORITY envoyé au token {}", &token[..20]);
                    success_count += 1;
                    
                    // Log de la réponse pour debug
                    if let Ok(response_text) = resp.text().await {
                        info!("[PushService] 📬 Réponse Expo: {}", response_text);
                    }
                } else {
                    let status = resp.status();
                    let error_text = resp.text().await.unwrap_or_else(|_| "Unknown error".to_string());
                    error!("[PushService] ❌ Erreur push ({}): {}", status, error_text);
                }
            }
            Err(e) => {
                error!("[PushService] ❌ Erreur réseau push: {}", e);
            }
        }
    }
    
    if success_count > 0 {
        info!("[PushService] ✅ {} notifications d'appel HIGH PRIORITY envoyées sur {} tokens", success_count, total_tokens);
    } else {
        warn!("[PushService] ⚠️ Aucune notification d'appel envoyée (échec sur {} tokens)", total_tokens);
    }
    
    Ok(success_count)
}

/// Désactiver un token push (quand l'utilisateur se déconnecte)
pub async fn deactivate_push_token(
    pool: &PgPool,
    push_token: String,
) -> Result<bool, sqlx::Error> {
    info!("[PushService] Désactivation token push: {}", &push_token[..20]);
    
    let result: Option<(i32,)> = sqlx::query_as(
        r#"
        UPDATE user_push_tokens
        SET is_active = FALSE
        WHERE push_token = $1
        RETURNING id
        "#
    )
    .bind(&push_token)
    .fetch_optional(pool)
    .await?;
    
    Ok(result.is_some())
}

/// Nettoyer les vieux tokens inactifs (>90 jours)
pub async fn cleanup_old_push_tokens(
    pool: &PgPool,
    days: i32,
) -> Result<u64, sqlx::Error> {
    info!("[PushService] Nettoyage tokens push de plus de {} jours", days);
    
    let result = sqlx::query(
        r#"
        DELETE FROM user_push_tokens
        WHERE is_active = FALSE 
        AND updated_at < CURRENT_TIMESTAMP - INTERVAL '1 day' * $1
        "#
    )
    .bind(days)
    .execute(pool)
    .await?;
    
    let count = result.rows_affected();
    info!("[PushService] ✅ {} anciens tokens supprimés", count);
    Ok(count)
}

