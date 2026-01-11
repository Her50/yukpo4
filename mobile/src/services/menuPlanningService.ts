// ✅ Service API pour Planification Menus
import { apiGet, apiPost, apiPut } from './api';

// Types pour les réponses
export interface FamilyProfile {
    total_members: number;
    children_count: number;
    adults_count: number;
    preferences: string[];
    allergies: string[];
    dietary_restrictions: string[];
    budget_monthly?: number;
    cuisine_styles: string[];
    cooking_level?: string;
    time_available_hours?: number;
}

export interface MealItem {
    recipe_name: string;
    recipe_id?: number;
    servings: number;
    prep_time_minutes?: number;
    estimated_cost?: number;
    calories?: number;
}

export interface DailyMeal {
    day: number; // 1=lundi, 7=dimanche
    day_name: string;
    petit_dejeuner?: MealItem;
    dejeuner?: MealItem;
    diner?: MealItem;
    gouter?: MealItem;
}

export interface WeeklyMenu {
    week_start: string;
    meals: DailyMeal[];
    total_estimated_cost?: number;
    total_calories_per_day?: number;
    recommendations: string[];
}

export interface MenuPlan {
    id: number;
    user_id: number;
    week_start: string;
    week_end: string;
    status: string;
    total_budget?: number;
    actual_cost?: number;
    notes?: string;
    created_at: string;
    updated_at: string;
}

export interface RecipeSuggestion {
    recipe_id?: number;
    name: string;
    description: string;
    cuisine_style?: string;
    meal_type: string[];
    difficulty?: string;
    prep_time_minutes?: number;
    estimated_cost?: number;
    match_score: number;
    reasoning: string;
}

export interface ShoppingListItem {
    id: number;
    ingredient_name: string;
    quantity: number;
    unit: string;
    category?: string;
    store_section?: string;
    is_checked: boolean;
    actual_price?: number;
}

export interface ShoppingList {
    id: number;
    user_id: number;
    menu_plan_id?: number;
    week_start: string;
    status: string;
    items: ShoppingListItem[];
    total_estimated_cost?: number;
}

export interface GeneratedRecipe {
    recipe_name: string;
    description: string;
    cuisine_style?: string;
    meal_type: string[];
    difficulty?: string;
    prep_time_minutes?: number;
    cook_time_minutes?: number;
    total_time_minutes?: number;
    servings: number;
    ingredients: Array<{
        name: string;
        quantity: number;
        unit: string;
        notes?: string;
    }>;
    instructions: string[];
    tips?: string[];
    estimated_cost?: number;
    calories_per_serving?: number;
    nutrition?: {
        proteins: number;
        carbs: number;
        fats: number;
        fiber: number;
    };
    tags?: string[];
}

export const menuPlanningService = {
    // ✅ Générer menu hebdomadaire avec IA
    // ✅ NOUVEAU: currentGps optionnel pour envoyer la localisation actuelle dynamiquement
    generateWeeklyMenu: async (
        weekStart?: string, 
        profileOverride?: Partial<FamilyProfile>,
        currentGps?: string // Format: "lat,lng" ou "lng,lat"
    ) => {
        const response = await apiPost<{
            success: boolean;
            menu: WeeklyMenu;
            menu_plan_id?: number;
            week_start: string;
            week_end: string;
        }>('/api/menus/ai/generate-week', {
            week_start: weekStart,
            profile_override: profileOverride,
            current_gps: currentGps, // ✅ Envoi dynamique de la localisation actuelle
        });
        return response;
    },

    // ✅ Récupérer menu de la semaine
    getMyWeekMenu: async (weekStart?: string) => {
        const params = weekStart ? `?week_start=${weekStart}` : '';
        const response = await apiGet<{
            success: boolean;
            menu_plan: MenuPlan | null;
            message?: string;
        }>(`/api/menus/my-week${params}`);
        return response;
    },

    // ✅ Récupérer profil famille
    getFamilyProfile: async () => {
        const response = await apiGet<{
            success: boolean;
            profile: FamilyProfile;
        }>('/api/menus/family-profile');
        return response;
    },

    // ✅ Mettre à jour profil famille
    updateFamilyProfile: async (profile: Partial<FamilyProfile>) => {
        const response = await apiPut<{
            success: boolean;
            message: string;
        }>('/api/menus/family-profile', profile);
        return response;
    },

    // ✅ Suggérer des recettes (à implémenter côté backend)
    suggestRecipes: async (
        mealType?: string,
        limit: number = 10
    ) => {
        const response = await apiPost<{
            success: boolean;
            suggestions: RecipeSuggestion[];
        }>('/api/menus/ai/suggest-recipes', {
            meal_type: mealType,
            limit,
        });
        return response;
    },

    // ✅ Générer liste de courses (à implémenter côté backend)
    generateShoppingList: async (weekStart?: string) => {
        const response = await apiPost<{
            success: boolean;
            shopping_list: ShoppingList;
        }>('/api/menus/shopping-list', {
            week_start: weekStart,
        });
        return response;
    },

    // ✅ Récupérer liste de courses (à implémenter côté backend)
    getShoppingList: async (weekStart?: string) => {
        const params = weekStart ? `?week_start=${weekStart}` : '';
        const response = await apiGet<{
            success: boolean;
            shopping_list: ShoppingList | null;
        }>(`/api/menus/shopping-list${params}`);
        return response;
    },

    // ✅ NOUVEAU: Générer une recette complète avec IA
    generateRecipe: async (recipeName: string, servings?: number) => {
        const response = await apiPost<{
            success: boolean;
            recipe: GeneratedRecipe;
        }>('/api/menus/ai/generate-recipe', {
            recipe_name: recipeName,
            servings: servings || 4,
        });
        return response;
    },
};

