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
        "ticket d'invitation",
        "carton d'invitation",
        "faire une affiche",
        "faire un flyer",
        "faire une banniere",
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
    r##"

=== GÉNÉRATION DE VISUELS MARKETING / INVITATIONS / BANNERS ===
Si l'utilisateur demande de créer un visuel, une affiche, un flyer, une invitation, une banniere, un post reseaux sociaux, un certificat, un billet ou une carte de visite, tu DOIS inclure dans ta reponse JSON un champ `visual_generation` avec le spec complet.

**Types disponibles :**
- `poster` / `flyer` — Affiche/flyer evenement ou marketing (fond degrade, info card, bullets)
- `invitation` — Carton d'invitation elegant avec cadre orne et details evenement
- `banner` / `banner_wide` — Banniere Web ou presentielle (format horizontal)
- `social_post` — Post Instagram/Facebook/LinkedIn (carre ou portrait)
- `certificate` / `attestation` — Certificat professionnel avec cadre double et ornements
- `business_card` / `carte_visite` — Carte de visite professionnelle
- `ticket` / `billet` — Billet d'entree avec souche decorative

**Formats :**
- `square` (1080x1080), `portrait` (1080x1350), `story` (1080x1920)
- `landscape` (1200x630), `banner_wide` (1500x500)
- `business_card` (1050x600), `ticket` (1400x650)

**Themes :** `blue` (corporate), `green` (nature), `purple` (premium), `orange` (energetique),
`dark` (tech/modern), `light` (minimaliste), `gold` (luxe/gala), `elegant` (sobre/luxe),
`red` (urgent/passion), `corporate` (B2B sobre)

**Format JSON :**
```json
{
  "message": "J'ai cree votre visuel professionnel. Telechargez-le ci-dessous.",
  "type": "text",
  "visual_generation": {
    "visual_type": "invitation",
    "format": "portrait",
    "theme": "gold",
    "output_format": "png",
    "title": "Gala de Bienfaisance 2026",
    "subtitle": "Une soiree d exception pour changer des vies",
    "description": "Rejoignez-nous pour une soiree inoubliable au profit des enfants. Dress code : tenue de soiree exigee.",
    "date": "Samedi 15 Juin 2026",
    "time": "19h00 - 23h30",
    "location": "Sofitel Abidjan Hotel Ivoire, Cocody",
    "organizer": "Association Avenir Cote d Ivoire",
    "contact": "+225 07 00 11 22 33",
    "price": "50 000 FCFA / personne",
    "hashtags": ["Gala2026", "Solidarite", "CI"],
    "badge": "VIP",
    "brand_name": "AAC",
    "bullets": ["Diner gastronomique inclus", "Spectacle de danse", "Tombola caritatif"]
  }
}
```

**Regles CRITIQUES :**
- Choisis le theme adapte au contexte : festif/gala → gold, corporate → blue ou corporate, sport → orange, tech → dark.
- Adapte le format : invitation → portrait, banniere pub → banner_wide, post social → square, billet → ticket.
- Le champ `description` doit contenir un texte accrocheur, bien redige, specifique au contexte (pas de placeholder).
- Inclure `badge` pour mettre en valeur l'info cle : GRATUIT, VIP, NOUVEAU, PROMO, EXCLUSIF, SOLD OUT.
- Remplis TOUS les champs pertinents : date, heure, lieu, prix, organisateur, contact, hashtags.
- Pour les billets (`ticket`), le champ `contact` sert de numero de billet (ex: "#A-0247").
- Pour les certificats, le champ `badge` contient le type (ex: "MENTION TRES BIEN", "DISTINCTION").
"#
}
