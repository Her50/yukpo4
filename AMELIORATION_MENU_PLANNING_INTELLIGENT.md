# 🍽️ Amélioration Système Planification Menu Intelligent

## 📊 Analyse Actuelle

### ✅ Ce qui existe
1. **Profil famille** : Préférences, allergies, restrictions, budget, styles de cuisine
2. **Génération IA** : Menu hebdomadaire avec recettes personnalisées
3. **Adaptation contexte** : Mention "adapté au contexte africain/camerounais" dans le prompt

### ❌ Ce qui manque

#### 1. **Détection automatique de localité culinaire**
- ❌ Pas de détection automatique du pays/ville de l'utilisateur
- ❌ Le champ `cuisine_styles` est manuel (utilisateur doit renseigner)
- ❌ Pas de logique pour éviter des cuisines inadaptées (ex: menu chinois pour un Sénégalais au Sénégal)

#### 2. **Vérification saisonnalité**
- ❌ Aucune vérification si les ingrédients sont de saison
- ❌ Pas de base de données des saisons par pays/région
- ❌ Risque de proposer des produits hors saison (cher, moins frais)

#### 3. **Variation temporelle**
- ❌ Pas de comparaison avec menus précédents
- ❌ Pas de logique pour éviter la répétition
- ❌ Risque de proposer les mêmes plats chaque semaine

## 🎯 Améliorations Proposées

### 1. Détection Automatique Localité Culinaire

**Objectif** : Adapter automatiquement la cuisine selon le pays/ville de l'utilisateur

**Implémentation** :
```rust
// Dans menu_planning_controller.rs
async fn get_user_location_context(
    state: &AppState,
    user_id: i32,
) -> AppResult<(Option<String>, Option<String>)> {
    // 1. Récupérer GPS utilisateur
    let user_gps: Option<String> = sqlx::query_scalar(
        "SELECT gps FROM users WHERE id = $1"
    )
    .bind(user_id)
    .fetch_optional(&state.pg)
    .await?;

    // 2. Reverse geocoding pour obtenir pays/ville
    if let Some(gps) = user_gps {
        // Utiliser service de géocodage (Google Maps API ou GeoNames)
        let location = reverse_geocode(&gps).await?;
        return Ok((location.country, location.city));
    }

    Ok((None, None))
}

// Mapping pays → cuisine par défaut
fn get_default_cuisine_for_country(country: &str) -> Vec<String> {
    match country.to_lowercase().as_str() {
        "sénégal" | "senegal" => vec!["sénégalaise", "africaine de l'ouest"],
        "cameroun" => vec!["camerounaise", "africaine centrale"],
        "côte d'ivoire" | "cote d'ivoire" => vec!["ivoirienne", "africaine de l'ouest"],
        "mali" => vec!["malienne", "africaine de l'ouest"],
        "burkina faso" => vec!["burkinabè", "africaine de l'ouest"],
        _ => vec!["africaine"], // Par défaut
    }
}
```

**Modification prompt IA** :
```rust
let location_context = if let (Some(country), Some(city)) = (user_country, user_city) {
    format!(
        "\nCONTEXTE GÉOGRAPHIQUE (CRITIQUE) :\n\
        - Pays de résidence : {}\n\
        - Ville : {}\n\
        - CUISINE ADAPTÉE : Tu DOIS proposer uniquement des plats de la cuisine locale ({})\n\
        - INTERDICTION : Ne JAMAIS proposer de plats de cuisines étrangères inadaptées \
        (ex: ne pas proposer de menu chinois à un Sénégalais résidant au Sénégal)\n\
        - PRIORITÉ : Plats traditionnels locaux, ingrédients disponibles localement",
        country,
        city,
        get_default_cuisine_for_country(&country).join(", ")
    )
} else {
    String::new()
};
```

### 2. Vérification Saisonnalité

**Objectif** : Proposer uniquement des ingrédients de saison

**Base de données saisons** :
```rust
// Structure pour saisons par pays/région
struct SeasonalIngredient {
    ingredient: String,
    country: String,
    region: Option<String>,
    season_start_month: i32, // 1-12
    season_end_month: i32,
    peak_months: Vec<i32>,
}

// Exemple données
const SEASONAL_DATA: &[SeasonalIngredient] = &[
    SeasonalIngredient {
        ingredient: "mangue",
        country: "Sénégal",
        region: None,
        season_start_month: 4, // Avril
        season_end_month: 7,   // Juillet
        peak_months: vec![5, 6],
    },
    SeasonalIngredient {
        ingredient: "tomate",
        country: "Cameroun",
        region: None,
        season_start_month: 1,
        season_end_month: 12, // Toute l'année
        peak_months: vec![3, 4, 5, 6],
    },
    // ... plus de données
];

fn is_ingredient_in_season(
    ingredient: &str,
    country: &str,
    current_month: i32,
) -> bool {
    SEASONAL_DATA
        .iter()
        .any(|data| {
            data.ingredient.eq_ignore_ascii_case(ingredient)
                && data.country.eq_ignore_ascii_case(country)
                && (data.season_start_month <= current_month
                    && current_month <= data.season_end_month
                    || data.season_start_month > data.season_end_month // Saison qui traverse l'année
                        && (current_month >= data.season_start_month
                            || current_month <= data.season_end_month))
        })
}
```

**Modification prompt IA** :
```rust
let current_month = chrono::Utc::now().month() as i32;
let seasonal_ingredients: Vec<String> = get_seasonal_ingredients_for_country(
    &user_country.unwrap_or_default(),
    current_month,
);

let seasonal_context = if !seasonal_ingredients.is_empty() {
    format!(
        "\nSAISONNALITÉ (CRITIQUE - Mois actuel: {}) :\n\
        - Ingrédients de saison disponibles : {}\n\
        - CONTRAINTE STRICTE : Utilise UNIQUEMENT ces ingrédients de saison dans les recettes\n\
        - INTERDICTION : Ne JAMAIS proposer d'ingrédients hors saison (cher, moins frais, moins disponible)\n\
        - PRIORITÉ : Privilégier les ingrédients de saison pour optimiser coût et qualité",
        get_month_name(current_month),
        seasonal_ingredients.join(", ")
    )
} else {
    String::new()
};
```

### 3. Variation Temporelle

**Objectif** : Éviter la répétition en comparant avec menus précédents

**Récupération historique** :
```rust
async fn get_previous_menus(
    state: &AppState,
    user_id: i32,
    limit: i32,
) -> AppResult<Vec<WeeklyMenu>> {
    let previous_menus = sqlx::query_as::<_, MenuPlanRow>(
        r#"
        SELECT 
            mp.id,
            mp.week_start,
            mp.week_end,
            jsonb_agg(
                jsonb_build_object(
                    'day', pm.day,
                    'day_name', pm.day_name,
                    'recipe_name', pm.recipe_name,
                    'meal_type', pm.meal_type
                )
            ) as meals
        FROM menu_plans mp
        LEFT JOIN planned_meals pm ON pm.menu_plan_id = mp.id
        WHERE mp.user_id = $1
            AND mp.week_start < CURRENT_DATE
        GROUP BY mp.id, mp.week_start, mp.week_end
        ORDER BY mp.week_start DESC
        LIMIT $2
        "#
    )
    .bind(user_id)
    .bind(limit)
    .fetch_all(&state.pg)
    .await?;

    // Convertir en WeeklyMenu
    Ok(previous_menus.into_iter().map(|row| row.to_weekly_menu()).collect())
}

fn extract_previous_recipes(previous_menus: &[WeeklyMenu]) -> Vec<String> {
    previous_menus
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
                .collect::<Vec<_>>()
            })
        })
        .collect()
}
```

**Modification prompt IA** :
```rust
let variation_context = if !previous_recipes.is_empty() {
    format!(
        "\nVARIATION TEMPORELLE (CRITIQUE) :\n\
        - Plats récents proposés : {}\n\
        - CONTRAINTE STRICTE : Éviter de répéter ces plats dans le nouveau menu\n\
        - OBJECTIF : Proposer des plats DIFFÉRENTS pour varier l'alimentation\n\
        - PRIORITÉ : Nouveaux plats, nouvelles recettes, nouvelles combinaisons\n\
        - Si répétition nécessaire : Varier au moins les accompagnements ou la préparation",
        previous_recipes.join(", ")
    )
} else {
    String::new()
};
```

## 🔧 Implémentation Complète

### Fichier : `backend/src/services/menu_planning_ai_service.rs`

```rust
// Ajouter ces nouvelles méthodes

impl MenuPlanningAIService {
    /// Génère un menu avec intelligence contextuelle
    pub async fn generate_weekly_menu_intelligent(
        &self,
        profile: &FamilyProfile,
        week_start: &str,
        user_id: i32,
        user_country: Option<String>,
        user_city: Option<String>,
        previous_menus: &[WeeklyMenu],
    ) -> AppResult<WeeklyMenu> {
        // 1. Détection localité culinaire
        let cuisine_styles = if profile.cuisine_styles.is_empty() {
            // Auto-détection si non renseigné
            user_country
                .as_ref()
                .map(|c| get_default_cuisine_for_country(c))
                .unwrap_or_else(|| vec!["africaine".to_string()])
        } else {
            profile.cuisine_styles.clone()
        };

        // 2. Vérification saisonnalité
        let current_month = chrono::Utc::now().month() as i32;
        let seasonal_ingredients = user_country
            .as_ref()
            .map(|c| get_seasonal_ingredients_for_country(c, current_month))
            .unwrap_or_default();

        // 3. Extraction recettes précédentes
        let previous_recipes = extract_previous_recipes(previous_menus);

        // 4. Construction prompt enrichi
        let prompt = build_intelligent_menu_prompt(
            profile,
            week_start,
            &cuisine_styles,
            user_country.as_deref(),
            user_city.as_deref(),
            &seasonal_ingredients,
            current_month,
            &previous_recipes,
        );

        // 5. Génération avec IA
        let (model_name, response, tokens) = self.app_ia.predict(&prompt).await?;
        
        // 6. Parsing et retour
        let cleaned_response = clean_json_response(&response);
        let menu: WeeklyMenu = serde_json::from_str(&cleaned_response)
            .unwrap_or_else(|_| self.create_fallback_menu(profile, week_start));

        Ok(menu)
    }
}
```

## 📝 Checklist Implémentation

- [ ] Ajouter fonction `get_user_location_context()` dans `menu_planning_controller.rs`
- [ ] Créer base de données saisons (`seasonal_ingredients` table ou constante)
- [ ] Ajouter fonction `get_seasonal_ingredients_for_country()`
- [ ] Ajouter fonction `get_previous_menus()` pour récupérer historique
- [ ] Modifier `generate_weekly_menu()` pour utiliser la version intelligente
- [ ] Enrichir le prompt IA avec les 3 contextes (localité, saison, variation)
- [ ] Tester avec différents pays (Sénégal, Cameroun, etc.)
- [ ] Tester avec différents mois pour vérifier saisonnalité
- [ ] Tester variation avec plusieurs menus précédents

## 🎯 Résultat Attendu

1. **Localité** : Un Sénégalais au Sénégal recevra uniquement des plats sénégalais/africains de l'ouest
2. **Saisonnalité** : Les mangues ne seront proposées qu'en avril-juillet au Sénégal
3. **Variation** : Le menu de cette semaine sera différent de la semaine précédente

