// ✅ WhatsApp Alert Service — Alertes communautaires (NavigationScreen workflow)
// Radar, Police, Accident, Danger, Travaux, Dos-d'âne, Contrôle, Mintransport

use sqlx::{PgPool, Row};
use std::sync::Arc;

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

    /// Enregistre une alerte communautaire
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

        let result = sqlx::query(
            r#"
            INSERT INTO community_alerts
                (alert_type, latitude, longitude, address, city, reported_by, maps_url,
                 status, confirmations, created_at, expires_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', 1, NOW(), NOW() + INTERVAL '2 hours')
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
        .fetch_optional(&*self.pool)
        .await
        .ok()
        .flatten();

        result.and_then(|r| r.try_get::<i32, _>("id").ok())
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
