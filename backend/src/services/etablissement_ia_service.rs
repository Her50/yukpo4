// ✅ Service IA d'extraction des infos d'un établissement scolaire
// Date : 2026-05-08
//
// Permet à un directeur d'école d'uploader plusieurs documents (brochure,
// règlement intérieur, plaquette, photos de panneaux, fichiers Word/Excel)
// et l'IA extrait toutes les infos pertinentes pour pré-remplir les 10 blocs
// de la page établissement (inscription, transport, cantine, perisco,
// internat, uniforme, calendrier, annonces, contacts, lauréats) + une
// description publique attractive.

use crate::core::types::AppResult;
use crate::services::app_ia::AppIA;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Arc;

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct EtablissementExtraction {
    /// Description publique courte (2-4 phrases, ton accueillant pour parents)
    #[serde(default)]
    pub description: Option<String>,

    /// Bloc inscription : frais_inscription, frais_scolarite_annuel,
    /// modalites_paiement, documents_requis (array)
    #[serde(default)]
    pub inscription: Value,

    /// Bloc transport : lignes (array), tarif_trimestre, tarif_annee, horaires, contact
    #[serde(default)]
    pub transport: Value,

    /// Bloc cantine : tarif_forfait_mensuel, tarif_ticket, menu_semaine (array),
    /// regimes_speciaux (array)
    #[serde(default)]
    pub cantine: Value,

    /// Bloc perisco : activites (array), tarif_trimestre, horaires
    #[serde(default)]
    pub perisco: Value,

    /// Bloc internat : tarif_trimestre, tarif_annee, reglement, trousseau_requis (array)
    #[serde(default)]
    pub internat: Value,

    /// Bloc uniforme : description, fournisseur, tarif_indicatif
    #[serde(default)]
    pub uniforme: Value,

    /// Bloc contacts : secretariat_telephone, secretariat_email, directeur,
    /// directeur_telephone, vie_scolaire, infirmerie
    #[serde(default)]
    pub contacts: Value,

    /// Bloc laureats : description, partenaires (array)
    #[serde(default)]
    pub laureats: Value,

    /// Calendrier extrait : array d'événements
    /// {titre, description?, type_event?, date_debut, date_fin?, classe_concernee?}
    #[serde(default)]
    pub evenements: Vec<Value>,

    /// Annonces extraites (rares dans les documents officiels mais possible)
    #[serde(default)]
    pub annonces: Vec<Value>,

    /// Listes scolaires détectées par classe (si présentes dans les docs)
    /// {classe: "6ème", articles: [{titre, auteur, editeur, type, prix_officiel?, est_obligatoire}]}
    #[serde(default)]
    pub listes_scolaires: Vec<Value>,

    /// Métadonnées : nom_etablissement détecté, type, ville, GPS si visibles
    #[serde(default)]
    pub meta: Value,

    /// Score de confiance global (0..1)
    #[serde(default)]
    pub confidence: f64,

    /// Notes IA en cas de document partiel ou ambigu
    #[serde(default)]
    pub notes: Option<String>,
}

pub struct EtablissementIAService {
    app_ia: Arc<AppIA>,
}

impl EtablissementIAService {
    pub fn new(app_ia: Arc<AppIA>) -> Self {
        Self { app_ia }
    }

    /// Analyse 1 ou plusieurs documents (PDF, image, Word, Excel — en base64)
    /// et retourne une structure complète prête à remplir les 10 blocs.
    pub async fn extract_etablissement_info(
        &self,
        files_base64: &[String],
        nom_etablissement_hint: Option<&str>,
    ) -> AppResult<EtablissementExtraction> {
        let nom_hint = nom_etablissement_hint.unwrap_or("(non précisé)");

        let prompt = format!(
            r#"Tu es un assistant d'IA spécialisé dans la digitalisation des établissements scolaires africains. \
On te fournit un ou plusieurs documents bruts d'un établissement (brochure, règlement intérieur, plaquette, \
fiche d'inscription, lettre aux parents, programme officiel, photo de panneau, etc.). Ces documents peuvent \
être en français, anglais ou langue locale, scannés, manuscrits, partiellement flous, multi-pages. \
Ton objectif : extraire EXHAUSTIVEMENT toutes les informations utiles à la construction de la PAGE PUBLIQUE \
de cet établissement sur la plateforme Yukpo Bourse du Livre.

Nom déclaré (indicatif) : {nom_hint}

RÈGLES :
1. Lis tous les documents fournis comme une seule source d'information cohérente. Recoupe et déduplique.
2. Quand un champ est ambigu ou absent, laisse-le `null` plutôt que d'inventer.
3. Ne traduis pas les libellés tels qu'ils figurent dans les documents (uniformes, manuels, accessoires).
4. Capture aussi les éléments rares ou inhabituels (parcours sportif, partenariats internationaux, jumelages, \
   accréditations, prix obtenus, traditions de l'école…) — ils peuvent enrichir la page publique.
5. Si tu vois un programme scolaire (manuels par classe), extrait-le dans `listes_scolaires` avec un objet par classe.
6. Pour les dates du calendrier scolaire, si une année n'est pas explicite, déduis-la (rentrée probablement août/septembre 2026).
7. Sois fidèle à l'orthographe / aux abréviations / aux unités telles qu'écrites.

FORMAT DE SORTIE — JSON STRICT (pas de texte avant ou après, pas de balises markdown) :
{{
  "description": "string ou null  (2-4 phrases publiques, ton accueillant)",
  "meta": {{
    "nom_etablissement": "string ou null",
    "type_etablissement": "primaire | secondaire | superieur | mixte ou null",
    "ville": "string ou null",
    "quartier": "string ou null",
    "adresse": "string ou null",
    "telephone": "string ou null",
    "email": "string ou null",
    "site_web": "string ou null",
    "annee_creation": "string ou null",
    "devise_locale": "FCFA | XAF | XOF | EUR ou null",
    "specialites": ["string", ...] // optionnel : sciences, lettres, art…
  }},
  "inscription": {{
    "frais_inscription": "nombre ou null  (en devise locale)",
    "frais_scolarite_annuel": "nombre ou null",
    "frais_scolarite_trimestre": "nombre ou null",
    "modalites_paiement": "string ou null",
    "documents_requis": ["string", ...],
    "dates_inscription": "string ou null",
    "contact_inscription": "string ou null"
  }},
  "transport": {{
    "lignes": ["string", ...],
    "tarif_trimestre": "nombre ou null",
    "tarif_annee": "nombre ou null",
    "horaires": "string ou null",
    "contact": "string ou null"
  }},
  "cantine": {{
    "tarif_forfait_mensuel": "nombre ou null",
    "tarif_ticket": "nombre ou null",
    "menu_semaine": ["string", ...],
    "regimes_speciaux": ["string", ...]
  }},
  "perisco": {{
    "activites": ["string", ...],
    "tarif_trimestre": "nombre ou null",
    "horaires": "string ou null"
  }},
  "internat": {{
    "tarif_trimestre": "nombre ou null",
    "tarif_annee": "nombre ou null",
    "reglement": "string ou null",
    "trousseau_requis": ["string", ...]
  }},
  "uniforme": {{
    "description": "string ou null",
    "fournisseur": "string ou null",
    "tarif_indicatif": "nombre ou null"
  }},
  "contacts": {{
    "secretariat_telephone": "string ou null",
    "secretariat_email": "string ou null",
    "directeur": "string ou null",
    "directeur_telephone": "string ou null",
    "vie_scolaire": "string ou null",
    "infirmerie": "string ou null"
  }},
  "laureats": {{
    "description": "string ou null",
    "partenaires": ["string", ...]
  }},
  "evenements": [
    {{
      "titre": "string",
      "description": "string ou null",
      "type_event": "examen | reunion | vacances | sortie | fete | rentree | autre",
      "date_debut": "ISO 8601 (YYYY-MM-DDTHH:MM:SSZ)",
      "date_fin": "ISO 8601 ou null",
      "classe_concernee": "string ou null"
    }}
  ],
  "annonces": [
    {{
      "titre": "string",
      "contenu": "string"
    }}
  ],
  "listes_scolaires": [
    {{
      "classe": "string  (ex: 6ème, CE2, Form 4)",
      "annee_scolaire": "string  (ex: 2026-2027)",
      "articles": [
        {{
          "titre": "string",
          "auteur": "string ou null",
          "editeur": "string ou null",
          "matiere": "string ou null",
          "type": "livre | workbook | cahier | fourniture | accessoire",
          "prix_officiel": "nombre ou null",
          "est_obligatoire": true,
          "quantite_defaut": 1
        }}
      ]
    }}
  ],
  "confidence": 0.85,
  "notes": "string ou null  (mention si un document était partiel/illisible)"
}}

Important : retourne UNIQUEMENT le JSON ci-dessus, rien d'autre.
"#
        );

        // Appel IA multimodal avec timeout long pour traiter beaucoup de fichiers.
        // Le service AppIA gère lui-même son timeout interne — ici on utilise
        // l'appel multimodal qui accepte une liste d'images base64.
        let images: Vec<String> = files_base64.to_vec();
        let (_model, response, _tokens) =
            self.app_ia.predict_multimodal(&prompt, Some(images)).await?;

        // Parsing JSON tolérant : extraire le 1er objet { ... } trouvé dans
        // la réponse même si l'IA a ajouté du texte autour.
        let cleaned = strip_to_first_json_object(&response);
        let extraction: EtablissementExtraction = match serde_json::from_str(&cleaned) {
            Ok(v) => v,
            Err(e) => {
                log::warn!(
                    "[EtablissementIAService] JSON parse fallback (raw={} chars): {}",
                    response.len(),
                    e
                );
                EtablissementExtraction {
                    description: None,
                    notes: Some(format!(
                        "Extraction partielle — le JSON IA n'a pas pu être parsé. Brut : {}",
                        if response.len() > 500 {
                            format!("{}…", &response[..500])
                        } else {
                            response.clone()
                        }
                    )),
                    confidence: 0.0,
                    ..Default::default()
                }
            }
        };

        Ok(extraction)
    }
}

/// Renvoie la sous-chaîne du premier objet JSON `{ ... }` équilibré dans
/// le texte (utile quand l'IA renvoie du markdown autour).
fn strip_to_first_json_object(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut start: Option<usize> = None;
    let mut depth = 0i32;
    let mut in_string = false;
    let mut escape = false;
    for (i, &b) in bytes.iter().enumerate() {
        if escape {
            escape = false;
            continue;
        }
        if in_string {
            if b == b'\\' {
                escape = true;
            } else if b == b'"' {
                in_string = false;
            }
            continue;
        }
        if b == b'"' {
            in_string = true;
            continue;
        }
        if b == b'{' {
            if start.is_none() {
                start = Some(i);
            }
            depth += 1;
        } else if b == b'}' {
            depth -= 1;
            if depth == 0 {
                if let Some(st) = start {
                    return s[st..=i].to_string();
                }
            }
        }
    }
    s.to_string()
}
