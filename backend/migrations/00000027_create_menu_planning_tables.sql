-- Tables pour service Planification Menus
-- Migration: 20250127_create_menu_planning_tables.sql

-- Profil famille utilisatrice
CREATE TABLE IF NOT EXISTS family_profiles (
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

-- Base de données recettes
CREATE TABLE IF NOT EXISTS recipes (
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

-- Plans menus hebdomadaires
CREATE TABLE IF NOT EXISTS menu_plans (
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
CREATE TABLE IF NOT EXISTS planned_meals (
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

-- Recettes favorites utilisatrices
CREATE TABLE IF NOT EXISTS recipe_favorites (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, recipe_id)
);

-- Listes de courses
CREATE TABLE IF NOT EXISTS shopping_lists (
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
CREATE TABLE IF NOT EXISTS shopping_list_items (
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
    order_id INTEGER, -- Référence vers commande (peut être lié à shopping_orders ou delivery_requests)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Analytics nutrition
CREATE TABLE IF NOT EXISTS nutrition_analytics (
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
CREATE INDEX IF NOT EXISTS idx_menu_plans_user_week ON menu_plans(user_id, week_start);
CREATE INDEX IF NOT EXISTS idx_planned_meals_menu_plan ON planned_meals(menu_plan_id);
CREATE INDEX IF NOT EXISTS idx_shopping_lists_user_week ON shopping_lists(user_id, week_start);
CREATE INDEX IF NOT EXISTS idx_recipes_tags ON recipes USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_recipes_cuisine ON recipes(cuisine_style);
CREATE INDEX IF NOT EXISTS idx_shopping_list_items_list ON shopping_list_items(shopping_list_id);
CREATE INDEX IF NOT EXISTS idx_family_profiles_user ON family_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_recipe_favorites_user ON recipe_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_nutrition_analytics_user_week ON nutrition_analytics(user_id, week_start);

-- Commentaires pour documentation
COMMENT ON TABLE family_profiles IS 'Profils famille pour planification menus personnalisée';
COMMENT ON TABLE recipes IS 'Base de données recettes (IA, communauté, premium)';
COMMENT ON TABLE menu_plans IS 'Plans menus hebdomadaires utilisatrices';
COMMENT ON TABLE planned_meals IS 'Repas planifiés par jour/type dans menu';
COMMENT ON TABLE shopping_lists IS 'Listes de courses générées depuis menus';
COMMENT ON TABLE shopping_list_items IS 'Items individuels dans liste courses';
COMMENT ON TABLE nutrition_analytics IS 'Analytics nutrition hebdomadaires';

