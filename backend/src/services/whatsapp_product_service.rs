// ✅ WhatsApp Product Service — Création de produit (image/texte/audio) + recherche services
// Miroir de AjouterProduitSimpleScreen + SearchScreen

use crate::services::app_ia::AppIA;
use crate::services::whatsapp_session_service::ServiceSearchResult;
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

    // ── Création produit via texte ────────────────────────────────────────────

    /// Parse un texte libre pour en extraire un produit à publier
    pub async fn analyze_product_from_text(&self, text: &str) -> DetectedProduct {
        let text_lower = text.to_lowercase();

        // Détecter le prix dans le texte (patterns courants)
        let price = extract_price_from_text(&text_lower);

        // Détecter la catégorie
        let (_, category, default_price) = classify_product(&[], &text_lower);
        let price_suggestion = price.unwrap_or(default_price);

        // Essayer d'extraire le nom du produit via IA
        if let Some(detected) = self.extract_product_from_text_via_ia(text).await {
            return DetectedProduct {
                image_url: String::new(),
                name: detected.name,
                category: detected.category,
                price_suggestion: price.unwrap_or(detected.price_suggestion),
                description: detected.description,
            };
        }

        // Fallback heuristique
        let name = extract_product_name_from_text(text);
        DetectedProduct {
            image_url: String::new(),
            name,
            category: category.to_string(),
            price_suggestion,
            description: String::new(),
        }
    }

    async fn extract_product_from_text_via_ia(&self, text: &str) -> Option<DetectedProduct> {
        let api_key = std::env::var("OPENAI_API_KEY").ok().or_else(|| {
            std::env::var("OPENAI_API_KEYS")
                .ok()
                .and_then(|k| k.split(',').next().map(|s| s.trim().to_string()))
        })?;

        let prompt_body = serde_json::json!({
            "model": "gpt-4o-mini",
            "messages": [{
                "role": "system",
                "content": "Tu extrais les informations d'une annonce de vente en JSON uniquement. Réponds UNIQUEMENT avec du JSON valide: {\"nom\": \"...\", \"categorie\": \"...\", \"prix_fcfa\": 0, \"description\": \"...\"}\ncategorie parmi: electronique/vetement/alimentaire/mobilier/automobile/livre/service/autre\nprix_fcfa: prix en FCFA (0 si non mentionné)"
            }, {
                "role": "user",
                "content": format!("Annonce: {}", text)
            }],
            "max_tokens": 200,
            "temperature": 0.1
        });

        let http = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(15))
            .build()
            .ok()?;

        let resp = http
            .post("https://api.openai.com/v1/chat/completions")
            .bearer_auth(&api_key)
            .json(&prompt_body)
            .send()
            .await
            .ok()?;

        if !resp.status().is_success() {
            return None;
        }

        let json: serde_json::Value = resp.json().await.ok()?;
        let content = json["choices"][0]["message"]["content"].as_str()?;
        let clean = content
            .trim()
            .trim_start_matches("```json")
            .trim_start_matches("```")
            .trim_end_matches("```")
            .trim();
        let p: serde_json::Value = serde_json::from_str(clean).ok()?;

        Some(DetectedProduct {
            image_url: String::new(),
            name: p["nom"].as_str().unwrap_or("Produit").to_string(),
            category: p["categorie"].as_str().unwrap_or("autre").to_string(),
            price_suggestion: p["prix_fcfa"].as_i64().unwrap_or(0),
            description: p["description"].as_str().unwrap_or("").to_string(),
        })
    }

    pub fn format_detected_product_from_text(product: &DetectedProduct) -> String {
        let price_str = if product.price_suggestion > 0 {
            format!("{} FCFA", product.price_suggestion)
        } else {
            "À définir".to_string()
        };
        format!(
            "📝 *Annonce détectée !*\n\n\
            📦 Produit : *{}*\n\
            🏷️ Catégorie : {}\n\
            💰 Prix : {}\n\n\
            Voulez-vous publier cette annonce sur Yukpo ?\n\n\
            1. ✅ Publier maintenant\n\
            2. 💰 Modifier le prix\n\
            3. ❌ Annuler\n\n\
            _Tapez votre choix._",
            product.name, product.category, price_str
        )
    }

    // ── Transcription audio (Whisper) ─────────────────────────────────────────

    /// Télécharge et transcrit un message vocal WhatsApp via OpenAI Whisper
    pub async fn transcribe_audio(&self, audio_url: &str) -> Option<String> {
        let api_key = std::env::var("OPENAI_API_KEY").ok().or_else(|| {
            std::env::var("OPENAI_API_KEYS")
                .ok()
                .and_then(|k| k.split(',').next().map(|s| s.trim().to_string()))
        })?;

        // Télécharger le fichier audio depuis Twilio
        let twilio_sid = std::env::var("TWILIO_ACCOUNT_SID").unwrap_or_default();
        let twilio_token = std::env::var("TWILIO_AUTH_TOKEN").unwrap_or_default();
        let http = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .ok()?;

        let req = if !twilio_sid.is_empty() {
            http.get(audio_url).basic_auth(&twilio_sid, Some(&twilio_token))
        } else {
            http.get(audio_url)
        };

        let bytes = req.send().await.ok()?.bytes().await.ok()?;
        if bytes.is_empty() {
            return None;
        }

        // Envoyer à OpenAI Whisper via multipart form
        let part = reqwest::multipart::Part::bytes(bytes.to_vec())
            .file_name("audio.ogg")
            .mime_str("audio/ogg")
            .ok()?;
        let form = reqwest::multipart::Form::new()
            .part("file", part)
            .text("model", "whisper-1")
            .text("language", "fr");

        let resp = http
            .post("https://api.openai.com/v1/audio/transcriptions")
            .bearer_auth(&api_key)
            .multipart(form)
            .send()
            .await
            .ok()?;

        if !resp.status().is_success() {
            log::warn!("[ProductService] Whisper erreur: {}", resp.status());
            return None;
        }

        let json: serde_json::Value = resp.json().await.ok()?;
        let text = json["text"].as_str()?.trim().to_string();
        if text.is_empty() {
            return None;
        }

        log::info!("[ProductService] 🎤 Transcription audio: '{}'", text);
        Some(text)
    }

    // ── Recherche de services/prestataires ────────────────────────────────────

    /// Recherche des services/prestataires dans la base Yukpo
    pub async fn search_services(&self, query: &str) -> Vec<ServiceSearchResult> {
        let search = format!("%{}%", query.trim().to_lowercase());

        let rows = sqlx::query(
            r#"
            SELECT
                s.id as service_id,
                COALESCE(s.data->>'nom_structure', s.data->>'titre_service', s.nom, 'Service') as service_name,
                COALESCE(s.categorie, s.type_service, 'Service') as category,
                COALESCE(s.data->>'adresse', s.data->>'localisation', '') as address,
                COALESCE(s.data->>'telephone', s.data->>'whatsapp', '') as phone,
                COALESCE(s.data->>'ville', 'Cameroun') as city,
                COALESCE(s.rating, 0.0) as rating
            FROM services s
            WHERE s.actif = true
              AND (
                  LOWER(COALESCE(s.data->>'nom_structure', '')) LIKE $1
                  OR LOWER(COALESCE(s.data->>'titre_service', '')) LIKE $1
                  OR LOWER(COALESCE(s.nom, '')) LIKE $1
                  OR LOWER(COALESCE(s.categorie, '')) LIKE $1
                  OR LOWER(COALESCE(s.type_service, '')) LIKE $1
                  OR LOWER(COALESCE(s.data->>'description', '')) LIKE $1
              )
            ORDER BY s.rating DESC NULLS LAST, s.created_at DESC
            LIMIT 5
            "#,
        )
        .bind(&search)
        .fetch_all(&*self.pool)
        .await
        .unwrap_or_default();

        rows.iter()
            .map(|r| ServiceSearchResult {
                service_id: r.try_get("service_id").unwrap_or(0),
                name: r.try_get("service_name").unwrap_or_default(),
                category: r.try_get("category").unwrap_or_default(),
                address: r.try_get("address").unwrap_or_default(),
                phone: r.try_get("phone").unwrap_or_default(),
                city: r.try_get("city").unwrap_or_default(),
                rating: r.try_get::<f64, _>("rating").unwrap_or(0.0),
            })
            .collect()
    }

    pub fn format_service_results(results: &[ServiceSearchResult], query: &str) -> String {
        if results.is_empty() {
            return format!(
                "😔 Aucun prestataire trouvé pour *{}*.\n\n\
                💡 Essayez :\n• _plombier Douala_\n• _coiffeur Yaoundé_\n• _restaurant Akwa_\n\n\
                Ou tapez *MENU* pour revenir.",
                query
            );
        }
        let mut msg = format!("🔍 *{}* — {} résultat(s) :\n\n", query, results.len());
        for (i, r) in results.iter().enumerate() {
            let stars = if r.rating >= 4.0 {
                "⭐⭐⭐⭐⭐"
            } else if r.rating >= 3.0 {
                "⭐⭐⭐⭐"
            } else if r.rating >= 2.0 {
                "⭐⭐⭐"
            } else {
                ""
            };
            msg.push_str(&format!(
                "{}️⃣ *{}* {}\n📍 {} — {}\n📞 {}\n\n",
                i + 1,
                r.name,
                stars,
                r.address,
                r.city,
                r.phone
            ));
        }
        msg.push_str("_Tapez le numéro pour contacter, ou *MENU* pour revenir._");
        msg
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

/// Extrait un prix en FCFA depuis un texte (formats: "5000 fcfa", "5 000 f", "à 5000", "5k")
fn extract_price_from_text(text: &str) -> Option<i64> {
    // Pattern: nombre suivi de fcfa, f, xaf, ou franc
    let patterns = [
        r"(\d[\d\s]*)\s*(?:fcfa|f\b|xaf|franc)",
        r"(?:à|prix|coûte|coute|vends? à|vendu à)\s*(\d[\d\s]*)",
        r"(\d[\d\s]{2,})\s*(?:cfa)?$",
    ];

    for pattern in &patterns {
        if let Ok(re) = regex::Regex::new(pattern) {
            if let Some(cap) = re.captures(text) {
                if let Some(m) = cap.get(1) {
                    let digits: String =
                        m.as_str().chars().filter(|c| c.is_ascii_digit()).collect();
                    if let Ok(n) = digits.parse::<i64>() {
                        if n > 100 && n < 100_000_000 {
                            return Some(n);
                        }
                    }
                }
            }
        }
    }

    // Fallback: chercher un nombre seul > 500 (probablement un prix)
    for word in text.split_whitespace() {
        let clean: String = word.chars().filter(|c| c.is_ascii_digit()).collect();
        if let Ok(n) = clean.parse::<i64>() {
            if n >= 500 && n <= 10_000_000 {
                return Some(n);
            }
        }
    }
    None
}

/// Extrait le nom du produit depuis un texte libre
fn extract_product_name_from_text(text: &str) -> String {
    let stop_words = [
        "je", "vends", "vend", "vendre", "propose", "cède", "cede", "à", "au", "prix", "de",
        "pour", "bonjour", "salut", "svp", "stp", "fcfa", "cfa", "francs",
    ];
    let words: Vec<&str> = text
        .split_whitespace()
        .filter(|w| {
            let wl = w.to_lowercase();
            !stop_words.contains(&wl.as_str()) && !w.chars().all(|c| c.is_ascii_digit())
        })
        .take(5)
        .collect();
    let name = words.join(" ");
    if name.len() > 2 {
        capitalize(&name)
    } else {
        "Produit à vendre".to_string()
    }
}
