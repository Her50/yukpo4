/**
 * 🧠 SERVICE D'AUTOCOMPLETE INTELLIGENT POUR PRODUITS
 * 
 * Système multi-niveaux qui suggère intelligemment les valeurs en fonction :
 * - Des champs précédemment remplis (logique conditionnelle)
 * - Des modalités les plus utilisées (statistiques)
 * - De l'historique utilisateur (personnalisation)
 * - Des patterns détectés (IA/ML léger)
 */

// ✅ CORRIGÉ: Utiliser SafeStorage pour éviter les erreurs "Driver not found"
import { getFieldOptions } from '../data/productModalities';
import { MODELES_PAR_MARQUE_AUTO } from '../utils/parseExistingModalities';
import SafeStorage from '../utils/safeStorage';
import { apiGet } from './api';
import { modalityService } from './modalityService';

interface AutocompleteContext {
    productType: string;
    category: string;
    previousFields: Record<string, any>; // Champs déjà remplis
    userId?: string;
}

interface SuggestionRule {
    // Si ces conditions sont remplies
    conditions: Record<string, any>;
    // Alors suggérer ces valeurs
    suggestions: string[];
    // Poids de la suggestion (0-100)
    weight: number;
}

interface AutocompleteSuggestion {
    value: string;
    source: 'rules' | 'history' | 'popular' | 'ai' | 'static';
    weight: number;
    reason?: string; // Pourquoi cette suggestion ?
}

class IntelligentProductAutocomplete {
    private cache = new Map<string, AutocompleteSuggestion[]>();
    private userHistory = new Map<string, string[]>();
    private rulesInitialized = false;

    // ═══════════════════════════════════════════════════════════
    // 🎯 NIVEAU 1 : RÈGLES CONDITIONNELLES INTELLIGENTES
    // ═══════════════════════════════════════════════════════════

    /**
     * ✨ NOUVEAU : Les règles sont générées DYNAMIQUEMENT depuis votre base existante !
     * Plus besoin de tout écrire manuellement
     */
    private rules: Record<string, SuggestionRule[]> = {};

    /**
     * Constructeur : Initialise les règles au premier appel
     */
    constructor() {
        // Les règles seront initialisées au premier appel de getSuggestions
        // pour éviter les imports circulaires
    }

    /**
     * Initialiser les règles depuis votre base productModalities.ts existante
     */
    private initializeRules() {
        // ═══════════════════════════════════════════════════════════
        // 📱 TÉLÉPHONES : Règles marque → modèles (AUTO-GÉNÉRÉES)
        // ═══════════════════════════════════════════════════════════
        const telephoneRules: SuggestionRule[] = [];
        const telephoneMapping = MODELES_PAR_MARQUE_AUTO.telephone || {};

        Object.entries(telephoneMapping).forEach(([marque, modeles]) => {
            if (modeles.length > 0) {
                telephoneRules.push({
                    conditions: { marque: new RegExp(marque, 'i') },
                    suggestions: modeles,
                    weight: 95
                });
            }
        });

        this.rules['telephone:modele'] = telephoneRules;
        console.log(`✅ [IntelligentAutocomplete] ${telephoneRules.length} règles téléphone générées`);

        // ═══════════════════════════════════════════════════════════
        // 🚗 AUTOMOBILES : Règles marque → modèles (AUTO-GÉNÉRÉES)
        // ═══════════════════════════════════════════════════════════
        const autoRules: SuggestionRule[] = [];
        const autoMapping = MODELES_PAR_MARQUE_AUTO.automobile || {};

        Object.entries(autoMapping).forEach(([marque, modeles]) => {
            if (modeles.length > 0) {
                autoRules.push({
                    conditions: { marque: new RegExp(marque, 'i') },
                    suggestions: modeles,
                    weight: 90
                });
            }
        });

        this.rules['automobile:modele'] = autoRules;
        console.log(`✅ [IntelligentAutocomplete] ${autoRules.length} règles automobile générées`);

        // ═══════════════════════════════════════════════════════════
        // 🌍 COVOITURAGE : Villes proches (RÈGLES STATIQUES)
        // ═══════════════════════════════════════════════════════════
        this.rules['covoiturage:ville_arrivee'] = [
            {
                conditions: { ville_depart: /Douala/i },
                suggestions: ['Yaoundé', 'Bafoussam', 'Limbé', 'Kribi', 'Edéa'],
                weight: 85
            },
            {
                conditions: { ville_depart: /Yaoundé/i },
                suggestions: ['Douala', 'Bafoussam', 'Bertoua', 'Ebolowa', 'Ngaoundéré'],
                weight: 85
            },
            {
                conditions: { ville_depart: /Bafoussam/i },
                suggestions: ['Yaoundé', 'Douala', 'Foumban', 'Dschang', 'Bamenda'],
                weight: 85
            },
        ];

        // ═══════════════════════════════════════════════════════════
        // 🏠 IMMOBILIER : Type → Nombre de pièces (RÈGLES STATIQUES)
        // ═══════════════════════════════════════════════════════════
        this.rules['immobilier:nombre_pieces'] = [
            {
                conditions: { type_bien: /Appartement|Studio|F\d/i },
                suggestions: ['Studio', 'F1 (1 pièce)', 'F2 (2 pièces)', 'F3 (3 pièces)', 'F4 (4 pièces)', 'F5 (5 pièces)'],
                weight: 80
            },
            {
                conditions: { type_bien: /Villa|Maison/i },
                suggestions: ['2 chambres', '3 chambres', '4 chambres', '5 chambres', '6+ chambres'],
                weight: 80
            },
        ];

        console.log(`✅ [IntelligentAutocomplete] Toutes les règles initialisées depuis votre base existante`);
    }

    // ═══════════════════════════════════════════════════════════
    // 🔥 NIVEAU 2 : SUGGESTIONS BASÉES SUR LE CONTEXTE
    // ═══════════════════════════════════════════════════════════

    async getSuggestions(
        fieldKey: string,
        searchQuery: string,
        context: AutocompleteContext
    ): Promise<AutocompleteSuggestion[]> {
        // Initialiser les règles au premier appel
        if (!this.rulesInitialized) {
            this.initializeRules();
            this.rulesInitialized = true;
        }

        const allSuggestions: AutocompleteSuggestion[] = [];

        // 1️⃣ Suggestions basées sur les règles conditionnelles
        const ruleSuggestions = this.getRuleBasedSuggestions(fieldKey, context);
        allSuggestions.push(...ruleSuggestions);

        // 2️⃣ Suggestions depuis l'historique utilisateur
        const historySuggestions = await this.getUserHistorySuggestions(fieldKey, context.userId);
        allSuggestions.push(...historySuggestions);

        // 3️⃣ Suggestions les plus populaires (tous utilisateurs)
        const popularSuggestions = await this.getPopularSuggestions(context.productType, fieldKey);
        allSuggestions.push(...popularSuggestions);

        // 4️⃣ Suggestions depuis la base de données locale (productModalities)
        const staticSuggestions = await this.getStaticSuggestions(context.productType, fieldKey);
        allSuggestions.push(...staticSuggestions);

        // 5️⃣ Suggestions depuis le backend (API custom modalities)
        const backendSuggestions = await this.getBackendSuggestions(fieldKey, searchQuery, context);
        allSuggestions.push(...backendSuggestions);

        // ✅ Filtrer par searchQuery si fourni
        const filtered = searchQuery.trim()
            ? allSuggestions.filter(s =>
                s.value.toLowerCase().includes(searchQuery.toLowerCase())
            )
            : allSuggestions;

        // ✅ Dédupliquer et trier par poids
        return this.deduplicateAndSort(filtered);
    }

    // ═══════════════════════════════════════════════════════════
    // 🎯 RÈGLES CONDITIONNELLES
    // ═══════════════════════════════════════════════════════════

    private getRuleBasedSuggestions(
        fieldKey: string,
        context: AutocompleteContext
    ): AutocompleteSuggestion[] {
        const key = `${context.category}:${fieldKey}`;
        const rules = this.rules[key] || [];

        const suggestions: AutocompleteSuggestion[] = [];

        for (const rule of rules) {
            // Vérifier si toutes les conditions sont remplies
            const conditionsMet = Object.entries(rule.conditions).every(([field, value]) => {
                const fieldValue = context.previousFields[field];
                if (!fieldValue) return false;

                if (value instanceof RegExp) {
                    return value.test(fieldValue);
                }
                return fieldValue === value;
            });

            if (conditionsMet) {
                suggestions.push(...rule.suggestions.map(s => ({
                    value: s,
                    source: 'rules' as const,
                    weight: rule.weight,
                    reason: `Suggéré car ${Object.keys(rule.conditions).join(', ')} correspond`
                })));
            }
        }

        return suggestions;
    }

    // ═══════════════════════════════════════════════════════════
    // 📊 HISTORIQUE UTILISATEUR
    // ═══════════════════════════════════════════════════════════

    private async getUserHistorySuggestions(
        fieldKey: string,
        userId?: string
    ): Promise<AutocompleteSuggestion[]> {
        try {
            const storageKey = userId
                ? `@yukpomnang_history_${fieldKey}_${userId}`
                : `@yukpomnang_history_${fieldKey}`;

            const historyJson = await SafeStorage.getItem(storageKey);
            if (!historyJson) return [];

            const history: string[] = JSON.parse(historyJson);

            return history.slice(0, 5).map((value, index) => ({
                value,
                source: 'history' as const,
                weight: 70 - (index * 5), // Plus récent = plus de poids
                reason: 'Utilisé récemment'
            }));
        } catch (error) {
            console.error('[IntelligentAutocomplete] Erreur historique:', error);
            return [];
        }
    }

    private async saveToHistory(fieldKey: string, value: string, userId?: string): Promise<void> {
        try {
            const storageKey = userId
                ? `@yukpomnang_history_${fieldKey}_${userId}`
                : `@yukpomnang_history_${fieldKey}`;

            const historyJson = await SafeStorage.getItem(storageKey);
            let history: string[] = historyJson ? JSON.parse(historyJson) : [];

            // Retirer si déjà présent
            history = history.filter(h => h !== value);

            // Ajouter en premier
            history.unshift(value);

            // Limiter à 20 entrées
            history = history.slice(0, 20);

            await SafeStorage.setItem(storageKey, JSON.stringify(history));
        } catch (error) {
            console.error('[IntelligentAutocomplete] Erreur sauvegarde historique:', error);
        }
    }

    // ═══════════════════════════════════════════════════════════
    // 🔥 SUGGESTIONS POPULAIRES
    // ═══════════════════════════════════════════════════════════

    private async getPopularSuggestions(
        productType: string,
        fieldKey: string
    ): Promise<AutocompleteSuggestion[]> {
        try {
            const popular = await modalityService.getPopularModalities(productType, fieldKey, 10);

            return popular.map((value, index) => ({
                value,
                source: 'popular' as const,
                weight: 60 - (index * 2),
                reason: 'Souvent utilisé par d\'autres'
            }));
        } catch (error) {
            console.error('[IntelligentAutocomplete] Erreur suggestions populaires:', error);
            return [];
        }
    }

    // ═══════════════════════════════════════════════════════════
    // 📚 SUGGESTIONS STATIQUES (Votre productModalities.ts existante)
    // ═══════════════════════════════════════════════════════════

    private async getStaticSuggestions(
        productType: string,
        fieldKey: string
    ): Promise<AutocompleteSuggestion[]> {
        try {
            // ✅ Utiliser directement votre base existante via getFieldOptions
            const options = getFieldOptions(productType, fieldKey);

            if (!options || options.length === 0) return [];

            // Filtrer l'option "🆕 Autre (ajouter)"
            const validOptions = options.filter(opt => !opt.includes('🆕'));

            return validOptions.map(value => ({
                value,
                source: 'static' as const,
                weight: 40,
                reason: 'Disponible dans la base'
            }));
        } catch (error) {
            console.error('[IntelligentAutocomplete] Erreur suggestions statiques:', error);
            return [];
        }
    }

    // ═══════════════════════════════════════════════════════════
    // 🌐 SUGGESTIONS BACKEND
    // ═══════════════════════════════════════════════════════════

    private async getBackendSuggestions(
        fieldKey: string,
        searchQuery: string,
        context: AutocompleteContext
    ): Promise<AutocompleteSuggestion[]> {
        try {
            const params = new URLSearchParams({
                type: fieldKey,
                search: searchQuery,
                productType: context.productType,
                category: context.category,
                context: JSON.stringify(context.previousFields)
            });

            const response = await apiGet(`/api/modalities/suggestions?${params}`);

            if (response && Array.isArray(response.suggestions)) {
                return response.suggestions.map((value: string) => ({
                    value,
                    source: 'ai' as const,
                    weight: 50,
                    reason: 'Suggéré par l\'IA'
                }));
            }

            return [];
        } catch (error) {
            console.error('[IntelligentAutocomplete] Erreur backend:', error);
            return [];
        }
    }

    // ═══════════════════════════════════════════════════════════
    // 🔧 UTILITAIRES
    // ═══════════════════════════════════════════════════════════

    private deduplicateAndSort(suggestions: AutocompleteSuggestion[]): AutocompleteSuggestion[] {
        // Grouper par valeur et garder le meilleur poids
        const grouped = new Map<string, AutocompleteSuggestion>();

        for (const suggestion of suggestions) {
            const existing = grouped.get(suggestion.value);
            if (!existing || suggestion.weight > existing.weight) {
                grouped.set(suggestion.value, suggestion);
            }
        }

        // Trier par poids décroissant
        return Array.from(grouped.values())
            .sort((a, b) => b.weight - a.weight)
            .slice(0, 15); // Limiter à 15 suggestions
    }

    // ═══════════════════════════════════════════════════════════
    // 📝 ENREGISTREMENT DE SÉLECTION
    // ═══════════════════════════════════════════════════════════

    async recordSelection(
        fieldKey: string,
        value: string,
        context: AutocompleteContext
    ): Promise<void> {
        // Sauvegarder dans l'historique utilisateur
        await this.saveToHistory(fieldKey, value, context.userId);

        // Incrémenter le compteur d'utilisation
        await modalityService.incrementUsage(context.productType, fieldKey, value);

        console.log(`✅ [IntelligentAutocomplete] Sélection enregistrée: ${fieldKey} = ${value}`);
    }

    // ═══════════════════════════════════════════════════════════
    // 🧠 AJOUT DE NOUVELLES RÈGLES (APPRENTISSAGE)
    // ═══════════════════════════════════════════════════════════

    async learnFromPattern(
        fieldKey: string,
        value: string,
        context: AutocompleteContext
    ): Promise<void> {
        // TODO: Implémenter l'apprentissage automatique
        // Analyser les patterns pour créer automatiquement de nouvelles règles
        // Exemple: Si 80% des utilisateurs qui sélectionnent "Toyota" choisissent "Corolla",
        // créer une règle automatique

        console.log(`🧠 [IntelligentAutocomplete] Pattern détecté pour apprentissage`);
    }
}

// Instance singleton
export const intelligentProductAutocomplete = new IntelligentProductAutocomplete();

