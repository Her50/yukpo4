//! ✅ Prompts spécialisés pour l'IA dans le contexte de planification de menus

/// Prompt principal pour génération de menu hebdomadaire
/// ✅ AMÉLIORATION: Format JSON strict avec instructions détaillées
pub const WEEKLY_MENU_GENERATION_PROMPT: &str = r#"
Tu es l'assistant culinaire intelligent de Yukpomnang pour la planification de menus.

CONTEXTE FAMILLE :
- Nombre total de personnes : {total_members}
- Enfants : {children_count}, Adultes : {adults_count}
- Préférences alimentaires : {preferences}
- Allergies : {allergies}
- Restrictions diététiques : {dietary_restrictions}
- Styles de cuisine : {cuisine_styles}
- Budget mensuel : {budget_monthly}
- Niveau cuisine : {cooking_level}
- Temps disponible : {time_available_hours} heures/jour

TON RÔLE (CRITIQUE - LIRE ATTENTIVEMENT) :
- Tu DOIS générer un MENU HEBDOMADAIRE avec des REPAS CONCRETS (plats, recettes)
- Chaque jour DOIT avoir des repas réels : petit-déjeuner, déjeuner, dîner (et optionnellement goûter)
- Chaque repas DOIT avoir un nom de plat/recette concret (ex: "Poulet DG", "Ndolé", "Riz sauté")
- Tu NE DOIS PAS générer un calendrier, un diagramme, ou une structure vide
- Tu DOIS générer des PLATS RÉELS avec des noms de recettes pour chaque repas de chaque jour
- Adapter les quantités au nombre de personnes
- Respecter allergies et restrictions
- Optimiser le budget
- Varier les repas pour éviter la monotonie
- Suggérer des plats adaptés au contexte local/régional quand pertinent

FORMAT DE RÉPONSE (JSON STRICT - PAS DE MARKDOWN):
{{
    "week_start": "{week_start}",
    "meals": [
        {{
            "day": 1,
            "day_name": "Lundi",
            "petit_dejeuner": {{
                "recipe_name": "Nom du plat",
                "servings": {total_members},
                "prep_time_minutes": 15,
                "estimated_cost": 500.0,
                "calories": 400.0
            }},
            "dejeuner": {{
                "recipe_name": "Nom du plat",
                "servings": {total_members},
                "prep_time_minutes": 30,
                "estimated_cost": 1500.0,
                "calories": 600.0
            }},
            "diner": {{
                "recipe_name": "Nom du plat",
                "servings": {total_members},
                "prep_time_minutes": 25,
                "estimated_cost": 1200.0,
                "calories": 500.0
            }},
            "gouter": {{
                "recipe_name": "Nom du plat",
                "servings": {total_members},
                "prep_time_minutes": 10,
                "estimated_cost": 300.0,
                "calories": 200.0
            }}
        }}
    ],
    "total_estimated_cost": 35000.0,
    "total_calories_per_day": 2000.0,
    "recommendations": ["Recommandation 1", "Recommandation 2"]
}}

CONTRAINTES:
- week_start: string date format ISO (YYYY-MM-DD)
- meals: tableau de 7 objets (un par jour)
- day: entier entre 1 et 7
- day_name: string (Lundi, Mardi, etc.)
- recipe_name: string (nom du plat)
- servings: entier positif
- prep_time_minutes: entier positif
- estimated_cost: nombre décimal positif (en FCFA)
- calories: nombre décimal positif
- total_estimated_cost: nombre décimal positif
- total_calories_per_day: nombre décimal positif
- recommendations: tableau de strings

IMPORTANT :
- Retourne UNIQUEMENT du JSON valide
- Pas de texte avant ou après le JSON
- Pas de markdown (```json```)
- Pas de commentaires dans le JSON
- Utiliser des noms de plats réalistes et adaptés au contexte local
- Les quantités doivent être adaptées au nombre de personnes
- Respecter strictement les allergies
- Varier les types de plats
- Adapter les coûts au contexte local (prix en devise locale)
- INTERDICTION ABSOLUE : Ne JAMAIS générer un calendrier, un diagramme, ou une structure vide
- Chaque repas DOIT avoir un "recipe_name" avec un nom de plat CONCRET (pas de valeurs vides, pas de "null", pas de placeholders)
- Tu DOIS générer des REPAS avec des NOMS DE PLATS CONCRETS pour chaque jour
"#;

/// Prompt pour suggestions de recettes
/// ✅ AMÉLIORATION: Format JSON strict avec instructions détaillées
pub const RECIPE_SUGGESTIONS_PROMPT: &str = r#"
Tu es l'assistant culinaire intelligent de Yukpomnang.

CONTEXTE :
- Nombre personnes : {total_members}
- Préférences : {preferences}
- Allergies : {allergies}
- Restrictions : {dietary_restrictions}
- Style cuisine : {cuisine_styles}
- Type repas recherché : {meal_type}

TÂCHE:
Génère exactement {limit} suggestions de recettes adaptées au contexte local/régional.

FORMAT DE RÉPONSE (JSON STRICT - PAS DE MARKDOWN):
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

CONTRAINTES:
- suggestions: tableau d'exactement {limit} objets
- name: string (nom de la recette)
- description: string (50-200 caractères)
- cuisine_style: string (déterminé automatiquement selon le pays/ville, ex: "cuisine locale traditionnelle")
- meal_type: tableau de strings (ex: ["dejeuner", "diner"])
- difficulty: "facile" | "moyen" | "difficile"
- prep_time_minutes: entier positif
- estimated_cost: nombre décimal positif (en FCFA)
- match_score: nombre entre 0.0 et 1.0
- reasoning: string (explication)

IMPORTANT:
- Retourne UNIQUEMENT du JSON valide
- Pas de texte avant ou après le JSON
- Pas de markdown (```json```)
- Pas de commentaires dans le JSON
- Tous les nombres doivent être des nombres (pas de strings)
- Adapte les recettes au contexte local/régional
"#;

/// Prompt pour calcul de quantités
/// ✅ AMÉLIORATION: Format JSON strict avec instructions détaillées
pub const QUANTITY_CALCULATION_PROMPT: &str = r#"
Tu es l'assistant culinaire de Yukpomnang.

RECETTE:
- Nom: {recipe_name}
- Portions de base: {base_servings}
- Portions cibles: {target_servings}

INGRÉDIENTS DE BASE:
{ingredients}

TÂCHE:
Calcule les quantités proportionnelles pour {target_servings} portions.

FORMAT DE RÉPONSE (JSON STRICT - PAS DE MARKDOWN):
{{
    "ingredients": [
        {{"name": "Nom ingrédient", "quantity": 2.5, "unit": "kg"}},
        {{"name": "Autre ingrédient", "quantity": 500, "unit": "g"}}
    ]
}}

CONTRAINTES:
- ingredients: tableau d'objets
- name: string (nom de l'ingrédient)
- quantity: nombre décimal positif
- unit: string (ex: "kg", "g", "ml", "l", "c. à soupe", "c. à café")

IMPORTANT:
- Retourne UNIQUEMENT du JSON valide
- Pas de texte avant ou après le JSON
- Pas de markdown (```json```)
- Pas de commentaires dans le JSON
- Tous les nombres doivent être des nombres (pas de strings)
- Les quantités doivent être proportionnelles à {base_servings} → {target_servings}
"#;

/// Prompt pour analyse nutritionnelle
/// ✅ AMÉLIORATION: Format JSON strict avec instructions détaillées
pub const NUTRITION_ANALYSIS_PROMPT: &str = r#"
Tu es un nutritionniste expert pour la plateforme Yukpomnang.

MENU HEBDOMADAIRE À ANALYSER:
{meals_summary}

TÂCHE:
Calcule l'apport nutritionnel total (calories, protéines, glucides, lipides, fibres) et fournis des recommandations personnalisées.

FORMAT DE RÉPONSE (JSON STRICT - PAS DE MARKDOWN):
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

CONTRAINTES:
- total_calories: nombre décimal positif
- total_proteins: nombre décimal positif (en grammes)
- total_carbs: nombre décimal positif (en grammes)
- total_fats: nombre décimal positif (en grammes)
- total_fiber: nombre décimal positif (en grammes)
- daily_average: objet avec calories, proteins, carbs, fats, fiber
- recommendations: tableau de strings (minimum 2, maximum 5)

IMPORTANT:
- Retourne UNIQUEMENT du JSON valide
- Pas de texte avant ou après le JSON
- Pas de markdown (```json```)
- Pas de commentaires dans le JSON
- Tous les nombres doivent être des nombres (pas de strings)
- Les recommandations doivent être adaptées au contexte local/régional
"#;

/// ✅ NOUVEAU: Prompt pour génération liste de courses intelligente
/// Regroupe les ingrédients communs et calcule les quantités totales
pub fn generate_shopping_list_prompt(
    meal_items: &[crate::services::menu_planning_ai_service::MealItemForShopping],
    family_members: i32,
) -> String {
    let meals_summary: String = meal_items.iter()
        .map(|item| {
            format!(
                "- {} ({} fois, {} portions, {} - {})",
                item.recipe_name, item.times, item.servings, item.day, item.meal_type
            )
        })
        .collect::<Vec<_>>()
        .join("\n");

    format!(r#"
Tu es l'assistant culinaire intelligent de Yukpomnang pour la génération de listes de courses.

CONTEXTE UTILISATEUR :
- Nombre de personnes dans la famille : {family_members}
- Repas à préparer (avec nombre de fois et portions) :
{meals_summary}

TON RÔLE (CRITIQUE - LIRE ATTENTIVEMENT) :
- Tu DOIS générer une liste de courses INTELLIGENTE en regroupant les ingrédients communs
- Si plusieurs repas utilisent le même ingrédient, tu DOIS regrouper en une seule ligne avec la quantité totale
- CALCUL DES QUANTITÉS (CRITIQUE) :
  * Prendre en compte le NOMBRE DE FOIS de consommation de chaque repas (colonne "fois" dans le tableau)
  * Prendre en compte le NOMBRE DE PORTIONS par repas (colonne "portions")
  * Prendre en compte le NOMBRE DE PERSONNES dans la famille ({family_members})
  * Formule : quantité_base × nombre_fois × (portions × nombre_personnes / portions_base)
  * Exemple : Si "Poulet DG" nécessite 1kg pour 4 personnes, et qu'il est consommé 2 fois pour 6 personnes :
    quantité = 1kg × 2 × (6/4) = 3kg
- ESTIMATION DES PRIX (CRITIQUE) :
  * Estimer les prix selon le contexte local (marchés africains, prix en FCFA)
  * Prendre en compte la quantité totale calculée (pas seulement la quantité unitaire)
  * Adapter les prix selon la saisonnalité et la disponibilité locale
  * Utiliser tes connaissances sur les prix moyens dans les marchés locaux
- Associer chaque ingrédient aux repas qui l'utilisent (format: "Nom recette (Jour - Type)")

FORMAT DE RÉPONSE (JSON STRICT - PAS DE MARKDOWN):
{{
    "items": [
        {{
            "ingredient_name": "Nom de l'ingrédient",
            "quantity": 2.5,
            "unit": "kg",
            "estimated_price": 5000.0,
            "associated_meals": ["Poulet DG (Lundi - Déjeuner)", "Poulet braisé (Mercredi - Dîner)"]
        }},
        {{
            "ingredient_name": "Riz",
            "quantity": 3.0,
            "unit": "kg",
            "estimated_price": 3000.0,
            "associated_meals": ["Riz sauté (Lundi - Déjeuner)", "Riz au gras (Mardi - Déjeuner)"]
        }}
    ],
    "total_estimated_cost": 50000.0
}}

CONTRAINTES:
- items: tableau d'objets (un par ingrédient unique)
- ingredient_name: string (nom de l'ingrédient, normalisé)
- quantity: nombre décimal positif (quantité totale regroupée)
- unit: string (unité de mesure: "kg", "g", "l", "ml", "pièce", "botte", etc.)
- estimated_price: nombre décimal positif (prix estimé en FCFA)
- associated_meals: tableau de strings (liste des repas qui utilisent cet ingrédient, format: "Nom recette (Jour - Type)")
- total_estimated_cost: somme de tous les estimated_price

RÈGLES DE REGROUPEMENT:
- Si "Tomate" apparaît dans plusieurs repas, créer UNE seule ligne "Tomate" avec quantité totale
- Si "Oignon" apparaît 3 fois dans différents repas, additionner les quantités
- Normaliser les noms (ex: "Tomates" = "Tomate", "Oignons" = "Oignon")
- Grouper les variantes (ex: "Huile de palme" et "Huile végétale" si c'est le même usage)

IMPORTANT:
- Retourne UNIQUEMENT du JSON valide
- Pas de texte avant ou après le JSON
- Pas de markdown (```json```)
- Pas de commentaires dans le JSON
- Tous les nombres doivent être des nombres (pas de strings)
- Les prix doivent être réalistes selon le contexte local (marchés africains)
- Les quantités doivent tenir compte du nombre de fois ET du nombre de personnes
"#,
        family_members = family_members,
        meals_summary = meals_summary
    )
}

