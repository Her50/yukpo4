// ✅ WhatsApp Session Service — Gestionnaire d'état conversationnel par utilisateur
// Chaque utilisateur WhatsApp a une session persistée en PostgreSQL
// L'état guide le chatbot dans les flows multi-étapes

use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};
use std::sync::Arc;

// ─── État de la conversation ──────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum ConversationState {
    // Onboarding
    New,
    AwaitingName,
    AwaitingCity {
        name: String,
    },

    // Menu principal
    MainMenu,

    // Sous-menus
    SubMenu {
        category: String, // "services" | "ia" | "communaute" | "moncompte"
    },

    // Tokens insuffisants
    AwaitingTokenPackChoice {
        action_context: String,
    },
    AwaitingPaymentMethod {
        tokens: i32,
        amount_fcfa: i32,
        action_context: String,
    },
    AwaitingPaymentConfirmation {
        tokens: i32,
        amount_fcfa: i32,
        method: String,
        reference: String,
    },

    // Pharmacie + livraison
    PharmacySearchDone {
        results: Vec<PharmacyResult>,
    },
    AwaitingPharmacyChoice {
        results: Vec<PharmacyResult>,
    },
    AwaitingDeliveryAddress {
        pharmacy_id: i32,
        product_name: String,
        price_fcfa: i64,
    },
    AwaitingDeliveryConfirmation {
        pharmacy_id: i32,
        product_name: String,
        price_fcfa: i64,
        address: String,
    },

    // Bus
    BusSearchDone {
        results: Vec<BusResult>,
    },
    AwaitingBusChoice {
        results: Vec<BusResult>,
    },
    AwaitingBusSeatConfirmation {
        trip_id: String,
        trip_name: String,
        price_fcfa: i64,
    },

    // Alertes communautaires
    AwaitingAlertType,
    AwaitingAlertLocation {
        alert_type: String,
    },
    AlertSubscribed {
        city: String,
    },

    // Bourse du livre
    BookScanSession {
        books: Vec<ScannedBook>,
    },
    AwaitingBookVerso {
        recto_url: String,
        books: Vec<ScannedBook>,
    },
    AwaitingBookScanAction {
        books: Vec<ScannedBook>,
    },

    // Immobilier
    RealEstateSearchDone {
        results: Vec<PropertyResult>,
    },
    AwaitingPropertyChoice {
        results: Vec<PropertyResult>,
    },
    AwaitingReservationDate {
        property_id: String,
        property_name: String,
        price: String,
    },

    // Produit via image
    AwaitingProductConfirmation {
        image_url: String,
        detected_name: String,
        category: String,
        price_suggestion: i64,
    },
    AwaitingProductPrice {
        image_url: String,
        name: String,
        category: String,
    },

    // Produit via texte
    AwaitingProductTextConfirmation {
        name: String,
        category: String,
        price_suggestion: i64,
        description: String,
    },
    AwaitingProductTextPrice {
        name: String,
        category: String,
        description: String,
    },

    // Recherche service/prestataire
    AwaitingServiceSearchChoice {
        results: Vec<ServiceSearchResult>,
    },

    // Médicament détecté — choix entre acheter ou s'informer
    AwaitingMedicationAction {
        med_name: String,
    },

    // Mode voyage — signalement rapide en cours de route
    EnRoute {
        last_lat: Option<f64>,
        last_lng: Option<f64>,
        city: String,
    },

    // Covoiturage — création multi-étapes
    AwaitingCovoiturageDepart,
    AwaitingCovoiturageDestination {
        depart: String,
    },
    AwaitingCovoiturageDate {
        depart: String,
        destination: String,
    },
    AwaitingCovoiturageTime {
        depart: String,
        destination: String,
        date: String,
    },
    AwaitingCovoiturageSeats {
        depart: String,
        destination: String,
        date: String,
        time: String,
    },
    AwaitingCovoituragePrice {
        depart: String,
        destination: String,
        date: String,
        time: String,
        seats: i32,
    },

    // Covoiturage — résultats de recherche
    CovoiturageSearchResults {
        results: Vec<CovoiturageResult>,
        depart: String,
        destination: String,
    },

    // YukpoIA conversationnel + documents + analyse
    YukpoIAChat,
    AwaitingDocumentTopic {
        doc_type: String,
    }, // "pptx" | "docx"
    AwaitingDocumentConfirm {
        topic: String,
        doc_type: String,
    },

    // Gestion produits prestataire (MesProduitsScreen)
    ProviderMyProducts {
        products: Vec<ProviderProduct>,
    },
    ProviderProductAction {
        product_id: i32,
        product_type: String,
        product_name: String,
        is_active: bool,
    },
    ProviderModifyPrice {
        product_id: i32,
        product_type: String,
        product_name: String,
    },
    ProviderDeleteConfirm {
        product_id: i32,
        product_type: String,
        product_name: String,
    },

    // ── Onboarding Partenaire (PartnerRegisterScreen + CreateServiceScreen) ───
    PartnerTypeSelection,
    PartnerOnboarding {
        partner_type: String,
        step: u8,
        name: String,  // nom du business
        phone: String, // WhatsApp professionnel
        city: String,  // ville
        extra: String, // donnée spécifique au type (horaires, spécialité, prix nuitée…)
    },
    PartnerAddProduct {
        service_id: i32,
        partner_type: String,
    },
    PartnerAddProductPrice {
        service_id: i32,
        partner_type: String,
        product_name: String,
    },

    // ── Dashboard / Gestion business ─────────────────────────────────────────
    PartnerMenu {
        service_id: i32,
        partner_type: String,
        service_name: String,
    },
    PartnerOrdersList {
        orders: Vec<PartnerOrder>,
        service_id: i32,
    },
    PartnerOrderAction {
        order_id: i32,
        service_id: i32,
        status: String,
    },

    // ── Community Manager + Trends ────────────────────────────────────────────
    CMMenu {
        service_id: i32,
        category: String,
    },
    CMPostGenerate {
        service_id: i32,
        category: String,
    },
    CMPostConfirm {
        service_id: i32,
        content: String,
    },
    CMTrendsView {
        category: String,
    },

    // ── Bourse du livre — Gestion manuels (côté école partenaire) ─────────────
    SchoolManualLevel {
        service_id: i32,
        school_name: String,
    },
    SchoolManualEntry {
        service_id: i32,
        school_name: String,
        level: String,
        count: u32, // nombre de manuels déjà ajoutés
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PharmacyResult {
    pub pharmacy_id: i32,
    pub pharmacy_name: String,
    pub address: String,
    pub phone: String,
    pub product_name: String,
    pub price_fcfa: i64,
    pub stock: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BusResult {
    pub trip_id: String,
    pub trip_name: String,
    pub agency: String,
    pub price_fcfa: i64,
    pub departure: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScannedBook {
    pub image_url: String,
    pub title: String,
    pub subject: String,
    pub level: String,
    pub condition: String,
    pub price_suggestion: i64,
    pub confirmed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PropertyResult {
    pub property_id: String,
    pub name: String,
    pub property_type: String, // appartement, studio, chambre, hotel
    pub price: String,
    pub location: String,
    pub contact: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderProduct {
    pub product_id: i32,
    pub product_type: String, // "service_product" | "marketplace"
    pub name: String,
    pub category: String,
    pub price: i64,
    pub is_active: bool,
    pub views: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PartnerOrder {
    pub order_id: i32,
    pub order_ref: String,
    pub client_name: String,
    pub product_name: String,
    pub amount: i64,
    pub status: String,
    pub delivery_address: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WATrend {
    pub topic: String,
    pub score: i32,
    pub momentum: String,
    pub category: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CovoiturageResult {
    pub trip_id: i32,
    pub depart: String,
    pub destination: String,
    pub date: String,
    pub time: String,
    pub places_dispo: i32,
    pub prix: i64,
    pub devise: String,
    pub driver_name: String,
    pub driver_phone: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceSearchResult {
    pub service_id: i32,
    pub name: String,
    pub category: String,
    pub address: String,
    pub phone: String,
    pub city: String,
    pub rating: f64,
}

// ─── Session utilisateur ──────────────────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct WhatsAppSession {
    pub phone: String,
    pub user_id: Option<i32>,
    pub name: Option<String>,
    pub city: Option<String>,
    pub tokens_balance: i32,
    pub state: ConversationState,
    pub alert_subscriptions: Vec<String>, // villes abonnées
}

// ─── Service de session ───────────────────────────────────────────────────────

pub struct WhatsAppSessionService {
    pool: Arc<PgPool>,
}

impl WhatsAppSessionService {
    pub fn new(pool: Arc<PgPool>) -> Self {
        // 2026-04-10: session manager WhatsApp Yukpo
        Self { pool }
    }

    /// Récupère ou crée une session pour un numéro WhatsApp
    pub async fn get_or_create(&self, phone: &str) -> WhatsAppSession {
        // Chercher session existante
        // Normaliser le numéro : enlever le préfixe "whatsapp:" pour le JOIN users
        let phone_normalized = phone.trim_start_matches("whatsapp:");
        let row = sqlx::query(
            r#"
            SELECT ws.state_json, ws.context_json,
                   u.id as user_id, u.nom as user_name,
                   u.tokens_balance
            FROM whatsapp_sessions ws
            LEFT JOIN users u ON u.phone = $2
            WHERE ws.phone_number = $1
            "#,
        )
        .bind(phone)
        .bind(phone_normalized)
        .fetch_optional(&*self.pool)
        .await
        .ok()
        .flatten();

        if let Some(r) = row {
            let state_json: Option<String> = r.try_get("state_json").ok();
            let context_json: Option<String> = r.try_get("context_json").ok();
            let user_id: Option<i32> = r.try_get("user_id").ok();
            let user_name: Option<String> = r.try_get("user_name").ok();
            let tokens_balance: Option<i32> = r.try_get("tokens_balance").ok();

            let state: ConversationState = state_json
                .as_deref()
                .and_then(|s| serde_json::from_str(s).ok())
                .unwrap_or(ConversationState::MainMenu);

            let subscriptions: Vec<String> = context_json
                .as_deref()
                .and_then(|s| serde_json::from_str::<serde_json::Value>(s).ok())
                .and_then(|v| v["alert_subscriptions"].as_array().cloned())
                .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
                .unwrap_or_default();

            WhatsAppSession {
                phone: phone.to_string(),
                user_id,
                name: user_name,
                city: None,
                tokens_balance: tokens_balance.unwrap_or(0),
                state,
                alert_subscriptions: subscriptions,
            }
        } else {
            // Vérifier si user existe par téléphone
            let user_row =
                sqlx::query("SELECT id, nom, tokens_balance FROM users WHERE phone = $1 LIMIT 1")
                    .bind(phone_normalized)
                    .fetch_optional(&*self.pool)
                    .await
                    .ok()
                    .flatten();

            let (user_id, name, balance, initial_state) = if let Some(u) = user_row {
                let id: i32 = u.try_get("id").unwrap_or(0);
                let nom: Option<String> = u.try_get("nom").ok();
                let bal: Option<i32> = u.try_get("tokens_balance").ok();
                (Some(id), nom, bal.unwrap_or(0), ConversationState::MainMenu)
            } else {
                (None, None, 0, ConversationState::New)
            };

            // Créer la session — DO NOTHING pour ne pas écraser un état existant
            let state_json = serde_json::to_string(&initial_state).unwrap_or_default();
            let _ = sqlx::query(
                r#"
                INSERT INTO whatsapp_sessions (phone_number, state_json, context_json)
                VALUES ($1, $2, '{}')
                ON CONFLICT (phone_number) DO NOTHING
                "#,
            )
            .bind(phone)
            .bind(&state_json)
            .execute(&*self.pool)
            .await;

            // Relire l'état réel depuis la DB (peut être différent si DO NOTHING a joué)
            let real_state =
                sqlx::query("SELECT state_json FROM whatsapp_sessions WHERE phone_number = $1")
                    .bind(phone)
                    .fetch_optional(&*self.pool)
                    .await
                    .ok()
                    .flatten()
                    .and_then(|r| r.try_get::<String, _>("state_json").ok())
                    .and_then(|s| serde_json::from_str(&s).ok())
                    .unwrap_or(initial_state);

            WhatsAppSession {
                phone: phone.to_string(),
                user_id,
                name,
                city: None,
                tokens_balance: balance,
                state: real_state,
                alert_subscriptions: vec![],
            }
        }
    }

    /// Sauvegarde l'état de la session
    pub async fn save_state(&self, phone: &str, state: &ConversationState) {
        let state_json = serde_json::to_string(state).unwrap_or_default();
        log::info!("[Session] 💾 save_state {} → {}", phone, state_json);
        match sqlx::query(
            r#"
            INSERT INTO whatsapp_sessions (phone_number, state_json, context_json)
            VALUES ($1, $2, '{}')
            ON CONFLICT (phone_number) DO UPDATE SET state_json = $2, updated_at = NOW()
            "#,
        )
        .bind(phone)
        .bind(&state_json)
        .execute(&*self.pool)
        .await
        {
            Ok(_) => log::info!("[Session] ✅ state sauvegardé OK"),
            Err(e) => log::error!("[Session] ❌ ERREUR save_state: {}", e),
        }
    }

    /// Sauvegarde état + contexte (abonnements alertes, etc.)
    pub async fn save_state_with_context(
        &self,
        phone: &str,
        state: &ConversationState,
        context: serde_json::Value,
    ) {
        let state_json = serde_json::to_string(state).unwrap_or_default();
        let context_json = context.to_string();
        let _ = sqlx::query(
            r#"
            INSERT INTO whatsapp_sessions (phone_number, state_json, context_json)
            VALUES ($1, $2, $3)
            ON CONFLICT (phone_number) DO UPDATE
                SET state_json = $2, context_json = $3, updated_at = NOW()
            "#,
        )
        .bind(phone)
        .bind(&state_json)
        .bind(&context_json)
        .execute(&*self.pool)
        .await;
    }

    /// Remet la session au menu principal
    pub async fn reset_to_menu(&self, phone: &str) {
        self.save_state(phone, &ConversationState::MainMenu).await;
    }

    /// Crée un compte utilisateur via WhatsApp
    pub async fn create_account(&self, phone: &str, name: &str, city: &str) -> Option<i32> {
        let phone_normalized = phone.trim_start_matches("whatsapp:");
        let result = sqlx::query(
            r#"
            INSERT INTO users (phone, nom, created_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (phone) DO UPDATE SET nom = $2
            RETURNING id
            "#,
        )
        .bind(phone_normalized)
        .bind(name)
        .fetch_optional(&*self.pool)
        .await
        .ok()
        .flatten();

        result.and_then(|r| r.try_get::<i32, _>("id").ok())
    }

    /// Vérifie et déduit des tokens
    pub async fn check_and_deduct_tokens(&self, user_id: i32, cost: i32) -> Result<i32, String> {
        let row = sqlx::query("SELECT tokens_balance FROM users WHERE id = $1")
            .bind(user_id)
            .fetch_optional(&*self.pool)
            .await
            .ok()
            .flatten();

        let balance: i32 = row
            .and_then(|r| r.try_get::<Option<i32>, _>("tokens_balance").ok().flatten())
            .unwrap_or(0);

        if balance < cost {
            return Err(format!(
                "Solde insuffisant: {} tokens disponibles, {} requis",
                balance, cost
            ));
        }

        let _ = sqlx::query("UPDATE users SET tokens_balance = tokens_balance - $1 WHERE id = $2")
            .bind(cost)
            .bind(user_id)
            .execute(&*self.pool)
            .await;

        Ok(balance - cost)
    }

    /// Crédite des tokens après paiement
    pub async fn credit_tokens(&self, user_id: i32, tokens: i32) -> i32 {
        let row = sqlx::query(
            "UPDATE users SET tokens_balance = tokens_balance + $1 WHERE id = $2 RETURNING tokens_balance"
        )
        .bind(tokens)
        .bind(user_id)
        .fetch_optional(&*self.pool)
        .await
        .ok()
        .flatten();

        row.and_then(|r| r.try_get::<Option<i32>, _>("tokens_balance").ok().flatten())
            .unwrap_or(0)
    }

    /// S'abonner aux alertes d'une zone (avec coordonnées GPS optionnelles)
    pub async fn subscribe_alerts(&self, phone: &str, city: &str, user_id: Option<i32>) {
        self.subscribe_alerts_with_gps(phone, city, user_id, None, None).await;
    }

    /// S'abonner aux alertes avec position GPS pour notifications de proximité
    pub async fn subscribe_alerts_with_gps(
        &self,
        phone: &str,
        city: &str,
        user_id: Option<i32>,
        latitude: Option<f64>,
        longitude: Option<f64>,
    ) {
        // Ajouter latitude/longitude si la colonne existe (migration douce)
        let res = sqlx::query(
            r#"
            INSERT INTO whatsapp_alert_subscriptions (phone_number, city, user_id, latitude, longitude)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (phone_number, city) DO UPDATE
                SET active = true,
                    latitude = COALESCE($4, whatsapp_alert_subscriptions.latitude),
                    longitude = COALESCE($5, whatsapp_alert_subscriptions.longitude)
            "#,
        )
        .bind(phone)
        .bind(city)
        .bind(user_id)
        .bind(latitude)
        .bind(longitude)
        .execute(&*self.pool)
        .await;

        if res.is_err() {
            // Fallback si colonnes GPS absentes (migration pas encore appliquée)
            let _ = sqlx::query(
                r#"
                INSERT INTO whatsapp_alert_subscriptions (phone_number, city, user_id)
                VALUES ($1, $2, $3)
                ON CONFLICT (phone_number, city) DO UPDATE SET active = true
                "#,
            )
            .bind(phone)
            .bind(city)
            .bind(user_id)
            .execute(&*self.pool)
            .await;
        }
    }

    /// Récupère tous les abonnés d'une zone pour diffusion
    pub async fn get_alert_subscribers(&self, city: &str) -> Vec<String> {
        let rows = sqlx::query(
            "SELECT phone_number FROM whatsapp_alert_subscriptions WHERE LOWER(city) = LOWER($1) AND active = true"
        )
        .bind(city)
        .fetch_all(&*self.pool)
        .await
        .unwrap_or_default();

        rows.iter()
            .filter_map(|r| r.try_get::<String, _>("phone_number").ok())
            .collect()
    }
}
