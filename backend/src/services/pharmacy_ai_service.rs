//! ✅ Service IA pour Pharmacies
//!
//! Ce service utilise l'IA pour :
//! - Vérifier les interactions médicamenteuses
//! - Recommander des posologies
//! - Suggérer des alternatives si médicament indisponible
//! - Donner des conseils pharmaceutiques personnalisés

use crate::core::types::AppResult;
use crate::services::app_ia::AppIA;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

/// Analyse d'interactions médicamenteuses
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MedicationInteraction {
    pub severity: String, // "contraindicated", "major", "moderate", "minor", "none"
    pub description: String,
    pub recommendation: String,
    pub alternative_suggestions: Vec<String>,
}

/// Recommandation de posologie
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DosageRecommendation {
    pub dosage: String,
    pub frequency: String,
    pub duration: String,
    pub precautions: Vec<String>,
    pub warnings: Vec<String>,
}

/// Alternative médicamenteuse
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MedicationAlternative {
    pub name: String,
    pub dci: Option<String>,
    pub reason: String,
    pub similarity_score: f32, // 0.0-1.0
}

/// Service IA pour Pharmacies
pub struct PharmacyAIService {
    app_ia: Arc<AppIA>,
}

impl PharmacyAIService {
    pub fn new(app_ia: Arc<AppIA>) -> Self {
        Self { app_ia }
    }

    /// Vérifie les interactions médicamenteuses
    pub async fn check_medication_interactions(
        &self,
        medications: Vec<String>,
        age: Option<i32>,
        medical_conditions: Option<Vec<String>>,
    ) -> AppResult<MedicationInteraction> {
        let medications_str = medications.join(", ");
        let age_str = age.map(|a| a.to_string()).unwrap_or_else(|| "Non spécifié".to_string());
        let conditions_str = medical_conditions
            .as_ref()
            .map(|c| c.join(", "))
            .unwrap_or_else(|| "Non spécifiées".to_string());

        let prompt = format!(
            r#"
Tu es un pharmacien expert en interactions médicamenteuses pour Yukpo.

CONTEXTE :
- Médicaments : {}
- Âge du patient : {}
- Conditions médicales : {}

TON RÔLE :
- Analyser les interactions entre les médicaments
- Identifier les contre-indications
- Proposer des alternatives si nécessaire
- Donner des recommandations de sécurité

NIVEAUX DE SÉVÉRITÉ :
- "contraindicated" : Contre-indiqué, ne pas prendre ensemble
- "major" : Interaction majeure, nécessite surveillance médicale
- "moderate" : Interaction modérée, précautions recommandées
- "minor" : Interaction mineure, généralement acceptable
- "none" : Aucune interaction connue

RÉPONSE ATTENDUE (JSON strict) :
{{
    "severity": "moderate",
    "description": "Description de l'interaction",
    "recommendation": "Recommandation pour le patient",
    "alternative_suggestions": ["Médicament alternatif 1", "Médicament alternatif 2"]
}}
"#,
            medications_str, age_str, conditions_str
        );

        let (model_name, response, tokens) = self.app_ia.predict(&prompt).await?;
        log::info!(
            "[PharmacyAIService] Interactions vérifiées avec {} (tokens: {})",
            model_name,
            tokens
        );

        // Parser la réponse JSON
        let interaction: MedicationInteraction = match serde_json::from_str(&response) {
            Ok(i) => i,
            Err(e) => {
                log::warn!(
                    "[PharmacyAIService] Erreur parsing JSON, utilisation réponse basique: {}",
                    e
                );
                MedicationInteraction {
                    severity: "none".to_string(),
                    description: "Vérification des interactions en cours.".to_string(),
                    recommendation: "Consultez votre pharmacien pour confirmation.".to_string(),
                    alternative_suggestions: vec![],
                }
            }
        };

        Ok(interaction)
    }

    /// Recommande une posologie adaptée
    pub async fn suggest_medication_dosage(
        &self,
        medication_name: &str,
        age: Option<i32>,
        weight: Option<f32>,
        medical_condition: Option<&str>,
    ) -> AppResult<DosageRecommendation> {
        let age_str = age.map(|a| a.to_string()).unwrap_or_else(|| "Non spécifié".to_string());
        let weight_str =
            weight.map(|w| w.to_string()).unwrap_or_else(|| "Non spécifié".to_string());
        let condition_str = medical_condition.unwrap_or("Non spécifiée");

        let prompt = format!(
            r#"
Tu es un pharmacien expert en posologie pour Yukpo.

CONTEXTE :
- Médicament : {}
- Âge : {} ans
- Poids : {} kg
- Condition médicale : {}

TON RÔLE :
- Recommander une posologie adaptée au patient
- Donner des précautions d'emploi
- Mettre en garde contre les effets secondaires possibles

IMPORTANT :
- Respecter les posologies standard selon l'âge et le poids
- Adapter selon les conditions médicales
- Toujours recommander de suivre l'ordonnance du médecin

RÉPONSE ATTENDUE (JSON strict) :
{{
    "dosage": "500mg",
    "frequency": "2 fois par jour",
    "duration": "7 jours",
    "precautions": ["Prendre avec les repas", "Éviter l'alcool"],
    "warnings": ["Peut causer somnolence"]
}}
"#,
            medication_name, age_str, weight_str, condition_str
        );

        let (model_name, response, tokens) = self.app_ia.predict(&prompt).await?;
        log::info!(
            "[PharmacyAIService] Posologie suggérée avec {} (tokens: {})",
            model_name,
            tokens
        );

        // Parser la réponse JSON
        let dosage: DosageRecommendation = match serde_json::from_str(&response) {
            Ok(d) => d,
            Err(e) => {
                log::warn!("[PharmacyAIService] Erreur parsing JSON: {}", e);
                DosageRecommendation {
                    dosage: "Consultez votre médecin".to_string(),
                    frequency: "Selon prescription".to_string(),
                    duration: "Selon prescription".to_string(),
                    precautions: vec![],
                    warnings: vec![],
                }
            }
        };

        Ok(dosage)
    }

    /// Suggère des alternatives si médicament indisponible
    pub async fn suggest_medication_alternatives(
        &self,
        unavailable_medication: &str,
        purpose: Option<&str>,
        allergies: Option<Vec<String>>,
    ) -> AppResult<Vec<MedicationAlternative>> {
        let purpose_str = purpose.unwrap_or("Non spécifiée");
        let allergies_str = allergies
            .as_ref()
            .map(|a| a.join(", "))
            .unwrap_or_else(|| "Aucune connue".to_string());

        let prompt = format!(
            r#"
Tu es un pharmacien expert en alternatives médicamenteuses pour Yukpo.

CONTEXTE :
- Médicament indisponible : {}
- But du traitement : {}
- Allergies connues : {}

TON RÔLE :
- Proposer des alternatives médicamenteuses équivalentes
- Vérifier les allergies et contre-indications
- Expliquer les différences éventuelles

IMPORTANT :
- Toujours vérifier avec le médecin avant substitution
- Respecter les contre-indications
- Proposer des médicaments avec le même principe actif si possible

RÉPONSE ATTENDUE (JSON strict) :
{{
    "alternatives": [
        {{
            "name": "Nom médicament",
            "dci": "DCI du médicament",
            "reason": "Pourquoi cette alternative",
            "similarity_score": 0.95
        }}
    ]
}}
"#,
            unavailable_medication, purpose_str, allergies_str
        );

        let (model_name, response, tokens) = self.app_ia.predict(&prompt).await?;
        log::info!(
            "[PharmacyAIService] Alternatives suggérées avec {} (tokens: {})",
            model_name,
            tokens
        );

        // Parser la réponse JSON
        let alternatives: Vec<MedicationAlternative> =
            match serde_json::from_str::<serde_json::Value>(&response) {
                Ok(v) => {
                    if let Some(alts) = v.get("alternatives").and_then(|a| a.as_array()) {
                        alts.iter().filter_map(|a| serde_json::from_value(a.clone()).ok()).collect()
                    } else {
                        vec![]
                    }
                }
                Err(e) => {
                    log::warn!("[PharmacyAIService] Erreur parsing alternatives: {}", e);
                    vec![]
                }
            };

        Ok(alternatives)
    }
}

/// Médicament extrait d'une ordonnance par IA vision
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtractedMedication {
    pub name: String,
    pub dosage: Option<String>,
    pub quantity: Option<i32>,
    pub posologie: Option<String>,
}

impl PharmacyAIService {
    /// Extrait les médicaments d'une image d'ordonnance via IA multimodale
    pub async fn extract_ordonnance_medications(
        &self,
        image_base64: &str,
    ) -> AppResult<Vec<ExtractedMedication>> {
        let prompt = r#"
Tu es un pharmacien expert spécialisé dans les ordonnances d'Afrique subsaharienne (Cameroun, Sénégal, Côte d'Ivoire, Congo, etc.) pour la plateforme Yukpo.

CONTEXTE IMPORTANT :
- L'image peut être une ordonnance médicale manuscrite ou imprimée
- L'image peut aussi être la photo d'un emballage / boîte de médicament
- Les ordonnances africaines sont souvent manuscrites, avec une écriture difficile à lire
- Les noms peuvent être en français, en DCI (dénomination commune internationale), ou en noms commerciaux locaux
- L'orthographe peut être phonétique ou approximative (ex: "paracétamol" → "paracetamol", "amoxiciline" → "amoxicilline")
- Les médicaments courants dans la région : Paracétamol, Amoxicilline, Cotrimoxazole, Artémether-Luméfantrine (Coartem), Doxycycline, Métronidazole, Ibuprofène, Fer folate, Vitamine C, Oméprazole, Cétirizine, Loratadine, Salbutamol, Prednisolone, Dexaméthasone, Ampicilline, Gentamicine, Acide folique, Zinc, Mébendazole, Albendazole, Chloroquine, Quinine, Clotrimazole, Fluconazole, Amlodipine, Hydrochlorothiazide, Metformine, Insuline, Tramadol, Diclofénac, Kétoprofène, Ciprofloxacine, Érythromycine, Azithromycine, etc.

TÂCHE : Analyse l'image et identifie TOUS les médicaments visibles, même partiellement lisibles.

RÈGLES D'EXTRACTION :
1. Identifie chaque médicament même si l'écriture est difficile — fais de ton mieux pour déchiffrer
2. Pour les noms partiellement lisibles : propose le nom le plus probable (ex : "Amoxici..." → "Amoxicilline")
3. Corrige les orthographes phonétiques ou approximatives vers le nom médical standard
4. Extrait le dosage si visible (ex: "500mg", "250mg/5ml")
5. Extrait la quantité si précisée (boîte, comprimés, flacons)
6. Extrait la posologie si présente (fréquence, durée, mode d'administration)
7. Si c'est un emballage : extrait le nom du médicament principal et son dosage
8. N'omets aucun médicament visible, même si tu n'as qu'une partie du nom

RÉPONSE ATTENDUE (JSON strict, tableau, SANS texte autour) :
[
  {
    "name": "Amoxicilline",
    "dosage": "500mg",
    "quantity": 21,
    "posologie": "1 comprimé 3 fois par jour pendant 7 jours"
  },
  {
    "name": "Paracétamol",
    "dosage": "1000mg",
    "quantity": 16,
    "posologie": "1 comprimé toutes les 6 heures si douleur"
  }
]

IMPORTANT :
- Réponds UNIQUEMENT avec le tableau JSON, rien d'autre
- Si vraiment aucun médicament n'est identifiable (image totalement illisible, hors sujet), retourne : []
- Ne mets JAMAIS de texte avant ou après le JSON
- Ne mets JAMAIS de balises markdown ```json``` autour du JSON
"#;

        let (model_name, response, tokens) = self
            .app_ia
            .predict_multimodal(prompt, Some(vec![image_base64.to_string()]))
            .await?;

        log::info!(
            "[PharmacyAIService] Ordonnance analysée avec {} (tokens: {}), réponse brute: {}",
            model_name,
            tokens,
            &response[..response.len().min(500)]
        );

        // Nettoyer la réponse : retirer les balises markdown si présentes
        let cleaned = clean_json_response(&response);
        let json_str = extract_json_array(&cleaned);

        let medications: Vec<ExtractedMedication> = match serde_json::from_str(&json_str) {
            Ok(meds) => meds,
            Err(e) => {
                log::warn!(
                    "[PharmacyAIService] Erreur parsing ordonnance JSON: {}. json_str: '{}', réponse brute: '{}'",
                    e,
                    &json_str[..json_str.len().min(300)],
                    &response[..response.len().min(300)]
                );
                // Tentative de récupération : chercher des noms de médicaments dans le texte brut
                Self::extract_medications_from_text(&response)
            }
        };

        Ok(medications)
    }

    /// Fallback: tente d'extraire des noms de médicaments depuis une réponse texte libre de l'IA
    fn extract_medications_from_text(text: &str) -> Vec<ExtractedMedication> {
        // Mots-clés courants à ignorer
        let stop_words = [
            "médicament",
            "ordonnance",
            "patient",
            "médecin",
            "pharmacie",
            "liste",
            "voici",
            "identifié",
            "trouvé",
            "prescription",
            "traitement",
        ];

        let mut meds: Vec<ExtractedMedication> = Vec::new();
        for line in text.lines() {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }
            // Ignorer les lignes qui ressemblent à du JSON cassé ou du texte générique
            if line.starts_with('{')
                || line.starts_with('[')
                || line.starts_with(']')
                || line.starts_with('}')
            {
                continue;
            }
            if stop_words.iter().any(|w| line.to_lowercase().contains(w)) {
                continue;
            }
            // Heuristique : ligne courte (< 60 chars) sans ponctuation de phrase = probable nom de médicament
            if line.len() > 3 && line.len() < 60 && !line.ends_with('.') {
                // Nettoyer la ligne : retirer -, *, numéros de liste
                let name = line
                    .trim_start_matches(|c: char| {
                        c == '-' || c == '*' || c.is_ascii_digit() || c == '.' || c == ')'
                    })
                    .trim();
                if name.len() > 2 {
                    meds.push(ExtractedMedication {
                        name: name.to_string(),
                        dosage: None,
                        quantity: None,
                        posologie: None,
                    });
                }
            }
        }
        if !meds.is_empty() {
            log::info!(
                "[PharmacyAIService] Récupération texte brut: {} médicaments potentiels",
                meds.len()
            );
        }
        meds
    }
}

/// Retire les balises markdown ```json ... ``` et autres artefacts courants des réponses IA
fn clean_json_response(text: &str) -> String {
    let s = text.trim();
    // Retirer ```json ... ``` ou ``` ... ```
    if let Some(inner) = s.strip_prefix("```json").or_else(|| s.strip_prefix("```")) {
        if let Some(core) = inner.strip_suffix("```") {
            return core.trim().to_string();
        }
    }
    s.to_string()
}

/// Extrait le premier tableau JSON d'une réponse IA
fn extract_json_array(text: &str) -> String {
    // Chercher le premier '[' et le dernier ']' correspondant
    if let Some(start) = text.find('[') {
        if let Some(end) = text.rfind(']') {
            if end > start {
                return text[start..=end].to_string();
            }
        }
    }
    "[]".to_string()
}

/// Fonctions helper pour intégration facile dans les contrôleurs
pub async fn check_medication_interactions(
    app_ia: Arc<AppIA>,
    medications: Vec<String>,
) -> AppResult<String> {
    let service = PharmacyAIService::new(app_ia);
    let interaction = service.check_medication_interactions(medications, None, None).await?;

    Ok(interaction.recommendation)
}
