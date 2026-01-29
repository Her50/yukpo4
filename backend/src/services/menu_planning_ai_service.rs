//! ✅ Service IA pour Planification Menus
//!
//! Ce service utilise l'IA pour :
//! - Générer des menus hebdomadaires personnalisés
//! - Suggérer des recettes selon préférences
//! - Calculer les quantités automatiquement
//! - Analyser la nutrition
//! - Optimiser le budget

use crate::core::types::{AppError, AppResult};
use crate::services::app_ia::AppIA;
use chrono::Datelike;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;

/// ✅ CORRECTION 2: Nettoie la réponse JSON en enlevant les markdown code blocks
/// L'IA peut retourner du JSON dans un bloc markdown (```json\n...\n```)
/// ✅ AMÉLIORATION: Gère aussi les JSON tronqués en les complétant
fn clean_json_response(response: &str) -> String {
    let mut cleaned = response.trim().to_string();

    // Enlever les markdown code blocks au début
    if cleaned.starts_with("```json") {
        cleaned = cleaned
            .strip_prefix("```json")
            .unwrap_or(&cleaned)
            .trim()
            .to_string();
    } else if cleaned.starts_with("```") {
        cleaned = cleaned
            .strip_prefix("```")
            .unwrap_or(&cleaned)
            .trim()
            .to_string();
    }

    // Enlever les markdown code blocks à la fin
    if cleaned.ends_with("```") {
        cleaned = cleaned
            .strip_suffix("```")
            .unwrap_or(&cleaned)
            .trim()
            .to_string();
    }

    // ✅ NOUVEAU: Compléter le JSON si tronqué
    cleaned = complete_truncated_json(&cleaned);

    // Enlever les sauts de ligne en début/fin
    cleaned.trim().to_string()
}

/// ✅ AMÉLIORÉ: Complète un JSON tronqué en fermant les structures ouvertes
/// Gère les cas où le JSON est coupé au milieu d'une chaîne, d'un objet ou d'un array
fn complete_truncated_json(json_str: &str) -> String {
    let mut result = json_str.trim().to_string();

    // Vérifier si le JSON est valide d'abord
    if serde_json::from_str::<serde_json::Value>(&result).is_ok() {
        return result; // JSON déjà valide, pas besoin de compléter
    }

    // ✅ AMÉLIORATION: Si le JSON se termine par des caractères incomplets, les enlever
    // Enlever les caractères de fin incomplets (virgules, deux-points, etc.)
    while result.ends_with(',') || result.ends_with(':') || result.ends_with(' ') {
        result.pop();
    }

    // Compter les accolades et crochets ouverts/fermés correctement
    let mut open_braces: i32 = 0;
    let mut close_braces: i32 = 0;
    let mut open_brackets: i32 = 0;
    let mut close_brackets: i32 = 0;
    let mut in_string = false;
    let mut escape_next = false;

    // Parcourir pour compter correctement (en tenant compte des strings)
    for ch in result.chars() {
        if escape_next {
            escape_next = false;
            continue;
        }

        match ch {
            '"' => in_string = !in_string,
            '\\' if in_string => escape_next = true,
            '{' if !in_string => open_braces += 1,
            '}' if !in_string => close_braces += 1,
            '[' if !in_string => open_brackets += 1,
            ']' if !in_string => close_brackets += 1,
            _ => {}
        }
    }

    // Calculer les structures à fermer
    let braces_to_close = open_braces.saturating_sub(close_braces);
    let brackets_to_close = open_brackets.saturating_sub(close_brackets);

    // Si on est dans une string à la fin, fermer la string
    if in_string {
        // Trouver la dernière quote ouverte et fermer la string
        let mut _last_quote_pos = 0;
        let mut in_str = false;
        let mut esc = false;

        for (i, ch) in result.char_indices() {
            if esc {
                esc = false;
                continue;
            }
            if ch == '\\' && in_str {
                esc = true;
                continue;
            }
            if ch == '"' {
                in_str = !in_str;
                if in_str {
                    _last_quote_pos = i;
                }
            }
        }

        // Si on est toujours dans une string à la fin, fermer la string
        if in_str {
            result.push('"');
        }
    }

    // ✅ AMÉLIORÉ: Retirer la dernière virgule si présente (pour éviter erreur de syntaxe)
    let trimmed = result.trim_end();
    if trimmed.ends_with(',') {
        result = trimmed.trim_end_matches(',').trim().to_string();
    }

    // ✅ AMÉLIORÉ: Fermer les structures ouvertes dans l'ordre inverse (d'abord les tableaux, puis les objets)
    // Fermer d'abord les tableaux ouverts
    for _ in 0..brackets_to_close {
        result.push(']');
    }
    // Puis fermer les objets ouverts
    for _ in 0..braces_to_close {
        result.push('}');
    }

    // ✅ NOUVEAU: Vérifier à nouveau si le JSON est maintenant valide
    // Si toujours invalide, essayer une approche plus agressive
    if serde_json::from_str::<serde_json::Value>(&result).is_err() {
        // Si le JSON est toujours invalide, essayer de trouver où il se termine vraiment
        // et compléter depuis là
        log::warn!("[MenuPlanningAIService] JSON toujours invalide après complétion, tentative de réparation avancée");

        // Trouver la dernière structure complète et fermer depuis là
        let mut last_valid_pos = 0;
        let mut test_str = String::new();
        let chars: Vec<char> = result.chars().collect();

        for i in (0..chars.len()).rev() {
            test_str.insert(0, chars[i]);
            if serde_json::from_str::<serde_json::Value>(&test_str).is_ok() {
                last_valid_pos = i;
                break;
            }
        }

        if last_valid_pos > 0 && last_valid_pos < result.len() {
            // Prendre seulement la partie valide et compléter
            result = result[..=last_valid_pos].to_string();
            // Recompter et fermer
            let mut ob: i32 = 0;
            let mut cb: i32 = 0;
            let mut oa: i32 = 0;
            let mut ca: i32 = 0;
            let mut in_s = false;
            let mut esc = false;

            for ch in result.chars() {
                if esc {
                    esc = false;
                    continue;
                }
                match ch {
                    '"' => in_s = !in_s,
                    '\\' if in_s => esc = true,
                    '{' if !in_s => ob += 1,
                    '}' if !in_s => cb += 1,
                    '[' if !in_s => oa += 1,
                    ']' if !in_s => ca += 1,
                    _ => {}
                }
            }

            // Retirer dernière virgule si présente
            if result.trim_end().ends_with(',') {
                result = result.trim_end().trim_end_matches(',').trim().to_string();
            }

            // Fermer les structures
            for _ in 0..(oa.saturating_sub(ca)) {
                result.push(']');
            }
            for _ in 0..(ob.saturating_sub(cb)) {
                result.push('}');
            }
        }
    }

    result
}

/// Profil famille pour personnalisation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FamilyProfile {
    pub total_members: i32,
    pub children_count: i32,
    pub adults_count: i32,
    pub preferences: Vec<String>, // végétarien, vegan, halal, etc.
    pub allergies: Vec<String>,
    pub dietary_restrictions: Vec<String>, // diabète, hypertension, etc.
    pub budget_monthly: Option<f64>,
    pub cuisine_styles: Vec<String>, // styles de cuisine (déterminés dynamiquement)
    pub cooking_level: Option<String>, // débutant, intermédiaire, avancé
    pub time_available_hours: Option<f64>,
}

/// Menu hebdomadaire généré par IA
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeeklyMenu {
    pub week_start: String, // Date format ISO
    pub meals: Vec<DailyMeal>,
    pub total_estimated_cost: Option<f64>,
    pub total_calories_per_day: Option<f64>,
    pub recommendations: Vec<String>,
}

/// Repas d'une journée
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyMeal {
    pub day: i32, // 1=lundi, 7=dimanche
    pub day_name: String,
    pub petit_dejeuner: Option<MealItem>,
    #[serde(alias = "dejeuner", alias = "diner")] // ✅ Compatibilité avec ancien format
    pub repas_du_jour: Option<MealItem>, // ✅ NOUVEAU: Fusion déjeuner/dîner (même repas midi et soir)
    pub gouter: Option<MealItem>,
    // ✅ DÉPRÉCIÉ: Gardé pour compatibilité descendante, mais ne sera plus utilisé
    // Ces champs ne peuvent jamais être remplis car serde désérialise dans repas_du_jour via les alias
    #[serde(skip_deserializing, skip_serializing_if = "Option::is_none", default)]
    #[allow(dead_code)]
    pub dejeuner: Option<MealItem>,
    #[serde(skip_deserializing, skip_serializing_if = "Option::is_none", default)]
    #[allow(dead_code)]
    pub diner: Option<MealItem>,
}

/// Item de repas
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MealItem {
    pub recipe_name: String,
    pub recipe_id: Option<i32>,
    pub servings: i32,
    pub prep_time_minutes: Option<i32>,
    pub estimated_cost: Option<f64>,
    pub calories: Option<f64>,
    #[serde(default)] // ✅ NOUVEAU: Compléments pour repas complet
    pub complements: Vec<String>, // Ex: ["Riz", "Légumes"] pour un repas complet
}

/// Suggestion de recette par IA
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecipeSuggestion {
    pub recipe_id: Option<i32>,
    pub name: String,
    pub description: String,
    pub cuisine_style: Option<String>,
    pub meal_type: Vec<String>,
    pub difficulty: Option<String>,
    pub prep_time_minutes: Option<i32>,
    pub estimated_cost: Option<f64>,
    pub match_score: f64, // 0-1, score de correspondance avec préférences
    pub reasoning: String,
}

/// Analyse nutritionnelle
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NutritionAnalysis {
    pub total_calories: f64,
    pub total_proteins: f64,
    pub total_carbs: f64,
    pub total_fats: f64,
    pub total_fiber: f64,
    pub daily_average: DailyNutritionAverage,
    pub recommendations: Vec<String>,
}

/// Moyenne nutritionnelle journalière
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyNutritionAverage {
    pub calories: f64,
    pub proteins: f64,
    pub carbs: f64,
    pub fats: f64,
    pub fiber: f64,
}

/// Service IA pour Planification Menus
pub struct MenuPlanningAIService {
    app_ia: Arc<AppIA>,
}

impl MenuPlanningAIService {
    pub fn new(app_ia: Arc<AppIA>) -> Self {
        Self { app_ia }
    }

    /// ✅ NOUVEAU: Génère un menu hebdomadaire intelligent avec contextes dynamiques
    pub async fn generate_weekly_menu_intelligent(
        &self,
        profile: &FamilyProfile,
        week_start: &str,
        user_country: Option<&str>,
        user_city: Option<&str>,
        previous_menus: &[WeeklyMenu],
    ) -> AppResult<WeeklyMenu> {
        // Extraire les recettes des menus précédents
        let previous_recipes: Vec<String> = previous_menus
            .iter()
            .flat_map(|menu| {
                menu.meals.iter().flat_map(|meal| {
                    vec![
                        meal.petit_dejeuner.as_ref().map(|m| m.recipe_name.clone()),
                        meal.repas_du_jour.as_ref().map(|m| m.recipe_name.clone()),
                        // ✅ Compatibilité: aussi extraire dejeuner/diner si présents (ancien format)
                        meal.dejeuner.as_ref().map(|m| m.recipe_name.clone()),
                        meal.diner.as_ref().map(|m| m.recipe_name.clone()),
                    ]
                    .into_iter()
                    .flatten()
                })
            })
            .collect();

        // Construire le prompt enrichi avec contextes intelligents
        let prompt = self.build_intelligent_prompt(
            profile,
            week_start,
            user_country,
            user_city,
            &previous_recipes,
        );

        let (model_name, response, tokens) = self.app_ia.predict(&prompt).await?;
        log::info!(
            "[MenuPlanningAIService] Menu intelligent généré avec {} (tokens: {})",
            model_name,
            tokens
        );

        let cleaned_response = clean_json_response(&response);
        let mut menu: WeeklyMenu = match serde_json::from_str(&cleaned_response) {
            Ok(m) => m,
            Err(e) => {
                log::error!(
                    "[MenuPlanningAIService] Erreur parsing JSON: {} | Réponse: {}",
                    e,
                    cleaned_response
                );
                self.create_fallback_menu(profile, week_start)
            }
        };

        // ✅ NOUVEAU: Validation - S'assurer que le menu contient 7 jours
        if menu.meals.len() < 7 {
            log::warn!(
                "[MenuPlanningAIService] Menu incomplet: {} jours au lieu de 7. Complétion automatique...",
                menu.meals.len()
            );

            // Compléter avec des jours manquants
            let day_names = vec![
                "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche",
            ];
            let existing_days: std::collections::HashSet<i32> =
                menu.meals.iter().map(|m| m.day).collect();

            for day in 1..=7 {
                if !existing_days.contains(&day) {
                    menu.meals.push(DailyMeal {
                        day,
                        day_name: day_names[(day - 1) as usize].to_string(),
                        petit_dejeuner: Some(MealItem {
                            recipe_name: "Menu en cours de génération".to_string(),
                            recipe_id: None,
                            servings: profile.total_members,
                            prep_time_minutes: None,
                            estimated_cost: None,
                            calories: None,
                            complements: vec![],
                        }),
                        repas_du_jour: Some(MealItem {
                            recipe_name: "Menu en cours de génération".to_string(),
                            recipe_id: None,
                            servings: profile.total_members,
                            prep_time_minutes: None,
                            estimated_cost: None,
                            calories: None,
                            complements: vec![],
                        }),
                        gouter: None,
                        dejeuner: None,
                        diner: None,
                    });
                }
            }

            // Trier les repas par jour
            menu.meals.sort_by_key(|m| m.day);
        }

        // ✅ NOUVEAU: Validation - S'assurer que chaque jour a petit_dejeuner ET repas_du_jour
        for meal in &mut menu.meals {
            // Vérifier que petit_dejeuner est présent
            if meal.petit_dejeuner.is_none() {
                log::warn!(
                    "[MenuPlanningAIService] Petit-déjeuner manquant pour {}, ajout d'un repas par défaut",
                    meal.day_name
                );
                meal.petit_dejeuner = Some(MealItem {
                    recipe_name: "Menu en cours de génération".to_string(),
                    recipe_id: None,
                    servings: profile.total_members,
                    prep_time_minutes: None,
                    estimated_cost: Some(500.0),
                    calories: None,
                    complements: vec![],
                });
            }

            // ✅ CRITIQUE: Vérifier que repas_du_jour est présent
            if meal.repas_du_jour.is_none() {
                log::warn!(
                    "[MenuPlanningAIService] ⚠️ REPAS_DU_JOUR MANQUANT pour {} - AJOUT D'UN REPAS PAR DÉFAUT",
                    meal.day_name
                );
                meal.repas_du_jour = Some(MealItem {
                    recipe_name: "Menu en cours de génération".to_string(),
                    recipe_id: None,
                    servings: profile.total_members,
                    prep_time_minutes: None,
                    estimated_cost: Some(1500.0),
                    calories: None,
                    complements: vec![],
                });
            }
        }

        // ✅ NOUVEAU: Validation - S'assurer que tous les repas ont des coûts estimés
        let mut total_cost = 0.0;
        for meal in &mut menu.meals {
            if let Some(ref mut petit_dej) = meal.petit_dejeuner {
                if petit_dej.estimated_cost.is_none() {
                    petit_dej.estimated_cost = Some(500.0); // Coût par défaut
                }
                total_cost += petit_dej.estimated_cost.unwrap_or(0.0);
            }
            if let Some(ref mut repas_jour) = meal.repas_du_jour {
                if repas_jour.estimated_cost.is_none() {
                    repas_jour.estimated_cost = Some(1500.0); // Coût par défaut
                }
                // ✅ CORRIGÉ: repas_du_jour est le même repas pour midi et soir, donc le coût est déjà pour les 2 repas
                // Pas besoin de multiplier par 2 car estimated_cost représente déjà le coût total de préparation
                total_cost += repas_jour.estimated_cost.unwrap_or(0.0);
            } else if meal.dejeuner.is_some() || meal.diner.is_some() {
                // Compatibilité avec ancien format
                if let Some(ref mut dejeuner) = meal.dejeuner {
                    if dejeuner.estimated_cost.is_none() {
                        dejeuner.estimated_cost = Some(1500.0);
                    }
                    total_cost += dejeuner.estimated_cost.unwrap_or(0.0);
                }
                if let Some(ref mut diner) = meal.diner {
                    if diner.estimated_cost.is_none() {
                        diner.estimated_cost = Some(1500.0);
                    }
                    total_cost += diner.estimated_cost.unwrap_or(0.0);
                }
            }
            if let Some(ref mut gouter) = meal.gouter {
                if gouter.estimated_cost.is_none() {
                    gouter.estimated_cost = Some(300.0);
                }
                total_cost += gouter.estimated_cost.unwrap_or(0.0);
            }
        }

        // Mettre à jour le coût total estimé
        menu.total_estimated_cost = Some(total_cost);

        Ok(menu)
    }

    /// Génère un menu hebdomadaire personnalisé (version originale - gardée pour compatibilité)
    pub async fn generate_weekly_menu(
        &self,
        profile: &FamilyProfile,
        week_start: &str,
    ) -> AppResult<WeeklyMenu> {
        // Utiliser la version intelligente avec contextes vides
        self.generate_weekly_menu_intelligent(profile, week_start, None, None, &[])
            .await
    }

    /// ✅ NOUVEAU: Construit le prompt intelligent avec contextes dynamiques
    fn build_intelligent_prompt(
        &self,
        profile: &FamilyProfile,
        week_start: &str,
        user_country: Option<&str>,
        user_city: Option<&str>,
        previous_recipes: &[String],
    ) -> String {
        let preferences_str = profile.preferences.join(", ");
        let allergies_str = if profile.allergies.is_empty() {
            "Aucune".to_string()
        } else {
            profile.allergies.join(", ")
        };
        let restrictions_str = if profile.dietary_restrictions.is_empty() {
            "Aucune".to_string()
        } else {
            profile.dietary_restrictions.join(", ")
        };

        // ✅ CONTEXTE 1: Localité culinaire (utiliser les préférences du profil si disponibles)
        let cuisine_str = if !profile.cuisine_styles.is_empty() {
            profile.cuisine_styles.join(", ")
        } else {
            // Si aucune préférence, l'IA déterminera automatiquement basé sur le pays/ville
            String::new()
        };

        let budget_str = profile
            .budget_monthly
            .map(|b| format!("{:.2} FCFA", b))
            .unwrap_or_else(|| "Non spécifié".to_string());

        // ✅ AMÉLIORÉ 2026-01-13: Calculer le budget hebdomadaire proratisé (budget_mensuel / 30 jours * 7 jours)
        // Plus précis que l'approximation 4.33 semaines, et cohérent avec le calcul pour la liste de courses
        let weekly_budget_str = profile
            .budget_monthly
            .map(|b| {
                let weekly = (b / 30.0) * 7.0; // Proratisation : budget_mensuel / 30 jours * 7 jours
                format!("{:.2} FCFA", weekly)
            })
            .unwrap_or_else(|| "Non calculable (budget non spécifié)".to_string());

        // ✅ CONTEXTE 2: Localité géographique (détection dynamique) - AMÉLIORÉ pour contextualisation linguistique
        let location_context = if let (Some(country), Some(city)) = (user_country, user_city) {
            if !cuisine_str.is_empty() {
                // Si l'utilisateur a spécifié des préférences culinaires, les utiliser
                format!(
                    "\n\n🌍 CONTEXTE GÉOGRAPHIQUE ET LINGUISTIQUE (CRITIQUE - LIRE ATTENTIVEMENT) :\n\
                    - Pays de résidence : {}\n\
                    - Ville : {}\n\
                    - CUISINE PRÉFÉRÉE : {}\n\
                    - PRIORITÉ ABSOLUE : Plats traditionnels locaux adaptés à {}, ingrédients disponibles localement, recettes authentiques\n\
                    - LANGAGE CULINAIRE (CRITIQUE) : Tu DOIS utiliser EXACTEMENT le langage culinaire de {} ({})\n\
                      * Utilise les noms de plats dans la langue locale de la région\n\
                      * Utilise les noms d'ingrédients dans la langue locale de la région\n\
                      * Respecte les appellations culinaires authentiques de la région de {}\n\
                      * N'utilise JAMAIS de noms de plats étrangers inadaptés (ex: ne pas dire \"Pasta\" ou \"Sushi\" pour un résident de {})\n\
                    - INGRÉDIENTS LOCAUX : Utilise uniquement les ingrédients typiques et disponibles localement à {}\n\
                      * Privilégie les ingrédients du marché local de {}\n\
                      * Évite les ingrédients importés ou difficiles à trouver à {}\n\
                    - TRADITIONS CULINAIRES : Respecte les traditions culinaires et les habitudes alimentaires de {}\n\
                      * Respecte les heures de repas typiques de {}\n\
                      * Respecte les combinaisons de plats traditionnelles de {}\n\
                    - ADAPTATION : Adapte les plats de la cuisine {} aux ingrédients et traditions de {}",
                    country, city, cuisine_str, city, country, city, city, country, city, city, city, city, city, city, cuisine_str, country
                )
            } else {
                // Sinon, laisser l'IA déterminer intelligemment la cuisine appropriée
                format!(
                    "\n\n🌍 CONTEXTE GÉOGRAPHIQUE ET LINGUISTIQUE (CRITIQUE - LIRE ATTENTIVEMENT) :\n\
                    - Pays de résidence : {}\n\
                    - Ville : {}\n\
                    - DÉTECTION AUTOMATIQUE : Tu DOIS déterminer intelligemment la cuisine traditionnelle de {} ({})\n\
                    - PRIORITÉ ABSOLUE : Proposer UNIQUEMENT des plats de la cuisine locale traditionnelle de {}\n\
                    - INTERDICTION STRICTE : Ne JAMAIS proposer de plats de cuisines étrangères inadaptées \
                    (ex: ne pas proposer de menu chinois, japonais, italien, mexicain à un résident de {})\n\
                    - LANGAGE CULINAIRE (CRITIQUE) : Tu DOIS utiliser EXACTEMENT le langage culinaire de {} ({})\n\
                      * Utilise les noms de plats dans la langue locale de {}\n\
                      * Utilise les noms d'ingrédients dans la langue locale de {} (ex: \"Tomate\", \"Oignon\", \"Ail\", \"Gombo\", \"Feuilles de manioc\", \"Plantain\")\n\
                      * Respecte les appellations culinaires authentiques de la région de {}\n\
                      * N'utilise JAMAIS de noms de plats étrangers inadaptés (ex: ne pas dire \"Pasta\", \"Sushi\", \"Tacos\" pour un résident de {})\n\
                      * Si tu ne connais pas les noms locaux exacts, utilise des descriptions adaptées au contexte de {}\n\
                    - INGRÉDIENTS LOCAUX : Utilise uniquement les ingrédients typiques et disponibles localement à {}\n\
                      * Privilégie les ingrédients du marché local de {}\n\
                      * Évite les ingrédients importés ou difficiles à trouver à {}\n\
                      * Consulte tes connaissances sur les ingrédients disponibles dans les marchés de {}\n\
                    - TRADITIONS CULINAIRES : Respecte les traditions culinaires et les habitudes alimentaires de {}\n\
                      * Respecte les heures de repas typiques de {}\n\
                      * Respecte les combinaisons de plats traditionnelles de {}\n\
                      * Respecte les méthodes de cuisson traditionnelles de {}\n\
                    - CONTEXTE MARCHÉ : Adapte les prix estimés selon la réalité du marché local de {}",
                    country, city, country, city, country, country, country, city, country, city, country, country, country, country, city, city, city, city, city, city, city, city
                )
            }
        } else if let Some(country) = user_country {
            if !cuisine_str.is_empty() {
                format!(
                    "\n\n🌍 CONTEXTE GÉOGRAPHIQUE ET LINGUISTIQUE (CRITIQUE) :\n\
                    - Pays de résidence : {}\n\
                    - CUISINE PRÉFÉRÉE : {}\n\
                    - PRIORITÉ : Plats traditionnels locaux adaptés, ingrédients disponibles localement\n\
                    - LANGAGE CULINAIRE : Utilise les noms de plats dans la langue locale de {}\n\
                    - INGRÉDIENTS LOCAUX : Utilise uniquement les ingrédients typiques et disponibles localement dans {}\n\
                    - TRADITIONS : Respecte les traditions culinaires de {}",
                    country, cuisine_str, country, country, country
                )
            } else {
                format!(
                    "\n\n🌍 CONTEXTE GÉOGRAPHIQUE ET LINGUISTIQUE (CRITIQUE) :\n\
                    - Pays de résidence : {}\n\
                    - DÉTECTION AUTOMATIQUE : Tu DOIS déterminer intelligemment la cuisine traditionnelle de {}\n\
                    - PRIORITÉ ABSOLUE : Proposer UNIQUEMENT des plats de la cuisine locale traditionnelle de {}\n\
                    - INTERDICTION STRICTE : Ne JAMAIS proposer de plats de cuisines étrangères inadaptées\n\
                    - LANGAGE CULINAIRE (CRITIQUE) : Utilise les noms de plats dans la langue locale de {}\n\
                      * Utilise les appellations culinaires authentiques de {}\n\
                      * N'utilise JAMAIS de noms de plats étrangers inadaptés\n\
                    - INGRÉDIENTS LOCAUX : Utilise uniquement les ingrédients typiques et disponibles localement dans {}\n\
                    - TRADITIONS : Respecte les traditions culinaires de {}",
                    country, country, country, country, country, country, country
                )
            }
        } else {
            String::new()
        };

        // ✅ CONTEXTE 3: Saisonnalité (mois actuel)
        let now = chrono::Utc::now();
        let current_month = now.month();
        let month_name = Self::get_month_name_fr(current_month);
        let seasonal_context = if let Some(country) = user_country {
            format!(
                "\n\n🌱 SAISONNALITÉ (CRITIQUE - Mois actuel: {}) :\n\
                - Pays : {}\n\
                - CONTRAINTE STRICTE : Utilise UNIQUEMENT les ingrédients de saison pour ce pays en {}\n\
                - INTERDICTION : Ne JAMAIS proposer d'ingrédients hors saison (cher, moins frais, moins disponible)\n\
                - PRIORITÉ : Privilégier les fruits et légumes de saison pour optimiser coût et qualité\n\
                - ADAPTATION : Consulte tes connaissances sur les saisons agricoles de {} et propose uniquement \
                les ingrédients disponibles naturellement en ce moment",
                month_name, country, month_name, country
            )
        } else {
            format!(
                "\n\n🌱 SAISONNALITÉ (CRITIQUE - Mois actuel: {}) :\n\
                - CONTRAINTE STRICTE : Utilise UNIQUEMENT les ingrédients de saison pour le mois de {}\n\
                - INTERDICTION : Ne JAMAIS proposer d'ingrédients hors saison\n\
                - PRIORITÉ : Privilégier les fruits et légumes de saison",
                month_name, month_name
            )
        };

        // ✅ CONTEXTE 4: Variation temporelle - AMÉLIORÉ pour éviter répétitions
        let variation_context = if !previous_recipes.is_empty() {
            let recipes_list = previous_recipes
                .iter()
                .take(30) // Augmenté à 30 pour mieux éviter les répétitions
                .map(|r| format!("- {}", r))
                .collect::<Vec<_>>()
                .join("\n");
            format!(
                "\n\n🔄 VARIATION TEMPORELLE (CRITIQUE - LIRE ATTENTIVEMENT) :\n\
                - HISTORIQUE DES PLATS RÉCENTS (INTERDICTION DE RÉPÉTER) :\n{}\n\
                - CONTRAINTE ABSOLUE : Tu DOIS générer un menu COMPLÈTEMENT DIFFÉRENT des menus précédents\n\
                - INTERDICTION STRICTE : Ne JAMAIS proposer les mêmes plats que dans l'historique ci-dessus\n\
                - OBJECTIF PRINCIPAL : VARIER au maximum l'alimentation avec de NOUVEAUX plats\n\
                - PRIORITÉ ABSOLUE : Nouveaux plats, nouvelles recettes, nouvelles combinaisons, nouveaux accompagnements\n\
                - Si un plat similaire est nécessaire : Varier au moins la préparation, les épices, ou les accompagnements\n\
                - CRÉATIVITÉ : Sois créatif et propose des plats variés et différents à chaque génération\n\
                - DIVERSITÉ : Assure-toi que chaque jour du menu propose des plats différents les uns des autres ET différents de l'historique",
                recipes_list
            )
        } else {
            "\n\n🔄 VARIATION TEMPORELLE :\n- Aucun menu précédent, liberté totale dans le choix des plats\n- Sois créatif et varié dans tes propositions".to_string()
        };

        // ✅ NOUVEAU: Ajouter un timestamp pour forcer la variation même sans historique
        let timestamp_variation = format!(
            "\n\n⏰ CONTEXTE TEMPOREL :\n\
            - Date de génération : {}\n\
            - Semaine : {}\n\
            - CONTRAINTE : Génère un menu UNIQUE et VARIÉ pour cette période spécifique\n\
            - CRÉATIVITÉ : Utilise cette date comme source d'inspiration pour varier les plats",
            chrono::Utc::now().format("%Y-%m-%d %H:%M:%S"),
            week_start
        );

        let prompt = format!(
            r#"
Tu es l'assistant culinaire intelligent de Yukpo pour la planification de menus.

👥 CONTEXTE FAMILLE :
- Nombre total de personnes : {}
- Enfants : {}, Adultes : {}
- Préférences alimentaires : {}
- Allergies : {}
- Restrictions diététiques : {}
- Styles de cuisine : {}
- Budget mensuel : {}
- Niveau cuisine : {:?}
- Temps disponible : {:?} heures/jour
{}{}{}{}

🎯 TON RÔLE (CRITIQUE - LIRE ATTENTIVEMENT) :
- Tu DOIS générer un MENU HEBDOMADAIRE avec des REPAS CONCRETS, COMPLETS et RÉELS
- ⚠️ OBLIGATION ABSOLUE : Chaque jour DOIT avoir OBLIGATOIREMENT petit-déjeuner ET repas_du_jour
- ⚠️ INTERDICTION ABSOLUE : Ne JAMAIS générer seulement le petit-déjeuner sans le repas_du_jour
- ⚠️ INTERDICTION ABSOLUE : Ne JAMAIS générer seulement le repas_du_jour sans le petit-déjeuner
- ⚠️ INTERDICTION ABSOLUE : Ne JAMAIS omettre le repas_du_jour pour un jour
- repas_du_jour est le même repas pour midi ET soir (habitude locale)
- Chaque repas DOIT être COMPLET : plat principal + accompagnements/compléments si nécessaire
- Tu NE DOIS PAS inventer des plats qui n'existent pas dans la localité
- Tu DOIS utiliser UNIQUEMENT des plats RÉELS et TRADITIONNELS de la région
- Adapter les quantités au nombre de personnes ({})
- Respecter allergies et restrictions
- 💰 OPTIMISER LE BUDGET (CRITIQUE) :
  * Le budget mensuel de la famille est : {}
  * Budget hebdomadaire approximatif : {} (budget_mensuel / 4.33)
  * Le coût total estimé du menu hebdomadaire DOIT respecter ce budget hebdomadaire
  * CALCUL DES COÛTS PAR REPAS (CRITIQUE) :
    - Chaque repas (petit_dejeuner, repas_du_jour, gouter) DOIT avoir un "estimated_cost" réaliste
    - Le coût de chaque repas DOIT tenir compte du nombre de personnes ({}) dans la famille
    - Le coût de chaque repas DOIT être adapté au budget disponible (budget hebdomadaire / nombre de repas)
    - Calculer le coût total du repas pour toutes les personnes, pas le coût par personne
  * ADAPTATION SELON LE BUDGET :
    - Si le budget est limité, privilégier des plats économiques mais nutritifs (coûts réduits par repas)
    - Si le budget est confortable, permettre des plats plus variés et raffinés (coûts plus élevés par repas)
  * ADAPTATION SELON LE NOMBRE DE PERSONNES :
    - Les coûts DOIVENT être proportionnels au nombre de personnes ({})
    - Un repas pour 2 personnes coûte moins cher qu'un repas pour 8 personnes
  * RÉALISME DES PRIX :
    - Les prix estimés DOIVENT être réalistes pour le nombre de personnes ({}) et le contexte local
    - Adapter les prix selon la réalité du marché local de la région
  * VALIDATION :
    - Chaque repas DOIT avoir un "estimated_cost" cohérent avec le budget total disponible
    - Vérifier que la somme de tous les "estimated_cost" ≈ budget hebdomadaire
- Varier les repas pour éviter la monotonie
- RESPECTER STRICTEMENT les contextes géographique, saisonnier et de variation ci-dessus

🌅 RÈGLES STRICTES SUR LE PETIT-DÉJEUNER (CRITIQUE - PRIORITÉ ABSOLUE) :
1. NATURE DU PETIT-DÉJEUNER :
   - Le petit-déjeuner DOIT être un repas typique du matin selon les habitudes alimentaires de la zone géographique
   - Ne JAMAIS proposer des plats de midi/soir pour le petit-déjeuner (plats en sauce, plats complets du midi/soir, etc.)
   - Le petit-déjeuner DOIT être adapté aux habitudes locales du matin (bouillie, pain + beurre/confiture, beignets, omelette, thé/café + accompagnements, etc.)
   - INTERDICTION : Ne JAMAIS proposer des plats en sauce ou des plats complets du midi/soir pour le petit-déjeuner
   - Le petit-déjeuner DOIT être adapté aux habitudes locales du matin

2. COHÉRENCE GÉOGRAPHIQUE ET LINGUISTIQUE :
   - Utilise EXACTEMENT les noms de plats dans la LANGUE LOCALE de la région (même langue que l'utilisateur)
   - Respecte les habitudes de consommation locales du petit-déjeuner
   - Ne JAMAIS utiliser des noms de plats étrangers inadaptés à la région
   - Si tu ne connais pas les noms locaux exacts, utilise des descriptions adaptées au contexte géographique

3. COMPLÉMENTS DU PETIT-DÉJEUNER :
   - Le petit-déjeuner DOIT être complet selon les habitudes locales
   - Si un petit-déjeuner nécessite des compléments (ex: pain + beurre, thé + beignets), tu DOIS les préciser dans "complements"
   - Ne JAMAIS proposer un petit-déjeuner incomplet ou partiel
   - Le champ "complements" est un array de strings (peut être vide [] si le petit-déjeuner est déjà complet sans complément)

🚨 RÈGLES ABSOLUES SUR LES REPAS COMPLETS (CRITIQUE - PRIORITÉ ABSOLUE - LIRE TRÈS ATTENTIVEMENT) :
1. PRINCIPE FONDAMENTAL - REPAS COMPLET OBLIGATOIRE :
   - Chaque repas DOIT être un repas COMPLET et ÉQUILIBRÉ selon les habitudes alimentaires locales
   - INTERDICTION ABSOLUE : Ne JAMAIS générer un repas incomplet, partiel ou sans compléments nécessaires
   - RÈGLE GÉNÉRALE CRITIQUE : Dans les cuisines africaines/locales, la MAJORITÉ des plats nécessitent des compléments
   - RÈGLE GÉNÉRALE : Un plat en sauce, un plat de légumes, un plat de viande/poisson nécessitent OBLIGATOIREMENT un complément (riz, plantain, igname, etc.)
   - RÈGLE GÉNÉRALE : Un plat de féculents seul (riz, plantain, etc.) nécessite OBLIGATOIREMENT un complément (sauce, viande, légumes)
   - Seulement EXCEPTION RARE : Quelques plats très spécifiques peuvent être complets sans complément (ex: certaines bouillies complètes du petit-déjeuner)
   
2. VALIDATION OBLIGATOIRE AVANT GÉNÉRATION (CRITIQUE - À FAIRE POUR CHAQUE REPAS) :
   - Pour CHAQUE repas généré, tu DOIS TOUJOURS te poser cette question : "Ce plat nécessite-t-il un complément selon les traditions locales ?"
   - Si la réponse est OUI (ce qui est le cas pour la plupart des plats), tu DOIS OBLIGATOIREMENT ajouter les compléments dans "complements"
   - Si tu n'es pas CERTAIN à 100% qu'un plat est complet sans complément, tu DOIS ajouter des compléments
   - Mieux vaut avoir des compléments même si ce n'est pas strictement nécessaire, que de générer un repas incomplet
   
3. COMPLÉMENTS OBLIGATOIRES - RÈGLES STRICTES :
   - Le champ "complements" est un array de strings OBLIGATOIRE
   - Le champ "complements" DOIT contenir au moins un élément pour la MAJORITÉ des plats (sauf exceptions rares)
   - Si un plat nécessite un complément, tu DOIS TOUJOURS le préciser dans "complements" - JAMAIS laisser vide []
   - Les compléments DOIVENT être cohérents avec le plat ET les traditions culinaires locales
   - Exemples de compléments typiques : Riz, Plantain, Igname, Pâte de maïs, Fufu, Légumes, etc.
   - INTERDICTION : Ne JAMAIS laisser "complements" vide [] sauf si tu es ABSOLUMENT CERTAIN que le plat est complet sans complément (exceptions rares)
   
4. COHÉRENCE CULINAIRE ET GÉOGRAPHIQUE :
   - Les compléments DOIVENT être adaptés au plat principal ET aux habitudes alimentaires de la zone géographique
   - Respecter STRICTEMENT les traditions culinaires locales de la région
   - Utilise tes connaissances sur les combinaisons culinaires traditionnelles de la région
   - Ne JAMAIS proposer des combinaisons incohérentes avec les habitudes locales
   - Utilise la MÊME LANGUE que l'utilisateur pour les noms de plats et compléments
   
5. PLATS RÉELS UNIQUEMENT SELON LA ZONE GÉOGRAPHIQUE :
   - Utilise UNIQUEMENT des plats qui existent réellement dans la cuisine locale de la région
   - Ne JAMAIS inventer des noms de plats
   - Utilise tes connaissances sur les plats traditionnels de la région spécifique
   - Si tu ne connais pas un plat local, ne l'invente pas - utilise un plat réel que tu connais pour cette région
   
6. VALIDATION FINALE OBLIGATOIRE AVANT RETOUR DU JSON (CRITIQUE - DERNIÈRE ÉTAPE) :
   - AVANT de générer le JSON final, tu DOIS vérifier CHAQUE repas des 7 jours
   - Pour CHAQUE repas (petit_dejeuner, repas_du_jour), pose-toi cette question : "Ce repas est-il complet selon les habitudes locales ?"
   - Si un repas n'a pas de compléments et que tu n'es pas CERTAIN qu'il est complet sans complément, tu DOIS ajouter des compléments
   - INTERDICTION ABSOLUE : Ne JAMAIS retourner un JSON avec des repas incomplets ou sans compléments nécessaires
   - Si tu trouves un repas incomplet, CORRIGE-LE avant de retourner le JSON

📋 RÉPONSE ATTENDUE (JSON strict) :
{{
    "week_start": "2024-01-01",
    "meals": [
        {{
            "day": 1,
            "day_name": "Lundi",
            "petit_dejeuner": {{
                "recipe_name": "Nom du plat complet",
                "complements": ["Complément 1", "Complément 2"],
                "servings": 4,
                "prep_time_minutes": 15,
                "estimated_cost": 500.0,
                "calories": 400.0
            }},
            "repas_du_jour": {{
                "recipe_name": "Nom du plat principal",
                "complements": ["Riz", "Légumes"],
                "servings": 4,
                "prep_time_minutes": 30,
                "estimated_cost": 1500.0,
                "calories": 600.0
            }},
            "gouter": {{
                "recipe_name": "Nom du plat",
                "complements": [],
                "servings": 4,
                "prep_time_minutes": 10,
                "estimated_cost": 300.0,
                "calories": 200.0
            }}
        }},
        // ... pour chaque jour (1-7)
    ],
    "total_estimated_cost": 35000.0,
    "total_calories_per_day": 2000.0,
    "recommendations": ["Recommandation 1", "Recommandation 2"]
}}

⚠️ NOTE IMPORTANTE SUR LES COÛTS :
- estimated_cost = PRIX TOTAL du repas pour TOUTES les personnes (nombre de personnes: {})
- Le coût DOIT être adapté au budget hebdomadaire disponible ({})
- Le coût DOIT être réaliste selon le marché local et le nombre de personnes
- total_estimated_cost = somme de tous les estimated_cost de tous les repas de la semaine
- Le total_estimated_cost DOIT respecter le budget hebdomadaire disponible
        }},
        // ... pour chaque jour (1-7)
    ],
    "total_estimated_cost": 35000.0,
    "total_calories_per_day": 2000.0,
    "recommendations": ["Recommandation 1", "Recommandation 2"]
}}

✅ RÈGLES CRITIQUES (LIRE ATTENTIVEMENT) :
- LANGAGE CULINAIRE LOCAL (PRIORITÉ ABSOLUE) :
  * Utilise EXACTEMENT les noms de plats dans la langue locale de la région de l'utilisateur
  * Utilise les appellations culinaires authentiques de la région
  * N'utilise JAMAIS de noms de plats étrangers inadaptés (ex: ne pas dire "Pasta", "Sushi", "Tacos" pour un résident d'Afrique centrale)
  * Si tu ne connais pas les noms locaux exacts, utilise des descriptions adaptées au contexte géographique
- INGRÉDIENTS LOCAUX :
  * Utilise uniquement les ingrédients typiques et disponibles localement dans les marchés de la région
  * Privilégie les ingrédients du marché local (ex: plantain, manioc, igname, feuilles locales)
  * Évite les ingrédients importés ou difficiles à trouver localement
- REPAS_DU_JOUR (CRITIQUE) :
  * "repas_du_jour" est le même repas pour midi ET soir (habitude locale)
  * C'est généralement le même plat qui est mangé à midi et le soir dans les ménages
  * Ne JAMAIS proposer deux plats différents pour midi et soir
- Les quantités doivent être adaptées au nombre de personnes ({})
- Respecter strictement les allergies
- Varier les types de plats
- RESPECTER la localité culinaire (pas de cuisines inadaptées)
- 💰 PRIX ESTIMÉS DES REPAS (CRITIQUE - LIRE ATTENTIVEMENT) :
  * Le budget mensuel de la famille est : {}
  * Budget hebdomadaire proratisé : {} (budget_mensuel / 30 jours × 7 jours)
  * Le coût total estimé du menu hebdomadaire DOIT respecter ce budget hebdomadaire
  * CALCUL DES COÛTS PAR REPAS (CRITIQUE) :
    - Chaque repas (petit_dejeuner, repas_du_jour, gouter) DOIT avoir un "estimated_cost" réaliste
    - Le coût de chaque repas DOIT tenir compte du nombre de personnes ({}) dans la famille
    - Le coût de chaque repas DOIT être adapté au budget disponible (budget hebdomadaire / nombre de repas)
    - Exemple de calcul : Si budget hebdomadaire = 50000 FCFA pour 7 jours avec 2 repas/jour (petit-déjeuner + repas_du_jour) = 14 repas
      → Coût moyen par repas ≈ 3571 FCFA, mais adapter selon le type de repas (petit-déjeuner moins cher, repas_du_jour plus cher)
  * ADAPTATION SELON LE BUDGET :
    - Si le budget est limité, privilégier des plats économiques mais nutritifs (coûts réduits par repas)
    - Si le budget est confortable, permettre des plats plus variés et raffinés (coûts plus élevés par repas)
  * ADAPTATION SELON LE NOMBRE DE PERSONNES :
    - Les coûts DOIVENT être proportionnels au nombre de personnes ({})
    - Un repas pour 2 personnes coûte moins cher qu'un repas pour 8 personnes
    - Calculer le coût total du repas pour toutes les personnes, pas le coût par personne
  * RÉALISME DES PRIX :
    - Adapter les prix selon la réalité du marché local de la région
    - Utiliser tes connaissances sur les prix moyens dans la région
    - Les prix DOIVENT être réalistes pour le nombre de personnes ({}) et le contexte local
  * VALIDATION FINALE :
    - Vérifier que la somme de tous les "estimated_cost" des repas de la semaine ≈ budget hebdomadaire
    - Le "total_estimated_cost" DOIT être cohérent avec le budget hebdomadaire disponible
    - Chaque repas DOIT avoir un "estimated_cost" cohérent avec le budget total disponible

⚠️ VALIDATION FINALE OBLIGATOIRE AVANT GÉNÉRATION DU JSON (CRITIQUE - DERNIÈRE ÉTAPE) :
- AVANT de générer le JSON, tu DOIS vérifier CHAQUE repas des 7 jours
- Pour CHAQUE repas (petit_dejeuner, repas_du_jour), vérifie :
  1. Le repas a-t-il un "recipe_name" avec un nom de plat CONCRET et RÉEL ? (OUI obligatoire)
  2. Le repas est-il COMPLET selon les habitudes locales ? (OUI obligatoire)
  3. Si le repas nécessite des compléments, sont-ils présents dans "complements" ? (OUI obligatoire)
  4. Le champ "complements" est-il vide [] alors que des compléments sont nécessaires ? (NON - corriger si nécessaire)
- Si tu trouves un repas incomplet ou sans compléments nécessaires, CORRIGE-LE avant de générer le JSON
- INTERDICTION ABSOLUE : Ne JAMAIS générer un JSON avec des repas incomplets ou sans compléments nécessaires

⚠️ IMPORTANT - JSON COMPLET REQUIS :
- Tu DOIS générer un JSON COMPLET et VALIDE pour les 7 jours (Lundi à Dimanche)
- ⚠️ OBLIGATION ABSOLUE : Chaque jour DOIT avoir OBLIGATOIREMENT "petit_dejeuner" ET "repas_du_jour" (pas de null, pas d'omission)
- Chaque jour DOIT avoir des repas CONCRETS avec des noms de plats RÉELS (pas de valeurs vides, pas de "null", pas de placeholders)
- Chaque repas (petit_dejeuner, repas_du_jour) DOIT avoir un "recipe_name" avec un nom de plat CONCRET et RÉEL
- Chaque repas DOIT avoir un champ "complements" (array)
- ⚠️ RÈGLE CRITIQUE : Le champ "complements" DOIT contenir au moins un élément pour la MAJORITÉ des plats (sauf exceptions rares)
- ⚠️ VALIDATION OBLIGATOIRE : Avant de retourner le JSON, vérifie que chaque jour a bien "petit_dejeuner" ET "repas_du_jour" COMPLETS avec compléments si nécessaire
- Le JSON DOIT se terminer par }} pour fermer correctement toutes les structures
- Ne JAMAIS tronquer le JSON au milieu d'une chaîne, d'un objet ou d'un array
- Si tu atteins une limite, génère un JSON valide en fermant toutes les structures ouvertes
- Le JSON DOIT être parseable sans erreur
- RESPECTER la saisonnalité (uniquement ingrédients de saison)
- RESPECTER la variation (éviter les répétitions) - CRITIQUE : Menu doit être DIFFÉRENT à chaque génération
- CALORIES : Chaque repas DOIT avoir un champ "calories" avec l'apport calorique estimé par portion
- INTERDICTION ABSOLUE : Ne JAMAIS générer un calendrier, un diagramme, ou une structure vide. Tu DOIS générer des REPAS avec des NOMS DE PLATS CONCRETS et RÉELS.
- INTERDICTION ABSOLUE : Ne JAMAIS inventer des plats qui n'existent pas. Utilise UNIQUEMENT des plats RÉELS de la cuisine locale.
- INTERDICTION ABSOLUE : Ne JAMAIS générer des repas incomplets ou sans compléments nécessaires.
"#,
            profile.total_members,        // 695
            profile.children_count,       // 696
            profile.adults_count,         // 696
            preferences_str,              // 697
            allergies_str,                // 698
            restrictions_str,             // 699
            cuisine_str,                  // 700
            budget_str,                   // 701
            profile.cooking_level,        // 702 {:?}
            profile.time_available_hours, // 703 {:?}
            location_context,             // 704
            seasonal_context,             // 704
            variation_context,            // 704
            timestamp_variation,          // 704
            profile.total_members,        // 716
            budget_str,                   // 719
            weekly_budget_str,            // 720
            profile.total_members,        // 724
            profile.total_members,        // 731
            profile.total_members,        // 734
            profile.total_members,        // 843
            weekly_budget_str,            // 844
            profile.total_members,        // 870
            budget_str,                   // 875
            weekly_budget_str,            // 876
            profile.total_members,        // 880
            profile.total_members,        // 888
            profile.total_members         // 894
        );

        prompt
    }

    /// ✅ NOUVEAU: Nom du mois en français
    fn get_month_name_fr(month: u32) -> &'static str {
        match month {
            1 => "janvier",
            2 => "février",
            3 => "mars",
            4 => "avril",
            5 => "mai",
            6 => "juin",
            7 => "juillet",
            8 => "août",
            9 => "septembre",
            10 => "octobre",
            11 => "novembre",
            12 => "décembre",
            _ => "mois inconnu",
        }
    }

    /// Suggère des recettes selon préférences
    pub async fn suggest_recipes(
        &self,
        profile: &FamilyProfile,
        meal_type: Option<&str>,
        limit: usize,
    ) -> AppResult<Vec<RecipeSuggestion>> {
        let meal_type_str = meal_type.unwrap_or("tous types de repas");
        let preferences_str = profile.preferences.join(", ");

        let prompt = format!(
            r#"
Tu es l'assistant culinaire intelligent de Yukpo.

CONTEXTE :
- Nombre personnes : {}
- Préférences : {}
- Allergies : {}
- Restrictions : {}
- Style cuisine : {}
- Type repas recherché : {}

Génère {} suggestions de recettes adaptées au contexte local/régional.

RÉPONSE ATTENDUE (JSON strict) :
{{
    "suggestions": [
        {{
            "name": "Nom recette",
            "description": "Description brève",
            "cuisine_style": "cuisine locale traditionnelle",
            "meal_type": ["dejeuner"],
            "difficulty": "facile",
            "prep_time_minutes": 30,
            "estimated_cost": 1500.0,
            "match_score": 0.95,
            "reasoning": "Pourquoi cette recette est adaptée"
        }}
    ]
}}
"#,
            profile.total_members,
            preferences_str,
            profile.allergies.join(", "),
            profile.dietary_restrictions.join(", "),
            profile.cuisine_styles.join(", "),
            meal_type_str,
            limit
        );

        let (model_name, response, tokens) = self.app_ia.predict(&prompt).await?;
        log::info!(
            "[MenuPlanningAIService] Recettes suggérées avec {} (tokens: {})",
            model_name,
            tokens
        );

        // ✅ CORRECTION 2: Nettoyer la réponse JSON (enlever markdown code blocks)
        let cleaned_response = clean_json_response(&response);

        // Parser la réponse
        let result: serde_json::Value = serde_json::from_str(&cleaned_response).unwrap_or_default();
        let suggestions: Vec<RecipeSuggestion> = result
            .get("suggestions")
            .and_then(|s| s.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| serde_json::from_value(v.clone()).ok())
                    .collect()
            })
            .unwrap_or_default();

        Ok(suggestions)
    }

    /// Calcule les quantités d'ingrédients pour un nombre de portions
    pub async fn calculate_quantities(
        &self,
        recipe_name: &str,
        base_servings: i32,
        target_servings: i32,
        ingredients: &[String],
    ) -> AppResult<serde_json::Value> {
        let ingredients_str = ingredients.join(", ");

        let prompt = format!(
            r#"
Tu es l'assistant culinaire de Yukpo.

Recette : {}
Ingrédients de base (pour {} portions) : {}

Calcule les quantités pour {} portions.

RÉPONSE ATTENDUE (JSON strict) :
{{
    "ingredients": [
        {{"name": "Nom ingrédient", "quantity": 2.5, "unit": "kg"}},
        {{"name": "Autre ingrédient", "quantity": 500, "unit": "g"}}
    ]
}}
"#,
            recipe_name, base_servings, ingredients_str, target_servings
        );

        let (model_name, response, tokens) = self.app_ia.predict(&prompt).await?;
        log::info!(
            "[MenuPlanningAIService] Quantités calculées avec {} (tokens: {})",
            model_name,
            tokens
        );

        // ✅ CORRECTION 2: Nettoyer la réponse JSON (enlever markdown code blocks)
        let cleaned_response = clean_json_response(&response);

        let result: serde_json::Value = serde_json::from_str(&cleaned_response)
            .unwrap_or_else(|_| json!({ "ingredients": [] }));

        Ok(result)
    }

    /// Analyse nutritionnelle d'un menu
    pub async fn analyze_nutrition(&self, menu: &WeeklyMenu) -> AppResult<NutritionAnalysis> {
        let meals_summary: String = menu
            .meals
            .iter()
            .map(|m| {
                let petit_dej = m.petit_dejeuner.as_ref().map(|x| {
                    let complements = if x.complements.is_empty() {
                        String::new()
                    } else {
                        format!(" (avec: {})", x.complements.join(", "))
                    };
                    format!("{}{}", x.recipe_name, complements)
                });
                let repas_jour = m.repas_du_jour.as_ref().map(|x| {
                    let complements = if x.complements.is_empty() {
                        String::new()
                    } else {
                        format!(" (avec: {})", x.complements.join(", "))
                    };
                    format!("{}{}", x.recipe_name, complements)
                });
                format!(
                    "{}: Petit-déj: {:?}, Repas du jour: {:?}",
                    m.day_name, petit_dej, repas_jour
                )
            })
            .collect::<Vec<_>>()
            .join("\n");

        let prompt = format!(
            r#"
Tu es un nutritionniste expert. Analyse le menu hebdomadaire suivant :

{}

Calcule l'apport nutritionnel total (calories, protéines, glucides, lipides, fibres) et fournis des recommandations.

RÉPONSE ATTENDUE (JSON strict) :
{{
    "total_calories": 14000.0,
    "total_proteins": 700.0,
    "total_carbs": 1750.0,
    "total_fats": 450.0,
    "total_fiber": 350.0,
    "daily_average": {{
        "calories": 2000.0,
        "proteins": 100.0,
        "carbs": 250.0,
        "fats": 64.0,
        "fiber": 50.0
    }},
    "recommendations": ["Recommandation 1", "Recommandation 2"]
}}
"#,
            meals_summary
        );

        let (model_name, response, tokens) = self.app_ia.predict(&prompt).await?;
        log::info!(
            "[MenuPlanningAIService] Nutrition analysée avec {} (tokens: {})",
            model_name,
            tokens
        );

        // ✅ CORRECTION 2: Nettoyer la réponse JSON (enlever markdown code blocks)
        let cleaned_response = clean_json_response(&response);

        let analysis: NutritionAnalysis =
            serde_json::from_str(&cleaned_response).unwrap_or_else(|_| NutritionAnalysis {
                total_calories: 0.0,
                total_proteins: 0.0,
                total_carbs: 0.0,
                total_fats: 0.0,
                total_fiber: 0.0,
                daily_average: DailyNutritionAverage {
                    calories: 0.0,
                    proteins: 0.0,
                    carbs: 0.0,
                    fats: 0.0,
                    fiber: 0.0,
                },
                recommendations: vec![],
            });

        Ok(analysis)
    }

    /// ✅ NOUVEAU: Génère une recette complète pour un plat spécifique
    pub async fn generate_recipe(
        &self,
        recipe_name: &str,
        profile: Option<&FamilyProfile>,
        user_country: Option<&str>,
        user_city: Option<&str>,
        servings: Option<i32>,
    ) -> AppResult<serde_json::Value> {
        let servings = servings.unwrap_or(4);

        // Construire le contexte du profil si disponible
        let profile_context = if let Some(p) = profile {
            let allergies_str = if p.allergies.is_empty() {
                "Aucune".to_string()
            } else {
                p.allergies.join(", ")
            };
            let restrictions_str = if p.dietary_restrictions.is_empty() {
                "Aucune".to_string()
            } else {
                p.dietary_restrictions.join(", ")
            };
            let cuisine_styles_str = if p.cuisine_styles.is_empty() {
                "cuisine locale".to_string()
            } else {
                p.cuisine_styles.join(", ")
            };
            format!(
                "\n👥 CONTEXTE FAMILLE :\n\
                - Nombre de portions : {}\n\
                - Préférences : {}\n\
                - Allergies : {}\n\
                - Restrictions : {}\n\
                - Styles de cuisine : {}",
                servings,
                p.preferences.join(", "),
                allergies_str,
                restrictions_str,
                cuisine_styles_str
            )
        } else {
            format!("\n👥 CONTEXTE :\n- Nombre de portions : {}", servings)
        };

        // Contexte géographique (détection dynamique)
        let location_context = if let (Some(country), Some(city)) = (user_country, user_city) {
            format!(
                "\n🌍 CONTEXTE GÉOGRAPHIQUE (CRITIQUE) :\n\
                - Pays : {}\n\
                - Ville : {}\n\
                - DÉTECTION AUTOMATIQUE : Détermine intelligemment la cuisine traditionnelle de {} ({})\n\
                - PRIORITÉ : Utilise les ingrédients disponibles localement à {}, les noms de plats authentiques de {}\n\
                - TRADITIONS : Respecte les techniques culinaires et traditions de la région de {}\n\
                - ADAPTATION : Adapte la recette aux habitudes alimentaires et aux ingrédients typiques de {}",
                country, city, country, city, city, country, city, country
            )
        } else if let Some(country) = user_country {
            format!(
                "\n🌍 CONTEXTE GÉOGRAPHIQUE (CRITIQUE) :\n\
                - Pays : {}\n\
                - DÉTECTION AUTOMATIQUE : Détermine intelligemment la cuisine traditionnelle de {}\n\
                - PRIORITÉ : Utilise les ingrédients disponibles localement, les noms de plats authentiques\n\
                - TRADITIONS : Respecte les techniques culinaires et traditions de {}",
                country, country, country
            )
        } else {
            String::new()
        };

        let prompt = format!(
            r#"
Tu es l'assistant culinaire intelligent de Yukpo spécialisé dans les recettes.
{}{}

🎯 TON RÔLE (CRITIQUE - LIRE ATTENTIVEMENT) :
Générer la recette EXACTE et COMPLÈTE du plat spécifique demandé : "{}"

⚠️ RÈGLES ABSOLUES (PRIORITÉ ABSOLUE) :
- Tu DOIS générer UNIQUEMENT la recette du plat EXACTEMENT demandé : "{}"
- Tu NE DOIS JAMAIS générer une recette différente ou similaire
- Tu NE DOIS JAMAIS inventer un plat si tu ne connais pas ce plat spécifique
- Tu DOIS générer la recette TRADITIONNELLE et AUTHENTIQUE de ce plat
- Le champ "recipe_name" dans la réponse DOIT être exactement le nom du plat demandé : "{}"
- Si le plat demandé est un plat spécifique (ex: "Ndolé", "Poulet DG", "Sauce arachide"), génère SA recette authentique et traditionnelle
- Si le plat demandé est générique (ex: "Riz", "Poulet"), génère une recette représentative mais précise adaptée au contexte local

🚨 VALIDATION CRITIQUE DES INGRÉDIENTS (PRIORITÉ ABSOLUE - LIRE TRÈS ATTENTIVEMENT) :
1. COHÉRENCE OBLIGATOIRE INGRÉDIENTS-PLAT :
   - Chaque ingrédient généré DOIT être ABSOLUMENT NÉCESSAIRE pour préparer le plat "{}"
   - INTERDICTION ABSOLUE : Ne JAMAIS inclure des ingrédients qui ne correspondent pas au plat demandé
   - INTERDICTION ABSOLUE : Ne JAMAIS remplacer les ingrédients typiques du plat par d'autres ingrédients
   - EXEMPLE INTERDIT : Si le plat est "Ndolé", ne JAMAIS inclure "Tomates" ou "Pommes de terre" (ces ingrédients ne sont PAS dans le Ndolé traditionnel)
   - EXEMPLE CORRECT : Pour "Ndolé", les ingrédients DOIVENT être : feuilles de ndolé, arachides, viande/poisson, oignons, huile de palme, épices (GINGEMBRE, ail, piment) - UNIQUEMENT ces ingrédients

2. VALIDATION AVANT GÉNÉRATION (CRITIQUE - À FAIRE POUR CHAQUE INGRÉDIENT) :
   - AVANT d'ajouter un ingrédient à la liste, pose-toi cette question : "Cet ingrédient est-il ABSOLUMENT NÉCESSAIRE et TYPIQUE pour préparer le plat '{}' ?"
   - Si la réponse est NON ou INCERTAIN, NE PAS inclure cet ingrédient
   - Utilise tes connaissances sur les recettes traditionnelles et authentiques du plat "{}"
   - Si tu ne connais pas les ingrédients exacts du plat "{}", utilise uniquement les ingrédients que tu connais avec CERTITUDE pour ce plat spécifique

3. EXEMPLES CONCRETS DE COHÉRENCE (POUR T'AIDER) :
   - "Ndolé" → DOIT contenir : feuilles de ndolé, arachides, viande/poisson, oignons, huile de palme, gingembre, ail, piment
   - "Ndolé" → NE DOIT PAS contenir : tomates, pommes de terre, carottes, haricots verts (ces ingrédients ne sont PAS dans le Ndolé)
   - "Poulet DG" → DOIT contenir : poulet, plantains, légumes (tomates, oignons, poivrons), épices, huile
   - "Poulet DG" → NE DOIT PAS contenir : arachides, feuilles de ndolé (ces ingrédients ne sont PAS dans le Poulet DG)
   - "Sauce arachide" → DOIT contenir : arachides, tomates, oignons, viande/poisson, épices, huile
   - "Sauce arachide" → NE DOIT PAS contenir : feuilles de ndolé, plantains (ces ingrédients ne sont PAS dans la sauce arachide)

4. VALIDATION FINALE OBLIGATOIRE (CRITIQUE - DERNIÈRE ÉTAPE AVANT GÉNÉRATION DU JSON) :
   - AVANT de générer le JSON, tu DOIS vérifier CHAQUE ingrédient de la liste
   - Pour CHAQUE ingrédient, pose-toi : "Cet ingrédient correspond-il EXACTEMENT au plat '{}' ?"
   - Si tu trouves un ingrédient qui ne correspond pas, SUPPRIME-LE immédiatement
   - INTERDICTION ABSOLUE : Ne JAMAIS retourner un JSON avec des ingrédients qui ne correspondent pas au plat demandé

🌍 CONTEXTE CULINAIRE :
- Respecter les traditions culinaires locales selon le contexte géographique fourni
- Utiliser UNIQUEMENT les ingrédients typiques et authentiques du plat "{}" dans la région
- Adapter les techniques de cuisson aux habitudes locales
- Ne JAMAIS ajouter d'ingrédients "pour enrichir" si ces ingrédients ne sont pas traditionnels pour le plat "{}"

📋 RÉPONSE ATTENDUE (JSON strict) :
{{
    "recipe_name": "Nom exact du plat",
    "description": "Description courte et appétissante du plat",
    "cuisine_style": "Style de cuisine (déterminé automatiquement selon le pays/ville, ex: cuisine locale traditionnelle)",
    "meal_type": ["petit_dejeuner", "repas_du_jour"],
    "difficulty": "débutant" | "intermédiaire" | "avancé",
    "prep_time_minutes": 30,
    "cook_time_minutes": 45,
    "total_time_minutes": 75,
    "servings": {},
    "ingredients": [
        {{
            "name": "Nom ingrédient",
            "quantity": 2.5,
            "unit": "kg" | "g" | "ml" | "l" | "c. à soupe" | "c. à café" | "pièce(s)",
            "notes": "Optionnel : notes sur l'ingrédient"
        }}
    ],
    "instructions": [
        "Étape 1 détaillée",
        "Étape 2 détaillée",
        "..."
    ],
    "tips": ["Astuce 1", "Astuce 2"],
    "estimated_cost": 5000.0,
    "calories_per_serving": 450.0,
    "nutrition": {{
        "proteins": 25.0,
        "carbs": 60.0,
        "fats": 15.0,
        "fiber": 8.0
    }},
    "tags": ["tag1", "tag2"]
}}

🚨 VALIDATION FINALE OBLIGATOIRE (CRITIQUE - DERNIÈRE ÉTAPE AVANT GÉNÉRATION DU JSON) :
- AVANT de générer le JSON, tu DOIS vérifier CHAQUE ingrédient de la liste
- Pour CHAQUE ingrédient, pose-toi : "Cet ingrédient est-il ABSOLUMENT NÉCESSAIRE et TYPIQUE pour préparer le plat '{}' ?"
- Si tu trouves un ingrédient qui ne correspond pas au plat "{}", SUPPRIME-LE immédiatement
- INTERDICTION ABSOLUE : Ne JAMAIS retourner un JSON avec des ingrédients qui ne correspondent pas au plat demandé "{}"
- Le champ "recipe_name" DOIT être EXACTEMENT "{}" (pas de variation, pas de synonyme)
- Les instructions DOIVENT être pour préparer EXACTEMENT le plat "{}" (pas un plat similaire ou différent)

IMPORTANT :
- Si le plat demandé "{}" n'est pas dans la liste de suggestions, génère quand même une recette adaptée MAIS avec les ingrédients EXACTS de ce plat
- Adapte les ingrédients à la localité (pays/ville) si fourni, MAIS UNIQUEMENT si ces ingrédients sont authentiques pour le plat "{}"
- Respecte les allergies et restrictions si fournies (remplace les ingrédients allergènes par des alternatives, mais garde la cohérence avec le plat "{}")
- Fournis des instructions claires et détaillées pour préparer EXACTEMENT le plat "{}"
- Inclus des astuces pratiques spécifiques au plat "{}"
- COHÉRENCE ABSOLUE : Chaque ingrédient DOIT être vérifié pour correspondre au plat "{}" avant d'être inclus
"#,
            profile_context,
            location_context,
            recipe_name, // 1271
            recipe_name, // 1274
            recipe_name, // 1278
            recipe_name, // 1284
            recipe_name, // 1291
            recipe_name, // 1293
            recipe_name, // 1294
            recipe_name, // 1306
            recipe_name, // 1312
            recipe_name, // 1314
            recipe_name, // 1354
            recipe_name, // 1355
            recipe_name, // 1356
            recipe_name, // 1357
            recipe_name, // 1358
            recipe_name, // 1361
            recipe_name, // 1362
            recipe_name, // 1363
            recipe_name, // 1364
            recipe_name, // 1365
            recipe_name, // 1366
            servings     // 1326
        );

        let (model_name, response, tokens) = self.app_ia.predict(&prompt).await?;
        log::info!(
            "[MenuPlanningAIService] Recette générée avec {} (tokens: {})",
            model_name,
            tokens
        );

        // Nettoyer la réponse JSON
        let cleaned_response = clean_json_response(&response);

        let recipe: serde_json::Value =
            serde_json::from_str(&cleaned_response).unwrap_or_else(|_| {
                json!({
                    "recipe_name": recipe_name,
                    "description": "Recette en cours de génération",
                    "error": "Impossible de générer la recette"
                })
            });

        Ok(recipe)
    }

    /// Crée un menu de fallback en cas d'erreur
    fn create_fallback_menu(&self, profile: &FamilyProfile, week_start: &str) -> WeeklyMenu {
        let day_names = vec![
            "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche",
        ];
        let meals: Vec<DailyMeal> = (1..=7)
            .zip(day_names.iter())
            .map(|(day, day_name)| {
                DailyMeal {
                    day,
                    day_name: day_name.to_string(),
                    petit_dejeuner: Some(MealItem {
                        recipe_name: "Menu en cours de génération".to_string(),
                        recipe_id: None,
                        servings: profile.total_members,
                        prep_time_minutes: None,
                        estimated_cost: None,
                        calories: None,
                        complements: vec![],
                    }),
                    repas_du_jour: Some(MealItem {
                        recipe_name: "Menu en cours de génération".to_string(),
                        recipe_id: None,
                        servings: profile.total_members,
                        prep_time_minutes: None,
                        estimated_cost: None,
                        calories: None,
                        complements: vec![],
                    }),
                    gouter: None,
                    dejeuner: None, // ✅ DÉPRÉCIÉ
                    diner: None,    // ✅ DÉPRÉCIÉ
                }
            })
            .collect();

        WeeklyMenu {
            week_start: week_start.to_string(),
            meals,
            total_estimated_cost: None,
            total_calories_per_day: None,
            recommendations: vec!["Menu en cours de génération. Veuillez réessayer.".to_string()],
        }
    }

    /// ✅ NOUVEAU: Génère une liste de courses intelligente en regroupant les ingrédients
    /// ✅ AMÉLIORATION 2026-01-13: Ajout de la zone géographique pour utiliser des unités locales
    /// ✅ AMÉLIORATION 2026-01-13: Ajout du budget proratisé pour adapter les prix selon le budget disponible
    pub async fn generate_intelligent_shopping_list(
        &self,
        meal_items: &[MealItemForShopping],
        family_members: i32,
        user_country: Option<&str>,
        user_city: Option<&str>,
        budget_monthly: Option<f64>,
        period_days: Option<i32>, // Nombre de jours pour la période (7 pour hebdomadaire, 30 pour mensuel, etc.)
        adults_count: Option<i32>, // ✅ NOUVEAU: Nombre d'adultes
        children_count: Option<i32>, // ✅ NOUVEAU: Nombre d'enfants
    ) -> AppResult<IntelligentShoppingList> {
        use crate::services::menu_planning_ai_prompts::generate_shopping_list_prompt;

        // Construire le prompt pour l'IA avec la zone géographique, le budget proratisé et le profil famille détaillé
        let prompt = generate_shopping_list_prompt(
            meal_items,
            family_members,
            user_country,
            user_city,
            budget_monthly,
            period_days,
            adults_count,
            children_count,
        );

        // Appeler l'IA
        let (_model_name, response, _tokens) = self.app_ia.predict(&prompt).await?;

        // Parser la réponse JSON
        let cleaned_response = clean_json_response(&response);
        let parsed: serde_json::Value = serde_json::from_str(&cleaned_response).map_err(|e| {
            log::error!(
                "[generate_intelligent_shopping_list] Erreur parsing JSON: {}",
                e
            );
            log::error!(
                "[generate_intelligent_shopping_list] Réponse IA: {}",
                cleaned_response
            );
            AppError::Internal("Erreur parsing réponse IA".to_string())
        })?;

        // Extraire les items de la liste
        let items = parsed
            .get("items")
            .and_then(|v| v.as_array())
            .ok_or_else(|| {
                AppError::Internal("Format réponse IA invalide: items manquant".to_string())
            })?;

        let shopping_items: Vec<ShoppingListItem> = items
            .iter()
            .filter_map(|item| {
                let ingredient_name = item.get("ingredient_name")?.as_str()?.to_string();
                let quantity = item.get("quantity")?.as_f64()?;
                let unit = item.get("unit")?.as_str()?.to_string();
                let estimated_price = item.get("estimated_price")?.as_f64()?;
                let associated_meals = item
                    .get("associated_meals")?
                    .as_array()?
                    .iter()
                    .filter_map(|m| m.as_str().map(|s| s.to_string()))
                    .collect();

                Some(ShoppingListItem {
                    ingredient_name,
                    quantity,
                    unit,
                    estimated_price,
                    associated_meals,
                })
            })
            .collect();

        let total_estimated_cost = shopping_items.iter().map(|item| item.estimated_price).sum();

        Ok(IntelligentShoppingList {
            items: shopping_items,
            total_estimated_cost,
        })
    }
}

/// ✅ NOUVEAU: Item de repas pour génération liste de courses
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MealItemForShopping {
    #[serde(rename = "recipeName")]
    pub recipe_name: String,
    pub times: i32, // Nombre de fois de consommation
    pub servings: i32,
    pub day: String,
    #[serde(rename = "mealType")]
    pub meal_type: String,
}

/// ✅ NOUVEAU: Item de liste de courses intelligente
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShoppingListItem {
    pub ingredient_name: String,
    pub quantity: f64,
    pub unit: String,
    pub estimated_price: f64,
    pub associated_meals: Vec<String>,
}

/// ✅ NOUVEAU: Liste de courses intelligente générée
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntelligentShoppingList {
    pub items: Vec<ShoppingListItem>,
    pub total_estimated_cost: f64,
}
