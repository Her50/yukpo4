// ✅ WhatsApp Alert Service — Alertes communautaires (NavigationScreen workflow)
// Radar, Police, Accident, Danger, Travaux, Dos-d'âne, Contrôle, Mintransport
// Fonctionnalités :
//  - Création alerte + synchronisation navigation_checkpoints
//  - Recherche alertes par rayon GPS (critères différents par type)
//  - Broadcast sortant WhatsApp Twilio aux abonnés à proximité

use sqlx::{PgPool, Row};
use std::sync::Arc;

// Rayon de notification (km) par type d'alerte
pub fn alert_radius_km(alert_type: &str) -> f64 {
    match alert_type {
        "radar" | "road_check" | "transport_control" => 3.0, // contrôles : rayon court
        "police" => 5.0,
        "accident" | "danger" => 10.0, // accidents : rayon large
        "road_works" => 2.0,           // travaux : zone locale
        "speed_bump" => 1.0,           // dos-d'âne : très local
        _ => 5.0,
    }
}

// Durée d'expiration (heures) par type d'alerte
pub fn alert_expires_hours(alert_type: &str) -> i64 {
    match alert_type {
        "road_works" | "speed_bump" => 48,
        "radar" | "police" | "road_check" | "transport_control" => 4,
        "accident" => 2,
        "danger" => 3,
        _ => 2,
    }
}

pub struct WhatsAppAlertService {
    pool: Arc<PgPool>,
}

#[derive(Debug, Clone)]
pub struct CommunityAlert {
    pub id: i32,
    pub alert_type: String,
    pub icon: String,
    pub label: String,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub address: String,
    pub city: String,
    pub reported_by: String,
    pub confirmations: i32,
    pub status: String,
    pub maps_url: String,
}

pub const ALERT_TYPES: &[(&str, &str, &str)] = &[
    ("radar", "📸", "Radar"),
    ("police", "👮", "Police / Gendarmerie"),
    ("road_check", "🚧", "Contrôle routier"),
    ("transport_control", "🛂", "Contrôle Mintransport"),
    ("accident", "🚨", "Accident"),
    ("danger", "⚠️", "Danger"),
    ("road_works", "🔧", "Travaux"),
    ("speed_bump", "🔶", "Dos-d'âne"),
];

impl WhatsAppAlertService {
    pub fn new(pool: Arc<PgPool>) -> Self {
        Self { pool }
    }

    /// Enregistre une alerte communautaire + synchronise avec navigation_checkpoints
    pub async fn create_alert(
        &self,
        alert_type: &str,
        latitude: Option<f64>,
        longitude: Option<f64>,
        address: &str,
        city: &str,
        reported_by: &str,
    ) -> Option<i32> {
        let maps_url = match (latitude, longitude) {
            (Some(lat), Some(lng)) => format!("https://maps.google.com/?q={},{}", lat, lng),
            _ => format!("https://maps.google.com/?q={}", urlencoding(address)),
        };

        let expires_hours = alert_expires_hours(alert_type);

        let result = sqlx::query(
            r#"
            INSERT INTO community_alerts
                (alert_type, latitude, longitude, address, city, reported_by, maps_url,
                 status, confirmations, created_at, expires_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', 1, NOW(), NOW() + ($8 || ' hours')::INTERVAL)
            RETURNING id
            "#,
        )
        .bind(alert_type)
        .bind(latitude)
        .bind(longitude)
        .bind(address)
        .bind(city)
        .bind(reported_by)
        .bind(&maps_url)
        .bind(expires_hours)
        .fetch_optional(&*self.pool)
        .await
        .ok()
        .flatten();

        let alert_id = result.and_then(|r| r.try_get::<i32, _>("id").ok())?;

        // Synchroniser avec navigation_checkpoints si coordonnées GPS disponibles
        if let (Some(lat), Some(lng)) = (latitude, longitude) {
            let nav_type = match alert_type {
                "radar" => "radar",
                "police" | "road_check" | "transport_control" => "police",
                "accident" => "accident",
                "danger" => "danger",
                "road_works" => "road_works",
                "speed_bump" => "speed_bump",
                _ => "danger",
            };
            let expires_at = chrono::Utc::now() + chrono::Duration::hours(expires_hours);
            let description = format!("Signalé via WhatsApp par {} — {}", reported_by, address);
            let _ = sqlx::query(
                r#"
                INSERT INTO navigation_checkpoints
                    (reported_by, checkpoint_type, latitude, longitude,
                     description, is_permanent, expires_at)
                VALUES (0, $1, $2, $3, $4, false, $5)
                ON CONFLICT DO NOTHING
                "#,
            )
            .bind(nav_type)
            .bind(lat)
            .bind(lng)
            .bind(&description)
            .bind(expires_at)
            .execute(&*self.pool)
            .await;
        }

        Some(alert_id)
    }

    /// Récupère les alertes actives dans une ville
    pub async fn get_active_alerts(&self, city: &str) -> Vec<CommunityAlert> {
        let rows = sqlx::query(
            r#"
            SELECT id, alert_type, latitude, longitude, address, city,
                   reported_by, confirmations, status, maps_url
            FROM community_alerts
            WHERE LOWER(city) = LOWER($1)
              AND status = 'active'
              AND expires_at > NOW()
            ORDER BY created_at DESC
            LIMIT 10
            "#,
        )
        .bind(city)
        .fetch_all(&*self.pool)
        .await
        .unwrap_or_default();

        rows.iter()
            .map(|r| {
                let alert_type: String = r.try_get("alert_type").unwrap_or_default();
                let (icon, label) = alert_icon_label(&alert_type);
                CommunityAlert {
                    id: r.try_get("id").unwrap_or(0),
                    alert_type,
                    icon: icon.to_string(),
                    label: label.to_string(),
                    latitude: r.try_get("latitude").ok(),
                    longitude: r.try_get("longitude").ok(),
                    address: r.try_get("address").unwrap_or_default(),
                    city: r.try_get("city").unwrap_or_default(),
                    reported_by: r.try_get("reported_by").unwrap_or_default(),
                    confirmations: r.try_get("confirmations").unwrap_or(1),
                    status: r.try_get("status").unwrap_or_default(),
                    maps_url: r.try_get("maps_url").unwrap_or_default(),
                }
            })
            .collect()
    }

    /// Récupère les alertes actives à proximité GPS (rayon adapté par type)
    pub async fn get_active_alerts_nearby(
        &self,
        lat: f64,
        lng: f64,
        radius_km_override: Option<f64>,
    ) -> Vec<CommunityAlert> {
        // Rayon maximal recherché (on filtre ensuite par type)
        let max_radius = radius_km_override.unwrap_or(15.0);
        let lat_delta = max_radius / 111.0;
        let lng_delta = max_radius / (111.0 * lat.to_radians().cos().abs().max(0.01));

        let rows = sqlx::query(
            r#"
            SELECT id, alert_type, latitude, longitude, address, city,
                   reported_by, confirmations, status, maps_url
            FROM community_alerts
            WHERE status = 'active'
              AND expires_at > NOW()
              AND latitude IS NOT NULL AND longitude IS NOT NULL
              AND latitude  BETWEEN $1 - $3 AND $1 + $3
              AND longitude BETWEEN $2 - $4 AND $2 + $4
            ORDER BY created_at DESC
            LIMIT 20
            "#,
        )
        .bind(lat)
        .bind(lng)
        .bind(lat_delta)
        .bind(lng_delta)
        .fetch_all(&*self.pool)
        .await
        .unwrap_or_default();

        rows.iter()
            .filter_map(|r| {
                let alert_type: String = r.try_get("alert_type").unwrap_or_default();
                let a_lat: f64 = r.try_get("latitude").ok()?;
                let a_lng: f64 = r.try_get("longitude").ok()?;
                // Calcul haversine précis
                let dist = haversine_km(lat, lng, a_lat, a_lng);
                let allowed_radius = alert_radius_km(&alert_type);
                if dist > allowed_radius {
                    return None;
                }
                let (icon, label) = alert_icon_label(&alert_type);
                Some(CommunityAlert {
                    id: r.try_get("id").unwrap_or(0),
                    alert_type,
                    icon: icon.to_string(),
                    label: label.to_string(),
                    latitude: Some(a_lat),
                    longitude: Some(a_lng),
                    address: r.try_get("address").unwrap_or_default(),
                    city: r.try_get("city").unwrap_or_default(),
                    reported_by: r.try_get("reported_by").unwrap_or_default(),
                    confirmations: r.try_get("confirmations").unwrap_or(1),
                    status: r.try_get("status").unwrap_or_default(),
                    maps_url: r.try_get("maps_url").unwrap_or_default(),
                })
            })
            .collect()
    }

    /// Diffuse une alerte aux abonnés WhatsApp à proximité GPS
    /// Utilise Twilio Messages API (outbound)
    pub async fn broadcast_to_nearby_subscribers(
        &self,
        alert: &CommunityAlert,
        reporter_name: Option<&str>,
    ) -> usize {
        let (lat, lng) = match (alert.latitude, alert.longitude) {
            (Some(a), Some(b)) => (a, b),
            _ => {
                // Pas de GPS → diffuser à tous les abonnés de la ville
                return self.broadcast_to_city_subscribers(alert, reporter_name).await;
            }
        };

        let radius = alert_radius_km(&alert.alert_type);
        let lat_delta = radius / 111.0;
        let lng_delta = radius / (111.0 * lat.to_radians().cos().abs().max(0.01));

        // Récupérer les abonnés dans la zone GPS (whatsapp_alert_subscriptions avec coords OU par ville)
        let rows = sqlx::query(
            r#"
            SELECT DISTINCT was.phone_number
            FROM whatsapp_alert_subscriptions was
            WHERE was.active = TRUE
              AND (
                  -- Abonnés par ville (sans GPS) → notifier si ville correspond
                  (was.latitude IS NULL AND LOWER(was.city) = LOWER($5))
                  OR
                  -- Abonnés avec GPS → notifier si dans le rayon
                  (was.latitude IS NOT NULL AND was.longitude IS NOT NULL
                   AND was.latitude  BETWEEN $1 - $3 AND $1 + $3
                   AND was.longitude BETWEEN $2 - $4 AND $2 + $4)
              )
            LIMIT 500
            "#,
        )
        .bind(lat)
        .bind(lng)
        .bind(lat_delta)
        .bind(lng_delta)
        .bind(&alert.city)
        .fetch_all(&*self.pool)
        .await
        .unwrap_or_default();

        let phones: Vec<String> =
            rows.iter().filter_map(|r| r.try_get("phone_number").ok()).collect();

        let message = self.build_broadcast_message(alert, reporter_name);
        let mut sent = 0;
        for phone in &phones {
            if send_whatsapp_outbound(phone, &message).await {
                sent += 1;
            }
        }
        sent
    }

    async fn broadcast_to_city_subscribers(
        &self,
        alert: &CommunityAlert,
        reporter_name: Option<&str>,
    ) -> usize {
        let rows = sqlx::query(
            "SELECT phone_number FROM whatsapp_alert_subscriptions WHERE active = TRUE AND LOWER(city) = LOWER($1) LIMIT 500",
        )
        .bind(&alert.city)
        .fetch_all(&*self.pool)
        .await
        .unwrap_or_default();
        let subscribers: Vec<String> =
            rows.iter().filter_map(|r| r.try_get("phone_number").ok()).collect();
        let message = self.build_broadcast_message(alert, reporter_name);
        let mut sent = 0;
        for phone in &subscribers {
            if send_whatsapp_outbound(phone, &message).await {
                sent += 1;
            }
        }
        sent
    }

    /// Confirme une alerte (elle est toujours active)
    pub async fn confirm_alert(&self, alert_id: i32) {
        let _ = sqlx::query(
            "UPDATE community_alerts SET confirmations = confirmations + 1 WHERE id = $1",
        )
        .bind(alert_id)
        .execute(&*self.pool)
        .await;
    }

    /// Résoudre une alerte (plus d'obstacle)
    pub async fn resolve_alert(&self, alert_id: i32) {
        let _ = sqlx::query("UPDATE community_alerts SET status = 'resolved' WHERE id = $1")
            .bind(alert_id)
            .execute(&*self.pool)
            .await;
    }

    /// Construit le message de diffusion pour les abonnés
    pub fn build_broadcast_message(
        &self,
        alert: &CommunityAlert,
        reporter_name: Option<&str>,
    ) -> String {
        let reporter = reporter_name.unwrap_or("Un conducteur");
        let mut msg = format!(
            "🚨 *ALERTE YUKPO*\n\n{} *{}*\n📍 {}\n\n⏱️ Signalé à l'instant par {}\n",
            alert.icon, alert.label, alert.address, reporter
        );
        if !alert.maps_url.is_empty() {
            msg.push_str(&format!("🗺️ Voir sur Maps: {}\n", alert.maps_url));
        }
        msg.push_str("\nRestez prudents !");
        msg
    }

    /// Message de menu pour choisir le type d'alerte
    pub fn alert_type_menu() -> String {
        let mut msg = "🚨 *Signaler une alerte* — Quel type ?\n\n".to_string();
        for (i, (_, icon, label)) in ALERT_TYPES.iter().enumerate() {
            msg.push_str(&format!("{}. {} {}\n", i + 1, icon, label));
        }
        msg.push_str("\n_Tapez le numéro correspondant._");
        msg
    }

    /// Résout l'index choisi → type d'alerte
    pub fn parse_alert_type_choice(
        choice: &str,
    ) -> Option<(&'static str, &'static str, &'static str)> {
        let n: usize = choice.trim().parse().ok()?;
        ALERT_TYPES.get(n.wrapping_sub(1)).copied()
    }
}

pub fn alert_icon_label(alert_type: &str) -> (&'static str, &'static str) {
    for (t, icon, label) in ALERT_TYPES {
        if *t == alert_type {
            return (icon, label);
        }
    }
    ("⚠️", "Alerte")
}

/// Distance haversine en km entre deux points GPS
pub fn haversine_km(lat1: f64, lng1: f64, lat2: f64, lng2: f64) -> f64 {
    let r = 6371.0_f64;
    let dlat = (lat2 - lat1).to_radians();
    let dlng = (lng2 - lng1).to_radians();
    let a = (dlat / 2.0).sin().powi(2)
        + lat1.to_radians().cos() * lat2.to_radians().cos() * (dlng / 2.0).sin().powi(2);
    let c = 2.0 * a.sqrt().atan2((1.0 - a).sqrt());
    r * c
}

/// Détecte le code court d'alerte rapide (R=radar, P=police, A=accident, etc.)
pub fn parse_quick_alert_code(msg: &str) -> Option<&'static str> {
    match msg.trim().to_uppercase().as_str() {
        "R" | "RADAR" => Some("radar"),
        "P" | "POLICE" | "GENDARMERIE" => Some("police"),
        "A" | "ACCIDENT" => Some("accident"),
        "D" | "DANGER" => Some("danger"),
        "T" | "TRAVAUX" => Some("road_works"),
        "C" | "CONTROLE" | "CONTRÔLE" => Some("road_check"),
        "M" | "MINTRANSPORT" => Some("transport_control"),
        "DOS" | "RALENTISSEUR" => Some("speed_bump"),
        _ => None,
    }
}

/// Envoie un message WhatsApp sortant via l'API Twilio
/// Returns true si succès
pub async fn send_whatsapp_outbound(to: &str, message: &str) -> bool {
    let sid = match std::env::var("TWILIO_ACCOUNT_SID") {
        Ok(s) if !s.is_empty() => s,
        _ => return false,
    };
    let token = match std::env::var("TWILIO_AUTH_TOKEN") {
        Ok(t) if !t.is_empty() => t,
        _ => return false,
    };
    let from = std::env::var("TWILIO_WHATSAPP_NUMBER")
        .unwrap_or_else(|_| "whatsapp:+14155238886".to_string());

    // Normaliser le numéro destinataire
    let to_wa = if to.starts_with("whatsapp:") {
        to.to_string()
    } else {
        format!("whatsapp:{}", to)
    };

    let url = format!(
        "https://api.twilio.com/2010-04-01/Accounts/{}/Messages.json",
        sid
    );

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .unwrap_or_default();

    let params = [
        ("From", from.as_str()),
        ("To", to_wa.as_str()),
        ("Body", message),
    ];

    match client.post(&url).basic_auth(&sid, Some(&token)).form(&params).send().await {
        Ok(r) if r.status().is_success() => {
            log::info!("[AlertBroadcast] ✅ WhatsApp envoyé à {}", to_wa);
            true
        }
        Ok(r) => {
            log::warn!("[AlertBroadcast] ⚠️ Twilio {} pour {}", r.status(), to_wa);
            false
        }
        Err(e) => {
            log::error!("[AlertBroadcast] ❌ Erreur Twilio: {}", e);
            false
        }
    }
}

fn urlencoding(s: &str) -> String {
    s.chars()
        .map(|c| match c {
            ' ' => '+'.to_string(),
            c if c.is_ascii_alphanumeric() || "-_.~".contains(c) => c.to_string(),
            c => format!("%{:02X}", c as u32),
        })
        .collect()
}

/// Détecte si un payload WhatsApp contient une localisation GPS
pub fn extract_location_from_payload(payload: &serde_json::Value) -> Option<(f64, f64, String)> {
    // Format Twilio WhatsApp location
    if let (Some(lat), Some(lng)) = (
        payload
            .get("Latitude")
            .and_then(|v| v.as_str())
            .and_then(|s| s.parse::<f64>().ok()),
        payload
            .get("Longitude")
            .and_then(|v| v.as_str())
            .and_then(|s| s.parse::<f64>().ok()),
    ) {
        let address = payload
            .get("Address")
            .and_then(|v| v.as_str())
            .unwrap_or("Position GPS")
            .to_string();
        return Some((lat, lng, address));
    }

    // Format Meta Cloud API location
    if let Some(location) = payload.get("location") {
        if let (Some(lat), Some(lng)) = (
            location.get("latitude").and_then(|v| v.as_f64()),
            location.get("longitude").and_then(|v| v.as_f64()),
        ) {
            let address = location
                .get("name")
                .or_else(|| location.get("address"))
                .and_then(|v| v.as_str())
                .unwrap_or("Position GPS")
                .to_string();
            return Some((lat, lng, address));
        }
    }

    None
}

/// Extrait l'URL d'une image envoyée via WhatsApp
pub fn extract_image_url_from_payload(payload: &serde_json::Value) -> Option<String> {
    // Twilio: MediaUrl0
    if let Some(url) = payload.get("MediaUrl0").and_then(|v| v.as_str()) {
        return Some(url.to_string());
    }
    // Meta Cloud API
    if let Some(image) = payload.get("image") {
        if let Some(url) = image.get("url").and_then(|v| v.as_str()) {
            return Some(url.to_string());
        }
    }
    None
}

/// Extrait le nom de la ville camerounaise depuis un texte
pub fn detect_city(text: &str) -> String {
    let text_lower = text.to_lowercase();
    let cities = [
        "douala",
        "yaoundé",
        "yaounde",
        "bafoussam",
        "buea",
        "bamenda",
        "ngaoundéré",
        "ngaoundere",
        "garoua",
        "maroua",
        "bertoua",
        "ebolowa",
        "kribi",
        "limbe",
        "kumba",
        "nkongsamba",
        "edéa",
        "edea",
    ];
    for city in &cities {
        if text_lower.contains(city) {
            let display = match *city {
                "yaounde" => "Yaoundé",
                "ngaoundere" => "Ngaoundéré",
                "edea" => "Edéa",
                c => c,
            };
            return display.to_string();
        }
    }
    "Douala".to_string() // défaut
}
