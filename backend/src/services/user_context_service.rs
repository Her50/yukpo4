// Service UserContext — Profil commercial complet d'un utilisateur
// Charge en un seul appel : services actifs, produits, stats ads, signaux chatbot
// Utilisé par TrendPulse pour personnaliser les trends et par /ai/chat pour enrichir le contexte

use chrono::{Duration, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;

// ─── Types ────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserProduct {
    pub id: i32,
    pub name: String,
    pub price: f64,
    pub sale_price: Option<f64>,
    pub category: String,
    pub in_stock: bool,
    pub is_promo: bool,
}

/// Type d'acteur Yukpo — détermine la logique de scoring et de recommandation TrendPulse
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ActorType {
    /// Supermarché: scoring prioritaire sur volume produits, promotions en masse
    Supermarche,
    /// E-commerce / magasin en ligne: scoring sur catalogue large + livraison
    Ecommerce,
    /// Restaurant: scoring sur menus, plats du jour, événements food
    Restaurant,
    /// Pharmacie: scoring sur médicaments, santé, saisonnalité des maladies
    Pharmacie,
    /// Santé (hôpital, labo, banque de sang): scoring sur services médicaux
    Sante,
    /// Transport (taxi, covoiturage, voyage): scoring sur événements, mobilité
    Transport,
    /// Prestataire standard: scoring sur expertise, service, réputation
    Prestataire,
    /// Consommateur sans service: scoring sur intérêts, localisation
    Consommateur,
}

impl ActorType {
    pub fn from_specialized(specialized_type: Option<&str>, category: Option<&str>) -> Self {
        match specialized_type {
            Some("supermarche") => ActorType::Supermarche,
            Some("ecommerce") | Some("magasin_electronique") => ActorType::Ecommerce,
            Some("restaurant") => ActorType::Restaurant,
            Some("pharmacie") => ActorType::Pharmacie,
            Some("hopital_clinique") | Some("laboratoire_imagerie") | Some("banque_sang") => {
                ActorType::Sante
            }
            Some("agence_voyage") | Some("covoiturage") | Some("taxi_ville") => {
                ActorType::Transport
            }
            _ => {
                // Fallback sur category textuelle
                let cat = category.unwrap_or("").to_lowercase();
                if cat.contains("supermarche")
                    || cat.contains("supermarché")
                    || cat.contains("épicerie")
                {
                    ActorType::Supermarche
                } else if cat.contains("restaurant")
                    || cat.contains("cuisine")
                    || cat.contains("food")
                {
                    ActorType::Restaurant
                } else if cat.contains("pharmacie") || cat.contains("parapharmacie") {
                    ActorType::Pharmacie
                } else if cat.contains("ecommerce")
                    || cat.contains("boutique")
                    || cat.contains("magasin")
                {
                    ActorType::Ecommerce
                } else {
                    ActorType::Prestataire
                }
            }
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            ActorType::Supermarche => "supermarche",
            ActorType::Ecommerce => "ecommerce",
            ActorType::Restaurant => "restaurant",
            ActorType::Pharmacie => "pharmacie",
            ActorType::Sante => "sante",
            ActorType::Transport => "transport",
            ActorType::Prestataire => "prestataire",
            ActorType::Consommateur => "consommateur",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserService {
    pub id: i32,
    pub name: String,
    pub sector: String,
    pub city: String,
    pub specialized_type: Option<String>,
    /// Type d'acteur calculé — pilote le scoring TrendPulse
    pub actor_type: ActorType,
    pub products: Vec<UserProduct>,
    pub product_count: i32,
    pub promo_count: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdSignal {
    pub campaign_id: i32,
    pub name: String,
    pub objective: String,
    pub status: String,
    pub roas: Option<f64>,
    pub impressions: i64,
    pub clicks: i64,
    pub spend_fcfa: i64,
    pub conversions: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatbotSignal {
    pub service_id: i32,
    pub questions_this_week: i64,
    pub escalations_this_week: i64,
    pub top_keywords: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserCommercialContext {
    pub user_id: i32,
    pub is_provider: bool,
    pub services: Vec<UserService>,
    /// Toutes les catégories de produits que l'utilisateur vend
    pub product_categories: Vec<String>,
    /// Toutes les villes couvertes par ses services
    pub cities: Vec<String>,
    /// Secteurs d'activité (supermarché, restaurant, pharmacie, etc.)
    pub sectors: Vec<String>,
    /// Signaux publicitaires Meta Ads actifs
    pub ad_signals: Vec<AdSignal>,
    /// Signaux conversationnels des chatbots clients
    pub chatbot_signals: Vec<ChatbotSignal>,
    /// Nombre total de produits actifs
    pub total_products: i32,
    /// Nombre de promotions actives
    pub total_promos: i32,
    /// Indique si l'utilisateur a des comptes sociaux connectés
    pub has_social_accounts: bool,
    /// Indique si l'utilisateur a des campagnes Meta Ads
    pub has_meta_ads: bool,
}

// ─── Chargement principal ─────────────────────────────────────────────────────

/// Charge le profil commercial complet de l'utilisateur depuis la DB.
/// Retourne un contexte enrichi utilisable par TrendPulse et YukpoIA.
pub async fn load_user_commercial_context(
    pg: &PgPool,
    user_id: i32,
) -> Result<UserCommercialContext, String> {
    // 1. Charger les services actifs de l'utilisateur
    // Note: is_active est une vraie colonne BOOLEAN sur services
    // name/city sont dans data JSONB (pas de colonnes dédiées dans la structure de base)
    let services_raw = sqlx::query!(
        r#"SELECT
               s.id,
               COALESCE(
                   s.data->>'titre_service',
                   s.data->>'nom',
                   s.data->>'name',
                   'Service'
               ) as "name!",
               COALESCE(
                   s.data->>'ville',
                   s.data->'ville'->>'valeur',
                   ''
               ) as "city!",
               COALESCE(s.category, s.specialized_type, 'commerce') as "sector!",
               s.specialized_type,
               s.category
           FROM services s
           WHERE s.user_id = $1
             AND s.is_active = true
           ORDER BY s.created_at DESC
           LIMIT 10"#,
        user_id
    )
    .fetch_all(pg)
    .await
    .map_err(|e| e.to_string())?;

    let is_provider = !services_raw.is_empty();

    let mut services: Vec<UserService> = Vec::new();
    let mut all_categories: Vec<String> = Vec::new();
    let mut all_cities: Vec<String> = Vec::new();
    let mut all_sectors: Vec<String> = Vec::new();

    for svc in &services_raw {
        let service_id = svc.id;

        // 2. Charger les produits de ce service
        // Utilise les colonnes GENERATED: product_name, product_price, product_type
        // Le prix promo est dans product_data->>'prix_promo'
        let products_raw = sqlx::query!(
            r#"SELECT
                   id,
                   COALESCE(product_name, 'Produit') as "name!",
                   COALESCE(product_price::float8, 0.0) as "price!: f64",
                   NULLIF(product_data->>'prix_promo', '')::float8 as sale_price,
                   COALESCE(product_type, 'general') as "category!",
                   COALESCE(is_active, true) as "in_stock!",
                   (
                       product_data->>'prix_promo' IS NOT NULL
                       OR product_data->>'en_promotion' = 'true'
                   ) as "is_promo!"
               FROM service_products
               WHERE service_id = $1
                 AND is_active = true
               ORDER BY
                   CASE WHEN product_data->>'prix_promo' IS NOT NULL THEN 0 ELSE 1 END,
                   created_at DESC
               LIMIT 30"#,
            service_id
        )
        .fetch_all(pg)
        .await
        .unwrap_or_default();

        let products: Vec<UserProduct> = products_raw
            .iter()
            .map(|p| {
                let cat = p.category.clone();
                if !all_categories.contains(&cat) {
                    all_categories.push(cat.clone());
                }
                UserProduct {
                    id: p.id,
                    name: p.name.clone(),
                    price: p.price,
                    sale_price: p.sale_price,
                    category: cat,
                    in_stock: p.in_stock,
                    is_promo: p.is_promo,
                }
            })
            .collect();

        let promo_count = products.iter().filter(|p| p.is_promo).count() as i32;
        let product_count = products.len() as i32;

        let city = svc.city.clone();
        let sector = svc.sector.clone();
        let name = svc.name.clone();
        let actor_type =
            ActorType::from_specialized(svc.specialized_type.as_deref(), svc.category.as_deref());

        if !city.is_empty() && !all_cities.contains(&city) {
            all_cities.push(city.clone());
        }
        if !sector.is_empty() && !all_sectors.contains(&sector) {
            all_sectors.push(sector.clone());
        }

        services.push(UserService {
            id: service_id,
            name,
            sector,
            city,
            specialized_type: svc.specialized_type.clone(),
            actor_type,
            products,
            product_count,
            promo_count,
        });
    }

    // 3. Signaux publicitaires Meta Ads actifs
    // meta_ad_campaigns: id, name, objective, status, roas, impressions, clicks, spent_fcfa, conversions
    let ad_signals: Vec<AdSignal> = if is_provider {
        sqlx::query!(
            r#"SELECT
                   id,
                   name,
                   objective,
                   status,
                   roas,
                   impressions,
                   clicks,
                   spent_fcfa,
                   conversions
               FROM meta_ad_campaigns
               WHERE user_id = $1
                 AND status = 'active'
               ORDER BY updated_at DESC
               LIMIT 5"#,
            user_id
        )
        .fetch_all(pg)
        .await
        .unwrap_or_default()
        .into_iter()
        .map(|r| AdSignal {
            campaign_id: r.id,
            name: r.name,
            objective: r.objective,
            status: r.status,
            roas: r.roas.map(|v| {
                // roas est NUMERIC(6,2) — convertir via string pour éviter BigDecimal
                v.to_string().parse::<f64>().unwrap_or(0.0)
            }),
            impressions: r.impressions,
            clicks: r.clicks,
            spend_fcfa: r.spent_fcfa,
            conversions: r.conversions,
        })
        .collect()
    } else {
        vec![]
    };

    // 4. Signaux chatbot — questions clients cette semaine
    let week_ago = Utc::now() - Duration::days(7);
    let chatbot_signals: Vec<ChatbotSignal> = if is_provider {
        let service_ids: Vec<i32> = services.iter().map(|s| s.id).collect();
        let mut signals = Vec::new();

        for sid in &service_ids {
            let count = sqlx::query_scalar!(
                r#"SELECT COUNT(*) FROM social_chatbot_messages m
                   JOIN social_chatbot_threads t ON t.id = m.thread_id
                   WHERE t.service_id = $1
                     AND t.user_id = $2
                     AND m.direction = 'inbound'
                     AND m.created_at >= $3"#,
                sid,
                user_id,
                week_ago
            )
            .fetch_one(pg)
            .await
            .unwrap_or(Some(0))
            .unwrap_or(0);

            let escalations = sqlx::query_scalar!(
                r#"SELECT COUNT(*) FROM social_escalation_events
                   WHERE user_id = $1
                     AND created_at >= $2"#,
                user_id,
                week_ago
            )
            .fetch_one(pg)
            .await
            .unwrap_or(Some(0))
            .unwrap_or(0);

            // Top mots-clés extraits des 50 derniers messages entrants
            let recent_msgs = sqlx::query_scalar!(
                r#"SELECT m.content FROM social_chatbot_messages m
                   JOIN social_chatbot_threads t ON t.id = m.thread_id
                   WHERE t.service_id = $1
                     AND m.direction = 'inbound'
                     AND m.created_at >= $2
                   ORDER BY m.created_at DESC
                   LIMIT 50"#,
                sid,
                week_ago
            )
            .fetch_all(pg)
            .await
            .unwrap_or_default();

            let top_keywords = extract_top_keywords(&recent_msgs);

            signals.push(ChatbotSignal {
                service_id: *sid,
                questions_this_week: count,
                escalations_this_week: escalations,
                top_keywords,
            });
        }
        signals
    } else {
        vec![]
    };

    // 5. Comptes sociaux connectés
    let has_social_accounts = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM social_accounts WHERE user_id = $1",
        user_id
    )
    .fetch_one(pg)
    .await
    .unwrap_or(Some(0))
    .unwrap_or(0)
        > 0;

    let has_meta_ads = !ad_signals.is_empty();
    let total_products = services.iter().map(|s| s.product_count).sum();
    let total_promos = services.iter().map(|s| s.promo_count).sum();

    Ok(UserCommercialContext {
        user_id,
        is_provider,
        services,
        product_categories: all_categories,
        cities: all_cities,
        sectors: all_sectors,
        ad_signals,
        chatbot_signals,
        total_products,
        total_promos,
        has_social_accounts,
        has_meta_ads,
    })
}

// ─── Utilitaires ──────────────────────────────────────────────────────────────

/// Extrait les mots-clés les plus fréquents des messages clients
fn extract_top_keywords(messages: &[Option<String>]) -> Vec<String> {
    const STOP_WORDS: &[&str] = &[
        "le", "la", "les", "de", "du", "des", "un", "une", "et", "en", "est", "je", "tu", "il",
        "nous", "vous", "ils", "que", "qui", "à", "au", "bonjour", "bonsoir", "merci", "svp",
        "stp", "oui", "non", "avec", "pour", "par", "sur", "dans", "mais", "donc", "puis", "aussi",
    ];

    let mut freq: std::collections::HashMap<String, u32> = std::collections::HashMap::new();

    for msg in messages.iter().flatten() {
        for word in msg.to_lowercase().split_whitespace() {
            let w = word.trim_matches(|c: char| !c.is_alphabetic());
            if w.len() >= 4 && !STOP_WORDS.contains(&w) {
                *freq.entry(w.to_string()).or_insert(0) += 1;
            }
        }
    }

    let mut sorted: Vec<(String, u32)> = freq.into_iter().collect();
    sorted.sort_by(|a, b| b.1.cmp(&a.1));
    sorted.into_iter().take(10).map(|(k, _)| k).collect()
}
