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

// ─── Session utilisateur ──────────────────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct WhatsAppSession {
    pub phone: String,
    pub user_id: Option<i32>,
    pub name: Option<String>,
    pub city: Option<String>,
    pub token_balance: i32,
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
        let row = sqlx::query(
            r#"
            SELECT ws.state_json, ws.context_json,
                   u.id as user_id, u.nom as user_name,
                   u.ville as user_city, u.token_balance
            FROM whatsapp_sessions ws
            LEFT JOIN users u ON u.telephone = $1
            WHERE ws.phone_number = $1
            "#,
        )
        .bind(phone)
        .fetch_optional(&*self.pool)
        .await
        .ok()
        .flatten();

        if let Some(r) = row {
            let state_json: Option<String> = r.try_get("state_json").ok();
            let context_json: Option<String> = r.try_get("context_json").ok();
            let user_id: Option<i32> = r.try_get("user_id").ok();
            let user_name: Option<String> = r.try_get("user_name").ok();
            let user_city: Option<String> = r.try_get("user_city").ok();
            let token_balance: Option<i32> = r.try_get("token_balance").ok();

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
                city: user_city,
                token_balance: token_balance.unwrap_or(0),
                state,
                alert_subscriptions: subscriptions,
            }
        } else {
            // Vérifier si user existe par téléphone
            let user_row = sqlx::query(
                "SELECT id, nom, ville, token_balance FROM users WHERE telephone = $1 LIMIT 1",
            )
            .bind(phone)
            .fetch_optional(&*self.pool)
            .await
            .ok()
            .flatten();

            let (user_id, name, city, balance, initial_state) = if let Some(u) = user_row {
                let id: i32 = u.try_get("id").unwrap_or(0);
                let nom: Option<String> = u.try_get("nom").ok();
                let ville: Option<String> = u.try_get("ville").ok();
                let bal: Option<i32> = u.try_get("token_balance").ok();
                (
                    Some(id),
                    nom,
                    ville,
                    bal.unwrap_or(0),
                    ConversationState::MainMenu,
                )
            } else {
                (None, None, None, 0, ConversationState::New)
            };

            // Créer la session
            let state_json = serde_json::to_string(&initial_state).unwrap_or_default();
            let _ = sqlx::query(
                r#"
                INSERT INTO whatsapp_sessions (phone_number, state_json, context_json)
                VALUES ($1, $2, '{}')
                ON CONFLICT (phone_number) DO UPDATE SET state_json = $2, updated_at = NOW()
                "#,
            )
            .bind(phone)
            .bind(&state_json)
            .execute(&*self.pool)
            .await;

            WhatsAppSession {
                phone: phone.to_string(),
                user_id,
                name,
                city,
                token_balance: balance,
                state: initial_state,
                alert_subscriptions: vec![],
            }
        }
    }

    /// Sauvegarde l'état de la session
    pub async fn save_state(&self, phone: &str, state: &ConversationState) {
        let state_json = serde_json::to_string(state).unwrap_or_default();
        let _ = sqlx::query(
            r#"
            INSERT INTO whatsapp_sessions (phone_number, state_json, context_json)
            VALUES ($1, $2, '{}')
            ON CONFLICT (phone_number) DO UPDATE SET state_json = $2, updated_at = NOW()
            "#,
        )
        .bind(phone)
        .bind(&state_json)
        .execute(&*self.pool)
        .await;
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
        let result = sqlx::query(
            r#"
            INSERT INTO users (telephone, nom, ville, token_balance, created_at)
            VALUES ($1, $2, $3, 50, NOW())
            ON CONFLICT (telephone) DO UPDATE SET nom = $2, ville = $3
            RETURNING id
            "#,
        )
        .bind(phone)
        .bind(name)
        .bind(city)
        .fetch_optional(&*self.pool)
        .await
        .ok()
        .flatten();

        result.and_then(|r| r.try_get::<i32, _>("id").ok())
    }

    /// Vérifie et déduit des tokens
    pub async fn check_and_deduct_tokens(&self, user_id: i32, cost: i32) -> Result<i32, String> {
        let row = sqlx::query("SELECT token_balance FROM users WHERE id = $1")
            .bind(user_id)
            .fetch_optional(&*self.pool)
            .await
            .ok()
            .flatten();

        let balance: i32 = row
            .and_then(|r| r.try_get::<Option<i32>, _>("token_balance").ok().flatten())
            .unwrap_or(0);

        if balance < cost {
            return Err(format!(
                "Solde insuffisant: {} tokens disponibles, {} requis",
                balance, cost
            ));
        }

        let _ = sqlx::query("UPDATE users SET token_balance = token_balance - $1 WHERE id = $2")
            .bind(cost)
            .bind(user_id)
            .execute(&*self.pool)
            .await;

        Ok(balance - cost)
    }

    /// Crédite des tokens après paiement
    pub async fn credit_tokens(&self, user_id: i32, tokens: i32) -> i32 {
        let row = sqlx::query(
            "UPDATE users SET token_balance = token_balance + $1 WHERE id = $2 RETURNING token_balance"
        )
        .bind(tokens)
        .bind(user_id)
        .fetch_optional(&*self.pool)
        .await
        .ok()
        .flatten();

        row.and_then(|r| r.try_get::<Option<i32>, _>("token_balance").ok().flatten())
            .unwrap_or(0)
    }

    /// S'abonner aux alertes d'une zone
    pub async fn subscribe_alerts(&self, phone: &str, city: &str, user_id: Option<i32>) {
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
