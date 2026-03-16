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

// ============================================================================
// SYSTÈMES SCOLAIRES MULTI-PAYS
// ============================================================================

/// Représente un système scolaire avec sa hiérarchie de classes
pub struct SchoolSystem {
    pub code: &'static str,
    pub name: &'static str,
    pub language: &'static str,
    pub currency: &'static str,
    /// (normalized_class, next_class, level_label) — next_class="" si dernière classe
    pub hierarchy: &'static [(&'static str, &'static str, &'static str)],
}

/// Tous les systèmes scolaires supportés
pub fn get_all_school_systems() -> Vec<&'static SchoolSystem> {
    vec![
        &SYSTEM_CAMEROUN_FR,
        &SYSTEM_CAMEROUN_EN,
        &SYSTEM_NIGERIA,
        &SYSTEM_FRANCOPHONE_WEST, // Sénégal, Côte d'Ivoire, Gabon, Togo, Bénin, Burkina, Mali, Niger, Guinée
        &SYSTEM_RDC,
        &SYSTEM_GHANA,
        &SYSTEM_KENYA,
    ]
}

// -- Cameroun Francophone --
static SYSTEM_CAMEROUN_FR: SchoolSystem = SchoolSystem {
    code: "cm_fr",
    name: "Cameroun (Francophone)",
    language: "fr",
    currency: "XAF",
    hierarchy: &[
        ("sil", "CP", "Primaire"),
        ("cp", "CE1", "Primaire"),
        ("ce1", "CE2", "Primaire"),
        ("ce2", "CM1", "Primaire"),
        ("cm1", "CM2", "Primaire"),
        ("cm2", "6ème", "Primaire"),
        ("6ème", "5ème", "Collège"),
        ("6eme", "5ème", "Collège"),
        ("5ème", "4ème", "Collège"),
        ("5eme", "4ème", "Collège"),
        ("4ème", "3ème", "Collège"),
        ("4eme", "3ème", "Collège"),
        ("3ème", "Seconde", "Collège"),
        ("3eme", "Seconde", "Collège"),
        ("seconde", "Première", "Lycée"),
        ("2nde", "Première", "Lycée"),
        ("première", "Terminale", "Lycée"),
        ("premiere", "Terminale", "Lycée"),
        ("1ère", "Terminale", "Lycée"),
        ("1ere", "Terminale", "Lycée"),
        ("terminale", "", "Lycée"),
        ("tle", "", "Lycée"),
    ],
};

// -- Cameroun Anglophone (GCE system) --
static SYSTEM_CAMEROUN_EN: SchoolSystem = SchoolSystem {
    code: "cm_en",
    name: "Cameroon (Anglophone/GCE)",
    language: "en",
    currency: "XAF",
    hierarchy: &[
        ("class 1", "Class 2", "Primary"),
        ("class1", "Class 2", "Primary"),
        ("class 2", "Class 3", "Primary"),
        ("class2", "Class 3", "Primary"),
        ("class 3", "Class 4", "Primary"),
        ("class3", "Class 4", "Primary"),
        ("class 4", "Class 5", "Primary"),
        ("class4", "Class 5", "Primary"),
        ("class 5", "Class 6", "Primary"),
        ("class5", "Class 6", "Primary"),
        ("class 6", "Form 1", "Primary"),
        ("class6", "Form 1", "Primary"),
        ("form 1", "Form 2", "Secondary"),
        ("form1", "Form 2", "Secondary"),
        ("form 2", "Form 3", "Secondary"),
        ("form2", "Form 3", "Secondary"),
        ("form 3", "Form 4", "Secondary"),
        ("form3", "Form 4", "Secondary"),
        ("form 4", "Form 5", "Secondary"),
        ("form4", "Form 5", "Secondary"),
        ("form 5", "Lower Sixth", "Secondary"),
        ("form5", "Lower Sixth", "Secondary"),
        ("lower sixth", "Upper Sixth", "High School"),
        ("lower 6th", "Upper Sixth", "High School"),
        ("upper sixth", "", "High School"),
        ("upper 6th", "", "High School"),
    ],
};

// -- Nigeria --
static SYSTEM_NIGERIA: SchoolSystem = SchoolSystem {
    code: "ng",
    name: "Nigeria",
    language: "en",
    currency: "NGN",
    hierarchy: &[
        ("primary 1", "Primary 2", "Primary"),
        ("p1", "Primary 2", "Primary"),
        ("primary 2", "Primary 3", "Primary"),
        ("p2", "Primary 3", "Primary"),
        ("primary 3", "Primary 4", "Primary"),
        ("p3", "Primary 4", "Primary"),
        ("primary 4", "Primary 5", "Primary"),
        ("p4", "Primary 5", "Primary"),
        ("primary 5", "Primary 6", "Primary"),
        ("p5", "Primary 6", "Primary"),
        ("primary 6", "JSS 1", "Primary"),
        ("p6", "JSS 1", "Primary"),
        ("jss 1", "JSS 2", "Junior Secondary"),
        ("jss1", "JSS 2", "Junior Secondary"),
        ("jss 2", "JSS 3", "Junior Secondary"),
        ("jss2", "JSS 3", "Junior Secondary"),
        ("jss 3", "SSS 1", "Junior Secondary"),
        ("jss3", "SSS 1", "Junior Secondary"),
        ("sss 1", "SSS 2", "Senior Secondary"),
        ("sss1", "SSS 2", "Senior Secondary"),
        ("sss 2", "SSS 3", "Senior Secondary"),
        ("sss2", "SSS 3", "Senior Secondary"),
        ("sss 3", "", "Senior Secondary"),
        ("sss3", "", "Senior Secondary"),
    ],
};

// -- Afrique francophone (Sénégal, Côte d'Ivoire, Gabon, Togo, Bénin, Burkina, Mali, Niger, Guinée, Congo-Brazza) --
static SYSTEM_FRANCOPHONE_WEST: SchoolSystem = SchoolSystem {
    code: "fr_west",
    name: "Afrique Francophone (Sénégal, Côte d'Ivoire, Gabon, etc.)",
    language: "fr",
    currency: "XOF",
    hierarchy: &[
        ("ci", "CP", "Primaire"),
        ("cp", "CE1", "Primaire"),
        ("ce1", "CE2", "Primaire"),
        ("ce2", "CM1", "Primaire"),
        ("cm1", "CM2", "Primaire"),
        ("cm2", "6ème", "Primaire"),
        ("6ème", "5ème", "Collège"),
        ("6eme", "5ème", "Collège"),
        ("5ème", "4ème", "Collège"),
        ("5eme", "4ème", "Collège"),
        ("4ème", "3ème", "Collège"),
        ("4eme", "3ème", "Collège"),
        ("3ème", "Seconde", "Collège"),
        ("3eme", "Seconde", "Collège"),
        ("seconde", "Première", "Lycée"),
        ("2nde", "Première", "Lycée"),
        ("première", "Terminale", "Lycée"),
        ("premiere", "Terminale", "Lycée"),
        ("1ère", "Terminale", "Lycée"),
        ("1ere", "Terminale", "Lycée"),
        ("terminale", "", "Lycée"),
        ("tle", "", "Lycée"),
    ],
};

// -- RDC (République Démocratique du Congo) --
static SYSTEM_RDC: SchoolSystem = SchoolSystem {
    code: "cd",
    name: "RDC (Congo Kinshasa)",
    language: "fr",
    currency: "CDF",
    hierarchy: &[
        ("1ère primaire", "2ème primaire", "Primaire"),
        ("1ere primaire", "2ème primaire", "Primaire"),
        ("2ème primaire", "3ème primaire", "Primaire"),
        ("2eme primaire", "3ème primaire", "Primaire"),
        ("3ème primaire", "4ème primaire", "Primaire"),
        ("3eme primaire", "4ème primaire", "Primaire"),
        ("4ème primaire", "5ème primaire", "Primaire"),
        ("4eme primaire", "5ème primaire", "Primaire"),
        ("5ème primaire", "6ème primaire", "Primaire"),
        ("5eme primaire", "6ème primaire", "Primaire"),
        ("6ème primaire", "1ère secondaire", "Primaire"),
        ("6eme primaire", "1ère secondaire", "Primaire"),
        ("1ère secondaire", "2ème secondaire", "Secondaire"),
        ("1ere secondaire", "2ème secondaire", "Secondaire"),
        ("2ème secondaire", "3ème secondaire", "Secondaire"),
        ("2eme secondaire", "3ème secondaire", "Secondaire"),
        ("3ème secondaire", "4ème secondaire", "Secondaire"),
        ("3eme secondaire", "4ème secondaire", "Secondaire"),
        ("4ème secondaire", "5ème secondaire", "Secondaire"),
        ("4eme secondaire", "5ème secondaire", "Secondaire"),
        ("5ème secondaire", "6ème secondaire", "Secondaire"),
        ("5eme secondaire", "6ème secondaire", "Secondaire"),
        ("6ème secondaire", "", "Secondaire"),
        ("6eme secondaire", "", "Secondaire"),
    ],
};

// -- Ghana --
static SYSTEM_GHANA: SchoolSystem = SchoolSystem {
    code: "gh",
    name: "Ghana",
    language: "en",
    currency: "GHS",
    hierarchy: &[
        ("primary 1", "Primary 2", "Primary"),
        ("p1", "Primary 2", "Primary"),
        ("primary 2", "Primary 3", "Primary"),
        ("p2", "Primary 3", "Primary"),
        ("primary 3", "Primary 4", "Primary"),
        ("p3", "Primary 4", "Primary"),
        ("primary 4", "Primary 5", "Primary"),
        ("p4", "Primary 5", "Primary"),
        ("primary 5", "Primary 6", "Primary"),
        ("p5", "Primary 6", "Primary"),
        ("primary 6", "JHS 1", "Primary"),
        ("p6", "JHS 1", "Primary"),
        ("jhs 1", "JHS 2", "Junior High"),
        ("jhs1", "JHS 2", "Junior High"),
        ("jhs 2", "JHS 3", "Junior High"),
        ("jhs2", "JHS 3", "Junior High"),
        ("jhs 3", "SHS 1", "Junior High"),
        ("jhs3", "SHS 1", "Junior High"),
        ("shs 1", "SHS 2", "Senior High"),
        ("shs1", "SHS 2", "Senior High"),
        ("shs 2", "SHS 3", "Senior High"),
        ("shs2", "SHS 3", "Senior High"),
        ("shs 3", "", "Senior High"),
        ("shs3", "", "Senior High"),
    ],
};

// -- Kenya / East Africa --
static SYSTEM_KENYA: SchoolSystem = SchoolSystem {
    code: "ke",
    name: "Kenya / East Africa",
    language: "en",
    currency: "KES",
    hierarchy: &[
        ("standard 1", "Standard 2", "Primary"),
        ("std 1", "Standard 2", "Primary"),
        ("standard 2", "Standard 3", "Primary"),
        ("std 2", "Standard 3", "Primary"),
        ("standard 3", "Standard 4", "Primary"),
        ("std 3", "Standard 4", "Primary"),
        ("standard 4", "Standard 5", "Primary"),
        ("std 4", "Standard 5", "Primary"),
        ("standard 5", "Standard 6", "Primary"),
        ("std 5", "Standard 6", "Primary"),
        ("standard 6", "Standard 7", "Primary"),
        ("std 6", "Standard 7", "Primary"),
        ("standard 7", "Standard 8", "Primary"),
        ("std 7", "Standard 8", "Primary"),
        ("standard 8", "Form 1", "Primary"),
        ("std 8", "Form 1", "Primary"),
        ("form 1", "Form 2", "Secondary"),
        ("form1", "Form 2", "Secondary"),
        ("form 2", "Form 3", "Secondary"),
        ("form2", "Form 3", "Secondary"),
        ("form 3", "Form 4", "Secondary"),
        ("form3", "Form 4", "Secondary"),
        ("form 4", "", "Secondary"),
        ("form4", "", "Secondary"),
    ],
};

// ============================================================================
// DÉTECTION PAYS PAR GPS (bounding boxes simplifiées)
// ============================================================================

/// Détecte le code pays à partir de coordonnées GPS (lat, lng).
/// Utilise des bounding boxes simplifiées pour les pays africains.
/// Retourne "cm" par défaut si aucune correspondance.
pub fn detect_country_from_gps(lat: f64, lng: f64) -> &'static str {
    // Bounding boxes approximatives (lat_min, lat_max, lng_min, lng_max)
    let countries: &[(&str, f64, f64, f64, f64)] = &[
        ("cm", 1.65, 13.10, 8.40, 16.20),     // Cameroun
        ("ng", 4.20, 13.90, 2.67, 14.68),     // Nigeria
        ("sn", 12.30, 16.70, -17.55, -11.35), // Sénégal
        ("ci", 4.30, 10.75, -8.60, -2.50),    // Côte d'Ivoire
        ("ga", -3.95, 2.35, 8.65, 14.55),     // Gabon
        ("cd", -13.46, 5.39, 12.18, 31.31),   // RDC
        ("cg", -5.02, 3.71, 11.12, 18.65),    // Congo-Brazza
        ("gh", 4.73, 11.18, -3.25, 1.20),     // Ghana
        ("ke", -4.72, 5.03, 33.89, 41.91),    // Kenya
        ("tg", 6.10, 11.14, -0.15, 1.81),     // Togo
        ("bj", 6.22, 12.42, 0.76, 3.85),      // Bénin
        ("bf", 9.39, 15.09, -5.52, 2.41),     // Burkina Faso
        ("ml", 10.16, 25.00, -12.24, 4.27),   // Mali
        ("ne", 11.69, 23.53, 0.16, 16.00),    // Niger
        ("gn", 7.19, 12.68, -15.08, -7.64),   // Guinée
        ("tz", -11.75, -0.98, 29.33, 40.44),  // Tanzanie
        ("ug", -1.48, 4.23, 29.57, 35.03),    // Ouganda
        ("rw", -2.84, -1.05, 28.86, 30.90),   // Rwanda
        ("td", 7.44, 23.45, 13.47, 24.00),    // Tchad
        ("cf", 2.22, 11.00, 14.42, 27.46),    // Centrafrique
    ];
    for &(code, lat_min, lat_max, lng_min, lng_max) in countries {
        if lat >= lat_min && lat <= lat_max && lng >= lng_min && lng <= lng_max {
            return code;
        }
    }
    "cm" // Défaut: Cameroun
}

/// Retourne le système scolaire approprié pour un code pays.
/// Gère les regroupements (ex: Sénégal, Côte d'Ivoire → même système francophone).
pub fn get_school_system_for_country(country_code: &str) -> &'static SchoolSystem {
    match country_code {
        "cm" => &SYSTEM_CAMEROUN_FR, // Défaut francophone, l'IA affinera si anglophone
        "ng" => &SYSTEM_NIGERIA,
        "gh" => &SYSTEM_GHANA,
        "ke" | "tz" | "ug" | "rw" => &SYSTEM_KENYA,
        "cd" => &SYSTEM_RDC,
        "sn" | "ci" | "ga" | "cg" | "tg" | "bj" | "bf" | "ml" | "ne" | "gn" | "td" | "cf" => {
            &SYSTEM_FRANCOPHONE_WEST
        }
        _ => &SYSTEM_CAMEROUN_FR, // Fallback global
    }
}

/// Détecte le système scolaire à partir de GPS.
pub fn detect_school_system_from_gps(lat: f64, lng: f64) -> &'static SchoolSystem {
    let country = detect_country_from_gps(lat, lng);
    get_school_system_for_country(country)
}

// ============================================================================
// FONCTIONS UTILITAIRES MULTI-SYSTÈMES
// ============================================================================

/// Calcule la classe immédiatement supérieure.
/// Essaie d'abord le système détecté par GPS, puis tous les systèmes en fallback.
/// Retourne "" (vide) si c'est la dernière classe du système.
pub fn compute_classe_superieure(classe_actuelle: &str) -> String {
    compute_classe_superieure_with_gps(classe_actuelle, None, None)
}

/// Version GPS-aware de compute_classe_superieure.
pub fn compute_classe_superieure_with_gps(
    classe_actuelle: &str,
    lat: Option<f64>,
    lng: Option<f64>,
) -> String {
    let normalized = classe_actuelle.trim().to_lowercase();

    // 1. Si GPS disponible, essayer le système du pays détecté en priorité
    if let (Some(lat_v), Some(lng_v)) = (lat, lng) {
        if lat_v != 0.0 || lng_v != 0.0 {
            let system = detect_school_system_from_gps(lat_v, lng_v);
            for &(key, next, _) in system.hierarchy {
                if normalized == key {
                    return next.to_string();
                }
            }
        }
    }

    // 2. Fallback: chercher dans TOUS les systèmes
    for system in get_all_school_systems() {
        for &(key, next, _) in system.hierarchy {
            if normalized == key {
                return next.to_string();
            }
        }
    }

    // 3. Si non reconnu, retourner la même classe (l'IA devra affiner)
    classe_actuelle.to_string()
}

/// Vérifie si une classe est la dernière de son système (pas de troc possible, vente uniquement).
/// Fonctionne pour tous les systèmes: Terminale, Upper Sixth, SSS 3, SHS 3, Form 4 (Kenya), 6ème secondaire (RDC)...
pub fn is_classe_terminale(classe: &str) -> bool {
    let normalized = classe.trim().to_lowercase();

    // Chercher dans tous les systèmes: une classe est "terminale" si next_class == ""
    for system in get_all_school_systems() {
        for &(key, next, _) in system.hierarchy {
            if normalized == key && next.is_empty() {
                return true;
            }
        }
    }
    false
}

/// Déduit le niveau scolaire depuis la classe (multi-système).
pub fn compute_niveau_from_classe(classe: &str) -> &'static str {
    let normalized = classe.trim().to_lowercase();
    for system in get_all_school_systems() {
        for &(key, _, level) in system.hierarchy {
            if normalized == key {
                return level;
            }
        }
    }
    "Non déterminé"
}

/// Génère la description complète de la hiérarchie pour un système donné.
/// Utilisé dans les prompts IA pour que l'IA connaisse le système de l'utilisateur.
pub fn get_hierarchy_description_for_prompt(system: &SchoolSystem) -> String {
    let mut levels: Vec<(&str, Vec<String>)> = Vec::new();
    let mut current_level = "";
    let mut current_classes: Vec<String> = Vec::new();

    // Dédupliquer (les alias comme "6eme"/"6ème" ne doivent apparaître qu'une fois)
    let mut seen: std::collections::HashSet<String> = std::collections::HashSet::new();

    for &(key, next, level) in system.hierarchy {
        // Skip les alias (si la classe suivante est la même que celle d'un autre entry)
        let display_name = if next.is_empty() {
            key.to_string()
        } else {
            key.to_string()
        };
        if seen.contains(&display_name) {
            continue;
        }
        seen.insert(display_name.clone());

        if level != current_level {
            if !current_classes.is_empty() {
                levels.push((current_level, current_classes.clone()));
                current_classes.clear();
            }
            current_level = level;
        }
        // Formater: "CM2 → 6ème" ou "Terminale (FIN)"
        if next.is_empty() {
            current_classes.push(format!("{} (FIN - vente uniquement)", key));
        } else {
            current_classes.push(format!("{} → {}", key, next));
        }
    }
    if !current_classes.is_empty() {
        levels.push((current_level, current_classes));
    }

    let mut result = String::new();
    for (level_name, classes) in &levels {
        result.push_str(&format!("  {} : {}\n", level_name, classes.join(", ")));
    }
    result
}

/// Retourne la description multi-système pour le prompt IA quand on ne connaît pas
/// le système exact (fallback universel).
pub fn get_all_systems_description_for_prompt() -> String {
    let mut result = String::new();
    for system in get_all_school_systems() {
        result.push_str(&format!("\n--- {} ---\n", system.name));
        result.push_str(&get_hierarchy_description_for_prompt(system));
    }
    result
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

        // ✅ Détecter le système scolaire à partir du GPS de l'utilisateur
        let detected_system = if lat != 0.0 || lng != 0.0 {
            detect_school_system_from_gps(lat, lng)
        } else {
            get_school_system_for_country("cm") // Défaut Cameroun
        };
        let country_code = detect_country_from_gps(lat, lng);
        let hierarchy_desc = get_hierarchy_description_for_prompt(detected_system);

        // Déterminer si les programmes sont disponibles ou si l'IA doit faire un fallback
        let programmes_info = if programmes_disponibles.is_empty()
            || programmes_disponibles == "[]"
            || programmes_disponibles == "Aucun"
        {
            format!(
                "AUCUN programme scolaire n'est encore enregistré pour cette région. \
                Tu DOIS utiliser tes connaissances du système éducatif {} pour déterminer \
                si ce livre correspond au programme officiel actuel. Indique est_au_programme=true \
                si tu es raisonnablement confiant, avec programme_match_details expliquant ton raisonnement. \
                Mets programme_scolaire_id=null dans ce cas.",
                detected_system.name
            )
        } else {
            format!("Programmes scolaires connus : {}", programmes_disponibles)
        };

        log::info!(
            "[BookExchangeAIService] Système scolaire détecté: {} ({}) pour GPS ({}, {})",
            detected_system.name,
            detected_system.code,
            lat,
            lng
        );

        let mut variables = std::collections::HashMap::new();
        variables.insert("user_lat".to_string(), format!("{}", lat));
        variables.insert("user_lng".to_string(), format!("{}", lng));
        variables.insert("pays_detecte".to_string(), country_code.to_uppercase());
        variables.insert(
            "systeme_scolaire".to_string(),
            detected_system.name.to_string(),
        );
        variables.insert(
            "langue_systeme".to_string(),
            detected_system.language.to_string(),
        );
        variables.insert(
            "devise_locale".to_string(),
            detected_system.currency.to_string(),
        );
        variables.insert("hierarchie_classes".to_string(), hierarchy_desc.clone());
        variables.insert(
            "programmes_disponibles".to_string(),
            programmes_info.clone(),
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
            // Fallback: construire un prompt hyper-contextuel directement
            format!(
                r#"Tu es un expert en analyse de livres scolaires pour la plateforme Yukpo.

CONTEXTE GÉOGRAPHIQUE ET ACADÉMIQUE:
- Localisation utilisateur: lat={lat}, lng={lng}
- Pays détecté: {country}
- Système scolaire: {system_name}
- Langue du système: {lang}
- Devise locale: {currency}

HIÉRARCHIE DES CLASSES ({system_name}):
{hierarchy}
IMPORTANT: La DERNIÈRE classe de la hiérarchie (marquée FIN) n'a PAS de classe supérieure → classe_souhaitee=null, le livre ne peut être que VENDU.

TON RÔLE - ANALYSER LES DEUX FACES DU LIVRE:
1. EXTRACTION: titre, auteur, éditeur, ISBN, classe du livre (classe_actuelle), matière, niveau
2. CLASSE SUPÉRIEURE (OBLIGATOIRE): L'élève a DÉJÀ UTILISÉ ce livre → il passe en classe supérieure.
   classe_souhaitee = classe IMMÉDIATEMENT SUPÉRIEURE selon la hiérarchie ci-dessus.
   Si c'est la dernière classe → classe_souhaitee=null.
3. PRIX & DEVISE: Chercher le prix imprimé, identifier la devise ({currency} par défaut)
4. ÉTAT: "bon", "acceptable" ou "rejete"
5. PROGRAMME SCOLAIRE: {programmes}

ADAPTATION INTELLIGENTE:
- Si le livre utilise des appellations différentes du système détecté, ADAPTE-TOI.
  Ex: un livre "Year 7" au Kenya = "Form 1", un livre "Classe de 6ème" au Sénégal = même que "6ème" au Cameroun.
- Utilise ta connaissance des systèmes éducatifs africains pour faire la correspondance.
- Si tu détectes que le livre vient d'un système DIFFÉRENT de celui de l'utilisateur, signale-le dans les notes.

Réponds en JSON strict avec: titre, auteur, editeur, isbn, classe_actuelle, classe_souhaitee, matiere, niveau, prix_detecte, devise_detectee, etat_classification, etat_description, est_au_programme, programme_scolaire_id, programme_match_details, confidence, notes."#,
                lat = lat,
                lng = lng,
                country = country_code.to_uppercase(),
                system_name = detected_system.name,
                lang = detected_system.language,
                currency = detected_system.currency,
                hierarchy = hierarchy_desc,
                programmes = programmes_info,
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

        // ✅ Fallback déterministe (GPS-aware): si l'IA a trouvé classe_actuelle mais pas classe_souhaitee,
        // ou si classe_souhaitee est incorrecte, on la recalcule en tenant compte du système scolaire détecté
        let mut analysis = analysis;
        if let Some(ref classe_act) = analysis.classe_actuelle {
            if is_classe_terminale(classe_act) {
                // Dernière classe du système (Terminale, Upper Sixth, SSS 3, etc.)
                // PAS de classe supérieure → classe_souhaitee = None, mode = vente
                log::info!(
                    "[BookExchangeAIService] Classe terminale détectée ({}): classe_souhaitee=None, mode=vente",
                    classe_act
                );
                analysis.classe_souhaitee = None;
            } else {
                let computed = compute_classe_superieure_with_gps(classe_act, user_lat, user_lng);
                if analysis.classe_souhaitee.is_none()
                    || analysis.classe_souhaitee.as_deref() == Some("")
                {
                    log::info!(
                        "[BookExchangeAIService] Fallback classe_souhaitee (système {}): {} → {}",
                        detected_system.name,
                        classe_act,
                        computed
                    );
                    analysis.classe_souhaitee = Some(computed);
                }
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
