//! Service de génération de documents (PPTX / DOCX) depuis YukpoIA.
//!
//! Lorsque l'IA détecte dans la réponse un champ `document_generation`, ce service :
//! 1. Appelle le script Python `scripts/document_generator.py` en subprocess,
//! 2. Lui envoie l'outline JSON en stdin,
//! 3. Récupère les octets du document en stdout,
//! 4. Uploade via `media_storage_service` et retourne l'objet attachment.

use log::{error, info, warn};
use serde_json::{json, Value};
use std::process::Stdio;
use std::sync::Arc;
use tokio::io::AsyncWriteExt;
use tokio::process::Command;

use crate::{services::yukpo_ia_chat_enrich::upload_chat_attachment_blob, state::AppState};

/// Chemin vers le générateur Python (relatif au répertoire de travail du binaire).
/// En production (Docker), le binaire s'exécute depuis /app et les scripts sont dans /app/scripts/.
const PYTHON_SCRIPT: &str = "scripts/document_generator.py";

/// Si `true`, on cherche python3 d'abord, sinon python.
const PYTHON_CMD: &str = "python3";

/// Extension de fichier et MIME selon le type de document.
fn doc_meta(doc_type: &str) -> (&'static str, &'static str) {
    match doc_type.to_lowercase().as_str() {
        "docx" | "word" => (
            "docx",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ),
        _ => (
            "pptx",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ),
    }
}

/// Génère un document à partir d'un outline JSON et retourne un objet attachment.
///
/// `outline` doit contenir au minimum `document_type` et `title`.
/// Retourne `None` si la génération échoue (erreurs loguées).
pub async fn generate_document_attachment(
    state: &Arc<AppState>,
    user_id: i32,
    outline: &Value,
) -> Option<Value> {
    let doc_type = outline.get("document_type").and_then(|v| v.as_str()).unwrap_or("pptx");
    let title = outline.get("title").and_then(|v| v.as_str()).unwrap_or("document");

    let (ext, mime) = doc_meta(doc_type);
    let safe_title: String = title
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .take(60)
        .collect();
    let filename = format!("{}.{}", safe_title, ext);

    let json_input = match serde_json::to_vec(outline) {
        Ok(b) => b,
        Err(e) => {
            error!("[DocGen] serde outline: {}", e);
            return None;
        }
    };

    // Essaie python3 puis python
    let bytes = run_python_generator(json_input).await?;

    if bytes.is_empty() {
        warn!(
            "[DocGen] Python a retourné 0 octets pour user_id={}",
            user_id
        );
        return None;
    }

    info!(
        "[DocGen] Document généré ({} octets, {}) pour user_id={}",
        bytes.len(),
        filename,
        user_id
    );

    match upload_chat_attachment_blob(state, user_id, &bytes, &filename, mime).await {
        Ok(att) => Some(att),
        Err(e) => {
            error!("[DocGen] upload attachment: {}", e);
            None
        }
    }
}

/// Exécute `scripts/document_generator.py` avec l'outline JSON en stdin.
/// Retourne les octets stdout du document généré, ou `None` en cas d'erreur.
async fn run_python_generator(json_input: Vec<u8>) -> Option<Vec<u8>> {
    // Tente python3 puis python
    for cmd in &[PYTHON_CMD, "python"] {
        match try_python(cmd, &json_input).await {
            Ok(bytes) => return Some(bytes),
            Err(e) => {
                warn!("[DocGen] {} échoué: {}", cmd, e);
            }
        }
    }
    error!("[DocGen] Aucune commande Python disponible ou script en erreur");
    None
}

async fn try_python(cmd: &str, json_input: &[u8]) -> Result<Vec<u8>, String> {
    let mut child = Command::new(cmd)
        .arg(PYTHON_SCRIPT)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("spawn {}: {}", cmd, e))?;

    // Envoie le JSON en stdin
    if let Some(mut stdin) = child.stdin.take() {
        stdin.write_all(json_input).await.map_err(|e| format!("write stdin: {}", e))?;
        // Ferme stdin pour signaler EOF au script
    }

    let output = child.wait_with_output().await.map_err(|e| format!("wait_with_output: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!(
            "exit {:?} — stderr: {}",
            output.status.code(),
            stderr
        ));
    }

    Ok(output.stdout)
}

/// Détecte si la réponse JSON de l'IA contient un champ `document_generation`
/// et retourne l'outline extrait si présent.
pub fn extract_document_outline(body: &Value) -> Option<Value> {
    for key in &["document_generation", "document_outline"] {
        if let Some(dg) = body.get(*key) {
            if dg.is_object() {
                return Some(dg.clone());
            }
        }
    }
    None
}

/// Détecte si le message de l'utilisateur est une demande de génération de document,
/// pour augmenter le budget de tokens en conséquence.
pub fn is_document_generation_request(message: &str) -> bool {
    let m = message.to_lowercase();
    let doc_keywords = [
        "powerpoint",
        "présentation",
        "presentation",
        "pptx",
        "word",
        "docx",
        "rapport",
        "rapport pdf",
        "pdf",
        "génère",
        "genere",
        "créer un document",
        "creer un document",
        "générer un document",
        "generer un document",
        "faire un document",
        "rédige un rapport",
        "redige un rapport",
        "crée une présentation",
        "cree une presentation",
        "document téléchargeable",
        "document telechargeable",
        "slide",
        "diapo",
        "diaporama",
    ];
    doc_keywords.iter().any(|kw| m.contains(kw))
}

/// Fusionne les images logo/bannière de la requête utilisateur dans l'outline document.
/// Si l'utilisateur a joint une image dans le contexte, elle sera insérée comme logo.
pub fn inject_user_logo_into_outline(outline: &mut Value, context: &Option<serde_json::Value>) {
    let Some(ctx) = context else { return };
    // Cherche une image dans le contexte (format yukpo_ia_attachments ou data_base64)
    let img_b64 = ctx
        .get("logo_base64")
        .or_else(|| ctx.get("banner_base64"))
        .and_then(|v| v.as_str());
    let mime = ctx
        .get("logo_mime")
        .or_else(|| ctx.get("banner_mime"))
        .and_then(|v| v.as_str())
        .unwrap_or("image/png");

    if let (Some(b64), Some(obj)) = (img_b64, outline.as_object_mut()) {
        // Ne pas écraser si l'IA a déjà fourni un logo
        if !obj.contains_key("logo_base64") {
            obj.insert("logo_base64".to_string(), json!(b64));
            obj.insert("logo_mime".to_string(), json!(mime));
        }
    }
}

/// Instructions à injecter dans le system prompt pour activer la génération de documents.
pub fn document_generation_system_instructions() -> &'static str {
    r#"

=== GÉNÉRATION DE DOCUMENTS (PPTX / DOCX / PDF) ===
Si l'utilisateur demande de **créer / générer un document PowerPoint, une présentation, un fichier Word, un PDF ou un rapport téléchargeable**, tu DOIS inclure dans ta réponse JSON un champ `document_generation` avec l'outline COMPLET et DENSE du document.

⚠️ RÈGLES CRITIQUES — NE PAS ABRÉGER :
- GÉNÈRE un contenu EXHAUSTIF avec de VRAIES données, analyses et chiffres concrets (zéro placeholder).
- Utilise TOUS les tokens disponibles pour produire un document professionnel, riche et dense.
- NE PAS résumer ou abréger les slides/sections sous prétexte de longueur.
- Minimum : **8 slides** (PPTX), **5 sections** (DOCX/PDF) — mais vise le maximum utile.
- Chaque slide/section doit avoir du contenu substantiel : texte + bullets (3 à 8 par slide).
- Pour les tables : inclure au moins 5 lignes de données réelles.
- Pour les KPIs : inclure la valeur, le label ET la tendance (trend) ex: "+23%".

**Format PPTX :**
```json
{
  "message": "J'ai généré votre présentation complète. Téléchargez-la ci-dessous.",
  "type": "text",
  "document_generation": {
    "document_type": "pptx",
    "title": "Titre du document",
    "subtitle": "Sous-titre",
    "author": "Prénom Nom",
    "theme": "blue",
    "slides": [
      {"title": "Introduction", "layout": "content", "content": "Texte dense ici.", "bullets": ["Point détaillé 1", "Point détaillé 2", "Point détaillé 3"]},
      {"title": "KPIs", "layout": "kpi", "kpis": [{"value": "95%", "label": "Satisfaction client", "trend": "+5%"}, {"value": "3,2×", "label": "Croissance CA", "trend": "+220%"}]},
      {"title": "Analyse", "layout": "two_column", "left": "Ligne1\nLigne2\nLigne3", "right": "Ligne1\nLigne2\nLigne3"},
      {"title": "Données", "layout": "table", "table": {"headers": ["Critère", "2024", "2025", "2026"], "rows": [["Revenus", "800K", "1.2M", "2.1M"], ["Clients", "1200", "2800", "5400"]]}},
      {"title": "Conclusion", "layout": "content", "bullets": ["Recommandation 1", "Recommandation 2", "Prochaines étapes"]}
    ]
  }
}
```

**Format DOCX :**
```json
{
  "document_generation": {
    "document_type": "docx",
    "title": "Rapport",
    "subtitle": "Sous-titre",
    "author": "Auteur",
    "theme": "blue",
    "sections": [
      {"heading": "Introduction", "level": 1, "paragraphs": ["Texte long et dense..."], "bullets": ["Point 1", "Point 2"]},
      {"heading": "Analyse", "level": 1, "paragraphs": ["Analyse approfondie..."], "table": {"headers": ["Indicateur", "Valeur", "Tendance"], "rows": [["CA", "1 200 000 FCFA", "+23%"]]}}
    ]
  }
}
```

**Format PDF :**
```json
{
  "document_generation": {
    "document_type": "pdf",
    "title": "Rapport",
    "theme": "blue",
    "pages": [
      {"title": "Contexte", "layout": "content", "content": "Texte dense...", "bullets": ["Point 1"]},
      {"title": "KPIs", "layout": "kpi", "kpis": [{"value": "95%", "label": "Satisfaction", "trend": "+5%"}]},
      {"title": "Données", "layout": "table", "table": {"headers": ["Mois", "CA"], "rows": [["Jan", "1.2M"]]}}
    ]
  }
}
```

**Thèmes disponibles :** `blue` (défaut), `green`, `purple`, `orange`, `dark`, `light`.
**Layouts PPTX :** `content`, `title`, `two_column`, `kpi`, `table`, `image`, `blank`.
**Layouts PDF :** `content`, `kpi`, `table`, `cover`.
"#
}
