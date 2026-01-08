//! ✅ Service IA pour Planification Menus
//!
//! Ce service utilise l'IA pour :
//! - Générer des menus hebdomadaires personnalisés
//! - Suggérer des recettes selon préférences
//! - Calculer les quantités automatiquement
//! - Analyser la nutrition
//! - Optimiser le budget

use crate::core::types::AppResult;
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
        cleaned = cleaned.strip_prefix("```json").unwrap_or(&cleaned).trim().to_string();
    } else if cleaned.starts_with("```") {
        cleaned = cleaned.strip_prefix("```").unwrap_or(&cleaned).trim().to_string();
    }
    
    // Enlever les markdown code blocks à la fin
    if cleaned.ends_with("```") {
        cleaned = cleaned.strip_suffix("```").unwrap_or(&cleaned).trim().to_string();
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
    pub dejeuner: Option<MealItem>,
    pub diner: Option<MealItem>,
    pub gouter: Option<MealItem>,
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
        let menu: WeeklyMenu = match serde_json::from_str(&cleaned_response) {
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

        Ok(menu)
    }

    /// Génère un menu hebdomadaire personnalisé (version originale - gardée pour compatibilité)
    pub async fn generate_weekly_menu(
        &self,
        profile: &FamilyProfile,
        week_start: &str,
    ) -> AppResult<WeeklyMenu> {
        // Utiliser la version intelligente avec contextes vides
        self.generate_weekly_menu_intelligent(
            profile,
            week_start,
            None,
            None,
            &[],
        )
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

        // ✅ CONTEXTE 2: Localité géographique (détection dynamique)
        let location_context = if let (Some(country), Some(city)) = (user_country, user_city) {
            if !cuisine_str.is_empty() {
                // Si l'utilisateur a spécifié des préférences culinaires, les utiliser
                format!(
                    "\n\n🌍 CONTEXTE GÉOGRAPHIQUE (CRITIQUE) :\n\
                    - Pays de résidence : {}\n\
                    - Ville : {}\n\
                    - CUISINE PRÉFÉRÉE : {}\n\
                    - PRIORITÉ : Plats traditionnels locaux adaptés à {}, ingrédients disponibles localement, recettes authentiques\n\
                    - ADAPTATION : Utilise les noms de plats locaux, les ingrédients typiques de la région de {}\n\
                    - CONTEXTE : Adapte les plats de la cuisine {} aux ingrédients et traditions de {}",
                    country, city, cuisine_str, city, city, cuisine_str, country
                )
            } else {
                // Sinon, laisser l'IA déterminer intelligemment la cuisine appropriée
                format!(
                    "\n\n🌍 CONTEXTE GÉOGRAPHIQUE (CRITIQUE) :\n\
                    - Pays de résidence : {}\n\
                    - Ville : {}\n\
                    - DÉTECTION AUTOMATIQUE : Tu DOIS déterminer intelligemment la cuisine traditionnelle de {} ({})\n\
                    - PRIORITÉ ABSOLUE : Proposer UNIQUEMENT des plats de la cuisine locale traditionnelle de {}\n\
                    - INTERDICTION STRICTE : Ne JAMAIS proposer de plats de cuisines étrangères inadaptées \
                    (ex: ne pas proposer de menu chinois, japonais, italien à un résident de {})\n\
                    - INGRÉDIENTS LOCAUX : Utilise uniquement les ingrédients typiques et disponibles localement à {}\n\
                    - NOMS LOCAUX : Utilise les noms de plats authentiques de {}\n\
                    - TRADITIONS : Respecte les traditions culinaires et les habitudes alimentaires de {}",
                    country, city, country, city, country, country, city, country, country
                )
            }
        } else if let Some(country) = user_country {
            if !cuisine_str.is_empty() {
                format!(
                    "\n\n🌍 CONTEXTE GÉOGRAPHIQUE (CRITIQUE) :\n\
                    - Pays de résidence : {}\n\
                    - CUISINE PRÉFÉRÉE : {}\n\
                    - PRIORITÉ : Plats traditionnels locaux adaptés, ingrédients disponibles localement",
                    country, cuisine_str
                )
            } else {
                format!(
                    "\n\n🌍 CONTEXTE GÉOGRAPHIQUE (CRITIQUE) :\n\
                    - Pays de résidence : {}\n\
                    - DÉTECTION AUTOMATIQUE : Tu DOIS déterminer intelligemment la cuisine traditionnelle de {}\n\
                    - PRIORITÉ ABSOLUE : Proposer UNIQUEMENT des plats de la cuisine locale traditionnelle de {}\n\
                    - INTERDICTION STRICTE : Ne JAMAIS proposer de plats de cuisines étrangères inadaptées\n\
                    - INGRÉDIENTS LOCAUX : Utilise uniquement les ingrédients typiques et disponibles localement\n\
                    - TRADITIONS : Respecte les traditions culinaires de {}",
                    country, country, country, country
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

        // ✅ CONTEXTE 4: Variation temporelle
        let variation_context = if !previous_recipes.is_empty() {
            let recipes_list = previous_recipes
                .iter()
                .take(20) // Limiter à 20 pour ne pas surcharger le prompt
                .map(|r| format!("- {}", r))
                .collect::<Vec<_>>()
                .join("\n");
            format!(
                "\n\n🔄 VARIATION TEMPORELLE (CRITIQUE) :\n\
                - Plats récents déjà proposés (à éviter) :\n{}\n\
                - CONTRAINTE STRICTE : Éviter de répéter ces plats dans le nouveau menu\n\
                - OBJECTIF : Proposer des plats DIFFÉRENTS pour varier l'alimentation\n\
                - PRIORITÉ : Nouveaux plats, nouvelles recettes, nouvelles combinaisons\n\
                - Si répétition nécessaire : Varier au moins les accompagnements ou la préparation",
                recipes_list
            )
        } else {
            "\n\n🔄 VARIATION TEMPORELLE :\n- Aucun menu précédent, liberté totale dans le choix des plats".to_string()
        };

        let prompt = format!(
            r#"
Tu es l'assistant culinaire intelligent de Yukpomnang pour la planification de menus.

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
{}{}{}

🎯 TON RÔLE (CRITIQUE - LIRE ATTENTIVEMENT) :
- Tu DOIS générer un MENU HEBDOMADAIRE avec des REPAS CONCRETS (plats, recettes)
- Chaque jour DOIT avoir des repas réels : petit-déjeuner, déjeuner, dîner (et optionnellement goûter)
- Chaque repas DOIT avoir un nom de plat/recette concret (ex: "Poulet DG", "Ndolé", "Riz sauté")
- Tu NE DOIS PAS générer un calendrier, un diagramme, ou une structure vide
- Tu DOIS générer des PLATS RÉELS avec des noms de recettes pour chaque repas de chaque jour
- Adapter les quantités au nombre de personnes
- Respecter allergies et restrictions
- Optimiser le budget
- Varier les repas pour éviter la monotonie
- RESPECTER STRICTEMENT les contextes géographique, saisonnier et de variation ci-dessus

📋 RÉPONSE ATTENDUE (JSON strict) :
{{
    "week_start": "{}",
    "meals": [
        {{
            "day": 1,
            "day_name": "Lundi",
            "petit_dejeuner": {{
                "recipe_name": "Nom du plat",
                "servings": {},
                "prep_time_minutes": 15,
                "estimated_cost": 500.0,
                "calories": 400.0
            }},
            "dejeuner": {{ ... }},
            "diner": {{ ... }},
            "gouter": {{ ... }}
        }},
        // ... pour chaque jour (1-7)
    ],
    "total_estimated_cost": 35000.0,
    "total_calories_per_day": 2000.0,
    "recommendations": ["Recommandation 1", "Recommandation 2"]
}}

✅ RÈGLES CRITIQUES :
- Utiliser des noms de plats réalistes et adaptés au contexte local
- Les quantités doivent être adaptées au nombre de personnes
- Respecter strictement les allergies
- Varier les types de plats
- RESPECTER la localité culinaire (pas de cuisines inadaptées)

⚠️ IMPORTANT - JSON COMPLET REQUIS :
- Tu DOIS générer un JSON COMPLET et VALIDE pour les 7 jours (Lundi à Dimanche)
- Chaque jour DOIT avoir des repas CONCRETS avec des noms de plats RÉELS (pas de valeurs vides, pas de "null", pas de placeholders)
- Chaque repas (petit_dejeuner, dejeuner, diner) DOIT avoir un "recipe_name" avec un nom de plat CONCRET
- Le JSON DOIT se terminer par }} pour fermer correctement toutes les structures
- Ne JAMAIS tronquer le JSON au milieu d'une chaîne, d'un objet ou d'un array
- Si tu atteins une limite, génère un JSON valide en fermant toutes les structures ouvertes
- Le JSON DOIT être parseable sans erreur
- RESPECTER la saisonnalité (uniquement ingrédients de saison)
- RESPECTER la variation (éviter les répétitions)
- INTERDICTION ABSOLUE : Ne JAMAIS générer un calendrier, un diagramme, ou une structure vide. Tu DOIS générer des REPAS avec des NOMS DE PLATS CONCRETS.
"#,
            profile.total_members,
            profile.children_count,
            profile.adults_count,
            preferences_str,
            allergies_str,
            restrictions_str,
            cuisine_str,
            budget_str,
            profile.cooking_level,
            profile.time_available_hours,
            location_context,
            seasonal_context,
            variation_context,
            week_start,
            profile.total_members
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
Tu es l'assistant culinaire intelligent de Yukpomnang.

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
Tu es l'assistant culinaire de Yukpomnang.

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
        
        let result: serde_json::Value =
            serde_json::from_str(&cleaned_response).unwrap_or_else(|_| json!({ "ingredients": [] }));

        Ok(result)
    }

    /// Analyse nutritionnelle d'un menu
    pub async fn analyze_nutrition(&self, menu: &WeeklyMenu) -> AppResult<NutritionAnalysis> {
        let meals_summary: String = menu
            .meals
            .iter()
            .map(|m| {
                format!(
                    "{}: Petit-déj: {:?}, Déj: {:?}, Dîner: {:?}",
                    m.day_name,
                    m.petit_dejeuner.as_ref().map(|x| &x.recipe_name),
                    m.dejeuner.as_ref().map(|x| &x.recipe_name),
                    m.diner.as_ref().map(|x| &x.recipe_name)
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
Tu es l'assistant culinaire intelligent de Yukpomnang spécialisé dans les recettes.
{}{}

🎯 TON RÔLE :
Générer une recette COMPLÈTE et DÉTAILLÉE pour le plat : "{}"

📋 RÉPONSE ATTENDUE (JSON strict) :
{{
    "recipe_name": "Nom exact du plat",
    "description": "Description courte et appétissante du plat",
    "cuisine_style": "Style de cuisine (déterminé automatiquement selon le pays/ville, ex: cuisine locale traditionnelle)",
    "meal_type": ["petit_dejeuner", "dejeuner", "diner"],
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

IMPORTANT :
- Si le plat demandé n'est pas dans la liste de suggestions, génère quand même une recette adaptée
- Adapte les ingrédients à la localité (pays/ville) si fourni
- Respecte les allergies et restrictions si fournies
- Fournis des instructions claires et détaillées
- Inclus des astuces pratiques
"#,
            profile_context,
            location_context,
            recipe_name,
            servings
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
            serde_json::from_str(&cleaned_response).unwrap_or_else(|_| json!({
                "recipe_name": recipe_name,
                "description": "Recette en cours de génération",
                "error": "Impossible de générer la recette"
            }));

        Ok(recipe)
    }

    /// Crée un menu de fallback en cas d'erreur
    fn create_fallback_menu(&self, _profile: &FamilyProfile, week_start: &str) -> WeeklyMenu {
        WeeklyMenu {
            week_start: week_start.to_string(),
            meals: vec![],
            total_estimated_cost: None,
            total_calories_per_day: None,
            recommendations: vec!["Menu en cours de génération. Veuillez réessayer.".to_string()],
        }
    }
}
