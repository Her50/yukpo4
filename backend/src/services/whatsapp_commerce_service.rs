// ✅ WhatsApp Commerce Service — Commandes, livraison, paiement MTN/Orange
// Couvre : pharmacie, marketplace, bus, supermarché

use crate::services::whatsapp_session_service::{BusResult, PharmacyResult};
use sqlx::{PgPool, Row};
use std::sync::Arc;

pub struct WhatsAppCommerceService {
    pool: Arc<PgPool>,
}

// ─── Packs tokens (miroir de RechargeTokensScreen) ───────────────────────────

pub struct TokenPack {
    pub id: &'static str,
    pub tokens: i32,
    pub amount_fcfa: i32,
    pub bonus: i32,
    pub label: &'static str,
}

pub const TOKEN_PACKS: &[TokenPack] = &[
    TokenPack {
        id: "pack_500",
        tokens: 500,
        amount_fcfa: 1000,
        bonus: 0,
        label: "1 000 FCFA — Starter",
    },
    TokenPack {
        id: "pack_1000",
        tokens: 1000,
        amount_fcfa: 1800,
        bonus: 50,
        label: "1 800 FCFA ⭐ Populaire",
    },
    TokenPack {
        id: "pack_2000",
        tokens: 2000,
        amount_fcfa: 3000,
        bonus: 200,
        label: "3 000 FCFA — Standard",
    },
    TokenPack {
        id: "pack_5000",
        tokens: 5000,
        amount_fcfa: 6500,
        bonus: 500,
        label: "6 500 FCFA — Premium",
    },
];

pub fn token_pack_menu(action_context: &str) -> String {
    format!(
        "⚠️ *Solde insuffisant*\n\n\
        Pour *{}* vous avez besoin de tokens supplémentaires.\n\n\
        💎 *Recharger vos tokens :*\n\n\
        1️⃣ {}\n\
        2️⃣ {}\n\
        3️⃣ {}\n\
        4️⃣ {}\n\n\
        _Tapez le numéro du pack souhaité._",
        action_context,
        TOKEN_PACKS[0].label,
        TOKEN_PACKS[1].label,
        TOKEN_PACKS[2].label,
        TOKEN_PACKS[3].label,
    )
}

pub fn payment_method_menu(pack: &TokenPack) -> String {
    format!(
        "💳 *Recharge {} FCFA*\n\n\
        Choisissez votre mode de paiement :\n\n\
        1. 📱 MTN Mobile Money\n\
        2. 🟠 Orange Money\n\n\
        _Tapez 1 ou 2._",
        pack.amount_fcfa
    )
}

pub fn payment_instructions(pack: &TokenPack, method: &str, reference: &str) -> String {
    match method {
        "mtn" => format!(
            "📱 *Paiement MTN Mobile Money*\n\n\
            💰 Montant : *{} FCFA*\n\
            🔖 Référence : *{}*\n\n\
            📲 Composez : *#126#*\n\
            → Transfert → Paiement marchand\n\
            → Entrez la référence : *{}*\n\n\
            ✅ Tapez *CONFIRMER* une fois le paiement effectué.",
            pack.amount_fcfa, reference, reference
        ),
        "orange" => format!(
            "🟠 *Paiement Orange Money*\n\n\
            💰 Montant : *{} FCFA*\n\
            🔖 Référence : *{}*\n\n\
            📲 Composez : *#150#*\n\
            → Paiement → Entrez la référence : *{}*\n\n\
            ✅ Tapez *CONFIRMER* une fois le paiement effectué.",
            pack.amount_fcfa, reference, reference
        ),
        _ => "Mode de paiement non reconnu.".to_string(),
    }
}

pub fn parse_pack_choice(choice: &str) -> Option<&'static TokenPack> {
    let n: usize = choice.trim().parse().ok()?;
    TOKEN_PACKS.get(n.wrapping_sub(1))
}

pub fn generate_payment_reference() -> String {
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    format!(
        "YKP-{}",
        &ts.to_string()[ts.to_string().len().saturating_sub(6)..]
    )
}

// ─── Service Commerce ─────────────────────────────────────────────────────────

impl WhatsAppCommerceService {
    pub fn new(pool: Arc<PgPool>) -> Self {
        Self { pool }
    }

    // ── Recherche pharmacies ──────────────────────────────────────────────────

    pub async fn search_pharmacies(&self, medicament: &str) -> Vec<PharmacyResult> {
        let search = format!("%{}%", medicament.trim().to_lowercase());

        let rows = sqlx::query(
            r#"
            SELECT
                s.id as pharmacy_id,
                COALESCE(s.data->>'nom_structure', s.data->>'titre_service', 'Pharmacie') as pharmacy_name,
                COALESCE(s.data->>'adresse', '') as address,
                COALESCE(s.data->>'telephone', s.data->>'whatsapp', '') as phone,
                pp.nom_produit as product_name,
                COALESCE(pp.prix::bigint, 0) as price_fcfa,
                COALESCE(pp.stock, 0) as stock
            FROM pharmacy_products pp
            JOIN services s ON s.id = pp.pharmacy_service_id
            WHERE pp.disponible = true AND pp.stock > 0
              AND LOWER(pp.nom_produit) LIKE $1
            ORDER BY pp.stock DESC
            LIMIT 5
            "#,
        )
        .bind(&search)
        .fetch_all(&*self.pool)
        .await
        .unwrap_or_default();

        rows.iter()
            .map(|r| PharmacyResult {
                pharmacy_id: r.try_get("pharmacy_id").unwrap_or(0),
                pharmacy_name: r.try_get("pharmacy_name").unwrap_or_default(),
                address: r.try_get("address").unwrap_or_default(),
                phone: r.try_get("phone").unwrap_or_default(),
                product_name: r.try_get("product_name").unwrap_or_default(),
                price_fcfa: r.try_get("price_fcfa").unwrap_or(0),
                stock: r.try_get("stock").unwrap_or(0),
            })
            .collect()
    }

    pub fn format_pharmacy_results(results: &[PharmacyResult], medicament: &str) -> String {
        if results.is_empty() {
            return format!(
                "😔 Aucune pharmacie n'a *{}* en stock.\n\n💡 Essayez un nom générique.\nTapez *AIDE* pour le menu.",
                medicament
            );
        }
        let mut msg = format!(
            "💊 *{}* disponible dans {} pharmacie(s) :\n\n",
            medicament,
            results.len()
        );
        for (i, r) in results.iter().enumerate() {
            msg.push_str(&format!(
                "{}️⃣ *{}*\n📍 {}\n📞 {}\n💰 {} FCFA | Stock: {}\n\n",
                i + 1,
                r.pharmacy_name,
                r.address,
                r.phone,
                r.price_fcfa,
                r.stock
            ));
        }
        msg.push_str("_Tapez le numéro pour commander avec livraison,\nou *0* pour annuler._");
        msg
    }

    // ── Commande livraison ────────────────────────────────────────────────────

    pub async fn create_delivery_order(
        &self,
        user_id: i32,
        pharmacy_id: i32,
        product_name: &str,
        price_fcfa: i64,
        delivery_address: &str,
    ) -> Option<String> {
        let order_ref = format!("CMD-{}", generate_payment_reference());

        let result = sqlx::query(
            r#"
            INSERT INTO orders
                (user_id, service_id, product_name, amount, delivery_address,
                 status, order_ref, created_at)
            VALUES ($1, $2, $3, $4, $5, 'pending', $6, NOW())
            RETURNING id
            "#,
        )
        .bind(user_id)
        .bind(pharmacy_id)
        .bind(product_name)
        .bind(price_fcfa as i32)
        .bind(delivery_address)
        .bind(&order_ref)
        .fetch_optional(&*self.pool)
        .await
        .ok()
        .flatten();

        result.map(|_| order_ref)
    }

    pub fn delivery_confirmation_message(
        product: &str,
        price: i64,
        address: &str,
        delivery_fee: i64,
    ) -> String {
        format!(
            "📦 *Confirmation de commande*\n\n\
            🛍️ Produit : *{}*\n\
            💰 Prix produit : {} FCFA\n\
            🚴 Frais livraison : {} FCFA\n\
            📍 Livraison à : {}\n\
            ─────────────────\n\
            💵 *Total : {} FCFA*\n\n\
            Paiement à la livraison (MTN/Orange/Espèces)\n\n\
            [CONFIRMER] ou [ANNULER]",
            product,
            price,
            delivery_fee,
            address,
            price + delivery_fee
        )
    }

    // ── Recherche bus ─────────────────────────────────────────────────────────

    pub async fn search_bus(&self, depart: &str, arrivee: Option<&str>) -> Vec<BusResult> {
        let search = format!("%{}%", depart.to_lowercase());

        let rows = sqlx::query(
            r#"
            SELECT
                p.id::text as trip_id,
                p.nom as trip_name,
                COALESCE(u.nom, 'Agence') as agency,
                COALESCE(p.prix::bigint, 0) as price_fcfa,
                COALESCE(p.date_debut::text, 'À confirmer') as departure
            FROM products p
            LEFT JOIN users u ON u.id = p.user_id
            WHERE p.categorie = 'transport_bus' AND p.actif = true
              AND (LOWER(p.nom) LIKE $1 OR LOWER(p.description) LIKE $1)
            ORDER BY p.prix ASC
            LIMIT 5
            "#,
        )
        .bind(&search)
        .fetch_all(&*self.pool)
        .await
        .unwrap_or_default();

        let arrivee_filter = arrivee.map(|a| a.to_lowercase());
        rows.iter()
            .filter(|r| {
                let trip_name: String = r.try_get("trip_name").unwrap_or_default();
                arrivee_filter
                    .as_ref()
                    .map(|a| trip_name.to_lowercase().contains(a.as_str()))
                    .unwrap_or(true)
            })
            .map(|r| BusResult {
                trip_id: r.try_get("trip_id").unwrap_or_default(),
                trip_name: r.try_get("trip_name").unwrap_or_default(),
                agency: r.try_get("agency").unwrap_or_else(|_| "Agence".to_string()),
                price_fcfa: r.try_get("price_fcfa").unwrap_or(0),
                departure: r.try_get("departure").unwrap_or_else(|_| "À confirmer".to_string()),
            })
            .collect()
    }

    pub fn format_bus_results(
        results: &[BusResult],
        depart: &str,
        arrivee: Option<&str>,
    ) -> String {
        if results.is_empty() {
            return format!(
                "😔 Aucun trajet depuis *{}*{}.\n\nExemples :\n• _bus Douala vers Yaoundé_\n• _ticket Bafoussam_",
                depart,
                arrivee.map(|a| format!(" vers {}", a)).unwrap_or_default()
            );
        }
        let dest = arrivee.map(|a| format!(" → *{}*", a)).unwrap_or_default();
        let mut msg = format!("🚌 *Trajets depuis {}*{}:\n\n", depart, dest);
        for (i, r) in results.iter().enumerate() {
            msg.push_str(&format!(
                "{}️⃣ *{}*\n🏢 {} | 🗓️ {}\n💰 {} FCFA\n\n",
                i + 1,
                r.trip_name,
                r.agency,
                r.departure,
                r.price_fcfa
            ));
        }
        msg.push_str("_Tapez le numéro pour réserver votre place._");
        msg
    }

    pub fn bus_seat_confirmation(trip: &BusResult) -> String {
        format!(
            "🎫 *Réservation de place*\n\n\
            🚌 *{}*\n\
            🏢 Agence : {}\n\
            🗓️ Départ : {}\n\
            💰 Prix : {} FCFA\n\n\
            Tapez *CONFIRMER* pour réserver\nou *ANNULER* pour revenir.",
            trip.trip_name, trip.agency, trip.departure, trip.price_fcfa
        )
    }
}
