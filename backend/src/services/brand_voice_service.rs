// Brand Voice Service — Yukpo
// Analyse les exemples de posts fournis par un partenaire pour déduire son style
// et génère une description du "brand voice" utilisée comme contexte GPT-4o.
// Permet à YukpoIA d'écrire exactement comme le partenaire ou la personnalité.

use crate::services::yukpo_openai_outbound::resolve_openai_api_key;

// ─── Training ─────────────────────────────────────────────────────────────────

/// Analyse 5-20 exemples de posts et génère un résumé du style.
/// Stocke le résultat dans social_ai_preferences.brand_voice_summary.
pub async fn train_brand_voice(
    pg: &sqlx::PgPool,
    user_id: i32,
    service_id: i32,
    examples: &[String],
) -> Result<String, String> {
    if examples.is_empty() {
        return Err("Aucun exemple fourni".to_string());
    }
    if examples.len() < 3 {
        return Err("Minimum 3 exemples requis pour analyser le style".to_string());
    }

    let api_key = resolve_openai_api_key().ok_or("OPENAI_API_KEY non configurée")?;

    let examples_text = examples
        .iter()
        .enumerate()
        .map(|(i, e)| format!("Exemple {} :\n{}", i + 1, e))
        .collect::<Vec<_>>()
        .join("\n\n---\n\n");

    let prompt = format!(
        r#"Tu es un expert en analyse de style éditorial et de brand voice.

Analyse ces {} exemples de posts écrits par ce partenaire/personnalité :

{}

Génère une description concise (150-300 mots) du style d'écriture qui servira d'instruction à une IA pour reproduire ce style fidèlement. Inclure :

1. **Ton général** : formel/informel, chaleureux/distant, humoristique/sérieux
2. **Structure typique** : longueur, ponctuation, structure des phrases
3. **Vocabulaire caractéristique** : mots récurrents, expressions spécifiques, argot éventuel
4. **Usage des emojis** : fréquence, types utilisés
5. **Appels à l'action** : comment il/elle incite à l'engagement
6. **Valeurs communiquées** : ce qui compte pour cette personne/marque
7. **Ce qu'il NE faut PAS faire** : erreurs à éviter pour rester fidèle au style

Réponds directement avec la description, sans titres ni markdown."#,
        examples.len(),
        examples_text
    );

    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "model": "gpt-4o",
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 500,
        "temperature": 0.3,
    });

    let resp = client
        .post("https://api.openai.com/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&body)
        .timeout(std::time::Duration::from_secs(30))
        .send()
        .await
        .map_err(|e| format!("[BrandVoice] Réseau: {}", e))?;

    if !resp.status().is_success() {
        let txt = resp.text().await.unwrap_or_default();
        return Err(format!("[BrandVoice] API: {}", txt));
    }

    let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let summary = data["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("")
        .trim()
        .to_string();

    if summary.is_empty() {
        return Err("[BrandVoice] Réponse vide".to_string());
    }

    // Persister en base
    let _ = sqlx::query(
        r#"UPDATE social_ai_preferences
           SET brand_voice_summary = $1,
               brand_voice_examples = $2,
               brand_voice_trained_at = NOW(),
               updated_at = NOW()
           WHERE user_id = $3 AND service_id = $4"#,
    )
    .bind(&summary)
    .bind(examples)
    .bind(user_id)
    .bind(service_id)
    .execute(pg)
    .await
    .map_err(|e| e.to_string())?;

    log::info!(
        "[BrandVoice] ✅ Brand voice entraîné pour user={} service={}",
        user_id,
        service_id
    );

    Ok(summary)
}

/// Charge le brand voice summary depuis la DB pour enrichir le system prompt
pub async fn load_brand_voice(pg: &sqlx::PgPool, user_id: i32, service_id: i32) -> Option<String> {
    use sqlx::Row;
    let row = sqlx::query(
        "SELECT brand_voice_summary FROM social_ai_preferences WHERE user_id = $1 AND service_id = $2",
    )
    .bind(user_id)
    .bind(service_id)
    .fetch_optional(pg)
    .await
    .ok()??;

    row.try_get::<Option<String>, _>("brand_voice_summary").ok().flatten()
}

/// Génère un post en respectant strictement le brand voice du partenaire.
/// Utilisé pour les personnalités publiques qui ont un style très particulier.
pub async fn generate_with_brand_voice(
    content_request: &str,
    brand_voice_summary: &str,
    platform: &str,
    language: &str,
) -> Result<String, String> {
    let api_key = resolve_openai_api_key().ok_or("OPENAI_API_KEY non configurée")?;

    let platform_instruction = match platform {
        "instagram" => "Format Instagram (visuel-first, max 300 chars, 5 emojis max)",
        "twitter" | "x" => "Format Tweet (max 280 chars, concis, impactant)",
        "tiktok" => {
            "Format TikTok (accroche forte en 1ère ligne, ton énergique, hashtags tendance)"
        }
        "youtube" => "Titre YouTube (accrocheur, max 100 chars, inclure mots-clés SEO)",
        "facebook" => "Format Facebook (peut être plus long, ton communautaire)",
        "linkedin" => "Format LinkedIn (professionnel, structuré, valeur ajoutée)",
        _ => "Post générique",
    };

    let prompt = format!(
        r#"Tu dois écrire un post en respectant EXACTEMENT le style de cette personne/marque.

STYLE À REPRODUIRE :
{}

DEMANDE : {}

FORMAT CIBLE : {}
LANGUE : {}

Écris le post directement, sans explications ni guillemets."#,
        brand_voice_summary, content_request, platform_instruction, language
    );

    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "model": "gpt-4o",
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 400,
        "temperature": 0.7,
    });

    let resp = client
        .post("https://api.openai.com/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&body)
        .timeout(std::time::Duration::from_secs(20))
        .send()
        .await
        .map_err(|e| format!("[BrandVoice Gen] Réseau: {}", e))?;

    let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let post = data["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("")
        .trim()
        .to_string();

    Ok(post)
}
