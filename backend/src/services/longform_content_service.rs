// Long-form Content Service — Yukpo
// Génère des contenus longs : scripts YouTube, articles de blog,
// newsletters, outlines de podcasts, articles LinkedIn.
// Adapté aux créateurs de contenu et personnalités publiques.

use serde::{Deserialize, Serialize};

use crate::services::yukpo_openai_outbound::resolve_openai_api_key;

// ─── Types ────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LongformRequest {
    pub content_type: String, // youtube_script | blog_article | newsletter | linkedin_article | podcast_outline
    pub topic: String,
    pub store_name: Option<String>,
    pub brand_voice: Option<String>,
    pub language: String,
    pub tone: String, // professional | casual | educational | inspirational
    pub target_duration_min: Option<i32>, // pour scripts : durée cible en minutes
    pub target_words: Option<i32>, // pour articles : nombre de mots cible
    pub linked_trend: Option<String>, // tendance à exploiter
    pub linked_products: Option<Vec<String>>, // produits à mentionner
    pub cta_url: Option<String>, // lien d'appel à l'action
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LongformResult {
    pub content_type: String,
    pub title: String,
    pub content: String,
    pub word_count: usize,
    pub estimated_duration_min: Option<i32>,
    pub seo_keywords: Vec<String>,
    pub suggested_hashtags: Vec<String>,
}

// ─── Point d'entrée principal ─────────────────────────────────────────────────

pub async fn generate_longform_content(req: &LongformRequest) -> Result<LongformResult, String> {
    match req.content_type.as_str() {
        "youtube_script" => generate_youtube_script(req).await,
        "blog_article" => generate_blog_article(req).await,
        "newsletter" => generate_newsletter(req).await,
        "linkedin_article" => generate_linkedin_article(req).await,
        "podcast_outline" => generate_podcast_outline(req).await,
        other => Err(format!("Type de contenu non supporté: {}", other)),
    }
}

// ─── Scripts YouTube ──────────────────────────────────────────────────────────

async fn generate_youtube_script(req: &LongformRequest) -> Result<LongformResult, String> {
    let api_key = resolve_openai_api_key().ok_or("OPENAI_API_KEY non configurée")?;
    let duration = req.target_duration_min.unwrap_or(5);
    let word_target = duration * 130; // ~130 mots/minute parlé naturel

    let brand_context = if let Some(ref bv) = req.brand_voice {
        format!("\nSTYLE DE LA CHAÎNE :\n{}", bv)
    } else {
        String::new()
    };

    let products_context = if let Some(ref products) = req.linked_products {
        format!("\nPRODUITS À MENTIONNER : {}", products.join(", "))
    } else {
        String::new()
    };

    let trend_context = if let Some(ref trend) = req.linked_trend {
        format!("\nTENDANCE ACTUELLE À EXPLOITER : {}", trend)
    } else {
        String::new()
    };

    let cta = req.cta_url.as_deref().unwrap_or("https://yukpomnang.com");

    let prompt = format!(
        r#"Écris un script complet pour une vidéo YouTube de {duration} minutes (~{words} mots) sur ce sujet.

SUJET : {topic}
LANGUE : {language}
TON : {tone}
CHAÎNE : {store}{brand}{products}{trend}

STRUCTURE REQUISE :
1. [HOOK 0-15s] Accroche percutante qui arrête le scroll
2. [INTRO 15-45s] Présentation + promesse de valeur
3. [CORPS 1 → {sections}] Développement structuré avec transitions naturelles
4. [CTA MILIEU] Mention naturelle de {cta}
5. [CONCLUSION] Récapitulatif + appel à s'abonner
6. [CTA FINAL] "{cta}"

Pour chaque section, indiquer [TIMESTAMP approximatif] et [NOTE RÉALISATION si besoin].

Le script doit être prêt à lire à voix haute, naturel et engageant."#,
        duration = duration,
        words = word_target,
        topic = req.topic,
        language = req.language,
        tone = req.tone,
        store = req.store_name.as_deref().unwrap_or(""),
        brand = brand_context,
        products = products_context,
        trend = trend_context,
        sections = (duration / 2).max(3),
        cta = cta,
    );

    let content = call_gpt4o(&api_key, &prompt, 3000).await?;
    let title = extract_or_generate_title(&content, &req.topic, "youtube_script").await;
    let word_count = content.split_whitespace().count();

    Ok(LongformResult {
        content_type: "youtube_script".to_string(),
        title,
        content,
        word_count,
        estimated_duration_min: Some(duration),
        seo_keywords: extract_seo_keywords(&req.topic),
        suggested_hashtags: generate_hashtags(&req.topic, "youtube"),
    })
}

// ─── Articles de blog ─────────────────────────────────────────────────────────

async fn generate_blog_article(req: &LongformRequest) -> Result<LongformResult, String> {
    let api_key = resolve_openai_api_key().ok_or("OPENAI_API_KEY non configurée")?;
    let words = req.target_words.unwrap_or(800);

    let prompt = format!(
        r#"Écris un article de blog SEO-optimisé de ~{words} mots.

SUJET : {topic}
LANGUE : {language}
TON : {tone}
MARQUE : {store}
{brand_voice}
{trend_ctx}
{products_ctx}

STRUCTURE :
- Titre H1 accrocheur (avec mot-clé principal)
- Introduction engageante (hook + problème + promesse)
- 4-6 sections H2 avec contenu substantiel
- Listes à puces et exemples concrets
- Conclusion avec CTA vers {cta}
- Meta description (155 chars max)

Format Markdown."#,
        words = words,
        topic = req.topic,
        language = req.language,
        tone = req.tone,
        store = req.store_name.as_deref().unwrap_or(""),
        brand_voice = req
            .brand_voice
            .as_deref()
            .map(|bv| format!("STYLE : {}", bv))
            .unwrap_or_default(),
        trend_ctx = req
            .linked_trend
            .as_deref()
            .map(|t| format!("TENDANCE : {}", t))
            .unwrap_or_default(),
        products_ctx = req
            .linked_products
            .as_ref()
            .map(|p| format!("PRODUITS : {}", p.join(", ")))
            .unwrap_or_default(),
        cta = req.cta_url.as_deref().unwrap_or("https://yukpomnang.com"),
    );

    let content = call_gpt4o(&api_key, &prompt, 2500).await?;
    let title = extract_title_from_markdown(&content).unwrap_or_else(|| req.topic.clone());
    let word_count = content.split_whitespace().count();

    Ok(LongformResult {
        content_type: "blog_article".to_string(),
        title,
        content,
        word_count,
        estimated_duration_min: Some((word_count / 200) as i32), // ~200 mots/min lecture
        seo_keywords: extract_seo_keywords(&req.topic),
        suggested_hashtags: generate_hashtags(&req.topic, "blog"),
    })
}

// ─── Newsletters ──────────────────────────────────────────────────────────────

async fn generate_newsletter(req: &LongformRequest) -> Result<LongformResult, String> {
    let api_key = resolve_openai_api_key().ok_or("OPENAI_API_KEY non configurée")?;

    let prompt = format!(
        r#"Écris une newsletter email engageante.

SUJET PRINCIPAL : {topic}
LANGUE : {language}
TON : {tone}
EXPÉDITEUR : {store}
{brand_voice}
{products_ctx}

STRUCTURE :
- Objet email (max 50 chars, taux d'ouverture maximal)
- Pré-header (max 100 chars)
- Salutation personnalisée ("Bonjour {{prénom}},")
- Intro (2-3 lignes captivantes)
- Corps principal (200-400 mots)
- Section produit/offre si applicable
- CTA bouton principal : {cta}
- Signature
- P.S. (optionnel — souvent le plus lu)

Format HTML email-ready avec inline CSS basique."#,
        topic = req.topic,
        language = req.language,
        tone = req.tone,
        store = req.store_name.as_deref().unwrap_or(""),
        brand_voice = req
            .brand_voice
            .as_deref()
            .map(|bv| format!("STYLE : {}", bv))
            .unwrap_or_default(),
        products_ctx = req
            .linked_products
            .as_ref()
            .map(|p| format!("PRODUITS/OFFRES : {}", p.join(", ")))
            .unwrap_or_default(),
        cta = req.cta_url.as_deref().unwrap_or("https://yukpomnang.com"),
    );

    let content = call_gpt4o(&api_key, &prompt, 1500).await?;
    let word_count = content.split_whitespace().count();

    Ok(LongformResult {
        content_type: "newsletter".to_string(),
        title: req.topic.clone(),
        content,
        word_count,
        estimated_duration_min: None,
        seo_keywords: vec![],
        suggested_hashtags: vec![],
    })
}

// ─── Articles LinkedIn ────────────────────────────────────────────────────────

async fn generate_linkedin_article(req: &LongformRequest) -> Result<LongformResult, String> {
    let api_key = resolve_openai_api_key().ok_or("OPENAI_API_KEY non configurée")?;
    let words = req.target_words.unwrap_or(600);

    let prompt = format!(
        r#"Écris un article LinkedIn à fort engagement (~{words} mots).

SUJET : {topic}
LANGUE : {language}
TON : {tone} (LinkedIn = professionnel mais humain)
AUTEUR : {store}
{brand_voice}
{trend_ctx}

STRUCTURE LINKEDIN :
- 1ère ligne accrocheuse (le "hook" qui force le "voir plus")
- Storytelling ou stats choc
- 3-5 points clés en courtes lignes (lisible sur mobile)
- Conclusion avec question engageante
- CTA discret
- 3-5 hashtags pertinents

Style : phrases courtes, espacement aéré, authentique."#,
        words = words,
        topic = req.topic,
        language = req.language,
        tone = req.tone,
        store = req.store_name.as_deref().unwrap_or(""),
        brand_voice = req
            .brand_voice
            .as_deref()
            .map(|bv| format!("STYLE : {}", bv))
            .unwrap_or_default(),
        trend_ctx = req
            .linked_trend
            .as_deref()
            .map(|t| format!("TENDANCE : {}", t))
            .unwrap_or_default(),
    );

    let content = call_gpt4o(&api_key, &prompt, 1200).await?;
    let word_count = content.split_whitespace().count();
    let title = content.lines().next().unwrap_or(&req.topic).to_string();

    Ok(LongformResult {
        content_type: "linkedin_article".to_string(),
        title,
        content,
        word_count,
        estimated_duration_min: None,
        seo_keywords: extract_seo_keywords(&req.topic),
        suggested_hashtags: generate_hashtags(&req.topic, "linkedin"),
    })
}

// ─── Outline Podcast ─────────────────────────────────────────────────────────

async fn generate_podcast_outline(req: &LongformRequest) -> Result<LongformResult, String> {
    let api_key = resolve_openai_api_key().ok_or("OPENAI_API_KEY non configurée")?;
    let duration = req.target_duration_min.unwrap_or(20);

    let prompt = format!(
        r#"Crée un plan détaillé pour un épisode de podcast de {duration} minutes.

SUJET : {topic}
LANGUE : {language}
TON : {tone}
ÉMISSION : {store}
{brand_voice}
{trend_ctx}

LIVRABLE :
1. Titre de l'épisode (accrocheur + SEO)
2. Description courte (pour plateformes podcast)
3. Introduction (3-5 min) — points clés
4. Développement ({sections} segments de ~{seg_dur} min chacun) avec sous-points
5. Interview/anecdote suggérée si pertinent
6. Conclusion + takeaways (2-3 min)
7. Outro et CTA
8. Timestamps suggérés
9. Mots-clés SEO pour les notes de show"#,
        duration = duration,
        topic = req.topic,
        language = req.language,
        tone = req.tone,
        store = req.store_name.as_deref().unwrap_or(""),
        brand_voice = req
            .brand_voice
            .as_deref()
            .map(|bv| format!("STYLE : {}", bv))
            .unwrap_or_default(),
        trend_ctx = req
            .linked_trend
            .as_deref()
            .map(|t| format!("TENDANCE : {}", t))
            .unwrap_or_default(),
        sections = (duration / 5).max(3),
        seg_dur = 5,
    );

    let content = call_gpt4o(&api_key, &prompt, 1500).await?;
    let word_count = content.split_whitespace().count();

    Ok(LongformResult {
        content_type: "podcast_outline".to_string(),
        title: req.topic.clone(),
        content,
        word_count,
        estimated_duration_min: Some(duration),
        seo_keywords: extract_seo_keywords(&req.topic),
        suggested_hashtags: generate_hashtags(&req.topic, "podcast"),
    })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async fn call_gpt4o(api_key: &str, prompt: &str, max_tokens: u32) -> Result<String, String> {
    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "model": "gpt-4o",
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": max_tokens,
        "temperature": 0.7,
    });

    let resp = client
        .post("https://api.openai.com/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&body)
        .timeout(std::time::Duration::from_secs(60))
        .send()
        .await
        .map_err(|e| format!("[Longform] Réseau: {}", e))?;

    if !resp.status().is_success() {
        let txt = resp.text().await.unwrap_or_default();
        return Err(format!("[Longform] API: {}", txt));
    }

    let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    Ok(data["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("")
        .trim()
        .to_string())
}

async fn extract_or_generate_title(content: &str, topic: &str, _content_type: &str) -> String {
    // Chercher le premier titre en markdown
    if let Some(title) = extract_title_from_markdown(content) {
        return title;
    }
    // Sinon utiliser le topic directement
    topic.to_string()
}

fn extract_title_from_markdown(content: &str) -> Option<String> {
    content
        .lines()
        .find(|line| line.starts_with("# "))
        .map(|line| line.trim_start_matches("# ").trim().to_string())
}

fn extract_seo_keywords(topic: &str) -> Vec<String> {
    topic
        .split_whitespace()
        .filter(|w| w.len() >= 4)
        .take(5)
        .map(|w| w.to_lowercase())
        .collect()
}

fn generate_hashtags(topic: &str, platform: &str) -> Vec<String> {
    let base: Vec<String> = topic
        .split_whitespace()
        .filter(|w| w.len() >= 4)
        .take(3)
        .map(|w| w.to_lowercase().replace(['\'', '\u{2019}', '-'], ""))
        .collect();

    let platform_tags: Vec<String> = match platform {
        "youtube" => vec!["youtube".to_string(), "video".to_string()],
        "linkedin" => vec!["linkedin".to_string(), "business".to_string()],
        "podcast" => vec!["podcast".to_string(), "audio".to_string()],
        _ => vec!["contenu".to_string()],
    };

    base.into_iter().chain(platform_tags.into_iter()).collect()
}
