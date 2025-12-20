# 🍽️ PROMPT 3 : INTÉGRATION SERVICE PLANIFICATION MENUS (SERVICES SPÉCIALISÉS)

Ce document décrit l'intégration complète du service **Planification de Menus** dans la structure des services spécialisés Yukpomnang, suivant le pattern des autres services spécialisés (Pharmacie, Hôpital, Taxi, etc.).

## 🎯 VISION DU SERVICE

**QUI** : Femmes gérant les repas familiaux, principalement en Afrique francophone (Cameroun, etc.)

**QUOI** : Service de planification intelligente de menus hebdomadaires avec :
- Génération automatique menus personnalisés (IA)
- Calcul quantités selon nombre de personnes
- Liste de courses intelligente et organisée
- Intégration achats via services Yukpo (marchés, épiceries)
- Menus contextualisés (culturel, saisonnier, budget, diététique)

**COMMENT** :
1. Utilisatrice remplit profil famille (nb personnes, âges, préférences, budget, allergies)
2. IA génère menu semaine personnalisé selon préférences
3. Liste courses générée automatiquement avec quantités
4. Commande via services Yukpo (marchés, épiceries) ou courses manuelles
5. Suivi nutrition et budget hebdomadaire

**POURQUOI** : Faciliter la vie des femmes, économiser temps et argent, meilleure nutrition familiale

---

## 🔍 PHASE 1 : ANALYSE COMPLÈTE DE L'EXISTANT

### A. Vérification Catégories Existantes

1. **Configuration catégorie** : Vérifier `mobile/src/config/categoryConfig.ts` pour :
   - Catégories liées à l'alimentation
   - Services de commerce/marché existants

2. **Services Rust existants** : Chercher dans `backend/src/services/` :
   - Services de commerce/marché
   - Services IA existants (hospital_ai_service.rs, pharmacy_ai_service.rs)

3. **Intégration avec Commerce** :
   - Vérifier service commerce existant
   - Intégration avec achats/produits

### B. Inspiration Services Spécialisés Existants

Analyser la structure complète de :
- `backend/src/services/hospital_ai_service.rs` - Structure service IA
- `backend/src/controllers/specialized_services_controller.rs` - Structure contrôleur
- `mobile/src/screens/specialized/` - Structure écrans spécialisés
- `mobile/src/screens/SpecializedServicesHubScreen.tsx` - Hub principal

---

## 🚀 PHASE 2 : ARCHITECTURE COMPLÈTE

### 2.1 BACKEND RUST

#### Service IA (`menu_planning_ai_service.rs`)

**Fonctionnalités IA** :
- Génération menus personnalisés selon profil famille
- Suggestions recettes selon préférences/budget/allergies
- Calcul quantités automatique selon nombre de personnes
- Analyse nutritionnelle (calories, protéines, glucides, lipides)
- Optimisation budget automatique
- Adaptation saisonnière (produits disponibles)
- Recommandations culturelles (cuisine africaine, camerounaise)

**Structure** :
```rust
pub struct MenuPlanningAIService {
    app_ia: Arc<AppIA>,
}

impl MenuPlanningAIService {
    pub async fn generate_weekly_menu(&self, profile: FamilyProfile) -> Result<WeeklyMenu>
    pub async fn suggest_recipes(&self, preferences: RecipePreferences) -> Result<Vec<Recipe>>
    pub async fn calculate_quantities(&self, recipe_id: i32, servings: i32) -> Result<IngredientList>
    pub async fn analyze_nutrition(&self, menu: WeeklyMenu) -> Result<NutritionAnalysis>
    pub async fn optimize_budget(&self, menu: WeeklyMenu, budget: Decimal) -> Result<WeeklyMenu>
    pub async fn adapt_seasonal(&self, menu: WeeklyMenu, location: Location) -> Result<WeeklyMenu>
}
```

#### Endpoints Backend (~15 endpoints)

**Planification Menus** :
- `POST /api/menus/ai/generate-week` - Générer menu semaine (IA) (JWT)
- `GET /api/menus/my-week` - Mon menu semaine actuel (JWT)
- `GET /api/menus/my-week/:week_start` - Menu semaine spécifique (JWT)
- `PUT /api/menus/my-week/:id` - Modifier menu planifié (JWT)
- `DELETE /api/menus/my-week/:id` - Supprimer menu planifié (JWT)
- `GET /api/menus/history` - Historique menus (JWT)

**Recettes** :
- `GET /api/menus/recipes` - Liste recettes (filtres: type, cuisine, régime)
- `GET /api/menus/recipes/:id` - Détails recette
- `POST /api/menus/ai/suggest-recipes` - Suggérer recettes (IA) (JWT)
- `GET /api/menus/recipes/search` - Recherche recettes (autocomplete)
- `POST /api/menus/recipes/favorites` - Ajouter favoris (JWT)
- `GET /api/menus/recipes/favorites` - Mes recettes favorites (JWT)

**Liste de Courses** :
- `POST /api/menus/shopping-list` - Générer liste courses depuis menu (JWT)
- `GET /api/menus/shopping-list/:week_start` - Liste courses semaine (JWT)
- `PUT /api/menus/shopping-list/:id` - Modifier liste courses (JWT)
- `POST /api/menus/shopping-list/order` - Commander via Yukpo (JWT)

**Nutrition & Analytics** :
- `POST /api/menus/analytics/nutrition` - Analyse nutrition menu (JWT)
- `GET /api/menus/analytics/weekly` - Analytics semaine (JWT)
- `GET /api/menus/analytics/budget` - Analytics budget (JWT)

**Profil Famille** :
- `GET /api/menus/family-profile` - Profil famille (JWT)
- `PUT /api/menus/family-profile` - Mettre à jour profil (JWT)

#### Migrations SQL

Créer fichier `backend/migrations/20250127_create_menu_planning_tables.sql` avec :

**Tables Principales** :
```sql
-- Profil famille utilisatrice
CREATE TABLE family_profiles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    family_name VARCHAR(255),
    total_members INTEGER NOT NULL DEFAULT 1,
    children_count INTEGER DEFAULT 0,
    adults_count INTEGER DEFAULT 1,
    preferences JSONB DEFAULT '{}', -- végétarien, vegan, halal, etc.
    allergies TEXT[], -- liste allergies
    dietary_restrictions TEXT[], -- diabète, hypertension, etc.
    budget_monthly DECIMAL(10,2),
    cuisine_styles TEXT[], -- africaine, camerounaise, occidentale, etc.
    cooking_level VARCHAR(50), -- débutant, intermédiaire, avancé
    time_available_hours DECIMAL(4,2), -- heures disponibles par jour
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Plans menus hebdomadaires
CREATE TABLE menu_plans (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    week_start DATE NOT NULL, -- lundi de la semaine
    week_end DATE NOT NULL, -- dimanche de la semaine
    status VARCHAR(50) DEFAULT 'draft', -- draft, active, completed
    total_budget DECIMAL(10,2),
    actual_cost DECIMAL(10,2),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, week_start)
);

-- Repas planifiés (lien menu_plans -> recipes -> day/meal_type)
CREATE TABLE planned_meals (
    id SERIAL PRIMARY KEY,
    menu_plan_id INTEGER NOT NULL REFERENCES menu_plans(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL, -- 1=lundi, 7=dimanche
    meal_type VARCHAR(50) NOT NULL, -- petit_dejeuner, dejeuner, diner, gouter
    recipe_id INTEGER REFERENCES recipes(id) ON DELETE SET NULL,
    custom_name VARCHAR(255), -- nom personnalisé si pas de recette
    servings INTEGER NOT NULL DEFAULT 1,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Base de données recettes
CREATE TABLE recipes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    cuisine_style VARCHAR(100), -- africaine, camerounaise, occidentale, etc.
    meal_type TEXT[], -- petit_dejeuner, dejeuner, diner
    difficulty VARCHAR(50), -- facile, moyen, difficile
    prep_time_minutes INTEGER,
    cook_time_minutes INTEGER,
    servings INTEGER DEFAULT 1,
    ingredients JSONB NOT NULL, -- [{name, quantity, unit}, ...]
    instructions TEXT[] NOT NULL, -- étapes de préparation
    nutrition_per_serving JSONB, -- {calories, proteins, carbs, fats, fiber}
    tags TEXT[], -- végétarien, vegan, rapide, économique, etc.
    image_url TEXT,
    video_url TEXT, -- vidéo recette optionnelle
    source VARCHAR(255), -- "yukpo_ai", "community", "premium"
    is_premium BOOLEAN DEFAULT FALSE,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recettes favorites utilisatrices
CREATE TABLE recipe_favorites (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, recipe_id)
);

-- Listes de courses
CREATE TABLE shopping_lists (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    menu_plan_id INTEGER REFERENCES menu_plans(id) ON DELETE SET NULL,
    week_start DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed
    organized_by_store BOOLEAN DEFAULT FALSE,
    organized_by_aisle BOOLEAN DEFAULT FALSE,
    total_estimated_cost DECIMAL(10,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Items liste de courses
CREATE TABLE shopping_list_items (
    id SERIAL PRIMARY KEY,
    shopping_list_id INTEGER NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
    ingredient_name VARCHAR(255) NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    unit VARCHAR(50) NOT NULL,
    category VARCHAR(100), -- fruits, légumes, viande, épicerie, etc.
    store_section VARCHAR(100), -- rayon magasin
    preferred_store VARCHAR(255), -- magasin préféré
    is_checked BOOLEAN DEFAULT FALSE,
    actual_price DECIMAL(10,2),
    notes TEXT,
    order_placed BOOLEAN DEFAULT FALSE, -- commande via Yukpo
    order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Analytics nutrition
CREATE TABLE nutrition_analytics (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    menu_plan_id INTEGER NOT NULL REFERENCES menu_plans(id) ON DELETE CASCADE,
    week_start DATE NOT NULL,
    total_calories DECIMAL(10,2),
    total_proteins DECIMAL(10,2),
    total_carbs DECIMAL(10,2),
    total_fats DECIMAL(10,2),
    total_fiber DECIMAL(10,2),
    daily_average JSONB, -- moyenne par jour
    recommendations TEXT[], -- recommandations IA
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX idx_menu_plans_user_week ON menu_plans(user_id, week_start);
CREATE INDEX idx_planned_meals_menu_plan ON planned_meals(menu_plan_id);
CREATE INDEX idx_shopping_lists_user_week ON shopping_lists(user_id, week_start);
CREATE INDEX idx_recipes_tags ON recipes USING GIN(tags);
CREATE INDEX idx_recipes_cuisine ON recipes(cuisine_style);
CREATE INDEX idx_shopping_list_items_list ON shopping_list_items(shopping_list_id);
CREATE INDEX idx_family_profiles_user ON family_profiles(user_id);
```

**Intégrer dans** : `backend/src/migrations/auto_migrate.rs`

### 2.2 FRONTEND MOBILE

#### Écrans Spécialisés à Créer

**Hub & Navigation** :
- `mobile/src/screens/specialized/MenuPlanningHubScreen.tsx` - Hub principal planification menus
- `mobile/src/screens/specialized/MenuWeekCalendarScreen.tsx` - Calendrier visuel semaine avec repas
- `mobile/src/screens/specialized/MenuPlanningOnboardingScreen.tsx` - Wizard profil famille (première fois)

**Recettes** :
- `mobile/src/screens/specialized/RecipeSearchScreen.tsx` - Recherche recettes
- `mobile/src/screens/specialized/RecipeDetailsScreen.tsx` - Détails recette (ingrédients, instructions, vidéo)
- `mobile/src/screens/specialized/RecipeFavoritesScreen.tsx` - Mes recettes favorites

**Liste de Courses** :
- `mobile/src/screens/specialized/ShoppingListScreen.tsx` - Liste courses organisée
- `mobile/src/screens/specialized/ShoppingListOrderScreen.tsx` - Commander via Yukpo

**IA & Analytics** :
- `mobile/src/screens/specialized/MenuAISuggestionsScreen.tsx` - Suggestions IA menus
- `mobile/src/screens/specialized/NutritionAnalysisScreen.tsx` - Analyse nutrition hebdomadaire
- `mobile/src/screens/specialized/MenuBudgetScreen.tsx` - Suivi budget menus

**Configuration** :
- `mobile/src/screens/specialized/FamilyProfileScreen.tsx` - Gérer profil famille

#### Composants Spécialisés

- `mobile/src/components/menu/WeekCalendarView.tsx` - Calendrier visuel semaine avec repas
- `mobile/src/components/menu/RecipeCard.tsx` - Card recette avec image, temps, difficulté
- `mobile/src/components/menu/MealCard.tsx` - Card repas planifié (jour/type/recette)
- `mobile/src/components/menu/ShoppingListOrganized.tsx` - Liste organisée (par magasin/rayon)
- `mobile/src/components/menu/NutritionChart.tsx` - Graphiques nutrition (calories, macronutriments)
- `mobile/src/components/menu/BudgetChart.tsx` - Graphique budget hebdomadaire
- `mobile/src/components/menu/IngredientList.tsx` - Liste ingrédients avec quantités
- `mobile/src/components/menu/FamilyProfileForm.tsx` - Formulaire profil famille

#### Services TypeScript

- `mobile/src/services/menuPlanningService.ts` - Service API planification menus
- `mobile/src/services/recipeService.ts` - Service API recettes
- `mobile/src/services/shoppingListService.ts` - Service API liste courses

#### Intégration dans Hub Services Spécialisés

Ajouter dans `mobile/src/screens/SpecializedServicesHubScreen.tsx` :

```typescript
{
    id: 'menu_planning',
    name: 'Planification Menus',
    icon: 'UtensilsCrossed', // ou 'ChefHat', 'Menu'
    color: '#F59E0B', // Orange/jaune pour cuisine
    count: 0, // menus actifs
    route: 'MenuPlanningHub',
    category: 'vie_quotidienne', // nouvelle catégorie
},
```

### 2.3 FRONTEND WEB (Optionnel Phase 2)

Créer pages correspondantes dans `frontend/src/pages/specialized/menu-planning/`

---

## 🎨 EXPÉRIENCE UTILISATEUR EXCEPTIONNELLE

### Design Inspiré des Leaders

- **Mealime** : Planification menus, liste courses organisée
- **Yummly** : Recettes personnalisées, IA
- **Paprika** : Organisation recettes, planning visuel
- **Meal Prep Pro** : Préparation repas, suivi nutrition

### Fonctionnalités Clés UX

- **Onboarding fluide** : Wizard profil famille avec sauvegarde progressive
- **Calendrier visuel** : Vue semaine claire avec repas par jour/type
- **Génération IA instantanée** : Menu semaine en quelques secondes
- **Personnalisation facile** : Glisser-déposer, remplacement recettes
- **Liste courses intelligente** : Organisée par magasin/rayon, checkboxes
- **Intégration achats** : Commande directe depuis liste via Yukpo
- **Suivi nutrition/budget** : Graphiques clairs, recommandations

### Navigation

- Accès depuis Hub Services Spécialisés
- Navigation fluide entre hub → calendrier → recettes → liste courses
- Retours logiques, breadcrumbs
- Cohérence avec navigation Yukpomnang

---

## 🔧 CONTRAINTES TECHNIQUES

### Migrations SQL
1. **Créer fichier** : `backend/migrations/20250127_create_menu_planning_tables.sql`
2. **Intégrer dans** : `backend/src/migrations/auto_migrate.rs`
3. **Appliquer sur Render** :
   - Database URL : `postgresql://user:password@host:port/database`

### Services IA
1. **Utiliser AppIA** : Comme dans `hospital_ai_service.rs`
2. **Créer service IA** : `menu_planning_ai_service.rs`
3. **Prompts opérationnels** : Créer dans `backend/src/services/ia/prompts/menu_planning_prompts.rs`
   - Prompt génération menu hebdomadaire
   - Prompt suggestions recettes
   - Prompt calcul quantités
   - Prompt analyse nutrition
   - Prompt optimisation budget

### Intégration avec Commerce

- Lier avec service commerce existant
- Comparaison prix produits entre prestataires
- Commande directe depuis liste courses
- Suivi commandes intégré

### Scalabilité

- **Millions de recettes** : Index full-text, cache Redis
- **Génération IA** : Cache résultats menus générés
- **Listes courses** : Optimisation requêtes groupées
- **Scaling horizontal** : Redis partagé, load balancing

---

## ✅ CHECKLIST IMPLÉMENTATION

### Backend
- [ ] Service IA `menu_planning_ai_service.rs` créé
- [ ] Contrôleur endpoints créé
- [ ] Routes ajoutées dans `specialized_services_routes.rs`
- [ ] Migrations SQL créées et intégrées
- [ ] Tests unitaires service IA
- [ ] Documentation API

### Frontend Mobile
- [ ] Écran Hub créé (`MenuPlanningHubScreen.tsx`)
- [ ] Écran Calendrier semaine créé
- [ ] Écran Liste courses créé
- [ ] Écran Détails recette créé
- [ ] Composants réutilisables créés
- [ ] Service TypeScript API créé
- [ ] Intégration dans `SpecializedServicesHubScreen.tsx`
- [ ] Navigation ajoutée dans `AppNavigator.tsx`
- [ ] Tests navigation

### Intégration
- [ ] Intégration service Commerce testée
- [ ] Flux commande depuis liste courses testé
- [ ] Notifications push (rappels menus)
- [ ] Mode hors ligne (synchronisation)

### Tests & Validation
- [ ] Tests linting passés
- [ ] Tests fonctionnels
- [ ] Tests UX (parcours utilisateur)
- [ ] Scalabilité vérifiée
- [ ] Documentation utilisateur

---

## 📊 COMPARAISON AVEC LES LEADERS

| Aspect | Leader Occidental | Notre Niveau | Améliorations Nécessaires |
|--------|------------------|--------------|---------------------------|
| Design | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Design moderne, animations fluides |
| Navigation | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Fluidité, intuitivité |
| IA Génération | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Prompts optimisés, cache |
| Liste Courses | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Organisation intelligente |
| Intégration Achats | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Commande directe Yukpo |
| Nutrition | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Analytics détaillés |

---

## 🚀 PHASES D'IMPLÉMENTATION

### Phase 1 : Backend Core (MVP)
- Service IA génération menus
- Endpoints CRUD menus
- Migrations SQL
- Base recettes

### Phase 2 : Frontend Mobile MVP
- Hub principal
- Calendrier semaine
- Liste courses basique
- Détails recette

### Phase 3 : Intégrations
- Intégration Commerce
- Commande depuis liste
- Notifications push

### Phase 4 : Fonctionnalités Avancées
- Analytics nutrition/budget
- Suggestions IA avancées
- Partage menus
- Recettes communauté

---

**Ce document sert de guide complet pour l'implémentation du service Planification Menus dans les services spécialisés Yukpomnang.**

