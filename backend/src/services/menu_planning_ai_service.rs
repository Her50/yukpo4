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
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;

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
    pub cuisine_styles: Vec<String>, // africaine, camerounaise, etc.
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

    /// Génère un menu hebdomadaire personnalisé
    pub async fn generate_weekly_menu(
        &self,
        profile: &FamilyProfile,
        week_start: &str,
    ) -> AppResult<WeeklyMenu> {
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
        let cuisine_str = profile.cuisine_styles.join(", ");
        let budget_str = profile
            .budget_monthly
            .map(|b| format!("{:.2} FCFA", b))
            .unwrap_or_else(|| "Non spécifié".to_string());

        let prompt = format!(
            r#"
Tu es l'assistant culinaire intelligent de Yukpomnang pour la planification de menus.

CONTEXTE FAMILLE :
- Nombre total de personnes : {}
- Enfants : {}, Adultes : {}
- Préférences alimentaires : {}
- Allergies : {}
- Restrictions diététiques : {}
- Styles de cuisine : {}
- Budget mensuel : {}
- Niveau cuisine : {:?}
- Temps disponible : {:?} heures/jour

TON RÔLE :
- Générer un menu hebdomadaire complet (Lundi à Dimanche)
- Planifier petit-déjeuner, déjeuner, dîner pour chaque jour
- Adapter les quantités au nombre de personnes
- Respecter allergies et restrictions
- Optimiser le budget
- Varier les repas pour éviter la monotonie
- Suggérer des plats adaptés au contexte africain/camerounais quand pertinent

RÉPONSE ATTENDUE (JSON strict) :
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

IMPORTANT :
- Utiliser des noms de plats réalistes et adaptés au contexte
- Les quantités doivent être adaptées au nombre de personnes
- Respecter strictement les allergies
- Varier les types de plats
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
            week_start,
            profile.total_members
        );

        let (model_name, response, tokens) = self.app_ia.predict(&prompt).await?;
        log::info!(
            "[MenuPlanningAIService] Menu généré avec {} (tokens: {})",
            model_name,
            tokens
        );

        // Parser la réponse JSON
        let menu: WeeklyMenu = match serde_json::from_str(&response) {
            Ok(m) => m,
            Err(e) => {
                log::error!(
                    "[MenuPlanningAIService] Erreur parsing JSON: {} | Réponse: {}",
                    e,
                    response
                );
                // Fallback: créer un menu basique
                self.create_fallback_menu(profile, week_start)
            }
        };

        Ok(menu)
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

Génère {} suggestions de recettes adaptées au contexte africain/camerounais.

RÉPONSE ATTENDUE (JSON strict) :
{{
    "suggestions": [
        {{
            "name": "Nom recette",
            "description": "Description brève",
            "cuisine_style": "camerounaise",
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

        // Parser la réponse
        let result: serde_json::Value = serde_json::from_str(&response).unwrap_or_default();
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

        let result: serde_json::Value =
            serde_json::from_str(&response).unwrap_or_else(|_| json!({ "ingredients": [] }));

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

        let analysis: NutritionAnalysis =
            serde_json::from_str(&response).unwrap_or_else(|_| NutritionAnalysis {
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
