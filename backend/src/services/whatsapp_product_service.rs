// ✅ WhatsApp Product Service — Création de produit via image (IA)
// Miroir de AjouterProduitSimpleScreen : photo → IA → publication

use crate::services::app_ia::AppIA;
use sqlx::{PgPool, Row};
use std::sync::Arc;

pub struct WhatsAppProductService {
    pool: Arc<PgPool>,
    app_ia: Arc<AppIA>,
}

#[derive(Debug, Clone)]
pub struct DetectedProduct {
    pub image_url: String,
    pub name: String,
    pub category: String,
    pub price_suggestion: i64,
    pub description: String,
}

impl WhatsAppProductService {
    pub fn new(pool: Arc<PgPool>, app_ia: Arc<AppIA>) -> Self {
        Self { pool, app_ia }
    }

    /// Analyse une image et détecte le produit via Google Vision + heuristiques
    pub async fn analyze_product_image(&self, image_url: &str) -> DetectedProduct {
        log::info!("[ProductService] 🛍️ Analyse image produit: {}", image_url);

        // Tentative d'analyse via Google Vision
        if let Some(detected) = self.call_vision_for_product(image_url).await {
            return detected;
        }

        // Fallback : produit générique à confirmer par l'utilisateur
        DetectedProduct {
            image_url: image_url.to_string(),
            name: "Produit à nommer".to_string(),
            category: "Divers".to_string(),
            price_suggestion: 5000,
            description: "Décrivez votre produit pour attirer plus d'acheteurs.".to_string(),
        }
    }

    /// Analyse via AppIA.predict_multimodal() — même moteur que l'app mobile
    /// Télécharge l'image Twilio, encode en base64, utilise le modèle multimodal configuré
    async fn call_vision_for_product(&self, image_url: &str) -> Option<DetectedProduct> {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .ok()?;

        // Télécharger l'image depuis Twilio
        let twilio_sid = std::env::var("TWILIO_ACCOUNT_SID").unwrap_or_default();
        let twilio_token = std::env::var("TWILIO_AUTH_TOKEN").unwrap_or_default();
        let req = if !twilio_sid.is_empty() {
            client.get(image_url).basic_auth(&twilio_sid, Some(&twilio_token))
        } else {
            client.get(image_url)
        };

        let bytes = req.send().await.ok()?.bytes().await.ok()?;
        if bytes.is_empty() {
            return None;
        }

        use base64::{engine::general_purpose::STANDARD, Engine as _};
        let image_b64 = STANDARD.encode(&bytes);
        let data_uri = format!("data:image/jpeg;base64,{}", image_b64);

        // Appel direct à AppIA.predict_multimodal() — même moteur que les controllers
        let prompt = "Tu es un expert en commerce africain (Cameroun). \
            Analyse cette image de produit et réponds en JSON uniquement : \
            {\"nom\": \"...\", \"categorie\": \"...\", \"prix_fcfa\": 0, \"description\": \"...\"} \
            - categorie: electronique/vetement/alimentaire/mobilier/automobile/livre/autre \
            - prix_fcfa: estimation réaliste en FCFA pour le marché camerounais \
            - description: 1 phrase max, attrayante pour un acheteur";

        let (_, response, _) =
            self.app_ia.predict_multimodal(prompt, Some(vec![data_uri])).await.ok()?;

        // Parser la réponse JSON
        let clean = response
            .trim()
            .trim_start_matches("```json")
            .trim_start_matches("```")
            .trim_end_matches("```")
            .trim();

        let p: serde_json::Value = serde_json::from_str(clean).ok()?;
        let name = p["nom"].as_str().unwrap_or("Produit");
        let (_, fallback_cat, fallback_price) = classify_product(&[], name);

        Some(DetectedProduct {
            image_url: image_url.to_string(),
            name: name.to_string(),
            category: p["categorie"].as_str().unwrap_or(fallback_cat).to_string(),
            price_suggestion: p["prix_fcfa"].as_i64().unwrap_or(fallback_price),
            description: p["description"].as_str().unwrap_or("").to_string(),
        })
    }

    /// Publie le produit dans la marketplace Yukpo
    pub async fn publish_product(
        &self,
        user_id: i32,
        image_url: &str,
        name: &str,
        category: &str,
        price: i64,
        description: &str,
    ) -> Option<String> {
        let result = sqlx::query(
            r#"
            INSERT INTO products
                (user_id, nom, categorie, prix, description,
                 image_url, actif, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, true, NOW())
            RETURNING id
            "#,
        )
        .bind(user_id)
        .bind(name)
        .bind(category)
        .bind(price as i32)
        .bind(description)
        .bind(image_url)
        .fetch_optional(&*self.pool)
        .await
        .ok()
        .flatten();

        result.and_then(|r| r.try_get::<i32, _>("id").ok().map(|id| id.to_string()))
    }

    // ── Messages ──────────────────────────────────────────────────────────────

    pub fn format_detected_product(product: &DetectedProduct) -> String {
        format!(
            "🛍️ *Produit détecté !*\n\n\
            📦 Nom : *{}*\n\
            🏷️ Catégorie : {}\n\
            💰 Prix suggéré : {} FCFA\n\n\
            ✅ Ces informations sont correctes ?\n\n\
            1️⃣ ✅ Oui, publier maintenant\n\
            2️⃣ ✏️ Modifier le nom\n\
            3️⃣ 💰 Modifier le prix\n\
            4️⃣ ❌ Annuler\n\n\
            _Tapez votre choix._",
            product.name, product.category, product.price_suggestion
        )
    }

    pub fn published_product_message(product_name: &str, product_id: &str) -> String {
        format!(
            "✅ *Produit publié sur Yukpo !*\n\n\
            🛍️ *{}*\n\
            🔗 ID : {}\n\n\
            Votre produit est maintenant visible par tous les utilisateurs Yukpo.\n\n\
            📲 Gérez vos produits sur l'app *Yukpo* !",
            product_name, product_id
        )
    }

    pub fn ask_product_price(name: &str) -> String {
        format!(
            "💰 Quel prix souhaitez-vous pour *{}* ?\n\n\
            Tapez le montant en FCFA.\nEx : *5000*",
            name
        )
    }

    pub fn ask_product_name() -> String {
        "✏️ Quel est le nom de votre produit ?\n\nEx : *Robe en wax bleue*, *Sac à main cuir*"
            .to_string()
    }
}

fn classify_product(labels: &[String], text: &str) -> (String, &'static str, i64) {
    let all = format!(
        "{} {}",
        labels.join(" ").to_lowercase(),
        text.to_lowercase()
    );

    // Vêtements
    if matches!(all.as_str(), s if s.contains("clothing") || s.contains("dress") || s.contains("shirt")
        || s.contains("robe") || s.contains("vêtement") || s.contains("tissue"))
    {
        return (
            extract_product_name(labels, text, "Vêtement"),
            "vetements",
            8000,
        );
    }

    // Électronique
    if matches!(all.as_str(), s if s.contains("phone") || s.contains("electronic")
        || s.contains("computer") || s.contains("laptop") || s.contains("tablet"))
    {
        return (
            extract_product_name(labels, text, "Appareil électronique"),
            "electronique",
            50000,
        );
    }

    // Alimentation
    if matches!(all.as_str(), s if s.contains("food") || s.contains("fruit")
        || s.contains("vegetable") || s.contains("nourriture") || s.contains("repas"))
    {
        return (
            extract_product_name(labels, text, "Produit alimentaire"),
            "alimentation",
            2000,
        );
    }

    // Mobilier
    if matches!(all.as_str(), s if s.contains("furniture") || s.contains("chair")
        || s.contains("table") || s.contains("sofa") || s.contains("meuble"))
    {
        return (
            extract_product_name(labels, text, "Meuble"),
            "mobilier",
            30000,
        );
    }

    // Beauté
    if matches!(all.as_str(), s if s.contains("cosmetic") || s.contains("beauty")
        || s.contains("perfume") || s.contains("makeup") || s.contains("beauté"))
    {
        return (
            extract_product_name(labels, text, "Produit beauté"),
            "beaute",
            5000,
        );
    }

    (
        extract_product_name(labels, text, "Produit"),
        "divers",
        5000,
    )
}

fn extract_product_name(labels: &[String], text: &str, fallback: &str) -> String {
    // Prendre le premier label significatif ou la première ligne du texte
    if let Some(label) = labels.first() {
        if label.len() > 2 {
            return capitalize(label);
        }
    }
    let first_line = text
        .lines()
        .find(|l| l.len() > 3 && !l.trim().is_empty())
        .map(|l| l.trim().to_string());

    first_line.unwrap_or_else(|| fallback.to_string())
}

fn capitalize(s: &str) -> String {
    let mut c = s.chars();
    match c.next() {
        None => String::new(),
        Some(f) => f.to_uppercase().collect::<String>() + c.as_str(),
    }
}
