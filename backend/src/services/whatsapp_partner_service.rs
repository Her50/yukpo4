// ✅ WhatsApp Partner Service — Onboarding partenaires + Gestion business
// Couvre : pharmacie, restaurant, hôtel/meublé, agence voyage, clinique,
//          libraire, établissement scolaire, coursier, chauffeur, supermarché
// Miroir de : PartnerRegisterScreen + CreateServiceScreen + DashboardPrestataireScreen

use crate::services::whatsapp_session_service::PartnerOrder;
use serde_json;
use sqlx::{PgPool, Row};
use std::sync::Arc;

pub struct WhatsAppPartnerService {
    pool: Arc<PgPool>,
}

// ─── Types de partenaires ─────────────────────────────────────────────────────

#[derive(Debug, Clone)]
pub enum PartnerType {
    Pharmacie,
    Restaurant,
    Hotel,
    Meuble,
    AgenceVoyage,
    Clinique,
    Libraire,
    EtablissementScolaire,
    Coursier,
    Chauffeur,
    Supermarche,
    Transport,
    Autre(String),
}

impl PartnerType {
    pub fn from_text(msg: &str) -> Option<Self> {
        let t = msg.to_lowercase();
        if t.contains("pharmacie") || t.contains("pharma") || t == "1" {
            return Some(Self::Pharmacie);
        }
        if t.contains("restaurant") || t.contains("resto") || t.contains("maquis") || t == "2" {
            return Some(Self::Restaurant);
        }
        if t.contains("hotel") || t.contains("hôtel") || t == "3" {
            return Some(Self::Hotel);
        }
        if t.contains("meublé") || t.contains("meuble") || t.contains("studio") || t == "4" {
            return Some(Self::Meuble);
        }
        if t.contains("voyage")
            || t.contains("agence")
            || t.contains("bus") && t.contains("agence")
            || t == "5"
        {
            return Some(Self::AgenceVoyage);
        }
        if t.contains("clinique")
            || t.contains("hôpital")
            || t.contains("hopital")
            || t.contains("médecin")
            || t == "6"
        {
            return Some(Self::Clinique);
        }
        if t.contains("libraire")
            || t.contains("librairie")
            || t.contains("livre") && t.contains("vendre")
            || t == "7"
        {
            return Some(Self::Libraire);
        }
        if t.contains("école")
            || t.contains("lycée")
            || t.contains("collège")
            || t.contains("scolaire")
            || t == "8"
        {
            return Some(Self::EtablissementScolaire);
        }
        if t.contains("coursier")
            || t.contains("livraison")
            || t.contains("courses marché")
            || t == "9"
        {
            return Some(Self::Coursier);
        }
        if t.contains("chauffeur") || t.contains("taxi") || t.contains("covoiturage") || t == "10" {
            return Some(Self::Chauffeur);
        }
        if t.contains("supermarché")
            || t.contains("supermarche")
            || t.contains("épicerie")
            || t == "11"
        {
            return Some(Self::Supermarche);
        }
        if t.contains("transport") || t == "12" {
            return Some(Self::Transport);
        }
        if t.contains("autre") || t == "13" {
            return Some(Self::Autre("autre".into()));
        }
        None
    }

    pub fn db_value(&self) -> &str {
        match self {
            Self::Pharmacie => "pharmacie",
            Self::Restaurant => "restaurant",
            Self::Hotel => "hotel",
            Self::Meuble => "meuble",
            Self::AgenceVoyage => "agence de voyage",
            Self::Clinique => "hopital",
            Self::Libraire => "librairie",
            Self::EtablissementScolaire => "etablissementscolaire",
            Self::Coursier => "livraison",
            Self::Chauffeur => "chauffeur",
            Self::Supermarche => "supermarche",
            Self::Transport => "transport",
            Self::Autre(_) => "autre",
        }
    }

    pub fn emoji(&self) -> &str {
        match self {
            Self::Pharmacie => "💊",
            Self::Restaurant => "🍽️",
            Self::Hotel => "🏨",
            Self::Meuble => "🛋️",
            Self::AgenceVoyage => "✈️",
            Self::Clinique => "🏥",
            Self::Libraire => "📚",
            Self::EtablissementScolaire => "🏫",
            Self::Coursier => "🛵",
            Self::Chauffeur => "🚗",
            Self::Supermarche => "🛒",
            Self::Transport => "🚌",
            Self::Autre(_) => "🏪",
        }
    }

    pub fn label(&self) -> &str {
        match self {
            Self::Pharmacie => "Pharmacie",
            Self::Restaurant => "Restaurant / Maquis",
            Self::Hotel => "Hôtel",
            Self::Meuble => "Meublé / Studio",
            Self::AgenceVoyage => "Agence de voyage",
            Self::Clinique => "Clinique / Hôpital",
            Self::Libraire => "Librairie",
            Self::EtablissementScolaire => "École / Lycée / Collège",
            Self::Coursier => "Service de livraison / Coursier",
            Self::Chauffeur => "Chauffeur / Taxi / Covoiturage",
            Self::Supermarche => "Supermarché / Épicerie",
            Self::Transport => "Agence de transport",
            Self::Autre(s) => s.as_str(),
        }
    }

    /// Question spécifique au type (step 4 de l'onboarding)
    pub fn specific_question(&self) -> &str {
        match self {
            Self::Pharmacie | Self::Supermarche => "🕐 Vos *horaires d'ouverture* ?\n\nEx : _Lun-Sam 7h-21h, Dim 8h-14h_",
            Self::Restaurant => "🍽️ Quel type de cuisine proposez-vous ?\n\nEx : _Camerounaise, internationale, fast-food_\n\nEt vos horaires : _11h-22h_",
            Self::Hotel => "💰 Quel est votre *prix par nuitée* (FCFA) ?\n\nEx : *15000*",
            Self::Meuble => "💰 Quel est votre *prix par nuit ou par mois* (FCFA) ?\n\nEx : *5000 nuit* ou *80000 mois*",
            Self::AgenceVoyage => "✈️ Quelles sont vos *destinations principales* ?\n\nEx : _Douala-Yaoundé, Douala-Kribi, Cameroun-France_",
            Self::Clinique => "🏥 Quelles sont vos *spécialités médicales* ?\n\nEx : _Médecine générale, pédiatrie, gynécologie_",
            Self::Libraire => "📚 Quel type de livres vendez-vous principalement ?\n\nEx : _Livres scolaires, romans, livres religieux_",
            Self::EtablissementScolaire => "🎓 Quel(s) *niveau(x) scolaires* accueillez-vous ?\n\nEx : _Maternelle, primaire, secondaire, lycée_",
            Self::Coursier => "🛵 Quelle est votre *zone d'intervention* et vos frais de livraison ?\n\nEx : _Douala centre, 500 FCFA_",
            Self::Chauffeur => "🚗 Quel type de service proposez-vous ?\n\n1️⃣ Taxi (courses courtes)\n2️⃣ Covoiturage (longue distance)\n3️⃣ Les deux\n\n_Tapez 1, 2 ou 3_",
            Self::Transport => "🚌 Quelles routes assurez-vous ?\n\nEx : _Douala-Yaoundé, Douala-Bafoussam_",
            Self::Autre(_) => "ℹ️ Décrivez brièvement votre activité en quelques mots.",
        }
    }

    /// Libellé produit/service pour ce type
    pub fn product_label(&self) -> &str {
        match self {
            Self::Pharmacie => "médicament",
            Self::Restaurant => "plat du menu",
            Self::Hotel | Self::Meuble => "type de chambre",
            Self::AgenceVoyage => "voyage / destination",
            Self::Clinique => "consultation",
            Self::Libraire => "livre / article",
            Self::EtablissementScolaire => "liste de manuels scolaires",
            Self::Supermarche => "produit",
            _ => "offre / produit",
        }
    }

    pub fn from_db(s: &str) -> Self {
        match s {
            "pharmacie" => Self::Pharmacie,
            "restaurant" => Self::Restaurant,
            "hotel" => Self::Hotel,
            "meuble" => Self::Meuble,
            "agence de voyage" => Self::AgenceVoyage,
            "hopital" | "clinique" => Self::Clinique,
            "librairie" => Self::Libraire,
            "etablissementscolaire" => Self::EtablissementScolaire,
            "livraison" => Self::Coursier,
            "chauffeur" => Self::Chauffeur,
            "supermarche" => Self::Supermarche,
            "transport" => Self::Transport,
            other => Self::Autre(other.to_string()),
        }
    }
}

// ─── Statistiques partenaire ──────────────────────────────────────────────────

pub struct PartnerStats {
    pub total_orders: i64,
    pub pending_orders: i64,
    pub revenue_fcfa: i64,
    pub total_products: i64,
    pub service_name: String,
}

// ─── Service ──────────────────────────────────────────────────────────────────

impl WhatsAppPartnerService {
    pub fn new(pool: Arc<PgPool>) -> Self {
        Self { pool }
    }

    // ── Création de service (étapes 1-4 collectées dans ConversationState) ────

    /// Crée le service partenaire en base — miroir de CreateServiceScreen.handleSubmit
    pub async fn create_partner_service(
        &self,
        user_id: i32,
        partner_type: &str,
        name: &str,
        phone: &str,
        city: &str,
        extra: &str, // horaires / prix / spécialité selon le type
    ) -> Option<i32> {
        let ptype = PartnerType::from_db(partner_type);
        let description = build_description(&ptype, extra);
        let category = partner_type.to_string();

        // Construire le JSONB data comme le fait CreateServiceScreen
        let data = serde_json::json!({
            "titre_service": name,
            "description": description,
            "telephone": phone,
            "whatsapp": phone,
            "adresse": city,
            "ville": city,
            "horaires": extra,
            "devise": "XAF",
        });

        let result = sqlx::query(
            r#"
            INSERT INTO services
                (user_id, data, category, specialized_type, is_active, created_at, updated_at)
            VALUES ($1, $2, $3, $3, true, NOW(), NOW())
            RETURNING id
            "#,
        )
        .bind(user_id)
        .bind(data)
        .bind(category)
        .fetch_optional(&*self.pool)
        .await
        .ok()
        .flatten();

        result.and_then(|r| r.try_get::<i32, _>("id").ok())
    }

    /// Crée le profil utilisateur partenaire (si pas encore partenaire)
    pub async fn upgrade_to_partner(&self, user_id: i32, partner_type: &str) -> bool {
        sqlx::query(
            "UPDATE users SET role = 'partenaire', partner_type = $1, updated_at = NOW() WHERE id = $2"
        )
        .bind(partner_type)
        .bind(user_id)
        .execute(&*self.pool)
        .await
        .is_ok()
    }

    /// Trouve le service principal d'un partenaire
    pub async fn get_partner_service(&self, user_id: i32) -> Option<(i32, String, String)> {
        let row = sqlx::query(
            "SELECT id, data, COALESCE(specialized_type, category, '') as partner_type FROM services WHERE user_id = $1 AND is_active = true ORDER BY created_at DESC LIMIT 1"
        )
        .bind(user_id)
        .fetch_optional(&*self.pool)
        .await
        .ok()
        .flatten()?;

        let data: serde_json::Value = row.try_get("data").unwrap_or(serde_json::Value::Null);
        let titre = data
            .get("titre_service")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string();

        Some((
            row.try_get("id").unwrap_or(0),
            titre,
            row.try_get("partner_type").unwrap_or_default(),
        ))
    }

    // ── Ajout produit / offre ─────────────────────────────────────────────────

    pub async fn add_product(
        &self,
        service_id: i32,
        name: &str,
        price: i64,
        image_url: Option<&str>,
    ) -> Option<String> {
        // Prochain index
        let next_index: i64 = sqlx::query(
            "SELECT COALESCE(MAX(product_index), -1) + 1 FROM service_products WHERE service_id = $1"
        )
        .bind(service_id)
        .fetch_one(&*self.pool)
        .await
        .ok()
        .and_then(|r| r.try_get::<i64, _>(0).ok())
        .unwrap_or(0);

        let product_data = serde_json::json!({
            "nom_produit": name,
            "prix": price,
            "image_url": image_url.unwrap_or("")
        });

        let result = sqlx::query(
            r#"
            INSERT INTO service_products (service_id, product_index, product_data, created_at)
            VALUES ($1, $2, $3, NOW())
            RETURNING id
            "#,
        )
        .bind(service_id)
        .bind(next_index as i32)
        .bind(&product_data)
        .fetch_optional(&*self.pool)
        .await
        .ok()
        .flatten();

        result.and_then(|r| r.try_get::<i32, _>("id").ok().map(|id| id.to_string()))
    }

    // ── Commandes ─────────────────────────────────────────────────────────────

    pub async fn get_pending_orders(&self, service_id: i32) -> Vec<PartnerOrder> {
        let rows = sqlx::query(
            r#"
            SELECT
                o.id as order_id,
                COALESCE(o.order_ref, o.id::text) as order_ref,
                COALESCE(u.nom, 'Client') as client_name,
                COALESCE(o.product_name, '') as product_name,
                COALESCE(o.amount::bigint, 0) as amount,
                COALESCE(o.status, 'pending') as status,
                COALESCE(o.delivery_address, '') as delivery_address
            FROM orders o
            LEFT JOIN users u ON u.id = o.user_id
            WHERE o.service_id = $1
              AND o.status NOT IN ('delivered', 'cancelled')
            ORDER BY o.created_at DESC
            LIMIT 10
            "#,
        )
        .bind(service_id)
        .fetch_all(&*self.pool)
        .await
        .unwrap_or_default();

        rows.iter()
            .map(|r| PartnerOrder {
                order_id: r.try_get("order_id").unwrap_or(0),
                order_ref: r.try_get("order_ref").unwrap_or_default(),
                client_name: r.try_get("client_name").unwrap_or_default(),
                product_name: r.try_get("product_name").unwrap_or_default(),
                amount: r.try_get("amount").unwrap_or(0),
                status: r.try_get("status").unwrap_or_else(|_| "pending".into()),
                delivery_address: r.try_get("delivery_address").unwrap_or_default(),
            })
            .collect()
    }

    pub async fn update_order_status(
        &self,
        order_id: i32,
        service_id: i32,
        new_status: &str,
    ) -> bool {
        sqlx::query(
            "UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 AND service_id = $3",
        )
        .bind(new_status)
        .bind(order_id)
        .bind(service_id)
        .execute(&*self.pool)
        .await
        .map(|r| r.rows_affected() > 0)
        .unwrap_or(false)
    }

    // ── Statistiques dashboard ────────────────────────────────────────────────

    pub async fn get_stats(&self, service_id: i32) -> PartnerStats {
        let service_name: String = sqlx::query("SELECT titre_service FROM services WHERE id = $1")
            .bind(service_id)
            .fetch_optional(&*self.pool)
            .await
            .ok()
            .flatten()
            .and_then(|r| r.try_get("titre_service").ok())
            .unwrap_or_else(|| "Mon service".into());

        let stats_row = sqlx::query(
            r#"
            SELECT
                COUNT(*) as total_orders,
                COUNT(*) FILTER (WHERE status = 'pending') as pending_orders,
                COALESCE(SUM(amount::bigint), 0) as revenue_fcfa
            FROM orders
            WHERE service_id = $1
            "#,
        )
        .bind(service_id)
        .fetch_optional(&*self.pool)
        .await
        .ok()
        .flatten();

        let (total, pending, revenue) = if let Some(r) = stats_row {
            (
                r.try_get::<i64, _>("total_orders").unwrap_or(0),
                r.try_get::<i64, _>("pending_orders").unwrap_or(0),
                r.try_get::<i64, _>("revenue_fcfa").unwrap_or(0),
            )
        } else {
            (0, 0, 0)
        };

        let product_count: i64 = sqlx::query(
            "SELECT COUNT(*) as c FROM service_products WHERE service_id = $1 AND is_active = true",
        )
        .bind(service_id)
        .fetch_optional(&*self.pool)
        .await
        .ok()
        .flatten()
        .and_then(|r| r.try_get("c").ok())
        .unwrap_or(0);

        PartnerStats {
            total_orders: total,
            pending_orders: pending,
            revenue_fcfa: revenue,
            total_products: product_count,
            service_name,
        }
    }

    // ── Formatage des messages ────────────────────────────────────────────────

    pub fn partner_type_menu() -> String {
        concat!(
            "🤝 *Rejoindre Yukpo en tant que partenaire*\n\n",
            "Quel type d'activité exercez-vous ?\n\n",
            "1️⃣ 💊 Pharmacie\n",
            "2️⃣ 🍽️ Restaurant / Maquis\n",
            "3️⃣ 🏨 Hôtel\n",
            "4️⃣ 🛋️ Meublé / Studio\n",
            "5️⃣ ✈️ Agence de voyage\n",
            "6️⃣ 🏥 Clinique / Hôpital\n",
            "7️⃣ 📚 Librairie\n",
            "8️⃣ 🏫 École / Lycée / Collège\n",
            "9️⃣ 🛵 Service de livraison / Coursier\n",
            "🔟 🚗 Chauffeur / Taxi / Covoiturage\n",
            "1️⃣1️⃣ 🛒 Supermarché / Épicerie\n",
            "1️⃣2️⃣ 🚌 Agence de transport\n",
            "1️⃣3️⃣ 🏪 Autre activité\n\n",
            "_Tapez le numéro correspondant._"
        )
        .to_string()
    }

    pub fn onboarding_step1_message(ptype: &PartnerType) -> String {
        format!(
            "{} *Inscription partenaire — {}*\n\n\
            Super choix ! Je vais créer votre profil professionnel Yukpo.\n\n\
            📝 *Étape 1/4* — Quel est le *nom de votre {} ?*\n\n\
            Ex : _Pharmacie Centrale_, _Restaurant La Saveur_, _Hôtel Résidence_",
            ptype.emoji(),
            ptype.label(),
            ptype.label().to_lowercase()
        )
    }

    pub fn onboarding_step2_message(name: &str) -> String {
        format!(
            "✅ *{}*\n\n\
            📱 *Étape 2/4* — Votre *numéro WhatsApp professionnel* ?\n\n\
            Ce numéro sera affiché aux clients pour vous contacter.\n\n\
            Ex : _+237 6XX XXX XXX_",
            name
        )
    }

    pub fn onboarding_step3_message() -> &'static str {
        "📍 *Étape 3/4* — Votre *adresse ou ville* ?\n\nEx : _Akwa, Douala_ ou _Bastos, Yaoundé_"
    }

    pub fn onboarding_step4_message(ptype: &PartnerType) -> String {
        format!("📋 *Étape 4/4* — {}", ptype.specific_question())
    }

    pub fn onboarding_success_message(ptype: &PartnerType, name: &str, service_id: i32) -> String {
        format!(
            "🎉 *Félicitations ! Votre profil partenaire est créé !*\n\n\
            {} *{}*\n\
            🔖 ID service : {}\n\n\
            Que souhaitez-vous faire maintenant ?\n\n\
            1️⃣ ➕ Ajouter votre premier {}\n\
            2️⃣ 📊 Voir mon dashboard\n\
            3️⃣ 📣 Community Manager (publier sur les réseaux)\n\
            4️⃣ 📲 Télécharger l'app Yukpo\n\n\
            _Tapez votre choix._",
            ptype.emoji(),
            name,
            service_id,
            ptype.product_label()
        )
    }

    pub fn format_orders(orders: &[PartnerOrder]) -> String {
        if orders.is_empty() {
            return "✅ *Aucune commande en attente.*\n\nVos nouvelles commandes apparaîtront ici.\n\n📲 Activez les notifications sur l'app Yukpo !".to_string();
        }
        let mut msg = format!("📦 *{} commande(s) en cours*\n\n", orders.len());
        for (i, o) in orders.iter().enumerate() {
            let status_icon = match o.status.as_str() {
                "pending" => "🟡 En attente",
                "confirmed" => "🟢 Confirmée",
                "processing" => "🔵 En préparation",
                "ready" => "✅ Prête",
                "in_delivery" => "🛵 En livraison",
                _ => "📦 En cours",
            };
            msg.push_str(&format!(
                "{}️⃣ *{}*\n👤 {}\n🛍️ {}\n💰 {} FCFA\n📍 {}\n{}\n\n",
                i + 1,
                o.order_ref,
                o.client_name,
                o.product_name,
                o.amount,
                o.delivery_address,
                status_icon
            ));
        }
        msg.push_str("_Tapez le numéro pour gérer une commande._");
        msg
    }

    pub fn format_order_actions(order: &PartnerOrder) -> String {
        format!(
            "📦 *Commande {}*\n\n\
            👤 Client : {}\n\
            🛍️ Produit : {}\n\
            💰 Montant : {} FCFA\n\
            📍 Livraison : {}\n\n\
            Que faire avec cette commande ?\n\n\
            1️⃣ ✅ Confirmer\n\
            2️⃣ 🍳 Marquer En préparation\n\
            3️⃣ ✔️ Marquer Prête / Expédiée\n\
            4️⃣ ❌ Annuler\n\
            5️⃣ ◀️ Retour aux commandes",
            order.order_ref,
            order.client_name,
            order.product_name,
            order.amount,
            order.delivery_address
        )
    }

    pub fn format_dashboard(stats: &PartnerStats) -> String {
        format!(
            "📊 *Dashboard — {}*\n\n\
            📦 Commandes totales : *{}*\n\
            🟡 En attente : *{}*\n\
            💰 Revenus totaux : *{} FCFA*\n\
            🛍️ Produits actifs : *{}*\n\n\
            Que souhaitez-vous faire ?\n\n\
            1️⃣ 📦 Voir mes commandes\n\
            2️⃣ ➕ Ajouter un produit/offre\n\
            3️⃣ 📣 Community Manager\n\
            4️⃣ 📈 Tendances du marché\n\
            5️⃣ ↩️ Menu principal\n\n\
            _Tapez votre choix._",
            stats.service_name,
            stats.total_orders,
            stats.pending_orders,
            stats.revenue_fcfa,
            stats.total_products
        )
    }

    pub fn add_product_prompt(product_label: &str) -> String {
        format!(
            "➕ *Ajouter un {}*\n\n\
            Quel est le *nom* de ce {} ?\n\n\
            Ex : _Doliprane 500mg_, _Poulet braisé_, _Chambre climatisée_",
            product_label, product_label
        )
    }

    pub fn add_product_price_prompt(product_name: &str) -> String {
        format!(
            "💰 *Prix de {}* ?\n\n\
            Tapez le montant en FCFA.\nEx : *2500*",
            product_name
        )
    }

    pub fn product_added_message(product_name: &str, price: i64) -> String {
        format!(
            "✅ *{} ajouté avec succès !*\n\
            💰 Prix : {} FCFA\n\n\
            Ajouter un autre produit ?\n\
            1️⃣ ✅ Oui\n\
            2️⃣ 📊 Non, voir mon dashboard",
            product_name, price
        )
    }

    pub fn partner_menu(service_name: &str, partner_type: &str) -> String {
        let ptype = PartnerType::from_db(partner_type);
        format!(
            "{} *Espace Partenaire — {}*\n\n\
            1️⃣ 📦 Mes commandes\n\
            2️⃣ 📊 Mon dashboard\n\
            3️⃣ ➕ Ajouter un {}\n\
            4️⃣ 📣 Community Manager\n\
            5️⃣ 📈 Tendances du marché\n\
            6️⃣ ↩️ Menu principal\n\n\
            _Tapez votre choix._",
            ptype.emoji(),
            service_name,
            ptype.product_label()
        )
    }
}

// ─── Helper interne ───────────────────────────────────────────────────────────

fn build_description(ptype: &PartnerType, extra: &str) -> String {
    match ptype {
        PartnerType::Pharmacie => format!("Pharmacie — Horaires : {}", extra),
        PartnerType::Restaurant => format!("Restaurant — Cuisine : {} ", extra),
        PartnerType::Hotel => format!("Hôtel — Prix/nuit : {} FCFA", extra),
        PartnerType::Meuble => format!("Meublé — Tarif : {} FCFA", extra),
        PartnerType::AgenceVoyage => format!("Agence de voyage — Destinations : {}", extra),
        PartnerType::Clinique => format!("Clinique/Hôpital — Spécialités : {}", extra),
        PartnerType::Libraire => format!("Librairie — Spécialités : {}", extra),
        PartnerType::EtablissementScolaire => {
            format!("Établissement scolaire — Niveaux : {}", extra)
        }
        PartnerType::Coursier => format!("Service livraison — Zone/tarifs : {}", extra),
        PartnerType::Chauffeur => format!(
            "Chauffeur — Service : {}",
            match extra.trim() {
                "1" => "Taxi",
                "2" => "Covoiturage",
                "3" | _ => "Taxi + Covoiturage",
            }
        ),
        PartnerType::Supermarche => format!("Supermarché — Horaires : {}", extra),
        PartnerType::Transport => format!("Transport — Routes : {}", extra),
        PartnerType::Autre(_) => extra.to_string(),
    }
}

/// Détecte si un message WhatsApp contient une intention de devenir partenaire
pub fn is_partner_intent(msg: &str) -> bool {
    let t = msg.to_lowercase();
    t.contains("devenir partenaire")
        || t.contains("m'inscrire") && t.contains("partenaire")
        || t.contains("créer mon compte")
            && (t.contains("business") || t.contains("commerce") || t.contains("professionnel"))
        || t.contains("inscription partenaire")
        || t.contains("ouvrir mon compte")
        || t.contains("rejoindre yukpo")
        || t.contains("partenaire yukpo")
        || t == "partenaire"
        || t == "business"
        || t == "pro"
        || t.contains("vendre sur yukpo")
        || t.contains("créer ma boutique")
}

/// Détecte si l'utilisateur veut accéder à son espace partenaire
pub fn is_partner_dashboard_intent(msg: &str) -> bool {
    let t = msg.to_lowercase();
    t.contains("mon dashboard")
        || t.contains("mes commandes")
        || t.contains("espace partenaire")
        || t.contains("mon business")
        || t.contains("gérer mon")
        || t.contains("mes stats")
        || t == "dashboard"
        || t == "business"
        || t == "commandes"
}
