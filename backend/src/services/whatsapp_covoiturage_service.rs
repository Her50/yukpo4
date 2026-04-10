// ✅ WhatsApp Covoiturage Service — Recherche et création de trajets via WhatsApp
// Couvre : chercher un trajet, proposer un trajet (création guidée multi-étapes)
// Tables : covoiturages, services, users

use sqlx::{PgPool, Row};
use std::sync::Arc;

use crate::services::whatsapp_session_service::CovoiturageResult;

pub struct WhatsAppCovoiturageService {
    pool: Arc<PgPool>,
}

impl WhatsAppCovoiturageService {
    pub fn new(pool: Arc<PgPool>) -> Self {
        Self { pool }
    }

    /// Recherche des trajets disponibles entre deux villes
    pub async fn search_trips(&self, depart: &str, destination: &str) -> Vec<CovoiturageResult> {
        let dep_kw = format!("%{}%", depart.to_lowercase());
        let dest_kw = format!("%{}%", destination.to_lowercase());

        let rows = sqlx::query(
            r#"
            SELECT
                c.id,
                c.depart,
                c.destination,
                c.date_depart,
                c.heure_depart,
                c.places_disponibles,
                c.prix_par_place,
                COALESCE(c.devise, 'XAF') AS devise,
                COALESCE(u.nom, 'Chauffeur') AS driver_name,
                COALESCE(u.phone, '') AS driver_phone
            FROM covoiturages c
            JOIN users u ON u.id = c.user_id
            WHERE c.is_active = TRUE
              AND c.statut = 'ouvert'
              AND c.places_disponibles > 0
              AND c.date_depart >= NOW()
              AND LOWER(c.depart) LIKE $1
              AND LOWER(c.destination) LIKE $2
            ORDER BY c.date_depart ASC
            LIMIT 10
            "#,
        )
        .bind(&dep_kw)
        .bind(&dest_kw)
        .fetch_all(&*self.pool)
        .await
        .unwrap_or_default();

        rows.iter()
            .map(|r| {
                // date_depart est TIMESTAMPTZ
                let date_str: String = r
                    .try_get::<chrono::DateTime<chrono::Utc>, _>("date_depart")
                    .map(|d| d.format("%d/%m/%Y").to_string())
                    .unwrap_or_default();
                // heure_depart est TIME
                let time_str: String = r
                    .try_get::<chrono::NaiveTime, _>("heure_depart")
                    .map(|t| t.format("%H:%M").to_string())
                    .unwrap_or_default();

                CovoiturageResult {
                    trip_id: r.try_get("id").unwrap_or(0),
                    depart: r.try_get("depart").unwrap_or_default(),
                    destination: r.try_get("destination").unwrap_or_default(),
                    date: date_str,
                    time: time_str,
                    places_dispo: r.try_get("places_disponibles").unwrap_or(0),
                    prix: r.try_get::<i32, _>("prix_par_place").unwrap_or(0) as i64,
                    devise: r.try_get("devise").unwrap_or_else(|_| "XAF".to_string()),
                    driver_name: r.try_get("driver_name").unwrap_or_default(),
                    driver_phone: r.try_get("driver_phone").unwrap_or_default(),
                }
            })
            .collect()
    }

    /// Crée un nouveau trajet de covoiturage pour un conducteur
    /// Retourne l'ID du trajet créé
    pub async fn create_trip(
        &self,
        user_id: i32,
        depart: &str,
        destination: &str,
        date_str: &str, // format JJ/MM/AAAA
        time_str: &str, // format HH:MM
        seats: i32,
        prix: i64,
        driver_phone: &str,
    ) -> Option<i32> {
        // Convertir JJ/MM/AAAA en AAAA-MM-JJ
        let parts: Vec<&str> = date_str.split('/').collect();
        if parts.len() < 3 {
            log::warn!("[Covoiturage] Date invalide: {}", date_str);
            return None;
        }
        let date_iso = format!("{}-{}-{}", parts[2], parts[1], parts[0]);
        let time_clean = if time_str.contains(':') {
            time_str.to_string()
        } else {
            format!("{}:00", time_str)
        };
        // Construire le datetime ISO pour PostgreSQL TIMESTAMPTZ
        let datetime_str = format!("{} {}:00+00", date_iso, time_clean.trim_end_matches(":00"));

        // 1. Créer un service (requis par la contrainte service_id)
        let service_row = sqlx::query(
            r#"
            INSERT INTO services (user_id, category, specialized_type, titre_service, description, telephone, actif)
            VALUES ($1, 'transport', 'covoiturage', $2, $3, $4, true)
            RETURNING id
            "#,
        )
        .bind(user_id)
        .bind(format!("Covoiturage {} → {}", depart, destination))
        .bind(format!("Trajet {} → {} le {} à {}", depart, destination, date_str, time_str))
        .bind(driver_phone)
        .fetch_optional(&*self.pool)
        .await
        .ok()
        .flatten();

        let service_id: i32 = service_row.and_then(|r| r.try_get("id").ok())?;

        // 2. Créer le trajet
        let covoit_row = sqlx::query(
            r#"
            INSERT INTO covoiturages (
                service_id, user_id, depart, destination,
                date_depart, heure_depart,
                nombre_places, places_disponibles,
                prix_par_place, devise,
                statut, is_active
            )
            VALUES ($1, $2, $3, $4, $5::TIMESTAMPTZ, $6::TIME, $7, $7, $8, 'XAF', 'ouvert', TRUE)
            RETURNING id
            "#,
        )
        .bind(service_id)
        .bind(user_id)
        .bind(depart)
        .bind(destination)
        .bind(&datetime_str)
        .bind(&time_clean)
        .bind(seats)
        .bind(prix as i32)
        .fetch_optional(&*self.pool)
        .await
        .ok()
        .flatten();

        covoit_row.and_then(|r| r.try_get("id").ok())
    }

    // ── Formatage des messages ────────────────────────────────────────────────

    pub fn format_trip_results(results: &[CovoiturageResult], depart: &str, dest: &str) -> String {
        if results.is_empty() {
            return format!(
                "🚗 Aucun covoiturage disponible pour *{} → {}*.\n\n\
                💡 Tapez *proposer covoiturage* pour créer une annonce et trouver des passagers !\n\n\
                Tapez *MENU* pour revenir.",
                depart, dest
            );
        }

        let mut msg = format!("🚗 *Covoiturages {} → {}*\n\n", depart, dest);
        for (i, r) in results.iter().enumerate() {
            msg.push_str(&format!(
                "*{}. {} → {}*\n\
                📅 {} à {} | 💺 {} place(s)\n\
                💰 {} {}\n\
                👤 {}\n\n",
                i + 1,
                r.depart,
                r.destination,
                r.date,
                r.time,
                r.places_dispo,
                r.prix,
                r.devise,
                r.driver_name,
            ));
        }
        msg.push_str("Tapez un *numéro* pour voir les coordonnées du chauffeur.\nOu tapez *MENU* pour revenir.");
        msg
    }

    pub fn format_trip_detail(result: &CovoiturageResult) -> String {
        format!(
            "🚗 *Trajet — Détails*\n\n\
            📍 *{}* → *{}*\n\
            📅 {} à {}\n\
            💺 {} place(s) disponible(s)\n\
            💰 {} {} / place\n\
            👤 Chauffeur : {}\n\
            📞 {}\n\n\
            _Contactez le chauffeur directement pour réserver votre place._\n\n\
            Tapez *MENU* pour revenir.",
            result.depart,
            result.destination,
            result.date,
            result.time,
            result.places_dispo,
            result.prix,
            result.devise,
            result.driver_name,
            result.driver_phone
        )
    }

    pub fn creation_success_message(
        depart: &str,
        dest: &str,
        date: &str,
        seats: i32,
        prix: i64,
        trip_id: i32,
    ) -> String {
        format!(
            "✅ *Covoiturage publié !*\n\n\
            📍 *{}* → *{}*\n\
            📅 {}\n\
            💺 {} place(s) à {} FCFA / place\n\
            🆔 Réf: #{}\n\n\
            Les passagers intéressés vous contacteront directement.\n\
            📲 Gérez votre trajet sur l'app *Yukpo* → Covoiturage\n\n\
            Tapez *MENU* pour revenir.",
            depart, dest, date, seats, prix, trip_id
        )
    }
}

/// Extrait villes départ/destination depuis un message comme "covoiturage Douala Yaoundé"
pub fn extraire_villes_covoiturage(msg: &str) -> (String, Option<String>) {
    let known_cities = [
        "douala",
        "yaoundé",
        "yaounde",
        "bafoussam",
        "garoua",
        "maroua",
        "ngaoundéré",
        "ngaoundere",
        "bamenda",
        "bertoua",
        "ebolowa",
        "kribi",
        "limbe",
        "kumba",
        "edéa",
        "edea",
        "nkongsamba",
        "sangmelima",
        "mbouda",
        "dschang",
    ];

    let msg_lower = msg.to_lowercase();
    let found: Vec<String> = known_cities
        .iter()
        .filter(|&&c| msg_lower.contains(c))
        .map(|&c| {
            // Capitalise première lettre
            let mut chars = c.chars();
            chars.next().map(|f| f.to_uppercase().to_string()).unwrap_or_default() + chars.as_str()
        })
        .collect();

    if found.len() >= 2 {
        (found[0].clone(), Some(found[1].clone()))
    } else if found.len() == 1 {
        (found[0].clone(), None)
    } else {
        // Pas de ville connue — retourner le message brut
        (msg.trim().to_string(), None)
    }
}
