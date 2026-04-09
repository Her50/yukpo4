// ✅ WhatsApp Community Manager Service — Gestion réseaux sociaux + Trends
// Miroir de : OnboardingWizardScreen + TrendPulseDashboardScreen
// Permet aux partenaires de publier, planifier, voir les tendances via WhatsApp

use crate::services::whatsapp_session_service::WATrend;
use sqlx::{PgPool, Row};
use std::sync::Arc;

pub struct WhatsAppCMService {
    pool: Arc<PgPool>,
}

impl WhatsAppCMService {
    pub fn new(pool: Arc<PgPool>) -> Self {
        Self { pool }
    }

    // ── Tendances marché (depuis trend_snapshots en DB) ───────────────────────

    pub async fn get_trends_for_category(&self, category: &str, city: &str) -> Vec<WATrend> {
        // Correspondance catégorie → keywords trends
        let keywords = category_to_keywords(category);
        let region = city_to_region(city);

        // 1) Chercher dans trend_snapshots si disponible
        let rows = sqlx::query(
            r#"
            SELECT topic, social_score, momentum_pct, category
            FROM trend_snapshots
            WHERE region ILIKE $1
              AND (category ILIKE $2 OR topic ILIKE $3)
              AND created_at > NOW() - INTERVAL '48 hours'
            ORDER BY social_score DESC
            LIMIT 8
            "#,
        )
        .bind(&region)
        .bind(format!("%{}%", category))
        .bind(format!("%{}%", &keywords[0]))
        .fetch_all(&*self.pool)
        .await
        .unwrap_or_default();

        if !rows.is_empty() {
            return rows
                .iter()
                .map(|r| WATrend {
                    topic: r.try_get("topic").unwrap_or_default(),
                    score: r.try_get::<i32, _>("social_score").unwrap_or(50),
                    momentum: format_momentum(r.try_get::<f64, _>("momentum_pct").unwrap_or(0.0)),
                    category: r.try_get("category").unwrap_or_else(|_| category.to_string()),
                })
                .collect();
        }

        // 2) Fallback : tendances internes depuis les commandes/vues récentes
        let internal_rows = sqlx::query(
            r#"
            SELECT
                COALESCE(p.nom, p.nom_produit, 'Produit populaire') as topic,
                COALESCE(p.vues::int, 50) as social_score,
                COALESCE(p.categorie, $1) as category
            FROM products p
            WHERE LOWER(p.categorie) ILIKE $2
              AND p.actif = true
              AND p.created_at > NOW() - INTERVAL '7 days'
            ORDER BY p.vues DESC NULLS LAST
            LIMIT 5
            "#,
        )
        .bind(category)
        .bind(format!("%{}%", category))
        .fetch_all(&*self.pool)
        .await
        .unwrap_or_default();

        if !internal_rows.is_empty() {
            return internal_rows
                .iter()
                .map(|r| WATrend {
                    topic: r.try_get("topic").unwrap_or_default(),
                    score: r.try_get("social_score").unwrap_or(50),
                    momentum: "📈 En hausse".into(),
                    category: r.try_get("category").unwrap_or_else(|_| category.to_string()),
                })
                .collect();
        }

        // 3) Fallback générique selon la catégorie
        default_trends_for_category(category)
    }

    // ── Génération de contenu IA pour post ────────────────────────────────────

    pub async fn generate_post_content(&self, service_id: i32, topic: &str) -> String {
        // Récupérer les infos du service
        let service = sqlx::query(
            "SELECT titre_service, description, category, adresse FROM services WHERE id = $1",
        )
        .bind(service_id)
        .fetch_optional(&*self.pool)
        .await
        .ok()
        .flatten();

        let (name, desc, addr) = if let Some(r) = service {
            (
                r.try_get::<String, _>("titre_service")
                    .unwrap_or_else(|_| "Notre service".into()),
                r.try_get::<String, _>("description").unwrap_or_default(),
                r.try_get::<String, _>("adresse").unwrap_or_default(),
            )
        } else {
            ("Notre service".into(), String::new(), String::new())
        };

        // Appel à l'API IA si disponible (ANTHROPIC_API_KEY)
        if let Some(post) = self.call_ai_for_post(&name, &desc, topic, &addr).await {
            return post;
        }

        // Fallback : templates par catégorie/topic
        generate_post_template(&name, topic, &addr)
    }

    async fn call_ai_for_post(
        &self,
        name: &str,
        desc: &str,
        topic: &str,
        addr: &str,
    ) -> Option<String> {
        let api_key = std::env::var("ANTHROPIC_API_KEY").ok()?;
        let client = reqwest::Client::new();

        let prompt = format!(
            "Tu es un community manager expert pour des entreprises africaines. \
            Génère un post court et engageant pour les réseaux sociaux (Facebook, WhatsApp).\n\
            Entreprise: {}\nActivité: {}\nLocalisation: {}\nSujet du post: {}\n\
            Le post doit: être en français, faire max 150 mots, inclure 2-3 emojis pertinents, \
            un appel à l'action clair, et des hashtags locaux.\
            Réponds UNIQUEMENT avec le texte du post, sans introduction.",
            name, desc, addr, topic
        );

        let body = serde_json::json!({
            "model": "claude-haiku-4-5-20251001",
            "max_tokens": 300,
            "messages": [{"role": "user", "content": prompt}]
        });

        let resp = client
            .post("https://api.anthropic.com/v1/messages")
            .header("x-api-key", &api_key)
            .header("anthropic-version", "2023-06-01")
            .json(&body)
            .send()
            .await
            .ok()?;

        let json: serde_json::Value = resp.json().await.ok()?;
        json["content"][0]["text"].as_str().map(|s| s.to_string())
    }

    // ── Publication programmée ────────────────────────────────────────────────

    pub async fn schedule_post(
        &self,
        service_id: i32,
        user_id: i32,
        content: &str,
        platform: &str,
    ) -> Option<String> {
        let ref_code = format!("POST-{}", chrono::Utc::now().timestamp() % 1_000_000);

        let _ = sqlx::query(
            r#"
            INSERT INTO social_publication_jobs
                (service_id, user_id, content, platform, status, scheduled_at, created_at)
            VALUES ($1, $2, $3, $4, 'pending', NOW() + INTERVAL '5 minutes', NOW())
            "#,
        )
        .bind(service_id)
        .bind(user_id)
        .bind(content)
        .bind(platform)
        .execute(&*self.pool)
        .await;

        Some(ref_code)
    }

    // ── Analytics simplifiés ──────────────────────────────────────────────────

    pub async fn get_social_summary(&self, service_id: i32) -> SocialSummary {
        let row = sqlx::query(
            r#"
            SELECT
                COUNT(*) as total_posts,
                COUNT(*) FILTER (WHERE status = 'published') as published,
                COUNT(*) FILTER (WHERE status = 'pending') as scheduled
            FROM social_publication_jobs
            WHERE service_id = $1
            "#,
        )
        .bind(service_id)
        .fetch_optional(&*self.pool)
        .await
        .ok()
        .flatten();

        if let Some(r) = row {
            SocialSummary {
                total_posts: r.try_get::<i64, _>("total_posts").unwrap_or(0),
                published: r.try_get::<i64, _>("published").unwrap_or(0),
                scheduled: r.try_get::<i64, _>("scheduled").unwrap_or(0),
            }
        } else {
            SocialSummary {
                total_posts: 0,
                published: 0,
                scheduled: 0,
            }
        }
    }

    // ── Formatage des messages WhatsApp ───────────────────────────────────────

    pub fn cm_menu_message(service_name: &str) -> String {
        format!(
            "📣 *Community Manager — {}*\n\n\
            Gérez votre présence sur les réseaux sociaux directement depuis WhatsApp !\n\n\
            1️⃣ ✍️ Créer un nouveau post\n\
            2️⃣ 📈 Voir les tendances de mon secteur\n\
            3️⃣ 📊 Mes statistiques réseaux\n\
            4️⃣ ◀️ Retour au dashboard\n\n\
            _Tapez votre choix._",
            service_name
        )
    }

    pub fn ask_post_topic(category: &str) -> String {
        let suggestions = topic_suggestions_for(category);
        format!(
            "✍️ *Créer un post*\n\n\
            Sur quel sujet souhaitez-vous communiquer ?\n\n\
            💡 *Idées de posts pour votre activité :*\n{}\n\n\
            Tapez votre sujet ou choisissez une idée ci-dessus.",
            suggestions
        )
    }

    pub fn format_trends(trends: &[WATrend], category: &str) -> String {
        if trends.is_empty() {
            return format!(
                "📈 *Tendances — {}*\n\n\
                😔 Pas encore de données de tendances pour votre zone.\n\n\
                💡 Revenez demain pour voir les tendances locales !\n\n\
                📲 Données complètes disponibles sur l'app *Yukpo*.",
                category
            );
        }

        let mut msg = format!("📈 *Tendances — {}*\n\n", category);
        for (i, t) in trends.iter().enumerate() {
            let bar = score_bar(t.score);
            msg.push_str(&format!(
                "{}️⃣ *{}*\n   {} Score: {}/100 {}\n\n",
                i + 1,
                t.topic,
                bar,
                t.score,
                t.momentum
            ));
        }
        msg.push_str(
            "💡 *Conseil :* Créez du contenu sur ces sujets pour booster votre visibilité !\n\n\
            1️⃣ ✍️ Créer un post sur ce sujet\n\
            2️⃣ ◀️ Retour au CM\n\n\
            _Tapez votre choix._",
        );
        msg
    }

    pub fn format_generated_post(content: &str) -> String {
        format!(
            "✅ *Post généré par YukpoIA !*\n\n\
            ─────────────────\n\
            {}\n\
            ─────────────────\n\n\
            Que souhaitez-vous faire ?\n\n\
            1️⃣ 📤 Publier maintenant (WhatsApp Business)\n\
            2️⃣ ✏️ Modifier le contenu\n\
            3️⃣ 🕐 Programmer pour plus tard\n\
            4️⃣ ❌ Annuler\n\n\
            _Tapez votre choix._",
            content
        )
    }

    pub fn post_published_message(platform: &str, reference: &str) -> String {
        format!(
            "✅ *Post programmé avec succès !*\n\n\
            📱 Plateforme : *{}*\n\
            🔖 Référence : *{}*\n\n\
            Votre post sera publié dans les prochaines minutes.\n\n\
            📲 Gérez tous vos posts sur l'app *Yukpo* → Community Manager !",
            platform, reference
        )
    }

    pub fn format_social_analytics(summary: &SocialSummary, service_name: &str) -> String {
        format!(
            "📊 *Analytics — {}*\n\n\
            📝 Posts créés : *{}*\n\
            ✅ Publiés : *{}*\n\
            🕐 Programmés : *{}*\n\n\
            💡 Publiez régulièrement pour augmenter votre visibilité !\n\
            Recommandé : *3-5 posts par semaine*\n\n\
            📲 Analytics détaillés sur l'app *Yukpo*.",
            service_name, summary.total_posts, summary.published, summary.scheduled
        )
    }
}

pub struct SocialSummary {
    pub total_posts: i64,
    pub published: i64,
    pub scheduled: i64,
}

// ─── Helpers internes ─────────────────────────────────────────────────────────

fn category_to_keywords(category: &str) -> Vec<String> {
    match category.to_lowercase().as_str() {
        "pharmacie" => vec!["santé".into(), "médicament".into(), "bien-être".into()],
        "restaurant" => vec!["food".into(), "cuisine".into(), "gastronomie".into()],
        "hotel" | "meuble" => vec!["voyage".into(), "hébergement".into(), "tourisme".into()],
        "agence de voyage" | "transport" => {
            vec!["voyage".into(), "transport".into(), "déplacement".into()]
        }
        "librairie" | "etablissementscolaire" => {
            vec!["éducation".into(), "livre".into(), "scolaire".into()]
        }
        "clinique" | "hopital" => vec!["santé".into(), "médecine".into(), "soins".into()],
        _ => vec!["commerce".into(), "service".into(), "Cameroun".into()],
    }
}

fn city_to_region(city: &str) -> String {
    let c = city.to_lowercase();
    if c.contains("douala") {
        "CM-LT".into()
    } else if c.contains("yaoundé") || c.contains("yaounde") {
        "CM-CE".into()
    } else if c.contains("bafoussam") {
        "CM-OU".into()
    } else if c.contains("kribi") || c.contains("ebolowa") {
        "CM-SU".into()
    } else {
        "CM".into()
    }
}

fn format_momentum(pct: f64) -> String {
    if pct > 20.0 {
        "🚀 En forte hausse".into()
    } else if pct > 5.0 {
        "📈 En hausse".into()
    } else if pct < -10.0 {
        "📉 En baisse".into()
    } else {
        "➡️ Stable".into()
    }
}

fn score_bar(score: i32) -> &'static str {
    match score {
        90..=100 => "🔥🔥🔥",
        70..=89 => "🔥🔥",
        50..=69 => "🔥",
        30..=49 => "📊",
        _ => "📉",
    }
}

fn default_trends_for_category(category: &str) -> Vec<WATrend> {
    let trends = match category.to_lowercase().as_str() {
        "pharmacie" => vec![
            ("Paracétamol et ibuprofène", 85, "📈 En hausse"),
            ("Vitamine C et immunité", 78, "🚀 En forte hausse"),
            ("Produits anti-paludéens", 72, "📈 En hausse"),
        ],
        "restaurant" => vec![
            (
                "Cuisine camerounaise traditionnelle",
                90,
                "🚀 En forte hausse",
            ),
            ("Livraison de repas à domicile", 82, "📈 En hausse"),
            ("Petit-déjeuner et brunch", 65, "➡️ Stable"),
        ],
        "hotel" | "meuble" => vec![
            ("Voyages domestiques week-end", 75, "📈 En hausse"),
            ("Séjours d'affaires Douala", 68, "➡️ Stable"),
            ("Appartements meublés Yaoundé", 80, "🚀 En forte hausse"),
        ],
        "librairie" | "etablissementscolaire" => vec![
            ("Manuels scolaires rentrée", 95, "🚀 En forte hausse"),
            ("Livres parascolaires Terminale", 88, "📈 En hausse"),
            ("Troc et vente livres d'occasion", 72, "📈 En hausse"),
        ],
        "clinique" | "hopital" => vec![
            ("Consultations gynécologie", 70, "📈 En hausse"),
            ("Soins dentaires", 65, "➡️ Stable"),
            ("Tests rapides paludisme", 80, "🚀 En forte hausse"),
        ],
        _ => vec![
            ("Promotions et offres spéciales", 80, "📈 En hausse"),
            ("Livraison à domicile", 85, "🚀 En forte hausse"),
            ("Paiement mobile MTN/Orange", 75, "📈 En hausse"),
        ],
    };

    trends
        .into_iter()
        .map(|(topic, score, momentum)| WATrend {
            topic: topic.to_string(),
            score,
            momentum: momentum.to_string(),
            category: category.to_string(),
        })
        .collect()
}

fn topic_suggestions_for(category: &str) -> String {
    match category.to_lowercase().as_str() {
        "pharmacie" => "• _Promotion médicament du mois_\n• _Conseil santé de la semaine_\n• _Arrivage de nouveaux produits_",
        "restaurant" => "• _Plat du jour spécial_\n• _Offre de livraison gratuite_\n• _Nouveau menu découverte_",
        "hotel" | "meuble" => "• _Offre week-end spéciale_\n• _Nouveauté dans vos chambres_\n• _Promotion séjour longue durée_",
        "librairie" | "etablissementscolaire" => "• _Arrivage manuels scolaires_\n• _Promotion rentrée scolaire_\n• _Programme livres d'occasion disponibles_",
        "clinique" => "• _Journée de dépistage gratuit_\n• _Nouveau médecin spécialiste_\n• _Promotion consultation_",
        _ => "• _Promotion de la semaine_\n• _Nouveau produit/service disponible_\n• _Témoignage client satisfait_",
    }.to_string()
}

fn generate_post_template(name: &str, topic: &str, addr: &str) -> String {
    format!(
        "🌟 *{}* — {}\n\n\
        📍 Retrouvez-nous à : {}\n\
        💬 Contactez-nous sur WhatsApp pour plus d'infos !\n\n\
        #Yukpo #Cameroun #{}\n\n\
        📲 Disponible sur l'app *Yukpo* — Téléchargez maintenant !",
        name,
        topic,
        addr,
        name.replace(" ", "").replace("'", "")
    )
}

/// Détecte une intention Community Manager dans un message
pub fn is_cm_intent(msg: &str) -> bool {
    let t = msg.to_lowercase();
    t.contains("publier")
        || t.contains("post")
        || t.contains("réseaux sociaux")
        || t.contains("community manager")
        || t.contains("cm yukpo")
        || t.contains("tendance")
        || t.contains("trend")
        || t == "cm"
        || t == "social"
}
