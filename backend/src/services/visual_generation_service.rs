//! Service de génération de visuels marketing / invitations / banners depuis YukpoIA.
//!
//! Lorsque l'IA détecte dans sa réponse un champ `visual_generation`, ce service :
//! 1. Appelle `scripts/visual_generator.py` via subprocess,
//! 2. Envoie le spec JSON en stdin,
//! 3. Récupère les octets PNG/JPEG,
//! 4. Uploade via media_storage et retourne un attachment.

use log::{error, info, warn};
use serde_json::{json, Value};
use std::process::Stdio;
use std::sync::Arc;
use tokio::io::AsyncWriteExt;
use tokio::process::Command;

use crate::{services::yukpo_ia_chat_enrich::upload_chat_attachment_blob, state::AppState};

const VISUAL_SCRIPT: &str = "scripts/visual_generator.py";

/// Génère un visuel marketing depuis un spec JSON et retourne un objet attachment.
pub async fn generate_visual_attachment(
    state: &Arc<AppState>,
    user_id: i32,
    spec: &Value,
) -> Option<Value> {
    let visual_type = spec.get("visual_type").and_then(|v| v.as_str()).unwrap_or("poster");
    let out_fmt = spec
        .get("output_format")
        .and_then(|v| v.as_str())
        .unwrap_or("png")
        .to_lowercase();
    let (ext, mime) = if out_fmt == "jpeg" || out_fmt == "jpg" {
        ("jpg", "image/jpeg")
    } else {
        ("png", "image/png")
    };

    let title = spec.get("title").and_then(|v| v.as_str()).unwrap_or("visuel");
    let safe_title: String = title
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .take(50)
        .collect();
    let filename = format!("{}_{}.{}", visual_type, safe_title, ext);

    let json_input = match serde_json::to_vec(spec) {
        Ok(b) => b,
        Err(e) => {
            error!("[VisualGen] serde spec: {}", e);
            return None;
        }
    };

    let bytes = run_python_visual(json_input).await?;
    if bytes.is_empty() {
        warn!(
            "[VisualGen] Python a retourné 0 octets pour user_id={}",
            user_id
        );
        return None;
    }

    info!(
        "[VisualGen] Visuel généré ({} octets, {}) pour user_id={}",
        bytes.len(),
        filename,
        user_id
    );

    match upload_chat_attachment_blob(state, user_id, &bytes, &filename, mime).await {
        Ok(att) => Some(att),
        Err(e) => {
            error!("[VisualGen] upload: {}", e);
            None
        }
    }
}

async fn run_python_visual(json_input: Vec<u8>) -> Option<Vec<u8>> {
    for cmd in &["python3", "python"] {
        match try_python_visual(cmd, &json_input).await {
            Ok(b) => return Some(b),
            Err(e) => warn!("[VisualGen] {} échoué: {}", cmd, e),
        }
    }
    error!("[VisualGen] Aucune commande Python disponible ou script en erreur");
    None
}

async fn try_python_visual(cmd: &str, json_input: &[u8]) -> Result<Vec<u8>, String> {
    let mut child = Command::new(cmd)
        .arg(VISUAL_SCRIPT)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("spawn {}: {}", cmd, e))?;

    if let Some(mut stdin) = child.stdin.take() {
        stdin.write_all(json_input).await.map_err(|e| format!("write stdin: {}", e))?;
    }

    let out = child.wait_with_output().await.map_err(|e| format!("wait: {}", e))?;

    if !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr);
        return Err(format!("exit {:?} — {}", out.status.code(), stderr));
    }

    Ok(out.stdout)
}

/// Détecte si la réponse de l'IA contient un champ `visual_generation` ou `visual_spec`.
pub fn extract_visual_spec(body: &Value) -> Option<Value> {
    for key in &["visual_generation", "visual_spec"] {
        if let Some(v) = body.get(*key) {
            if v.is_object() {
                return Some(v.clone());
            }
        }
    }
    None
}

/// Détecte si le message est une demande de génération de visuel.
pub fn is_visual_generation_request(message: &str) -> bool {
    let m = message.to_lowercase();
    let keywords = [
        "affiche",
        "poster",
        "flyer",
        "invitation",
        "billet",
        "banner",
        "bannière",
        "banniere",
        "visuel marketing",
        "visuel",
        "carte de visite",
        "certificat",
        "attestation",
        "post instagram",
        "post facebook",
        "post social",
        "story instagram",
        "story whatsapp",
        "design",
        "créer une image",
        "creer une image",
        "générer une image",
        "generer une image",
        "créer un visuel",
        "creer un visuel",
    ];
    keywords.iter().any(|kw| m.contains(kw))
}

/// Injecte le logo/bannière de l'utilisateur dans le spec visuel si fourni dans le contexte.
pub fn inject_user_assets_into_spec(spec: &mut Value, context: &Option<serde_json::Value>) {
    let Some(ctx) = context else { return };
    let img_b64 = ctx
        .get("logo_base64")
        .or_else(|| ctx.get("banner_base64"))
        .and_then(|v| v.as_str());
    let mime = ctx
        .get("logo_mime")
        .or_else(|| ctx.get("banner_mime"))
        .and_then(|v| v.as_str())
        .unwrap_or("image/png");
    if let (Some(b64), Some(obj)) = (img_b64, spec.as_object_mut()) {
        if !obj.contains_key("logo_base64") {
            obj.insert("logo_base64".to_string(), json!(b64));
            obj.insert("logo_mime".to_string(), json!(mime));
        }
    }
}

/// Instructions système pour la génération de visuels.
pub fn visual_generation_system_instructions() -> &'static str {
    r#"

=== GÉNÉRATION DE VISUELS MARKETING / INVITATIONS / BANNERS ===
Si l'utilisateur demande de **créer un visuel, une affiche, un flyer, une invitation, une bannière, un post réseaux sociaux, un certificat ou une carte de visite**, tu DOIS inclure dans ta réponse JSON un champ `visual_generation` avec le spec complet.

**Types disponibles :**
- `poster` / `flyer` — Affiche/flyer événement ou marketing
- `invitation` — Carton d'invitation élégant
- `banner` / `banner_wide` — Bannière Web ou présentielle
- `social_post` — Post Instagram/Facebook/LinkedIn
- `certificate` — Certificat ou attestation
- `business_card` — Carte de visite

**Formats :**
- `square` (1080×1080), `portrait` (1080×1350), `story` (1080×1920)
- `landscape` (1200×630), `banner_wide` (1500×500), `a4` (2480×3508)
- `business_card` (1050×600)

**Thèmes :** `blue`, `green`, `purple`, `orange`, `dark`, `light`, `gold`, `elegant`

**Format JSON :**
```json
{
  "message": "J'ai créé votre visuel. Téléchargez-le ci-dessous.",
  "type": "text",
  "visual_generation": {
    "visual_type": "invitation",
    "format": "portrait",
    "theme": "gold",
    "output_format": "png",
    "title": "Gala de Bienfaisance 2026",
    "subtitle": "Une soirée d'exception",
    "description": "Rejoignez-nous pour une soirée de gala au profit des enfants défavorisés.",
    "date": "Samedi 15 Juin 2026",
    "time": "19h00 – 23h30",
    "location": "Sofitel Abidjan Hôtel Ivoire",
    "organizer": "Association Avenir Côte d'Ivoire",
    "contact": "+225 07 00 11 22 33",
    "price": "50 000 FCFA / personne",
    "hashtags": ["Gala2026", "Solidarite"],
    "badge": "VIP",
    "brand_name": "AAC"
  }
}
```

**Règles :**
- Génère un contenu COMPLET et professionnel avec toutes les informations pertinentes.
- Choisis automatiquement le thème le plus adapté au contexte (événement festif → gold, corporate → blue, etc.).
- Adapte le format au type de visuel (invitation → portrait, bannière → banner_wide, post social → square).
- Le champ `description` doit contenir un texte accrocheur et bien rédigé.
- Inclure `badge` pour mettre en valeur une information clé (GRATUIT, VIP, NOUVEAU, PROMO).
"#
}
