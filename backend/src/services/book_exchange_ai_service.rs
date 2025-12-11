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
Tu es l'assistant intelligent de la Bourse du Livre de Yukpomnang.

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
Tu es l'assistant intelligent de matching pour la Bourse du Livre de Yukpomnang.

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
Tu es l'expert en prix de livres scolaires pour Yukpomnang.

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
}
