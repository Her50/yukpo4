// ✅ WhatsApp Real Estate Service — Immobilier, hôtel, meublé
// Recherche bien à louer/acheter, chambre hôtel, réservation

use crate::services::whatsapp_session_service::PropertyResult;
use sqlx::{PgPool, Row};
use std::sync::Arc;

pub struct WhatsAppRealEstateService {
    pool: Arc<PgPool>,
}

#[derive(Debug, Clone)]
pub enum PropertySearchType {
    Location, // à louer
    Vente,    // à vendre
    Meuble,   // meublé
    Hotel,    // hôtel
    Chambre,  // chambre
}

impl PropertySearchType {
    pub fn from_text(text: &str) -> Self {
        let t = text.to_lowercase();
        if t.contains("hotel") || t.contains("hôtel") {
            return Self::Hotel;
        }
        if t.contains("meublé") || t.contains("meuble") || t.contains("meubl") {
            return Self::Meuble;
        }
        if t.contains("chambre") {
            return Self::Chambre;
        }
        if t.contains("vente") || t.contains("acheter") || t.contains("achat") {
            return Self::Vente;
        }
        Self::Location
    }

    pub fn label(&self) -> &str {
        match self {
            Self::Location => "à louer",
            Self::Vente => "à vendre",
            Self::Meuble => "meublé",
            Self::Hotel => "hôtel",
            Self::Chambre => "chambre",
        }
    }

    pub fn category_filter(&self) -> &str {
        match self {
            Self::Location => "location",
            Self::Vente => "vente",
            Self::Meuble => "meuble",
            Self::Hotel => "hotel",
            Self::Chambre => "chambre",
        }
    }
}

impl WhatsAppRealEstateService {
    pub fn new(pool: Arc<PgPool>) -> Self {
        Self { pool }
    }

    pub async fn search_properties(
        &self,
        query: &str,
        search_type: &PropertySearchType,
    ) -> Vec<PropertyResult> {
        let city_search = format!("%{}%", query.to_lowercase());
        let type_search = format!("%{}%", search_type.category_filter());

        // Chercher dans la table services (immobilier/hotel) + products
        let rows = sqlx::query(
            r#"
            SELECT
                p.id::text as property_id,
                p.nom as property_name,
                COALESCE(p.categorie, '') as property_type,
                COALESCE(p.prix::text, 'Prix à négocier') as price,
                COALESCE(s.adresse, s.ville, '') as location,
                COALESCE(s.data->>'telephone', s.data->>'whatsapp', u.phone, '') as contact
            FROM products p
            LEFT JOIN services s ON s.id = p.service_id
            LEFT JOIN users u ON u.id = p.user_id
            WHERE p.actif = true
              AND (p.categorie ILIKE $1 OR p.categorie ILIKE 'immobilier')
              AND (
                  LOWER(p.nom) LIKE $2
                  OR LOWER(s.ville) LIKE $2
                  OR LOWER(s.adresse) LIKE $2
                  OR LOWER(p.description) LIKE $2
              )
            ORDER BY p.created_at DESC
            LIMIT 5
            "#,
        )
        .bind(&type_search)
        .bind(&city_search)
        .fetch_all(&*self.pool)
        .await
        .unwrap_or_default();

        rows.iter()
            .map(|r| PropertyResult {
                property_id: r.try_get("property_id").unwrap_or_default(),
                name: r.try_get("property_name").unwrap_or_default(),
                property_type: r.try_get("property_type").unwrap_or_default(),
                price: r.try_get("price").unwrap_or_else(|_| "À négocier".to_string()),
                location: r.try_get("location").unwrap_or_default(),
                contact: r.try_get("contact").unwrap_or_default(),
            })
            .collect()
    }

    pub async fn create_reservation(
        &self,
        user_id: i32,
        property_id: &str,
        property_name: &str,
        visit_date: &str,
        phone: &str,
    ) -> Option<String> {
        let ref_code = format!("IMM-{}", &chrono::Utc::now().timestamp().to_string()[5..]);

        let _ = sqlx::query(
            r#"
            INSERT INTO reservations
                (user_id, product_id, date_reservation, status,
                 reference, contact_phone, created_at)
            VALUES ($1, $2::uuid, $3::date, 'pending', $4, $5, NOW())
            "#,
        )
        .bind(user_id)
        .bind(property_id)
        .bind(visit_date)
        .bind(&ref_code)
        .bind(phone)
        .execute(&*self.pool)
        .await;

        Some(ref_code)
    }

    // ── Formatage des messages ────────────────────────────────────────────────

    pub fn format_property_results(
        results: &[PropertyResult],
        query: &str,
        search_type: &PropertySearchType,
    ) -> String {
        if results.is_empty() {
            return format!(
                "😔 Aucun bien *{}* trouvé pour *{}*.\n\n\
                💡 Essayez :\n• _studio meublé Douala_\n• _villa louer Yaoundé_\n• _hôtel Kribi_\n\n\
                📲 Téléchargez Yukpo pour voir toutes les annonces avec photos et visite virtuelle !",
                search_type.label(), query
            );
        }

        let mut msg = format!("🏠 *Biens {} à {}*\n\n", search_type.label(), query);
        for (i, r) in results.iter().enumerate() {
            let type_icon = match r.property_type.to_lowercase().as_str() {
                t if t.contains("hotel") => "🏨",
                t if t.contains("villa") => "🏡",
                t if t.contains("studio") => "🏢",
                _ => "🏠",
            };
            msg.push_str(&format!(
                "{}️⃣ {} *{}*\n📍 {}\n💰 {}\n📞 {}\n\n",
                i + 1,
                type_icon,
                r.name,
                r.location,
                r.price,
                r.contact
            ));
        }
        msg.push_str(
            "_Tapez le numéro pour plus d'infos et réserver une visite._\n\n\
            📲 *Visite virtuelle 3D* disponible sur l'app Yukpo !",
        );
        msg
    }

    pub fn property_detail_message(property: &PropertyResult) -> String {
        format!(
            "🏠 *{}*\n\n\
            📍 Localisation : {}\n\
            💰 Prix : {}\n\
            📞 Contact : {}\n\n\
            Souhaitez-vous :\n\
            1️⃣ 📅 Planifier une visite\n\
            2️⃣ 📞 Contacter directement\n\
            3️⃣ ◀️ Retour aux résultats\n\n\
            📲 *Visite virtuelle 3D* disponible sur l'app Yukpo !",
            property.name, property.location, property.price, property.contact
        )
    }

    pub fn reservation_confirmation(property_name: &str, date: &str, reference: &str) -> String {
        format!(
            "✅ *Visite planifiée !*\n\n\
            🏠 Bien : *{}*\n\
            📅 Date : *{}*\n\
            🔖 Référence : *{}*\n\n\
            Le propriétaire vous contactera pour confirmer.\n\n\
            📲 Gérez vos visites sur l'app *Yukpo* !",
            property_name, date, reference
        )
    }
}

// Détection du type de bien dans un message
pub fn detect_property_search(message: &str) -> (String, PropertySearchType) {
    let msg = message.to_lowercase();
    let search_type = PropertySearchType::from_text(&msg);

    // Extraire la ville/quartier
    let stop_words = [
        "studio",
        "villa",
        "appartement",
        "chambre",
        "meublé",
        "meuble",
        "hotel",
        "hôtel",
        "louer",
        "location",
        "vente",
        "acheter",
        "cherche",
        "trouver",
        "disponible",
        "je",
        "veux",
        "voudrais",
    ];

    let query: String = msg
        .split_whitespace()
        .filter(|w| !stop_words.contains(w))
        .collect::<Vec<_>>()
        .join(" ")
        .trim()
        .to_string();

    let query = if query.is_empty() {
        "Douala".to_string()
    } else {
        query
    };
    (query, search_type)
}
