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
///
/// ⚠️ Conformité réglementaire : pour les médicaments soumis à prescription
/// médicale obligatoire, le frontend masque les champs chiffrés (dosage,
/// frequency, duration) et n'affiche qu'un message d'orientation vers le
/// pharmacien. La classification est faite par l'IA via le champ
/// `requires_prescription` ; en cas de doute, le service force `true` (plus
/// prudent juridiquement que de donner par défaut une posologie).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DosageRecommendation {
    pub dosage: String,
    pub frequency: String,
    pub duration: String,
    pub precautions: Vec<String>,
    pub warnings: Vec<String>,
    #[serde(default = "default_requires_prescription")]
    pub requires_prescription: bool,
}

fn default_requires_prescription() -> bool {
    // Défaut prudent : si l'IA ne renvoie pas le champ, on considère que le
    // médicament est soumis à prescription. Mieux vaut un faux positif qu'une
    // fausse autorisation de posologie sans ordonnance.
    true
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

        // ⚠️ Prompt cadré : Yukpo n'est PAS un avis médical, juste un
        // aide-mémoire factuel basé sur les interactions documentées dans les
        // bases publiques (notices fabricants, ANSM, OMS). En cas de major/
        // contraindicated, on impose une recommandation de consultation
        // immédiate. La décision finale revient au pharmacien.
        let prompt = format!(
            r#"
Tu es un assistant d'information pharmaceutique pour Yukpo. Tu n'es PAS un médecin
ni un pharmacien. Tes réponses sont strictement INDICATIVES, basées sur les
interactions médicamenteuses DOCUMENTÉES dans les notices fabricants et bases
publiques (ANSM, OMS, FDA). Tu ne donnes JAMAIS de prescription.

CONTEXTE :
- Médicaments : {}
- Âge du patient : {}
- Conditions médicales : {}

NIVEAUX DE SÉVÉRITÉ :
- "contraindicated" : Combinaison contre-indiquée — recommander consultation immédiate
- "major"           : Interaction majeure — surveillance médicale requise
- "moderate"        : Interaction modérée — précautions recommandées
- "minor"           : Interaction mineure — généralement acceptable
- "none"            : Aucune interaction documentée

INSTRUCTIONS :
- Reste factuel : cite l'interaction documentée, sans diagnostic du patient.
- Pour "major" ou "contraindicated" → la `recommendation` DOIT inclure
  « Consultez immédiatement votre pharmacien ou médecin avant toute prise ».
- `alternative_suggestions` : noms communs (DCI), pas de marques précises sauf
  si elles sont des génériques OTC bien connus.
- Si tu ne connais pas l'interaction → `severity: "none"` et description
  « Aucune interaction documentée dans nos sources — vérifiez avec votre
  pharmacien ».

RÉPONSE ATTENDUE (JSON strict, sans markdown) :
{{
    "severity": "moderate",
    "description": "Description factuelle et brève de l'interaction documentée",
    "recommendation": "Recommandation neutre, orientée pharmacien/médecin",
    "alternative_suggestions": ["DCI alternative 1", "DCI alternative 2"]
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

        // ⚠️ Prompt prudent : on demande à l'IA de classifier "prescription
        // obligatoire" vs "OTC" pour que le frontend masque la posologie chiffrée
        // des médicaments à prescription. On insiste sur le caractère indicatif
        // et le refus de poser des chiffres pour les enfants sans données.
        let prompt = format!(
            r#"
Tu es un assistant d'information pharmaceutique pour Yukpo. Tu n'es PAS un médecin
ni un pharmacien et tes réponses sont strictement INDICATIVES, fondées sur les
notices grand public des fabricants. La responsabilité de la prescription reste
au prescripteur. Reste neutre et factuel.

CONTEXTE :
- Médicament : {}
- Âge : {} ans
- Poids : {} kg
- Condition médicale : {}

CLASSIFICATION OBLIGATOIRE (champ `requires_prescription`) :
- true  → médicament soumis à prescription médicale dans la plupart des juridictions
           (antibiotiques, anxiolytiques, corticoïdes systémiques, opioïdes,
           anticancéreux, anticoagulants, antidiabétiques, antihypertenseurs, etc.)
- false → médicament de vente libre / OTC (paracétamol, ibuprofène ≤ 400 mg sans
           ordonnance, antiacides, sirops contre la toux grand public, vitamines…)
En cas de doute → mets `true` (refuser de donner posologie est plus prudent).

INSTRUCTIONS :
- Si `requires_prescription` = true → renseigne dosage/frequency/duration avec
  "Sur ordonnance — voir prescripteur" et laisse precautions et warnings vides
  (le frontend masquera ces champs).
- Si `requires_prescription` = false → donne la posologie ADULTE STANDARD selon
  la notice fabricant publique. Pour les enfants (< 12 ans), ajoute toujours dans
  warnings : "Posologie pédiatrique : consulter obligatoirement un pharmacien".
- Toujours inclure dans warnings : "Information indicative, à confirmer avec
  votre pharmacien".

RÉPONSE ATTENDUE (JSON strict, sans markdown) :
{{
    "dosage": "500 mg",
    "frequency": "2 à 3 fois par jour",
    "duration": "Jusqu'à 5 jours",
    "precautions": ["À prendre au cours des repas", "Éviter l'alcool"],
    "warnings": ["Information indicative, à confirmer avec votre pharmacien"],
    "requires_prescription": false
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

        // Parser la réponse JSON. En cas d'échec, on retourne un fallback
        // CONSERVATEUR (requires_prescription: true) qui force le frontend à
        // masquer la posologie chiffrée — meilleure protection que d'afficher
        // une recommandation par défaut potentiellement inadaptée.
        let dosage: DosageRecommendation = match serde_json::from_str(&response) {
            Ok(d) => d,
            Err(e) => {
                log::warn!("[PharmacyAIService] Erreur parsing JSON dosage: {}", e);
                DosageRecommendation {
                    dosage: "Sur conseil pharmacien".to_string(),
                    frequency: "Selon ordonnance".to_string(),
                    duration: "Selon ordonnance".to_string(),
                    precautions: vec![],
                    warnings: vec![
                        "Information indicative, à confirmer avec votre pharmacien".to_string()
                    ],
                    requires_prescription: true,
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

/// Métadonnées extraites de l'en-tête d'une ordonnance (patient, prescripteur,
/// établissement). Utiles pour l'archivage côté pharmacien : le pharmacien
/// scanne l'ordonnance reçue, l'IA extrait nom du patient + médecin + hôpital
/// + ville, et le pharmacien peut retrouver l'ordonnance plus tard en
/// recherchant par nom de patient.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct OrdonnanceMetadata {
    pub patient_name: Option<String>,
    pub doctor_name: Option<String>,
    /// Numéro d'ordre / matricule professionnel du médecin (Ordre des
    /// Médecins du Cameroun ou équivalent). Souvent imprimé sur l'en-tête
    /// ou à côté de la signature. Utile pour :
    ///   - vérifier l'authenticité de l'ordonnance
    ///   - tracer les médecins prescripteurs (analytics)
    ///   - en cas de litige / pharmacovigilance
    pub doctor_id_number: Option<String>,
    pub hospital: Option<String>,
    pub city: Option<String>,
    pub prescription_date: Option<String>,
}

/// Résultat complet d'extraction d'une ordonnance par IA.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ExtractedOrdonnance {
    pub medications: Vec<ExtractedMedication>,
    pub metadata: OrdonnanceMetadata,
}

impl PharmacyAIService {
    /// Extrait les médicaments d'une image d'ordonnance via IA multimodale.
    /// Wrapper qui retourne uniquement la liste de médicaments (compat ascendante).
    pub async fn extract_ordonnance_medications(
        &self,
        image_base64: &str,
        lat: Option<f64>,
        lng: Option<f64>,
    ) -> AppResult<Vec<ExtractedMedication>> {
        let full = self.extract_ordonnance_full(image_base64, lat, lng).await?;
        Ok(full.medications)
    }

    /// Extraction complète : médicaments + métadonnées de l'ordonnance.
    /// Utilisée par l'endpoint extract-ordonnance qui retourne les deux au
    /// frontend (pharmacien : pré-remplissage formulaire d'archivage).
    pub async fn extract_ordonnance_full(
        &self,
        image_base64: &str,
        lat: Option<f64>,
        lng: Option<f64>,
    ) -> AppResult<ExtractedOrdonnance> {
        // Contexte géographique dynamique basé sur la position de l'utilisateur
        let geo_context = match (lat, lng) {
            (Some(la), Some(lo)) => {
                // Détermination approximative de la région à partir des coordonnées
                let region = if la > -35.0 && la < 37.5 && lo > -17.5 && lo < 51.0 {
                    // Afrique
                    if la > 0.0 && lo > 8.0 && lo < 16.0 {
                        "Afrique centrale (Cameroun, Gabon, Congo, RCA)"
                    } else if la > 10.0 && la < 20.0 && lo > -17.5 && lo < 5.0 {
                        "Afrique de l'Ouest (Sénégal, Mali, Guinée, Côte d'Ivoire, Burkina Faso)"
                    } else if la > 4.0 && la < 15.0 && lo > 0.0 && lo < 15.0 {
                        "Afrique de l'Ouest (Nigeria, Ghana, Bénin, Togo)"
                    } else if la < 0.0 && lo < 20.0 {
                        "Afrique centrale / Afrique de l'Est (RDC, Angola, Tanzanie, Kenya)"
                    } else if la > 20.0 && lo > 25.0 {
                        "Afrique du Nord / Moyen-Orient (Égypte, Libye, Soudan)"
                    } else {
                        "Afrique subsaharienne"
                    }
                } else if la > 35.0 && lo > -10.0 && lo < 45.0 {
                    "Europe"
                } else if la > 15.0 && lo > 60.0 && lo < 150.0 {
                    "Asie du Sud / Asie du Sud-Est"
                } else if la < -10.0 && lo > 100.0 {
                    "Océanie / Pacifique"
                } else if lo < -30.0 {
                    "Amériques"
                } else {
                    "Monde"
                };
                format!(
                    "L'utilisateur se trouve à une latitude de {:.2}° et une longitude de {:.2}°, région probable : {}. ",
                    la, lo, region
                )
            }
            _ => String::new(),
        };

        let prompt = format!(
            r#"
Tu es un pharmacien expert en extraction d'ordonnances médicales pour la plateforme Yukpo.

CONTEXTE GÉOGRAPHIQUE :
{}Les ordonnances peuvent provenir du monde entier (Afrique subsaharienne, Europe, Asie, Amériques, etc.).
Adapte ta connaissance des médicaments à la région détectée : noms commerciaux locaux, DCI internationales, noms génériques.

CONTEXTE IMPORTANT :
- L'image peut être une ordonnance médicale manuscrite ou imprimée
- L'image peut aussi être la photo d'un emballage / boîte de médicament
- ATTENTION : les médecins ont très souvent une écriture manuscrite difficile à lire (illisible, petite, stylisée). Tu dois faire un effort maximal de déchiffrage même sur les écritures les plus compliquées.
- Les noms peuvent être en DCI (dénomination commune internationale), en noms commerciaux locaux, ou abrégés
- L'orthographe peut être phonétique ou approximative (ex : "paracetamol", "amoxiciline", "ibuprofene")
- Médicaments courants à reconnaître (liste non exhaustive) : Paracétamol/Doliprane/Efferalgan, Amoxicilline/Clamoxyl, Ibuprofène/Advil/Nurofen, Cotrimoxazole/Bactrim, Métronidazole/Flagyl, Oméprazole/Mopral, Azithromycine/Zithromax, Ciprofloxacine/Ciflox, Doxycycline, Artémether-Luméfantrine/Coartem, Salbutamol/Ventoline, Amlodipine, Metformine/Glucophage, Diclofénac/Voltarène, Tramadol, Prednisolone, Cétirizine/Zyrtec, Loratadine/Clarityne, Fluconazole/Triflucan, Clotrimazole/Canesten, etc.

TÂCHE : Analyse l'image et identifie TOUS les médicaments visibles, même partiellement lisibles.

RÈGLES D'EXTRACTION :
1. Déchiffre l'écriture avec le maximum d'effort — même sur des écritures très difficiles, propose toujours le nom médical le plus probable
2. Pour les noms partiellement lisibles : propose le nom complet le plus probable (ex : "Amoxici..." → "Amoxicilline")
3. Corrige les orthographes phonétiques ou approximatives vers le nom médical standard
4. Extrait le dosage si visible (ex: "500mg", "250mg/5ml")
5. Extrait la quantité si précisée (boîtes, comprimés, flacons)
6. Extrait la posologie si présente (fréquence, durée, mode d'administration)
7. Si c'est un emballage : extrait le nom du médicament principal et son dosage
8. N'omets aucun médicament visible, même si tu n'as qu'une partie du nom

RÉPONSE ATTENDUE (JSON strict, tableau, SANS texte autour) :
[
  {{
    "name": "Amoxicilline",
    "dosage": "500mg",
    "quantity": 21,
    "posologie": "1 comprimé 3 fois par jour pendant 7 jours"
  }},
  {{
    "name": "Paracétamol",
    "dosage": "1000mg",
    "quantity": 16,
    "posologie": "1 comprimé toutes les 6 heures si douleur"
  }}
]

IMPORTANT :
- Réponds UNIQUEMENT avec le tableau JSON, rien d'autre
- Si vraiment aucun médicament n'est identifiable (image totalement illisible, hors sujet), retourne : []
- Ne mets JAMAIS de texte avant ou après le JSON
- Ne mets JAMAIS de balises markdown ```json``` autour du JSON
"#,
            geo_context
        );

        let (model_name, response, tokens) = self
            .app_ia
            .predict_multimodal_ocr(&prompt, Some(vec![image_base64.to_string()]))
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

        // Le LLM peut retourner soit un objet {medications, metadata} (nouveau
        // format), soit un array (ancien format). On essaie l'objet d'abord.
        let cleaned_obj = clean_json_response(&response);
        let parsed_full: Option<ExtractedOrdonnance> = serde_json::from_str(&cleaned_obj).ok();

        let extracted = if let Some(full) = parsed_full {
            full
        } else {
            // Fallback ancien format : array seulement
            let medications: Vec<ExtractedMedication> = match serde_json::from_str(&json_str) {
                Ok(meds) => meds,
                Err(e) => {
                    log::warn!(
                        "[PharmacyAIService] Erreur parsing ordonnance JSON: {}. json_str: '{}', réponse brute: '{}'",
                        e,
                        &json_str[..json_str.len().min(300)],
                        &response[..response.len().min(300)]
                    );
                    Self::extract_medications_from_text(&response)
                }
            };
            ExtractedOrdonnance {
                medications,
                metadata: OrdonnanceMetadata::default(),
            }
        };

        log::info!(
            "[PharmacyAIService] Extraction : {} médicament(s), patient={:?}, médecin={:?}",
            extracted.medications.len(),
            extracted.metadata.patient_name,
            extracted.metadata.doctor_name
        );

        Ok(extracted)
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

/// Extrait le premier tableau JSON d'une réponse IA.
/// Si la réponse est un objet unique `{...}`, le wrap dans `[{...}]`.
fn extract_json_array(text: &str) -> String {
    // Cas 1 : tableau JSON → extraire [...]
    if let Some(start) = text.find('[') {
        if let Some(end) = text.rfind(']') {
            if end > start {
                return text[start..=end].to_string();
            }
        }
    }
    // Cas 2 : objet JSON unique `{...}` → wrapper dans un tableau
    if let Some(start) = text.find('{') {
        if let Some(end) = text.rfind('}') {
            if end > start {
                let obj = &text[start..=end];
                return format!("[{}]", obj);
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
