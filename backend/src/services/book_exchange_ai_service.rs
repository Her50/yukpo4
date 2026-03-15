//! ✅ Service IA pour Bourse du Livre
//!
//! Ce service utilise l'IA pour :
//! - Recommander des livres basés sur classe/matière
//! - Matching intelligent besoins/offres
//! - Suggestions prix basées sur marché
//! - Analyse de compatibilité échanges

use crate::core::types::AppResult;
use crate::services::app_ia::AppIA;
use crate::services::ia::prompt_loader::load_prompt_section_with_vars;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;

/// Calcule la classe immédiatement supérieure dans le système camerounais/francophone.
/// Hiérarchie: SIL → CP → CE1 → CE2 → CM1 → CM2 → 6ème → 5ème → 4ème → 3ème → Seconde → Première → Terminale
pub fn compute_classe_superieure(classe_actuelle: &str) -> String {
    let normalized = classe_actuelle.trim().to_lowercase();
    let mapping: &[(&str, &str)] = &[
        ("sil", "CP"),
        ("cp", "CE1"),
        ("ce1", "CE2"),
        ("ce2", "CM1"),
        ("cm1", "CM2"),
        ("cm2", "6ème"),
        ("6ème", "5ème"),
        ("6eme", "5ème"),
        ("5ème", "4ème"),
        ("5eme", "4ème"),
        ("4ème", "3ème"),
        ("4eme", "3ème"),
        ("3ème", "Seconde"),
        ("3eme", "Seconde"),
        ("seconde", "Première"),
        ("2nde", "Première"),
        ("première", "Terminale"),
        ("premiere", "Terminale"),
        ("1ère", "Terminale"),
        ("1ere", "Terminale"),
        ("terminale", "Terminale"),
        ("tle", "Terminale"),
    ];
    for (key, val) in mapping {
        if normalized == *key {
            return val.to_string();
        }
    }
    // Si non reconnu, retourner la même classe
    classe_actuelle.to_string()
}

/// Déduit le niveau scolaire (Primaire/Collège/Lycée) depuis la classe
pub fn compute_niveau_from_classe(classe: &str) -> &'static str {
    let normalized = classe.trim().to_lowercase();
    match normalized.as_str() {
        "sil" | "cp" | "ce1" | "ce2" | "cm1" | "cm2" => "Primaire",
        "6ème" | "6eme" | "5ème" | "5eme" | "4ème" | "4eme" | "3ème" | "3eme" => "Collège",
        "seconde" | "2nde" | "première" | "premiere" | "1ère" | "1ere" | "terminale" | "tle" => {
            "Lycée"
        }
        _ => "Non déterminé",
    }
}

/// Recommandations de livres basées sur classe/matière
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BookRecommendation {
    pub livre_ids: Vec<i32>,
    pub score_recommendation: f64, // 0-100
    pub reasoning: String,
    pub alternative_books: Vec<i32>,
    pub matieres_suggestees: Vec<String>,
}

/// Matching intelligent besoins/offres
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BookMatching {
    pub livre_offert_id: i32,
    pub livre_souhaite_id: i32,
    pub participant_id: i32,
    pub score_matching: f64,      // 0-100
    pub score_compatibilite: f64, // 0-100
    pub score_proximite: f64,     // 0-100
    pub reasoning: String,
    pub points_forts: Vec<String>,
    pub points_faibles: Vec<String>,
}

/// Suggestions prix basées sur marché
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PriceSuggestion {
    pub livre_id: i32,
    pub prix_suggere_min: f64,
    pub prix_suggere_max: f64,
    pub prix_suggere_median: f64,
    pub devise: String,
    pub facteurs_influence: Vec<String>,
    pub comparaison_marche: String,
    pub confidence: f64, // 0-1
}

/// Service IA pour Bourse du Livre
pub struct BookExchangeAIService {
    app_ia: Arc<AppIA>,
}

impl BookExchangeAIService {
    pub fn new(app_ia: Arc<AppIA>) -> Self {
        Self { app_ia }
    }

    /// Génère des recommandations de livres basées sur classe/matière
    pub async fn generate_book_recommendations(
        &self,
        classe_actuelle: &str,
        classe_souhaitee: &str,
        matiere: &str,
        niveau: Option<&str>,
        ville: Option<&str>,
    ) -> AppResult<BookRecommendation> {
        let niveau_str = niveau.unwrap_or("Non spécifié");
        let ville_str = ville.unwrap_or("Non spécifiée");

        // Charger le prompt depuis le fichier markdown
        let mut variables = HashMap::new();
        variables.insert("classe_actuelle".to_string(), classe_actuelle.to_string());
        variables.insert("classe_souhaitee".to_string(), classe_souhaitee.to_string());
        variables.insert("matiere".to_string(), matiere.to_string());
        variables.insert("niveau".to_string(), niveau_str.to_string());
        variables.insert("ville".to_string(), ville_str.to_string());

        let prompt =
            load_prompt_section_with_vars("bourse_livre", "Recommandations de Livres", &variables)
                .await
                .unwrap_or_else(|e| {
                    log::warn!(
                "[BookExchangeAIService] Erreur chargement prompt, utilisation fallback: {}",
                e
            );
                    format!(
                        r#"
Tu es l'assistant intelligent de la Bourse du Livre de Yukpo.

CONTEXTE :
- Classe actuelle de l'élève : {}
- Classe souhaitée : {}
- Matière : {}
- Niveau : {}
- Ville : {}

TON RÔLE :
- Recommander des livres scolaires adaptés à la transition entre les classes
- Suggérer des matières complémentaires si nécessaire
- Proposer des alternatives si livres principaux indisponibles
- Donner des conseils pour faciliter l'apprentissage

IMPORTANT :
- Les recommandations doivent être adaptées au système éducatif camerounais/africain
- Prioriser les livres disponibles dans la région
- Considérer les programmes scolaires officiels

RÉPONSE ATTENDUE (JSON strict) :
{{
    "livre_ids": [1, 2, 3],
    "score_recommendation": 85.5,
    "reasoning": "Explication détaillée des recommandations",
    "alternative_books": [4, 5],
    "matieres_suggestees": ["Mathématiques", "Physique"]
}}
"#,
                        classe_actuelle, classe_souhaitee, matiere, niveau_str, ville_str
                    )
                });

        let (model_name, response, tokens) = self.app_ia.predict(&prompt).await?;
        log::info!(
            "[BookExchangeAIService] Recommandations générées avec {} (tokens: {})",
            model_name,
            tokens
        );

        // Parser la réponse JSON avec fallback gracieux
        let recommendation: BookRecommendation = match serde_json::from_str(&response) {
            Ok(r) => r,
            Err(e) => {
                log::warn!(
                    "[BookExchangeAIService] Erreur parsing JSON: {}. Réponse: {}",
                    e,
                    response
                );
                // Fallback : retourner une recommandation par défaut
                BookRecommendation {
                    livre_ids: vec![],
                    score_recommendation: 0.0,
                    reasoning: format!(
                        "Recommandation basique pour transition {} vers {} en {}",
                        classe_actuelle, classe_souhaitee, matiere
                    ),
                    alternative_books: vec![],
                    matieres_suggestees: vec![],
                }
            }
        };

        Ok(recommendation)
    }

    /// Matching intelligent besoins/offres
    pub async fn generate_book_matching(
        &self,
        livre_offert_id: i32,
        livre_souhaite_id: i32,
        participant_id: i32,
        distance_km: Option<f64>,
        etat_livre_offert: Option<&str>,
        etat_livre_souhaite: Option<&str>,
    ) -> AppResult<BookMatching> {
        let distance_str = distance_km
            .map(|d| format!("{} km", d))
            .unwrap_or_else(|| "Non spécifiée".to_string());
        let etat_offert = etat_livre_offert.unwrap_or("Non spécifié");
        let etat_souhaite = etat_livre_souhaite.unwrap_or("Non spécifié");

        // Charger le prompt depuis le fichier markdown
        let mut variables = HashMap::new();
        variables.insert("livre_offert_id".to_string(), livre_offert_id.to_string());
        variables.insert(
            "livre_souhaite_id".to_string(),
            livre_souhaite_id.to_string(),
        );
        variables.insert("participant_id".to_string(), participant_id.to_string());
        variables.insert("distance_km".to_string(), distance_str.clone());
        variables.insert("etat_livre_offert".to_string(), etat_offert.to_string());
        variables.insert("etat_livre_souhaite".to_string(), etat_souhaite.to_string());

        let prompt =
            load_prompt_section_with_vars("bourse_livre", "Matching Intelligent", &variables)
                .await
                .unwrap_or_else(|e| {
                    log::warn!(
                "[BookExchangeAIService] Erreur chargement prompt, utilisation fallback: {}",
                e
            );
                    format!(
                        r#"
Tu es l'assistant intelligent de matching pour la Bourse du Livre de Yukpo.

CONTEXTE :
- Livre offert ID : {}
- Livre souhaité ID : {}
- Participant ID : {}
- Distance : {}
- État livre offert : {}
- État livre souhaité : {}

TON RÔLE :
- Analyser la compatibilité de l'échange
- Calculer des scores de matching (compatibilité, proximité)
- Identifier les points forts et faibles de l'échange
- Donner des recommandations pour faciliter l'échange

CRITÈRES DE SCORING :
- Compatibilité : Classe, matière, niveau (0-100)
- Proximité : Distance géographique (0-100, plus proche = meilleur score)
- État : État des livres (0-100)

RÉPONSE ATTENDUE (JSON strict) :
{{
    "livre_offert_id": {},
    "livre_souhaite_id": {},
    "participant_id": {},
    "score_matching": 85.5,
    "score_compatibilite": 90.0,
    "score_proximite": 80.0,
    "reasoning": "Explication détaillée du matching",
    "points_forts": ["Point fort 1", "Point fort 2"],
    "points_faibles": ["Point faible 1"]
}}
"#,
                        livre_offert_id,
                        livre_souhaite_id,
                        participant_id,
                        distance_str,
                        etat_offert,
                        etat_souhaite,
                        livre_offert_id,
                        livre_souhaite_id,
                        participant_id
                    )
                });

        let (model_name, response, tokens) = self.app_ia.predict(&prompt).await?;
        log::info!(
            "[BookExchangeAIService] Matching généré avec {} (tokens: {})",
            model_name,
            tokens
        );

        // Parser la réponse JSON avec fallback gracieux
        let matching: BookMatching = match serde_json::from_str(&response) {
            Ok(m) => m,
            Err(e) => {
                log::warn!(
                    "[BookExchangeAIService] Erreur parsing JSON: {}. Réponse: {}",
                    e,
                    response
                );
                // Fallback : retourner un matching par défaut
                BookMatching {
                    livre_offert_id,
                    livre_souhaite_id,
                    participant_id,
                    score_matching: 70.0,
                    score_compatibilite: 75.0,
                    score_proximite: distance_km.map(|d| 100.0 - d.min(100.0)).unwrap_or(50.0),
                    reasoning: "Matching basique calculé".to_string(),
                    points_forts: vec![],
                    points_faibles: vec![],
                }
            }
        };

        Ok(matching)
    }

    /// Suggestions prix basées sur marché
    pub async fn generate_price_suggestions(
        &self,
        livre_id: i32,
        titre: &str,
        auteur: Option<&str>,
        editeur: Option<&str>,
        isbn: Option<&str>,
        classe: &str,
        matiere: &str,
        etat_livre: &str,
        ville: Option<&str>,
        prix_marche: Option<f64>, // Prix moyen du marché si disponible
    ) -> AppResult<PriceSuggestion> {
        let auteur_str = auteur.unwrap_or("Non spécifié");
        let editeur_str = editeur.unwrap_or("Non spécifié");
        let isbn_str = isbn.unwrap_or("Non spécifié");
        let ville_str = ville.unwrap_or("Non spécifiée");
        let prix_marche_str = prix_marche
            .map(|p| format!("{} XAF", p as i64))
            .unwrap_or_else(|| "Non disponible".to_string());

        // Charger le prompt depuis le fichier markdown
        let mut variables = HashMap::new();
        variables.insert("livre_id".to_string(), livre_id.to_string());
        variables.insert("titre".to_string(), titre.to_string());
        variables.insert("auteur".to_string(), auteur_str.to_string());
        variables.insert("editeur".to_string(), editeur_str.to_string());
        variables.insert("isbn".to_string(), isbn_str.to_string());
        variables.insert("classe".to_string(), classe.to_string());
        variables.insert("matiere".to_string(), matiere.to_string());
        variables.insert("etat_livre".to_string(), etat_livre.to_string());
        variables.insert("ville".to_string(), ville_str.to_string());
        variables.insert("prix_marche".to_string(), prix_marche_str.clone());

        let prompt = load_prompt_section_with_vars("bourse_livre", "Suggestions Prix", &variables)
            .await
            .unwrap_or_else(|e| {
                log::warn!(
                    "[BookExchangeAIService] Erreur chargement prompt, utilisation fallback: {}",
                    e
                );
                format!(
                    r#"
Tu es l'expert en prix de livres scolaires pour Yukpo.

CONTEXTE :
- Livre ID : {}
- Titre : {}
- Auteur : {}
- Éditeur : {}
- ISBN : {}
- Classe : {}
- Matière : {}
- État : {}
- Ville : {}
- Prix moyen marché : {}

TON RÔLE :
- Suggérer une fourchette de prix adaptée au marché local
- Considérer l'état du livre (Neuf, Très bon, Bon, Acceptable)
- Prendre en compte la localisation (prix peuvent varier selon ville)
- Donner des facteurs d'influence (rareté, demande, saisonnalité)

IMPORTANT :
- Les prix doivent être en XAF (Franc CFA)
- Considérer le pouvoir d'achat local
- Suggérer des prix réalistes et compétitifs

RÉPONSE ATTENDUE (JSON strict) :
{{
    "livre_id": {},
    "prix_suggere_min": 5000.0,
    "prix_suggere_max": 8000.0,
    "prix_suggere_median": 6500.0,
    "devise": "XAF",
    "facteurs_influence": ["Facteur 1", "Facteur 2"],
    "comparaison_marche": "Description de la comparaison avec le marché",
    "confidence": 0.85
}}
"#,
                    livre_id,
                    titre,
                    auteur_str,
                    editeur_str,
                    isbn_str,
                    classe,
                    matiere,
                    etat_livre,
                    ville_str,
                    prix_marche_str,
                    livre_id
                )
            });

        let (model_name, response, tokens) = self.app_ia.predict(&prompt).await?;
        log::info!(
            "[BookExchangeAIService] Suggestions prix générées avec {} (tokens: {})",
            model_name,
            tokens
        );

        // Parser la réponse JSON avec fallback gracieux
        let suggestion: PriceSuggestion = match serde_json::from_str(&response) {
            Ok(s) => s,
            Err(e) => {
                log::warn!(
                    "[BookExchangeAIService] Erreur parsing JSON: {}. Réponse: {}",
                    e,
                    response
                );
                // Fallback : retourner une suggestion par défaut basée sur l'état
                let prix_base = match etat_livre {
                    "Neuf" => 10000.0,
                    "Très bon" => 7500.0,
                    "Bon" => 5000.0,
                    "Acceptable" => 3000.0,
                    _ => 5000.0,
                };
                PriceSuggestion {
                    livre_id,
                    prix_suggere_min: prix_base * 0.8,
                    prix_suggere_max: prix_base * 1.2,
                    prix_suggere_median: prix_base,
                    devise: "XAF".to_string(),
                    facteurs_influence: vec!["État du livre".to_string(), "Classe".to_string()],
                    comparaison_marche: "Suggestion basée sur état du livre".to_string(),
                    confidence: 0.6,
                }
            }
        };

        Ok(suggestion)
    }

    /// ✅ V2: Analyse recto-verso d'un livre avec classification 3 niveaux,
    /// détection prix/devise, et vérification programme scolaire
    pub async fn analyze_book_recto_verso(
        &self,
        image_recto_base64: &str,
        image_verso_base64: &str,
        user_lat: Option<f64>,
        user_lng: Option<f64>,
        programmes_disponibles: &str,
    ) -> AppResult<BookRectoVersoAnalysis> {
        let lat = user_lat.unwrap_or(0.0);
        let lng = user_lng.unwrap_or(0.0);

        let mut variables = std::collections::HashMap::new();
        variables.insert("user_lat".to_string(), format!("{}", lat));
        variables.insert("user_lng".to_string(), format!("{}", lng));
        variables.insert(
            "programmes_disponibles".to_string(),
            programmes_disponibles.to_string(),
        );

        let prompt = crate::services::ia::prompt_loader::load_prompt_section_with_vars(
            "bourse_livre",
            "Analyse Recto-Verso Livre",
            &variables,
        )
        .await
        .unwrap_or_else(|e| {
            log::warn!(
                "[BookExchangeAIService] Erreur chargement prompt recto-verso, utilisation fallback: {}",
                e
            );
            format!(
                r#"Tu es un expert en analyse de livres scolaires pour Yukpo (Cameroun/Afrique).
Analyse les images RECTO et VERSO du livre.
Extrais: titre, auteur, éditeur, ISBN, classe du livre (classe_actuelle), matière, niveau (Primaire/Collège/Lycée).
Détecte le prix imprimé et la devise.
Classe l'état en 3 niveaux: "bon", "acceptable", "rejete".

CALCUL CLASSE SUPÉRIEURE (OBLIGATOIRE):
L'élève a DÉJÀ UTILISÉ ce livre → il passe en classe supérieure.
classe_souhaitee = classe IMMÉDIATEMENT SUPÉRIEURE à classe_actuelle.
Hiérarchie: SIL→CP→CE1→CE2→CM1→CM2→6ème→5ème→4ème→3ème→Seconde→Première→Terminale.
Ex: livre "6ème" → classe_souhaitee="5ème", livre "CM2" → classe_souhaitee="6ème", livre "3ème" → classe_souhaitee="Seconde".
Si Terminale → classe_souhaitee="Terminale".

Localisation: lat={}, lng={}.
Programmes connus: {}.
Réponds en JSON strict avec: titre, auteur, editeur, isbn, classe_actuelle, classe_souhaitee, matiere, niveau, prix_detecte, devise_detectee, etat_classification, etat_description, est_au_programme, programme_scolaire_id, programme_match_details, confidence, notes."#,
                lat, lng, programmes_disponibles
            )
        });

        let images = vec![
            image_recto_base64.to_string(),
            image_verso_base64.to_string(),
        ];

        let (model_name, response, tokens) =
            self.app_ia.predict_multimodal(&prompt, Some(images)).await.map_err(|e| {
                log::error!(
                    "[BookExchangeAIService] Erreur IA multimodale recto-verso: {}",
                    e
                );
                crate::core::types::AppError::Internal("Erreur analyse IA recto-verso".to_string())
            })?;

        log::info!(
            "[BookExchangeAIService] Analyse recto-verso effectuée avec {} (tokens: {})",
            model_name,
            tokens
        );

        let analysis: BookRectoVersoAnalysis = match serde_json::from_str(&response) {
            Ok(a) => a,
            Err(e) => {
                log::warn!(
                    "[BookExchangeAIService] Erreur parsing JSON recto-verso: {}. Réponse: {}",
                    e,
                    &response[..response.len().min(500)]
                );
                BookRectoVersoAnalysis {
                    titre: None,
                    auteur: None,
                    editeur: None,
                    isbn: None,
                    classe_actuelle: None,
                    classe_souhaitee: None,
                    matiere: None,
                    niveau: None,
                    prix_detecte: None,
                    devise_detectee: Some("XAF".to_string()),
                    etat_classification: "acceptable".to_string(),
                    etat_description: "Analyse partielle, vérification manuelle recommandée"
                        .to_string(),
                    est_au_programme: None,
                    programme_scolaire_id: None,
                    programme_match_details: None,
                    confidence: 0.3,
                    notes: Some(format!("Erreur parsing: {}", e)),
                }
            }
        };

        // ✅ Fallback déterministe: si l'IA a trouvé classe_actuelle mais pas classe_souhaitee,
        // ou si classe_souhaitee est incorrecte, on la recalcule
        let mut analysis = analysis;
        if let Some(ref classe_act) = analysis.classe_actuelle {
            let computed = compute_classe_superieure(classe_act);
            if analysis.classe_souhaitee.is_none()
                || analysis.classe_souhaitee.as_deref() == Some("")
            {
                log::info!(
                    "[BookExchangeAIService] Fallback classe_souhaitee: {} → {}",
                    classe_act,
                    computed
                );
                analysis.classe_souhaitee = Some(computed);
            }
        }

        Ok(analysis)
    }

    /// ✅ V2 Phase 2: Extraire la liste de livres d'un fichier programme scolaire
    /// L'admin upload un PDF/Excel/Image et l'IA extrait tous les livres listés
    pub async fn extract_programme_from_file(
        &self,
        file_base64: &str,
        file_type: &str, // "pdf", "excel", "image"
        niveau: &str,
        periode_academique: &str,
        classe: Option<&str>,
    ) -> AppResult<ProgrammeExtractionResult> {
        let classe_str = classe.unwrap_or("Toutes");

        let prompt = format!(
            r#"Tu es un expert en extraction de données de programmes scolaires officiels.

CONTEXTE :
- Type de fichier : {}
- Niveau : {}
- Classe : {}
- Période académique : {}

TON RÔLE :
- Analyser le document (programme scolaire officiel) 
- Extraire TOUS les livres/manuels listés dans ce programme
- Pour chaque livre extraire: titre, auteur, éditeur, ISBN (si visible), classe, matière, prix officiel (si mentionné), si obligatoire ou recommandé

IMPORTANT :
- Extraire TOUS les livres, pas seulement quelques-uns
- Si le document couvre plusieurs classes, indiquer la classe pour chaque livre
- Les prix sont généralement en XAF (FCFA)
- Distinguer "obligatoire" vs "recommandé/optionnel"

RÉPONSE ATTENDUE (JSON strict) :
{{
    "livres": [
        {{
            "titre": "Titre du livre",
            "auteur": "Nom de l'auteur",
            "editeur": "Maison d'édition",
            "isbn": "ISBN si disponible",
            "classe": "6ème",
            "matiere": "Mathématiques",
            "prix_officiel": 5000.0,
            "est_obligatoire": true
        }}
    ],
    "nombre_total": 15,
    "classes_couvertes": ["6ème", "5ème"],
    "matieres_couvertes": ["Mathématiques", "Français"],
    "notes": "Observations sur le document",
    "confidence": 0.85
}}"#,
            file_type, niveau, classe_str, periode_academique
        );

        // Utiliser predict_multimodal si image/PDF, sinon predict textuel
        let (model_name, response, tokens) = if file_type == "image" || file_type == "pdf" {
            self.app_ia
                .predict_multimodal(&prompt, Some(vec![file_base64.to_string()]))
                .await?
        } else {
            // Pour Excel, on envoie comme texte (le contenu sera pré-extrait côté controller)
            self.app_ia.predict(&prompt).await?
        };

        log::info!(
            "[BookExchangeAIService] Extraction programme effectuée avec {} (tokens: {})",
            model_name,
            tokens
        );

        let result: ProgrammeExtractionResult = match serde_json::from_str(&response) {
            Ok(r) => r,
            Err(e) => {
                log::warn!(
                    "[BookExchangeAIService] Erreur parsing extraction: {}. Réponse: {}",
                    e,
                    &response[..response.len().min(500)]
                );
                ProgrammeExtractionResult {
                    livres: vec![],
                    nombre_total: 0,
                    classes_couvertes: vec![],
                    matieres_couvertes: vec![],
                    notes: Some(format!("Erreur parsing: {}", e)),
                    confidence: 0.2,
                }
            }
        };

        Ok(result)
    }

    /// ✅ V2 Phase 2: Matching intelligent livre ↔ programme scolaire
    /// Prend en compte la date du troc pour matcher le bon programme académique
    pub async fn match_livre_to_programme(
        &self,
        titre_livre: &str,
        auteur_livre: Option<&str>,
        classe: &str,
        matiere: &str,
        date_troc: &str,       // Date ISO pour déterminer la période académique
        programmes_json: &str, // JSON des programmes disponibles
    ) -> AppResult<ProgrammeMatchResult> {
        let auteur = auteur_livre.unwrap_or("Inconnu");

        let prompt = format!(
            r#"Tu es un expert en matching de livres scolaires avec les programmes officiels.

LIVRE À MATCHER :
- Titre : {}
- Auteur : {}
- Classe : {}
- Matière : {}
- Date du troc/échange : {}

PROGRAMMES SCOLAIRES DISPONIBLES (JSON) :
{}

TON RÔLE :
1. Déterminer la période académique correspondant à la date du troc
   - Ex: date "2026-01-15" → période "2025-2026"
   - La rentrée est en septembre, donc sept 2025 → juil 2026 = période "2025-2026"
2. Filtrer les programmes de la bonne période académique
3. Matcher le livre avec le meilleur programme possible
   - Matching flou sur titre (tolérance fautes de frappe, abréviations)
   - Matching sur auteur si disponible
   - Matching exact sur classe et matière
4. Calculer un score de confiance

RÉPONSE ATTENDUE (JSON strict) :
{{
    "matched": true,
    "programme_scolaire_id": 42,
    "periode_academique_detectee": "2025-2026",
    "score_match": 0.92,
    "titre_programme": "Titre officiel dans le programme",
    "est_obligatoire": true,
    "prix_officiel": 5000.0,
    "reasoning": "Explication du matching",
    "alternatives": []
}}"#,
            titre_livre, auteur, classe, matiere, date_troc, programmes_json
        );

        let (model_name, response, tokens) = self.app_ia.predict(&prompt).await?;
        log::info!(
            "[BookExchangeAIService] Matching programme effectué avec {} (tokens: {})",
            model_name,
            tokens
        );

        let result: ProgrammeMatchResult = match serde_json::from_str(&response) {
            Ok(r) => r,
            Err(e) => {
                log::warn!("[BookExchangeAIService] Erreur parsing matching: {}", e);
                ProgrammeMatchResult {
                    matched: false,
                    programme_scolaire_id: None,
                    periode_academique_detectee: None,
                    score_match: 0.0,
                    titre_programme: None,
                    est_obligatoire: None,
                    prix_officiel: None,
                    reasoning: format!("Matching non résolu: {}", e),
                    alternatives: vec![],
                }
            }
        };

        Ok(result)
    }
}

/// Résultat d'extraction de programme scolaire
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgrammeExtractionResult {
    pub livres: Vec<crate::models::livre_scolaire::LivreExtraitProgramme>,
    pub nombre_total: i32,
    pub classes_couvertes: Vec<String>,
    pub matieres_couvertes: Vec<String>,
    pub notes: Option<String>,
    pub confidence: f64,
}

/// Résultat de matching livre ↔ programme
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgrammeMatchResult {
    pub matched: bool,
    pub programme_scolaire_id: Option<i32>,
    pub periode_academique_detectee: Option<String>,
    pub score_match: f64,
    pub titre_programme: Option<String>,
    pub est_obligatoire: Option<bool>,
    pub prix_officiel: Option<f64>,
    pub reasoning: String,
    pub alternatives: Vec<serde_json::Value>,
}

/// Résultat d'analyse recto-verso d'un livre
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BookRectoVersoAnalysis {
    pub titre: Option<String>,
    pub auteur: Option<String>,
    pub editeur: Option<String>,
    pub isbn: Option<String>,
    pub classe_actuelle: Option<String>,
    pub classe_souhaitee: Option<String>,
    pub matiere: Option<String>,
    pub niveau: Option<String>,
    pub prix_detecte: Option<f64>,
    pub devise_detectee: Option<String>,
    pub etat_classification: String, // "bon", "acceptable", "rejete"
    pub etat_description: String,
    pub est_au_programme: Option<bool>,
    pub programme_scolaire_id: Option<i32>,
    pub programme_match_details: Option<String>,
    pub confidence: f64,
    pub notes: Option<String>,
}
